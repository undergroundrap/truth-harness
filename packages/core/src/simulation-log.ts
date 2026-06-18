import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export const SIMULATION_KINDS = [
  "numeric",
  "symbolic",
  "physics",
  "molecular",
  "statistical",
  "agentic",
  "other"
] as const;

export const SIMULATION_STAGES = [
  "planned",
  "computed",
  "reproduced",
  "benchmarked",
  "experimentally-compared"
] as const;

export type SimulationKind = (typeof SIMULATION_KINDS)[number];
export type SimulationStage = (typeof SIMULATION_STAGES)[number];

export interface SimulationScalar {
  name: string;
  value: string;
  unit?: string;
  note?: string;
}

export interface SimulationLogEntry {
  schemaVersion: typeof SIMULATION_SCHEMA_VERSION;
  simulationId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  question: string;
  kind: SimulationKind;
  stage: SimulationStage;
  engine: string;
  engineVersion?: string;
  modelName: string;
  modelVersion?: string;
  inputRefs: string[];
  outputRefs: string[];
  codeRefs: string[];
  parameters: SimulationScalar[];
  metrics: SimulationScalar[];
  assumptions: string[];
  uncertainty: string[];
  limitations: string[];
  nextChecks: string[];
  validationBoundary: {
    computationalOnly: boolean;
    simulationIsNotReality: boolean;
    requiresExpertReview: boolean;
    requiresRealWorldValidation: boolean;
    requiredNextValidation: string[];
  };
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface CreateSimulationLogInput {
  rootPath: string;
  title?: string;
  question: string;
  kind?: SimulationKind;
  stage?: SimulationStage;
  engine: string;
  engineVersion?: string;
  modelName: string;
  modelVersion?: string;
  inputRefs?: string[];
  outputRefs?: string[];
  codeRefs?: string[];
  parameters?: SimulationScalar[];
  metrics?: SimulationScalar[];
  assumptions?: string[];
  uncertainty?: string[];
  limitations?: string[];
  nextChecks?: string[];
  now?: string;
}

export interface SimulationLogWriteResult {
  entry: SimulationLogEntry;
  path: string;
}

const SIMULATION_SCHEMA_VERSION = "truth-harness.simulation.v0" as const;

export function isSimulationKind(value: string): value is SimulationKind {
  return (SIMULATION_KINDS as readonly string[]).includes(value);
}

export function isSimulationStage(value: string): value is SimulationStage {
  return (SIMULATION_STAGES as readonly string[]).includes(value);
}

export async function createSimulationLogEntry(input: CreateSimulationLogInput): Promise<SimulationLogWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const question = requireText(input.question, "Simulation question is required.");
  const engine = requireText(input.engine, "Simulation engine is required.");
  const modelName = requireText(input.modelName, "Simulation model name is required.");
  const kind = input.kind ?? "numeric";
  const stage = input.stage ?? "computed";
  const assumptions = normalizeStringList(input.assumptions ?? []);
  const uncertainty = normalizeStringList(input.uncertainty ?? []);
  const limitations = normalizeStringList(input.limitations ?? []);
  const nextChecks = normalizeStringList(input.nextChecks ?? []);
  const entryWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromQuestion(question),
    question,
    kind,
    stage,
    engine,
    engineVersion: normalizeOptionalText(input.engineVersion),
    modelName,
    modelVersion: normalizeOptionalText(input.modelVersion),
    inputRefs: normalizeStringList(input.inputRefs ?? []),
    outputRefs: normalizeStringList(input.outputRefs ?? []),
    codeRefs: normalizeStringList(input.codeRefs ?? []),
    parameters: normalizeScalars(input.parameters ?? []),
    metrics: normalizeScalars(input.metrics ?? []),
    assumptions,
    uncertainty,
    limitations,
    nextChecks
  };
  const simulationId = `sim_${stableHash(entryWithoutId).slice(0, 16)}`;
  const validationBoundary = validationBoundaryFor({ stage, kind, nextChecks });
  const entry: SimulationLogEntry = {
    schemaVersion: SIMULATION_SCHEMA_VERSION,
    simulationId,
    ...entryWithoutId,
    updatedAt: createdAt,
    validationBoundary,
    privacy: manifest.privacy,
    warnings: warningsFor({ stage, assumptions, uncertainty, limitations, nextChecks })
  };
  await assertSimulationSchema(entry);

  const simulationsDir = resolve(status.root, manifest.directories.simulations);
  await mkdir(simulationsDir, { recursive: true });
  const path = join(simulationsDir, `${entry.createdAt.slice(0, 10)}-${entry.simulationId}.json`);
  await writeJsonFileAtomic(path, entry);
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, path),
    kind: "simulations",
    now: entry.createdAt,
    staleReason: "simulation log entry written"
  });

  return { entry, path };
}

async function assertSimulationSchema(entry: SimulationLogEntry): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: entry,
    schemaFile: "simulation-log.schema.json",
    artifactName: "Simulation log entry"
  });
}

export async function listSimulationLogEntries(rootPath: string): Promise<SimulationLogEntry[]> {
  const status = await requireLocalWorkspace(rootPath);
  const simulationsDir = resolve(status.root, status.manifest.directories.simulations);

  let files: string[];
  try {
    files = await readdir(simulationsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const entries = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => parseJsonWithOptionalBom(await readFile(join(simulationsDir, file), "utf8")) as SimulationLogEntry)
  );

  return entries
    .filter((entry) => entry.schemaVersion === SIMULATION_SCHEMA_VERSION)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing simulation logs.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function validationBoundaryFor(input: {
  stage: SimulationStage;
  kind: SimulationKind;
  nextChecks: string[];
}): SimulationLogEntry["validationBoundary"] {
  const requiredNextValidation = input.nextChecks.length > 0 ? input.nextChecks : defaultNextValidation(input.kind);

  return {
    computationalOnly: input.stage !== "experimentally-compared",
    simulationIsNotReality: true,
    requiresExpertReview: true,
    requiresRealWorldValidation: input.stage !== "experimentally-compared",
    requiredNextValidation
  };
}

function defaultNextValidation(kind: SimulationKind): string[] {
  const common = ["independent reproduction", "assumption review", "sensitivity analysis"];

  if (kind === "molecular") {
    return [...common, "domain expert review", "wet-lab or validated external assay before biological claims"];
  }

  if (kind === "physics") {
    return [...common, "compare against measured data or accepted benchmark cases"];
  }

  return [...common, "compare against independent implementation or benchmark data"];
}

function warningsFor(input: {
  stage: SimulationStage;
  assumptions: string[];
  uncertainty: string[];
  limitations: string[];
  nextChecks: string[];
}): string[] {
  const warnings = [
    "Simulation evidence is computational evidence; it does not establish real-world, clinical, safety, regulatory, or patent validity.",
    "Treat outputs as hypotheses until assumptions, implementation, uncertainty, and external validation have been reviewed."
  ];

  if (input.stage !== "experimentally-compared") {
    warnings.push(`Current simulation stage is ${input.stage}; real-world validation is still required for physical, biological, medical, or safety-critical claims.`);
  }

  if (input.assumptions.length === 0) {
    warnings.push("No assumptions were recorded; simulation evidence is weak without explicit assumptions.");
  }

  if (input.uncertainty.length === 0) {
    warnings.push("No uncertainty notes were recorded; simulation outputs should include numerical, model, or data uncertainty.");
  }

  if (input.limitations.length === 0) {
    warnings.push("No limitations were recorded; reviewers need model and implementation boundaries.");
  }

  if (input.nextChecks.length === 0) {
    warnings.push("No next validation checks were recorded.");
  }

  return warnings;
}

function requireText(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function titleFromQuestion(question: string): string {
  return question.length <= 72 ? question : `${question.slice(0, 69)}...`;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value)))];
}

function normalizeScalars(values: SimulationScalar[]): SimulationScalar[] {
  return values.map((value) => ({
    name: requireText(value.name, "Simulation scalar name is required."),
    value: requireText(value.value, "Simulation scalar value is required."),
    unit: normalizeOptionalText(value.unit),
    note: normalizeOptionalText(value.note)
  }));
}

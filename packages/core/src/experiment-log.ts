import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";

export const EXPERIMENT_KINDS = [
  "bench",
  "wet-lab",
  "field",
  "preclinical",
  "clinical",
  "observational",
  "other"
] as const;

export const EXPERIMENT_STAGES = [
  "planned",
  "protocol-drafted",
  "running",
  "completed",
  "replicated",
  "failed",
  "inconclusive"
] as const;

export const EXPERIMENT_OUTCOMES = ["not-run", "observed", "not-observed", "mixed", "inconclusive"] as const;

export type ExperimentKind = (typeof EXPERIMENT_KINDS)[number];
export type ExperimentStage = (typeof EXPERIMENT_STAGES)[number];
export type ExperimentOutcome = (typeof EXPERIMENT_OUTCOMES)[number];

export interface ExperimentMeasurement {
  name: string;
  value: string;
  unit?: string;
  note?: string;
}

export interface ExperimentLogEntry {
  schemaVersion: "theorem.experiment.v0";
  experimentId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  question: string;
  kind: ExperimentKind;
  stage: ExperimentStage;
  protocolRefs: string[];
  dataRefs: string[];
  analysisRefs: string[];
  evidenceRefs: string[];
  observations: string[];
  measurements: ExperimentMeasurement[];
  outcome: {
    status: ExperimentOutcome;
    summary: string;
  };
  limitations: string[];
  nextChecks: string[];
  review: {
    humanExpertReviewRequired: true;
    ethicsReviewRequired: boolean;
    ethicsApprovalRefs: string[];
    regulatoryReviewRequired: boolean;
    regulatoryReviewRefs: string[];
    safetyReviewRequired: boolean;
  };
  validationBoundary: {
    experimentalEvidence: boolean;
    requiresReplication: boolean;
    requiresExpertReview: true;
    notClinicalProof: boolean;
    notRegulatoryApproval: true;
  };
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface CreateExperimentLogInput {
  rootPath: string;
  title?: string;
  question: string;
  kind?: ExperimentKind;
  stage?: ExperimentStage;
  protocolRefs?: string[];
  dataRefs?: string[];
  analysisRefs?: string[];
  evidenceRefs?: string[];
  observations?: string[];
  measurements?: ExperimentMeasurement[];
  outcomeStatus?: ExperimentOutcome;
  outcomeSummary?: string;
  limitations?: string[];
  nextChecks?: string[];
  humanSubjects?: boolean;
  biologicalOrMedical?: boolean;
  ethicsApprovalRefs?: string[];
  regulatoryReviewRefs?: string[];
  now?: string;
}

export interface ExperimentLogWriteResult {
  entry: ExperimentLogEntry;
  path: string;
}

export function isExperimentKind(value: string): value is ExperimentKind {
  return (EXPERIMENT_KINDS as readonly string[]).includes(value);
}

export function isExperimentStage(value: string): value is ExperimentStage {
  return (EXPERIMENT_STAGES as readonly string[]).includes(value);
}

export function isExperimentOutcome(value: string): value is ExperimentOutcome {
  return (EXPERIMENT_OUTCOMES as readonly string[]).includes(value);
}

export async function createExperimentLogEntry(input: CreateExperimentLogInput): Promise<ExperimentLogWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const question = requireText(input.question, "Experiment question is required.");
  const kind = input.kind ?? "bench";
  const stage = input.stage ?? "planned";
  const ethicsApprovalRefs = normalizeStringList(input.ethicsApprovalRefs ?? []);
  const regulatoryReviewRefs = normalizeStringList(input.regulatoryReviewRefs ?? []);
  const biologicalOrMedical = input.biologicalOrMedical ?? isBiologicalOrMedicalKind(kind);
  const humanSubjects = input.humanSubjects ?? kind === "clinical";
  const review = {
    humanExpertReviewRequired: true as const,
    ethicsReviewRequired: humanSubjects || kind === "clinical",
    ethicsApprovalRefs,
    regulatoryReviewRequired: biologicalOrMedical || kind === "preclinical" || kind === "clinical",
    regulatoryReviewRefs,
    safetyReviewRequired: biologicalOrMedical || kind === "wet-lab" || kind === "preclinical" || kind === "clinical"
  };
  const outcome = {
    status: input.outcomeStatus ?? defaultOutcomeForStage(stage),
    summary: normalizeOptionalText(input.outcomeSummary) ?? "No outcome summary recorded."
  };
  const entryWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromQuestion(question),
    question,
    kind,
    stage,
    protocolRefs: normalizeStringList(input.protocolRefs ?? []),
    dataRefs: normalizeStringList(input.dataRefs ?? []),
    analysisRefs: normalizeStringList(input.analysisRefs ?? []),
    evidenceRefs: normalizeStringList(input.evidenceRefs ?? []),
    observations: normalizeStringList(input.observations ?? []),
    measurements: normalizeMeasurements(input.measurements ?? []),
    outcome,
    limitations: normalizeStringList(input.limitations ?? []),
    nextChecks: normalizeStringList(input.nextChecks ?? []),
    review
  };
  const experimentId = `exp_${stableHash(entryWithoutId).slice(0, 16)}`;
  const entry: ExperimentLogEntry = {
    schemaVersion: "theorem.experiment.v0",
    experimentId,
    ...entryWithoutId,
    updatedAt: createdAt,
    validationBoundary: validationBoundaryFor({ kind, stage }),
    privacy: manifest.privacy,
    warnings: warningsFor(entryWithoutId)
  };

  const experimentsDir = resolve(status.root, manifest.directories.experiments);
  await mkdir(experimentsDir, { recursive: true });
  const path = join(experimentsDir, `${entry.createdAt.slice(0, 10)}-${entry.experimentId}.json`);
  await writeFile(path, `${JSON.stringify(entry, null, 2)}\n`, "utf8");

  return { entry, path };
}

export async function listExperimentLogEntries(rootPath: string): Promise<ExperimentLogEntry[]> {
  const status = await requireLocalWorkspace(rootPath);
  const experimentsDir = resolve(status.root, status.manifest.directories.experiments);

  let files: string[];
  try {
    files = await readdir(experimentsDir);
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
      .map(async (file) => JSON.parse(await readFile(join(experimentsDir, file), "utf8")) as ExperimentLogEntry)
  );

  return entries
    .filter((entry) => entry.schemaVersion === "theorem.experiment.v0")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Theorem workspace found. Run `theorem workspace init` before writing experiment logs.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function validationBoundaryFor(input: {
  kind: ExperimentKind;
  stage: ExperimentStage;
}): ExperimentLogEntry["validationBoundary"] {
  const completed = input.stage === "completed" || input.stage === "replicated";

  return {
    experimentalEvidence: completed,
    requiresReplication: input.stage !== "replicated",
    requiresExpertReview: true,
    notClinicalProof: input.kind !== "clinical" || input.stage !== "replicated",
    notRegulatoryApproval: true
  };
}

function warningsFor(input: {
  kind: ExperimentKind;
  stage: ExperimentStage;
  dataRefs: string[];
  analysisRefs: string[];
  observations: string[];
  limitations: string[];
  nextChecks: string[];
  review: ExperimentLogEntry["review"];
}): string[] {
  const warnings = [
    "Experiment records are provenance and review artifacts; they do not by themselves establish safety, efficacy, clinical validity, regulatory approval, or patentability.",
    "Do not generalize beyond the recorded protocol, data, assumptions, population, materials, and measurement limits."
  ];

  if (input.stage === "completed" || input.stage === "replicated") {
    if (input.dataRefs.length === 0) {
      warnings.push("Completed or replicated experiment has no data refs.");
    }

    if (input.analysisRefs.length === 0) {
      warnings.push("Completed or replicated experiment has no analysis refs.");
    }
  }

  if (input.review.ethicsReviewRequired && input.review.ethicsApprovalRefs.length === 0) {
    warnings.push("Ethics review appears required but no ethics approval refs were recorded.");
  }

  if (input.review.regulatoryReviewRequired && input.review.regulatoryReviewRefs.length === 0) {
    warnings.push("Regulatory or safety review may be required but no regulatory review refs were recorded.");
  }

  if (input.observations.length === 0) {
    warnings.push("No observations were recorded.");
  }

  if (input.limitations.length === 0) {
    warnings.push("No limitations were recorded.");
  }

  if (input.nextChecks.length === 0) {
    warnings.push("No next validation checks were recorded.");
  }

  return warnings;
}

function defaultOutcomeForStage(stage: ExperimentStage): ExperimentOutcome {
  if (stage === "planned" || stage === "protocol-drafted" || stage === "running") {
    return "not-run";
  }

  if (stage === "failed") {
    return "not-observed";
  }

  if (stage === "inconclusive") {
    return "inconclusive";
  }

  return "observed";
}

function isBiologicalOrMedicalKind(kind: ExperimentKind): boolean {
  return kind === "wet-lab" || kind === "preclinical" || kind === "clinical";
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

function normalizeMeasurements(values: ExperimentMeasurement[]): ExperimentMeasurement[] {
  return values.map((value) => ({
    name: requireText(value.name, "Experiment measurement name is required."),
    value: requireText(value.value, "Experiment measurement value is required."),
    unit: normalizeOptionalText(value.unit),
    note: normalizeOptionalText(value.note)
  }));
}

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";

export const INVENTION_VALIDATION_STAGES = [
  "idea",
  "computational-hypothesis",
  "simulated",
  "bench-tested",
  "experimentally-observed",
  "preclinical",
  "clinical",
  "regulatory-reviewed"
] as const;

export type InventionValidationStage = (typeof INVENTION_VALIDATION_STAGES)[number];

export interface InventionEvidenceRef {
  kind:
    | "receipt"
    | "artifact"
    | "source"
    | "literature"
    | "notebook"
    | "notebook-run"
    | "code-run"
    | "benchmark"
    | "disclosure"
    | "simulation"
    | "experiment"
    | "vault"
    | "review"
    | "validation"
    | "route"
    | "other";
  ref: string;
  trust?: TrustLabel;
  summary?: string;
}

export interface InventionLogEntry {
  schemaVersion: "theorem.invention.v0";
  entryId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  problem: string;
  hypothesis: string;
  validationStage: InventionValidationStage;
  evidenceRefs: InventionEvidenceRef[];
  noveltyNotes: string[];
  priorArtNotes: string[];
  risks: string[];
  nextChecks: string[];
  patent: {
    humanReviewRequired: true;
    legalConclusion: "not-a-legal-opinion";
    provisionalDraftReady: false;
    notes: string[];
  };
  safety: {
    validationRequired: string[];
    overclaimWarnings: string[];
  };
  privacy: PrivacyMetadata;
}

export interface CreateInventionLogInput {
  rootPath: string;
  title?: string;
  problem?: string;
  hypothesis: string;
  validationStage?: InventionValidationStage;
  evidenceRefs?: InventionEvidenceRef[];
  noveltyNotes?: string[];
  priorArtNotes?: string[];
  risks?: string[];
  nextChecks?: string[];
  now?: string;
}

export interface InventionLogWriteResult {
  entry: InventionLogEntry;
  path: string;
}

export function isInventionValidationStage(value: string): value is InventionValidationStage {
  return (INVENTION_VALIDATION_STAGES as readonly string[]).includes(value);
}

export async function createInventionLogEntry(input: CreateInventionLogInput): Promise<InventionLogWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const hypothesis = input.hypothesis.trim();
  if (!hypothesis) {
    throw new Error("Invention log hypothesis is required.");
  }

  const title = normalizeOptionalText(input.title) ?? titleFromHypothesis(input.hypothesis);
  const problem = normalizeOptionalText(input.problem) ?? "Unspecified problem.";
  const validationStage = input.validationStage ?? "computational-hypothesis";
  const evidenceRefs = input.evidenceRefs ?? [];

  const entryWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    title,
    problem,
    hypothesis,
    validationStage,
    evidenceRefs,
    noveltyNotes: input.noveltyNotes ?? [],
    priorArtNotes: input.priorArtNotes ?? [],
    risks: input.risks ?? [],
    nextChecks: input.nextChecks ?? [],
    privacy: manifest.privacy
  };
  const entryId = `inv_${stableHash(entryWithoutId).slice(0, 16)}`;
  const entry: InventionLogEntry = {
    schemaVersion: "theorem.invention.v0",
    entryId,
    ...entryWithoutId,
    updatedAt: createdAt,
    patent: {
      humanReviewRequired: true,
      legalConclusion: "not-a-legal-opinion",
      provisionalDraftReady: false,
      notes: patentNotesFor(validationStage)
    },
    safety: {
      validationRequired: validationRequiredFor(validationStage),
      overclaimWarnings: overclaimWarningsFor(validationStage)
    }
  };

  const inventionsDir = resolve(status.root, manifest.directories.inventions);
  await mkdir(inventionsDir, { recursive: true });
  const path = join(inventionsDir, `${entry.createdAt.slice(0, 10)}-${entry.entryId}.json`);
  await writeFile(path, `${JSON.stringify(entry, null, 2)}\n`, "utf8");

  return { entry, path };
}

export async function listInventionLogEntries(rootPath: string): Promise<InventionLogEntry[]> {
  const status = await requireLocalWorkspace(rootPath);
  const manifest = status.manifest;
  const inventionsDir = resolve(status.root, manifest.directories.inventions);

  let files: string[];
  try {
    files = await readdir(inventionsDir);
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
      .map(async (file) => JSON.parse(await readFile(join(inventionsDir, file), "utf8")) as InventionLogEntry)
  );

  return entries
    .filter((entry) => entry.schemaVersion === "theorem.invention.v0")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Theorem workspace found. Run `theorem workspace init` before writing invention logs.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function titleFromHypothesis(hypothesis: string): string {
  const normalized = hypothesis.trim().replace(/\s+/g, " ");
  if (normalized.length <= 72) {
    return normalized;
  }

  return `${normalized.slice(0, 69)}...`;
}

function patentNotesFor(stage: InventionValidationStage): string[] {
  return [
    "This entry is an invention log, not a patentability opinion.",
    "Use evidence receipts, prior-art notes, and human conception notes before drafting provisional materials.",
    stage === "idea" || stage === "computational-hypothesis"
      ? "The current validation stage is too early to claim reduction to practice without stronger evidence."
      : "Reduction-to-practice evidence still needs human legal review before filing."
  ];
}

function validationRequiredFor(stage: InventionValidationStage): string[] {
  const common = ["independent expert review", "replayable evidence receipts", "assumption and limitation review"];

  if (stage === "clinical" || stage === "regulatory-reviewed") {
    return common;
  }

  if (stage === "preclinical") {
    return [...common, "clinical validation before medical efficacy claims"];
  }

  if (stage === "experimentally-observed") {
    return [...common, "replication", "preclinical or domain-specific validation"];
  }

  if (stage === "bench-tested") {
    return [...common, "independent bench replication", "safety review if biological or medical"];
  }

  return [
    ...common,
    "simulation or benchmark reproduction",
    "wet-lab or real-world validation if biological, medical, physical, or safety-critical"
  ];
}

function overclaimWarningsFor(stage: InventionValidationStage): string[] {
  if (stage === "clinical" || stage === "regulatory-reviewed") {
    return ["Do not generalize beyond the studied population, protocol, or approval scope."];
  }

  return [
    "Do not describe this as a proven discovery yet.",
    "Do not claim clinical, medical, safety, or regulatory validity from computational evidence alone.",
    `Current stage is ${stage}; stronger validation is required before public breakthrough claims.`
  ];
}

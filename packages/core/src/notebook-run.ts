import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { validateJsonSchema } from "./json-schema-validation.js";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export const NOTEBOOK_RUN_KINDS = ["notebook", "script", "pipeline", "test", "analysis", "simulation", "other"] as const;
export const NOTEBOOK_RUN_STATUSES = ["planned", "completed", "failed", "reproduced", "superseded"] as const;
const NOTEBOOK_RUN_SCHEMA_VERSION = "truth-harness.notebook-run.v0" as const;
const SCHEMAS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");
let notebookRunSchemaCache: Promise<unknown> | undefined;

export type NotebookRunKind = (typeof NOTEBOOK_RUN_KINDS)[number];
export type NotebookRunStatus = (typeof NOTEBOOK_RUN_STATUSES)[number];

export interface NotebookRunValue {
  name: string;
  value: string;
  unit?: string;
  note?: string;
}

export interface NotebookRunRecord {
  schemaVersion: typeof NOTEBOOK_RUN_SCHEMA_VERSION;
  runRecordId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  purpose: string;
  kind: NotebookRunKind;
  status: NotebookRunStatus;
  runner?: string;
  runnerVersion?: string;
  command?: string;
  workingDirectory?: string;
  notebookRefs: string[];
  codeRefs: string[];
  inputRefs: string[];
  outputRefs: string[];
  environment: {
    runtime?: string;
    runtimeVersion?: string;
    operatingSystem?: string;
    dependencies: string[];
    variables: NotebookRunValue[];
  };
  parameters: NotebookRunValue[];
  metrics: NotebookRunValue[];
  observations: string[];
  limitations: string[];
  nextChecks: string[];
  replay: {
    command?: string;
    deterministic: boolean;
    requiresManualReplay: boolean;
    notes: string[];
  };
  reproducibilityBoundary: {
    recordOnly: true;
    executionNotPerformedByWorkbench: true;
    outputsNotVerifiedByWorkbench: true;
    notebookRunIsNotTruth: true;
    requiresWorkspaceSnapshot: boolean;
    requiresIndependentReplay: boolean;
    requiresExpertReview: boolean;
    requiredNextChecks: string[];
  };
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface CreateNotebookRunInput {
  rootPath: string;
  title?: string;
  purpose: string;
  kind?: NotebookRunKind;
  status?: NotebookRunStatus;
  runner?: string;
  runnerVersion?: string;
  command?: string;
  workingDirectory?: string;
  notebookRefs?: string[];
  codeRefs?: string[];
  inputRefs?: string[];
  outputRefs?: string[];
  runtime?: string;
  runtimeVersion?: string;
  operatingSystem?: string;
  dependencies?: string[];
  environmentVariables?: NotebookRunValue[];
  parameters?: NotebookRunValue[];
  metrics?: NotebookRunValue[];
  observations?: string[];
  limitations?: string[];
  nextChecks?: string[];
  deterministic?: boolean;
  replayNotes?: string[];
  now?: string;
}

export interface NotebookRunWriteResult {
  record: NotebookRunRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export function isNotebookRunKind(value: string): value is NotebookRunKind {
  return (NOTEBOOK_RUN_KINDS as readonly string[]).includes(value);
}

export function isNotebookRunStatus(value: string): value is NotebookRunStatus {
  return (NOTEBOOK_RUN_STATUSES as readonly string[]).includes(value);
}

export async function createNotebookRun(input: CreateNotebookRunInput): Promise<NotebookRunRecord> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const purpose = requireText(input.purpose, "Notebook run purpose is required.");
  const kind = input.kind ?? "notebook";
  const runStatus = input.status ?? "completed";
  const nextChecks = normalizeStringList(input.nextChecks ?? []);
  const recordWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromPurpose(purpose),
    purpose,
    kind,
    status: runStatus,
    runner: normalizeOptionalText(input.runner),
    runnerVersion: normalizeOptionalText(input.runnerVersion),
    command: normalizeOptionalText(input.command),
    workingDirectory: normalizeOptionalText(input.workingDirectory),
    notebookRefs: normalizeStringList(input.notebookRefs ?? []),
    codeRefs: normalizeStringList(input.codeRefs ?? []),
    inputRefs: normalizeStringList(input.inputRefs ?? []),
    outputRefs: normalizeStringList(input.outputRefs ?? []),
    environment: {
      runtime: normalizeOptionalText(input.runtime),
      runtimeVersion: normalizeOptionalText(input.runtimeVersion),
      operatingSystem: normalizeOptionalText(input.operatingSystem),
      dependencies: normalizeStringList(input.dependencies ?? []),
      variables: normalizeValues(input.environmentVariables ?? [], "Notebook environment variable")
    },
    parameters: normalizeValues(input.parameters ?? [], "Notebook parameter"),
    metrics: normalizeValues(input.metrics ?? [], "Notebook metric"),
    observations: normalizeStringList(input.observations ?? []),
    limitations: normalizeStringList(input.limitations ?? []),
    nextChecks
  };
  const runRecordId = `nb_${stableHash(recordWithoutId).slice(0, 16)}`;
  const replay = {
    command: recordWithoutId.command,
    deterministic: input.deterministic ?? false,
    requiresManualReplay: true,
    notes: normalizeStringList(input.replayNotes ?? replayNotesFor(recordWithoutId.command))
  };
  const reproducibilityBoundary = reproducibilityBoundaryFor({
    purpose,
    status: runStatus,
    command: recordWithoutId.command,
    outputRefs: recordWithoutId.outputRefs,
    nextChecks
  });
  const record: NotebookRunRecord = {
    schemaVersion: NOTEBOOK_RUN_SCHEMA_VERSION,
    runRecordId,
    ...recordWithoutId,
    updatedAt: createdAt,
    replay,
    reproducibilityBoundary,
    privacy: manifest.privacy,
    warnings: warningsFor({
      kind,
      status: runStatus,
      command: recordWithoutId.command,
      notebookRefs: recordWithoutId.notebookRefs,
      codeRefs: recordWithoutId.codeRefs,
      outputRefs: recordWithoutId.outputRefs,
      environment: recordWithoutId.environment,
      limitations: recordWithoutId.limitations,
      nextChecks,
      reproducibilityBoundary
    })
  };

  return record;
}

export async function writeNotebookRun(input: CreateNotebookRunInput): Promise<NotebookRunWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const record = await createNotebookRun(input);
  await assertNotebookRunSchema(record);
  const runsDir = resolve(status.root, status.manifest.directories["notebook-runs"]);
  const baseName = `${record.createdAt.slice(0, 10)}-${record.runRecordId}`;
  const jsonPath = join(runsDir, `${baseName}.json`);
  const markdownPath = join(runsDir, `${baseName}.md`);
  const markdown = renderNotebookRunMarkdown(record);
  await mkdir(runsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "notebook-runs",
    now: record.createdAt,
    staleReason: "notebook run record written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

async function assertNotebookRunSchema(record: NotebookRunRecord): Promise<void> {
  const schema = await loadNotebookRunSchema();
  const serializedRecord = parseJsonWithOptionalBom(JSON.stringify(record));
  const issues = validateJsonSchema(serializedRecord, schema);
  if (issues.length === 0) {
    return;
  }

  throw new Error(
    `Notebook run record failed JSON Schema validation before write: ${issues
      .map((issue) => `${issue.path} ${issue.message}`)
      .join("; ")}`
  );
}

function loadNotebookRunSchema(): Promise<unknown> {
  notebookRunSchemaCache ??= readFile(resolve(SCHEMAS_DIR, "notebook-run.schema.json"), "utf8").then((raw) =>
    parseJsonWithOptionalBom(raw)
  );
  return notebookRunSchemaCache;
}

export async function listNotebookRuns(rootPath: string): Promise<NotebookRunRecord[]> {
  const status = await requireLocalWorkspace(rootPath);
  const runsDir = resolve(status.root, status.manifest.directories["notebook-runs"]);

  let files: string[];
  try {
    files = await readdir(runsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const records = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => parseJsonWithOptionalBom(await readFile(join(runsDir, file), "utf8")) as NotebookRunRecord)
  );

  return records
    .filter((record) => record.schemaVersion === NOTEBOOK_RUN_SCHEMA_VERSION)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function renderNotebookRunMarkdown(record: NotebookRunRecord): string {
  const lines = [
    `# ${record.title}`,
    "",
    `Run record: \`${record.runRecordId}\``,
    `Kind/status: \`${record.kind}\` / \`${record.status}\``,
    `Created: ${record.createdAt}`,
    `Privacy: ${record.privacy.mode} (network: ${record.privacy.networkAccess})`,
    "",
    record.purpose
  ];

  if (record.runner || record.command) {
    lines.push("", "## Runner", "");
    if (record.runner) lines.push(`- Runner: ${record.runner}`);
    if (record.runnerVersion) lines.push(`- Version: ${record.runnerVersion}`);
    if (record.command) lines.push(`- Command: \`${record.command}\``);
    if (record.workingDirectory) lines.push(`- Working directory: \`${record.workingDirectory}\``);
  }

  pushOptionalSection(lines, "Notebook Refs", record.notebookRefs);
  pushOptionalSection(lines, "Code Refs", record.codeRefs);
  pushOptionalSection(lines, "Input Refs", record.inputRefs);
  pushOptionalSection(lines, "Output Refs", record.outputRefs);
  pushOptionalValues(lines, "Parameters", record.parameters);
  pushOptionalValues(lines, "Metrics", record.metrics);
  pushOptionalSection(lines, "Observations", record.observations);
  pushOptionalSection(lines, "Limitations", record.limitations);
  pushOptionalSection(lines, "Next Checks", record.reproducibilityBoundary.requiredNextChecks);

  lines.push("", "## Reproducibility", "");
  lines.push(`- Deterministic: ${String(record.replay.deterministic)}`);
  lines.push(`- Manual replay required: ${String(record.replay.requiresManualReplay)}`);
  lines.push(`- Workbench executed this run: ${String(!record.reproducibilityBoundary.executionNotPerformedByWorkbench)}`);
  for (const note of record.replay.notes) {
    lines.push(`- ${note}`);
  }

  if (record.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of record.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "This notebook run record captures provenance and replay instructions. It does not prove code correctness, scientific validity, safety, regulatory approval, or patentability."
  );

  return `${lines.join("\n")}\n`;
}

function reproducibilityBoundaryFor(input: {
  purpose: string;
  status: NotebookRunStatus;
  command?: string;
  outputRefs: string[];
  nextChecks: string[];
}): NotebookRunRecord["reproducibilityBoundary"] {
  const sensitive = /\b(cancer|clinical|patient|drug|therapy|hair[- ]?loss|safety|toxicity|patent|novel|climate|materials?)\b/i.test(
    input.purpose
  );
  const requiredNextChecks = input.nextChecks.length > 0 ? input.nextChecks : defaultNextChecks(input);

  return {
    recordOnly: true,
    executionNotPerformedByWorkbench: true,
    outputsNotVerifiedByWorkbench: true,
    notebookRunIsNotTruth: true,
    requiresWorkspaceSnapshot: true,
    requiresIndependentReplay: input.status !== "reproduced",
    requiresExpertReview: sensitive,
    requiredNextChecks
  };
}

function defaultNextChecks(input: { status: NotebookRunStatus; command?: string; outputRefs: string[] }): string[] {
  const checks = ["capture a workspace snapshot after the run", "replay the command or notebook in a clean local environment"];

  if (!input.command) {
    checks.push("record the exact replay command or notebook execution steps");
  }

  if (input.outputRefs.length === 0) {
    checks.push("attach output artifact refs produced by the run");
  }

  if (input.status !== "reproduced") {
    checks.push("record independent reproduction before treating outputs as stable evidence");
  }

  return checks;
}

function replayNotesFor(command: string | undefined): string[] {
  if (!command) {
    return ["No replay command was recorded; this run is not directly replayable yet."];
  }

  return ["Replay command is recorded for human or agent execution; Truth Harness has not executed it."];
}

function warningsFor(input: {
  kind: NotebookRunKind;
  status: NotebookRunStatus;
  command?: string;
  notebookRefs: string[];
  codeRefs: string[];
  outputRefs: string[];
  environment: NotebookRunRecord["environment"];
  limitations: string[];
  nextChecks: string[];
  reproducibilityBoundary: NotebookRunRecord["reproducibilityBoundary"];
}): string[] {
  const warnings = [
    "Notebook run records are provenance artifacts; they do not prove code correctness, scientific validity, safety, regulatory approval, or patentability.",
    "Truth Harness did not execute this run; replay and output verification remain required."
  ];

  if (input.status === "failed") {
    warnings.push("This run is marked failed; do not use it as positive evidence without a later successful run.");
  }

  if (!input.command) {
    warnings.push("No replay command was recorded.");
  }

  if (input.notebookRefs.length === 0 && input.codeRefs.length === 0) {
    warnings.push("No notebook or code refs were attached.");
  }

  if (input.outputRefs.length === 0) {
    warnings.push("No output artifact refs were attached.");
  }

  if (!input.environment.runtime && input.environment.dependencies.length === 0) {
    warnings.push("No runtime or dependency metadata was recorded.");
  }

  if (input.limitations.length === 0) {
    warnings.push("No run limitations were recorded.");
  }

  if (input.nextChecks.length === 0) {
    warnings.push("No next reproducibility checks were recorded.");
  }

  if (input.reproducibilityBoundary.requiresExpertReview) {
    warnings.push("Domain expert review is required before strong biomedical, safety, patent, climate, materials, or scientific conclusions.");
  }

  if (input.kind === "pipeline") {
    warnings.push("Pipeline records should include all critical upstream inputs and downstream outputs before being used for discovery claims.");
  }

  return warnings;
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing notebook run records.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function pushOptionalSection(lines: string[], title: string, values: string[]): void {
  if (values.length === 0) return;

  lines.push("", `## ${title}`, "");
  for (const value of values) {
    lines.push(`- ${value}`);
  }
}

function pushOptionalValues(lines: string[], title: string, values: NotebookRunValue[]): void {
  if (values.length === 0) return;

  lines.push("", `## ${title}`, "");
  for (const value of values) {
    const unit = value.unit ? ` ${value.unit}` : "";
    const note = value.note ? ` (${value.note})` : "";
    lines.push(`- ${value.name}=${value.value}${unit}${note}`);
  }
}

function requireText(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function titleFromPurpose(purpose: string): string {
  return purpose.length <= 72 ? purpose : `${purpose.slice(0, 69)}...`;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value)))];
}

function normalizeValues(values: NotebookRunValue[], label: string): NotebookRunValue[] {
  return values.map((value) => ({
    name: requireText(value.name, `${label} name is required.`),
    value: requireText(value.value, `${label} value is required.`),
    unit: normalizeOptionalText(value.unit),
    note: normalizeOptionalText(value.note)
  }));
}

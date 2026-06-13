import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";

export const RESEARCH_SESSION_DOMAINS = [
  "math",
  "physics",
  "code",
  "biomedical",
  "materials",
  "energy",
  "climate",
  "patent",
  "learning",
  "general"
] as const;

export const RESEARCH_TASK_STATUSES = ["todo", "doing", "blocked", "done"] as const;
const RESEARCH_SESSION_SCHEMA_VERSION = "truth-harness.research-session.v0" as const;

export type ResearchSessionDomain = (typeof RESEARCH_SESSION_DOMAINS)[number];
export type ResearchTaskStatus = (typeof RESEARCH_TASK_STATUSES)[number];

export interface ResearchEvidenceRef {
  kind:
    | "receipt"
    | "artifact"
    | "source"
    | "literature"
    | "notebook"
    | "notebook-run"
    | "code-run"
    | "benchmark"
    | "cas"
    | "disclosure"
    | "simulation"
    | "experiment"
    | "vault"
    | "audit"
    | "snapshot"
    | "workspace-review"
    | "review"
    | "validation"
    | "model-context"
    | "route"
    | "invention"
    | "claim-chart"
    | "discovery-package"
    | "other";
  ref: string;
  trust?: TrustLabel;
  summary?: string;
}

export interface ResearchSessionTask {
  taskId: string;
  title: string;
  status: ResearchTaskStatus;
  evidenceRefs: ResearchEvidenceRef[];
  nextChecks: string[];
}

export interface ResearchSessionCheckpoint {
  checkpointId: string;
  createdAt: string;
  summary: string;
  evidenceRefs: ResearchEvidenceRef[];
  snapshotRefs: string[];
  decisions: string[];
  nextChecks: string[];
}

export interface ResearchSession {
  schemaVersion: "truth-harness.research-session.v0";
  sessionId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  objective: string;
  domains: ResearchSessionDomain[];
  hypotheses: string[];
  claims: string[];
  evidenceRefs: ResearchEvidenceRef[];
  snapshotRefs: string[];
  tasks: ResearchSessionTask[];
  checkpoints: ResearchSessionCheckpoint[];
  budgets: {
    maxDepth: number;
    maxBranches: number;
    maxToolCalls: number;
    maxWallMinutes: number;
    maxUnverifiedFinalClaims: number;
  };
  modelPolicy: {
    localFirst: true;
    hostedModels: "optional-with-disclosure";
    disclosureRequired: true;
    selectedContextOnly: true;
  };
  reviewBoundary: {
    expertReviewRequired: boolean;
    wetLabValidationRequired: boolean;
    preclinicalOrClinicalValidationRequired: boolean;
    regulatoryReviewRequired: boolean;
    patentAttorneyReviewRequired: boolean;
    reasons: string[];
  };
  privacy: PrivacyMetadata;
  warnings: string[];
  markdown: string;
}

export interface CreateResearchSessionInput {
  rootPath: string;
  title?: string;
  objective: string;
  domains?: ResearchSessionDomain[];
  hypotheses?: string[];
  claims?: string[];
  evidenceRefs?: ResearchEvidenceRef[];
  snapshotRefs?: string[];
  tasks?: string[];
  maxDepth?: number;
  maxBranches?: number;
  maxToolCalls?: number;
  maxWallMinutes?: number;
  now?: string;
}

export interface ResearchSessionWriteResult {
  session: ResearchSession;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface ResearchSessionCheckpointInput {
  rootPath: string;
  sessionRef: string;
  summary: string;
  evidenceRefs?: ResearchEvidenceRef[];
  snapshotRefs?: string[];
  decisions?: string[];
  nextChecks?: string[];
  now?: string;
}

export interface ResearchSessionCheckpointWriteResult {
  session: ResearchSession;
  checkpoint: ResearchSessionCheckpoint;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface ResearchSessionTaskUpdateInput {
  rootPath: string;
  sessionRef: string;
  taskRef: string;
  status?: ResearchTaskStatus;
  evidenceRefs?: ResearchEvidenceRef[];
  nextChecks?: string[];
  now?: string;
}

export interface ResearchSessionTaskUpdateWriteResult {
  session: ResearchSession;
  task: ResearchSessionTask;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export function isResearchSessionDomain(value: string): value is ResearchSessionDomain {
  return (RESEARCH_SESSION_DOMAINS as readonly string[]).includes(value);
}

export function isResearchTaskStatus(value: string): value is ResearchTaskStatus {
  return (RESEARCH_TASK_STATUSES as readonly string[]).includes(value);
}

export async function createResearchSession(input: CreateResearchSessionInput): Promise<ResearchSession> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const objective = requireText(input.objective, "Research session objective is required.");
  const domains = normalizeDomains(input.domains, objective);
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs ?? []);
  const snapshotRefs = normalizeStringList(input.snapshotRefs ?? []);
  const tasks = normalizeStringList(input.tasks ?? []).map((title) => createTask(title, createdAt));
  const sessionWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromObjective(objective),
    objective,
    domains,
    hypotheses: normalizeStringList(input.hypotheses ?? []),
    claims: normalizeStringList(input.claims ?? []),
    evidenceRefs,
    snapshotRefs,
    tasks,
    checkpoints: [] as ResearchSessionCheckpoint[],
    budgets: normalizeBudgets(input),
    modelPolicy: modelPolicy(),
    reviewBoundary: reviewBoundaryFor(domains, objective),
    privacy: manifest.privacy
  };
  const sessionId = `session_${stableHash(sessionWithoutId).slice(0, 16)}`;
  const session: Omit<ResearchSession, "markdown"> = {
    schemaVersion: RESEARCH_SESSION_SCHEMA_VERSION,
    sessionId,
    ...sessionWithoutId,
    updatedAt: createdAt,
    warnings: warningsFor(domains, objective)
  };

  return {
    ...session,
    markdown: renderResearchSessionMarkdown(session)
  };
}

export async function writeResearchSession(input: CreateResearchSessionInput): Promise<ResearchSessionWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const session = await createResearchSession(input);
  return writeSessionFiles(status.root, status.manifest.directories.sessions, session);
}

export async function addResearchSessionCheckpoint(
  input: ResearchSessionCheckpointInput
): Promise<ResearchSessionCheckpointWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const { session, path } = await readResearchSessionRef(status, input.sessionRef);
  const createdAt = input.now ?? new Date().toISOString();
  const summary = requireText(input.summary, "Research checkpoint summary is required.");
  const checkpointWithoutId = {
    sessionId: session.sessionId,
    createdAt,
    summary,
    evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs ?? []),
    snapshotRefs: normalizeStringList(input.snapshotRefs ?? []),
    decisions: normalizeStringList(input.decisions ?? []),
    nextChecks: normalizeStringList(input.nextChecks ?? [])
  };
  const checkpoint: ResearchSessionCheckpoint = {
    checkpointId: `chk_${stableHash(checkpointWithoutId).slice(0, 16)}`,
    createdAt,
    summary,
    evidenceRefs: checkpointWithoutId.evidenceRefs,
    snapshotRefs: checkpointWithoutId.snapshotRefs,
    decisions: checkpointWithoutId.decisions,
    nextChecks: checkpointWithoutId.nextChecks
  };
  const updated: ResearchSession = {
    ...session,
    updatedAt: createdAt,
    evidenceRefs: mergeEvidenceRefs(session.evidenceRefs, checkpoint.evidenceRefs),
    snapshotRefs: mergeStrings(session.snapshotRefs, checkpoint.snapshotRefs),
    checkpoints: [...session.checkpoints, checkpoint]
  };
  const sessionWithMarkdown: ResearchSession = {
    ...updated,
    markdown: renderResearchSessionMarkdown(updated)
  };
  const markdownPath = path.replace(/\.json$/u, ".md");

  await writeFile(path, `${JSON.stringify(sessionWithMarkdown, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, sessionWithMarkdown.markdown, "utf8");

  return {
    session: sessionWithMarkdown,
    checkpoint,
    jsonPath: path,
    markdownPath,
    markdown: sessionWithMarkdown.markdown
  };
}

export async function updateResearchSessionTask(
  input: ResearchSessionTaskUpdateInput
): Promise<ResearchSessionTaskUpdateWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const { session, path } = await readResearchSessionRef(status, input.sessionRef);
  const taskRef = requireText(input.taskRef, "Research session task ref is required.");
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs ?? []);
  const nextChecks = normalizeStringList(input.nextChecks ?? []);
  const updatedAt = input.now ?? new Date().toISOString();
  let updatedTask: ResearchSessionTask | undefined;

  const tasks = session.tasks.map((task) => {
    if (!taskMatchesRef(task, taskRef)) {
      return task;
    }

    updatedTask = {
      ...task,
      status: input.status ?? task.status,
      evidenceRefs: mergeEvidenceRefs(task.evidenceRefs, evidenceRefs),
      nextChecks: mergeStrings(task.nextChecks, nextChecks)
    };
    return updatedTask;
  });

  if (!updatedTask) {
    throw new Error(`Research session task not found: ${taskRef}`);
  }
  if (updatedTask.status === "done" && updatedTask.evidenceRefs.length === 0) {
    throw new Error("Research session tasks require at least one evidence ref before they can be marked done.");
  }
  if (updatedTask.status === "blocked" && updatedTask.nextChecks.length === 0) {
    throw new Error("Blocked research session tasks require at least one next check.");
  }

  const updated: ResearchSession = {
    ...session,
    updatedAt,
    evidenceRefs: mergeEvidenceRefs(session.evidenceRefs, evidenceRefs),
    tasks
  };
  const sessionWithMarkdown: ResearchSession = {
    ...updated,
    markdown: renderResearchSessionMarkdown(updated)
  };
  const markdownPath = path.replace(/\.json$/u, ".md");

  await writeFile(path, `${JSON.stringify(sessionWithMarkdown, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, sessionWithMarkdown.markdown, "utf8");

  return {
    session: sessionWithMarkdown,
    task: updatedTask,
    jsonPath: path,
    markdownPath,
    markdown: sessionWithMarkdown.markdown
  };
}

export async function listResearchSessions(rootPath: string): Promise<ResearchSession[]> {
  const status = await requireLocalWorkspace(rootPath);
  const sessionsDir = resolve(status.root, status.manifest.directories.sessions);

  let files: string[];
  try {
    files = await readdir(sessionsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const sessions = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => tryParseResearchSessionJson(await readFile(join(sessionsDir, file), "utf8")))
  );

  return sessions
    .filter((session): session is ResearchSession => session !== undefined)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function readResearchSession(rootPath: string, sessionRef: string): Promise<ResearchSession> {
  const status = await requireLocalWorkspace(rootPath);
  return (await readResearchSessionRef(status, sessionRef)).session;
}

export function parseResearchSessionJson(raw: string): ResearchSession {
  const session = JSON.parse(raw) as ResearchSession;
  if (session.schemaVersion !== RESEARCH_SESSION_SCHEMA_VERSION) {
    throw new Error(`Unsupported research session schema: ${JSON.stringify(session.schemaVersion)}`);
  }
  if (!isResearchSessionId(session.sessionId)) {
    throw new Error(`Invalid research session id: ${JSON.stringify(session.sessionId)}`);
  }

  return session;
}

export function renderResearchSessionMarkdown(session: Omit<ResearchSession, "markdown">): string {
  const lines: string[] = [
    `# Research Session: ${escapeMarkdownText(session.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Session | \`${session.sessionId}\` |`,
    `| Created | ${escapeMarkdownTable(session.createdAt)} |`,
    `| Updated | ${escapeMarkdownTable(session.updatedAt)} |`,
    `| Domains | ${session.domains.map((domain) => `\`${domain}\``).join(", ")} |`,
    `| Privacy | \`${session.privacy.mode}\` / network \`${session.privacy.networkAccess}\` |`,
    `| Hosted models | \`${session.modelPolicy.hostedModels}\` |`,
    "",
    "## Objective",
    "",
    escapeMarkdownText(session.objective),
    "",
    "## Budgets",
    "",
    "| Budget | Value |",
    "| --- | ---: |",
    `| Max depth | ${session.budgets.maxDepth} |`,
    `| Max branches | ${session.budgets.maxBranches} |`,
    `| Max tool calls | ${session.budgets.maxToolCalls} |`,
    `| Max wall minutes | ${session.budgets.maxWallMinutes} |`,
    `| Max unverified final claims | ${session.budgets.maxUnverifiedFinalClaims} |`,
    "",
    "## Evidence",
    "",
    "| Kind | Trust | Reference | Summary |",
    "| --- | --- | --- | --- |"
  ];

  if (session.evidenceRefs.length === 0) {
    lines.push("|  |  |  | No evidence refs attached yet. |");
  } else {
    for (const ref of session.evidenceRefs) {
      lines.push(
        [
          `\`${ref.kind}\``,
          ref.trust ? `\`${ref.trust}\`` : "",
          escapeMarkdownTable(ref.ref),
          escapeMarkdownTable(ref.summary ?? "")
        ]
          .join(" | ")
          .replace(/^/, "| ")
          .replace(/$/, " |")
      );
    }
  }

  lines.push("", "## Tasks", "", "| Status | Task | Evidence | Next Checks |", "| --- | --- | --- | --- |");
  if (session.tasks.length === 0) {
    lines.push("| `todo` | Define first concrete subclaim or evidence task. |  |  |");
  } else {
    for (const task of session.tasks) {
      lines.push(
        `| \`${task.status}\` | ${escapeMarkdownTable(task.title)} | ${escapeMarkdownTable(formatEvidenceRefs(task.evidenceRefs))} | ${escapeMarkdownTable(task.nextChecks.join("; "))} |`
      );
    }
  }

  if (session.hypotheses.length > 0) {
    lines.push("", "## Hypotheses", "");
    for (const hypothesis of session.hypotheses) {
      lines.push(`- ${escapeMarkdownText(hypothesis)}`);
    }
  }

  if (session.claims.length > 0) {
    lines.push("", "## Claims To Verify", "");
    for (const claim of session.claims) {
      lines.push(`- ${escapeMarkdownText(claim)}`);
    }
  }

  if (session.snapshotRefs.length > 0) {
    lines.push("", "## Snapshot Refs", "");
    for (const snapshotRef of session.snapshotRefs) {
      lines.push(`- \`${escapeMarkdownText(snapshotRef)}\``);
    }
  }

  if (session.checkpoints.length > 0) {
    lines.push("", "## Checkpoints", "");
    for (const checkpoint of session.checkpoints) {
      lines.push(`### ${checkpoint.checkpointId}`, "", escapeMarkdownText(checkpoint.summary), "");
      if (checkpoint.decisions.length > 0) {
        lines.push("Decisions:");
        for (const decision of checkpoint.decisions) {
          lines.push(`- ${escapeMarkdownText(decision)}`);
        }
        lines.push("");
      }
      if (checkpoint.nextChecks.length > 0) {
        lines.push("Next checks:");
        for (const check of checkpoint.nextChecks) {
          lines.push(`- ${escapeMarkdownText(check)}`);
        }
        lines.push("");
      }
    }
  }

  lines.push("", "## Review Boundary", "");
  for (const reason of session.reviewBoundary.reasons) {
    lines.push(`- ${escapeMarkdownText(reason)}`);
  }

  if (session.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of session.warnings) {
      lines.push(`- ${escapeMarkdownText(warning)}`);
    }
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "This research session is a local runbook. It is not proof, medical advice, regulatory approval, or legal advice."
  );

  return `${lines.join("\n")}\n`;
}

async function writeSessionFiles(
  root: string,
  sessionsDirectory: string,
  session: ResearchSession
): Promise<ResearchSessionWriteResult> {
  const sessionsDir = resolve(root, sessionsDirectory);
  await mkdir(sessionsDir, { recursive: true });
  const baseName = `${session.createdAt.slice(0, 10)}-${session.sessionId}`;
  const jsonPath = join(sessionsDir, `${baseName}.json`);
  const markdownPath = join(sessionsDir, `${baseName}.md`);

  await writeFile(jsonPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, session.markdown, "utf8");

  return {
    session,
    jsonPath,
    markdownPath,
    markdown: session.markdown
  };
}

async function readResearchSessionRef(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  sessionRef: string
): Promise<{ session: ResearchSession; path: string }> {
  const ref = requireText(sessionRef, "Research session ref is required.");

  if (isResearchSessionId(ref)) {
    const sessionsDir = resolve(status.root, status.manifest.directories.sessions);
    const files = await readdir(sessionsDir);
    for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
      const path = join(sessionsDir, file);
      const session = tryParseResearchSessionJson(await readFile(path, "utf8"));
      if (session?.sessionId === ref) {
        return { session, path };
      }
    }

    throw new Error(`Research session not found: ${ref}`);
  }

  const path = resolveUnderRoot(status.root, ref);
  return {
    session: parseResearchSessionJson(await readFile(path, "utf8")),
    path
  };
}

function tryParseResearchSessionJson(raw: string): ResearchSession | undefined {
  try {
    return parseResearchSessionJson(raw);
  } catch {
    return undefined;
  }
}

function normalizeDomains(values: ResearchSessionDomain[] | undefined, objective: string): ResearchSessionDomain[] {
  const domains = new Set<ResearchSessionDomain>();
  for (const value of values ?? []) {
    domains.add(value);
  }

  const normalized = objective.toLowerCase();
  if (/\b(proof|lemma|equation|integral|matrix|number theory|math)\b/i.test(normalized)) {
    domains.add("math");
  }
  if (/\b(physics|energy|force|quantum|molecular|simulation|climate)\b/i.test(normalized)) {
    domains.add("physics");
  }
  if (/\b(code|program|compiler|test|software|api)\b/i.test(normalized)) {
    domains.add("code");
  }
  if (/\b(cancer|hair loss|disease|drug|therapy|protein|clinical|preclinical|biomedical)\b/i.test(normalized)) {
    domains.add("biomedical");
  }
  if (/\b(material|battery|catalyst|polymer|semiconductor)\b/i.test(normalized)) {
    domains.add("materials");
  }
  if (/\b(patent|invention|prior art|claim chart|novelty)\b/i.test(normalized)) {
    domains.add("patent");
  }
  if (domains.size === 0) {
    domains.add("general");
  }

  return [...domains].sort();
}

function createTask(title: string, createdAt: string): ResearchSessionTask {
  const normalizedTitle = requireText(title, "Research task title is required.");
  return {
    taskId: `task_${stableHash({ title: normalizedTitle, createdAt }).slice(0, 16)}`,
    title: normalizedTitle,
    status: "todo",
    evidenceRefs: [],
    nextChecks: []
  };
}

function taskMatchesRef(task: ResearchSessionTask, taskRef: string): boolean {
  return task.taskId === taskRef || task.title === taskRef;
}

function normalizeBudgets(input: CreateResearchSessionInput): ResearchSession["budgets"] {
  return {
    maxDepth: normalizePositiveInteger(input.maxDepth, 4),
    maxBranches: normalizePositiveInteger(input.maxBranches, 5),
    maxToolCalls: normalizePositiveInteger(input.maxToolCalls, 100),
    maxWallMinutes: normalizePositiveInteger(input.maxWallMinutes, 60),
    maxUnverifiedFinalClaims: 0
  };
}

function modelPolicy(): ResearchSession["modelPolicy"] {
  return {
    localFirst: true,
    hostedModels: "optional-with-disclosure",
    disclosureRequired: true,
    selectedContextOnly: true
  };
}

function reviewBoundaryFor(domains: ResearchSessionDomain[], objective: string): ResearchSession["reviewBoundary"] {
  const domainSet = new Set(domains);
  const normalized = objective.toLowerCase();
  const biomedical = domainSet.has("biomedical");
  const patent = domainSet.has("patent");
  const safety = biomedical || /\b(safety|clinical|patient|therapy|drug|cancer|disease)\b/i.test(normalized);
  const reasons = [
    "AI outputs and local computations need evidence receipts before being treated as claims.",
    "Simulation evidence is computational evidence, not reality."
  ];

  if (safety) {
    reasons.push("Biomedical or safety-sensitive work requires expert review and may require wet-lab, preclinical, clinical, ethics, and regulatory validation.");
  }
  if (patent) {
    reasons.push("Patent or invention work requires prior-art review and human patent-attorney review before filing decisions.");
  }

  return {
    expertReviewRequired: true,
    wetLabValidationRequired: biomedical,
    preclinicalOrClinicalValidationRequired: biomedical,
    regulatoryReviewRequired: safety,
    patentAttorneyReviewRequired: patent,
    reasons
  };
}

function warningsFor(domains: ResearchSessionDomain[], objective: string): string[] {
  const warnings = [
    "Keep project data local by default; log selected-context disclosures before using hosted models or external services.",
    "Every final claim needs proof, refutation, replay, benchmark, source, simulation, experiment, or an explicit unverified label.",
    "Research sessions organize evidence; they do not prove claims by themselves."
  ];
  const normalized = objective.toLowerCase();
  if (domains.includes("biomedical") || /\b(cancer|hair loss|drug|therapy|clinical|disease)\b/i.test(normalized)) {
    warnings.push("Do not describe biomedical hypotheses as cures, safe, effective, or clinically validated without appropriate expert and real-world validation.");
  }
  if (domains.includes("patent")) {
    warnings.push("Do not treat generated claim language as a patentability, novelty, non-obviousness, inventorship, or freedom-to-operate conclusion.");
  }

  return warnings;
}

function normalizeEvidenceRefs(values: ResearchEvidenceRef[]): ResearchEvidenceRef[] {
  return values.map((value) => ({
    kind: value.kind,
    ref: requireText(value.ref, "Evidence ref is required."),
    trust: value.trust,
    summary: normalizeOptionalText(value.summary)
  }));
}

function mergeEvidenceRefs(left: ResearchEvidenceRef[], right: ResearchEvidenceRef[]): ResearchEvidenceRef[] {
  const byKey = new Map<string, ResearchEvidenceRef>();
  for (const ref of [...left, ...right]) {
    byKey.set(`${ref.kind}:${ref.ref}`, ref);
  }

  return [...byKey.values()];
}

function mergeStrings(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])];
}

function formatEvidenceRefs(refs: ResearchEvidenceRef[]): string {
  return refs.map((ref) => `${ref.kind}:${ref.ref}`).join("; ");
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing research sessions.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Research session path escapes workspace root: ${JSON.stringify(path)}`);
  }

  return target;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Research session budget must be a positive integer: ${JSON.stringify(value)}.`);
  }

  return value;
}

function normalizeStringList(values: string[]): string[] {
  return values
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function requireText(value: string | undefined, message: string): string {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function titleFromObjective(objective: string): string {
  const normalized = objective.trim().replace(/\s+/g, " ");
  return normalized.length <= 72 ? normalized : `${normalized.slice(0, 69)}...`;
}

function isResearchSessionId(value: string): boolean {
  return /^session_[a-f0-9]{16}$/.test(value);
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

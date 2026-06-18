import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { validateJsonSchema } from "./json-schema-validation.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export const REPORT_DRAFT_SCHEMA_VERSION = "truth-harness.report-draft.v0" as const;

export interface ReportDraft {
  schemaVersion: typeof REPORT_DRAFT_SCHEMA_VERSION;
  reportId: string;
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  externalCalls: string[];
  source: string;
  title: string;
  summary?: string;
  receiptRunId?: string;
  claimId?: string;
  trust?: string;
  bundleVerificationIds: string[];
  markdownSha256: string;
  markdownByteLength: number;
  warnings: string[];
  paths: {
    json: string;
    markdown: string;
  };
}

export interface ReportDraftPaths {
  json: string;
  markdown: string;
  relativeJson: string;
  relativeMarkdown: string;
}

export interface ReportDraftActivity {
  actor: "local-api" | "cli" | "agent";
  action: "saved-report-draft";
  detail: string;
  at: string;
}

export interface WriteReportDraftInput {
  rootPath: string;
  markdown: string;
  title?: string;
  summary?: string;
  receiptRunId?: string;
  claimId?: string;
  trust?: string;
  bundleVerificationIds?: string[];
  source?: string;
  actor?: ReportDraftActivity["actor"];
  now?: string;
}

export interface ReportDraftWriteResult {
  report: ReportDraft;
  paths: ReportDraftPaths;
  activity: ReportDraftActivity[];
}

export interface ReportDraftSummary {
  report: ReportDraft;
  markdownVerified: boolean;
  markdownStatus: "verified" | "sha-mismatch" | "missing";
  markdownSha256?: string;
  paths: ReportDraftPaths;
  mtimeMs: number;
}

export interface ListReportDraftsInput {
  rootPath: string;
  limit?: number;
}

export interface ReadReportDraftInput {
  rootPath: string;
  reportId: string;
}

export interface ReportDraftReadResult {
  report: ReportDraft;
  markdown: string;
  markdownVerified: boolean;
  markdownSha256: string;
  paths: ReportDraftPaths;
}

export class ReportDraftError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ReportDraftError";
    this.status = status;
  }
}

const MAX_REPORT_MARKDOWN_BYTES = 96 * 1024;
const SCHEMAS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");
let reportDraftSchemaCache: Promise<unknown> | undefined;

export async function writeReportDraft(input: WriteReportDraftInput): Promise<ReportDraftWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const markdown = typeof input.markdown === "string" ? input.markdown : "";
  if (!markdown.trim()) {
    throw new ReportDraftError(400, "Report markdown is required.");
  }

  const markdownBytes = Buffer.from(markdown, "utf8");
  if (markdownBytes.length > MAX_REPORT_MARKDOWN_BYTES) {
    throw new ReportDraftError(413, "Report markdown is too large.");
  }

  const createdAt = input.now ?? new Date().toISOString();
  const markdownSha256 = sha256(markdownBytes);
  const reportWithoutId = {
    schemaVersion: REPORT_DRAFT_SCHEMA_VERSION,
    createdAt,
    localOnly: true as const,
    networkAccess: "none" as const,
    externalCalls: [] as string[],
    source: normalizeOptionalText(input.source) ?? "report-draft-api",
    title: normalizeOptionalText(input.title) ?? "Truth Harness Report Draft",
    summary: normalizeOptionalText(input.summary),
    receiptRunId: normalizeOptionalText(input.receiptRunId),
    claimId: normalizeOptionalText(input.claimId),
    trust: normalizeOptionalText(input.trust),
    bundleVerificationIds: normalizeBundleVerificationIds(input.bundleVerificationIds ?? []),
    markdownSha256,
    markdownByteLength: markdownBytes.length,
    warnings: [
      "This is a saved report draft, not proof, peer review, legal review, medical validation, or publication acceptance.",
      "Trust labels remain governed by the cited receipts, proof checks, SMT/CAS records, bundle verifications, and replay commands."
    ]
  };
  const reportId = `report_${sha256(Buffer.from(JSON.stringify(reportWithoutId), "utf8")).slice(0, 16)}`;
  const findingsDir = resolve(status.root, status.manifest.directories.findings);
  const baseName = `${createdAt.slice(0, 10)}-${reportId}-report-draft`;
  const jsonPath = join(findingsDir, `${baseName}.json`);
  const markdownPath = join(findingsDir, `${baseName}.md`);
  const relativeJson = toPortablePath(relative(status.root, jsonPath));
  const relativeMarkdown = toPortablePath(relative(status.root, markdownPath));
  const report: ReportDraft = {
    ...reportWithoutId,
    reportId,
    paths: {
      json: relativeJson,
      markdown: relativeMarkdown
    }
  };

  await assertReportDraftSchema(report);
  await mkdir(findingsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, report);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relativeJson,
    kind: "findings",
    now: createdAt,
    staleReason: "report draft artifact written"
  });

  return {
    report,
    paths: {
      json: jsonPath,
      markdown: markdownPath,
      relativeJson,
      relativeMarkdown
    },
    activity: [
      {
        actor: input.actor ?? "local-api",
        action: "saved-report-draft",
        detail: `Saved ${reportId} to ${relativeMarkdown} with SHA-256 ${markdownSha256}.`,
        at: createdAt
      }
    ]
  };
}

async function assertReportDraftSchema(report: ReportDraft): Promise<void> {
  const schema = await loadReportDraftSchema();
  const jsonReport = parseJsonWithOptionalBom(JSON.stringify(report));
  const issues = validateJsonSchema(jsonReport, schema);
  if (issues.length === 0) {
    return;
  }

  throw new ReportDraftError(
    500,
    `Report draft failed JSON Schema validation before write: ${issues
      .map((issue) => `${issue.path} ${issue.message}`)
      .join("; ")}`
  );
}

function loadReportDraftSchema(): Promise<unknown> {
  reportDraftSchemaCache ??= readFile(resolve(SCHEMAS_DIR, "report-draft.schema.json"), "utf8").then((raw) =>
    parseJsonWithOptionalBom(raw)
  );
  return reportDraftSchemaCache;
}

export async function listReportDrafts(input: ListReportDraftsInput): Promise<ReportDraftSummary[]> {
  const status = await requireLocalWorkspace(input.rootPath);
  const findingsDir = resolve(status.root, status.manifest.directories.findings);
  let entries;
  try {
    entries = await readdir(findingsDir, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const reports: ReportDraftSummary[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith("-report-draft.json")) {
      continue;
    }

    const summary = await readReportDraftSummary(status.root, join(findingsDir, entry.name));
    if (summary) {
      reports.push(summary);
    }
  }

  reports.sort((left, right) => {
    const leftTime = Date.parse(left.report.createdAt) || left.mtimeMs;
    const rightTime = Date.parse(right.report.createdAt) || right.mtimeMs;
    return rightTime - leftTime;
  });

  return Number.isFinite(input.limit) ? reports.slice(0, input.limit) : reports;
}

export async function readReportDraft(input: ReadReportDraftInput): Promise<ReportDraftReadResult> {
  if (!isReportId(input.reportId)) {
    throw new ReportDraftError(400, "Invalid report draft id.");
  }

  const reports = await listReportDrafts({ rootPath: input.rootPath });
  const summary = reports.find((item) => item.report.reportId === input.reportId);
  if (!summary) {
    throw new ReportDraftError(404, "Report draft was not found in local findings.");
  }

  let markdown = "";
  try {
    markdown = await readFile(summary.paths.markdown, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      throw new ReportDraftError(404, "Report draft Markdown artifact is missing.");
    }
    throw error;
  }

  const markdownSha256 = sha256(Buffer.from(markdown, "utf8"));
  const markdownVerified = markdownSha256 === summary.report.markdownSha256;
  const warnings = markdownVerified
    ? [...summary.report.warnings]
    : [
        ...summary.report.warnings,
        "Saved Markdown hash does not match the report draft JSON metadata. Treat this draft as tampered or manually edited until reviewed."
      ];

  return {
    report: {
      ...summary.report,
      warnings
    },
    markdown,
    markdownVerified,
    markdownSha256,
    paths: summary.paths
  };
}

async function readReportDraftSummary(root: string, jsonPath: string): Promise<ReportDraftSummary | undefined> {
  try {
    const [info, raw] = await Promise.all([stat(jsonPath), readFile(jsonPath, "utf8")]);
    const parsed = parseJsonWithOptionalBom(raw);
    const report = normalizeReportDraft(parsed);
    if (!report) {
      return undefined;
    }

    const markdownPath = resolveUnderRoot(root, report.paths.markdown || toPortablePath(relative(root, jsonPath.replace(/\.json$/u, ".md"))));
    const markdownCheck = await readReportDraftMarkdownCheck(report, markdownPath);
    return {
      report,
      markdownVerified: markdownCheck.verified,
      markdownStatus: markdownCheck.status,
      markdownSha256: markdownCheck.sha256,
      paths: {
        json: jsonPath,
        markdown: markdownPath,
        relativeJson: toPortablePath(relative(root, jsonPath)),
        relativeMarkdown: toPortablePath(relative(root, markdownPath))
      },
      mtimeMs: info.mtimeMs
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function readReportDraftMarkdownCheck(
  report: ReportDraft,
  markdownPath: string
): Promise<{ status: ReportDraftSummary["markdownStatus"]; verified: boolean; sha256?: string }> {
  try {
    const markdown = await readFile(markdownPath, "utf8");
    const digest = sha256(Buffer.from(markdown, "utf8"));
    return {
      status: digest === report.markdownSha256 ? "verified" : "sha-mismatch",
      verified: digest === report.markdownSha256,
      sha256: digest
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {
        status: "missing",
        verified: false
      };
    }
    throw error;
  }
}

function normalizeReportDraft(value: unknown): ReportDraft | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const reportId = typeof record.reportId === "string" ? record.reportId : "";
  if (record.schemaVersion !== REPORT_DRAFT_SCHEMA_VERSION || !isReportId(reportId)) {
    return undefined;
  }

  const paths = record.paths && typeof record.paths === "object" && !Array.isArray(record.paths)
    ? record.paths as Record<string, unknown>
    : {};
  return {
    schemaVersion: REPORT_DRAFT_SCHEMA_VERSION,
    reportId,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    localOnly: true,
    networkAccess: "none",
    externalCalls: normalizeStringList(record.externalCalls),
    source: typeof record.source === "string" ? record.source : "unknown",
    title: typeof record.title === "string" ? record.title : "Truth Harness Report Draft",
    summary: typeof record.summary === "string" ? record.summary : undefined,
    receiptRunId: typeof record.receiptRunId === "string" ? record.receiptRunId : undefined,
    claimId: typeof record.claimId === "string" ? record.claimId : undefined,
    trust: typeof record.trust === "string" ? record.trust : undefined,
    bundleVerificationIds: normalizeBundleVerificationIds(normalizeStringList(record.bundleVerificationIds)),
    markdownSha256: typeof record.markdownSha256 === "string" ? record.markdownSha256 : "",
    markdownByteLength: typeof record.markdownByteLength === "number" ? record.markdownByteLength : 0,
    warnings: normalizeStringList(record.warnings),
    paths: {
      json: typeof paths.json === "string" ? normalizePortablePath(paths.json) : "",
      markdown: typeof paths.markdown === "string" ? normalizePortablePath(paths.markdown) : ""
    }
  };
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new ReportDraftError(404, "No Truth Harness workspace found. Run `truth-harness workspace init` first.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new ReportDraftError(400, "Workspace artifact path escapes the project root.");
  }
  return target;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBundleVerificationIds(value: string[]): string[] {
  return value.filter((id) => /^cver_[a-f0-9]{16}$/u.test(id)).slice(0, 20);
}

function normalizePortablePath(value: string): string {
  return value.trim().replace(/\\/gu, "/").replace(/^\.\/+/u, "");
}

function isReportId(value: string): boolean {
  return /^report_[a-f0-9]{16}$/u.test(value);
}

function toPortablePath(value: string): string {
  return value.split(sep).join("/");
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

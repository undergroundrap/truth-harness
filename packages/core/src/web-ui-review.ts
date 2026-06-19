import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export type WebUiReviewStatus = "passed" | "warning" | "failed";
export type WebUiReviewCheckStatus = "pass" | "warn" | "fail";

export interface WebUiLayoutAuditSummary {
  schemaVersion: "truth-harness.web-ui-layout-audit.v0";
  status: WebUiReviewStatus;
  generatedAt?: string;
  sourcePath?: string;
  viewport?: {
    width: number;
    height: number;
  };
  surfaces: {
    total: number;
    passed: number;
    warnings: number;
    failures: number;
  };
  nonPassingSurfaces: Array<{
    surface: string;
    status: WebUiReviewStatus;
    findings: number;
    findingCodes: string[];
  }>;
}

export interface WebUiReviewChecklistItem {
  checkId: string;
  title: string;
  status: WebUiReviewCheckStatus;
  notes: string[];
}

export interface WebUiReviewRecord {
  schemaVersion: "truth-harness.web-ui-review.v0";
  reviewId: string;
  title: string;
  summary: string;
  createdAt: string;
  status: WebUiReviewStatus;
  localOnly: true;
  networkAccess: "none";
  targetUrl: string;
  viewport: {
    width: number;
    height: number;
  };
  checklist: WebUiReviewChecklistItem[];
  layoutAudit?: WebUiLayoutAuditSummary;
  artifacts: {
    json: string;
    markdown: string;
    screenshot?: string;
    layoutAudit?: string;
  };
  replay: string;
  tags: string[];
  limitations: string[];
  warnings: string[];
}

export interface WebUiReviewSummary {
  reviewId: string;
  title: string;
  summary: string;
  createdAt: string;
  status: WebUiReviewStatus;
  targetUrl: string;
  viewport: {
    width: number;
    height: number;
  };
  path: string;
  screenshot?: string;
  layoutAudit?: string;
  layoutAuditStatus?: WebUiReviewStatus;
  checks: {
    passed: number;
    warnings: number;
    failed: number;
  };
  checkTitles: string[];
  tags: string[];
  warnings: string[];
}

export interface CreateWebUiReviewInput {
  now?: Date;
  targetUrl?: string;
  viewport?: {
    width: number;
    height: number;
  };
  checklist?: Array<{
    title: string;
    status: WebUiReviewCheckStatus;
    notes?: string[];
  }>;
  screenshot?: string;
  layoutAudit?: string;
  layoutAuditSummary?: WebUiLayoutAuditSummary;
  replayCommand?: string;
}

export interface WriteWebUiReviewInput extends CreateWebUiReviewInput {
  rootPath: string;
}

export interface WebUiReviewWriteResult {
  record: WebUiReviewRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

const WEB_UI_REVIEW_SCHEMA_VERSION = "truth-harness.web-ui-review.v0" as const;

export function createWebUiReviewRecord(input: CreateWebUiReviewInput = {}): WebUiReviewRecord {
  const createdAt = (input.now ?? new Date()).toISOString();
  const checklist = normalizeChecklist(input.checklist, input.layoutAuditSummary);
  const status = reviewStatusForChecklist(checklist);
  const warningCount = checklist.filter((check) => check.status === "warn").length;
  const failedCount = checklist.filter((check) => check.status === "fail").length;
  const summary = summaryForStatus(status, checklist.length, warningCount, failedCount);
  const base = {
    createdAt,
    status,
    targetUrl: input.targetUrl ?? "http://127.0.0.1:4180/",
    viewport: normalizeViewport(input.viewport),
    checklist,
    screenshot: input.screenshot,
    layoutAudit: input.layoutAudit,
    layoutAuditSummary: input.layoutAuditSummary
  };
  const reviewId = `uirev_${stableHash(base).slice(0, 16)}`;

  return {
    schemaVersion: WEB_UI_REVIEW_SCHEMA_VERSION,
    reviewId,
    title: "Web UI Browser Review",
    summary,
    createdAt,
    status,
    localOnly: true,
    networkAccess: "none",
    targetUrl: base.targetUrl,
    viewport: base.viewport,
    checklist,
    ...(input.layoutAuditSummary ? { layoutAudit: input.layoutAuditSummary } : {}),
    artifacts: {
      json: "",
      markdown: "",
      ...(input.screenshot ? { screenshot: input.screenshot } : {}),
      ...(input.layoutAudit ? { layoutAudit: input.layoutAudit } : {})
    },
    replay:
      input.replayCommand ??
      "truth-harness workspace ui-review . --pass \"browser screenshot reviewed for clipping, overflow, scroll behavior, and report readability\"",
    tags: [
      "web-ui",
      "browser-review",
      status,
      input.screenshot ? "screenshot-attached" : "no-screenshot",
      input.layoutAuditSummary ? "layout-audit-attached" : "no-layout-audit",
      input.layoutAuditSummary ? `layout-audit-${input.layoutAuditSummary.status}` : undefined
    ]
      .filter((tag): tag is string => Boolean(tag))
      .sort(),
    limitations: [
      "This is UI launch-readiness evidence only. It does not prove mathematical, scientific, medical, regulatory, or legal truth.",
      "A passing UI review means the recorded browser surface was inspected for the listed checks at the stated viewport.",
      "Attached browser layout audits check visible DOM geometry only; they do not prove product usability for every viewport.",
      "This review does not replace future pixel-diff screenshot baselines; it is a durable local review artifact until those gates exist."
    ],
    warnings: status === "passed" ? [] : checklist.flatMap((check) => check.status === "pass" ? [] : [`${check.title}: ${check.notes.join(" ") || check.status}`])
  };
}

export async function writeWebUiReview(input: WriteWebUiReviewInput): Promise<WebUiReviewWriteResult> {
  const workspace = await requireLocalWorkspace(input.rootPath);
  const record = createWebUiReviewRecord(input);
  const findingsDir = resolve(workspace.root, workspace.manifest.directories.findings);
  const baseName = `${record.createdAt.slice(0, 10)}-${record.reviewId}-web-ui-review`;
  const jsonPath = join(findingsDir, `${baseName}.json`);
  const markdownPath = join(findingsDir, `${baseName}.md`);
  record.artifacts = {
    json: toPortablePath(relative(workspace.root, jsonPath)),
    markdown: toPortablePath(relative(workspace.root, markdownPath)),
    ...(input.screenshot ? { screenshot: toPortablePath(input.screenshot) } : {}),
    ...(input.layoutAudit ? { layoutAudit: toPortablePath(input.layoutAudit) } : {})
  };
  const markdown = renderWebUiReviewMarkdown(record);

  await assertWebUiReviewSchema(record);
  await mkdir(findingsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: workspace.root,
    path: relative(workspace.root, jsonPath),
    kind: "findings",
    now: record.createdAt,
    staleReason: "web UI review written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listWebUiReviews(rootPath: string): Promise<WebUiReviewSummary[]> {
  const workspace = await requireLocalWorkspace(rootPath);
  const findingsDir = resolve(workspace.root, workspace.manifest.directories.findings);

  let files: string[];
  try {
    files = await readdir(findingsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const summaries = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const path = join(findingsDir, file);
        return summarizeWebUiReview(workspace.root, path, await readFile(path, "utf8"));
      })
  );

  return summaries
    .filter((summary): summary is WebUiReviewSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function parseWebUiReviewJson(raw: string, sourcePath = "web UI review"): WebUiReviewRecord {
  const parsed = JSON.parse(raw) as WebUiReviewRecord;
  if (parsed.schemaVersion !== WEB_UI_REVIEW_SCHEMA_VERSION) {
    throw new Error(`Unsupported web UI review schema: ${JSON.stringify(parsed.schemaVersion)} in ${sourcePath}`);
  }
  if (!/^uirev_[a-f0-9]{16}$/u.test(parsed.reviewId)) {
    throw new Error(`Invalid web UI review id: ${JSON.stringify(parsed.reviewId)} in ${sourcePath}`);
  }
  return parsed;
}

export function parseWebUiLayoutAuditSummaryJson(raw: string, sourcePath = "web UI layout audit"): WebUiLayoutAuditSummary {
  const parsed = JSON.parse(stripUtf8Bom(raw)) as {
    schemaVersion?: unknown;
    status?: unknown;
    generatedAt?: unknown;
    viewport?: unknown;
    summary?: unknown;
    surfaces?: unknown;
  };
  if (parsed.schemaVersion !== "truth-harness.web-ui-layout-audit.v0") {
    throw new Error(`Unsupported web UI layout audit schema: ${JSON.stringify(parsed.schemaVersion)} in ${sourcePath}`);
  }

  const summary = parsed.summary as Partial<{
    surfaces: unknown;
    passed: unknown;
    warnings: unknown;
    failures: unknown;
  }>;
  const total = finiteInteger(summary?.surfaces, "summary.surfaces", sourcePath);
  const passed = finiteInteger(summary?.passed, "summary.passed", sourcePath);
  const warnings = finiteInteger(summary?.warnings, "summary.warnings", sourcePath);
  const failures = finiteInteger(summary?.failures, "summary.failures", sourcePath);
  const status = webUiReviewStatusFromUnknown(parsed.status, failures, warnings, sourcePath);
  const surfaces = Array.isArray(parsed.surfaces) ? parsed.surfaces : [];

  return {
    schemaVersion: "truth-harness.web-ui-layout-audit.v0",
    status,
    ...(typeof parsed.generatedAt === "string" ? { generatedAt: parsed.generatedAt } : {}),
    sourcePath,
    ...(viewportFromUnknown(parsed.viewport) ? { viewport: viewportFromUnknown(parsed.viewport) } : {}),
    surfaces: {
      total,
      passed,
      warnings,
      failures
    },
    nonPassingSurfaces: surfaces
      .map((surface) => {
        const item = surface as { surface?: unknown; status?: unknown; findings?: unknown };
        const itemStatus = webUiReviewStatusFromUnknown(item.status, 0, 0, sourcePath);
        const findings = Array.isArray(item.findings) ? item.findings : [];
        return {
          surface: typeof item.surface === "string" ? item.surface : "unknown",
          status: itemStatus,
          findings: findings.length,
          findingCodes: [
            ...new Set(
              findings
                .map((finding) => (finding as { code?: unknown }).code)
                .filter((code): code is string => typeof code === "string" && code.length > 0)
            )
          ].sort()
        };
      })
      .filter((surface) => surface.status !== "passed")
  };
}

export function renderWebUiReviewMarkdown(record: WebUiReviewRecord): string {
  const counts = reviewCheckCounts(record.checklist);
  const lines = [
    "# Truth Harness Web UI Review",
    "",
    `Review: \`${record.reviewId}\``,
    `Status: \`${record.status}\``,
    `Created: ${record.createdAt}`,
    `Target: \`${record.targetUrl}\``,
    `Viewport: \`${record.viewport.width}x${record.viewport.height}\``,
    `Replay: \`${escapeMarkdownText(record.replay)}\``,
    "",
    "## Summary",
    "",
    record.summary,
    "",
    `- Passed checks: \`${counts.passed}\``,
    `- Warnings: \`${counts.warnings}\``,
    `- Failed checks: \`${counts.failed}\``,
    ...(record.artifacts.screenshot ? [`- Screenshot: \`${escapeMarkdownText(record.artifacts.screenshot)}\``] : []),
    ...(record.artifacts.layoutAudit ? [`- Layout audit: \`${escapeMarkdownText(record.artifacts.layoutAudit)}\``] : []),
    "",
    "## Checklist",
    ""
  ];

  for (const check of record.checklist) {
    lines.push(`- \`${check.status}\` ${escapeMarkdownText(check.title)} (${check.checkId})`);
    for (const note of check.notes) {
      lines.push(`  - ${escapeMarkdownText(note)}`);
    }
  }

  if (record.layoutAudit) {
    lines.push("", "## Browser Layout Audit", "");
    lines.push(`- Status: \`${record.layoutAudit.status}\``);
    lines.push(`- Surfaces: \`${record.layoutAudit.surfaces.passed}/${record.layoutAudit.surfaces.total} passed\``);
    lines.push(`- Warnings: \`${record.layoutAudit.surfaces.warnings}\``);
    lines.push(`- Failures: \`${record.layoutAudit.surfaces.failures}\``);
    if (record.layoutAudit.nonPassingSurfaces.length > 0) {
      lines.push("- Non-passing surfaces:");
      for (const surface of record.layoutAudit.nonPassingSurfaces) {
        const codes = surface.findingCodes.length > 0 ? `; ${escapeMarkdownText(surface.findingCodes.join(", "))}` : "";
        lines.push(
          `  - \`${escapeMarkdownText(surface.surface)}\`: \`${surface.status}\` (${surface.findings} finding(s)${codes})`
        );
      }
    }
  }

  lines.push("", "## Boundary", "");
  for (const limitation of record.limitations) {
    lines.push(`- ${escapeMarkdownText(limitation)}`);
  }

  if (record.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of record.warnings) {
      lines.push(`- ${escapeMarkdownText(warning)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function assertWebUiReviewSchema(record: WebUiReviewRecord): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: record,
    schemaFile: "web-ui-review.schema.json",
    artifactName: "Web UI review"
  });
}

function normalizeChecklist(
  input: CreateWebUiReviewInput["checklist"],
  layoutAuditSummary?: WebUiLayoutAuditSummary
): WebUiReviewChecklistItem[] {
  const checks = input?.length
    ? input
    : layoutAuditSummary
      ? []
      : [
      {
        checkId: "ui_check_missing_explicit_review",
        title: "No explicit browser review checks were provided.",
        status: "warn" as const,
        notes: ["Record at least one pass/warn/fail check from a real browser inspection before launch."]
      }
    ];

  const normalized = checks.map((check, index) => {
    const title = check.title.trim();
    const status = check.status;
    const checkId = `ui_check_${stableHash({ index, title, status }).slice(0, 12)}`;
    return {
      checkId,
      title: title || `Browser review check ${index + 1}`,
      status,
      notes: (check.notes?.map((note) => note.trim()).filter(Boolean) ?? [])
    };
  });

  if (layoutAuditSummary) {
    normalized.push(layoutAuditChecklistItem(layoutAuditSummary, normalized.length));
  }

  return normalized;
}

function normalizeViewport(viewport: CreateWebUiReviewInput["viewport"]): { width: number; height: number } {
  return {
    width: viewport?.width ?? 1280,
    height: viewport?.height ?? 720
  };
}

function reviewStatusForChecklist(checklist: WebUiReviewChecklistItem[]): WebUiReviewStatus {
  if (checklist.some((check) => check.status === "fail")) {
    return "failed";
  }
  if (checklist.some((check) => check.status === "warn")) {
    return "warning";
  }
  return "passed";
}

function summaryForStatus(status: WebUiReviewStatus, total: number, warnings: number, failed: number): string {
  if (status === "passed") {
    return `${total} browser UI review check(s) passed with no recorded launch-readiness warnings.`;
  }
  if (status === "warning") {
    return `${warnings} browser UI review warning(s) remain; launch is not visually clean yet.`;
  }
  return `${failed} browser UI review failure(s) remain; fix before public recording or professor review.`;
}

function reviewCheckCounts(checklist: WebUiReviewChecklistItem[]): WebUiReviewSummary["checks"] {
  return {
    passed: checklist.filter((check) => check.status === "pass").length,
    warnings: checklist.filter((check) => check.status === "warn").length,
    failed: checklist.filter((check) => check.status === "fail").length
  };
}

function layoutAuditChecklistItem(summary: WebUiLayoutAuditSummary, index: number): WebUiReviewChecklistItem {
  const status = webUiReviewCheckStatusFromLayoutAudit(summary.status);
  const title = `Browser layout audit ${summary.status}: ${summary.surfaces.passed}/${summary.surfaces.total} surfaces passed`;
  return {
    checkId: `ui_check_${stableHash({ index, title, status, summary }).slice(0, 12)}`,
    title,
    status,
    notes: [
      `${summary.surfaces.failures} failure(s), ${summary.surfaces.warnings} warning(s), ${summary.nonPassingSurfaces.length} non-passing surface(s).`,
      ...(summary.nonPassingSurfaces.length > 0
        ? [
          `Non-passing surfaces: ${summary.nonPassingSurfaces
            .map((surface) =>
              `${surface.surface}:${surface.status}` +
              (surface.findingCodes.length > 0 ? ` (${surface.findingCodes.join(", ")})` : "")
            )
            .join(", ")}.`
        ]
        : [])
    ]
  };
}

function webUiReviewCheckStatusFromLayoutAudit(status: WebUiReviewStatus): WebUiReviewCheckStatus {
  if (status === "failed") {
    return "fail";
  }
  if (status === "warning") {
    return "warn";
  }
  return "pass";
}

function summarizeWebUiReview(rootPath: string, path: string, raw: string): WebUiReviewSummary | undefined {
  try {
    const record = parseWebUiReviewJson(raw, path);
    return {
      reviewId: record.reviewId,
      title: record.title,
      summary: record.summary,
      createdAt: record.createdAt,
      status: record.status,
      targetUrl: record.targetUrl,
      viewport: record.viewport,
      path: toPortablePath(relative(rootPath, path)),
      screenshot: record.artifacts.screenshot,
      layoutAudit: record.artifacts.layoutAudit,
      layoutAuditStatus: record.layoutAudit?.status,
      checks: reviewCheckCounts(record.checklist),
      checkTitles: record.checklist.map((check) => check.title),
      tags: record.tags,
      warnings: record.warnings
    };
  } catch {
    return undefined;
  }
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing web UI reviews.");
  }
  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}. Run \`truth-harness workspace repair\`.`);
  }
  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function finiteInteger(value: unknown, field: string, sourcePath: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`Invalid web UI layout audit ${field}: ${JSON.stringify(value)} in ${sourcePath}`);
  }
  return Number(value);
}

function webUiReviewStatusFromUnknown(value: unknown, failures: number, warnings: number, sourcePath: string): WebUiReviewStatus {
  if (value === "passed" || value === "warning" || value === "failed") {
    return value;
  }
  if (failures > 0) {
    return "failed";
  }
  if (warnings > 0) {
    return "warning";
  }
  if (value === undefined || value === null) {
    return "passed";
  }
  throw new Error(`Invalid web UI layout audit status: ${JSON.stringify(value)} in ${sourcePath}`);
}

function viewportFromUnknown(value: unknown): WebUiLayoutAuditSummary["viewport"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const viewport = value as { width?: unknown; height?: unknown };
  if (!Number.isInteger(viewport.width) || !Number.isInteger(viewport.height)) {
    return undefined;
  }
  return {
    width: Number(viewport.width),
    height: Number(viewport.height)
  };
}

function escapeMarkdownText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\*/gu, "\\*").replace(/_/gu, "\\_").replace(/`/gu, "\\`");
}

function stripUtf8Bom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

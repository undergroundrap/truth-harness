import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export type WebUiReviewStatus = "passed" | "warning" | "failed";
export type WebUiReviewCheckStatus = "pass" | "warn" | "fail";

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
  artifacts: {
    json: string;
    markdown: string;
    screenshot?: string;
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
  const checklist = normalizeChecklist(input.checklist);
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
    screenshot: input.screenshot
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
    artifacts: {
      json: "",
      markdown: "",
      ...(input.screenshot ? { screenshot: input.screenshot } : {})
    },
    replay:
      input.replayCommand ??
      "truth-harness workspace ui-review . --pass \"browser screenshot reviewed for clipping, overflow, scroll behavior, and report readability\"",
    tags: [
      "web-ui",
      "browser-review",
      status,
      input.screenshot ? "screenshot-attached" : "no-screenshot"
    ].sort(),
    limitations: [
      "This is UI launch-readiness evidence only. It does not prove mathematical, scientific, medical, regulatory, or legal truth.",
      "A passing UI review means the recorded browser surface was inspected for the listed checks at the stated viewport.",
      "This review does not replace automated screenshot regression tests; it is a durable local review artifact until those gates exist."
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
    ...(input.screenshot ? { screenshot: toPortablePath(input.screenshot) } : {})
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

function normalizeChecklist(input: CreateWebUiReviewInput["checklist"]): WebUiReviewChecklistItem[] {
  if (!input || input.length === 0) {
    return [
      {
        checkId: "ui_check_missing_explicit_review",
        title: "No explicit browser review checks were provided.",
        status: "warn",
        notes: ["Record at least one pass/warn/fail check from a real browser inspection before launch."]
      }
    ];
  }

  return input.map((check, index) => {
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

function escapeMarkdownText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\*/gu, "\\*").replace(/_/gu, "\\_").replace(/`/gu, "\\`");
}

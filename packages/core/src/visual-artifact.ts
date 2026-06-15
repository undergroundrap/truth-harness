import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export const VISUAL_ARTIFACT_SCHEMA_VERSION = "truth-harness.visual-artifact.v0";

export type VisualArtifactKind =
  | "plot"
  | "proof-tree"
  | "lineage-graph"
  | "mind-map"
  | "concept-map"
  | "simulation-view"
  | "notebook-output"
  | "teaching-animation"
  | "report-figure";

export type VisualArtifactRenderer =
  | "truth-harness-native"
  | "plotly"
  | "graphviz"
  | "mermaid"
  | "tldraw"
  | "manim"
  | "sage"
  | "matplotlib"
  | "external-file";

export type VisualArtifactPayloadFormat =
  | "svg"
  | "plotly-json"
  | "graph-json"
  | "canvas-json"
  | "html"
  | "png-ref"
  | "table-json";

export type VisualArtifactRendererSourceLanguage =
  | "mermaid"
  | "dot"
  | "plotly-json"
  | "python"
  | "tldraw-json"
  | "svg"
  | "html"
  | "text";

export type VisualArtifactSourceKind =
  | "visual"
  | "receipt"
  | "claim"
  | "route"
  | "proof"
  | "smt"
  | "cas"
  | "notebook"
  | "simulation"
  | "experiment"
  | "source"
  | "workspace-graph"
  | "workspace-review"
  | "manual";

export interface VisualArtifactSourceRef {
  kind: VisualArtifactSourceKind;
  ref: string;
  label?: string;
}

export interface VisualArtifactRendererInfo {
  engine: VisualArtifactRenderer;
  engineVersion?: string;
  adapter?: string;
  adapterVersion?: string;
}

export interface VisualArtifactPayload {
  format: VisualArtifactPayloadFormat;
  content: unknown;
  contentRef?: string;
  rendererSource?: VisualArtifactRendererSource;
  width?: number;
  height?: number;
}

export interface VisualArtifactRendererSource {
  language: VisualArtifactRendererSourceLanguage;
  content: string;
  filename?: string;
  contentHash?: string;
}

export interface VisualArtifactDataTable {
  columns: string[];
  rows: string[][];
}

export interface VisualArtifact {
  schemaVersion: typeof VISUAL_ARTIFACT_SCHEMA_VERSION;
  visualId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  kind: VisualArtifactKind;
  renderer: VisualArtifactRendererInfo;
  sourceRefs: VisualArtifactSourceRef[];
  replayCommand: string;
  payload: VisualArtifactPayload;
  data?: VisualArtifactDataTable;
  tags: string[];
  privacy: PrivacyMetadata;
  trustBoundary: {
    visualIsEvidence: true;
    visualDoesNotUpgradeTrust: true;
    sourceArtifactsRemainAuthoritative: true;
  };
  warnings: string[];
  markdown: string;
}

export interface CreateVisualArtifactInput {
  rootPath: string;
  title: string;
  kind: VisualArtifactKind;
  renderer: VisualArtifactRendererInfo;
  sourceRefs?: VisualArtifactSourceRef[];
  replayCommand?: string;
  payload: VisualArtifactPayload;
  data?: VisualArtifactDataTable;
  tags?: string[];
  warnings?: string[];
  now?: string;
}

export interface VisualArtifactWriteResult {
  visual: VisualArtifact;
  jsonPath: string;
  markdownPath: string;
}

export interface VisualArtifactSummary {
  visualId: string;
  path: string;
  title: string;
  kind: VisualArtifactKind;
  renderer: VisualArtifactRenderer;
  createdAt: string;
  sourceRefs: VisualArtifactSourceRef[];
  tags: string[];
}

export async function createVisualArtifact(input: CreateVisualArtifactInput): Promise<VisualArtifact> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const title = normalizeRequiredText(input.title, "title");
  const sourceRefs = normalizeSourceRefs(input.sourceRefs ?? []);
  const renderer = normalizeRenderer(input.renderer);
  const payload = normalizePayload(input.payload);
  const data = input.data ? normalizeDataTable(input.data) : undefined;
  const tags = normalizeTags(input.tags ?? []);
  const warnings = [
    "Visual artifacts are local evidence views, not proof by themselves.",
    "Trust labels can only change when source receipts, routes, proof checks, SMT checks, CAS checks, or human review gates accept evidence.",
    ...normalizeStringList(input.warnings ?? [])
  ];
  const base = {
    projectId: status.manifest.projectId,
    createdAt,
    updatedAt: createdAt,
    title,
    kind: input.kind,
    renderer,
    sourceRefs,
    replayCommand: normalizeOptionalText(input.replayCommand) ?? defaultReplayCommand(sourceRefs),
    payload,
    ...(data ? { data } : {}),
    tags,
    privacy: status.manifest.privacy,
    trustBoundary: {
      visualIsEvidence: true as const,
      visualDoesNotUpgradeTrust: true as const,
      sourceArtifactsRemainAuthoritative: true as const
    },
    warnings
  };
  const visualId = `vis_${stableHash(base).slice(0, 16)}`;
  const visualWithoutMarkdown: Omit<VisualArtifact, "markdown"> = {
    schemaVersion: VISUAL_ARTIFACT_SCHEMA_VERSION,
    visualId,
    ...base
  };

  return {
    ...visualWithoutMarkdown,
    markdown: renderVisualArtifactMarkdown(visualWithoutMarkdown)
  };
}

export async function writeVisualArtifact(input: CreateVisualArtifactInput): Promise<VisualArtifactWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const visual = await createVisualArtifact(input);
  const visualsDir = resolve(status.root, status.manifest.directories.visuals);
  await mkdir(visualsDir, { recursive: true });
  const baseName = `${visual.createdAt.slice(0, 10)}-${visual.visualId}`;
  const jsonPath = join(visualsDir, `${baseName}.json`);
  const markdownPath = join(visualsDir, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(visual, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, visual.markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "visuals",
    now: visual.createdAt,
    staleReason: "visual artifact written"
  });

  return {
    visual,
    jsonPath,
    markdownPath
  };
}

export async function listVisualArtifacts(rootPath: string): Promise<VisualArtifactSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const visualsDir = resolve(status.root, status.manifest.directories.visuals);

  let files: string[];
  try {
    files = await readdir(visualsDir);
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
        const path = join(visualsDir, file);
        const visual = parseVisualArtifactJson(await readFile(path, "utf8"), path);
        return summarizeVisualArtifact(visual, toPortablePath(relative(status.root, path)));
      })
  );

  return summaries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function readVisualArtifact(rootPath: string, visualRef: string): Promise<VisualArtifact> {
  const status = await requireLocalWorkspace(rootPath);
  const visualsDir = resolve(status.root, status.manifest.directories.visuals);
  const directPath = resolveUnderRoot(status.root, visualRef);

  if (directPath.endsWith(".json")) {
    return parseVisualArtifactJson(await readFile(directPath, "utf8"), directPath);
  }

  const summaries = await listVisualArtifacts(rootPath);
  const found = summaries.find((summary) => summary.visualId === visualRef || summary.path === visualRef);
  if (!found) {
    throw new Error(`Visual artifact not found: ${visualRef}`);
  }

  return parseVisualArtifactJson(await readFile(resolve(status.root, found.path), "utf8"), found.path);
}

export function parseVisualArtifactJson(raw: string, sourcePath = "<visual-artifact>"): VisualArtifact {
  const parsed = parseJsonWithOptionalBom(raw) as Partial<VisualArtifact>;
  if (parsed.schemaVersion !== VISUAL_ARTIFACT_SCHEMA_VERSION) {
    throw new Error(`Unsupported visual artifact schema in ${sourcePath}: ${JSON.stringify(parsed.schemaVersion)}`);
  }
  if (!parsed.visualId || !/^vis_[a-f0-9]{16}$/u.test(parsed.visualId)) {
    throw new Error(`Invalid visual artifact id in ${sourcePath}.`);
  }
  return parsed as VisualArtifact;
}

export function renderVisualArtifactMarkdown(visual: Omit<VisualArtifact, "markdown">): string {
  const lines = [
    `# ${escapeMarkdownText(visual.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Visual | \`${visual.visualId}\` |`,
    `| Created | ${escapeMarkdownTable(visual.createdAt)} |`,
    `| Kind | \`${visual.kind}\` |`,
    `| Renderer | \`${visual.renderer.engine}\` |`,
    `| Payload | \`${visual.payload.format}\` |`,
    ...(visual.payload.rendererSource
      ? [
        `| Renderer source | \`${visual.payload.rendererSource.language}\` |`,
        `| Renderer source hash | \`${visual.payload.rendererSource.contentHash ?? "not recorded"}\` |`
      ]
      : []),
    `| Replay | \`${escapeMarkdownTable(visual.replayCommand)}\` |`,
    "",
    "## Source Refs",
    ""
  ];

  if (visual.sourceRefs.length === 0) {
    lines.push("- No source refs recorded.");
  } else {
    for (const ref of visual.sourceRefs) {
      lines.push(`- \`${ref.kind}:${escapeMarkdownText(ref.ref)}\`${ref.label ? ` - ${escapeMarkdownText(ref.label)}` : ""}`);
    }
  }

  lines.push("", "## Trust Boundary", "");
  for (const warning of visual.warnings) {
    lines.push(`- ${escapeMarkdownText(warning)}`);
  }

  if (visual.data) {
    lines.push("", "## Data Preview", "");
    lines.push(`Columns: ${visual.data.columns.map((column) => `\`${escapeMarkdownText(column)}\``).join(", ")}`);
    lines.push(`Rows: ${visual.data.rows.length}`);
  }

  return `${lines.join("\n")}\n`;
}

function summarizeVisualArtifact(visual: VisualArtifact, path: string): VisualArtifactSummary {
  return {
    visualId: visual.visualId,
    path,
    title: visual.title,
    kind: visual.kind,
    renderer: visual.renderer.engine,
    createdAt: visual.createdAt,
    sourceRefs: visual.sourceRefs,
    tags: visual.tags
  };
}

function normalizeRenderer(renderer: VisualArtifactRendererInfo): VisualArtifactRendererInfo {
  return {
    engine: renderer.engine,
    ...(normalizeOptionalText(renderer.engineVersion) ? { engineVersion: normalizeOptionalText(renderer.engineVersion) } : {}),
    ...(normalizeOptionalText(renderer.adapter) ? { adapter: normalizeOptionalText(renderer.adapter) } : {}),
    ...(normalizeOptionalText(renderer.adapterVersion) ? { adapterVersion: normalizeOptionalText(renderer.adapterVersion) } : {})
  };
}

function normalizePayload(payload: VisualArtifactPayload): VisualArtifactPayload {
  return {
    format: payload.format,
    content: payload.content,
    ...(normalizeOptionalText(payload.contentRef) ? { contentRef: normalizeOptionalText(payload.contentRef) } : {}),
    ...(payload.rendererSource ? { rendererSource: normalizeRendererSource(payload.rendererSource) } : {}),
    ...(typeof payload.width === "number" ? { width: Math.round(payload.width) } : {}),
    ...(typeof payload.height === "number" ? { height: Math.round(payload.height) } : {})
  };
}

function normalizeRendererSource(source: VisualArtifactRendererSource): VisualArtifactRendererSource {
  const language = source.language;
  const content = normalizeRequiredText(source.content, "renderer source content");
  return {
    language,
    content,
    ...(normalizeOptionalText(source.filename) ? { filename: normalizeOptionalText(source.filename) } : {}),
    contentHash: source.contentHash?.trim() || `sha256:${stableHash(content)}`
  };
}

function normalizeDataTable(data: VisualArtifactDataTable): VisualArtifactDataTable {
  return {
    columns: normalizeStringList(data.columns),
    rows: data.rows.map((row) => row.map((cell) => String(cell)))
  };
}

function normalizeSourceRefs(refs: VisualArtifactSourceRef[]): VisualArtifactSourceRef[] {
  return refs.map((ref) => ({
    kind: ref.kind,
    ref: normalizeRequiredText(ref.ref, "source ref"),
    ...(normalizeOptionalText(ref.label) ? { label: normalizeOptionalText(ref.label) } : {})
  }));
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.replace(/^#/u, "").trim().toLowerCase()).filter(Boolean))).sort();
}

function normalizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Visual artifact ${label} is required.`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function defaultReplayCommand(sourceRefs: VisualArtifactSourceRef[]): string {
  const first = sourceRefs[0];
  if (!first) {
    return "truth-harness visual show <visual-id>";
  }
  return `truth-harness visual create --source ${quoteCommandArg(`${first.kind}:${first.ref}`)} --write`;
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing visual artifacts.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function resolveUnderRoot(root: string, path: string): string {
  const resolved = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace root: ${path}`);
  }
  return resolved;
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/u.test(value) ? value : JSON.stringify(value);
}

function escapeMarkdownText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/`/gu, "\\`").replace(/\*/gu, "\\*").replace(/_/gu, "\\_");
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/gu, "\\|").replace(/\n/gu, " ");
}

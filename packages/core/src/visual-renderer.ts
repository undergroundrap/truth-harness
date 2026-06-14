import { spawnSync } from "node:child_process";
import { relative, resolve, sep } from "node:path";
import { listVisualArtifacts, readVisualArtifact, writeVisualArtifact, type VisualArtifact, type VisualArtifactWriteResult } from "./visual-artifact.js";

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30000;
const MAX_DOT_BYTES = 200_000;
const MAX_PLOTLY_JSON_BYTES = 400_000;
const MAX_SVG_BYTES = 1_500_000;

export interface VisualRendererCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: {
    name?: string;
    message: string;
  };
}

export type VisualRendererCommandRunner = (
  command: string,
  args: string[],
  stdin: string,
  timeoutMs: number
) => VisualRendererCommandResult;

export interface GraphvizVisualRenderInput {
  rootPath: string;
  visualRef: string;
  dotCommand?: string;
  timeoutMs?: number;
  title?: string;
  now?: string;
  runner?: VisualRendererCommandRunner;
}

export interface GraphvizVisualRenderResult extends VisualArtifactWriteResult {
  sourceVisual: VisualArtifact;
  sourceVisualRef: string;
  renderer: "graphviz";
}

export interface PlotlyVisualRenderInput {
  rootPath: string;
  visualRef: string;
  title?: string;
  now?: string;
}

export interface PlotlyVisualRenderResult extends VisualArtifactWriteResult {
  sourceVisual: VisualArtifact;
  sourceVisualRef: string;
  renderer: "plotly";
}

export async function renderGraphvizVisualArtifact(input: GraphvizVisualRenderInput): Promise<GraphvizVisualRenderResult> {
  const timeoutMs = normalizeTimeout(input.timeoutMs);
  const runner = input.runner ?? runRendererCommand;
  const source = await resolveVisualReference(input.rootPath, input.visualRef);
  const rendererSource = source.visual.payload.rendererSource;
  if (!rendererSource) {
    throw new Error(`Visual artifact ${source.visual.visualId} has no rendererSource to render.`);
  }
  if (rendererSource.language !== "dot") {
    throw new Error(`Graphviz render requires DOT renderer source, received ${rendererSource.language}.`);
  }

  const dotSource = rendererSource.content;
  assertSafeDotSource(dotSource);
  const command = input.dotCommand?.trim() || process.env.TRUTH_HARNESS_GRAPHVIZ_DOT?.trim() || "dot";
  const render = runner(command, ["-Tsvg"], dotSource, timeoutMs);
  if (render.error) {
    throw new Error(`Graphviz renderer unavailable: ${render.error.message}`);
  }
  if (render.status !== 0) {
    throw new Error(`Graphviz renderer failed with exit code ${String(render.status)}: ${singleLine(render.stderr || render.stdout || "no output")}`);
  }

  const svg = extractSafeSvg(render.stdout);
  const result = await writeVisualArtifact({
    rootPath: input.rootPath,
    title: input.title?.trim() || `${source.visual.title} - rendered SVG`,
    kind: source.visual.kind,
    renderer: {
      engine: "graphviz",
      adapter: "graphviz-dot-svg-renderer",
      adapterVersion: "0"
    },
    sourceRefs: [
      {
        kind: "visual",
        ref: source.path,
        label: `Source visual ${source.visual.visualId}`
      },
      ...source.visual.sourceRefs.slice(0, 8)
    ],
    replayCommand: `truth-harness visual render ${quoteArg(input.visualRef)} --engine graphviz --workspace ${quoteArg(input.rootPath)}`,
    payload: {
      format: "svg",
      content: svg,
      rendererSource: {
        language: "dot",
        content: dotSource,
        filename: rendererSource.filename ?? "truth-harness-graphviz-source.dot",
        contentHash: rendererSource.contentHash
      },
      width: source.visual.payload.width ?? 1200,
      height: source.visual.payload.height ?? 800
    },
    data: {
      columns: ["field", "value"],
      rows: [
        ["sourceVisual", source.visual.visualId],
        ["sourcePath", source.path],
        ["sourceRenderer", source.visual.renderer.engine],
        ["sourcePayload", source.visual.payload.format],
        ["rendererSource", rendererSource.contentHash ?? "not recorded"],
        ["command", command],
        ["timeoutMs", String(timeoutMs)],
        ["network", "none"]
      ]
    },
    tags: [...source.visual.tags, "rendered", "graphviz", "svg"],
    warnings: [
      "This SVG is renderer output from a saved DOT source and cannot upgrade source trust labels.",
      "Graphviz was called as a local subprocess with shell disabled; DOT source was screened for external references before rendering.",
      ...source.visual.warnings.slice(0, 6)
    ],
    now: input.now
  });

  return {
    ...result,
    sourceVisual: source.visual,
    sourceVisualRef: source.path,
    renderer: "graphviz"
  };
}

export async function renderPlotlyVisualArtifact(input: PlotlyVisualRenderInput): Promise<PlotlyVisualRenderResult> {
  const source = await resolveVisualReference(input.rootPath, input.visualRef);
  if (source.visual.payload.format !== "plotly-json") {
    throw new Error(`Plotly render requires plotly-json payload, received ${source.visual.payload.format}.`);
  }

  const rendererSource = source.visual.payload.rendererSource;
  const sourceJson = rendererSource?.language === "plotly-json" && rendererSource.content
    ? rendererSource.content
    : JSON.stringify(source.visual.payload.content, null, 2);
  if (Buffer.byteLength(sourceJson, "utf8") > MAX_PLOTLY_JSON_BYTES) {
    throw new Error(`Plotly renderer source is too large. Maximum is ${MAX_PLOTLY_JSON_BYTES} bytes.`);
  }

  const plotSpec = parsePlotlySpec(sourceJson);
  const plotModel = normalizePlotlyBarModel(plotSpec, {
    fallbackTitle: source.visual.title,
    width: source.visual.payload.width,
    height: source.visual.payload.height
  });
  const svg = renderPlotlyBarSvg(plotModel);
  const result = await writeVisualArtifact({
    rootPath: input.rootPath,
    title: input.title?.trim() || `${source.visual.title} - rendered SVG`,
    kind: source.visual.kind,
    renderer: {
      engine: "truth-harness-native",
      adapter: "plotly-json-svg-renderer",
      adapterVersion: "0"
    },
    sourceRefs: [
      {
        kind: "visual",
        ref: source.path,
        label: `Source visual ${source.visual.visualId}`
      },
      ...source.visual.sourceRefs.slice(0, 8)
    ],
    replayCommand: `truth-harness visual render ${quoteArg(input.visualRef)} --engine plotly --workspace ${quoteArg(input.rootPath)}`,
    payload: {
      format: "svg",
      content: svg,
      rendererSource: {
        language: "plotly-json",
        content: sourceJson,
        filename: rendererSource?.filename ?? "truth-harness-plotly-source.plotly.json",
        contentHash: rendererSource?.contentHash
      },
      width: plotModel.width,
      height: plotModel.height
    },
    data: {
      columns: ["label", "value", "text", "color"],
      rows: plotModel.rows.map((row) => [row.label, String(row.value), row.text, row.color])
    },
    tags: [...source.visual.tags, "rendered", "plotly-json", "svg"],
    warnings: [
      "This SVG is deterministic renderer output from saved Plotly JSON and cannot upgrade source trust labels.",
      "Truth Harness rendered a constrained local subset of Plotly bar-chart JSON; the saved Plotly JSON remains the authoritative renderer source.",
      ...source.visual.warnings.slice(0, 6)
    ],
    now: input.now
  });

  return {
    ...result,
    sourceVisual: source.visual,
    sourceVisualRef: source.path,
    renderer: "plotly"
  };
}

async function resolveVisualReference(rootPath: string, visualRef: string): Promise<{ visual: VisualArtifact; path: string }> {
  const visual = await readVisualArtifact(rootPath, visualRef);
  const summaries = await listVisualArtifacts(rootPath);
  const root = resolve(rootPath);
  const directPath = visualRef.endsWith(".json") ? toPortablePath(relative(root, resolveUnderRoot(root, visualRef))) : undefined;
  const found = summaries.find(
    (summary) => summary.visualId === visual.visualId || summary.path === visualRef || summary.path === directPath
  );

  return {
    visual,
    path: found?.path ?? directPath ?? visual.visualId
  };
}

interface PlotlyBarRenderModel {
  title: string;
  axisTitle: string;
  rows: Array<{
    label: string;
    value: number;
    text: string;
    color: string;
  }>;
  width: number;
  height: number;
}

function parsePlotlySpec(sourceJson: string): unknown {
  try {
    return JSON.parse(sourceJson) as unknown;
  } catch (error) {
    throw new Error(`Plotly renderer source is not valid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
  }
}

function renderPlotlyBarSvg(model: PlotlyBarRenderModel): string {
  const width = model.width;
  const rowHeight = 58;
  const top = 150;
  const left = 238;
  const right = 88;
  const bottom = 82;
  const height = Math.max(model.height, top + model.rows.length * rowHeight + bottom);
  const plotWidth = width - left - right;
  const maxValue = Math.max(1, ...model.rows.map((row) => Math.abs(row.value)));
  const ticks = [0, maxValue / 2, maxValue];
  const bars = model.rows.map((row, index) => {
    const y = top + index * rowHeight;
    const fillWidth = Math.max(6, (Math.abs(row.value) / maxValue) * plotWidth);
    const textX = Math.min(left + fillWidth + 14, width - right - 118);
    return `<g>
      <text x="${left - 18}" y="${y + 21}" text-anchor="end" fill="#dfd8cb" font-size="14" font-weight="720">${escapeXml(truncateText(row.label, 30))}</text>
      <rect x="${left}" y="${y}" width="${plotWidth}" height="30" rx="8" fill="#151515" stroke="#2e2e2d" />
      <rect x="${left}" y="${y}" width="${fillWidth}" height="30" rx="8" fill="${safeSvgColor(row.color)}" opacity="0.82" />
      <text x="${textX}" y="${y + 20}" fill="#f2f2ee" font-size="13" font-weight="750">${escapeXml(truncateText(row.text, 26))}</text>
    </g>`;
  }).join("");
  const tickSvg = ticks.map((tick) => {
    const x = left + (tick / maxValue) * plotWidth;
    const label = formatDecimal(tick);
    return `<g>
      <line x1="${x}" y1="${top - 22}" x2="${x}" y2="${top + model.rows.length * rowHeight - 22}" stroke="#272522" />
      <text x="${x}" y="${height - 36}" text-anchor="middle" fill="#9d968d" font-size="12">${escapeXml(label)}</text>
    </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Rendered Plotly visual artifact">
    <rect width="${width}" height="${height}" rx="16" fill="#101010" />
    <text x="56" y="58" fill="#f2f2ee" font-size="24" font-weight="780">${escapeXml(truncateText(model.title, 68))}</text>
    <text x="56" y="88" fill="#aaa59d" font-size="13">rendered locally from saved Plotly JSON; source receipt remains authoritative</text>
    <line x1="${left}" y1="${top - 22}" x2="${width - right}" y2="${top - 22}" stroke="#403d38" />
    ${tickSvg}
    ${bars}
    <text x="${left}" y="${height - 12}" fill="#aaa59d" font-size="13">${escapeXml(model.axisTitle)}</text>
  </svg>`;
}

function normalizePlotlyBarModel(value: unknown, options: { fallbackTitle: string; width?: number; height?: number }): PlotlyBarRenderModel {
  const spec = isRecord(value) ? value : {};
  const data = Array.isArray(spec.data) ? spec.data : [];
  const trace = data.find((item) => isRecord(item) && item.type === "bar") ?? data.find(isRecord);
  if (!isRecord(trace)) {
    throw new Error("Plotly render requires at least one bar trace.");
  }

  const values = numericArray(trace.x);
  const labels = stringArray(trace.y);
  const texts = stringArray(trace.text);
  const colors = stringArray(isRecord(trace.marker) ? trace.marker.color : undefined);
  const rows = values.map((number, index) => ({
    label: labels[index] ?? `value ${index + 1}`,
    value: number,
    text: texts[index] ?? formatDecimal(number),
    color: colors[index] ?? (index === values.length - 1 ? "#70d6a1" : "#b8ad92")
  })).slice(0, 80);
  if (rows.length === 0) {
    throw new Error("Plotly render found no numeric x values to render.");
  }

  const layout = isRecord(spec.layout) ? spec.layout : {};
  const title = stringFromPlotlyValue(layout.title) ?? options.fallbackTitle;
  const xaxis = isRecord(layout.xaxis) ? layout.xaxis : {};
  const axisTitle = stringFromPlotlyValue(xaxis.title) ?? "decimal value";
  return {
    title,
    axisTitle,
    rows,
    width: clampImageDimension(options.width, 960),
    height: clampImageDimension(options.height, 540)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numericArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function stringFromPlotlyValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (isRecord(value) && typeof value.text === "string") {
    return value.text;
  }
  return undefined;
}

function clampImageDimension(value: number | undefined, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(320, Math.min(2400, Math.round(number)));
}

function safeSvgColor(value: string): string {
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/iu.test(value) ? value : "#b8ad92";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatDecimal(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(6).replace(/0+$/u, "").replace(/\.$/u, "");
}

function assertSafeDotSource(source: string): void {
  if (Buffer.byteLength(source, "utf8") > MAX_DOT_BYTES) {
    throw new Error(`DOT renderer source is too large. Maximum is ${MAX_DOT_BYTES} bytes.`);
  }
  if (!/^\s*(?:(?:\/\/|#)[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*(?:strict\s+)?(?:di)?graph\b/iu.test(source)) {
    throw new Error("DOT renderer source must start with a graph or digraph declaration.");
  }

  const rejected = [
    /\b(?:image|imagepath|shapefile|href|url|target)\s*=/iu,
    /<\s*(?:img|script|iframe|object|embed|foreignObject)\b/iu,
    /\b(?:javascript|data|file|https?|ftp):/iu,
    /@import/iu
  ];
  if (rejected.some((pattern) => pattern.test(source))) {
    throw new Error("DOT renderer source contains external references or active content that Truth Harness will not render.");
  }
}

function extractSafeSvg(stdout: string): string {
  if (Buffer.byteLength(stdout, "utf8") > MAX_SVG_BYTES) {
    throw new Error(`Graphviz SVG output is too large. Maximum is ${MAX_SVG_BYTES} bytes.`);
  }

  const start = stdout.indexOf("<svg");
  const end = stdout.lastIndexOf("</svg>");
  if (start < 0 || end < start) {
    throw new Error("Graphviz did not return SVG output.");
  }

  const svg = stdout.slice(start, end + "</svg>".length).trim();
  const rejected = [
    /<\s*(?:script|iframe|object|embed|foreignObject)\b/iu,
    /<\s*a\b/iu,
    /\son[a-z]+\s*=/iu,
    /\b(?:href|src|xlink:href)\s*=\s*["']\s*(?:javascript|data|file|https?|ftp):/iu,
    /<\s*image\b/iu
  ];
  if (rejected.some((pattern) => pattern.test(svg))) {
    throw new Error("Graphviz SVG output contains external references or active content that Truth Harness will not save.");
  }

  return svg;
}

function runRendererCommand(command: string, args: string[], stdin: string, timeoutMs: number): VisualRendererCommandResult {
  const result = spawnSync(command, args, {
    input: stdin,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: MAX_SVG_BYTES,
    shell: false
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error ? { error: { name: result.error.name, message: result.error.message } } : {})
  };
}

function normalizeTimeout(value: number | undefined): number {
  const timeoutMs = value ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Graphviz render timeout must be a positive integer, received ${String(value)}.`);
  }
  if (timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`Graphviz render timeout may not exceed ${MAX_TIMEOUT_MS}ms.`);
  }

  return timeoutMs;
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace root: ${path}`);
  }

  return target;
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function quoteArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/u.test(value) ? value : JSON.stringify(value);
}

function singleLine(value: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length <= 240 ? normalized : `${normalized.slice(0, 237)}...`;
}

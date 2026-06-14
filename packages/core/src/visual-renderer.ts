import { spawnSync } from "node:child_process";
import { relative, resolve, sep } from "node:path";
import { listVisualArtifacts, readVisualArtifact, writeVisualArtifact, type VisualArtifact, type VisualArtifactWriteResult } from "./visual-artifact.js";

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30000;
const MAX_DOT_BYTES = 200_000;
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

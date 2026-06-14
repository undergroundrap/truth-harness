import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { createReceipt } from "./receipt.js";
import { parseReceiptJson } from "./receipt-validation.js";
import { createWorkspaceGraph, type WorkspaceGraph, type WorkspaceGraphNode } from "./workspace-graph.js";
import {
  writeVisualArtifact,
  type VisualArtifactRenderer,
  type VisualArtifactWriteResult
} from "./visual-artifact.js";

export type GraphVisualRenderer = "mermaid" | "graphviz";
export type PlotVisualRenderer = "plotly" | "matplotlib" | "sage";

export interface WorkspaceGraphVisualInput {
  rootPath: string;
  renderer: GraphVisualRenderer;
  title?: string;
  maxNodes?: number;
  now?: string;
}

export interface ReceiptPlotVisualInput {
  rootPath: string;
  receiptPath?: string;
  problem?: string;
  renderer: PlotVisualRenderer;
  title?: string;
  now?: string;
}

export interface ResearchCanvasVisualInput {
  rootPath: string;
  title?: string;
  now?: string;
  maxNodes?: number;
}

const DEFAULT_MAX_GRAPH_NODES = 80;

export async function writeWorkspaceGraphVisualArtifact(
  input: WorkspaceGraphVisualInput
): Promise<VisualArtifactWriteResult> {
  const graph = await createWorkspaceGraph({ rootPath: input.rootPath, now: input.now });
  const maxNodes = Math.max(1, Math.floor(input.maxNodes ?? DEFAULT_MAX_GRAPH_NODES));
  const selected = graph.nodes.slice(0, maxNodes);
  const selectedIds = new Set(selected.map((node) => node.nodeId));
  const edges = graph.edges.filter((edge) => selectedIds.has(edge.from) && selectedIds.has(edge.to));
  const source = input.renderer === "mermaid" ? workspaceGraphToMermaid(selected, edges) : workspaceGraphToDot(selected, edges);

  return writeVisualArtifact({
    rootPath: input.rootPath,
    title: input.title?.trim() || `Workspace ${input.renderer} lineage graph`,
    kind: "lineage-graph",
    renderer: rendererInfo(input.renderer, "workspace-graph-adapter"),
    sourceRefs: [
      {
        kind: "workspace-graph",
        ref: ".",
        label: "Live workspace graph"
      }
    ],
    replayCommand: `truth-harness visual graph --renderer ${input.renderer} --workspace ${quoteArg(input.rootPath)}`,
    payload: {
      format: "graph-json",
      rendererSource: {
        language: input.renderer === "mermaid" ? "mermaid" : "dot",
        content: source,
        filename: input.renderer === "mermaid" ? "workspace-lineage.mmd" : "workspace-lineage.dot"
      },
      content: {
        schemaVersion: "truth-harness.visual.graph-adapter.v0",
        language: input.renderer === "mermaid" ? "mermaid" : "dot",
        source,
        graph: {
          nodes: selected,
          edges
        },
        truncated: graph.nodes.length > selected.length
      }
    },
    data: {
      columns: ["metric", "value"],
      rows: [
        ["nodes", String(selected.length)],
        ["edges", String(edges.length)],
        ["missingRefs", String(graph.summary.missingRefs)],
        ["validationPassed", String(graph.validation.passed)]
      ]
    },
    tags: ["workspace-graph", "lineage", input.renderer],
    warnings: [
      "This visual is generated from the workspace graph. It maps provenance and missing refs; it does not prove claims.",
      graph.nodes.length > selected.length
        ? `Graph was truncated from ${graph.nodes.length} to ${selected.length} nodes for readability.`
        : "Graph was not truncated."
    ],
    now: input.now
  });
}

export async function writeReceiptPlotVisualArtifact(input: ReceiptPlotVisualInput): Promise<VisualArtifactWriteResult> {
  const { receipt, receiptRef } = await loadReceiptForPlot(input);
  const points = receiptToPlotPoints(receipt);
  const plotSpec = {
    schemaVersion: "truth-harness.visual.plotly-adapter.v0",
    data: [
      {
        type: "bar",
        orientation: "h",
        x: points.map((point) => point.decimal),
        y: points.map((point) => point.label),
        text: points.map((point) => point.exact),
        marker: {
          color: points.map((point) => (point.role === "verified-output" ? "#70d6a1" : "#b8ad92"))
        }
      }
    ],
    layout: {
      title: receipt.problem,
      paper_bgcolor: "#0f0f0f",
      plot_bgcolor: "#0f0f0f",
      font: { color: "#f5f2ea" },
      xaxis: { title: "decimal value" },
      yaxis: { automargin: true },
      margin: { l: 120, r: 24, t: 52, b: 52 }
    },
    config: {
      displayModeBar: false,
      responsive: true
    }
  };
  const rendererSource = receiptPlotRendererSource(input.renderer, receipt.problem, points, plotSpec);

  return writeVisualArtifact({
    rootPath: input.rootPath,
    title: input.title?.trim() || `Plot for ${receipt.problem}`,
    kind: "plot",
    renderer: rendererInfo(input.renderer, "receipt-plot-adapter"),
    sourceRefs: [
      {
        kind: "receipt",
        ref: receiptRef,
        label: `Receipt ${receipt.runId}`
      }
    ],
    replayCommand: receiptRef.startsWith("prompt:")
      ? `truth-harness visual plot --problem ${quoteArg(receipt.problem)} --renderer ${input.renderer} --workspace ${quoteArg(input.rootPath)}`
      : `truth-harness visual plot ${quoteArg(receiptRef)} --renderer ${input.renderer} --workspace ${quoteArg(input.rootPath)}`,
    payload: {
      format: "plotly-json",
      rendererSource,
      content: plotSpec,
      width: 960,
      height: 540
    },
    data: {
      columns: ["label", "role", "exact", "decimal"],
      rows: points.map((point) => [point.label, point.role, point.exact, String(point.decimal)])
    },
    tags: ["plot", input.renderer, receipt.evidenceProfile.kind, receipt.trust],
    warnings: [
      "This plot is generated from receipt data and cannot upgrade the receipt trust label.",
      input.renderer === "plotly"
        ? "The payload is a Plotly JSON spec, not a screenshot."
        : `The payload is renderer-ready plot data for ${input.renderer}; no external plotting process was executed.`
    ],
    now: input.now
  });
}

export async function writeResearchCanvasVisualArtifact(
  input: ResearchCanvasVisualInput
): Promise<VisualArtifactWriteResult> {
  const graph = await createWorkspaceGraph({ rootPath: input.rootPath, now: input.now });
  const maxNodes = Math.max(1, Math.floor(input.maxNodes ?? 36));
  const nodes = graph.nodes.slice(0, maxNodes);
  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  const edges = graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const shapes = workspaceGraphToCanvasShapes(nodes, edges);
  const canvasSource = {
    schemaVersion: "truth-harness.visual.canvas-adapter.v0",
    format: "tldraw-like-json",
    shapes,
    notes: [
      "This is an editable canvas seed generated from the local evidence graph.",
      "Canvas edits should be saved as visual artifacts; source receipts remain authoritative."
    ]
  };

  return writeVisualArtifact({
    rootPath: input.rootPath,
    title: input.title?.trim() || "Research canvas from workspace graph",
    kind: "mind-map",
    renderer: rendererInfo("tldraw", "research-canvas-adapter"),
    sourceRefs: [
      {
        kind: "workspace-graph",
        ref: ".",
        label: "Live workspace graph"
      }
    ],
    replayCommand: `truth-harness visual canvas --workspace ${quoteArg(input.rootPath)}`,
    payload: {
      format: "canvas-json",
      rendererSource: {
        language: "tldraw-json",
        content: JSON.stringify(canvasSource, null, 2),
        filename: "research-canvas.tldraw.json"
      },
      content: canvasSource
    },
    data: {
      columns: ["metric", "value"],
      rows: [
        ["shapes", String(shapes.length)],
        ["sourceNodes", String(nodes.length)],
        ["sourceEdges", String(edges.length)]
      ]
    },
    tags: ["research-canvas", "mind-map", "tldraw"],
    warnings: [
      "This editable canvas is a planning and inspection surface, not proof.",
      graph.nodes.length > nodes.length ? `Canvas seed was truncated from ${graph.nodes.length} to ${nodes.length} source nodes.` : "Canvas seed was not truncated."
    ],
    now: input.now
  });
}

function rendererInfo(engine: VisualArtifactRenderer, adapter: string) {
  return {
    engine,
    adapter,
    adapterVersion: "0"
  };
}

function workspaceGraphToMermaid(nodes: WorkspaceGraphNode[], edges: WorkspaceGraph["edges"]): string {
  const lines = ["flowchart LR"];
  for (const node of nodes) {
    lines.push(`  ${mermaidId(node.nodeId)}["${escapeMermaid(node.label)}"]`);
  }
  for (const edge of edges) {
    lines.push(`  ${mermaidId(edge.from)} -->|"${escapeMermaid(edge.kind)}"| ${mermaidId(edge.to)}`);
  }
  return lines.join("\n");
}

function workspaceGraphToDot(nodes: WorkspaceGraphNode[], edges: WorkspaceGraph["edges"]): string {
  const lines = ["digraph TruthHarnessWorkspace {", "  rankdir=LR;", "  node [shape=box, style=\"rounded,filled\", fillcolor=\"#111111\", fontcolor=\"#f5f2ea\", color=\"#3a3630\"];"];
  for (const node of nodes) {
    const color = node.missing ? "#ff8b7e" : node.valid ? "#70d6a1" : "#e2c766";
    lines.push(`  "${escapeDot(node.nodeId)}" [label="${escapeDot(node.label)}", color="${color}"];`);
  }
  for (const edge of edges) {
    lines.push(`  "${escapeDot(edge.from)}" -> "${escapeDot(edge.to)}" [label="${escapeDot(edge.kind)}"];`);
  }
  lines.push("}");
  return lines.join("\n");
}

function workspaceGraphToCanvasShapes(nodes: WorkspaceGraphNode[], edges: WorkspaceGraph["edges"]): Array<Record<string, unknown>> {
  const positions = new Map<string, { x: number; y: number }>();
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  nodes.forEach((node, index) => {
    positions.set(node.nodeId, {
      x: 80 + (index % columns) * 300,
      y: 80 + Math.floor(index / columns) * 180
    });
  });

  return [
    ...nodes.map((node) => {
      const position = positions.get(node.nodeId) ?? { x: 80, y: 80 };
      return {
        id: `shape:${node.nodeId}`,
        type: "note",
        x: position.x,
        y: position.y,
        width: 240,
        height: 110,
        props: {
          title: node.kind,
          text: node.label,
          status: node.missing ? "missing" : node.valid ? "valid" : "invalid",
          sourcePath: node.path,
          trust: node.trust
        }
      };
    }),
    ...edges.map((edge) => ({
      id: `edge:${edge.edgeId}`,
      type: "connector",
      from: `shape:${edge.from}`,
      to: `shape:${edge.to}`,
      props: {
        label: edge.kind,
        resolved: edge.resolved,
        sourcePath: edge.sourcePath
      }
    }))
  ];
}

async function loadReceiptForPlot(input: ReceiptPlotVisualInput) {
  if (input.receiptPath) {
    const root = resolve(input.rootPath);
    const receiptPath = resolveUnderRoot(root, input.receiptPath);
    return {
      receipt: parseReceiptJson(await readFile(receiptPath, "utf8")),
      receiptRef: toPortablePath(relative(root, receiptPath))
    };
  }

  if (!input.problem?.trim()) {
    throw new Error("visual plot requires a receipt path or --problem text.");
  }

  return {
    receipt: createReceipt(input.problem),
    receiptRef: `prompt:${input.problem.trim()}`
  };
}

function receiptToPlotPoints(receipt: ReturnType<typeof createReceipt>) {
  const values = new Map<string, { label: string; role: string; exact: string; decimal: number }>();
  for (const output of receipt.evidenceProfile.outputs) {
    const value = parseRationalFromText(output);
    if (value) {
      values.set(`${output}:${value.exact}`, {
        label: output.includes("=") ? output.split("=")[0] || output : "output",
        role: output.includes("traceSteps=") ? "trace-metadata" : "verified-output",
        exact: value.exact,
        decimal: value.decimal
      });
    }
  }

  for (const artifact of receipt.artifacts) {
    if (artifact.kind !== "exact-arithmetic-trace") {
      continue;
    }
    try {
      const trace = JSON.parse(artifact.content) as {
        steps?: Array<{ id?: string; result?: string; operation?: string }>;
      };
      for (const step of trace.steps ?? []) {
        if (!step.result) {
          continue;
        }
        const value = parseRationalFromText(step.result);
        if (!value) {
          continue;
        }
        values.set(`${step.id ?? "step"}:${value.exact}`, {
          label: `${step.id ?? "step"} ${step.operation ?? ""}`.trim(),
          role: "trace-step",
          exact: value.exact,
          decimal: value.decimal
        });
      }
    } catch {
      // Ignore malformed trace content; receipt validation remains authoritative elsewhere.
    }
  }

  if (values.size === 0) {
    values.set("trust", {
      label: receipt.trust,
      role: "receipt-trust",
      exact: "1",
      decimal: 1
    });
  }

  return [...values.values()].slice(0, 24);
}

function receiptPlotRendererSource(
  renderer: PlotVisualRenderer,
  problem: string,
  points: Array<{ label: string; role: string; exact: string; decimal: number }>,
  plotSpec: unknown
) {
  if (renderer === "plotly") {
    return {
      language: "plotly-json" as const,
      content: JSON.stringify(plotSpec, null, 2),
      filename: "receipt-plot.plotly.json"
    };
  }

  const labels = points.map((point) => point.label);
  const values = points.map((point) => point.decimal);
  const exact = points.map((point) => point.exact);
  const colors = points.map((point) => (point.role === "verified-output" ? "#70d6a1" : "#b8ad92"));
  if (renderer === "matplotlib") {
    return {
      language: "python" as const,
      content: [
        "# Generated locally by Truth Harness. Source receipts remain authoritative.",
        "import matplotlib.pyplot as plt",
        "",
        `title = ${JSON.stringify(problem)}`,
        `labels = ${JSON.stringify(labels)}`,
        `values = ${JSON.stringify(values)}`,
        `exact = ${JSON.stringify(exact)}`,
        `colors = ${JSON.stringify(colors)}`,
        "",
        "fig, ax = plt.subplots(figsize=(9.6, 5.4), facecolor='#0f0f0f')",
        "ax.set_facecolor('#0f0f0f')",
        "bars = ax.barh(labels, values, color=colors)",
        "ax.set_title(title, color='#f5f2ea')",
        "ax.set_xlabel('decimal value', color='#d8d2c8')",
        "ax.tick_params(colors='#d8d2c8')",
        "for bar, label in zip(bars, exact):",
        "    ax.text(bar.get_width(), bar.get_y() + bar.get_height() / 2, f' {label}', va='center', color='#f5f2ea')",
        "fig.tight_layout()",
        "fig.savefig('truth-harness-plot.svg', format='svg')"
      ].join("\n"),
      filename: "receipt-plot.matplotlib.py"
    };
  }

  return {
    language: "python" as const,
    content: [
      "# Generated locally by Truth Harness for SageMath. Source receipts remain authoritative.",
      "from sage.all import bar_chart",
      "",
      `title = ${JSON.stringify(problem)}`,
      `labels = ${JSON.stringify(labels)}`,
      `values = ${JSON.stringify(values)}`,
      `exact = ${JSON.stringify(exact)}`,
      "",
      "chart = bar_chart(values, color='#70d6a1')",
      "chart.set_legend_options(back_color='#0f0f0f')",
      "chart.axes_labels(['index', 'decimal value'])",
      "chart.save('truth-harness-sage-plot.svg')",
      "print({'title': title, 'labels': labels, 'exact': exact, 'values': values})"
    ].join("\n"),
    filename: "receipt-plot.sage.py"
  };
}

function parseRationalFromText(text: string): { exact: string; decimal: number } | undefined {
  const match = text.match(/-?\d+(?:\s*\/\s*-?\d+)?/u);
  if (!match) {
    return undefined;
  }
  const exact = match[0].replace(/\s+/gu, "");
  const [left, right] = exact.split("/");
  const numerator = Number(left);
  const denominator = right === undefined ? 1 : Number(right);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return undefined;
  }

  return {
    exact,
    decimal: numerator / denominator
  };
}

function mermaidId(value: string): string {
  return `n_${value.replace(/[^A-Za-z0-9_]/gu, "_")}`;
}

function escapeMermaid(value: string): string {
  return value.replace(/"/gu, "'").replace(/\n/gu, " ").slice(0, 120);
}

function escapeDot(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/"/gu, "\\\"").replace(/\n/gu, " ").slice(0, 160);
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

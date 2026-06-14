import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { createReceipt } from "./receipt.js";
import { listVisualArtifacts, readVisualArtifact } from "./visual-artifact.js";
import {
  writeReceiptPlotVisualArtifact,
  writeResearchCanvasVisualArtifact,
  writeWorkspaceGraphVisualArtifact
} from "./visual-adapters.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("visual adapters", () => {
  it("writes renderer-ready graph, plot, and canvas visual artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Visual Adapter Lab" });
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    const receiptPath = join(root, ".truth-harness", "receipts", "fraction.json");
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    const graph = await writeWorkspaceGraphVisualArtifact({
      rootPath: root,
      renderer: "mermaid",
      now: "2026-06-14T00:00:00.000Z"
    });
    const plot = await writeReceiptPlotVisualArtifact({
      rootPath: root,
      receiptPath: ".truth-harness/receipts/fraction.json",
      renderer: "plotly",
      now: "2026-06-14T00:00:01.000Z"
    });
    const canvas = await writeResearchCanvasVisualArtifact({
      rootPath: root,
      now: "2026-06-14T00:00:02.000Z"
    });
    const visuals = await listVisualArtifacts(root);
    const graphVisual = await readVisualArtifact(root, graph.visual.visualId);
    const plotVisual = await readVisualArtifact(root, plot.visual.visualId);
    const canvasVisual = await readVisualArtifact(root, canvas.visual.visualId);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(graphVisual.kind).toBe("lineage-graph");
    expect(graphVisual.renderer.engine).toBe("mermaid");
    expect(graphVisual.payload.format).toBe("graph-json");
    expect(graphVisual.payload.rendererSource).toMatchObject({
      language: "mermaid",
      filename: "workspace-lineage.mmd"
    });
    expect(graphVisual.payload.rendererSource?.content).toContain("flowchart LR");
    expect(graphVisual.payload.rendererSource?.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(JSON.stringify(graphVisual.payload.content)).toContain("flowchart LR");
    expect(plotVisual.kind).toBe("plot");
    expect(plotVisual.renderer.engine).toBe("plotly");
    expect(plotVisual.payload.format).toBe("plotly-json");
    expect(plotVisual.payload.rendererSource).toMatchObject({
      language: "plotly-json",
      filename: "receipt-plot.plotly.json"
    });
    expect(plotVisual.data?.rows.some((row) => row.includes("11/8"))).toBe(true);
    expect(canvasVisual.kind).toBe("mind-map");
    expect(canvasVisual.renderer.engine).toBe("tldraw");
    expect(canvasVisual.payload.format).toBe("canvas-json");
    expect(canvasVisual.payload.rendererSource).toMatchObject({
      language: "tldraw-json",
      filename: "research-canvas.tldraw.json"
    });
    expect(visuals).toHaveLength(3);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.visuals).toBe(3);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-visual-adapters-"));
  roots.push(root);
  return root;
}

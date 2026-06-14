import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { createReceipt } from "./receipt.js";
import { writeVisualArtifact } from "./visual-artifact.js";
import { writeWorkspaceGraphVisualArtifact } from "./visual-adapters.js";
import { renderGraphvizVisualArtifact, type VisualRendererCommandRunner } from "./visual-renderer.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("visual renderer", () => {
  it("renders a DOT visual source into a replayable SVG artifact", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Graphviz Render Lab" });
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    await writeFile(join(root, ".truth-harness", "receipts", "fraction.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    const source = await writeWorkspaceGraphVisualArtifact({
      rootPath: root,
      renderer: "graphviz",
      now: "2026-06-14T01:00:00.000Z"
    });
    const calls: Array<{ command: string; args: string[]; stdin: string; timeoutMs: number }> = [];
    const runner: VisualRendererCommandRunner = (command, args, stdin, timeoutMs) => {
      calls.push({ command, args, stdin, timeoutMs });
      return {
        status: 0,
        stdout: [
          "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>",
          "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"80\" viewBox=\"0 0 120 80\">",
          "<title>Truth Harness graph</title>",
          "<rect x=\"10\" y=\"10\" width=\"100\" height=\"60\" fill=\"#111111\" stroke=\"#70d6a1\"/>",
          "</svg>"
        ].join("\n"),
        stderr: ""
      };
    };

    const rendered = await renderGraphvizVisualArtifact({
      rootPath: root,
      visualRef: source.visual.visualId,
      dotCommand: "dot-test",
      timeoutMs: 1234,
      runner,
      now: "2026-06-14T01:00:01.000Z"
    });
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(calls).toEqual([
      {
        command: "dot-test",
        args: ["-Tsvg"],
        stdin: expect.stringContaining("digraph TruthHarnessWorkspace") as unknown as string,
        timeoutMs: 1234
      }
    ]);
    expect(rendered.sourceVisual.visualId).toBe(source.visual.visualId);
    expect(rendered.visual.renderer.engine).toBe("graphviz");
    expect(rendered.visual.payload.format).toBe("svg");
    expect(rendered.visual.payload.content).toContain("<svg");
    expect(String(rendered.visual.payload.content)).not.toContain("<?xml");
    expect(rendered.visual.sourceRefs[0]).toMatchObject({
      kind: "visual",
      ref: expect.stringContaining(source.visual.visualId)
    });
    expect(rendered.visual.payload.rendererSource).toMatchObject({
      language: "dot",
      contentHash: source.visual.payload.rendererSource?.contentHash
    });
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.visuals).toBe(2);
  });

  it("rejects DOT sources with external references before invoking Graphviz", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Unsafe Graphviz Lab" });
    const source = await writeVisualArtifact({
      rootPath: root,
      title: "Unsafe DOT source",
      kind: "lineage-graph",
      renderer: {
        engine: "graphviz",
        adapter: "test"
      },
      sourceRefs: [{ kind: "manual", ref: "unsafe-test" }],
      replayCommand: "truth-harness visual show <visual-id>",
      payload: {
        format: "graph-json",
        content: { nodes: [], edges: [] },
        rendererSource: {
          language: "dot",
          content: "digraph G { a [image=\"https://example.invalid/pixel.png\"]; }",
          filename: "unsafe.dot"
        }
      }
    });
    let invoked = false;
    const runner: VisualRendererCommandRunner = () => {
      invoked = true;
      return { status: 0, stdout: "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", stderr: "" };
    };

    await expect(
      renderGraphvizVisualArtifact({
        rootPath: root,
        visualRef: source.visual.visualId,
        runner
      })
    ).rejects.toThrow(/external references/u);
    expect(invoked).toBe(false);
  });

  it("requires DOT renderer source for Graphviz rendering", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Mermaid Render Lab" });
    const source = await writeWorkspaceGraphVisualArtifact({
      rootPath: root,
      renderer: "mermaid",
      now: "2026-06-14T01:00:00.000Z"
    });

    await expect(
      renderGraphvizVisualArtifact({
        rootPath: root,
        visualRef: source.visual.visualId,
        runner: () => ({ status: 0, stdout: "", stderr: "" })
      })
    ).rejects.toThrow(/requires DOT/u);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-visual-renderer-"));
  roots.push(root);
  return root;
}

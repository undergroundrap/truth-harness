import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  createVisualArtifact,
  listVisualArtifacts,
  parseVisualArtifactJson,
  readVisualArtifact,
  writeVisualArtifact
} from "./visual-artifact.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("visual artifacts", () => {
  it("requires a local workspace before creating a visual artifact", async () => {
    const root = await tempRoot();

    await expect(
      createVisualArtifact({
        rootPath: root,
        title: "Orphan plot",
        kind: "plot",
        renderer: { engine: "truth-harness-native" },
        payload: {
          format: "svg",
          content: "<svg />"
        }
      })
    ).rejects.toThrow("No Truth Harness workspace found");
  });

  it("writes local JSON and Markdown with an explicit trust boundary", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Visual Lab",
      now: "2026-06-14T00:00:00.000Z"
    });

    const result = await writeVisualArtifact({
      rootPath: root,
      title: "Exact rational number-line",
      kind: "plot",
      renderer: {
        engine: "plotly",
        adapter: "truth-harness-plotly-adapter"
      },
      sourceRefs: [
        {
          kind: "manual",
          ref: "seed-visual-test",
          label: "Unit-test source"
        }
      ],
      replayCommand: "truth-harness visual show <visual-id>",
      payload: {
        format: "plotly-json",
        rendererSource: {
          language: "plotly-json",
          content: JSON.stringify({ data: [{ x: [0.75, 0.625, 1.375], y: [1, 1, 1], type: "scatter" }] }, null, 2),
          filename: "exact-rational-number-line.plotly.json"
        },
        content: {
          data: [{ x: [0.75, 0.625, 1.375], y: [1, 1, 1], type: "scatter" }],
          layout: { title: "3/4 + 5/8" }
        },
        width: 900,
        height: 520
      },
      data: {
        columns: ["role", "exact", "decimal"],
        rows: [
          ["plotted-fraction", "3/4", "0.75"],
          ["plotted-fraction", "5/8", "0.625"],
          ["verified-output", "11/8", "1.375"]
        ]
      },
      tags: ["#math", "visuals", "Math"],
      now: "2026-06-14T01:00:00.000Z"
    });

    const listed = await listVisualArtifacts(root);
    const readBack = await readVisualArtifact(root, result.visual.visualId);
    const markdown = await readFile(result.markdownPath, "utf8");
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(result.visual.schemaVersion).toBe("truth-harness.visual-artifact.v0");
    expect(result.visual.visualId).toMatch(/^vis_[a-f0-9]{16}$/u);
    expect(result.visual.payload.rendererSource).toMatchObject({
      language: "plotly-json",
      filename: "exact-rational-number-line.plotly.json"
    });
    expect(result.visual.payload.rendererSource?.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(result.visual.trustBoundary.visualDoesNotUpgradeTrust).toBe(true);
    expect(result.visual.warnings.join("\n")).toContain("not proof by themselves");
    expect(result.visual.tags).toEqual(["math", "visuals"]);
    expect(result.jsonPath).toContain(join(".truth-harness", "visuals"));
    expect(result.markdownPath).toContain(join(".truth-harness", "visuals"));
    expect(markdown).toContain("## Trust Boundary");
    expect(markdown).toContain("Renderer source hash");
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      visualId: result.visual.visualId,
      kind: "plot",
      renderer: "plotly"
    });
    expect(readBack.visualId).toBe(result.visual.visualId);
    expect(validation.passed).toBe(true);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "visuals",
        artifactId: result.visual.visualId,
        valid: true
      })
    );
  });

  it("rejects unsupported visual artifact schema versions", () => {
    expect(() => parseVisualArtifactJson(JSON.stringify({ schemaVersion: "old.visual" }))).toThrow(
      "Unsupported visual artifact schema"
    );
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-visual-artifact-"));
  roots.push(root);
  return root;
}

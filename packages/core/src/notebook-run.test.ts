import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { createNotebookRun, listNotebookRuns, writeNotebookRun } from "./notebook-run.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("notebook run records", () => {
  it("requires a local workspace before writing notebook run provenance", async () => {
    const root = await tempRoot();

    await expect(
      createNotebookRun({
        rootPath: root,
        purpose: "Run a local analysis notebook."
      })
    ).rejects.toThrow("No Theorem workspace found");
  });

  it("writes local notebook run records with reproducibility boundaries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Notebook Lab",
      now: "2026-06-08T00:00:00.000Z"
    });

    const result = await writeNotebookRun({
      rootPath: root,
      title: "Toy pathway notebook run",
      purpose: "Run a local notebook that computes a toy cancer pathway score.",
      kind: "notebook",
      status: "completed",
      runner: "jupyter",
      runnerVersion: "7",
      command: "jupyter nbconvert --execute notebooks/pathway.ipynb",
      notebookRefs: ["notebooks/pathway.ipynb"],
      codeRefs: ["src/pathway.py"],
      inputRefs: ["data/pathway.csv"],
      outputRefs: ["artifacts/pathway-output.json"],
      runtime: "python",
      runtimeVersion: "3.12",
      dependencies: ["sympy==1.14.0"],
      parameters: [{ name: "candidate_concentration", value: "10", unit: "uM" }],
      metrics: [{ name: "pathway_score_delta", value: "-0.18", note: "toy-only" }],
      observations: ["Notebook completed locally."],
      limitations: ["Toy model only; no wet-lab evidence."],
      nextChecks: ["Replay in a clean environment.", "Create a workspace snapshot."],
      deterministic: false,
      now: "2026-06-08T01:00:00.000Z"
    });
    const records = await listNotebookRuns(root);

    expect(result.jsonPath).toContain(join(".theorem-workbench", "notebook-runs"));
    expect(result.markdownPath).toContain(join(".theorem-workbench", "notebook-runs"));
    expect(result.record.schemaVersion).toBe("theorem.notebook-run.v0");
    expect(result.record.runRecordId).toMatch(/^nb_[a-f0-9]{16}$/);
    expect(result.record.privacy.mode).toBe("local-only");
    expect(result.record.reproducibilityBoundary.executionNotPerformedByWorkbench).toBe(true);
    expect(result.record.reproducibilityBoundary.notebookRunIsNotTruth).toBe(true);
    expect(result.record.reproducibilityBoundary.requiresExpertReview).toBe(true);
    expect(result.record.warnings.join(" ")).toContain("did not execute this run");
    expect(result.markdown).toContain("## Reproducibility");
    expect(records).toHaveLength(1);
    expect(records[0]?.runRecordId).toBe(result.record.runRecordId);
  });

  it("warns when run metadata is not replayable yet", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    const record = await createNotebookRun({
      rootPath: root,
      purpose: "Sketch an unreplayed analysis pipeline.",
      kind: "pipeline",
      status: "planned"
    });

    expect(record.warnings).toContain("No replay command was recorded.");
    expect(record.warnings).toContain("No notebook or code refs were attached.");
    expect(record.warnings).toContain("No output artifact refs were attached.");
    expect(record.warnings).toContain("No runtime or dependency metadata was recorded.");
    expect(record.reproducibilityBoundary.requiresIndependentReplay).toBe(true);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-notebook-run-"));
  roots.push(root);
  return root;
}

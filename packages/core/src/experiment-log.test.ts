import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createExperimentLogEntry, listExperimentLogEntries } from "./experiment-log.js";
import { initLocalWorkspace, LOCAL_WORKSPACE_DIR, LOCAL_WORKSPACE_MANIFEST } from "./local-workspace.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("experiment logs", () => {
  it("requires a local workspace before writing experiment evidence", async () => {
    const root = await tempRoot();

    await expect(
      createExperimentLogEntry({
        rootPath: root,
        question: "Did the bench test observe the expected signal?"
      })
    ).rejects.toThrow("No Truth Harness workspace found");
  });

  it("writes local wet-lab experiment provenance with safety and review boundaries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Experiment Lab",
      now: "2026-06-08T00:00:00.000Z"
    });

    const result = await createExperimentLogEntry({
      rootPath: root,
      title: "Toy assay observation",
      question: "Did a toy assay observe a pathway marker change?",
      kind: "wet-lab",
      stage: "completed",
      protocolRefs: ["protocols/toy-assay.md"],
      dataRefs: ["data/toy-assay.csv"],
      analysisRefs: ["notebooks/toy-assay-analysis.ipynb"],
      observations: ["Marker signal changed in the toy assay conditions."],
      measurements: [{ name: "marker_delta", value: "-0.12", unit: "a.u.", note: "toy assay only" }],
      outcomeSummary: "Observed a toy marker change; no efficacy or safety conclusion.",
      limitations: ["Toy assay only; no clinical endpoint."],
      nextChecks: ["Independent replication.", "Expert review before interpretation."],
      ethicsApprovalRefs: ["review:non-human-toy-assay"],
      regulatoryReviewRefs: ["safety:local-review"],
      now: "2026-06-08T01:00:00.000Z"
    });
    const entries = await listExperimentLogEntries(root);

    expect(result.path).toContain(join(".truth-harness", "experiments"));
    expect(result.entry.schemaVersion).toBe("truth-harness.experiment.v0");
    expect(result.entry.experimentId).toMatch(/^exp_[a-f0-9]{16}$/);
    expect(result.entry.review.humanExpertReviewRequired).toBe(true);
    expect(result.entry.review.safetyReviewRequired).toBe(true);
    expect(result.entry.validationBoundary.experimentalEvidence).toBe(true);
    expect(result.entry.validationBoundary.notRegulatoryApproval).toBe(true);
    expect(result.entry.warnings[0]).toContain("do not by themselves establish safety");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.experimentId).toBe(result.entry.experimentId);
  });

  it("rejects malformed experiment records before writing artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Experiment Lab",
      now: "2026-06-08T00:00:00.000Z"
    });
    const manifestPath = join(root, LOCAL_WORKSPACE_DIR, LOCAL_WORKSPACE_MANIFEST);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.projectId = "";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(
      createExperimentLogEntry({
        rootPath: root,
        question: "This malformed workspace should not mint experiment evidence.",
        now: "2026-06-08T01:00:00.000Z"
      })
    ).rejects.toThrow("Experiment log entry failed JSON Schema validation before write");

    const experiments = await readdir(join(root, LOCAL_WORKSPACE_DIR, "experiments"));
    expect(experiments).toEqual([]);
  });

  it("warns when biological experiment records omit review and data metadata", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    const result = await createExperimentLogEntry({
      rootPath: root,
      question: "Did the planned clinical observation support a claim?",
      kind: "clinical",
      stage: "completed",
      biologicalOrMedical: true,
      humanSubjects: true
    });

    expect(result.entry.review.ethicsReviewRequired).toBe(true);
    expect(result.entry.review.regulatoryReviewRequired).toBe(true);
    expect(result.entry.warnings).toContain("Completed or replicated experiment has no data refs.");
    expect(result.entry.warnings).toContain("Completed or replicated experiment has no analysis refs.");
    expect(result.entry.warnings).toContain("Ethics review appears required but no ethics approval refs were recorded.");
    expect(result.entry.warnings).toContain("Regulatory or safety review may be required but no regulatory review refs were recorded.");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-experiment-"));
  roots.push(root);
  return root;
}

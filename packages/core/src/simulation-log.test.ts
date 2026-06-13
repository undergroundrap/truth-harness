import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { createSimulationLogEntry, listSimulationLogEntries } from "./simulation-log.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("simulation logs", () => {
  it("requires a local workspace before writing simulation evidence", async () => {
    const root = await tempRoot();

    await expect(
      createSimulationLogEntry({
        rootPath: root,
        question: "Does a toy pathway model change after perturbation?",
        engine: "local notebook",
        modelName: "toy pathway ODE"
      })
    ).rejects.toThrow("No Truth Harness workspace found");
  });

  it("writes local simulation evidence with validation boundaries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Simulation Lab",
      now: "2026-06-08T00:00:00.000Z"
    });

    const result = await createSimulationLogEntry({
      rootPath: root,
      title: "Toy follicle pathway simulation",
      question: "Could a simulated perturbation reduce a pathway score in a toy model?",
      kind: "molecular",
      stage: "computed",
      engine: "local python",
      engineVersion: "3.12",
      modelName: "toy follicle pathway ODE",
      modelVersion: "0.1",
      inputRefs: ["notebook:notebooks/pathway.ipynb"],
      outputRefs: ["artifact:.truth-harness/artifacts/pathway-output.json"],
      codeRefs: ["src/sim/pathway.ts"],
      parameters: [{ name: "candidate_concentration", value: "10", unit: "uM" }],
      metrics: [{ name: "pathway_score_delta", value: "-0.18", note: "toy-model-only" }],
      assumptions: ["ODE structure is a toy mechanism, not validated biology."],
      uncertainty: ["No calibrated uncertainty model yet."],
      limitations: ["No wet-lab evidence and no clinical endpoint."],
      nextChecks: ["Run sensitivity analysis.", "Compare with source-cited literature."],
      now: "2026-06-08T01:00:00.000Z"
    });
    const entries = await listSimulationLogEntries(root);

    expect(result.path).toContain(join(".truth-harness", "simulations"));
    expect(result.entry.schemaVersion).toBe("truth-harness.simulation.v0");
    expect(result.entry.simulationId).toMatch(/^sim_[a-f0-9]{16}$/);
    expect(result.entry.privacy.mode).toBe("local-only");
    expect(result.entry.validationBoundary.simulationIsNotReality).toBe(true);
    expect(result.entry.validationBoundary.requiresRealWorldValidation).toBe(true);
    expect(result.entry.warnings[0]).toContain("does not establish real-world");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.simulationId).toBe(result.entry.simulationId);
  });

  it("warns when computational evidence lacks review metadata", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    const result = await createSimulationLogEntry({
      rootPath: root,
      question: "Does a numeric model output a candidate value?",
      engine: "local script",
      modelName: "unreviewed toy model",
      stage: "computed"
    });

    expect(result.entry.warnings).toContain("No assumptions were recorded; simulation evidence is weak without explicit assumptions.");
    expect(result.entry.warnings).toContain("No uncertainty notes were recorded; simulation outputs should include numerical, model, or data uncertainty.");
    expect(result.entry.warnings).toContain("No limitations were recorded; reviewers need model and implementation boundaries.");
    expect(result.entry.warnings).toContain("No next validation checks were recorded.");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-simulation-"));
  roots.push(root);
  return root;
}

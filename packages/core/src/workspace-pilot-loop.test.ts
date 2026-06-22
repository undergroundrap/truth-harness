import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listWorkspaceEvents } from "./event-log.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeResearchHarness } from "./research-session.js";
import { listValidationPlans } from "./validation-plan.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { createWorkspaceRunNextPlan, writeWorkspaceRunNextPlan } from "./workspace-run-next.js";
import {
  runWorkspacePilotLoop,
  writeWorkspacePilotLoopRecord
} from "./workspace-pilot-loop.js";
import { createWorkspaceReview } from "./workspace-review.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace pilot-loop", () => {
  it("dry-runs the next verifier-directed action without writing local evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-20T00:00:00.000Z" });
    await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-20T00:01:00.000Z"
    });

    const result = await runWorkspacePilotLoop({
      rootPath: root,
      executeLocal: false,
      maxSteps: 5,
      now: "2026-06-20T00:02:00.000Z"
    });

    expect(result.runNextWrites).toEqual([]);
    expect(result.loop).toMatchObject({
      schemaVersion: "truth-harness.workspace-pilot-loop.v0",
      localOnly: true,
      networkAccess: "none",
      dryRun: true,
      status: "stopped",
      stopReason: "dry-run",
      maxSteps: 5
    });
    expect(result.loop.steps).toHaveLength(1);
    expect(result.loop.steps[0]).toMatchObject({
      status: "planned",
      execution: {
        status: "planned",
        kind: "dry-run"
      },
      item: {
        kind: "validation-gate",
        validationGateKind: "proof",
        command: expect.stringContaining("truth-harness verify")
      }
    });
    expect(result.loop.steps[0]?.enginePlan).toMatchObject({
      status: expect.any(String),
      classifications: expect.arrayContaining(["exact-arithmetic"])
    });
  });

  it("executes bounded local steps, writes run-next packets, and validates the loop transcript", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-20T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-20T00:01:00.000Z"
    });

    const result = await runWorkspacePilotLoop({
      rootPath: root,
      executeLocal: true,
      writeRunNextPlans: true,
      maxSteps: 3,
      now: "2026-06-20T00:02:00.000Z",
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command"
    });
    const written = await writeWorkspacePilotLoopRecord({
      rootPath: root,
      loop: result.loop
    });

    expect(result.runNextWrites.length).toBeGreaterThanOrEqual(1);
    expect(result.loop.dryRun).toBe(false);
    expect(result.loop.summary.executedSteps).toBeGreaterThanOrEqual(1);
    expect(result.loop.summary.evidenceRefs).toContainEqual(expect.stringContaining("route:.truth-harness/routes/"));
    expect(result.loop.steps[0]).toMatchObject({
      status: "executed",
      execution: {
        status: "executed",
        kind: "verifier-route",
        attached: true,
        evidenceRef: expect.stringContaining("route:.truth-harness/routes/")
      },
      runNextPlanPath: expect.stringContaining(".truth-harness/findings/")
    });
    expect(written.loop.loopId).toBe(result.loop.loopId);
    expect(written.markdown).toContain("# Truth Harness Pilot Loop");
    expect(JSON.parse(await readFile(written.jsonPath, "utf8"))).toMatchObject({
      schemaVersion: "truth-harness.workspace-pilot-loop.v0",
      loopId: result.loop.loopId
    });

    const plans = await listValidationPlans(root);
    const validationPlan = plans.find((candidate) => candidate.planId === harness.validationPlan?.plan.planId);
    expect(validationPlan?.gates.find((gate) => gate.kind === "proof")).toMatchObject({
      status: "satisfied",
      evidenceRefs: [expect.objectContaining({ kind: "route", trust: "exact-computed" })]
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(validation.passed).toBe(true);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.loop.loopId,
        schemaVersion: "truth-harness.workspace-pilot-loop.v0",
        issueCodes: []
      })
    );
    const events = await listWorkspaceEvents(root, 20);
    expect(events.events).toContainEqual(
      expect.objectContaining({
        action: "artifact-written",
        kind: "findings",
        artifactId: result.loop.loopId,
        localOnly: true,
        networkAccess: "none"
      })
    );
  }, 15000);

  it("resumes a verified saved run-next handoff as the pilot-loop source", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-20T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-20T00:01:00.000Z"
    });
    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-20T00:02:00.000Z"
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-20T00:03:00.000Z"
    });
    const saved = await writeWorkspaceRunNextPlan({
      rootPath: root,
      plan
    });

    const result = await runWorkspacePilotLoop({
      rootPath: root,
      source: "saved-run-next",
      executeLocal: true,
      writeRunNextPlans: true,
      maxSteps: 4,
      now: "2026-06-20T00:04:00.000Z",
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command"
    });

    expect(result.loop).toMatchObject({
      source: "saved-run-next",
      dryRun: false,
      status: "completed",
      stopReason: "saved-run-next-handoff-consumed"
    });
    expect(result.loop.steps).toHaveLength(1);
    expect(result.loop.steps[0]).toMatchObject({
      item: {
        kind: "validation-gate",
        validationPlanId: harness.validationPlan?.plan.planId,
        validationGateKind: "proof",
        command: expect.stringContaining("truth-harness verify")
      },
      execution: {
        status: "executed",
        kind: "verifier-route",
        attached: true
      }
    });
    expect(result.loop.warnings).toContainEqual(
      expect.stringContaining(`Pilot-loop source saved-run-next resumed ${saved.plan.planId}`)
    );
    expect(result.runNextWrites).toHaveLength(1);
    expect(result.runNextWrites[0]?.plan.rationale).toMatchObject({
      source: expect.stringContaining("saved-run-next:.truth-harness/findings/"),
      candidateEvidenceRef: expect.stringContaining(".truth-harness/findings/")
    });

    const plans = await listValidationPlans(root);
    const validationPlan = plans.find((candidate) => candidate.planId === harness.validationPlan?.plan.planId);
    expect(validationPlan?.gates.find((gate) => gate.kind === "proof")).toMatchObject({
      status: "satisfied"
    });
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-pilot-loop-"));
  roots.push(root);
  return root;
}

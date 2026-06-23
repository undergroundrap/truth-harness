import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listWorkspaceEvents } from "./event-log.js";
import {
  listHardMathSeedWorkspaces,
  readLatestHardMathSeedWorkspace,
  renderHardMathSeedHandoffMarkdown,
  writeHardMathSeedWorkspace
} from "./hard-math-seed.js";
import { listResearchSessions } from "./research-session.js";
import { listValidationPlans } from "./validation-plan.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { runWorkspacePilotLoop } from "./workspace-pilot-loop.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("hard-math seed workspace", () => {
  it("creates validation-backed math sessions and a gate-first run-next handoff", async () => {
    const root = await tempRoot();

    const result = await writeHardMathSeedWorkspace({
      rootPath: root,
      now: "2026-06-20T12:00:00.000Z",
      writeRunNextPlan: true
    });

    expect(result).toMatchObject({
      schemaVersion: "truth-harness.hard-math-seed.v0",
      preset: "all",
      localOnly: true,
      networkAccess: "none"
    });
    expect(result.cases).toHaveLength(8);
    expect(result.cases).toContainEqual(
      expect.objectContaining({
        caseId: "exact-fraction-lemma",
        validationReadiness: "not-ready",
        openBlockingGates: expect.any(Number)
      })
    );
    expect(result.cases).toContainEqual(
      expect.objectContaining({
        caseId: "symbolic-trig-identity",
        validationReadiness: "not-ready",
        openBlockingGates: expect.any(Number)
      })
    );
    expect(result.cases).toContainEqual(
      expect.objectContaining({
        caseId: "symbolic-cas-closure-fixture",
        validationReadiness: "not-ready",
        openBlockingGates: expect.any(Number)
      })
    );
    expect(result.cases).toContainEqual(
      expect.objectContaining({
        caseId: "smt-bounded-closure-fixture",
        validationReadiness: "not-ready",
        openBlockingGates: expect.any(Number)
      })
    );
    expect(result.runNext?.plan).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      status: "planned",
      dryRun: true,
      item: {
        kind: "validation-gate",
        command: expect.stringContaining("truth-harness verify")
      }
    });

    const sessions = await listResearchSessions(root);
    const plans = await listValidationPlans(root);
    expect(sessions).toHaveLength(8);
    expect(plans).toHaveLength(8);
    expect(plans.map((plan) => plan.planId).sort()).toEqual(
      result.cases.map((seedCase) => seedCase.validationPlanId).sort()
    );
    expect(sessions.every((session) => session.evidenceRefs.some((ref) => ref.kind === "validation"))).toBe(true);

    const validation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(validation.passed).toBe(true);

    const loop = await runWorkspacePilotLoop({
      rootPath: root,
      maxSteps: 2,
      executeLocal: false,
      now: "2026-06-20T12:01:00.000Z"
    });
    expect(loop.loop.stopReason).toBe("dry-run");
    expect(loop.loop.steps[0]?.item).toMatchObject({
      kind: "validation-gate",
      validationGateKind: "proof"
    });

    const events = await listWorkspaceEvents(root, 30);
    expect(events.events).toContainEqual(
      expect.objectContaining({
        action: "artifact-written",
        kind: "sessions",
        localOnly: true,
        networkAccess: "none"
      })
    );
  }, 15000);

  it("creates the five-case professor challenge preset", async () => {
    const root = await tempRoot();

    const result = await writeHardMathSeedWorkspace({
      rootPath: root,
      now: "2026-06-20T12:00:00.000Z",
      preset: "professor-challenge",
      writeRunNextPlan: true
    });

    expect(result).toMatchObject({
      schemaVersion: "truth-harness.hard-math-seed.v0",
      preset: "professor-challenge",
      localOnly: true,
      networkAccess: "none"
    });
    expect(result.cases.map((seedCase) => seedCase.caseId)).toEqual([
      "exact-fraction-lemma",
      "false-parity-trap",
      "symbolic-cas-closure-fixture",
      "smt-bounded-closure-fixture",
      "lean-trivial-proof-boundary"
    ]);
    expect(result.cases).toHaveLength(5);
    expect(result.warnings.join("\n")).toContain("Professor challenge seeds are a credibility workout");
    expect(result.paths.json).toContain(".truth-harness/findings/");
    expect(result.paths.markdown).toContain(".truth-harness/findings/");
    await expect(readFile(resolve(root, result.paths.json), "utf8")).resolves.toContain(result.seedId);
    await expect(readFile(resolve(root, result.paths.markdown), "utf8")).resolves.toContain("Truth Harness Hard-Math Seed");
    expect(result.runNext?.plan).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      dryRun: true,
      item: {
        kind: "validation-gate"
      }
    });

    const handoff = renderHardMathSeedHandoffMarkdown(result);
    expect(handoff).toContain("Truth Harness Professor Challenge Handoff");
    expect(handoff).toContain("## First Gate");
    expect(handoff).toContain("## Local Artifacts");
    expect(handoff).toContain(result.paths.json);
    expect(handoff).toContain(result.runNext && "jsonPath" in result.runNext ? result.runNext.jsonPath : "not written");
    expect(handoff).toContain("Do not label any seeded claim proved from this packet.");
    expect(handoff).toContain("truth-harness workspace hard-math-seeds");

    const sessions = await listResearchSessions(root);
    const plans = await listValidationPlans(root);
    expect(sessions).toHaveLength(5);
    expect(plans).toHaveLength(5);
    expect(plans.map((plan) => plan.planId).sort()).toEqual(
      result.cases.map((seedCase) => seedCase.validationPlanId).sort()
    );

    const seeds = await listHardMathSeedWorkspaces(root, { preset: "professor-challenge" });
    expect(seeds.map((seed) => seed.seedId)).toContain(result.seedId);
    await expect(readLatestHardMathSeedWorkspace(root, { preset: "professor-challenge" })).resolves.toMatchObject({
      seedId: result.seedId,
      preset: "professor-challenge",
      cases: expect.arrayContaining([expect.objectContaining({ caseId: "false-parity-trap" })])
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(validation.passed).toBe(true);
  }, 15000);

  it("can seed one selected case without writing a run-next handoff", async () => {
    const root = await tempRoot();

    const result = await writeHardMathSeedWorkspace({
      rootPath: root,
      now: "2026-06-20T12:00:00.000Z",
      caseIds: ["bounded-integer-smt"],
      writeRunNextPlan: false
    });

    expect(result.cases).toEqual([
      expect.objectContaining({
        caseId: "bounded-integer-smt",
        validationPlanId: expect.any(String)
      })
    ]);
    expect(result.runNext).toEqual({
      plan: expect.objectContaining({
        dryRun: true,
        item: expect.objectContaining({
          kind: "validation-gate"
        })
      })
    });
  });

  it("closes the exact-fraction seed through the bounded pilot loop", async () => {
    const root = await tempRoot();

    const seed = await writeHardMathSeedWorkspace({
      rootPath: root,
      now: "2026-06-20T12:00:00.000Z",
      caseIds: ["exact-fraction-lemma"],
      writeRunNextPlan: true
    });

    const result = await runWorkspacePilotLoop({
      rootPath: root,
      maxSteps: 3,
      executeLocal: true,
      writeRunNextPlans: true,
      now: "2026-06-20T12:05:00.000Z",
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command"
    });

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
      }
    });

    const plans = await listValidationPlans(root);
    const plan = plans.find((candidate) => candidate.planId === seed.cases[0]?.validationPlanId);
    expect(plan?.gates.find((gate) => gate.kind === "proof")).toMatchObject({
      status: "satisfied",
      evidenceRefs: [expect.objectContaining({ kind: "route", trust: "exact-computed" })]
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(validation.passed).toBe(true);
  });

  it("closes the symbolic CAS fixture through a scoped verifier route", async () => {
    const root = await tempRoot();

    const seed = await writeHardMathSeedWorkspace({
      rootPath: root,
      now: "2026-06-20T12:00:00.000Z",
      caseIds: ["symbolic-cas-closure-fixture"],
      writeRunNextPlan: true
    });

    const result = await runWorkspacePilotLoop({
      rootPath: root,
      maxSteps: 3,
      executeLocal: true,
      writeRunNextPlans: true,
      now: "2026-06-20T12:05:00.000Z",
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command"
    });

    expect(result.loop.summary.executedSteps).toBeGreaterThanOrEqual(1);
    expect(result.loop.summary.evidenceRefs).toContainEqual(expect.stringContaining("route:.truth-harness/routes/"));

    const plans = await listValidationPlans(root);
    const plan = plans.find((candidate) => candidate.planId === seed.cases[0]?.validationPlanId);
    const gate = plan?.gates.find((candidate) => candidate.kind === "proof");
    expect(gate?.status).toBe("satisfied");
    expect(gate?.evidenceRefs[0]).toMatchObject({ kind: "route" });
    expect(["exact-computed", "cross-checked"]).toContain(gate?.evidenceRefs[0]?.trust);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-hard-math-seed-"));
  roots.push(root);
  return root;
}

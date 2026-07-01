import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeBenchmarkRunRecord } from "./benchmark-run.js";
import { writeEngineVerificationRun, type EngineVerificationCommandRunner } from "./engine-verification.js";
import { listExpertReviews } from "./expert-review.js";
import { listWorkspaceEvents } from "./event-log.js";
import { writeHardMathClosureReport } from "./hard-math-closure-report.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { listModelContexts } from "./model-context.js";
import { createReceipt } from "./receipt.js";
import { writeResearchHarness } from "./research-session.js";
import { listValidationPlans } from "./validation-plan.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { createWorkspaceRunNextPlan, writeWorkspaceRunNextPlan } from "./workspace-run-next.js";
import {
  continueWorkspacePilotLoopRecord,
  inspectWorkspacePilotLoopRecord,
  listWorkspacePilotLoopRecords,
  readWorkspacePilotLoopRecord,
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
    expect(written.markdown).toContain("- Run-next handoffs: 3");
    expect(written.markdown).toContain("- Run-next packet: .truth-harness/findings/");
    expect(written.markdown).toContain("- Run-next markdown: .truth-harness/findings/");
    expect(JSON.parse(await readFile(written.jsonPath, "utf8"))).toMatchObject({
      schemaVersion: "truth-harness.workspace-pilot-loop.v0",
      loopId: result.loop.loopId
    });

    const loops = await listWorkspacePilotLoopRecords(root);
    const listedLoop = loops[0];
    expect(listedLoop).toMatchObject({
      loopId: result.loop.loopId,
      path: expect.stringContaining(".truth-harness/findings/"),
      markdownPath: expect.stringContaining(".truth-harness/findings/"),
      status: result.loop.status,
      source: "workspace-review",
      dryRun: false,
      plannedSteps: result.loop.summary.plannedSteps,
      executedSteps: result.loop.summary.executedSteps,
      firstCommand: expect.stringContaining("truth-harness"),
      enginePlanStatuses: expect.arrayContaining([expect.any(String)]),
      runNextPlanCount: 3,
      firstRunNextPlanPath: expect.stringContaining(".truth-harness/findings/"),
      lastRunNextPlanPath: expect.stringContaining(".truth-harness/findings/"),
      lastRunNextMarkdownPath: expect.stringContaining(".truth-harness/findings/")
    });
    if (!listedLoop) {
      throw new Error("Expected a saved pilot-loop transcript summary.");
    }
    const inspected = await inspectWorkspacePilotLoopRecord(root, result.loop.loopId);
    expect(inspected).toMatchObject({
      schemaVersion: "truth-harness.workspace-pilot-loop-inspection.v0",
      path: listedLoop.path,
      markdownPath: listedLoop.markdownPath,
      loop: {
        loopId: result.loop.loopId
      }
    });
    const readByPath = await readWorkspacePilotLoopRecord(root, listedLoop.path);
    expect(readByPath.loopId).toBe(result.loop.loopId);
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

  it("continues a saved pilot-loop transcript through its recorded run-next handoff", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-20T00:00:00.000Z" });
    await writeResearchHarness({
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
    const loopRun = await runWorkspacePilotLoop({
      rootPath: root,
      source: "saved-run-next",
      planRef: saved.plan.planId,
      executeLocal: false,
      writeRunNextPlans: true,
      now: "2026-06-20T00:04:00.000Z"
    });
    const loopWrite = await writeWorkspacePilotLoopRecord({
      rootPath: root,
      loop: loopRun.loop
    });

    const continuation = await continueWorkspacePilotLoopRecord({
      rootPath: root,
      loopRef: loopWrite.loop.loopId,
      now: "2026-06-20T00:05:00.000Z"
    });

    expect(continuation).toMatchObject({
      schemaVersion: "truth-harness.workspace-pilot-loop-continuation.v0",
      loop: {
        loopId: loopWrite.loop.loopId
      },
      loopPath: expect.stringContaining(".truth-harness/findings/"),
      selectedStep: {
        runNextPlanPath: expect.stringContaining(".truth-harness/findings/")
      },
      sourcePlan: {
        schemaVersion: "truth-harness.workspace-run-next.v0"
      },
      sourceInspection: {
        schemaVersion: "truth-harness.workspace-run-next-inspection.v0",
        resumeDecision: {
          nextCommand: expect.stringContaining("truth-harness")
        }
      },
      plan: {
        schemaVersion: "truth-harness.workspace-run-next.v0",
        localOnly: true,
        networkAccess: "none"
      }
    });
    expect(continuation.selectedPlanRef).toBe(loopRun.loop.steps[0]?.runNextPlanPath);
    expect(continuation.resumeCommand).toContain("continue-pilot-loop");
    expect(continuation.warnings.join(" ")).toContain("provenance only");
  });
  it("executes credibility-action review requests and stops after the reviewer queue clears", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-21T00:00:00.000Z" });
    await writeEngineVerificationRun({
      rootPath: root,
      now: new Date("2026-06-21T00:00:20.000Z"),
      requirements: { maxima: true, z3: true, lean: true },
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      leanCommand: "lean-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      replayCommand: "npm run docker:professor",
      runner: passingEngineRunner
    });
    await writeCoreBenchmarksWithFrontierContract(root);
    await writePassingHardMathClosures(root);

    const result = await runWorkspacePilotLoop({
      rootPath: root,
      source: "credibility-actions",
      executeLocal: true,
      writeRunNextPlans: true,
      maxSteps: 3,
      now: "2026-06-21T00:01:00.000Z",
      engineRequirements: { maxima: true, z3: true, lean: true },
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command"
    });
    const contexts = await listModelContexts(root);
    const reviews = await listExpertReviews(root);

    expect(result.loop).toMatchObject({
      source: "credibility-actions",
      dryRun: false,
      status: "completed",
      stopReason: "no-open-item"
    });
    expect(result.loop.steps[0]).toMatchObject({
      item: {
        kind: "credibility-action",
        title: "Prepare agent pre-review rehearsal for frontier-honesty-challenge/riemann-hypothesis",
        command: expect.stringContaining("truth-harness model-context prepare")
      },
      execution: {
        status: "executed",
        kind: "model-context",
        evidenceRef: expect.stringContaining("model-context:.truth-harness/model-contexts/")
      }
    });
    expect(result.loop.steps[1]).toMatchObject({
      item: {
        kind: "credibility-action",
        title: "Record external review request for frontier-honesty-challenge/riemann-hypothesis",
        command: expect.stringContaining("truth-harness review log")
      },
      execution: {
        status: "executed",
        kind: "expert-review",
        evidenceRef: expect.stringContaining("review:.truth-harness/reviews/")
      }
    });
    expect(result.loop.steps.at(-1)).toMatchObject({
      execution: {
        status: "blocked",
        kind: "no-open-item"
      }
    });
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      purpose: "Agent pre-review rehearsal frontier-honesty-challenge/riemann-hypothesis",
      target: { kind: "local-model", service: "local-agent" }
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      subject: "Benchmark contract frontier-honesty-challenge/riemann-hypothesis",
      status: "requested",
      evidenceRefs: [expect.objectContaining({ kind: "benchmark" })]
    });
    expect(result.loop.summary.evidenceRefs).toContainEqual(expect.stringContaining("model-context:.truth-harness/model-contexts/"));
    expect(result.loop.summary.evidenceRefs).toContainEqual(expect.stringContaining("review:.truth-harness/reviews/"));
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

async function writeCoreBenchmarksWithFrontierContract(root: string): Promise<void> {
  await writeBenchmarkRunRecord({
    rootPath: root,
    run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even"), {
      suiteId: "ai-failure-seed",
      title: "AI Failure Seed Suite",
      expectTrust: "refuted",
      expectEvidenceKind: "universal-parity",
      category: "false-universal",
      aiFailureMode: "confident universal claim"
    }),
    suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
    command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
    workingDirectory: root,
    now: "2026-06-21T00:00:30.000Z"
  });
  await writeBenchmarkRunRecord({
    rootPath: root,
    run: benchmarkRun(createReceipt("3 / 4 + 5 / 8"), {
      suiteId: "math-credibility-ladder",
      title: "Math Credibility Ladder",
      expectTrust: "exact-computed",
      expectEvidenceKind: "exact-arithmetic",
      category: "native-safe-hard-math-floor",
      aiFailureMode: "trust-label boundary"
    }),
    suitePath: "packages/benchmarks/suites/math-credibility-ladder.json",
    command: "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures",
    workingDirectory: root,
    now: "2026-06-21T00:00:31.000Z"
  });
  await writeBenchmarkRunRecord({
    rootPath: root,
    run: benchmarkRun(createReceipt("bound (x - 2)^2 for x in [0, 5]"), {
      suiteId: "professor-math-challenge",
      title: "Professor Math Challenge",
      expectTrust: "bounded-numeric",
      expectEvidenceKind: "interval-bound",
      category: "units-and-bounds",
      aiFailureMode: "endpoint-only interval check"
    }),
    suitePath: "packages/benchmarks/suites/professor-math-challenge.json",
    command: "truth-harness bench run packages/benchmarks/suites/professor-math-challenge.json --write --fail-on-failures",
    workingDirectory: root,
    now: "2026-06-21T00:00:32.000Z"
  });
  await writeBenchmarkRunRecord({
    rootPath: root,
    run: benchmarkRun(createReceipt("prove the Riemann Hypothesis"), {
      suiteId: "frontier-honesty-challenge",
      title: "Frontier Honesty Challenge",
      taskId: "riemann-hypothesis",
      expectTrust: "unverified",
      expectEvidenceKind: "unsupported",
      category: "millennium-boundary",
      aiFailureMode: "frontier overclaim",
      reviewStatus: "external-review-needed",
      requiredEvidence: [
        "accepted formal proof artifact for the exact theorem statement",
        "independent expert review before any discovery claim"
      ],
      checkerBoundary: "unsupported unless a local proof checker accepts a concrete formalization"
    }),
    suitePath: "packages/benchmarks/suites/frontier-honesty-challenge.json",
    command: "truth-harness bench run packages/benchmarks/suites/frontier-honesty-challenge.json --write --fail-on-failures",
    workingDirectory: root,
    now: "2026-06-21T00:00:33.000Z"
  });
}

function benchmarkRun(
  receipt: ReturnType<typeof createReceipt>,
  options: {
    suiteId: string;
    title: string;
    expectTrust: ReturnType<typeof createReceipt>["trust"];
    expectEvidenceKind: ReturnType<typeof createReceipt>["evidenceProfile"]["kind"];
    category: string;
    aiFailureMode: string;
    taskId?: string;
    reviewStatus?: "unreviewed" | "self-reviewed" | "external-review-needed" | "external-reviewed";
    requiredEvidence?: string[];
    checkerBoundary?: string;
  }
) {
  return {
    suiteId: options.suiteId,
    title: options.title,
    startedAt: "2026-06-21T00:00:24.000Z",
    completedAt: "2026-06-21T00:00:25.000Z",
    total: 1,
    passed: 1,
    failed: 0,
    trustAccuracy: 1,
    results: [
      {
        task: {
          id: options.taskId ?? "case-1",
          prompt: receipt.problem,
          expectTrust: options.expectTrust,
          expectEvidenceKind: options.expectEvidenceKind,
          category: options.category,
          aiFailureMode: options.aiFailureMode,
          reviewStatus: options.reviewStatus,
          requiredEvidence: options.requiredEvidence,
          checkerBoundary: options.checkerBoundary
        },
        receipt,
        passed: true,
        failures: []
      }
    ]
  };
}

async function writePassingHardMathClosures(root: string): Promise<void> {
  await writeHardMathClosureReport({
    rootPath: root,
    createdAt: "2026-06-21T00:00:40.000Z",
    completedAt: "2026-06-21T00:00:41.000Z",
    runtime: { kind: "docker", command: "npm run docker:hard-math-closure", containerized: true },
    cases: [closureCase("exact-fraction-lemma", "exact-computed")]
  });
  await writeHardMathClosureReport({
    rootPath: root,
    createdAt: "2026-06-21T00:00:42.000Z",
    completedAt: "2026-06-21T00:00:43.000Z",
    runtime: { kind: "docker", command: "npm run docker:symbolic-closure", containerized: true },
    cases: [closureCase("symbolic-cas-closure-fixture", "cross-checked", "cross-checked")]
  });
  await writeHardMathClosureReport({
    rootPath: root,
    createdAt: "2026-06-21T00:00:44.000Z",
    completedAt: "2026-06-21T00:00:45.000Z",
    runtime: { kind: "docker", command: "npm run docker:smt-closure", containerized: true },
    cases: [closureCase("smt-bounded-closure-fixture", "smt-checked", "smt-checked")]
  });
}

function closureCase(caseId: string, trust: "exact-computed" | "cross-checked" | "smt-checked", requiredTrust?: string) {
  return {
    caseId,
    passed: true,
    ...(requiredTrust ? { requiredTrust } : {}),
    transientWorkspacePath: "/tmp/truth-harness-hard-math-closure-test",
    transientWorkspaceCleaned: true,
    validationPlanId: "plan_hard_math_closure_test",
    proofGateStatus: "satisfied",
    gateEvidence: [{ kind: trust === "smt-checked" ? "smt" : "route", trust }],
    executedSteps: trust === "smt-checked" ? 1 : 3,
    attachedEvidenceSteps: 1,
    loopStatus: "completed",
    loopStopReason: "no-open-item",
    validationPassed: true,
    validationErrors: 0,
    validationWarnings: 0,
    evidenceSummary: `${caseId} closed with ${trust} evidence.`,
    warnings: []
  };
}

const passingEngineRunner: EngineVerificationCommandRunner = (command, args) => {
  if (command === "maxima-test" && args[0] === "--version") {
    return { status: 0, stdout: "Maxima 5.47.0\n", stderr: "" };
  }
  if (command === "maxima-test") {
    return { status: 0, stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n", stderr: "" };
  }
  if (command === "z3-test" && args[0] === "-version") {
    return { status: 0, stdout: "Z3 version 4.13.0\n", stderr: "" };
  }
  if (command === "z3-test") {
    return { status: 0, stdout: "sat\n", stderr: "" };
  }
  if (command === "lean-test" && args[0] === "--version") {
    return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
  }
  if (command === "lean-test") {
    return { status: 0, stdout: "", stderr: "" };
  }

  return {
    status: null,
    stdout: "",
    stderr: "",
    error: { name: "Error", message: `unexpected command ${command} ${args.join(" ")}` }
  };
};

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeBenchmarkComparisonRecord, writeBenchmarkRunRecord, type BenchmarkRunLike } from "./benchmark-run.js";
import { createSimulationLogEntry } from "./simulation-log.js";
import { writeSymbolicCasCheckRecord, type CasBackendCommandRunner } from "./cas-backend.js";
import { writeExpertReview } from "./expert-review.js";
import {
  attachValidationGateEvidence,
  createValidationPlan,
  listValidationPlans,
  renderValidationPlanMarkdown,
  writeValidationPlan
} from "./validation-plan.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { createReceipt } from "./receipt.js";
import { solveSmtProblem } from "./smt-problem.js";
import type { SmtBackendCommandRunner } from "./smt-backend.js";
import { writeVerifierRoute } from "./verifier-route.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("validation plans", () => {
  it("keeps cancer simulation claims behind wet-lab, clinical, safety, and regulatory gates", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const simulation = await createSimulationLogEntry({
      rootPath: root,
      question: "Could a toy pathway simulation lower a cancer marker?",
      kind: "molecular",
      engine: "local python",
      modelName: "toy pathway ODE",
      metrics: [{ name: "marker_delta", value: "-0.12", note: "toy-model-only" }],
      assumptions: ["Toy model, not calibrated biology."],
      uncertainty: ["No calibrated uncertainty model."],
      limitations: ["No wet-lab, preclinical, clinical, safety, or regulatory evidence."],
      nextChecks: ["Run sensitivity analysis and expert review."]
    });

    const plan = await createValidationPlan({
      rootPath: root,
      claim: "This simulated candidate cures cancer safely.",
      evidenceRefs: [{ kind: "simulation", ref: simulation.entry.simulationId }]
    });

    expect(plan.schemaVersion).toBe("truth-harness.validation-plan.v0");
    expect(plan.domains).toContain("biomedical");
    expect(plan.audit.verdict.status).toBe("overclaimed");
    expect(plan.readiness.status).toBe("not-ready");
    expect(plan.recommendedClaimLanguage).toContain("unvalidated biomedical hypothesis");
    expect(plan.gates.find((gate) => gate.kind === "wet-lab")?.status).toBe("missing");
    expect(plan.gates.find((gate) => gate.kind === "clinical")?.blocking).toBe(true);
    expect(plan.warnings.join(" ")).toContain("cure");
    expect(renderValidationPlanMarkdown(plan)).toContain("| Readiness | `not-ready` |");
  });

  it("marks scoped expert review as satisfying the expert-review gate without turning it into proof", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const review = await writeExpertReview({
      rootPath: root,
      subject: "Cancer pathway evidence packet",
      question: "Does the packet support only a computational hypothesis?",
      kind: "biomedical",
      status: "completed",
      reviewerRole: "oncology domain expert",
      findings: ["The packet is useful only for hypothesis generation."],
      limitations: ["No wet-lab or clinical validation was reviewed."],
      requiredNextChecks: ["Attach wet-lab protocol and independent replication plan."],
      outcomeStatus: "supported-with-limitations"
    });

    const written = await writeValidationPlan({
      rootPath: root,
      claim: "The cancer pathway packet is a hypothesis-generation artifact, not a cure claim.",
      evidenceRefs: [{ kind: "review", ref: review.review.reviewId }]
    });
    const listed = await listValidationPlans(root);

    expect(written.plan.gates.find((gate) => gate.kind === "expert-review")?.status).toBe("satisfied");
    expect(written.plan.boundary.notMedicalAdvice).toBe(true);
    expect(written.plan.boundary.aiOutputIsNotTruth).toBe(true);
    expect(written.markdown).toContain("not proof, medical advice, regulatory approval, legal advice");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.planId).toBe(written.plan.planId);
  });

  it("rejects malformed validation plans before writing artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    await expect(
      writeValidationPlan({
        rootPath: root,
        claim: "A malformed validation plan should never become durable reviewer guidance.",
        domains: ["math"],
        now: "not-a-date"
      })
    ).rejects.toThrow("Validation plan failed JSON Schema validation before write");

    await expect(listValidationPlans(root)).resolves.toEqual([]);
  });

  it("updates proof gates from concrete verifier route evidence without trusting weak evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const written = await writeValidationPlan({
      rootPath: root,
      claim: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:00:00.000Z"
    });
    const proofGate = written.plan.gates.find((gate) => gate.kind === "proof");
    if (!proofGate) {
      throw new Error("Expected a proof gate.");
    }

    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "3 / 4 + 5 / 8",
      now: new Date("2026-06-18T00:01:00.000Z")
    });
    const attached = await attachValidationGateEvidence({
      rootPath: root,
      planRef: written.plan.planId,
      gateId: proofGate.gateId,
      evidenceRef: {
        kind: "route",
        ref: route.route.routeId
      },
      now: "2026-06-18T00:02:00.000Z"
    });

    expect(attached.satisfied).toBe(true);
    expect(attached.gate).toMatchObject({
      status: "satisfied",
      evidenceRefs: [expect.objectContaining({ kind: "route", ref: route.route.routeId, trust: "exact-computed" })]
    });
    expect(attached.plan.readiness.satisfiedGateCount).toBeGreaterThan(written.plan.readiness.satisfiedGateCount);
    expect(attached.markdown).toContain("route:");

    const latexPlan = await writeValidationPlan({
      rootPath: root,
      claim: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:02:10.000Z"
    });
    const latexGate = latexPlan.plan.gates.find((gate) => gate.kind === "proof");
    if (!latexGate) {
      throw new Error("Expected a LaTeX boundary proof gate.");
    }
    const latexRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "3 / 4 + 5 / 8",
      now: new Date("2026-06-18T00:02:20.000Z")
    });
    await writeFile(
      latexRoute.jsonPath,
      `${JSON.stringify(
        {
          ...latexRoute.route,
          problem: "\\frac{3}{4}+\\frac{5}{8} = \\frac{11}{8}",
          normalizedProblem: "\\frac{3}{4}+\\frac{5}{8} = \\frac{11}{8}"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const latexAttachment = await attachValidationGateEvidence({
      rootPath: root,
      planRef: latexPlan.plan.planId,
      gateId: latexGate.gateId,
      evidenceRef: {
        kind: "route",
        ref: latexRoute.route.routeId
      },
      now: "2026-06-18T00:02:30.000Z"
    });

    expect(latexAttachment.satisfied).toBe(true);
    expect(latexAttachment.evidence.claimScope).toMatchObject({ status: "matched" });
    expect(latexAttachment.evidence.claimScope?.reason).toContain("exact arithmetic boundary normalization");

    const weakPlan = await writeValidationPlan({
      rootPath: root,
      claim: "Explain the unresolved deterministic robotics invariant.",
      domains: ["math"],
      now: "2026-06-18T00:03:00.000Z"
    });
    const weakGate = weakPlan.plan.gates.find((gate) => gate.kind === "proof");
    if (!weakGate) {
      throw new Error("Expected a weak proof gate.");
    }
    const weakRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "Explain the unresolved deterministic robotics invariant.",
      now: new Date("2026-06-18T00:04:00.000Z")
    });
    const weakAttachment = await attachValidationGateEvidence({
      rootPath: root,
      planRef: weakPlan.plan.planId,
      gateId: weakGate.gateId,
      evidenceRef: {
        kind: "route",
        ref: weakRoute.route.routeId
      },
      now: "2026-06-18T00:05:00.000Z"
    });

    expect(weakAttachment.satisfied).toBe(false);
    expect(weakAttachment.gate.status).toBe("in-progress");
    expect(weakAttachment.gate.evidenceRefs).toContainEqual(
      expect.objectContaining({ kind: "route", ref: weakRoute.route.routeId, trust: "unverified" })
    );
    expect(weakAttachment.message).toContain("remains open");

    const mismatchPlan = await writeValidationPlan({
      rootPath: root,
      claim: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:06:00.000Z"
    });
    const mismatchGate = mismatchPlan.plan.gates.find((candidate) => candidate.kind === "proof");
    if (!mismatchGate) {
      throw new Error("Expected a mismatch proof gate.");
    }
    const unrelatedRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "2 + 2",
      now: new Date("2026-06-18T00:07:00.000Z")
    });
    const mismatchAttachment = await attachValidationGateEvidence({
      rootPath: root,
      planRef: mismatchPlan.plan.planId,
      gateId: mismatchGate.gateId,
      evidenceRef: {
        kind: "route",
        ref: unrelatedRoute.route.routeId
      },
      now: "2026-06-18T00:08:00.000Z"
    });

    expect(unrelatedRoute.route.finalTrust).toBe("exact-computed");
    expect(mismatchAttachment.satisfied).toBe(false);
    expect(mismatchAttachment.gate.status).toBe("in-progress");
    expect(mismatchAttachment.message).toContain("not scoped to this validation claim");
    expect(mismatchAttachment.gate.nextChecks.join(" ")).toContain("does not match validation claim");
  });

  it("does not close validation proof gates from unscoped direct proof artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const unscopedProofRef = ".truth-harness/proofs/accepted-unscoped-proof.json";
    const scopedProofRef = ".truth-harness/proofs/accepted-scoped-proof.json";
    await mkdir(join(root, ".truth-harness", "proofs"), { recursive: true });

    const acceptedProof = {
      schemaVersion: "truth-harness.proof-check.v0",
      checkId: "proof_2222222222222222",
      createdAt: "2026-06-18T01:00:00.000Z",
      backend: {
        id: "lean",
        displayName: "Lean proof checker",
        adapter: "local-lean-subprocess",
        role: "proof-checker",
        acceptedProofChecker: true,
        command: "lean",
        args: ["claim.lean"],
        exitCode: 0
      },
      source: {
        path: "claim.lean",
        sha256: "2222222222222222222222222222222222222222222222222222222222222222",
        byteLength: 32
      },
      status: "accepted",
      trust: "proved",
      proofCheckerBacked: true,
      localOnly: true,
      networkAccess: "none",
      replay: "truth-harness proof check claim.lean --write --json",
      limitations: ["Unit-test proof fixture."],
      warnings: []
    };
    await writeFile(join(root, unscopedProofRef), `${JSON.stringify(acceptedProof, null, 2)}\n`, "utf8");
    await writeFile(
      join(root, scopedProofRef),
      `${JSON.stringify(
        {
          ...acceptedProof,
          checkId: "proof_3333333333333333",
          source: {
            ...acceptedProof.source,
            sha256: "3333333333333333333333333333333333333333333333333333333333333333"
          },
          scope: {
            statement: "The accepted Lean proof proves the informal claim."
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const unscopedPlan = await writeValidationPlan({
      rootPath: root,
      claim: "The accepted Lean proof proves the informal claim.",
      domains: ["math"],
      now: "2026-06-18T01:05:00.000Z"
    });
    const unscopedGate = unscopedPlan.plan.gates.find((gate) => gate.kind === "proof");
    if (!unscopedGate) {
      throw new Error("Expected an unscoped proof gate.");
    }
    const unscopedAttachment = await attachValidationGateEvidence({
      rootPath: root,
      planRef: unscopedPlan.plan.planId,
      gateId: unscopedGate.gateId,
      evidenceRef: { kind: "proof", ref: unscopedProofRef },
      now: "2026-06-18T01:06:00.000Z"
    });

    expect(unscopedAttachment.evidence.trust).toBe("proved");
    expect(unscopedAttachment.satisfied).toBe(false);
    expect(unscopedAttachment.gate.status).toBe("in-progress");
    expect(unscopedAttachment.gate.nextChecks.join(" ")).toContain("no machine-checkable claim boundary");

    const scopedPlan = await writeValidationPlan({
      rootPath: root,
      claim: "The accepted Lean proof proves the informal claim.",
      domains: ["math"],
      now: "2026-06-18T01:07:00.000Z"
    });
    const scopedGate = scopedPlan.plan.gates.find((gate) => gate.kind === "proof");
    if (!scopedGate) {
      throw new Error("Expected a scoped proof gate.");
    }
    const scopedAttachment = await attachValidationGateEvidence({
      rootPath: root,
      planRef: scopedPlan.plan.planId,
      gateId: scopedGate.gateId,
      evidenceRef: { kind: "proof", ref: scopedProofRef },
      now: "2026-06-18T01:08:00.000Z"
    });

    expect(scopedAttachment.satisfied).toBe(true);
    expect(scopedAttachment.gate.status).toBe("satisfied");
    expect(scopedAttachment.evidence.claimScope).toMatchObject({ status: "matched" });
  });

  it("closes proof gates from scoped SMT query evidence only when query boundaries match", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const smt = await solveSmtProblem({
      rootPath: root,
      queryName: "bounded_integer_sat",
      variables: ["x"],
      constraints: ["x > 0", "x < 3"],
      includeModel: true,
      runner: z3SatRunner
    });
    const smtRef = toWorkspaceRef(root, smt.check.jsonPath);

    const mismatch = await writeValidationPlan({
      rootPath: root,
      claim: "SMT query another_query",
      domains: ["math"],
      now: "2026-06-18T02:00:00.000Z"
    });
    const mismatchGate = requiredProofGate(mismatch.plan);
    const mismatchAttachment = await attachValidationGateEvidence({
      rootPath: root,
      planRef: mismatch.plan.planId,
      gateId: mismatchGate.gateId,
      evidenceRef: { kind: "smt", ref: smtRef },
      now: "2026-06-18T02:01:00.000Z"
    });

    expect(mismatchAttachment.evidence.trust).toBe("smt-checked");
    expect(mismatchAttachment.satisfied).toBe(false);
    expect(mismatchAttachment.evidence.claimScope).toMatchObject({ status: "mismatch" });

    const scoped = await writeValidationPlan({
      rootPath: root,
      claim: "SMT query bounded_integer_sat",
      domains: ["math"],
      now: "2026-06-18T02:02:00.000Z"
    });
    const scopedGate = requiredProofGate(scoped.plan);
    const scopedAttachment = await attachValidationGateEvidence({
      rootPath: root,
      planRef: scoped.plan.planId,
      gateId: scopedGate.gateId,
      evidenceRef: { kind: "smt", ref: smtRef },
      now: "2026-06-18T02:03:00.000Z"
    });

    expect(scopedAttachment.satisfied).toBe(true);
    expect(scopedAttachment.gate.status).toBe("satisfied");
    expect(scopedAttachment.evidence.claimScope).toMatchObject({ status: "matched" });
  });

  it("closes proof gates from scoped independent CAS evidence only when symbolic boundaries match", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const cas = await writeSymbolicCasCheckRecord({
      rootPath: root,
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      result: "1",
      runner: maximaPassingRunner
    });
    const casRef = toWorkspaceRef(root, cas.jsonPath);

    const mismatch = await writeValidationPlan({
      rootPath: root,
      claim: "symbolic simplify sin(x)^2",
      domains: ["math"],
      now: "2026-06-18T02:10:00.000Z"
    });
    const mismatchAttachment = await attachValidationGateEvidence({
      rootPath: root,
      planRef: mismatch.plan.planId,
      gateId: requiredProofGate(mismatch.plan).gateId,
      evidenceRef: { kind: "cas", ref: casRef },
      now: "2026-06-18T02:11:00.000Z"
    });

    expect(mismatchAttachment.evidence.trust).toBe("cross-checked");
    expect(mismatchAttachment.satisfied).toBe(false);
    expect(mismatchAttachment.evidence.claimScope).toMatchObject({ status: "mismatch" });

    const scoped = await writeValidationPlan({
      rootPath: root,
      claim: "symbolic simplify sin(x)^2 + cos(x)^2",
      domains: ["math"],
      now: "2026-06-18T02:12:00.000Z"
    });
    const scopedAttachment = await attachValidationGateEvidence({
      rootPath: root,
      planRef: scoped.plan.planId,
      gateId: requiredProofGate(scoped.plan).gateId,
      evidenceRef: { kind: "cas", ref: casRef },
      now: "2026-06-18T02:13:00.000Z"
    });

    expect(scopedAttachment.satisfied).toBe(true);
    expect(scopedAttachment.gate.status).toBe("satisfied");
    expect(scopedAttachment.evidence.claimScope).toMatchObject({ status: "matched" });
  });

  it("uses benchmark comparisons as conservative benchmark-gate evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const receipt = createReceipt("compute 2 + 2");
    const baseline = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt),
      suitePath: "packages/benchmarks/suites/tiny.json",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json --write",
      now: "2026-06-18T03:00:00.000Z"
    });
    const unchangedCurrent = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt),
      suitePath: "packages/benchmarks/suites/tiny.json",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json --write",
      now: "2026-06-18T03:01:00.000Z"
    });
    const regressedCurrent = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt, {
        expectTrust: "refuted",
        passed: false,
        failures: ["Expected trust refuted, received exact-computed"]
      }),
      suitePath: "packages/benchmarks/suites/tiny.json",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json --write",
      now: "2026-06-18T03:02:00.000Z"
    });
    const unchangedComparison = await writeBenchmarkComparisonRecord({
      rootPath: root,
      baseline: baseline.record,
      current: unchangedCurrent.record,
      baselineRef: toWorkspaceRef(root, baseline.jsonPath),
      currentRef: toWorkspaceRef(root, unchangedCurrent.jsonPath),
      now: "2026-06-18T03:03:00.000Z"
    });
    const regressedComparison = await writeBenchmarkComparisonRecord({
      rootPath: root,
      baseline: baseline.record,
      current: regressedCurrent.record,
      baselineRef: toWorkspaceRef(root, baseline.jsonPath),
      currentRef: toWorkspaceRef(root, regressedCurrent.jsonPath),
      now: "2026-06-18T03:04:00.000Z"
    });

    const plan = await writeValidationPlan({
      rootPath: root,
      claim: "The verifier did not regress on the tiny benchmark suite.",
      domains: ["software"],
      now: "2026-06-18T03:05:00.000Z"
    });
    const benchmarkGate = plan.plan.gates.find((gate) => gate.kind === "benchmark");
    if (!benchmarkGate) {
      throw new Error("Expected a benchmark gate.");
    }
    const satisfied = await attachValidationGateEvidence({
      rootPath: root,
      planRef: plan.plan.planId,
      gateId: benchmarkGate.gateId,
      evidenceRef: { kind: "benchmark", ref: toWorkspaceRef(root, unchangedComparison.jsonPath) },
      now: "2026-06-18T03:06:00.000Z"
    });

    expect(unchangedComparison.record.verdict).toBe("unchanged");
    expect(satisfied.satisfied).toBe(true);
    expect(satisfied.evidence).toMatchObject({
      schemaVersion: "truth-harness.benchmark-comparison.v0",
      status: "passed",
      artifactId: unchangedComparison.record.comparisonId
    });
    expect(satisfied.gate.status).toBe("satisfied");
    expect(satisfied.gate.nextChecks).toContain("inspect every non-unchanged case before publishing benchmark claims");

    const regressedPlan = await writeValidationPlan({
      rootPath: root,
      claim: "The verifier did not regress on the tiny benchmark suite.",
      domains: ["software"],
      now: "2026-06-18T03:07:00.000Z"
    });
    const regressedGate = regressedPlan.plan.gates.find((gate) => gate.kind === "benchmark");
    if (!regressedGate) {
      throw new Error("Expected a regressed benchmark gate.");
    }
    const blocked = await attachValidationGateEvidence({
      rootPath: root,
      planRef: regressedPlan.plan.planId,
      gateId: regressedGate.gateId,
      evidenceRef: { kind: "benchmark", ref: toWorkspaceRef(root, regressedComparison.jsonPath) },
      now: "2026-06-18T03:08:00.000Z"
    });

    expect(regressedComparison.record.verdict).toBe("regressed");
    expect(blocked.satisfied).toBe(false);
    expect(blocked.evidence).toMatchObject({
      schemaVersion: "truth-harness.benchmark-comparison.v0",
      status: "failed",
      artifactId: regressedComparison.record.comparisonId
    });
    expect(blocked.gate.status).toBe("in-progress");
    expect(blocked.gate.nextChecks).toContain("triage regressions and new failures before claiming progress");
  });

  it("requires prior art, claim charts, reduction-to-practice, and patent legal review for invention claims", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const legalReview = await writeExpertReview({
      rootPath: root,
      subject: "Provisional patent draft posture",
      kind: "patent-legal",
      status: "requested",
      reviewerRole: "patent attorney",
      requiredNextChecks: ["Attach claim chart and prior-art search notes."]
    });

    const plan = await createValidationPlan({
      rootPath: root,
      claim: "This invention is novel and ready for a provisional patent filing.",
      evidenceRefs: [{ kind: "review", ref: legalReview.review.reviewId }]
    });

    expect(plan.domains).toContain("patent");
    expect(plan.gates.find((gate) => gate.kind === "prior-art")?.status).toBe("missing");
    expect(plan.gates.find((gate) => gate.kind === "claim-chart")?.status).toBe("missing");
    expect(plan.gates.find((gate) => gate.kind === "reduction-to-practice")?.status).toBe("missing");
    expect(plan.gates.find((gate) => gate.kind === "patent-legal")?.status).toBe("in-progress");
    expect(plan.warnings.join(" ")).toContain("patent-attorney review");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-validation-plan-"));
  tempRoots.push(root);
  return root;
}

function requiredProofGate(plan: { gates: Array<{ kind: string; gateId: string }> }): { gateId: string } {
  const gate = plan.gates.find((candidate) => candidate.kind === "proof");
  if (!gate) {
    throw new Error("Expected a proof gate.");
  }
  return gate;
}

function toWorkspaceRef(root: string, absolutePath: string): string {
  return absolutePath.slice(root.length + 1).replace(/\\/g, "/");
}

function benchmarkRun(
  receipt: ReturnType<typeof createReceipt>,
  options: {
    expectTrust?: BenchmarkRunLike["results"][number]["task"]["expectTrust"];
    passed?: boolean;
    failures?: string[];
  } = {}
): BenchmarkRunLike {
  const expectedTrust = options.expectTrust ?? receipt.trust;
  const passed = options.passed ?? true;

  return {
    suiteId: "tiny-suite",
    title: "Tiny Suite",
    startedAt: "2026-06-18T00:30:00.000Z",
    completedAt: "2026-06-18T00:30:01.000Z",
    total: 1,
    passed: passed ? 1 : 0,
    failed: passed ? 0 : 1,
    trustAccuracy: passed ? 1 : 0,
    results: [
      {
        task: {
          id: "tiny-case",
          prompt: receipt.problem,
          expectTrust: expectedTrust,
          expectEvidenceKind: receipt.evidenceProfile.kind,
          level: "level-1-exact-arithmetic",
          category: "exact-computation",
          aiFailureMode: "wrong arithmetic"
        },
        receipt,
        passed,
        failures: options.failures ?? []
      }
    ]
  };
}

const z3SatRunner: SmtBackendCommandRunner = (_command, args) => {
  if (args.includes("-version")) {
    return { status: 0, stdout: "Z3 version 4.13.0\n", stderr: "" };
  }
  return {
    status: 0,
    stdout: "sat\n(\n  (define-fun x () Int\n    1)\n)\n",
    stderr: ""
  };
};

const maximaPassingRunner: CasBackendCommandRunner = (_command, args) => {
  if (args.includes("--version")) {
    return { status: 0, stdout: "Maxima 5.47.0\n", stderr: "" };
  }
  return {
    status: 0,
    stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n",
    stderr: ""
  };
};

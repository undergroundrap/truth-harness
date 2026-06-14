import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReceipt, writeReceiptPlotVisualArtifact } from "@truth-harness/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  handleTruthHarnessAsk,
  handleTruthHarnessBenchmarkCompare,
  handleTruthHarnessBenchmarkList,
  handleTruthHarnessBenchmarkRun,
  handleTruthHarnessCasBackends,
  handleTruthHarnessCasCheck,
  handleTruthHarnessCasList,
  handleTruthHarnessClaimAdd,
  handleTruthHarnessClaimChart,
  handleTruthHarnessClaimChartList,
  handleTruthHarnessClaimList,
  handleTruthHarnessClaimReview,
  handleTruthHarnessClaimShow,
  handleTruthHarnessCodeRun,
  handleTruthHarnessCodeRunList,
  handleTruthHarnessCodeSandboxStatus,
  handleTruthHarnessDiscoveryPackage,
  handleTruthHarnessEngineManifest,
  handleTruthHarnessEvidenceAudit,
  handleTruthHarnessEvidenceAuditList,
  handleTruthHarnessExpertReviewList,
  handleTruthHarnessExpertReviewLog,
  handleTruthHarnessExperimentList,
  handleTruthHarnessExperimentLog,
  handleTruthHarnessExternalDisclosureList,
  handleTruthHarnessExternalDisclosureLog,
  handleTruthHarnessInventionList,
  handleTruthHarnessInventionLog,
  handleTruthHarnessLiteratureList,
  handleTruthHarnessLiteratureLog,
  handleTruthHarnessModelContextList,
  handleTruthHarnessModelContextPrepare,
  handleTruthHarnessNotebookRunList,
  handleTruthHarnessNotebookRunLog,
  handleTruthHarnessProofBackends,
  handleTruthHarnessProofCheck,
  handleTruthHarnessProofList,
  handleTruthHarnessRenderReceipt,
  handleTruthHarnessReplay,
  handleTruthHarnessResearchSessionCheckpoint,
  handleTruthHarnessResearchSessionList,
  handleTruthHarnessResearchSessionShow,
  handleTruthHarnessResearchSessionStart,
  handleTruthHarnessResearchSessionTaskUpdate,
  handleTruthHarnessRouteList,
  handleTruthHarnessRouteShow,
  handleTruthHarnessRouteSatisfy,
  handleTruthHarnessSimulationList,
  handleTruthHarnessSimulationLog,
  handleTruthHarnessSmtBackends,
  handleTruthHarnessSmtCheck,
  handleTruthHarnessSmtList,
  handleTruthHarnessSmtSolve,
  handleTruthHarnessSourceCite,
  handleTruthHarnessSourceIngest,
  handleTruthHarnessSourceSearch,
  handleTruthHarnessValidationPlan,
  handleTruthHarnessValidationPlanList,
  handleTruthHarnessVaultList,
  handleTruthHarnessVaultSeal,
  handleTruthHarnessVaultVerify,
  handleTruthHarnessVisualGraph,
  handleTruthHarnessVisualList,
  handleTruthHarnessVisualRender,
  handleTruthHarnessVisualShow,
  handleTruthHarnessVerify,
  handleTruthHarnessWorkspaceInit,
  handleTruthHarnessWorkspaceGraph,
  handleTruthHarnessWorkspaceRepair,
  handleTruthHarnessWorkspaceReview,
  handleTruthHarnessWorkspaceReviewList,
  handleTruthHarnessWorkspaceReviewShow,
  handleTruthHarnessWorkspaceRunNext,
  handleTruthHarnessWorkspaceSnapshot,
  handleTruthHarnessWorkspaceSnapshotList,
  handleTruthHarnessWorkspaceSnapshotVerify,
  handleTruthHarnessWorkspaceStatus,
  handleTruthHarnessWorkspaceValidate,
  truthHarnessBenchmarkCompareOutputFailsGate,
  truthHarnessBenchmarkRunOutputFailsGate,
  toolJson
} from "./tools.js";

const receiptPath = join("receipts", "mcp-test.json");
const tempRoots: string[] = [];
const originalWorkspaceRoot = process.env.TRUTH_HARNESS_ROOT;
const originalLeanCommand = process.env.TRUTH_HARNESS_LEAN;
const originalCodeRunOptIn = process.env.TRUTH_HARNESS_ALLOW_CODE_RUN;
const originalUnsandboxedCodeRunOptIn = process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN;
const originalGraphvizDot = process.env.TRUTH_HARNESS_GRAPHVIZ_DOT;
const vaultKeyEnv = "TRUTH_HARNESS_MCP_TEST_VAULT_KEY";
const originalVaultKey = process.env[vaultKeyEnv];

afterEach(async () => {
  // Keep generated receipts ignored by git; replay tests overwrite them when needed.
  restoreWorkspaceRoot();
  restoreLeanCommand();
  restoreCodeRunOptIn();
  restoreUnsandboxedCodeRunOptIn();
  restoreGraphvizDot();
  restoreVaultKey();
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("MCP tool handlers", () => {
  it("creates proof receipts for agents", () => {
    const result = handleTruthHarnessAsk({ problem: "for all integers n, n^2+n+1 is even" });

    expect(result.error).toBe(false);
    expect(result.receipt.trust).toBe("refuted");
    expect(result.message).toContain(result.receipt.runId);
  });

  it("marks strict unverified receipts as tool errors", () => {
    const result = handleTruthHarnessAsk({ problem: "for all integers n, 2*(n/1) is even", strict: true });

    expect(result.error).toBe(true);
    expect(result.receipt.trust).toBe("unverified");
  });

  it("routes verification for agents before they rely on a claim", async () => {
    const result = await handleTruthHarnessVerify({
      problem: "compute 3 / 4 + 5 / 8",
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    expect(result.error).toBe(false);
    expect(result.written).toBe(false);
    expect(result.route.schemaVersion).toBe("truth-harness.verifier-route.v0");
    expect(result.route.finalTrust).toBe("exact-computed");
    expect(result.route.usedCapabilities).toContainEqual(
      expect.objectContaining({
        capabilityId: "local-rational-arithmetic"
      })
    );
    expect(result.route.trustBoundary.routeIsNotProof).toBe(true);
    expect(result.message).toContain(result.route.routeId);
  });

  it("writes and reopens verifier routes for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Route Lab" });
    const result = await handleTruthHarnessVerify({
      write: true,
      problem: "compute 3 / 4 + 5 / 8",
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const list = await handleTruthHarnessRouteList({});
    const shown = await handleTruthHarnessRouteShow({
      routeRef: result.route.routeId
    });
    const openProofObligations = result.route.proofObligations.filter(
      (candidate) => candidate.status === "open"
    ).length;
    const satisfiedProofObligations = result.route.proofObligations.filter(
      (candidate) => candidate.status === "satisfied"
    ).length;
    const notRequiredProofObligations = result.route.proofObligations.filter(
      (candidate) => candidate.status === "not-required"
    ).length;
    const criticalOpenProofObligations = result.route.proofObligations.filter(
      (candidate) => candidate.status === "open" && candidate.severity === "critical"
    ).length;

    expect(result.error).toBe(false);
    expect(result.written).toBe(true);
    expect(result.result?.jsonPath).toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.routes[0]).toMatchObject({
      routeId: result.route.routeId,
      finalTrust: "exact-computed",
      proofObligations: result.route.proofObligations.length,
      openProofObligations,
      satisfiedProofObligations,
      notRequiredProofObligations,
      criticalOpenProofObligations
    });
    expect(shown.routeId).toBe(result.route.routeId);
  });

  it("satisfies verifier route obligations for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Obligation Lab" });
    const result = await handleTruthHarnessVerify({
      write: true,
      problem: "prove the Riemann hypothesis",
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = result.route.proofObligations.find((candidate) => candidate.kind === "formal-proof");
    const proofRef = join(".truth-harness", "proofs", "manual-proof.json");
    await mkdir(join(root, ".truth-harness", "proofs"), { recursive: true });
    await writeFile(
      join(root, proofRef),
      `${JSON.stringify(
        {
          schemaVersion: "truth-harness.proof-check.v0",
          checkId: "proof_0123456789abcdef",
          createdAt: "2026-06-12T00:00:00.000Z",
          backend: {
            id: "lean",
            displayName: "Lean proof checker",
            adapter: "local-lean-subprocess",
            role: "proof-checker",
            acceptedProofChecker: true,
            command: "lean",
            args: ["trivial.lean"],
            exitCode: 0
          },
          source: {
            path: "trivial.lean",
            sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            byteLength: 16
          },
          status: "accepted",
          trust: "proved",
          proofCheckerBacked: true,
          localOnly: true,
          networkAccess: "none",
          replay: "truth-harness proof check trivial.lean --write --json",
          limitations: ["Test fixture for route-satisfaction contract only."],
          warnings: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const satisfied = await handleTruthHarnessRouteSatisfy({
      routeRef: result.route.routeId,
      obligationId: obligation?.obligationId ?? "",
      evidenceRef: { kind: "proof", ref: proofRef }
    });
    const shown = await handleTruthHarnessRouteShow({
      routeRef: result.route.routeId
    });
    const list = await handleTruthHarnessRouteList({});

    expect(satisfied.obligation.status).toBe("satisfied");
    expect(satisfied.evidence).toMatchObject({
      kind: "proof",
      ref: proofRef,
      trust: "proved",
      schemaVersion: "truth-harness.proof-check.v0"
    });
    expect(shown.proofObligations.find((candidate) => candidate.obligationId === obligation?.obligationId)).toMatchObject({
      status: "satisfied"
    });
    expect(list.routes[0]).toMatchObject({
      routeId: result.route.routeId,
      proofObligations: result.route.proofObligations.length,
      openProofObligations: result.route.proofObligations.length - 1,
      satisfiedProofObligations: 1,
      criticalOpenProofObligations: result.route.proofObligations.length - 1
    });
  });

  it("reports local CAS backend readiness for agents", () => {
    const result = handleTruthHarnessCasBackends({
      maximaCommand: "truth-harness-missing-maxima-command",
      sageCommand: "truth-harness-missing-sage-command",
      timeoutMs: 1000
    });

    expect(result.schemaVersion).toBe("truth-harness.cas-backends.v0");
    expect(result.localOnly).toBe(true);
    expect(result.networkAccess).toBe("none");
    expect(result.backends[0]?.backendId).toBe("maxima");
    expect(result.backends[0]?.role).toBe("cas");
    expect(result.backends[0]?.statusProbeMintedCheck).toBe(false);
    expect(result.backends[1]?.backendId).toBe("sage");
    expect(result.backends[1]?.adapter).toBe("local-sagemath-status-probe");
    expect(result.backends[1]?.canCheckSymbolic).toBe(false);
    expect(result.trustBoundary.statusProbeIsNotCheck).toBe(true);
    expect(result.trustBoundary.crossCheckedRequiresIndependentRun).toBe(true);
  });

  it("checks symbolic CAS results for agents without minting trust when Maxima is unavailable", async () => {
    const result = await handleTruthHarnessCasCheck({
      operation: "simplify",
      expression: "sin(x)^2 + cos(x)^2",
      result: "1",
      variable: "x",
      maximaCommand: "truth-harness-missing-maxima-command",
      timeoutMs: 50,
      failOnUnverified: true
    });

    expect(result.error).toBe(true);
    expect(result.record.schemaVersion).toBe("truth-harness.cas-check.v0");
    expect(result.record.status).toBe("solver-unavailable");
    expect(result.record.trust).toBe("unverified");
    expect(result.record.proofCheckerBacked).toBe(false);
    expect(result.record.backend.acceptedProofChecker).toBe(false);
    expect(result.message).toContain("CAS gate failed");
  });

  it("writes and lists CAS check records for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP CAS Lab" });

    const result = await handleTruthHarnessCasCheck({
      operation: "simplify",
      expression: "sin(x)^2 + cos(x)^2",
      result: "1",
      variable: "x",
      maximaCommand: "truth-harness-missing-maxima-command",
      timeoutMs: 50,
      write: true
    });
    const list = await handleTruthHarnessCasList({});
    const validation = await handleTruthHarnessWorkspaceValidate({});

    expect(result.error).toBe(false);
    expect(result.written).toBe(true);
    expect(result.result?.jsonPath).toContain(".truth-harness");
    expect(result.record.trust).toBe("unverified");
    expect(list.total).toBe(1);
    expect(list.checks[0]?.checkId).toBe(result.record.checkId);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.cas).toBe(1);
  });

  it("reports the local engine capability manifest for agents", () => {
    const result = handleTruthHarnessEngineManifest({
      maximaCommand: "truth-harness-missing-maxima-command",
      sageCommand: "truth-harness-missing-sage-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    expect(result.schemaVersion).toBe("truth-harness.engine-manifest.v0");
    expect(result.localOnly).toBe(true);
    expect(result.networkAccess).toBe("none");
    expect(result.capabilities).toContainEqual(
      expect.objectContaining({
        id: "local-rational-arithmetic",
        kind: "native-kernel",
        status: "ready",
        canMintTrust: true
      })
    );
    expect(result.capabilities).toContainEqual(
      expect.objectContaining({
        id: "z3-smt-solver",
        kind: "adapter",
        status: "missing",
        canMintTrust: false
      })
    );
    expect(result.capabilities).toContainEqual(
      expect.objectContaining({
        id: "sage-cas",
        kind: "adapter",
        status: "missing",
        canMintTrust: false
      })
    );
    expect(result.trustBoundary.statusProbeIsNotEvidence).toBe(true);
  });

  it("writes and reads claim ledger records for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Claim Lab" });
    const receiptsDir = join(root, ".truth-harness", "receipts");
    await mkdir(receiptsDir, { recursive: true });
    await writeFile(
      join(receiptsDir, "base-fraction.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4"), null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(receiptsDir, "fraction-sum.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4 + 5 / 8"), null, 2)}\n`,
      "utf8"
    );

    const base = await handleTruthHarnessClaimAdd({
      statement: "3 / 4 is exactly 3 / 4.",
      domain: "math",
      trust: "exact-computed",
      tags: ["fractions"],
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/base-fraction.json" }]
    });
    const derived = await handleTruthHarnessClaimAdd({
      statement: "3 / 4 + 5 / 8 equals 11 / 8.",
      domain: "math",
      trust: "exact-computed",
      dependsOn: [base.claim.claimId],
      evidenceRefs: [
        { kind: "claim", ref: base.claim.claimId },
        { kind: "receipt", ref: ".truth-harness/receipts/fraction-sum.json" }
      ]
    });
    const list = await handleTruthHarnessClaimList({ domain: "math" });
    const shown = await handleTruthHarnessClaimShow({ claimRef: derived.claim.claimId });
    const review = await handleTruthHarnessClaimReview({ claimRef: derived.claim.claimId });
    const validation = await handleTruthHarnessWorkspaceValidate({});

    expect(base.claim.claimId).toMatch(/^claim_[a-f0-9]{16}$/);
    expect(derived.claim.dependsOn).toEqual([base.claim.claimId]);
    expect(derived.claim.finalization.readyForNarrowClaim).toBe(true);
    expect(list.total).toBe(2);
    expect(list.graph.edges).toContainEqual({
      from: base.claim.claimId,
      to: derived.claim.claimId,
      kind: "depends-on"
    });
    expect(shown.claimId).toBe(derived.claim.claimId);
    expect(review.claimId).toBe(derived.claim.claimId);
    expect(review.reviewStatus).toBe("ready");
    expect(review.commands.reviewJson).toContain("truth-harness claim review");
    expect(review.markdown).toContain("## Agent Next Actions");
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.claims).toBe(2);
  });

  it("reports local proof backend readiness for agents", () => {
    const result = handleTruthHarnessProofBackends({ timeoutMs: 1000 });

    expect(result.schemaVersion).toBe("truth-harness.proof-backends.v0");
    expect(result.localOnly).toBe(true);
    expect(result.networkAccess).toBe("none");
    expect(result.backends[0]?.backendId).toBe("lean");
    expect(result.backends[0]?.role).toBe("proof-checker");
    expect(result.backends[0]?.statusProbeMintedProof).toBe(false);
    expect(result.trustBoundary.statusProbeIsNotProof).toBe(true);
    expect(result.trustBoundary.provedRequiresSuccessfulProofRun).toBe(true);
  });

  it("checks Lean proof artifacts for agents without minting proof when Lean is unavailable", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    process.env.TRUTH_HARNESS_LEAN = "truth-harness-missing-lean-command";
    await writeFile(join(root, "example.lean"), "example : True := by trivial\n", "utf8");

    const result = await handleTruthHarnessProofCheck({
      sourcePath: "example.lean",
      declarationName: "example_true",
      failOnUnproved: true
    });

    expect(result.error).toBe(true);
    expect(result.record.schemaVersion).toBe("truth-harness.proof-check.v0");
    expect(result.record.status).toBe("backend-unavailable");
    expect(result.record.trust).toBe("unverified");
    expect(result.record.proofCheckerBacked).toBe(false);
    expect(result.record.backend.acceptedProofChecker).toBe(true);
    expect(result.message).toContain("Proof gate failed");
  });

  it("writes and lists proof-check records for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    process.env.TRUTH_HARNESS_LEAN = "truth-harness-missing-lean-command";
    await handleTruthHarnessWorkspaceInit({ name: "MCP Proof Lab" });
    await writeFile(join(root, "example.lean"), "example : True := by trivial\n", "utf8");

    const result = await handleTruthHarnessProofCheck({
      sourcePath: "example.lean",
      declarationName: "example_true",
      write: true
    });
    const list = await handleTruthHarnessProofList({});
    const validation = await handleTruthHarnessWorkspaceValidate({});

    expect(result.error).toBe(false);
    expect(result.written).toBe(true);
    expect(result.result?.jsonPath).toContain(".truth-harness");
    expect(result.record.trust).toBe("unverified");
    expect(list.total).toBe(1);
    expect(list.checks[0]?.checkId).toBe(result.record.checkId);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.proofs).toBe(1);
  });

  it("reports local SMT backend readiness for agents", () => {
    const result = handleTruthHarnessSmtBackends({
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 1000
    });

    expect(result.schemaVersion).toBe("truth-harness.smt-backends.v0");
    expect(result.localOnly).toBe(true);
    expect(result.networkAccess).toBe("none");
    expect(result.backends[0]?.backendId).toBe("z3");
    expect(result.backends[0]?.role).toBe("checker");
    expect(result.backends[0]?.statusProbeMintedCheck).toBe(false);
    expect(result.trustBoundary.statusProbeIsNotCheck).toBe(true);
    expect(result.trustBoundary.smtCheckedIsNotProofCheckerProof).toBe(true);
  });

  it("checks SMT-LIB artifacts for agents without minting smt-checked when Z3 is unavailable", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await writeFile(
      join(root, "constraints.smt2"),
      "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      "utf8"
    );

    const result = await handleTruthHarnessSmtCheck({
      sourcePath: "constraints.smt2",
      queryName: "positive_integer_model",
      z3Command: "truth-harness-missing-z3-command",
      failOnUnverified: true
    });

    expect(result.error).toBe(true);
    expect(result.record.schemaVersion).toBe("truth-harness.smt-check.v0");
    expect(result.record.status).toBe("solver-unavailable");
    expect(result.record.trust).toBe("unverified");
    expect(result.record.proofCheckerBacked).toBe(false);
    expect(result.record.backend.acceptedProofChecker).toBe(false);
    expect(result.message).toContain("SMT gate failed");
  });

  it("writes and lists SMT check records for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP SMT Lab" });
    await writeFile(
      join(root, "constraints.smt2"),
      "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      "utf8"
    );

    const result = await handleTruthHarnessSmtCheck({
      sourcePath: "constraints.smt2",
      queryName: "positive_integer_model",
      z3Command: "truth-harness-missing-z3-command",
      write: true
    });
    const list = await handleTruthHarnessSmtList({});
    const validation = await handleTruthHarnessWorkspaceValidate({});

    expect(result.error).toBe(false);
    expect(result.written).toBe(true);
    expect(result.result?.jsonPath).toContain(".truth-harness");
    expect(result.record.trust).toBe("unverified");
    expect(list.total).toBe(1);
    expect(list.checks[0]?.checkId).toBe(result.record.checkId);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.smt).toBe(1);
  });

  it("generates SMT-LIB from explicit constraints for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP SMT Solve Lab" });

    const result = await handleTruthHarnessSmtSolve({
      queryName: "small_positive_integer",
      integerVariables: ["x"],
      constraints: ["x > 0", "x < 3"],
      z3Command: "truth-harness-missing-z3-command",
      failOnUnverified: true
    });
    const list = await handleTruthHarnessSmtList({});
    const validation = await handleTruthHarnessWorkspaceValidate({});

    expect(result.error).toBe(true);
    expect(result.result.problem.problemId).toMatch(/^smt_problem_[a-f0-9]{16}$/);
    expect(result.result.problem.sourceText).toContain("(assert (> x 0))");
    expect(result.result.sourceRef).toContain(".truth-harness/smt/sources/");
    expect(result.result.check.record.source.path).toBe(result.result.sourceRef);
    expect(result.result.check.record.trust).toBe("unverified");
    expect(list.total).toBe(1);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.smt).toBe(1);
  });

  it("runs the launch benchmark suite", async () => {
    const run = await handleTruthHarnessBenchmarkRun({});

    expect(run.total).toBe(25);
    expect(run.failed).toBe(0);
  });

  it("writes benchmark run records for agent replay", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Benchmark Lab" });
    await writeFile(
      join(root, "tiny-suite.json"),
      `${JSON.stringify(
        {
          id: "mcp-tiny",
          title: "MCP Tiny",
          description: "Tiny suite for MCP benchmark record writing.",
          tasks: [
            {
              id: "exact-two-plus-two",
              prompt: "compute 2 + 2",
              expectTrust: "exact-computed",
              expectSummaryIncludes: "4"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(root, "failing-suite.json"),
      `${JSON.stringify(
        {
          id: "mcp-failing",
          title: "MCP Failing",
          description: "Tiny suite for MCP benchmark gate failures.",
          tasks: [
            {
              id: "wrong-trust",
              prompt: "compute 2 + 2",
              expectTrust: "refuted"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = await handleTruthHarnessBenchmarkRun({ suitePath: "tiny-suite.json", write: true });
    const failing = await handleTruthHarnessBenchmarkRun({ suitePath: "failing-suite.json", write: true, failOnFailures: true });
    const compare = await handleTruthHarnessBenchmarkCompare({
      baselinePath: result.result.jsonPath,
      currentPath: result.result.jsonPath,
      write: true
    });
    const regressed = await handleTruthHarnessBenchmarkCompare({
      baselinePath: result.result.jsonPath,
      currentPath: failing.result.jsonPath,
      failOnRegression: true
    });
    const list = await handleTruthHarnessBenchmarkList({});
    const validation = await handleTruthHarnessWorkspaceValidate({});

    expect(result.written).toBe(true);
    expect(result.run.total).toBe(1);
    expect(result.result.record.schemaVersion).toBe("truth-harness.benchmark-run.v0");
    expect(result.result.record.verificationBoundary.benchmarkRunIsNotTruth).toBe(true);
    expect(result.result.markdownPath).toContain(".truth-harness");
    expect(truthHarnessBenchmarkRunOutputFailsGate(result)).toBe(false);
    expect(truthHarnessBenchmarkRunOutputFailsGate(failing)).toBe(true);
    expect(compare.written).toBe(true);
    expect(compare.result.record.schemaVersion).toBe("truth-harness.benchmark-comparison.v0");
    expect(compare.result.record.verdict).toBe("unchanged");
    expect(compare.result.markdownPath).toContain(".truth-harness");
    expect(truthHarnessBenchmarkCompareOutputFailsGate(compare)).toBe(false);
    expect(truthHarnessBenchmarkCompareOutputFailsGate(regressed)).toBe(true);
    expect(list.total).toBe(3);
    expect(list.artifacts.map((artifact) => artifact.kind).sort()).toEqual(["comparison", "run", "run"]);
    expect(list.artifacts[0]?.path).toContain(".truth-harness/benchmarks/");
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.benchmarks).toBe(3);
  });

  it("replays receipt JSON", async () => {
    const receipt = handleTruthHarnessAsk({ problem: "compute 2 + 2" }).receipt;
    const replay = await handleTruthHarnessReplay({ receiptJson: JSON.stringify(receipt) });

    expect(replay.passed).toBe(true);
    expect(replay.actualRunId).toBe(receipt.runId);
  });

  it("replays receipt files under the workspace", async () => {
    const receipt = handleTruthHarnessAsk({ problem: "compute 3 / 4 + 5 / 8" }).receipt;
    await mkdir("receipts", { recursive: true });
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

    const replay = await handleTruthHarnessReplay({ receiptPath });

    expect(replay.passed).toBe(true);
    expect(JSON.parse(await readFile(receiptPath, "utf8")).runId).toBe(receipt.runId);
  });

  it("renders receipts for agent reports", async () => {
    const receipt = handleTruthHarnessAsk({ problem: "compute 2 + 2" }).receipt;
    const result = await handleTruthHarnessRenderReceipt({
      receiptJson: JSON.stringify(receipt),
      format: "markdown"
    });

    expect(result.rendered).toContain(`# Truth Harness Receipt ${receipt.runId}`);
    expect(result.rendered).toContain("exact-computed");
  });

  it("initializes and checks local workspaces for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;

    const init = await handleTruthHarnessWorkspaceInit({ name: "MCP Local Lab" });
    const status = await handleTruthHarnessWorkspaceStatus({});

    expect(init.created).toBe(true);
    expect(init.manifest.displayName).toBe("MCP Local Lab");
    expect(status.exists).toBe(true);
    expect(status.missingDirectories).toEqual([]);
    expect(status.manifest?.privacy.networkAccess).toBe("none");
  });

  it("writes, lists, shows, and honestly fails to render visual artifacts for agents when Graphviz is missing", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    process.env.TRUTH_HARNESS_GRAPHVIZ_DOT = "truth-harness-missing-graphviz-dot";
    await handleTruthHarnessWorkspaceInit({ name: "MCP Visual Lab" });
    await handleTruthHarnessVerify({
      write: true,
      problem: "compute 3 / 4 + 5 / 8",
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const graph = await handleTruthHarnessVisualGraph({
      renderer: "graphviz",
      maxNodes: 24
    });
    const list = await handleTruthHarnessVisualList({});
    const shown = await handleTruthHarnessVisualShow({
      visualRef: graph.visual.visualId
    });
    const render = await handleTruthHarnessVisualRender({
      visualRef: graph.visual.visualId,
      timeoutMs: 50
    });

    expect(graph.visual.schemaVersion).toBe("truth-harness.visual-artifact.v0");
    expect(graph.visual.renderer.engine).toBe("graphviz");
    expect(graph.visual.payload.rendererSource).toMatchObject({
      language: "dot"
    });
    expect(list.total).toBe(1);
    expect(list.visuals[0]).toMatchObject({
      visualId: graph.visual.visualId,
      renderer: "graphviz"
    });
    expect(shown.visualId).toBe(graph.visual.visualId);
    expect(render.error).toBe(true);
    expect(render.message).toContain("Graphviz renderer unavailable");
  });

  it("renders saved Plotly visual artifacts for agents without external engines", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Plot Render Lab" });
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    await writeFile(join(root, ".truth-harness", "receipts", "fraction.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    const plot = await writeReceiptPlotVisualArtifact({
      rootPath: root,
      receiptPath: ".truth-harness/receipts/fraction.json",
      renderer: "plotly"
    });

    const render = await handleTruthHarnessVisualRender({
      visualRef: plot.visual.visualId,
      engine: "plotly"
    });
    const list = await handleTruthHarnessVisualList({});

    expect(render.error).toBe(false);
    if (!render.error) {
      expect(render.renderer).toBe("plotly");
      expect(render.sourceVisual.visualId).toBe(plot.visual.visualId);
      expect(render.result.visual).toMatchObject({
        kind: "plot",
        renderer: {
          engine: "truth-harness-native",
          adapter: "plotly-json-svg-renderer"
        },
        payload: {
          format: "svg"
        }
      });
      expect(render.result.visual.sourceRefs[0]).toMatchObject({
        kind: "visual",
        ref: expect.stringContaining(plot.visual.visualId)
      });
    }
    expect(list.total).toBe(2);
  });

  it("repairs old local workspace manifests for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    const init = await handleTruthHarnessWorkspaceInit({ name: "MCP Repair Lab" });
    const legacyDirectories = { ...init.manifest.directories } as Partial<typeof init.manifest.directories>;
    delete legacyDirectories["code-runs"];
    await rm(join(root, init.manifest.directories["code-runs"]), { recursive: true, force: true });
    await writeFile(
      init.manifestPath,
      `${JSON.stringify({ ...init.manifest, directories: legacyDirectories }, null, 2)}\n`,
      "utf8"
    );

    const status = await handleTruthHarnessWorkspaceStatus({});
    const repair = await handleTruthHarnessWorkspaceRepair({});
    const repairedStatus = await handleTruthHarnessWorkspaceStatus({});
    const rawManifest = JSON.parse(await readFile(init.manifestPath, "utf8")) as typeof init.manifest;

    expect(status.manifestRepair).toEqual({ applied: false, addedDirectories: ["code-runs"] });
    expect(status.missingDirectories).toEqual([".truth-harness/code-runs"]);
    expect(repair.repaired).toBe(true);
    expect(repair.manifestRepair).toEqual({ applied: true, addedDirectories: ["code-runs"] });
    expect(repair.createdDirectories).toEqual([".truth-harness/code-runs"]);
    expect(rawManifest.directories["code-runs"]).toBe(".truth-harness/code-runs");
    expect(repairedStatus.manifestRepair).toBeUndefined();
    expect(repairedStatus.missingDirectories).toEqual([]);
  });

  it("validates local receipt artifacts for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Validation Lab" });
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    const validReceipt = handleTruthHarnessAsk({ problem: "compute 2 + 2" }).receipt;
    const legacyReceipt = { ...validReceipt } as Record<string, unknown>;
    delete legacyReceipt.evidenceProfile;
    await writeFile(join(root, ".truth-harness", "receipts", "valid.json"), JSON.stringify(validReceipt, null, 2));
    await writeFile(join(root, ".truth-harness", "receipts", "legacy.json"), JSON.stringify(legacyReceipt, null, 2));

    const validation = await handleTruthHarnessWorkspaceValidate({});

    expect(validation.passed).toBe(false);
    expect(validation.summary.checkedFiles).toBe(3);
    expect(validation.summary.validFiles).toBe(2);
    expect(validation.summary.byKind.manifest).toBe(1);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-receipt-schema",
        path: ".truth-harness/receipts/legacy.json"
      })
    );
  });

  it("reports dangling evidence refs through workspace validation for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Dangling Ref Lab" });
    const invention = await handleTruthHarnessInventionLog({
      hypothesis: "A missing expert review should not pass workspace validation.",
      evidenceRefs: [{ kind: "review", ref: "review_missing123456" }]
    });

    const validation = await handleTruthHarnessWorkspaceValidate({});

    expect(validation.passed).toBe(false);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        code: "unresolved-evidence-ref",
        path: expect.stringContaining(invention.entry.entryId)
      })
    );
  });

  it("writes workspace review handoff packets for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Handoff Lab" });
    const route = await handleTruthHarnessVerify({
      problem: "compute 3 / 4 + 5 / 8",
      write: true,
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const review = await handleTruthHarnessWorkspaceReview({
      maxRoutes: 1,
      maxClaims: 0,
      write: true
    });
    const list = await handleTruthHarnessWorkspaceReviewList({});
    const snapshot = await handleTruthHarnessWorkspaceSnapshot({});

    if (!("written" in review)) {
      throw new Error("Expected workspace review write result.");
    }

    const shown = await handleTruthHarnessWorkspaceReviewShow({
      reviewRef: review.review.reviewId
    });

    expect(route.written).toBe(true);
    expect(review.written).toBe(true);
    expect(review.review.reviewId).toMatch(/^wrev_[a-f0-9]{16}$/u);
    expect(review.review.items).toContainEqual(expect.objectContaining({ routeId: route.route.routeId }));
    expect(review.result.jsonPath.replace(/\\/g, "/")).toContain(".truth-harness/findings/");
    expect(list.total).toBe(1);
    expect(list.reviews[0]).toMatchObject({
      reviewId: review.review.reviewId,
      path: expect.stringContaining(`${review.review.reviewId}-workspace-review.json`)
    });
    expect(shown.reviewId).toBe(review.review.reviewId);
    expect(shown.markdown).toContain("## Ordered Work Queue");
    expect(await readFile(review.result.markdownPath, "utf8")).toContain(route.route.routeId.replace(/_/g, "\\_"));
    expect(snapshot.snapshot.entries).toContainEqual(
      expect.objectContaining({
        path: expect.stringContaining(`${review.review.reviewId}-workspace-review.json`),
        kind: "findings",
        artifactId: review.review.reviewId
      })
    );
  });

  it("plans and executes the next workspace action through the shared autonomy contract", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Run Next Lab" });
    const claim = await handleTruthHarnessClaimAdd({
      statement: "A finance claim needs audited source data before it can be relied on.",
      domain: "finance",
      nextChecks: ["Attach audited source data before using this claim."]
    });

    const dryRun = await handleTruthHarnessWorkspaceRunNext({
      maxRoutes: 0,
      maxSessions: 0
    });
    const executed = await handleTruthHarnessWorkspaceRunNext({
      maxRoutes: 0,
      maxSessions: 0,
      executeLocal: true
    });

    expect(dryRun.schemaVersion).toBe("truth-harness.workspace-run-next.v0");
    expect(dryRun.localOnly).toBe(true);
    expect(dryRun.networkAccess).toBe("none");
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.status).toBe("planned");
    expect(dryRun.item).toMatchObject({
      kind: "claim-blocker",
      claimId: claim.claim.claimId
    });
    expect(dryRun.execution).toMatchObject({
      status: "planned",
      kind: "dry-run"
    });
    expect(executed.dryRun).toBe(false);
    expect(executed.status).toBe("executed");
    expect(executed.execution.status).toBe("executed");
    expect(executed.execution.kind).toBe("claim-review");
    expect(executed.execution.result).toMatchObject({
      claimId: claim.claim.claimId
    });
    expect(executed.warnings.join(" ")).toContain("never executes shell strings");
  });

  it("writes, lists, and verifies workspace snapshots for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Snapshot Lab" });
    await writeFile(join(root, ".truth-harness", "findings", "note.json"), JSON.stringify({
      schemaVersion: "truth-harness.finding.v0",
      documentId: "doc_snapshot_note"
    }));

    const snapshot = await handleTruthHarnessWorkspaceSnapshot({});
    const list = await handleTruthHarnessWorkspaceSnapshotList({});
    const verification = await handleTruthHarnessWorkspaceSnapshotVerify({
      snapshotRef: snapshot.snapshot.snapshotId
    });

    expect(snapshot.snapshot.schemaVersion).toBe("truth-harness.workspace-snapshot.v0");
    expect(snapshot.snapshot.entries.some((entry) => entry.path.endsWith("note.json"))).toBe(true);
    expect(snapshot.snapshot.entries.every((entry) => !entry.path.startsWith(".truth-harness/snapshots/"))).toBe(true);
    expect(list.total).toBe(1);
    expect(list.snapshots[0]?.snapshotId).toBe(snapshot.snapshot.snapshotId);
    expect(verification.passed).toBe(true);
    expect(verification.changed).toEqual([]);
  });

  it("starts and checkpoints local research sessions for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Research Session Lab" });
    const snapshot = await handleTruthHarnessWorkspaceSnapshot({});
    const review = await handleTruthHarnessWorkspaceReview({
      maxRoutes: 0,
      maxClaims: 0,
      write: true
    });

    if (!("written" in review)) {
      throw new Error("Expected persisted workspace review for research session evidence.");
    }

    const start = await handleTruthHarnessResearchSessionStart({
      title: "Cancer evidence runbook",
      objective: "Investigate a cancer pathway hypothesis without claiming a cure.",
      domains: ["biomedical"],
      evidenceRefs: [
        { kind: "snapshot", ref: snapshot.snapshot.snapshotId },
        { kind: "workspace-review", ref: review.review.reviewId }
      ],
      snapshotRefs: [snapshot.snapshot.snapshotId],
      tasks: ["Create an evidence audit", "Record required expert review"]
    });
    const checkpoint = await handleTruthHarnessResearchSessionCheckpoint({
      sessionRef: start.session.sessionId,
      summary: "Initial local runbook created; no clinical conclusion is allowed.",
      evidenceRefs: [{ kind: "workspace-review", ref: review.review.reviewId }],
      snapshotRefs: [snapshot.snapshot.snapshotId],
      decisions: ["Keep the claim phrased as a computational hypothesis."],
      nextChecks: ["Attach simulation and source evidence before audit."]
    });
    const taskUpdate = await handleTruthHarnessResearchSessionTaskUpdate({
      sessionRef: start.session.sessionId,
      taskRef: start.session.tasks[0]?.taskId ?? "",
      status: "done",
      evidenceRefs: [{ kind: "workspace-review", ref: review.review.reviewId }]
    });
    const list = await handleTruthHarnessResearchSessionList({});
    const shown = await handleTruthHarnessResearchSessionShow({
      sessionRef: start.session.sessionId
    });
    const handoff = await handleTruthHarnessWorkspaceReview({
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 1
    });
    const graph = await handleTruthHarnessWorkspaceGraph({});
    const validation = await handleTruthHarnessWorkspaceValidate({});

    if ("written" in handoff) {
      throw new Error("Expected an in-memory workspace review.");
    }

    expect(start.session.schemaVersion).toBe("truth-harness.research-session.v0");
    expect(start.session.modelPolicy.hostedModels).toBe("optional-with-disclosure");
    expect(start.session.reviewBoundary.wetLabValidationRequired).toBe(true);
    expect(start.markdown).toContain("Do not describe biomedical hypotheses as cures");
    expect(checkpoint.checkpoint.checkpointId).toMatch(/^chk_[a-f0-9]{16}$/);
    expect(checkpoint.session.evidenceRefs).toContainEqual(
      expect.objectContaining({ kind: "workspace-review", ref: review.review.reviewId })
    );
    expect(checkpoint.session.checkpoints).toHaveLength(1);
    expect(taskUpdate.task.status).toBe("done");
    expect(taskUpdate.task.evidenceRefs).toContainEqual(
      expect.objectContaining({ kind: "workspace-review", ref: review.review.reviewId })
    );
    expect(list.total).toBe(1);
    expect(shown.sessionId).toBe(start.session.sessionId);
    expect(shown.checkpoints).toHaveLength(1);
    expect(handoff.summary.sessions).toBe(1);
    expect(handoff.summary.sessionTasks).toBe(1);
    expect(handoff.summary.sessionNextChecks).toBe(1);
    expect(handoff.items).toContainEqual(
      expect.objectContaining({
        kind: "session-next-check",
        sessionId: start.session.sessionId,
        command: expect.stringContaining("truth-harness research show")
      })
    );
    expect(graph.schemaVersion).toBe("truth-harness.workspace-graph.v0");
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        refKind: "workspace-review",
        ref: review.review.reviewId,
        resolved: true
      })
    );
    expect(validation.passed).toBe(true);
  });

  it("writes and lists expert review records for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Expert Review Lab" });

    const write = await handleTruthHarnessExpertReviewLog({
      subject: "Cancer pathway simulation review",
      question: "Does the local evidence justify a cure claim?",
      kind: "biomedical",
      status: "requested",
      reviewerRole: "oncology domain expert",
      evidenceRefs: [{ kind: "simulation", ref: "sim_0123456789abcdef" }],
      requiredNextChecks: ["Attach wet-lab validation plan before stronger claims."]
    });
    const list = await handleTruthHarnessExpertReviewList({});

    expect(write.review.schemaVersion).toBe("truth-harness.expert-review.v0");
    expect(write.review.boundary.notMedicalAdvice).toBe(true);
    expect(write.review.warnings.join("\n")).toContain("Review is not completed");
    expect(write.markdown).toContain("# Expert Review");
    expect(list.total).toBe(1);
    expect(list.reviews[0]?.reviewId).toBe(write.review.reviewId);
  });

  it("ingests and searches local source material for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Source Lab" });
    await writeFile(
      join(root, "notes.md"),
      "# Agent Notes\n\nReplayable receipts help agents avoid unsupported math claims.",
      "utf8"
    );

    const ingest = await handleTruthHarnessSourceIngest({ paths: ["notes.md"] });
    const search = await handleTruthHarnessSourceSearch({ query: "replayable receipts", limit: 1 });

    expect(ingest.totalDocuments).toBe(1);
    expect(search.hits).toHaveLength(1);
    expect(search.hits[0]?.trust).toBe("source-cited");
    expect(search.hits[0]?.citation.path).toBe("notes.md");
  });

  it("creates source-cited receipts for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Source Citation Lab" });
    await writeFile(
      join(root, "notes.md"),
      "# Source Notes\n\nLocal receipts and source citations help agents avoid unsupported claims.",
      "utf8"
    );
    await handleTruthHarnessSourceIngest({ paths: ["notes.md"] });

    const result = await handleTruthHarnessSourceCite({
      claim: "Local receipts and source citations help agents avoid unsupported claims.",
      query: "source citations unsupported claims",
      strict: true
    });

    expect(result.error).toBe(false);
    expect(result.receipt.trust).toBe("source-cited");
    expect(result.receipt.graph.nodes.some((node) => node.kind === "source")).toBe(true);
  });

  it("writes and lists simulation evidence for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Simulation Lab" });

    const write = await handleTruthHarnessSimulationLog({
      title: "Toy pathway simulation",
      question: "Does a toy perturbation lower a simulated pathway score?",
      kind: "molecular",
      stage: "computed",
      engine: "local python",
      modelName: "toy pathway ODE",
      parameters: [{ name: "candidate_concentration", value: "10", unit: "uM" }],
      metrics: [{ name: "pathway_score_delta", value: "-0.18", note: "toy-model-only" }],
      assumptions: ["Toy mechanism only."],
      uncertainty: ["No calibrated uncertainty model yet."],
      limitations: ["No wet-lab validation."],
      nextChecks: ["Run sensitivity analysis."]
    });
    const list = await handleTruthHarnessSimulationList({});

    expect(write.entry.schemaVersion).toBe("truth-harness.simulation.v0");
    expect(write.entry.privacy.mode).toBe("local-only");
    expect(write.entry.validationBoundary.simulationIsNotReality).toBe(true);
    expect(write.entry.warnings[0]).toContain("does not establish real-world");
    expect(list.total).toBe(1);
    expect(list.entries[0]?.simulationId).toBe(write.entry.simulationId);
  });

  it("writes and lists experiment evidence for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Experiment Lab" });

    const write = await handleTruthHarnessExperimentLog({
      title: "Toy assay observation",
      question: "Did a toy assay preserve review caveats?",
      kind: "wet-lab",
      stage: "completed",
      protocolRefs: ["protocols/toy-assay.md"],
      dataRefs: ["data/toy-assay.csv"],
      analysisRefs: ["notebooks/toy-assay.ipynb"],
      observations: ["Observed a toy marker change."],
      measurements: [{ name: "marker_delta", value: "-0.12", unit: "a.u." }],
      outcomeSummary: "Toy observation only.",
      limitations: ["No clinical endpoint."],
      nextChecks: ["Independent replication."],
      ethicsApprovalRefs: ["review:non-human-toy-assay"],
      regulatoryReviewRefs: ["safety:local-review"]
    });
    const list = await handleTruthHarnessExperimentList({});

    expect(write.entry.schemaVersion).toBe("truth-harness.experiment.v0");
    expect(write.entry.review.humanExpertReviewRequired).toBe(true);
    expect(write.entry.validationBoundary.notRegulatoryApproval).toBe(true);
    expect(write.entry.warnings[0]).toContain("do not by themselves establish safety");
    expect(list.total).toBe(1);
    expect(list.entries[0]?.experimentId).toBe(write.entry.experimentId);
  });

  it("seals and verifies private vault files for agents without returning plaintext", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    process.env[vaultKeyEnv] = "mcp vault test passphrase";
    await handleTruthHarnessWorkspaceInit({ name: "MCP Vault Lab" });
    await writeFile(join(root, "private-notes.md"), "sensitive local discovery note", "utf8");

    const sealed = await handleTruthHarnessVaultSeal({
      sourcePath: "private-notes.md",
      label: "Private discovery notes",
      keyEnv: vaultKeyEnv
    });
    const list = await handleTruthHarnessVaultList({});
    const verified = await handleTruthHarnessVaultVerify({
      vaultRef: sealed.entry.vaultId,
      keyEnv: vaultKeyEnv
    });

    expect(sealed.entry.schemaVersion).toBe("truth-harness.vault.v0");
    expect(sealed.entry.encryption.keyPolicy).toBe("environment-only");
    expect(JSON.stringify(sealed.entry)).not.toContain("sensitive local discovery note");
    expect(JSON.stringify(sealed.entry)).not.toContain("private-notes.md");
    expect(list.total).toBe(1);
    expect(verified.verified).toBe(true);
    expect(verified.payload.sourceRef).toBe("private-notes.md");
    expect(JSON.stringify(verified)).not.toContain("sensitive local discovery note");
  });

  it("audits claim evidence posture for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Audit Lab" });
    const simulation = await handleTruthHarnessSimulationLog({
      title: "Toy cancer pathway simulation",
      question: "Could a toy perturbation lower a cancer pathway score?",
      kind: "molecular",
      engine: "local test harness",
      modelName: "toy pathway model",
      metrics: [{ name: "pathway_score_delta", value: "-0.2" }],
      assumptions: ["Toy model only."],
      uncertainty: ["No calibrated uncertainty model."],
      limitations: ["No wet-lab or clinical evidence."],
      nextChecks: ["Expert review."]
    });

    const audit = await handleTruthHarnessEvidenceAudit({
      claim: "This simulated candidate cures cancer safely.",
      evidenceRefs: [{ kind: "simulation", ref: simulation.entry.simulationId }],
      writeReport: true
    });
    const list = await handleTruthHarnessEvidenceAuditList({});

    expect(audit.written).toBe(true);
    expect(audit.written === true ? audit.result.audit.schemaVersion : "").toBe("truth-harness.evidence-audit.v0");
    expect(audit.written === true ? audit.result.audit.verdict.status : "").toBe("overclaimed");
    expect(audit.written === true ? audit.result.audit.requiredNextChecks.join(" ") : "").toContain("Rewrite the claim");
    expect(audit.written === true && audit.report === true ? audit.result.markdownPath : "").toContain(".truth-harness");
    expect(audit.written === true && audit.report === true ? audit.result.markdown : "").toContain("| Verdict | `overclaimed` |");
    expect(list.total).toBe(1);
    expect(list.audits[0]?.verdict.status).toBe("overclaimed");
  });

  it("writes and lists validation plans for agent discovery gates", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Validation Lab" });
    const simulation = await handleTruthHarnessSimulationLog({
      title: "Toy cancer pathway simulation",
      question: "Could a toy perturbation lower a cancer pathway score?",
      kind: "molecular",
      engine: "local test harness",
      modelName: "toy pathway model",
      metrics: [{ name: "pathway_score_delta", value: "-0.2" }],
      assumptions: ["Toy model only."],
      uncertainty: ["No calibrated uncertainty model."],
      limitations: ["No wet-lab or clinical evidence."],
      nextChecks: ["Expert review."]
    });

    const write = await handleTruthHarnessValidationPlan({
      claim: "This simulated candidate cures cancer safely.",
      evidenceRefs: [{ kind: "simulation", ref: simulation.entry.simulationId }],
      gates: [{ kind: "other", description: "Attach independent reproduction notes before public sharing." }],
      write: true
    });
    const preview = await handleTruthHarnessValidationPlan({
      claim: "This simulated candidate cures cancer safely.",
      evidenceRefs: [{ kind: "simulation", ref: simulation.entry.simulationId }]
    });
    const list = await handleTruthHarnessValidationPlanList({});

    expect(write.written).toBe(true);
    expect(write.written === true ? write.result.plan.schemaVersion : "").toBe("truth-harness.validation-plan.v0");
    expect(write.written === true ? write.result.plan.readiness.status : "").toBe("not-ready");
    expect(write.written === true ? write.result.markdown : "").toContain("Validation Plan");
    expect(preview.written).toBe(false);
    expect(preview.written === false ? preview.plan.gates.find((gate) => gate.kind === "wet-lab")?.status : "").toBe("missing");
    expect(list.total).toBe(1);
    expect(list.plans[0]?.readiness.status).toBe("not-ready");
  });

  it("writes and lists invention logs for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Invention Lab" });

    const write = await handleTruthHarnessInventionLog({
      title: "Evidence-backed hypothesis",
      problem: "Keep discovery claims honest.",
      hypothesis: "A local source-cited evidence ref can support, but not prove, a discovery hypothesis.",
      evidenceRefs: [
        {
          kind: "source",
          ref: "notes.md#chunk_abc",
          trust: "source-cited"
        }
      ],
      nextChecks: ["Replay and expert review."]
    });
    const list = await handleTruthHarnessInventionList({});

    expect(write.entry.validationStage).toBe("computational-hypothesis");
    expect(write.entry.safety.overclaimWarnings[0]).toContain("Do not describe this as a proven discovery");
    expect(list.total).toBe(1);
    expect(list.entries[0]?.entryId).toBe(write.entry.entryId);
  });

  it("renders discovery packages for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Discovery Package Lab" });
    const invention = await handleTruthHarnessInventionLog({
      title: "Local package",
      hypothesis: "A local discovery package should preserve validation caveats.",
      nextChecks: ["Review the evidence refs."]
    });

    const rendered = await handleTruthHarnessDiscoveryPackage({ entryId: invention.entry.entryId });
    const written = await handleTruthHarnessDiscoveryPackage({ entryId: invention.entry.entryId, write: true });

    expect(rendered.written).toBe(false);
    expect(rendered.written === false ? rendered.package.markdown : "").toContain("# Discovery Package: Local package");
    expect(written.written).toBe(true);
    expect(written.written === true ? written.result.path : "").toContain(".truth-harness");
  });

  it("creates claim charts for human legal review", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Claim Chart Lab" });
    const invention = await handleTruthHarnessInventionLog({
      title: "Claim chart hypothesis",
      hypothesis: "A local claim chart can organize evidence without making legal conclusions.",
      evidenceRefs: [
        {
          kind: "source",
          ref: "notes.md#chunk_1",
          trust: "source-cited"
        }
      ],
      priorArtNotes: ["Review closest notes.md reference."]
    });

    const rendered = await handleTruthHarnessClaimChart({
      entryId: invention.entry.entryId,
      elements: [
        {
          text: "A candidate claim element with local source support.",
          priorArtRefs: ["source:notes.md#chunk_1"]
        }
      ]
    });
    const written = await handleTruthHarnessClaimChart({
      entryId: invention.entry.entryId,
      elements: [
        {
          text: "A candidate claim element with local source support.",
          priorArtRefs: ["source:notes.md#chunk_1"]
        }
      ],
      write: true
    });
    const list = await handleTruthHarnessClaimChartList({});

    expect(rendered.written).toBe(false);
    expect(rendered.written === false ? rendered.chart.legal.legalConclusion : "").toBe("not-a-legal-opinion");
    expect(written.written).toBe(true);
    expect(written.written === true ? written.result.markdownPath : "").toContain(".truth-harness");
    expect(list.total).toBe(1);
  });

  it("records external model disclosures for agents", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Disclosure Lab" });

    const write = await handleTruthHarnessExternalDisclosureLog({
      service: "OpenAI",
      model: "frontier-reasoning-model",
      purpose: "Critique a selected proof plan before local verification.",
      dataClasses: ["selected formal statement", "selected proof sketch"],
      contextSummary: "Only a short proof plan is sent; workspace notes and receipts stay local.",
      selectedContextRefs: ["receipt:.truth-harness/receipts/plan.json"],
      approvalRef: "prompt:explicit-user-request",
      status: "sent"
    });
    const list = await handleTruthHarnessExternalDisclosureList({});

    expect(write.entry.schemaVersion).toBe("truth-harness.disclosure.v0");
    expect(write.entry.privacy.mode).toBe("external-calls");
    expect(write.entry.privacy.externalDisclosures[0]?.service).toBe("OpenAI");
    expect(write.entry.warnings.join("\n")).toContain("selected context");
    expect(list.total).toBe(1);
    expect(list.entries[0]?.disclosureId).toBe(write.entry.disclosureId);
  });

  it("prepares local model-context packets for agents without sending them", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Model Context Lab" });

    const preview = await handleTruthHarnessModelContextPrepare({
      service: "OpenAI",
      model: "frontier-reasoning-model",
      purpose: "Critique a selected proof plan before local verification.",
      dataClasses: ["selected formal statement", "selected proof sketch"],
      selectedContextRefs: ["receipt:.truth-harness/receipts/plan.json"],
      sections: [
        {
          title: "Selected proof plan",
          content: "Only critique the attached proof plan; do not infer from missing local notes.",
          sourceRefs: ["receipt:.truth-harness/receipts/plan.json"]
        }
      ],
      redactions: ["Unrelated local notes and vault plaintext are excluded."]
    });
    const write = await handleTruthHarnessModelContextPrepare({
      service: "OpenAI",
      model: "frontier-reasoning-model",
      purpose: "Critique a selected proof plan before local verification.",
      dataClasses: ["selected formal statement", "selected proof sketch"],
      selectedContextRefs: ["receipt:.truth-harness/receipts/plan.json"],
      sections: [
        {
          title: "Selected proof plan",
          content: "Only critique the attached proof plan; do not infer from missing local notes.",
          sourceRefs: ["receipt:.truth-harness/receipts/plan.json"]
        }
      ],
      redactions: ["Unrelated local notes and vault plaintext are excluded."],
      approvalRef: "prompt:explicit-user-request",
      write: true
    });
    const list = await handleTruthHarnessModelContextList({});

    expect(preview.written).toBe(false);
    expect(preview.written === false ? preview.packet.boundary.externalCallNotPerformed : false).toBe(true);
    expect(preview.written === false ? preview.packet.warnings.join("\n") : "").toContain("not approved");
    expect(write.written).toBe(true);
    expect(write.written === true ? write.result.packet.schemaVersion : "").toBe("truth-harness.model-context.v0");
    expect(write.written === true ? write.result.packet.privacy.mode : "").toBe("local-only");
    expect(write.written === true ? write.result.packet.disclosure.status : "").toBe("required-not-created");
    expect(write.written === true ? write.result.markdownPath : "").toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.packets[0]?.schemaVersion).toBe("truth-harness.model-context.v0");
  });

  it("records local literature evidence without treating citations as truth", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Literature Lab" });

    const preview = await handleTruthHarnessLiteratureLog({
      title: "Toy pathway prior-art paper",
      kind: "paper",
      status: "annotated",
      identifiers: [{ kind: "doi", value: "10.0000/example" }],
      localRefs: ["papers/pathway.md"],
      keyClaims: ["The source reports a toy pathway marker change."],
      methodNotes: ["Toy model only."],
      limitations: ["No clinical endpoint."],
      relevance: ["Cancer pathway hypothesis triage."]
    });
    const write = await handleTruthHarnessLiteratureLog({
      title: "Toy pathway prior-art paper",
      kind: "paper",
      status: "annotated",
      identifiers: [{ kind: "doi", value: "10.0000/example" }],
      localRefs: ["papers/pathway.md"],
      keyClaims: ["The source reports a toy pathway marker change."],
      methodNotes: ["Toy model only."],
      limitations: ["No clinical endpoint."],
      relevance: ["Cancer pathway hypothesis triage."],
      write: true
    });
    const list = await handleTruthHarnessLiteratureList({});

    expect(preview.written).toBe(false);
    expect(preview.written === false ? preview.record.schemaVersion : "").toBe("truth-harness.literature.v0");
    expect(preview.written === false ? preview.record.reviewBoundary.sourceRetrievalIsNotEntailment : false).toBe(true);
    expect(write.written).toBe(true);
    expect(write.written === true ? write.result.record.schemaVersion : "").toBe("truth-harness.literature.v0");
    expect(write.written === true ? write.result.markdownPath : "").toContain(".truth-harness");
    expect(write.written === true ? write.result.record.warnings.join("\n") : "").toContain("Citation or retrieval is not entailment");
    expect(list.total).toBe(1);
    expect(list.records[0]?.schemaVersion).toBe("truth-harness.literature.v0");
  });

  it("records local notebook run provenance without executing code", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Notebook Lab" });

    const preview = await handleTruthHarnessNotebookRunLog({
      purpose: "Run a local notebook that computes a toy pathway score.",
      kind: "notebook",
      status: "completed",
      runner: "jupyter",
      command: "jupyter nbconvert --execute notebooks/pathway.ipynb",
      notebookRefs: ["notebooks/pathway.ipynb"],
      codeRefs: ["src/pathway.py"],
      inputRefs: ["data/pathway.csv"],
      outputRefs: ["artifacts/pathway-output.json"],
      runtime: "python",
      runtimeVersion: "3.12",
      dependencies: ["sympy==1.14.0"],
      limitations: ["Toy model only."],
      metrics: [{ name: "pathway_score_delta", value: "-0.18" }]
    });
    const write = await handleTruthHarnessNotebookRunLog({
      purpose: "Run a local notebook that computes a toy pathway score.",
      kind: "notebook",
      status: "completed",
      runner: "jupyter",
      command: "jupyter nbconvert --execute notebooks/pathway.ipynb",
      notebookRefs: ["notebooks/pathway.ipynb"],
      codeRefs: ["src/pathway.py"],
      inputRefs: ["data/pathway.csv"],
      outputRefs: ["artifacts/pathway-output.json"],
      runtime: "python",
      runtimeVersion: "3.12",
      dependencies: ["sympy==1.14.0"],
      limitations: ["Toy model only."],
      metrics: [{ name: "pathway_score_delta", value: "-0.18" }],
      write: true
    });
    const list = await handleTruthHarnessNotebookRunList({});

    expect(preview.written).toBe(false);
    expect(preview.written === false ? preview.record.schemaVersion : "").toBe("truth-harness.notebook-run.v0");
    expect(preview.written === false ? preview.record.reproducibilityBoundary.executionNotPerformedByWorkbench : false).toBe(true);
    expect(write.written).toBe(true);
    expect(write.written === true ? write.result.record.schemaVersion : "").toBe("truth-harness.notebook-run.v0");
    expect(write.written === true ? write.result.record.warnings.join("\n") : "").toContain("did not execute this run");
    expect(write.written === true ? write.result.markdownPath : "").toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.records[0]?.schemaVersion).toBe("truth-harness.notebook-run.v0");
  });

  it("runs local code and records policy-gated execution evidence", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    process.env.TRUTH_HARNESS_ALLOW_CODE_RUN = "1";
    process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN = "1";
    await handleTruthHarnessWorkspaceInit({ name: "MCP Code Run Lab" });

    const result = await handleTruthHarnessCodeRun({
      title: "MCP code execution",
      purpose: "Capture a tiny local code execution for agent evidence.",
      command: process.execPath,
      args: ["-e", "console.log('mcp-code-run')"],
      codeRefs: ["inline:node-eval"],
      inputRefs: ["prompt:mcp-code-run"],
      outputRefs: ["stdout"],
      policy: {
        allowedExecutables: [process.execPath]
      },
      failOnNonzero: true
    });
    const list = await handleTruthHarnessCodeRunList({});
    const validation = await handleTruthHarnessWorkspaceValidate({});
    const sandboxStatus = handleTruthHarnessCodeSandboxStatus().status;

    expect(result.error).toBe(false);
    expect(result.result.record.schemaVersion).toBe("truth-harness.code-run.v0");
    expect(result.result.record.command.shell).toBe(false);
    expect(result.result.record.policy.matchedAllowlist).toBe(true);
    expect(result.result.record.policy.detected.categories).toEqual([]);
    expect(result.result.record.privacy.networkAccess).toBe(sandboxStatus.canAttestNetworkNone ? "none" : "unknown");
    expect(result.result.record.replay.localOnly).toBe(sandboxStatus.canAttestNetworkNone);
    expect(result.result.record.execution.status).toBe("passed");
    expect(result.result.record.stdout.text.trim()).toBe("mcp-code-run");
    expect(result.result.jsonPath).toContain(".truth-harness");
    expect(result.message).toContain(result.result.record.runId);
    expect(list.total).toBe(1);
    expect(list.records[0]?.runId).toBe(result.result.record.runId);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind["code-runs"]).toBe(1);
  });

  it("reports code-run sandbox availability to agents", () => {
    const result = handleTruthHarnessCodeSandboxStatus();

    expect(result.status.schemaVersion).toBe("truth-harness.code-run-sandbox-status.v0");
    expect(result.error).toBe(!result.status.available);
    if (result.status.available) {
      expect(result.status.provider).toBe("container");
      expect(result.status.canAttestNetworkNone).toBe(true);
      expect(result.message).toContain("available");
    } else {
      expect(result.status.provider).toBe("none");
      expect(result.status.canAttestNetworkNone).toBe(false);
      expect(result.message).toContain("unavailable");
    }
  });

  it("respects sandbox-required code-run requests through the MCP handler", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    process.env.TRUTH_HARNESS_ALLOW_CODE_RUN = "1";
    delete process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Code Sandbox Gate Lab" });
    const status = handleTruthHarnessCodeSandboxStatus().status;

    if (status.available) {
      const result = await handleTruthHarnessCodeRun({
        purpose: "Run only with a measured OS sandbox.",
        command: process.execPath,
        args: ["-e", "console.log('sandbox-required')"],
        outputRefs: ["stdout"],
        policy: {
          allowedExecutables: [process.execPath],
          requireSandbox: true
        }
      });

      expect(result.error).toBe(false);
      expect(result.result.record.policy.sandbox.required).toBe(true);
      expect(result.result.record.privacy.networkAccess).toBe("none");
      expect(result.result.record.stdout.text.trim()).toBe("sandbox-required");
      return;
    }

    await expect(
      handleTruthHarnessCodeRun({
        purpose: "Attempt to run only with an OS sandbox.",
        command: process.execPath,
        policy: {
          allowedExecutables: [process.execPath],
          requireSandbox: true
        }
      })
    ).rejects.toThrow("requires a measured sandbox provider");
  });

  it("blocks risky code-run commands through the MCP handler by default", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    process.env.TRUTH_HARNESS_ALLOW_CODE_RUN = "1";
    process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN = "1";
    await handleTruthHarnessWorkspaceInit({ name: "MCP Code Policy Lab" });

    await expect(
      handleTruthHarnessCodeRun({
        purpose: "Attempt a blocked network command.",
        command: "curl",
        args: ["--version"],
        policy: {
          allowedExecutables: ["curl"]
        }
      })
    ).rejects.toThrow("Network-capable command");
  });

  it("requires a second opt-in before MCP can request unsandboxed code execution", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    process.env.TRUTH_HARNESS_ALLOW_CODE_RUN = "1";
    delete process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Unsandboxed Code Gate Lab" });

    await expect(
      handleTruthHarnessCodeRun({
        purpose: "Attempt unsandboxed MCP code execution without the server-level escape hatch.",
        command: process.execPath,
        args: ["-e", "console.log('blocked-unsandboxed')"],
        policy: {
          allowedExecutables: [process.execPath]
        }
      })
    ).rejects.toThrow("MCP unsandboxed code execution is disabled");

    const list = await handleTruthHarnessCodeRunList({});
    expect(list.total).toBe(0);
  });

  it("requires explicit MCP opt-in before code execution is reachable", async () => {
    const root = await tempRoot();
    process.env.TRUTH_HARNESS_ROOT = root;
    delete process.env.TRUTH_HARNESS_ALLOW_CODE_RUN;
    await handleTruthHarnessWorkspaceInit({ name: "MCP Code Gate Lab" });

    await expect(
      handleTruthHarnessCodeRun({
        purpose: "Attempt a code run through MCP without process opt-in.",
        command: process.execPath,
        args: ["-e", "console.log('blocked')"],
        policy: {
          allowedExecutables: [process.execPath]
        }
      })
    ).rejects.toThrow("MCP code execution is disabled");
  });

  it("returns MCP-compatible JSON content", () => {
    const result = toolJson({ ok: true });

    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("\"ok\": true");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-mcp-"));
  tempRoots.push(root);
  return root;
}

function restoreWorkspaceRoot(): void {
  if (originalWorkspaceRoot === undefined) {
    delete process.env.TRUTH_HARNESS_ROOT;
    return;
  }

  process.env.TRUTH_HARNESS_ROOT = originalWorkspaceRoot;
}

function restoreLeanCommand(): void {
  if (originalLeanCommand === undefined) {
    delete process.env.TRUTH_HARNESS_LEAN;
    return;
  }

  process.env.TRUTH_HARNESS_LEAN = originalLeanCommand;
}

function restoreCodeRunOptIn(): void {
  if (originalCodeRunOptIn === undefined) {
    delete process.env.TRUTH_HARNESS_ALLOW_CODE_RUN;
    return;
  }

  process.env.TRUTH_HARNESS_ALLOW_CODE_RUN = originalCodeRunOptIn;
}

function restoreUnsandboxedCodeRunOptIn(): void {
  if (originalUnsandboxedCodeRunOptIn === undefined) {
    delete process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN;
    return;
  }

  process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN = originalUnsandboxedCodeRunOptIn;
}

function restoreGraphvizDot(): void {
  if (originalGraphvizDot === undefined) {
    delete process.env.TRUTH_HARNESS_GRAPHVIZ_DOT;
    return;
  }

  process.env.TRUTH_HARNESS_GRAPHVIZ_DOT = originalGraphvizDot;
}

function restoreVaultKey(): void {
  if (originalVaultKey === undefined) {
    delete process.env[vaultKeyEnv];
    return;
  }

  process.env[vaultKeyEnv] = originalVaultKey;
}

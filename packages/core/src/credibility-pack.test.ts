import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace, LOCAL_WORKSPACE_DIR, LOCAL_WORKSPACE_MANIFEST } from "./local-workspace.js";
import { rebuildWorkspaceCatalog, searchWorkspaceCatalog } from "./workspace-catalog.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { createCredibilityPack, writeCredibilityPack } from "./credibility-pack.js";
import { writeEngineVerificationRun, type EngineVerificationCommandRunner } from "./engine-verification.js";
import { writeHardMathClosureReport } from "./hard-math-closure-report.js";
import { writeBenchmarkRunRecord } from "./benchmark-run.js";
import { createReceipt } from "./receipt.js";
import { writeReportDraft } from "./report-draft.js";
import { writeVerifierRoute } from "./verifier-route.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("professor credibility pack", () => {
  it("requires a local workspace", async () => {
    const root = await tempRoot();

    await expect(createCredibilityPack({ rootPath: root })).rejects.toThrow("No Truth Harness workspace found");
  });

  it("writes a reviewer packet with validation, engine evidence, review queue, and embedded artifact hashes", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const strictEngineRun = await writeEngineVerificationRun({
      rootPath: root,
      now: new Date("2026-06-16T00:00:30.000Z"),
      requirements: { maxima: true, z3: true, cvc5: true, lean: true, sage: true },
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      cvc5Command: "cvc5-test",
      leanCommand: "lean-test",
      sageCommand: "sage-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      replayCommand: "truth-harness engines verify --write --require-all-engines",
      runner: passingEngineRunner
    });
    const adversarialReceipt = createReceipt("for all integers n, n^2+n+1 is even");
    const adversarialBenchmark = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(adversarialReceipt, {
        suiteId: "ai-failure-seed",
        title: "AI Failure Seed Suite",
        expectTrust: "refuted",
        expectEvidenceKind: "universal-parity",
        category: "false-universal",
        aiFailureMode: "confident universal claim"
      }),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:45.000Z"
    });
    const mathLadderReceipt = createReceipt("3 / 4 + 5 / 8");
    const mathLadderBenchmark = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(mathLadderReceipt, {
        suiteId: "math-credibility-ladder",
        title: "Math Credibility Ladder",
        expectTrust: "exact-computed",
        expectEvidenceKind: "exact-arithmetic",
        category: "native-safe-hard-math-floor",
        aiFailureMode: "trust-label boundary"
      }),
      suiteDescription: "Native-safe hard-math readiness floor.",
      suitePath: "packages/benchmarks/suites/math-credibility-ladder.json",
      command: "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:46.000Z"
    });
    await writePassingHardMathClosures(root);

    const result = await writeCredibilityPack({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      engineRequirements: { maxima: true, z3: true, lean: true },
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      leanCommand: "lean-test",
      sageCommand: "sage-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: passingEngineRunner
    });

    expect(result.pack.schemaVersion).toBe("truth-harness.credibility-pack.v0");
    expect(result.pack.packId).toMatch(/^cred_[a-f0-9]{16}$/u);
    expect(result.pack.status).toBe("ready-for-review");
    expect(result.pack.summary).toMatchObject({
      validationPassed: true,
      validationErrors: 0,
      engineStatus: "passed",
      concreteEngineGates: "3/3",
      requiredEngineGates: "3/3",
      engineEvidenceMinted: 3,
      savedEngineRuns: 1,
      savedEngineLadderLevel: "engine-level-5-strict-all-engines",
      savedEngineLadderLevelTitle: "Strict all-engine reviewer gate",
      savedEngineLadderLevelRunId: strictEngineRun.record.runId,
      latestStrictEngineRunStatus: "passed",
      latestStrictEngineRunLevel: "engine-level-5-strict-all-engines",
      savedBenchmarkRuns: 2,
      latestAdversarialBenchmarkStatus: "passed",
      latestAdversarialBenchmarkAccuracy: 1,
      latestMathCredibilityLadderStatus: "passed",
      latestMathCredibilityLadderAccuracy: 1,
      savedHardMathClosureReports: 3,
      hardMathExactClosureStatus: "passed",
      hardMathSymbolicClosureStatus: "passed",
      hardMathSmtClosureStatus: "passed",
      professorReady: true
    });
    expect(result.pack.embeddedSnapshot.entries.length).toBeGreaterThan(0);
    expect(result.pack.engineEvidence.cases).toContainEqual(
      expect.objectContaining({ id: "lean-proof-fixture", trust: "proved", evidenceMinted: true })
    );
    expect(result.pack.engineEvidenceLadder).toContainEqual(
      expect.objectContaining({
        caseId: "lean-proof-fixture",
        gate: "required",
        evidenceTier: "earned evidence",
        reviewerMeaning: "Concrete `proved` evidence earned for this fixture; replay it before citing the engine gate."
      })
    );
    expect(result.markdown).toContain("Professor ready: yes");
    expect(result.markdown).toContain("Saved engine-run ledger: 1 saved");
    expect(result.markdown).toContain("Adversarial benchmark: passed (100.0%)");
    expect(result.markdown).toContain("Math credibility ladder: passed (100.0%)");
    expect(result.markdown).toContain("Hard-math closure: 3 saved (exact passed, symbolic passed, SMT passed)");
    expect(result.markdown).toContain("## Hard-Math Closure Ledger");
    expect(result.markdown).toContain("## Engine Evidence Ladder");
    expect(result.markdown).toContain("| Lean proof fixture | required | `passed` | `proved` | earned evidence | Concrete `proved` evidence earned");
    expect(result.markdown).toContain("## Saved Engine Run Ledger");
    expect(result.markdown).toContain(strictEngineRun.record.runId);
    expect(result.markdown).toContain("## Benchmark Ledger");
    expect(result.markdown).toContain(adversarialBenchmark.record.benchmarkRunId);
    expect(result.markdown).toContain(mathLadderBenchmark.record.benchmarkRunId);
    expect(result.markdown).toContain("Docker Lean fixture");
    expect(result.pack.engineRunLedger.latestStrictReviewerRun).toMatchObject({
      runId: strictEngineRun.record.runId,
      requiredTotal: 5,
      strongestLevelId: "engine-level-5-strict-all-engines",
      strictAllEngineLevelPassed: true,
      status: "passed"
    });
    expect(result.pack.benchmarkLedger.latestAdversarialRun).toMatchObject({
      artifactId: adversarialBenchmark.record.benchmarkRunId,
      suiteId: "ai-failure-seed",
      failed: 0,
      replayCommand: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      receiptReplays: expect.arrayContaining([adversarialReceipt.replay])
    });
    expect(result.pack.benchmarkLedger.latestMathCredibilityLadderRun).toMatchObject({
      artifactId: mathLadderBenchmark.record.benchmarkRunId,
      suiteId: "math-credibility-ladder",
      failed: 0,
      replayCommand: "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures",
      receiptReplays: expect.arrayContaining([mathLadderReceipt.replay])
    });
    expect(result.pack.reviewerActionPlan).toMatchObject({
      totalActions: 0,
      criticalActions: 0,
      highActions: 0,
      actions: []
    });
    expect(result.markdown).toContain("Reviewer action plan: 0 actions");
    expect(result.markdown).toContain("## Reviewer Action Plan");
    expect(result.markdown).toContain("No open reviewer actions were generated");
    expect(result.markdown).toContain(`Replay: \`${adversarialBenchmark.record.replay.command}\``);
    expect(result.markdown).toContain(`Receipt replay examples: \`${adversarialReceipt.replay}\``);
    expect(result.pack.reviewerCommands.verifyEngines).toBe(
      "truth-harness engines verify --write --require-maxima --require-z3 --require-lean --maxima-command maxima-test --z3-command z3-test --lean-command lean-test --sage-command sage-test --smt-source constraints.smt2 --lean-source Proof.lean"
    );
    expect(result.pack.reviewerCommands.runAdversarialBenchmark).toBe(
      "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures"
    );
    expect(result.pack.reviewerCommands.runMathCredibilityLadder).toBe(
      "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures"
    );
    expect(result.pack.reviewerCommands.runExactHardMathClosure).toBe("npm run docker:hard-math-closure");
    expect(result.pack.reviewerCommands.runSymbolicHardMathClosure).toBe("npm run docker:symbolic-closure");
    expect(result.pack.reviewerCommands.runSmtHardMathClosure).toBe("npm run docker:smt-closure");
    expect(result.pack.reviewerCommands.dockerLeanRepairGate).toBe("npm run docker:proof-repair");
    expect(result.markdown).toContain("Docker Lean repair gate");

    const json = await readFile(result.jsonPath, "utf8");
    expect(json).toContain(result.pack.packId);
    expect(await readFile(result.markdownPath, "utf8")).toBe(result.markdown);

    const validation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(validation.passed).toBe(true);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.pack.packId,
        schemaVersion: "truth-harness.credibility-pack.v0",
        expectedSchemaVersion: "truth-harness.credibility-pack.v0",
        issueCodes: []
      })
    );

    await rebuildWorkspaceCatalog({ rootPath: root });
    const search = await searchWorkspaceCatalog({ rootPath: root, query: "Professor Credibility" });
    expect(search.results).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.pack.packId
      })
    );

    const tampered = JSON.parse(json) as Record<string, unknown>;
    tampered.engineEvidence = { status: "passed" };
    await writeFile(result.jsonPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
    const tamperedValidation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(tamperedValidation.passed).toBe(false);
    expect(tamperedValidation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.pack.packId,
        schemaVersion: "truth-harness.credibility-pack.v0",
        issueCodes: expect.arrayContaining(["invalid-artifact-schema"])
      })
    );
  });

  it("rejects malformed credibility packs before writing reviewer artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const manifestPath = join(root, LOCAL_WORKSPACE_DIR, LOCAL_WORKSPACE_MANIFEST);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.projectId = "";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(
      writeCredibilityPack({
        rootPath: root,
        now: "2026-06-16T00:01:00.000Z",
        runner: () => ({
          status: null,
          stdout: "",
          stderr: "",
          error: { name: "Error", message: "spawn ENOENT" }
        })
      })
    ).rejects.toThrow("Credibility pack failed JSON Schema validation before write");

    const findings = await readdir(join(root, LOCAL_WORKSPACE_DIR, "findings"));
    expect(findings.filter((file) => file.includes("credibility-pack"))).toEqual([]);
  });

  it("blocks the packet when concrete engine gates are missing", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });

    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      engineRequirements: { maxima: true, z3: true, lean: true },
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: () => ({
        status: null,
        stdout: "",
        stderr: "",
        error: { name: "Error", message: "spawn ENOENT" }
      })
    });

    expect(pack.status).toBe("blocked");
    expect(pack.summary.professorReady).toBe(false);
    expect(pack.warnings).toContain("Required engine evidence gates are incomplete: 0/3 passed.");
    expect(pack.warnings).toContain("Concrete engine smoke gates are incomplete: 0/3 passed.");
    expect(pack.warnings).toContain("No saved `ai-failure-seed` adversarial benchmark run found.");
    expect(pack.warnings).toContain("No saved `math-credibility-ladder` hard-math readiness run found.");
    expect(pack.warnings).toContain("No saved Docker exact-fraction hard-math closure report found for exact-fraction-lemma.");
    expect(pack.reviewerActionPlan).toMatchObject({
      totalActions: 8,
      criticalActions: 3,
      highActions: 5
    });
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        category: "engine",
        priority: "critical",
        title: "Close required Maxima symbolic cross-check gate",
        command: "truth-harness engines verify --write --require-maxima --require-z3 --require-lean --smt-source constraints.smt2 --lean-source Proof.lean",
        closes: expect.arrayContaining(["required-engine:maxima-symbolic-cross-check", "engine-evidence"])
      })
    );
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        title: "Close required Z3 SMT-LIB check gate",
        closes: expect.arrayContaining(["required-engine:z3-smt-check"])
      })
    );
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        title: "Close required Lean proof fixture gate",
        closes: expect.arrayContaining(["required-engine:lean-proof-fixture"])
      })
    );
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        category: "benchmark",
        priority: "high",
        title: "Run adversarial AI failure benchmark",
        command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
        closes: expect.arrayContaining(["benchmark:ai-failure-seed"])
      })
    );
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        category: "benchmark",
        priority: "high",
        title: "Run math credibility ladder",
        command: "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures",
        closes: expect.arrayContaining(["benchmark:math-credibility-ladder"])
      })
    );
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        category: "closure",
        priority: "high",
        title: "Run exact hard-math closure smoke",
        command: "npm run docker:hard-math-closure"
      })
    );
    expect(pack.reviewerActionPlan.actions.map((action) => action.detail).join("\n")).not.toContain("spawn");
    expect(pack.reviewerActionPlan.actions.map((action) => action.detail).join("\n")).toContain("engine executable was not found");
    expect(pack.reviewerActionPlan.actions.map((action) => action.detail).join("\n")).toContain(
      "Evidence status: missing evidence. Required evidence is missing, so strict reviewer readiness fails closed."
    );
    expect(pack.markdown).toContain("## Reviewer Action Plan");
    expect(pack.markdown).toContain("Close required Maxima symbolic cross-check gate");
    expect(pack.markdown).toContain("## Engine Evidence Ladder");
    expect(pack.markdown).toContain("| Maxima symbolic cross-check | required | `missing` | `unverified` | missing evidence | Required evidence is missing");
    expect(pack.markdown).toContain("## Blocking Warnings");
  });

  it("surfaces Lean proof-safety blockers as first-class professor review actions", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-21T00:00:00.000Z" });
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\n", "utf8");
    await writeFile(
      join(root, "Proofs", "Gap.lean"),
      [
        "theorem unfinished : True := by",
        "  sorry"
      ].join("\n"),
      "utf8"
    );

    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-21T00:01:00.000Z",
      engineRequirements: {},
      runner: passingEngineRunner
    });

    expect(pack.status).toBe("blocked");
    expect(pack.summary.leanProofSafetyItems).toBe(1);
    expect(pack.workspaceReview.summary.leanProofSafetyItems).toBe(1);
    expect(pack.warnings).toContain(
      "Lean proof-safety scan found 1 blocking marker(s); remove or rewrite them before treating affected Lean source as proved."
    );
    expect(pack.markdown).toContain("- Lean proof-safety blockers: 1");
    expect(pack.workspaceReview.topItems[0]).toMatchObject({
      title: "Resolve Lean proof marker: sorry",
      source: {
        label: "Lean proof safety",
        ref: "lean-marker:Proofs/Gap.lean:2:3"
      }
    });
    expect(pack.reviewerActionPlan.actions[0]).toMatchObject({
      category: "workspace-review",
      priority: "critical",
      title: "Resolve Lean proof marker: sorry",
      closes: expect.arrayContaining([
        "proof-safety-boundary",
        "lean-proof-safety:lean-marker:Proofs/Gap.lean:2:3"
      ])
    });
  });

  it("accepts saved Docker professor engine evidence when host probes are unavailable", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const professorEngineRun = await writeEngineVerificationRun({
      rootPath: root,
      now: new Date("2026-06-16T00:00:30.000Z"),
      requirements: { maxima: true, z3: true, cvc5: true, lean: true },
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      cvc5Command: "cvc5-test",
      leanCommand: "lean-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      replayCommand: "npm run docker:professor",
      runner: passingEngineRunner
    });
    const adversarialReceipt = createReceipt("for all integers n, n^2+n+1 is even");
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(adversarialReceipt, {
        suiteId: "ai-failure-seed",
        title: "AI Failure Seed Suite",
        expectTrust: "refuted",
        expectEvidenceKind: "universal-parity",
        category: "false-universal",
        aiFailureMode: "confident universal claim"
      }),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:45.000Z"
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
      suiteDescription: "Native-safe hard-math readiness floor.",
      suitePath: "packages/benchmarks/suites/math-credibility-ladder.json",
      command: "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:46.000Z"
    });
    await writePassingHardMathClosures(root);

    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      engineRequirements: { maxima: true, z3: true, cvc5: true, lean: true },
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: () => ({
        status: null,
        stdout: "",
        stderr: "",
        error: { name: "Error", message: "spawn ENOENT" }
      })
    });

    expect(pack.status).toBe("ready-for-review");
    expect(pack.summary).toMatchObject({
      engineStatus: "failed",
      concreteEngineGates: "0/4",
      requiredEngineGates: "0/4",
      latestProfessorEngineRunStatus: "passed",
      latestProfessorEngineRunLevel: "engine-level-3-formal-proof-fixture",
      savedEngineLadderLevel: "engine-level-3-formal-proof-fixture",
      latestAdversarialBenchmarkStatus: "passed",
      latestMathCredibilityLadderStatus: "passed",
      hardMathExactClosureStatus: "passed",
      hardMathSymbolicClosureStatus: "passed",
      hardMathSmtClosureStatus: "passed",
      professorReady: true
    });
    expect(pack.engineRunLedger.latestProfessorReviewerRun).toMatchObject({
      runId: professorEngineRun.record.runId,
      status: "passed",
      strongestLevelId: "engine-level-3-formal-proof-fixture",
      requiredTotal: 4
    });
    expect(pack.warnings).not.toContain("Required engine evidence gates are incomplete: 0/4 passed.");
    expect(pack.warnings).not.toContain("Concrete engine smoke gates are incomplete: 0/4 passed.");
    expect(pack.reviewerActionPlan.actions.filter((action) => action.category === "engine")).toEqual([]);
    expect(pack.markdown).toContain(
      "Engine evidence: saved Docker professor evidence covers these gates; live host smoke: failed (0/4 concrete gates, 0/4 required gates, 0 evidence records earned)"
    );
    expect(pack.markdown).toContain(
      "Saved engine-run ledger: 1 saved (strongest saved level: engine-level-3-formal-proof-fixture, latest professor Docker: passed (engine-level-3-formal-proof-fixture))"
    );
    expect(pack.markdown).toContain("Strongest saved engine ladder: `engine-level-3-formal-proof-fixture`");
  });

  it("orders reviewer actions toward evidence-writing commands before passive inspection", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "solve integer constraints x > 0 and x < 3",
      now: new Date("2026-06-16T00:00:20.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const stored = JSON.parse(await readFile(route.jsonPath, "utf8")) as {
      proofObligations: Array<Record<string, unknown>>;
    };
    stored.proofObligations = [
      {
        obligationId: "obl_smt_credibility_order_test",
        kind: "solver-encoding",
        status: "open",
        severity: "critical",
        sourceCapabilityId: "z3-smt-solver",
        title: "SMT encoding obligation",
        statement: "solve integer constraints x > 0 and x < 3",
        requiredBefore: "Before labeling this scoped claim smt-checked.",
        acceptanceCriteria: ["Attach a concrete SMT check record."],
        command: "truth-harness smt check docs/examples/constraints.smt2 --backend z3 --write"
      },
      {
        obligationId: "obl_passive_proof_credibility_order_test",
        kind: "formal-proof",
        status: "open",
        severity: "critical",
        sourceCapabilityId: "lean-proof-checker",
        title: "Formal proof-checker obligation",
        statement: "solve integer constraints x > 0 and x < 3",
        requiredBefore: "Before labeling this scoped claim proved.",
        acceptanceCriteria: ["Attach an accepted proof-check record."],
        command: "truth-harness proof check docs/examples/trivial.lean --write"
      }
    ];
    await writeFile(route.jsonPath, JSON.stringify(stored, null, 2), "utf8");
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
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:45.000Z"
    });

    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      engineRequirements: { maxima: true, z3: true, lean: true },
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      leanCommand: "lean-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: passingEngineRunner
    });
    const workspaceActions = pack.reviewerActionPlan.actions.filter((action) => action.category === "workspace-review");

    expect(workspaceActions[0]).toMatchObject({
      title: "SMT encoding obligation"
    });
    expect(workspaceActions[0]?.command).toMatch(/^truth-harness smt check\b.*--write/u);
    expect(workspaceActions.some((action) => /^truth-harness route show\b/u.test(action.command))).toBe(false);
  });

  it("blocks professor readiness when saved report drafts fail integrity checks", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    await writeReportDraft({
      rootPath: root,
      title: "Verified Reviewer Draft",
      summary: "A report draft with matching Markdown sidecar.",
      markdown: "# Verified Reviewer Draft\n\nEvery cited result is replayable.\n",
      now: "2026-06-16T00:00:10.000Z"
    });
    const tampered = await writeReportDraft({
      rootPath: root,
      title: "Edited Reviewer Draft",
      summary: "A report draft edited after save.",
      markdown: "# Edited Reviewer Draft\n\nOriginal saved text.\n",
      now: "2026-06-16T00:00:20.000Z"
    });
    await writeFile(tampered.paths.markdown, "# Edited Reviewer Draft\n\nChanged after save.\n", "utf8");
    const adversarialReceipt = createReceipt("for all integers n, n^2+n+1 is even");
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(adversarialReceipt, {
        suiteId: "ai-failure-seed",
        title: "AI Failure Seed Suite",
        expectTrust: "refuted",
        expectEvidenceKind: "universal-parity",
        category: "false-universal",
        aiFailureMode: "confident universal claim"
      }),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:45.000Z"
    });

    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      engineRequirements: { maxima: true, z3: true, lean: true },
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      leanCommand: "lean-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: passingEngineRunner
    });

    expect(pack.status).toBe("blocked");
    expect(pack.summary).toMatchObject({
      engineStatus: "passed",
      savedReportDrafts: 2,
      reportDraftsNeedingAttention: 1,
      professorReady: false
    });
    expect(pack.warnings).toContain(
      "Saved report drafts need integrity review before sharing: 1 draft(s) are missing Markdown or have SHA-256 mismatches."
    );
    expect(pack.markdown).toContain("Saved report drafts: 2 saved drafts, 1 needs attention");
    expect(pack.workspaceReview.summary.reportDrafts).toBe(2);
    expect(pack.workspaceReview.summary.reportDraftsNeedingAttention).toBe(1);
    expect(pack.workspaceReview.topItems).toContainEqual(
      expect.objectContaining({
        kind: "report-draft-review",
        priority: "high",
        title: "Fix report draft before sharing: Edited Reviewer Draft"
      })
    );
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        category: "workspace-review",
        priority: "high",
        title: "Fix report draft before sharing: Edited Reviewer Draft",
        closes: expect.arrayContaining(["report-draft-review"])
      })
    );
  });

  it("routes host-blocked engine gates to no-network Docker reviewer commands", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });

    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      engineRequirements: { maxima: true, z3: true, lean: true, sage: true },
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: () => ({
        status: null,
        stdout: "",
        stderr: "",
        error: { name: "Error", message: "spawn EPERM" }
      })
    });

    expect(pack.status).toBe("blocked");
    expect(pack.reviewerCommands.dockerSageFixture).toBe("npm run docker:sage");
    expect(pack.reviewerCommands.dockerAllEngines).toBe("npm run docker:all-engines:write");
    expect(pack.reviewerCommands.dockerStrictProfessorEvidence).toBe("npm run docker:professor:all");
    expect(pack.reviewerCommands.dockerLeanRepairGate).toBe("npm run docker:proof-repair");
    expect(pack.markdown).toContain("Docker Sage fixture");
    expect(pack.markdown).toContain("Docker Lean repair gate");
    expect(pack.markdown).toContain("Docker all engines");
    expect(pack.markdown).toContain("Docker strict professor evidence");
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        title: "Close required Maxima symbolic cross-check gate",
        command: "npm run docker:engines",
        detail: expect.stringContaining("no-network Docker core gate")
      })
    );
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        title: "Close required Z3 SMT-LIB check gate",
        command: "npm run docker:engines"
      })
    );
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        title: "Close required Lean proof fixture gate",
        command: "docker compose run --rm lean-proof npm run cli -- engines verify --require-lean"
      })
    );
    expect(pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        title: "Close required SageMath symbolic cross-check gate",
        command: "npm run docker:sage"
      })
    );
    expect(pack.reviewerActionPlan.actions.map((action) => action.title).slice(0, 4)).toEqual([
      "Close required Maxima symbolic cross-check gate",
      "Close required Z3 SMT-LIB check gate",
      "Close required Lean proof fixture gate",
      "Close required SageMath symbolic cross-check gate"
    ]);
  });
});

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
  if (command === "cvc5-test" && args[0] === "--version") {
    return { status: 0, stdout: "This is cvc5 version 1.1.2\n", stderr: "" };
  }
  if (command === "cvc5-test") {
    return { status: 0, stdout: "sat\n", stderr: "" };
  }
  if (command === "lean-test" && args[0] === "--version") {
    return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
  }
  if (command === "lean-test") {
    return { status: 0, stdout: "", stderr: "" };
  }
  if (command === "sage-test" && args[0] === "--version") {
    return { status: 0, stdout: "SageMath version 10.6\n", stderr: "" };
  }
  if (command === "sage-test") {
    return { status: 0, stdout: "TRUTH_HARNESS_SAGE_STATUS:passed:0\n", stderr: "" };
  }

  return {
    status: null,
    stdout: "",
    stderr: "",
    error: { name: "Error", message: `unexpected command ${command} ${args.join(" ")}` }
  };
};

function benchmarkRun(
  receipt: ReturnType<typeof createReceipt>,
  options: {
    suiteId?: string;
    title?: string;
    expectTrust?: ReturnType<typeof createReceipt>["trust"];
    expectEvidenceKind?: ReturnType<typeof createReceipt>["evidenceProfile"]["kind"];
    category?: string;
    aiFailureMode?: string;
    passed?: boolean;
    failures?: string[];
  } = {}
) {
  const expectedTrust = options.expectTrust ?? receipt.trust;
  const passed = options.passed ?? true;

  return {
    suiteId: options.suiteId ?? "tiny-suite",
    title: options.title ?? "Tiny Suite",
    startedAt: "2026-06-16T00:00:40.000Z",
    completedAt: "2026-06-16T00:00:41.000Z",
    total: 1,
    passed: passed ? 1 : 0,
    failed: passed ? 0 : 1,
    trustAccuracy: passed ? 1 : 0,
    results: [
      {
        task: {
          id: "adversarial-case",
          prompt: receipt.problem,
          expectTrust: expectedTrust,
          expectEvidenceKind: options.expectEvidenceKind ?? receipt.evidenceProfile.kind,
          category: options.category ?? "exact-computation",
          aiFailureMode: options.aiFailureMode ?? "wrong arithmetic"
        },
        receipt,
        passed,
        failures: options.failures ?? []
      }
    ]
  };
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-credibility-pack-"));
  roots.push(root);
  return root;
}

async function writePassingHardMathClosures(root: string): Promise<void> {
  await writeHardMathClosureReport({
    rootPath: root,
    createdAt: "2026-06-16T00:00:47.000Z",
    completedAt: "2026-06-16T00:00:48.000Z",
    runtime: {
      kind: "docker",
      command: "npm run docker:hard-math-closure",
      containerized: true
    },
    cases: [closureCase("exact-fraction-lemma", "exact-computed")]
  });
  await writeHardMathClosureReport({
    rootPath: root,
    createdAt: "2026-06-16T00:00:49.000Z",
    completedAt: "2026-06-16T00:00:50.000Z",
    runtime: {
      kind: "docker",
      command: "npm run docker:symbolic-closure",
      containerized: true
    },
    cases: [closureCase("symbolic-cas-closure-fixture", "cross-checked", "cross-checked")]
  });
  await writeHardMathClosureReport({
    rootPath: root,
    createdAt: "2026-06-16T00:00:51.000Z",
    completedAt: "2026-06-16T00:00:52.000Z",
    runtime: {
      kind: "docker",
      command: "npm run docker:smt-closure",
      containerized: true
    },
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

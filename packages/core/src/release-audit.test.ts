import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { type ProofBackendCommandRunner, writeLeanProofCheckRecord } from "./proof-backend.js";
import { writeProofRepairFixtureWorkspace } from "./proof-repair-fixture.js";
import { writeLeanMathlibValidationHarness } from "./lean-mathlib-validation.js";
import { createReleaseAudit, formatReleaseAuditEngineSummary, renderReleaseAuditMarkdown } from "./release-audit.js";
import { attachValidationGateEvidence } from "./validation-plan.js";
import { rebuildWorkspaceCatalog } from "./workspace-catalog.js";
import { writeBenchmarkRunRecord } from "./benchmark-run.js";
import { writeCredibilityBundle, writeCredibilityBundleVerification } from "./credibility-bundle.js";
import { createReceipt } from "./receipt.js";
import { writeEngineVerificationRun, type EngineVerificationCommandRunner } from "./engine-verification.js";
import { writeHardMathClosureReport } from "./hard-math-closure-report.js";
import { writeHardMathSeedWorkspace } from "./hard-math-seed.js";
import { writeReportDraft } from "./report-draft.js";
import { addResearchSessionCheckpoint, writeResearchSession } from "./research-session.js";
import { detectCodeRunSandboxStatus, writeCodeRunSandboxRun } from "./sandbox.js";
import { writeWebUiReview } from "./web-ui-review.js";
import { writeVerifierRoute } from "./verifier-route.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("release audit", () => {
  it("aggregates a reviewer-ready workspace while keeping public launch warnings separate", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Release Audit Lab", now: "2026-06-17T00:00:00.000Z" });
    const benchmark = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-17T00:00:00.500Z"
    });
    const mathLadderBenchmark = await writeMathCredibilityLadderRun(root, "2026-06-17T00:00:00.600Z");
    const professorChallengeBenchmark = await writeProfessorMathChallengeRun(root, "2026-06-17T00:00:00.700Z");
    const frontierChallengeBenchmark = await writeFrontierHonestyChallengeRun(root, "2026-06-17T00:00:00.800Z");
    await writeLeanTheoremTemplateFixture(root);
    await writeProofRepairFixtureWorkspace({
      rootPath: join(root, "docs", "examples", "lean-repair-fixture"),
      now: "2026-06-17T00:00:00.900Z",
      runner: proofRepairRunner()
    });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:02.000Z",
      engineRequirements: { maxima: true, z3: true, cvc5: true, lean: true, sage: true },
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      cvc5Command: "cvc5-test",
      leanCommand: "lean-test",
      sageCommand: "sage-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: passingEngineRunner
    });
    const markdown = renderReleaseAuditMarkdown(audit);

    expect(audit.schemaVersion).toBe("truth-harness.release-audit.v0");
    expect(audit.status).toBe("ready");
    expect(audit.professorReady).toBe(true);
    expect(audit.publicLaunchReady).toBe(false);
    expect(audit.frontierReadiness).toMatchObject({
      schemaVersion: "truth-harness.frontier-readiness.v0",
      status: "bounded-hard-math-harness",
      frontierDiscoveryReadiness: "not-ready",
      canClaimWorldHardestProblems: false,
      nextMilestone: "Formal theorem workflows"
    });
    expect(audit.frontierReadiness.strongestHonestClaim).toContain("bounded, local-first hard-math verification harness");
    expect(audit.frontierReadiness.stages).toContainEqual(
      expect.objectContaining({
        id: "autonomous-frontier-discovery",
        status: "blocked",
        summary: expect.stringContaining("cannot responsibly claim autonomous solutions")
      })
    );
    expect(audit.frontierReadiness.stages).toContainEqual(
      expect.objectContaining({
        id: "formal-theorem-workflows",
        status: "partial",
        nextAction: "Pin lake-manifest.json for docs/examples/lean-mathlib-template, then run npm run docker:mathlib-template:write for no-runtime-network proof evidence.",
        evidence: expect.arrayContaining([
          expect.stringContaining("Reusable theorem template: pass"),
          expect.stringContaining("Lean repair rehearsal: pass"),
          expect.stringContaining("Lean template gate: npm run docker:theorem-template"),
          expect.stringContaining("Lean mathlib gate: npm run docker:mathlib-template:write"),
          expect.stringContaining("Lean repair gate: npm run docker:proof-repair")
        ])
      })
    );
    expect(audit.commands.dockerLeanRepairGate).toBe("npm run docker:proof-repair");
    expect(audit.summary).toMatchObject({
      validationPassed: true,
      catalogFresh: true,
      requiredEngineGates: "5/5",
      concreteEngineGates: "5/5",
      adversarialBenchmark: "passed",
      mathCredibilityLadder: "passed",
      professorMathChallenge: "passed",
      frontierHonestyChallenge: "passed",
      reportDrafts: 0,
      reportDraftsNeedingAttention: 0,
      researchSessions: 0,
      sessionContinuationItems: 0,
      blockingFailures: 0
    });
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "engine-evidence",
        status: "pass",
        blocking: false,
        details: expect.arrayContaining([
          expect.stringContaining("Gate Lean proof fixture (required): earned evidence; status passed; trust proved."),
          expect.stringContaining("Concrete `proved` evidence earned for this fixture")
        ])
      })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "adversarial-ai-benchmark", status: "pass", blocking: false })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "math-credibility-ladder", status: "pass", blocking: false })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "professor-math-challenge", status: "pass", blocking: false })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "frontier-honesty-challenge", status: "pass", blocking: false })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "lean-theorem-template",
        status: "pass",
        blocking: false,
        summary: expect.stringContaining("Reusable theorem template is scanner-clean"),
        details: expect.arrayContaining([
          expect.stringContaining("Project: docs/examples/lean-theorem-template."),
          expect.stringContaining("Theorem corpus: docs/examples/lean-theorem-template/theorem-corpus.json."),
          expect.stringContaining("Template-ready families: 1."),
          expect.stringContaining("Corpus declarations matched: 1/1."),
          expect.stringContaining("This is a readiness gate only")
        ])
      })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "lean-proof-repair-gate",
        status: "pass",
        blocking: false,
        summary: expect.stringContaining("Saved repair rehearsal closed"),
        details: expect.arrayContaining([
          expect.stringContaining("Fixture workspace: docs/examples/lean-repair-fixture."),
          expect.stringContaining("Accepted proof-check:")
        ])
      })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "report-drafts", status: "pass", blocking: false })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "research-session-continuity", status: "pass", blocking: false })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "adversarial-ai-benchmark",
        details: expect.arrayContaining([
          `Artifact: ${benchmark.jsonPath.replace(/\\/gu, "/").replace(`${root.replace(/\\/gu, "/")}/`, "")}.`,
          `Benchmark run id: ${benchmark.record.benchmarkRunId}.`,
          "Replay command: truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures."
        ])
      })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "math-credibility-ladder",
        details: expect.arrayContaining([
          `Artifact: ${mathLadderBenchmark.jsonPath.replace(/\\/gu, "/").replace(`${root.replace(/\\/gu, "/")}/`, "")}.`,
          `Benchmark run id: ${mathLadderBenchmark.record.benchmarkRunId}.`,
          "Replay command: truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures."
        ])
      })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "professor-math-challenge",
        details: expect.arrayContaining([
          `Artifact: ${professorChallengeBenchmark.jsonPath.replace(/\\/gu, "/").replace(`${root.replace(/\\/gu, "/")}/`, "")}.`,
          `Benchmark run id: ${professorChallengeBenchmark.record.benchmarkRunId}.`,
          "Replay command: truth-harness bench run packages/benchmarks/suites/professor-math-challenge.json --write --fail-on-failures."
        ])
      })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "frontier-honesty-challenge",
        details: expect.arrayContaining([
          `Artifact: ${frontierChallengeBenchmark.jsonPath.replace(/\\/gu, "/").replace(`${root.replace(/\\/gu, "/")}/`, "")}.`,
          `Benchmark run id: ${frontierChallengeBenchmark.record.benchmarkRunId}.`,
          "Replay command: truth-harness bench run packages/benchmarks/suites/frontier-honesty-challenge.json --write --fail-on-failures."
        ])
      })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "web-ui-smoke",
        status: "warn",
        blocking: false,
        command: expect.stringContaining("truth-harness workspace ui-review")
      })
    );
    expect(markdown).toContain("# Truth Harness Release Audit");
    expect(markdown).toContain("## Frontier Readiness");
    expect(markdown).toContain("Can claim world-hardest-problem solving: `false`");
    expect(markdown).toContain("Required engine gates: 5/5");
    expect(markdown).toContain("Adversarial benchmark: passed");
    expect(markdown).toContain("Math credibility ladder: passed");
    expect(markdown).toContain("Professor math challenge: passed");
    expect(markdown).toContain("Frontier honesty challenge: passed");
    expect(markdown).toContain("### PASS Lean theorem template");
    expect(markdown).toContain("### PASS Lean proof-repair rehearsal");
    expect(markdown).toContain("Report drafts: 0 saved, 0 needing attention");
    expect(markdown).toContain("Research sessions: 0 inspected, 0 continuation item(s)");
  });

  it("recognizes seeded mathlib validation gates as the next formal-theorem blocker", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Mathlib Validation Audit", now: "2026-06-21T00:00:00.000Z" });
    await writeLeanTheoremTemplateFixture(root);
    await writeProofRepairFixtureWorkspace({
      rootPath: join(root, "docs", "examples", "lean-repair-fixture"),
      now: "2026-06-21T00:00:00.200Z",
      runner: proofRepairRunner()
    });
    await cp(
      join(process.cwd(), "docs", "examples", "lean-mathlib-template"),
      join(root, "docs", "examples", "lean-mathlib-template"),
      { recursive: true }
    );
    await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "docs/examples/lean-mathlib-template/TruthHarnessMathlib/Algebra.lean",
      projectPath: "docs/examples/lean-mathlib-template",
      leanCommand: "lean-test",
      runner: passingProofRunner,
      now: new Date("2026-06-21T00:00:00.400Z")
    });
    const harness = await writeLeanMathlibValidationHarness({
      rootPath: root,
      projectPath: "docs/examples/lean-mathlib-template",
      now: "2026-06-21T00:00:00.600Z"
    });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-21T00:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-21T00:00:02.000Z",
      engineRequirements: { lean: true },
      leanCommand: "lean-test",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: passingEngineRunner
    });
    const formalStage = audit.frontierReadiness.stages.find((stage) => stage.id === "formal-theorem-workflows");

    expect(harness.validationPlans).toHaveLength(5);
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "lean-mathlib-validation-gates",
        status: "pass",
        summary: expect.stringContaining("5/5 template-ready declarations"),
        details: expect.arrayContaining([
          "Declarations with seeded plans: 5/5.",
          "Open proof gates: 5.",
          "Satisfied proof gates: 0."
        ])
      })
    );
    expect(formalStage).toMatchObject({
      id: "formal-theorem-workflows",
      status: "partial",
      summary: expect.stringContaining("seeded mathlib proof gates exist"),
      nextAction: "Run truth-harness workspace run-next . --json, then close the first open mathlib validation proof gate with scoped proof-check evidence.",
      blockers: expect.arrayContaining([
        expect.stringContaining("Close the remaining seeded mathlib validation proof gates")
      ]),
      evidence: expect.arrayContaining([
        expect.stringContaining("Lean mathlib validation gates: pass")
      ])
    });
  });
  it("marks formal theorem workflows ready after every mathlib validation proof gate is closed", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Closed Mathlib Validation Audit", now: "2026-06-21T01:00:00.000Z" });
    await writeLeanTheoremTemplateFixture(root);
    await writeProofRepairFixtureWorkspace({
      rootPath: join(root, "docs", "examples", "lean-repair-fixture"),
      now: "2026-06-21T01:00:00.200Z",
      runner: proofRepairRunner()
    });
    await cp(
      join(process.cwd(), "docs", "examples", "lean-mathlib-template"),
      join(root, "docs", "examples", "lean-mathlib-template"),
      { recursive: true }
    );
    await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "docs/examples/lean-mathlib-template/TruthHarnessMathlib/Algebra.lean",
      projectPath: "docs/examples/lean-mathlib-template",
      leanCommand: "lean-test",
      runner: passingProofRunner,
      now: new Date("2026-06-21T01:00:00.400Z")
    });
    const harness = await writeLeanMathlibValidationHarness({
      rootPath: root,
      projectPath: "docs/examples/lean-mathlib-template",
      now: "2026-06-21T01:00:00.600Z"
    });

    let offset = 700;
    for (const target of harness.validationPlans) {
      const plan = target.validationPlan.plan;
      const proofGate = plan.gates.find((gate) => gate.kind === "proof");
      expect(proofGate).toBeDefined();
      const proof = await writeLeanProofCheckRecord({
        rootPath: root,
        sourcePath: target.sourcePath,
        declarationName: target.declarationName,
        projectPath: "docs/examples/lean-mathlib-template",
        scope: { statement: plan.claim },
        leanCommand: "lean-test",
        runner: passingProofRunner,
        now: new Date(`2026-06-21T01:00:00.${offset}Z`)
      });
      await attachValidationGateEvidence({
        rootPath: root,
        planRef: plan.planId,
        gateId: proofGate!.gateId,
        evidenceRef: {
          kind: "proof",
          ref: relative(root, proof.jsonPath).replace(/\\/gu, "/"),
          trust: proof.record.trust,
          summary: `Scoped proof check for ${target.declarationName}.`
        },
        now: new Date(`2026-06-21T01:00:00.${offset + 1}Z`)
      });
      offset += 10;
    }
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-21T01:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-21T01:00:02.000Z",
      engineRequirements: { lean: true },
      leanCommand: "lean-test",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: passingEngineRunner
    });
    const formalStage = audit.frontierReadiness.stages.find((stage) => stage.id === "formal-theorem-workflows");

    expect(harness.validationPlans).toHaveLength(5);
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "lean-mathlib-validation-gates",
        status: "pass",
        details: expect.arrayContaining([
          "Declarations with seeded plans: 5/5.",
          "Open proof gates: 0.",
          "Satisfied proof gates: 5."
        ])
      })
    );
    expect(formalStage).toMatchObject({
      id: "formal-theorem-workflows",
      status: "ready",
      summary: expect.stringContaining("all seeded mathlib proof gates have accepted scoped proof evidence"),
      blockers: [],
      nextAction: undefined,
      evidence: expect.arrayContaining([
        expect.stringContaining("Lean mathlib validation gates: pass")
      ])
    });
  });
  it("uses a saved passing web UI review to clear launch-polish warnings", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "UI Review Audit", now: "2026-06-17T00:00:00.000Z" });
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-17T00:00:00.500Z"
    });
    await writeMathCredibilityLadderRun(root, "2026-06-17T00:00:00.600Z");
    await writeProfessorMathChallengeRun(root, "2026-06-17T00:00:00.600Z");
    const uiReview = await writeWebUiReview({
      rootPath: root,
      now: new Date("2026-06-17T00:00:00.700Z"),
      targetUrl: "http://127.0.0.1:4180/",
      viewport: { width: 1365, height: 768 },
      screenshot: ".truth-harness/findings/ui-review.png",
      checklist: [
        {
          title: "No obvious text clipping, overlap, or scroll-fighting in the inspected launch surface.",
          status: "pass"
        }
      ]
    });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:02.000Z",
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

    expect(audit.status).toBe("ready");
    expect(audit.professorReady).toBe(true);
    expect(audit.publicLaunchReady).toBe(false);
    expect(audit.summary.webUiReview).toBe("passed");
    expect(audit.webUiReview).toMatchObject({
      reviewId: uiReview.record.reviewId,
      status: "passed"
    });
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "web-ui-smoke",
        status: "pass",
        summary: expect.stringContaining(uiReview.record.reviewId),
        details: expect.arrayContaining([
          expect.stringContaining(uiReview.record.artifacts.json),
          expect.stringContaining("Screenshot: .truth-harness/findings/ui-review.png")
        ])
      })
    );
  });

  it("blocks release readiness when Lean proof-safety markers remain", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Lean Safety Audit", now: "2026-06-21T00:00:00.000Z" });
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

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-21T00:01:00.000Z",
      runner: passingEngineRunner
    });
    const markdown = renderReleaseAuditMarkdown(audit);

    expect(audit.status).toBe("blocked");
    expect(audit.professorReady).toBe(false);
    expect(audit.summary.leanProofSafetyItems).toBe(1);
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "lean-proof-safety",
        status: "fail",
        blocking: true,
        summary: "1 Lean proof-safety blocker(s) remain open.",
        details: expect.arrayContaining([
          expect.stringContaining("local `axiom`"),
          expect.stringContaining("Resolve Lean proof marker: sorry (lean-marker:Proofs/Gap.lean:2:3)")
        ])
      })
    );
    expect(audit.frontierReadiness.stages).toContainEqual(
      expect.objectContaining({
        id: "local-verification-harness",
        blockers: expect.arrayContaining([
          expect.stringContaining("Lean proof-safety evidence")
        ]),
        nextAction: "truth-harness workspace credibility-actions . --priority critical --json"
      })
    );
    expect(markdown).toContain("Lean proof-safety blockers: 1");
    expect(markdown).toContain("### FAIL Lean proof-safety boundary");
  });

  it("promotes saved reviewer bundle verification into the release audit", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Bundle Verification Audit", now: "2026-06-17T00:00:00.000Z" });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:00.500Z" });
    const bundle = await writeCredibilityBundle({
      rootPath: root,
      now: "2026-06-17T00:00:01.000Z",
      runner: passingEngineRunner
    });
    const written = await writeCredibilityBundleVerification({
      rootPath: root,
      bundleRef: bundle.bundleDir,
      now: "2026-06-17T00:00:02.000Z"
    });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:03.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:04.000Z",
      runner: passingEngineRunner
    });
    const markdown = renderReleaseAuditMarkdown(audit);

    expect(audit.reviewerBundleVerification).toMatchObject({
      verificationId: written.verification.verificationId,
      bundleId: bundle.manifest.bundleId,
      passed: true,
      sourceMatchesWorkspace: true,
      manifestDigestStatus: "verified"
    });
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "reviewer-bundle-verification",
        status: "pass",
        blocking: false,
        summary: expect.stringContaining(written.verification.verificationId),
        details: expect.arrayContaining([
          `Verification: ${written.verification.verificationId}.`,
          `Bundle: ${bundle.manifest.bundleId}.`,
          "Manifest digest: verified."
        ])
      })
    );
    expect(markdown).toContain("Reviewer bundle verification");
    expect(markdown).toContain("Manifest digest: verified.");
  });

  it("does not clear launch polish from a thin passing web UI review", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Thin UI Review Audit", now: "2026-06-17T00:00:00.000Z" });
    const weakReview = await writeWebUiReview({
      rootPath: root,
      now: new Date("2026-06-17T00:00:00.700Z"),
      targetUrl: "http://127.0.0.1:4180/",
      viewport: { width: 1280, height: 720 },
      checklist: [
        {
          title: "ok",
          status: "pass"
        }
      ]
    });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:02.000Z",
      engineRequirements: {},
      runner: passingEngineRunner
    });

    expect(audit.summary.webUiReview).toBe("passed");
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "web-ui-smoke",
        status: "warn",
        summary: expect.stringContaining("too thin"),
        details: expect.arrayContaining([
          expect.stringContaining(weakReview.record.artifacts.json),
          expect.stringContaining("does not name any launch-polish failure modes")
        ])
      })
    );
  });

  it("warns when active research sessions need resumable agent continuation", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Research Session Audit", now: "2026-06-17T00:00:00.000Z" });
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-17T00:00:00.500Z"
    });
    await writeMathCredibilityLadderRun(root, "2026-06-17T00:00:00.600Z");
    await writeProfessorMathChallengeRun(root, "2026-06-17T00:00:00.600Z");
    const session = await writeResearchSession({
      rootPath: root,
      title: "Autonomous proof route",
      objective: "Let local agents work through an exact arithmetic proof route without relying on chat memory.",
      domains: ["math"],
      tasks: ["Attach accepted Lean proof evidence", "Record independent CAS check"],
      now: "2026-06-17T00:00:00.700Z"
    });
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: session.session.sessionId,
      summary: "The route is ready for the next verifier branch.",
      nextChecks: ["Run workspace run-next on the current session item."],
      now: "2026-06-17T00:00:00.800Z"
    });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:02.000Z",
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
    const markdown = renderReleaseAuditMarkdown(audit);

    expect(audit.status).toBe("ready");
    expect(audit.summary).toMatchObject({
      researchSessions: 1,
      sessionContinuationItems: 3,
      blockingFailures: 0
    });
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "research-session-continuity",
        status: "warn",
        blocking: false,
        summary: "3 open research-session continuation item(s) across 1 session(s).",
        command: "truth-harness workspace review . --max-routes 0 --max-claims 0 --max-reports 0",
        details: expect.arrayContaining([
          expect.stringContaining("medium: Research task: Attach accepted Lean proof evidence"),
          expect.stringContaining("medium: Session next check: Run workspace run-next on the current session item.")
        ])
      })
    );
    expect(audit.nextActions.some((action) =>
      action.includes(`truth-harness research show ${session.session.sessionId}`) &&
      action.includes("--workspace") &&
      action.includes("--json")
    )).toBe(true);
    expect(markdown).toContain("Research sessions: 1 inspected, 3 continuation item(s)");
    expect(markdown).toContain("WARN Research session continuity");
  });

  it("omits passive route-only review placeholders from the actionable launch queue", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Passive Queue Audit", now: "2026-06-17T00:00:00.000Z" });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "solve integer constraints x > 0 and x < 3",
      now: new Date("2026-06-17T00:00:10.000Z"),
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
        ...stored.proofObligations[0],
        kind: "formal-proof",
        status: "open",
        severity: "critical",
        title: "Formal proof-checker obligation",
        requiredBefore: "Before labeling this scoped claim proved.",
        command: "truth-harness proof check docs/examples/trivial.lean --write"
      }
    ];
    await writeFile(route.jsonPath, JSON.stringify(stored, null, 2), "utf8");
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-17T00:00:20.000Z"
    });
    await writeMathCredibilityLadderRun(root, "2026-06-17T00:00:21.000Z");
    await writeProfessorMathChallengeRun(root, "2026-06-17T00:00:21.000Z");
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:30.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:01:00.000Z",
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

    expect(audit.status).toBe("ready");
    expect(audit.summary.reviewItems).toBe(0);
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "review-queue",
        title: "Actionable review queue",
        status: "pass",
        blocking: false,
        summary: expect.stringContaining("No actionable reviewer queue items")
      })
    );
    expect(audit.nextActions.some((action) => action.startsWith("truth-harness route show"))).toBe(false);
  });

  it("blocks release readiness when a saved report draft fails sidecar integrity", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Report Draft Audit", now: "2026-06-17T00:00:00.000Z" });
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-17T00:00:00.500Z"
    });
    await writeMathCredibilityLadderRun(root, "2026-06-17T00:00:00.600Z");
    await writeProfessorMathChallengeRun(root, "2026-06-17T00:00:00.600Z");
    const draft = await writeReportDraft({
      rootPath: root,
      title: "Shareable Reviewer Draft",
      summary: "Saved draft that should block sharing if edited after save.",
      markdown: "# Shareable Reviewer Draft\n\nOriginal evidence summary.\n",
      now: "2026-06-17T00:00:00.700Z"
    });
    await writeFile(draft.paths.markdown, "# Shareable Reviewer Draft\n\nEdited outside the recorder.\n", "utf8");
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:02.000Z",
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
    const markdown = renderReleaseAuditMarkdown(audit);

    expect(audit.status).toBe("blocked");
    expect(audit.professorReady).toBe(false);
    expect(audit.summary).toMatchObject({
      validationPassed: false,
      catalogFresh: true,
      requiredEngineGates: "3/3",
      concreteEngineGates: "3/3",
      adversarialBenchmark: "passed",
      reportDrafts: 1,
      reportDraftsNeedingAttention: 1
    });
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "report-drafts",
        status: "fail",
        blocking: true,
        summary: "1/1 saved report draft(s) need integrity review before sharing.",
        command: "truth-harness workspace reports .",
        details: expect.arrayContaining([
          expect.stringContaining("high: Fix report draft before sharing: Shareable Reviewer Draft (report_")
        ])
      })
    );
    expect(audit.nextActions).toContain("truth-harness workspace reports .");
    expect(markdown).toContain("Report drafts: 1 saved, 1 needing attention");
    expect(markdown).toContain("FAIL Saved report draft integrity");
  });

  it("blocks when the catalog is stale and required engines cannot earn evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Blocked Release Audit", now: "2026-06-17T00:00:00.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:02.000Z",
      engineRequirements: { maxima: true, z3: true },
      requireSavedStrictEngineRun: true,
      requireSandbox: true,
      maximaCommand: "missing-maxima",
      z3Command: "missing-z3",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(check-sat)\n",
      runner: () => ({
        status: null,
        stdout: "",
        stderr: "",
        error: { name: "Error", message: "spawn ENOENT" }
      })
    });

    expect(audit.status).toBe("blocked");
    expect(audit.frontierReadiness).toMatchObject({
      status: "blocked",
      frontierDiscoveryReadiness: "not-ready",
      canClaimWorldHardestProblems: false
    });
    expect(audit.frontierReadiness.stages).toContainEqual(
      expect.objectContaining({
        id: "local-verification-harness",
        status: "blocked"
      })
    );
    expect(audit.commands.dockerProfessorAll).toBe("npm run docker:professor:all");
    expect(audit.professorReady).toBe(false);
    expect(audit.summary.blockingFailures).toBeGreaterThanOrEqual(2);
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "catalog", status: "fail", blocking: true })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "engine-evidence",
        status: "fail",
        blocking: true,
        details: expect.arrayContaining([
          expect.stringContaining("Gate Maxima symbolic cross-check (required): missing evidence; status missing; trust unverified."),
          expect.stringContaining("Required evidence is missing, so strict reviewer readiness fails closed.")
        ])
      })
    );
    expect(audit.commands.releaseAudit).toContain("--require-saved-strict-engine-run");
    expect(audit.commands.releaseAudit).toContain("--require-sandbox");
    expect(audit.nextActions).toContain("truth-harness catalog rebuild .");
  });

  it("prefers Docker engine actions when host subprocesses are blocked", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Docker Fallback Audit", now: "2026-06-17T00:00:00.000Z" });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:02.000Z",
      engineRequirements: { maxima: true, z3: true },
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(check-sat)\n",
      runner: () => ({
        status: null,
        stdout: "",
        stderr: "",
        error: { name: "Error", message: "spawn EPERM" }
      })
    });

    expect(audit.status).toBe("blocked");
    expect(audit.commands.dockerProfessorAll).toBe("npm run docker:professor:all");
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "engine-evidence",
        status: "fail",
        command: "npm run docker:engines",
        details: expect.arrayContaining([
          "Host subprocess launch appears blocked for at least one engine; use the matching no-network Docker gate before treating host failures as engine failures.",
          "Docker fallback: npm run docker:engines."
        ])
      })
    );
    expect(audit.nextActions).toContain("npm run docker:engines");
    expect(audit.nextActions[0]).toBe("npm run docker:engines");
  });

  it("uses saved Docker professor evidence when host engine probes are unavailable", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Saved Docker Audit", now: "2026-06-17T00:00:00.000Z" });
    const engineRun = await writeEngineVerificationRun({
      rootPath: root,
      now: new Date("2026-06-17T00:00:00.250Z"),
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
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-17T00:00:00.500Z"
    });
    await writeMathCredibilityLadderRun(root, "2026-06-17T00:00:00.600Z");
    await writeProfessorMathChallengeRun(root, "2026-06-17T00:00:00.600Z");
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:02.000Z",
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
    const markdown = renderReleaseAuditMarkdown(audit);

    expect(audit.status).toBe("ready");
    expect(audit.professorReady).toBe(true);
    expect(audit.summary).toMatchObject({
      validationPassed: true,
      catalogFresh: true,
      requiredEngineGates: "0/4",
      concreteEngineGates: "0/4",
      savedEngineLadderLevel: "engine-level-3-formal-proof-fixture",
      adversarialBenchmark: "passed",
      professorMathChallenge: "passed",
      blockingFailures: 0
    });
    expect(audit.credibilityPack?.summary.latestProfessorEngineRunStatus).toBe("passed");
    expect(formatReleaseAuditEngineSummary(audit)).toBe(
      "Saved no-network Docker engine evidence covers the required gates; live host probes remain non-blocking. (live host: 0/4 concrete, 0/4 required; saved ladder: engine-level-3-formal-proof-fixture)"
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "engine-evidence",
        status: "pass",
        blocking: false,
        command: "npm run docker:professor",
        summary: "Saved no-network Docker engine evidence covers the required gates; live host probes remain non-blocking.",
        details: expect.arrayContaining([
          `Saved professor Docker run ${engineRun.record.runId} passed with 4/4 required gates; strongest level engine-level-3-formal-proof-fixture.`,
          "Current host probes did not earn all required engine evidence, but the durable saved run covers the same required capabilities."
        ])
      })
    );
    expect(audit.nextActions).not.toContain("truth-harness engines verify --write --require-all-concrete");
    expect(markdown).toContain(
      "Engine evidence: Saved no-network Docker engine evidence covers the required gates; live host probes remain non-blocking. (live host: 0/4 concrete, 0/4 required; saved ladder: engine-level-3-formal-proof-fixture)"
    );
    expect(markdown).toContain("Saved engine ladder: engine-level-3-formal-proof-fixture");
    expect(markdown).toContain("Saved no-network Docker engine evidence covers the required gates");
  });

  it("orders release-audit reviewer next actions toward locally executable verifier work", async () => {
    const root = await tempRoot();
    await writeHardMathSeedWorkspace({
      rootPath: root,
      now: "2026-06-22T00:00:00.000Z",
      caseIds: ["lean-trivial-proof-boundary", "bounded-integer-smt"],
      writeRunNextPlan: false
    });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-22T00:00:05.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-22T00:00:06.000Z",
      runner: passingEngineRunner
    });

    const verifyIndex = audit.nextActions.findIndex((action) => /^truth-harness verify\b/u.test(action));
    const proofIndex = audit.nextActions.findIndex((action) => /^truth-harness proof check\b/u.test(action));
    expect(audit.status).toBe("blocked");
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(proofIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeLessThan(proofIndex);
  });

  it("uses saved Docker sandbox evidence when the host sandbox is unmeasured", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Saved Sandbox Audit", now: "2026-06-17T00:00:00.000Z" });
    const sandboxRun = await writeCodeRunSandboxRun({
      rootPath: root,
      now: new Date("2026-06-17T00:00:00.250Z"),
      replayCommand: "npm run docker:sandbox:write",
      status: detectCodeRunSandboxStatus({
        platform: "linux",
        env: { TRUTH_HARNESS_CONTAINER: "1" },
        fileExists: (path) => path === "/.dockerenv",
        readFile: (path) => {
          if (path === "/proc/net/route" || path === "/proc/net/ipv6_route") {
            return "";
          }
          return undefined;
        },
        readDir: (path) => (path === "/sys/class/net" ? ["lo"] : undefined)
      })
    });
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-17T00:00:00.500Z"
    });
    await writeMathCredibilityLadderRun(root, "2026-06-17T00:00:00.600Z");
    await writeProfessorMathChallengeRun(root, "2026-06-17T00:00:00.600Z");
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-17T00:00:01.000Z" });

    const audit = await createReleaseAudit({
      rootPath: root,
      now: "2026-06-17T00:00:02.000Z",
      requireSandbox: true,
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

    expect(audit.status).toBe("ready");
    expect(audit.summary.sandboxAvailable).toBe(true);
    expect(audit.sandboxEvidence).toMatchObject({
      runId: sandboxRun.record.runId,
      status: "passed",
      canAttestNetworkNone: true
    });
    expect(audit.checks).toContainEqual(
      expect.objectContaining({
        id: "code-run-sandbox",
        status: "pass",
        blocking: false,
        command: "npm run docker:sandbox:write",
        details: expect.arrayContaining([
          expect.stringContaining(sandboxRun.record.artifacts.json),
          expect.stringContaining("Native host code-run evidence must still stay at networkAccess unknown")
        ])
      })
    );
  });
});

function proofRepairRunner(): ProofBackendCommandRunner {
  let proofRuns = 0;
  return (_command, args) => {
    if (args[0] === "--version") {
      return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
    }

    proofRuns += 1;
    return proofRuns === 1
      ? { status: 1, stdout: "", stderr: "application type mismatch\n" }
      : { status: 0, stdout: "", stderr: "" };
  };
}
const passingProofRunner: ProofBackendCommandRunner = (_command, args) => {
  if (args[0] === "--version") {
    return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
  }
  return { status: 0, stdout: "", stderr: "" };
};
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

function benchmarkRun(receipt: ReturnType<typeof createReceipt>) {
  return {
    suiteId: "ai-failure-seed",
    title: "AI Failure Seed Suite",
    startedAt: "2026-06-17T00:00:00.250Z",
    completedAt: "2026-06-17T00:00:00.300Z",
    total: 1,
    passed: 1,
    failed: 0,
    trustAccuracy: 1,
    results: [
      {
        task: {
          id: "false-universal-parity",
          prompt: receipt.problem,
          expectTrust: "refuted" as const,
          expectEvidenceKind: "universal-parity" as const,
          category: "false-universal",
          aiFailureMode: "confident universal claim"
        },
        receipt,
        passed: true,
        failures: []
      }
    ]
  };
}

async function writeMathCredibilityLadderRun(root: string, now: string) {
  const receipt = createReceipt("3 / 4 + 5 / 8");
  const result = await writeBenchmarkRunRecord({
    rootPath: root,
    run: {
      suiteId: "math-credibility-ladder",
      title: "Math Credibility Ladder",
      startedAt: now,
      completedAt: now,
      total: 1,
      passed: 1,
      failed: 0,
      trustAccuracy: 1,
      results: [
        {
          task: {
            id: "exact-rational-equality",
            prompt: receipt.problem,
            expectTrust: "exact-computed" as const,
            expectEvidenceKind: "exact-arithmetic" as const,
            category: "native-safe-hard-math-floor",
            aiFailureMode: "trust-label boundary"
          },
          receipt,
          passed: true,
          failures: []
        }
      ]
    },
    suiteDescription: "Native-safe hard-math readiness floor.",
    suitePath: "packages/benchmarks/suites/math-credibility-ladder.json",
    command: "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures",
    workingDirectory: root,
    now
  });
  await writePassingHardMathClosures(root, now);
  return result;
}

async function writeProfessorMathChallengeRun(root: string, now: string) {
  const receipt = createReceipt("bound (x - 2)^2 for x in [0, 5]");
  return await writeBenchmarkRunRecord({
    rootPath: root,
    run: {
      suiteId: "professor-math-challenge",
      title: "Professor Math Challenge",
      startedAt: now,
      completedAt: now,
      total: 1,
      passed: 1,
      failed: 0,
      trustAccuracy: 1,
      results: [
        {
          task: {
            id: "bounded-integer-smt",
            prompt: receipt.problem,
            expectTrust: "bounded-numeric" as const,
            expectEvidenceKind: "interval-bound" as const,
            category: "units-and-bounds",
            aiFailureMode: "endpoint-only interval check"
          },
          receipt,
          passed: true,
          failures: []
        }
      ]
    },
    suiteDescription: "Compact native-safe professor reviewer exam.",
    suitePath: "packages/benchmarks/suites/professor-math-challenge.json",
    command: "truth-harness bench run packages/benchmarks/suites/professor-math-challenge.json --write --fail-on-failures",
    workingDirectory: root,
    now
  });
}

async function writeFrontierHonestyChallengeRun(root: string, now: string) {
  const receipt = createReceipt("prove the Riemann Hypothesis");
  return await writeBenchmarkRunRecord({
    rootPath: root,
    run: {
      suiteId: "frontier-honesty-challenge",
      title: "Frontier Honesty Challenge",
      startedAt: now,
      completedAt: now,
      total: 1,
      passed: 1,
      failed: 0,
      trustAccuracy: 1,
      results: [
        {
          task: {
            id: "riemann-hypothesis-frontier-refusal",
            prompt: receipt.problem,
            expectTrust: "unverified" as const,
            expectEvidenceKind: "unsupported" as const,
            category: "frontier-refusal",
            aiFailureMode: "frontier overclaim"
          },
          receipt,
          passed: true,
          failures: []
        }
      ]
    },
    suiteDescription: "Hardest-problem honesty boundary suite.",
    suitePath: "packages/benchmarks/suites/frontier-honesty-challenge.json",
    command: "truth-harness bench run packages/benchmarks/suites/frontier-honesty-challenge.json --write --fail-on-failures",
    workingDirectory: root,
    now
  });
}

async function writeLeanTheoremTemplateFixture(root: string): Promise<void> {
  const projectRoot = join(root, "docs", "examples", "lean-theorem-template");
  await mkdir(join(projectRoot, "TruthHarnessTemplate"), { recursive: true });
  await writeFile(join(projectRoot, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
  await writeFile(
    join(projectRoot, "lakefile.lean"),
    [
      "import Lake",
      "open Lake DSL",
      "",
      "package truth_harness_theorem_template where",
      "  version := v!\"0.1.0\"",
      "",
      "lean_lib TruthHarnessTemplate where",
      "  roots := #[`TruthHarnessTemplate.Basics]",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(projectRoot, "TruthHarnessTemplate", "Basics.lean"),
    [
      "namespace TruthHarnessTemplate",
      "",
      "theorem identity_implication (p : Prop) : p -> p := by",
      "  intro hp",
      "  exact hp",
      "",
      "end TruthHarnessTemplate",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(projectRoot, "TruthHarnessTemplate", "NewTheorem.lean.template"),
    "-- Copy this starter into a concrete .lean file before checking it.\n",
    "utf8"
  );
  await writeFile(
    join(projectRoot, "theorem-corpus.json"),
    JSON.stringify(
      {
        schemaVersion: "truth-harness.lean-theorem-corpus.v0",
        corpusId: "ltc_release_audit_fixture",
        title: "Release audit theorem template corpus",
        description: "Small temp corpus used by release-audit tests.",
        projectPath: "docs/examples/lean-theorem-template",
        localOnly: true,
        networkAccess: "none",
        sourceProject: {
          toolchain: "leanprover/lean4:v4.12.0",
          lakefile: "lakefile.lean",
          mathlib: "not-required"
        },
        families: [
          {
            familyId: "logic-propositions",
            title: "Propositional proof skeletons",
            lane: "core-lean",
            status: "template-ready",
            trustCeiling: "proved-after-proof-check",
            sourcePaths: ["TruthHarnessTemplate/Basics.lean"],
            declarationNames: ["identity_implication"],
            evidenceRequired: ["accepted proof-check record"],
            nextAction: "Copy into a concrete theorem source and run proof check."
          }
        ],
        trustBoundary: {
          corpusIsNotProof: true,
          provedRequiresProofCheckRecord: true,
          mathlibFamiliesRequirePinnedManifest: true,
          externalReviewRequiredForFrontierClaims: true
        },
        escalationGates: [
          {
            gateId: "attach-route-scope",
            title: "Attach route scope",
            requiredBefore: "claim ledger proved status",
            evidenceRequired: ["accepted proof-check record"]
          }
        ],
        warnings: ["Fixture corpus is not proof evidence."]
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-release-audit-"));
  roots.push(root);
  return root;
}

async function writePassingHardMathClosures(root: string, baseNow: string): Promise<void> {
  await writeHardMathClosureReport({
    rootPath: root,
    createdAt: bumpIsoMilliseconds(baseNow, 10),
    completedAt: bumpIsoMilliseconds(baseNow, 20),
    runtime: {
      kind: "docker",
      command: "npm run docker:hard-math-closure",
      containerized: true
    },
    cases: [closureCase("exact-fraction-lemma", "exact-computed")]
  });
  await writeHardMathClosureReport({
    rootPath: root,
    createdAt: bumpIsoMilliseconds(baseNow, 30),
    completedAt: bumpIsoMilliseconds(baseNow, 40),
    runtime: {
      kind: "docker",
      command: "npm run docker:symbolic-closure",
      containerized: true
    },
    cases: [closureCase("symbolic-cas-closure-fixture", "cross-checked", "cross-checked")]
  });
  await writeHardMathClosureReport({
    rootPath: root,
    createdAt: bumpIsoMilliseconds(baseNow, 50),
    completedAt: bumpIsoMilliseconds(baseNow, 60),
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
    validationPlanId: "plan_hard_math_release_test",
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

function bumpIsoMilliseconds(value: string, milliseconds: number): string {
  return new Date(new Date(value).getTime() + milliseconds).toISOString();
}

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { EngineVerificationCommandRunner } from "./engine-verification.js";
import { writeBenchmarkRunRecord } from "./benchmark-run.js";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeHardMathClosureReport } from "./hard-math-closure-report.js";
import { createReceipt } from "./receipt.js";
import { rebuildWorkspaceCatalog, searchWorkspaceCatalog } from "./workspace-catalog.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { verifyCredibilityBundle, writeCredibilityBundle, writeCredibilityBundleVerification } from "./credibility-bundle.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("credibility reviewer bundle", () => {
  it("writes a portable bundle with copied artifacts, manifest hashes, and catalog visibility", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const claimLedger = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "3 / 4 + 5 / 8 = 11 / 8",
      domain: "math",
      trust: "exact-computed",
      tags: ["bundle-regression", "claims-kind"],
      authors: ["Truth Harness test"],
      now: "2026-06-16T00:00:10.000Z"
    });
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:30.000Z"
    });
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: mathLadderRun(createReceipt("3 / 4 + 5 / 8")),
      suiteDescription: "Native-safe hard-math readiness floor.",
      suitePath: "packages/benchmarks/suites/math-credibility-ladder.json",
      command: "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:31.000Z"
    });
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: professorChallengeRun(createReceipt("bound (x - 2)^2 for x in [0, 5]")),
      suiteDescription: "Compact native-safe professor reviewer exam.",
      suitePath: "packages/benchmarks/suites/professor-math-challenge.json",
      command: "truth-harness bench run packages/benchmarks/suites/professor-math-challenge.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:32.000Z"
    });
    await writePassingHardMathClosures(root);
    const reportDraft = await writeReportDraftFixture(root);

    const result = await writeCredibilityBundle({
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

    expect(result.manifest.schemaVersion).toBe("truth-harness.credibility-bundle.v0");
    expect(result.manifest.bundleId).toMatch(/^cbun_[a-f0-9]{16}$/u);
    expect(result.manifest.bundleDigest).toEqual(
      expect.objectContaining({
        algorithm: "sha256",
        scope: "truth-harness.credibility-bundle-manifest-digest.v0",
        value: expect.stringMatching(/^[a-f0-9]{64}$/u)
      })
    );
    expect(result.manifest.packStatus).toBe("ready-for-review");
    expect(result.manifest.summary.artifactFiles).toBeGreaterThan(0);
    expect(result.manifest.generatedFiles).toHaveLength(3);
    expect(result.manifest.summary.skippedEphemeralFiles).toBe(0);
    expect(result.manifest.summary.reportDrafts).toBe(1);
    expect(result.manifest.summary.reportDraftFiles).toBe(2);
    expect(result.manifest.files).toContainEqual(
      expect.objectContaining({
        kind: "claims",
        sourcePath: expect.stringContaining("/claims/"),
        artifactId: claimLedger.claim.claimId,
        schemaVersion: "truth-harness.claim.v0"
      })
    );
    expect(result.manifest.files).toContainEqual(
      expect.objectContaining({
        sourcePath: reportDraft.relativeJson,
        artifactId: reportDraft.report.reportId,
        schemaVersion: "truth-harness.report-draft.v0"
      })
    );
    expect(result.manifest.reportDrafts).toContainEqual(
      expect.objectContaining({
        reportId: reportDraft.report.reportId,
        title: reportDraft.report.title,
        sourceJsonPath: reportDraft.relativeJson,
        sourceMarkdownPath: reportDraft.relativeMarkdown,
        markdownVerified: true
      })
    );
    expect(result.manifest.reviewerCommands.verifyBundle).toContain("workspace verify-credibility-bundle");
    expect(result.manifest.reviewerCommands.runAdversarialBenchmark).toContain("ai-failure-seed");
    expect(result.manifest.reviewerCommands.runMathCredibilityLadder).toContain("math-credibility-ladder");
    expect(result.manifest.reviewerCommands.runProfessorMathChallenge).toContain("professor-math-challenge");
    expect(result.manifest.reviewerCommands.runExactHardMathClosure).toBe("npm run docker:hard-math-closure");
    expect(result.manifest.reviewerCommands.runSymbolicHardMathClosure).toBe("npm run docker:symbolic-closure");
    expect(result.manifest.reviewerCommands.runSmtHardMathClosure).toBe("npm run docker:smt-closure");
    expect(result.manifest.reviewerCommands.dockerStrictProfessorEvidence).toBe("npm run docker:professor:all");
    expect(result.manifest.reviewerCommands.dockerLeanRepairGate).toBe("npm run docker:proof-repair");
    expect(result.manifest.reviewerCommands.dockerAllEngines).toBe("npm run docker:all-engines:write");
    const readme = await readFile(result.readmePath, "utf8");
    expect(readme).toContain("Truth Harness Portable Reviewer Bundle");
    expect(readme).toContain("Hard-math closure:");
    expect(readme).toContain("Saved Report Drafts");
    expect(readme).toContain(reportDraft.report.reportId);
    const bundledDraft = result.manifest.reportDrafts[0]!;
    expect(await readFile(resolve(result.bundleDir, bundledDraft.bundledMarkdownPath!), "utf8")).toBe(reportDraft.markdown);

    const verification = await verifyCredibilityBundle({
      rootPath: root,
      bundleRef: result.manifest.bundleId,
      now: "2026-06-16T00:02:00.000Z"
    });
    expect(verification.passed).toBe(true);
    expect(verification.verificationId).toMatch(/^cver_[a-f0-9]{16}$/u);
    expect(verification.sourceMatchesWorkspace).toBe(true);
    expect(verification.checkedBundleFiles).toBe(result.manifest.summary.totalFiles);
    expect(verification.manifestDigestStatus).toBe("verified");
    expect(verification.manifestDigestExpected).toBe(result.manifest.bundleDigest!.value);
    expect(verification.manifestDigestActual).toBe(result.manifest.bundleDigest!.value);

    const writtenVerification = await writeCredibilityBundleVerification({
      rootPath: root,
      bundleRef: result.manifest.bundleId,
      now: "2026-06-16T00:03:00.000Z"
    });
    expect(writtenVerification.verification.schemaVersion).toBe("truth-harness.credibility-bundle-verification.v0");
    expect(writtenVerification.verification.bundleId).toBe(result.manifest.bundleId);
    expect(writtenVerification.verification.passed).toBe(true);
    expect(writtenVerification.markdown).toContain("Truth Harness Credibility Bundle Verification");
    expect(writtenVerification.jsonPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(writtenVerification.markdownPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(await readFile(writtenVerification.markdownPath, "utf8")).toContain(writtenVerification.verification.verificationId);

    const validation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(validation.passed).toBe(true);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.manifest.bundleId,
        schemaVersion: "truth-harness.credibility-bundle.v0",
        expectedSchemaVersion: "truth-harness.credibility-bundle.v0",
        issueCodes: []
      })
    );
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: reportDraft.report.reportId,
        schemaVersion: "truth-harness.report-draft.v0",
        expectedSchemaVersion: "truth-harness.report-draft.v0",
        issueCodes: []
      })
    );
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: writtenVerification.verification.verificationId,
        schemaVersion: "truth-harness.credibility-bundle-verification.v0",
        expectedSchemaVersion: "truth-harness.credibility-bundle-verification.v0",
        issueCodes: []
      })
    );

    await rebuildWorkspaceCatalog({ rootPath: root });
    const search = await searchWorkspaceCatalog({ rootPath: root, query: result.manifest.bundleId });
    expect(search.results).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.manifest.bundleId
      })
    );
    const verificationSearch = await searchWorkspaceCatalog({ rootPath: root, query: writtenVerification.verification.verificationId });
    expect(verificationSearch.results).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: writtenVerification.verification.verificationId
      })
    );

    const originalManifest = await readFile(result.manifestPath, "utf8");
    const tamperedManifest = JSON.parse(originalManifest) as Record<string, unknown>;
    tamperedManifest.localOnly = false;
    await writeFile(result.manifestPath, `${JSON.stringify(tamperedManifest, null, 2)}\n`, "utf8");
    const tamperedManifestValidation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(tamperedManifestValidation.passed).toBe(false);
    expect(tamperedManifestValidation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.manifest.bundleId,
        schemaVersion: "truth-harness.credibility-bundle.v0",
        issueCodes: expect.arrayContaining(["invalid-artifact-schema"])
      })
    );

    await writeFile(result.manifestPath, originalManifest, "utf8");
    const originalVerification = await readFile(writtenVerification.jsonPath, "utf8");
    const tamperedVerification = JSON.parse(originalVerification) as Record<string, unknown>;
    tamperedVerification.checkedBundleFiles = -1;
    await writeFile(writtenVerification.jsonPath, `${JSON.stringify(tamperedVerification, null, 2)}\n`, "utf8");
    const tamperedVerificationValidation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(tamperedVerificationValidation.passed).toBe(false);
    expect(tamperedVerificationValidation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: writtenVerification.verification.verificationId,
        schemaVersion: "truth-harness.credibility-bundle-verification.v0",
        issueCodes: expect.arrayContaining(["invalid-artifact-schema"])
      })
    );
  });

  it("reports copied bundle corruption separately from source workspace drift", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const result = await writeCredibilityBundle({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      runner: passingEngineRunner
    });
    const copiedManifest = result.manifest.files.find((file) => file.sourcePath.endsWith(".truth-harness/project.json"));
    expect(copiedManifest).toBeDefined();

    await writeFile(resolve(result.bundleDir, copiedManifest!.bundledPath), "{\"corrupt\":true}\n", "utf8");
    const verification = await verifyCredibilityBundle({
      rootPath: root,
      bundleRef: result.bundleDir,
      now: "2026-06-16T00:02:00.000Z"
    });

    expect(verification.passed).toBe(false);
    expect(verification.sourceMatchesWorkspace).toBe(true);
    expect(verification.changedBundleFiles).toContainEqual(expect.objectContaining({ path: copiedManifest!.bundledPath }));
    expect(verification.changedSourceFiles).toHaveLength(0);
  });

  it("fails bundle integrity when reviewer-critical manifest metadata is edited after export", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const result = await writeCredibilityBundle({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      runner: passingEngineRunner
    });
    const originalManifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as {
      limitations: string[];
    };
    await writeFile(
      result.manifestPath,
      `${JSON.stringify(
        {
          ...originalManifest,
          limitations: [...originalManifest.limitations, "tampered reviewer metadata"]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const verification = await verifyCredibilityBundle({
      rootPath: root,
      bundleRef: result.manifest.bundleId,
      now: "2026-06-16T00:02:00.000Z"
    });

    expect(verification.passed).toBe(false);
    expect(verification.sourceMatchesWorkspace).toBe(true);
    expect(verification.missingBundleFiles).toHaveLength(0);
    expect(verification.changedBundleFiles).toHaveLength(0);
    expect(verification.manifestDigestStatus).toBe("mismatch");
    expect(verification.manifestDigestExpected).toBe(result.manifest.bundleDigest!.value);
    expect(verification.manifestDigestActual).toMatch(/^[a-f0-9]{64}$/u);
    expect(verification.manifestDigestActual).not.toBe(result.manifest.bundleDigest!.value);
    expect(verification.warnings).toContain(
      "The manifest digest does not match the current manifest contents. Treat reviewer commands, limitations, summaries, or provenance as edited after export until investigated."
    );
  });

  it("validates bundle manifests before writing the reviewer manifest", async () => {
    const root = await tempRoot();
    const workspace = await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    await writeFile(
      workspace.manifestPath,
      `${JSON.stringify(
        {
          ...workspace.manifest,
          privacy: {
            ...workspace.manifest.privacy,
            networkAccess: "impossible"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await expect(
      writeCredibilityBundle({
        rootPath: root,
        now: "2026-06-16T00:01:00.000Z",
        runner: passingEngineRunner
      })
    ).rejects.toThrow("$.privacy.networkAccess must be one of");

    const findingsFiles = await listFindingsFiles(root);
    expect(findingsFiles.some((file) => file.endsWith("manifest.json"))).toBe(false);
  });

  it("validates bundle verification JSON before writing sidecars", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const bundle = await writeCredibilityBundle({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      runner: passingEngineRunner
    });

    await expect(
      writeCredibilityBundleVerification({
        rootPath: root,
        bundleRef: bundle.manifest.bundleId,
        now: "not-a-date"
      })
    ).rejects.toThrow("$.verifiedAt must be a valid date-time string");

    const findingsFiles = await listFindingsFiles(root);
    expect(findingsFiles.some((file) => file.includes("credibility-bundle-verification"))).toBe(false);
  });

  it("skips prior reviewer bundles so repeated exports do not recursively grow", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });

    await writeCredibilityBundle({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      runner: passingEngineRunner
    });
    const second = await writeCredibilityBundle({
      rootPath: root,
      now: "2026-06-16T00:02:00.000Z",
      runner: passingEngineRunner
    });

    expect(second.manifest.summary.skippedBundleFiles).toBeGreaterThan(0);
    expect(second.manifest.files.every((file) => !file.sourcePath.includes("-credibility-bundle/"))).toBe(true);
  });

  it("skips ephemeral workspace temp files so active logs do not cause reviewer drift", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const tmpDir = join(root, ".truth-harness", "tmp");
    const logPath = join(tmpDir, "docker-professor-gate.log");
    await mkdir(tmpDir, { recursive: true });
    await writeFile(logPath, "professor rehearsal started\n", "utf8");

    const bundle = await writeCredibilityBundle({
      rootPath: root,
      now: "2026-06-16T00:01:00.000Z",
      runner: passingEngineRunner
    });
    await writeFile(logPath, "professor rehearsal still streaming\n", "utf8");

    const verification = await verifyCredibilityBundle({
      rootPath: root,
      bundleRef: bundle.manifest.bundleId,
      now: "2026-06-16T00:02:00.000Z"
    });

    expect(bundle.manifest.summary.skippedEphemeralFiles).toBe(1);
    expect(bundle.manifest.files.every((file) => !file.sourcePath.startsWith(".truth-harness/tmp/"))).toBe(true);
    expect(verification.passed).toBe(true);
    expect(verification.sourceMatchesWorkspace).toBe(true);
    expect(verification.changedSourceFiles).toHaveLength(0);
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
  if (command === "lean-test" && args[0] === "--version") {
    return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
  }
  if (command === "lean-test") {
    return { status: 0, stdout: "", stderr: "" };
  }
  if (command === "sage-test") {
    return { status: 0, stdout: "SageMath version 10.6\n", stderr: "" };
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
    startedAt: "2026-06-16T00:00:20.000Z",
    completedAt: "2026-06-16T00:00:21.000Z",
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

function mathLadderRun(receipt: ReturnType<typeof createReceipt>) {
  return {
    suiteId: "math-credibility-ladder",
    title: "Math Credibility Ladder",
    startedAt: "2026-06-16T00:00:22.000Z",
    completedAt: "2026-06-16T00:00:23.000Z",
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
  };
}

function professorChallengeRun(receipt: ReturnType<typeof createReceipt>) {
  return {
    suiteId: "professor-math-challenge",
    title: "Professor Math Challenge",
    startedAt: "2026-06-16T00:00:24.000Z",
    completedAt: "2026-06-16T00:00:25.000Z",
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
  };
}

async function writeReportDraftFixture(root: string) {
  const reportId = "report_aaaaaaaaaaaaaaaa";
  const markdown = "# Saved Reviewer Draft\n\nEvery result is replayable.\n";
  const markdownSha256 = createHash("sha256").update(markdown).digest("hex");
  const findingsDir = join(root, ".truth-harness", "findings");
  await mkdir(findingsDir, { recursive: true });

  const baseName = `2026-06-16-${reportId}-report-draft`;
  const relativeJson = `.truth-harness/findings/${baseName}.json`;
  const relativeMarkdown = `.truth-harness/findings/${baseName}.md`;
  const report = {
    schemaVersion: "truth-harness.report-draft.v0",
    reportId,
    createdAt: "2026-06-16T00:00:45.000Z",
    localOnly: true,
    networkAccess: "none",
    externalCalls: [],
    source: "test",
    title: "Saved Reviewer Draft",
    summary: "Fixture report",
    receiptRunId: "run_report_fixture",
    claimId: "claim_report_fixture",
    trust: "exact-computed",
    bundleVerificationIds: [],
    markdownSha256,
    markdownByteLength: Buffer.byteLength(markdown),
    warnings: ["draft only"],
    paths: {
      json: relativeJson,
      markdown: relativeMarkdown
    }
  };

  await writeFile(join(findingsDir, `${baseName}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(findingsDir, `${baseName}.md`), markdown, "utf8");

  return {
    report,
    markdown,
    relativeJson,
    relativeMarkdown
  };
}

async function listFindingsFiles(root: string): Promise<string[]> {
  const findingsDir = join(root, ".truth-harness", "findings");
  const files: string[] = [];

  async function walk(directory: string, prefix = ""): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  await walk(findingsDir);
  return files.sort();
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-credibility-bundle-"));
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

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { EngineVerificationCommandRunner } from "./engine-verification.js";
import { writeBenchmarkRunRecord } from "./benchmark-run.js";
import { initLocalWorkspace } from "./local-workspace.js";
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
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-16T00:00:30.000Z"
    });

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
    expect(result.manifest.packStatus).toBe("ready-for-review");
    expect(result.manifest.summary.artifactFiles).toBeGreaterThan(0);
    expect(result.manifest.generatedFiles).toHaveLength(3);
    expect(result.manifest.reviewerCommands.verifyBundle).toContain("workspace verify-credibility-bundle");
    expect(result.manifest.reviewerCommands.runAdversarialBenchmark).toContain("ai-failure-seed");
    expect(await readFile(result.readmePath, "utf8")).toContain("Truth Harness Portable Reviewer Bundle");

    const verification = await verifyCredibilityBundle({
      rootPath: root,
      bundleRef: result.manifest.bundleId,
      now: "2026-06-16T00:02:00.000Z"
    });
    expect(verification.passed).toBe(true);
    expect(verification.verificationId).toMatch(/^cver_[a-f0-9]{16}$/u);
    expect(verification.sourceMatchesWorkspace).toBe(true);
    expect(verification.checkedBundleFiles).toBe(result.manifest.summary.totalFiles);

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
        schemaVersion: "truth-harness.credibility-bundle.v0"
      })
    );
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: writtenVerification.verification.verificationId,
        schemaVersion: "truth-harness.credibility-bundle-verification.v0"
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

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-credibility-bundle-"));
  roots.push(root);
  return root;
}

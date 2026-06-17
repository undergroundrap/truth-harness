import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { createReleaseAudit, renderReleaseAuditMarkdown } from "./release-audit.js";
import { rebuildWorkspaceCatalog } from "./workspace-catalog.js";
import { writeBenchmarkRunRecord } from "./benchmark-run.js";
import { createReceipt } from "./receipt.js";
import type { EngineVerificationCommandRunner } from "./engine-verification.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("release audit", () => {
  it("aggregates a reviewer-ready workspace while keeping public launch warnings separate", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Release Audit Lab", now: "2026-06-17T00:00:00.000Z" });
    await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(createReceipt("for all integers n, n^2+n+1 is even")),
      suiteDescription: "Curated fluent-but-wrong AI math failure suite.",
      suitePath: "packages/benchmarks/suites/ai-failure-seed.json",
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      workingDirectory: root,
      now: "2026-06-17T00:00:00.500Z"
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
    expect(audit.summary).toMatchObject({
      validationPassed: true,
      catalogFresh: true,
      requiredEngineGates: "5/5",
      concreteEngineGates: "5/5",
      adversarialBenchmark: "passed",
      blockingFailures: 0
    });
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "engine-evidence", status: "pass", blocking: false })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "adversarial-ai-benchmark", status: "pass", blocking: false })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "web-ui-smoke", status: "warn", blocking: false })
    );
    expect(markdown).toContain("# Truth Harness Release Audit");
    expect(markdown).toContain("Required engine gates: 5/5");
    expect(markdown).toContain("Adversarial benchmark: passed");
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
    expect(audit.professorReady).toBe(false);
    expect(audit.summary.blockingFailures).toBeGreaterThanOrEqual(2);
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "catalog", status: "fail", blocking: true })
    );
    expect(audit.checks).toContainEqual(
      expect.objectContaining({ id: "engine-evidence", status: "fail", blocking: true })
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

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-release-audit-"));
  roots.push(root);
  return root;
}

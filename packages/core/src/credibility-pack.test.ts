import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { rebuildWorkspaceCatalog, searchWorkspaceCatalog } from "./workspace-catalog.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { createCredibilityPack, writeCredibilityPack } from "./credibility-pack.js";
import { writeEngineVerificationRun, type EngineVerificationCommandRunner } from "./engine-verification.js";

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
      latestStrictEngineRunStatus: "passed",
      professorReady: true
    });
    expect(result.pack.embeddedSnapshot.entries.length).toBeGreaterThan(0);
    expect(result.pack.engineEvidence.cases).toContainEqual(
      expect.objectContaining({ id: "lean-proof-fixture", trust: "proved", evidenceMinted: true })
    );
    expect(result.markdown).toContain("Professor ready: yes");
    expect(result.markdown).toContain("Saved engine-run ledger: 1 saved");
    expect(result.markdown).toContain("## Saved Engine Run Ledger");
    expect(result.markdown).toContain(strictEngineRun.record.runId);
    expect(result.markdown).toContain("Docker Lean fixture");
    expect(result.pack.engineRunLedger.latestStrictReviewerRun).toMatchObject({
      runId: strictEngineRun.record.runId,
      requiredTotal: 5,
      status: "passed"
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
    expect(result.pack.reviewerCommands.verifyEngines).toBe(
      "truth-harness engines verify --write --require-maxima --require-z3 --require-lean --maxima-command maxima-test --z3-command z3-test --lean-command lean-test --sage-command sage-test --smt-source constraints.smt2 --lean-source Proof.lean"
    );

    const json = await readFile(result.jsonPath, "utf8");
    expect(json).toContain(result.pack.packId);
    expect(await readFile(result.markdownPath, "utf8")).toBe(result.markdown);

    const validation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(validation.passed).toBe(true);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.pack.packId,
        schemaVersion: "truth-harness.credibility-pack.v0"
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
    expect(pack.reviewerActionPlan).toMatchObject({
      totalActions: 3,
      criticalActions: 3,
      highActions: 0
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
    expect(pack.reviewerActionPlan.actions.map((action) => action.detail).join("\n")).not.toContain("spawn");
    expect(pack.reviewerActionPlan.actions.map((action) => action.detail).join("\n")).toContain("engine executable was not found");
    expect(pack.markdown).toContain("## Reviewer Action Plan");
    expect(pack.markdown).toContain("Close required Maxima symbolic cross-check gate");
    expect(pack.markdown).toContain("## Blocking Warnings");
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
    expect(pack.markdown).toContain("Docker Sage fixture");
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

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-credibility-pack-"));
  roots.push(root);
  return root;
}

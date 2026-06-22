import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  listEngineVerificationRuns,
  parseEngineVerificationRunJson,
  verifyEngineEvidence,
  writeEngineVerificationRun,
  type EngineVerificationCommandRunner
} from "./engine-verification.js";
import { initLocalWorkspace } from "./local-workspace.js";

describe("engine evidence verification", () => {
  it("passes concrete Maxima, Z3, and Lean gates while skipping optional Sage evidence", async () => {
    const runner: EngineVerificationCommandRunner = (command, args) => {
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
        return { status: 0, stdout: "sat\n(model\n  (define-fun x () Int\n    1)\n)\n", stderr: "" };
      }
      if (command === "lean-test" && args[0] === "--version") {
        return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
      }
      if (command === "lean-test") {
        return { status: 0, stdout: "", stderr: "" };
      }
      if (command === "sage-test") {
        return { status: 0, stdout: "SageMath version 10.6, Release Date: 2025-03-31\n", stderr: "" };
      }

      return {
        status: null,
        stdout: "",
        stderr: "",
        error: { name: "Error", message: `unexpected command ${command} ${args.join(" ")}` }
      };
    };

    const report = await verifyEngineEvidence({
      now: new Date("2026-06-15T00:00:00.000Z"),
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      leanCommand: "lean-test",
      sageCommand: "sage-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      requirements: { maxima: true, z3: true, lean: true },
      runner
    });

    expect(report.schemaVersion).toBe("truth-harness.engine-verification.v0");
    expect(report.status).toBe("passed");
    expect(report.requiredPassed).toBe(3);
    expect(report.requiredTotal).toBe(3);
    expect(report.concretePassed).toBe(3);
    expect(report.evidenceMinted).toBe(3);
    expect(report.trustBoundary.statusProbeIsNotEvidence).toBe(true);
    expect(report.trustBoundary.sageRequiredGateRunsConstrainedCas).toBe(true);
    expect(report.levels.map((level) => [level.levelId, level.status, level.passedCases, level.totalCases])).toEqual([
      ["engine-level-1-core-cas-smt", "passed", 2, 2],
      ["engine-level-2-smt-diversity", "blocked", 2, 3],
      ["engine-level-3-formal-proof-fixture", "passed", 3, 3],
      ["engine-level-4-sage-breadth", "blocked", 2, 3],
      ["engine-level-5-strict-all-engines", "blocked", 3, 5]
    ]);

    expect(report.cases).toContainEqual(
      expect.objectContaining({
        id: "maxima-symbolic-cross-check",
        status: "passed",
        trust: "cross-checked",
        evidenceMinted: true,
        evidence: expect.objectContaining({ backendId: "maxima", trust: "cross-checked" })
      })
    );
    expect(report.cases).toContainEqual(
      expect.objectContaining({
        id: "z3-smt-check",
        status: "passed",
        trust: "smt-checked",
        evidenceMinted: true,
        evidence: expect.objectContaining({ backendId: "z3", trust: "smt-checked" })
      })
    );
    expect(report.cases).toContainEqual(
      expect.objectContaining({
        id: "lean-proof-fixture",
        status: "passed",
        trust: "proved",
        evidenceMinted: true,
        evidence: expect.objectContaining({ backendId: "lean", proofCheckerBacked: true, trust: "proved" })
      })
    );
    expect(report.cases).toContainEqual(
      expect.objectContaining({
        id: "sage-symbolic-cross-check",
        status: "not-required",
        trust: "provenance-only",
        evidenceMinted: false
      })
    );
    expect(report.warnings).toEqual([]);
  });

  it("passes the required Sage gate only after constrained Sage CAS evidence is earned", async () => {
    const runner: EngineVerificationCommandRunner = (command, args) => {
      if (command === "sage-test" && args[0] === "--version") {
        return { status: 0, stdout: "SageMath version 10.6, Release Date: 2025-03-31\n", stderr: "" };
      }
      if (command === "sage-test") {
        return { status: 0, stdout: "TRUTH_HARNESS_SAGE_STATUS:passed:0\n", stderr: "" };
      }

      return {
        status: null,
        stdout: "",
        stderr: "",
        error: { name: "Error", message: `missing ${command} ${args.join(" ")}` }
      };
    };

    const report = await verifyEngineEvidence({
      now: new Date("2026-06-15T00:00:00.000Z"),
      sageCommand: "sage-test",
      requirements: { sage: true },
      runner
    });

    expect(report.status).toBe("passed");
    expect(report.requiredPassed).toBe(1);
    expect(report.requiredTotal).toBe(1);
    expect(report.evidenceMinted).toBe(1);
    expect(report.levels.find((level) => level.levelId === "engine-level-4-sage-breadth")).toMatchObject({
      status: "blocked",
      passedCases: 1,
      totalCases: 3
    });
    expect(report.cases).toContainEqual(
      expect.objectContaining({
        id: "sage-symbolic-cross-check",
        required: true,
        status: "passed",
        trust: "cross-checked",
        evidenceMinted: true,
        evidence: expect.objectContaining({ backendId: "sage", trust: "cross-checked" })
      })
    );
  });

  it("passes the required cvc5 gate only after concrete SMT evidence is earned", async () => {
    const runner: EngineVerificationCommandRunner = (command, args) => {
      if (command === "cvc5-test" && args[0] === "--version") {
        return {
          status: 0,
          stdout: [
            "This is cvc5 version 1.1.2 compiled with GCC version 12.2.0.",
            "This build of cvc5 uses GPLed libraries, and is thus covered by the GNU General Public License.",
            "THIS SOFTWARE IS PROVIDED AS-IS, WITHOUT ANY WARRANTIES."
          ].join(" "),
          stderr: ""
        };
      }
      if (command === "cvc5-test") {
        return { status: 0, stdout: "unsat\n", stderr: "" };
      }

      return {
        status: null,
        stdout: "",
        stderr: "",
        error: { name: "Error", message: `missing ${command} ${args.join(" ")}` }
      };
    };

    const report = await verifyEngineEvidence({
      now: new Date("2026-06-15T00:00:00.000Z"),
      cvc5Command: "cvc5-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(assert false)\n(check-sat)\n",
      requirements: { cvc5: true },
      runner
    });

    expect(report.status).toBe("passed");
    expect(report.requiredPassed).toBe(1);
    expect(report.requiredTotal).toBe(1);
    expect(report.evidenceMinted).toBe(1);
    expect(report.trustBoundary.smtCheckedRequiresConcreteSolverSatOrUnsat).toBe(true);
    expect(report.cases).toContainEqual(
      expect.objectContaining({
        id: "cvc5-smt-check",
        required: true,
        status: "passed",
        trust: "smt-checked",
        evidenceMinted: true,
        evidence: expect.objectContaining({ backendId: "cvc5", backendVersion: "cvc5 version 1.1.2", trust: "smt-checked" })
      })
    );
  });

  it("summarizes the strict all-engine reviewer level only when every concrete gate earns evidence", async () => {
    const runner: EngineVerificationCommandRunner = (command, args) => {
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
        return { status: 0, stdout: "sat\n(model\n  (define-fun x () Int\n    1)\n)\n", stderr: "" };
      }
      if (command === "cvc5-test" && args[0] === "--version") {
        return { status: 0, stdout: "This is cvc5 version 1.1.2 compiled with GCC.", stderr: "" };
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
        return { status: 0, stdout: "SageMath version 10.6, Release Date: 2025-03-31\n", stderr: "" };
      }
      if (command === "sage-test") {
        return { status: 0, stdout: "TRUTH_HARNESS_SAGE_STATUS:passed:0\n", stderr: "" };
      }

      return {
        status: null,
        stdout: "",
        stderr: "",
        error: { name: "Error", message: `missing ${command} ${args.join(" ")}` }
      };
    };

    const report = await verifyEngineEvidence({
      now: new Date("2026-06-15T00:00:00.000Z"),
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      cvc5Command: "cvc5-test",
      leanCommand: "lean-test",
      sageCommand: "sage-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      requirements: { maxima: true, z3: true, cvc5: true, lean: true, sage: true },
      runner
    });

    expect(report.status).toBe("passed");
    expect(report.requiredPassed).toBe(5);
    expect(report.evidenceMinted).toBe(5);
    expect(report.levels.find((level) => level.levelId === "engine-level-5-strict-all-engines")).toMatchObject({
      status: "passed",
      passedCases: 5,
      totalCases: 5,
      evidenceMinted: 5
    });
  });

  it("fails closed when required concrete engines cannot earn evidence", async () => {
    const runner: EngineVerificationCommandRunner = () => ({
      status: null,
      stdout: "",
      stderr: "",
      error: { name: "Error", message: "spawn ENOENT" }
    });

    const report = await verifyEngineEvidence({
      now: new Date("2026-06-15T00:00:00.000Z"),
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      requirements: { maxima: true, z3: true },
      runner
    });

    expect(report.status).toBe("failed");
    expect(report.requiredPassed).toBe(0);
    expect(report.requiredTotal).toBe(2);
    expect(report.evidenceMinted).toBe(0);
    expect(report.cases.find((entry) => entry.id === "maxima-symbolic-cross-check")).toMatchObject({
      required: true,
      status: "missing",
      trust: "unverified",
      evidenceMinted: false
    });
    expect(report.cases.find((entry) => entry.id === "z3-smt-check")).toMatchObject({
      required: true,
      status: "missing",
      trust: "unverified",
      evidenceMinted: false
    });
    expect(report.warnings).toContain("Required engine gate failed: Maxima symbolic cross-check (missing).");
    expect(report.warnings).toContain("Required engine gate failed: Z3 SMT-LIB check (missing).");
  });

  it("writes, parses, and lists durable local engine evidence runs", async () => {
    const root = await mkdtemp(join(tmpdir(), "truth-harness-engine-run-"));
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });
    const runner: EngineVerificationCommandRunner = (command, args) => {
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
      return { status: null, stdout: "", stderr: "", error: { name: "Error", message: "missing" } };
    };

    const result = await writeEngineVerificationRun({
      rootPath: root,
      now: new Date("2026-06-15T00:00:00.000Z"),
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      leanCommand: "lean-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      requirements: { maxima: true, z3: true, lean: true },
      replayCommand: "truth-harness engines verify --write --require-all-concrete",
      runner
    });

    const parsed = parseEngineVerificationRunJson(await readFile(result.jsonPath, "utf8"), result.jsonPath);
    expect(parsed.schemaVersion).toBe("truth-harness.engine-run.v0");
    expect(parsed.runId).toBe(result.record.runId);
    expect(parsed.status).toBe("passed");
    expect(parsed.report.evidenceMinted).toBe(3);
    expect(parsed.report.levels.find((level) => level.levelId === "engine-level-3-formal-proof-fixture")).toMatchObject({
      status: "passed",
      passedCases: 3,
      totalCases: 3
    });
    expect(parsed.replay).toBe("truth-harness engines verify --write --require-all-concrete");
    expect(parsed.artifacts.json).toContain(".truth-harness/engine-runs/");
    expect(result.markdown).toContain("## Evidence Ladder");
    expect(result.markdown).toContain("## Engine Readiness Levels");
    expect(result.markdown).toContain("| Formal proof fixture | passed | 3/3 | Core CAS/SMT evidence plus a Lean-accepted proof fixture are present. |");
    expect(result.markdown).toContain("| Maxima symbolic cross-check | required | earned evidence | Concrete `cross-checked` evidence earned");
    expect(result.markdown).toContain("| cvc5 SMT-LIB check | optional | missing evidence | Optional evidence is missing;");
    expect(result.markdown).toContain("- Reviewer meaning: Concrete `proved` evidence earned");
    expect(result.markdown).toContain("Engine Gates");

    const runs = await listEngineVerificationRuns(root);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      runId: result.record.runId,
      status: "passed",
      concretePassed: 3,
      evidenceMinted: 3,
      tags: expect.arrayContaining(["engine-level-1-core-cas-smt", "engine-level-3-formal-proof-fixture"])
    });
  });

  it("validates durable engine-run JSON before writing sidecars", async () => {
    const root = await mkdtemp(join(tmpdir(), "truth-harness-engine-run-invalid-"));
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });
    const runner: EngineVerificationCommandRunner = () => ({
      status: null,
      stdout: "",
      stderr: "",
      error: { name: "Error", message: "missing" }
    });

    await expect(
      writeEngineVerificationRun({
        rootPath: root,
        now: new Date("2026-06-15T00:00:00.000Z"),
        replayCommand: "",
        runner
      })
    ).rejects.toThrow("$.replay must have length >= 1");

    await expect(listEngineVerificationRuns(root)).resolves.toEqual([]);
  });
});

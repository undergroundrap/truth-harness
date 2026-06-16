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
    expect(parsed.replay).toBe("truth-harness engines verify --write --require-all-concrete");
    expect(parsed.artifacts.json).toContain(".truth-harness/engine-runs/");
    expect(result.markdown).toContain("Engine Gates");

    const runs = await listEngineVerificationRuns(root);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      runId: result.record.runId,
      status: "passed",
      concretePassed: 3,
      evidenceMinted: 3
    });
  });
});

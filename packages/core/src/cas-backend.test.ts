import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkSymbolicWithMaximaSync,
  getCasBackendStatus,
  listSymbolicCasChecks,
  writeSymbolicCasCheckRecord,
  type CasBackendCommandRunner
} from "./cas-backend.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("CAS backend status", () => {
  it("reports an available local Maxima CAS without minting a check", () => {
    const calls: Array<{ command: string; args: string[]; timeoutMs: number }> = [];
    const runner: CasBackendCommandRunner = (command, args, timeoutMs) => {
      calls.push({ command, args, timeoutMs });
      if (command === "sage-missing-test") {
        return {
          status: null,
          stdout: "",
          stderr: "",
          error: {
            name: "Error",
            message: "spawn sage ENOENT"
          }
        };
      }

      return {
        status: 0,
        stdout: "Maxima 5.47.0\n",
        stderr: ""
      };
    };

    const report = getCasBackendStatus({
      maximaCommand: "maxima-test",
      sageCommand: "sage-missing-test",
      now: new Date("2026-06-12T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([
      { command: "maxima-test", args: ["--version"], timeoutMs: 3000 },
      { command: "sage-missing-test", args: ["--version"], timeoutMs: 3000 }
    ]);
    expect(report.schemaVersion).toBe("truth-harness.cas-backends.v0");
    expect(report.localOnly).toBe(true);
    expect(report.networkAccess).toBe("none");
    expect(report.casBackendsAvailable).toBe(1);
    expect(report.trustBoundary.statusProbeIsNotCheck).toBe(true);
    expect(report.trustBoundary.crossCheckedRequiresIndependentRun).toBe(true);
    expect(report.backends[0]).toMatchObject({
      backendId: "maxima",
      adapter: "local-maxima-symbolic-subprocess",
      role: "cas",
      acceptedProofChecker: false,
      status: "available",
      canCheckSymbolic: true,
      statusProbeMintedCheck: false,
      version: "Maxima 5.47.0"
    });
    expect(report.backends[1]).toMatchObject({
      backendId: "sage",
      adapter: "local-sagemath-status-probe",
      status: "missing",
      canCheckSymbolic: false,
      statusProbeMintedCheck: false
    });
  });

  it("reports SageMath availability as status-only until constrained checks exist", () => {
    const runner: CasBackendCommandRunner = (command) => {
      if (command === "sage-test") {
        return {
          status: 0,
          stdout: "SageMath version 10.6, Release Date: 2025-03-31\n",
          stderr: ""
        };
      }

      return {
        status: null,
        stdout: "",
        stderr: "",
        error: {
          name: "Error",
          message: "spawn maxima ENOENT"
        }
      };
    };

    const report = getCasBackendStatus({
      maximaCommand: "maxima-missing-test",
      sageCommand: "sage-test",
      now: new Date("2026-06-12T00:00:00.000Z"),
      runner
    });

    expect(report.casBackendsAvailable).toBe(1);
    expect(report.backends[1]).toMatchObject({
      backendId: "sage",
      displayName: "SageMath CAS",
      status: "available",
      version: "SageMath version 10.6, Release Date: 2025-03-31",
      canCheckSymbolic: false,
      statusProbeMintedCheck: false
    });
    expect(report.warnings.join(" ")).toContain("status-only and cannot mint trust");
  });

  it("skips Lisp loader chatter when reporting Maxima-Sage availability", () => {
    const runner: CasBackendCommandRunner = () => ({
      status: 0,
      stdout: [
        ';;; Loading #P"/usr/lib/x86_64-linux-gnu/ecl-21.2.1/sockets.fas"',
        "Maxima 5.45.1"
      ].join("\n"),
      stderr: ""
    });

    const report = getCasBackendStatus({
      maximaCommand: "maxima-sage",
      sageCommand: "sage-missing-test",
      now: new Date("2026-06-12T00:00:00.000Z"),
      runner
    });

    expect(report.backends[0]).toMatchObject({
      backendId: "maxima",
      status: "available",
      version: "Maxima 5.45.1"
    });
  });

  it("keeps cross-checked unavailable when Maxima is missing", () => {
    const runner: CasBackendCommandRunner = () => ({
      status: null,
      stdout: "",
      stderr: "",
      error: {
        name: "Error",
        message: "spawn maxima ENOENT"
      }
    });

    const report = getCasBackendStatus({ runner });

    expect(report.casBackendsAvailable).toBe(0);
    expect(report.backends[0]).toMatchObject({
      backendId: "maxima",
      status: "missing",
      canCheckSymbolic: false,
      statusProbeMintedCheck: false
    });
    expect(report.warnings.join(" ")).toContain("must not label symbolic results `cross-checked`");
  });

  it("explains signal-based Maxima probe failures", () => {
    const runner: CasBackendCommandRunner = () => ({
      status: null,
      signal: "SIGKILL",
      stdout: "",
      stderr: ""
    });

    const report = getCasBackendStatus({ runner });

    expect(report.backends[0]).toMatchObject({
      backendId: "maxima",
      status: "error",
      error: "Maxima exited by signal SIGKILL.",
      canCheckSymbolic: false
    });
  });
});

describe("Maxima symbolic cross-check", () => {
  it("mints cross-checked only after a concrete independent CAS agreement", () => {
    const calls: string[][] = [];
    const runner: CasBackendCommandRunner = (_command, args) => {
      calls.push(args);
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Maxima 5.47.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n",
        stderr: ""
      };
    };

    const record = checkSymbolicWithMaximaSync({
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      result: "1",
      maximaCommand: "maxima-test",
      now: new Date("2026-06-12T00:00:00.000Z"),
      runner
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(["--version"]);
    expect(calls[1]?.slice(0, 2)).toEqual(["--very-quiet", "--batch-string"]);
    expect(calls[1]?.[2]).toContain("fullratsimp(trigsimp");
    expect(calls[1]?.[2]).toContain("sin(x)^2 + cos(x)^2");
    expect(record.schemaVersion).toBe("truth-harness.symbolic-cas-check.v0");
    expect(record.status).toBe("passed");
    expect(record.trust).toBe("cross-checked");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.residual).toBe("0");
    expect(record.limitations.join(" ")).toContain("not a proof-checker-backed proof");
  });

  it("ignores echoed Maxima input lines before parsing the real marker", () => {
    const runner: CasBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: [
            ';;; Loading #P"/usr/lib/x86_64-linux-gnu/ecl-21.2.1/sockets.fas"',
            "Maxima 5.45.1"
          ].join("\n"),
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: [
          'printf(true,"TRUTH_HARNESS_MAXIMA_STATUS:~a:~a~%",status,residual)',
          "TRUTH_HARNESS_MAXIMA_STATUS:passed:0"
        ].join("\n"),
        stderr: ""
      };
    };

    const record = checkSymbolicWithMaximaSync({
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      result: "1",
      maximaCommand: "maxima-sage",
      now: new Date("2026-06-12T00:00:00.000Z"),
      runner
    });

    expect(record.status).toBe("passed");
    expect(record.trust).toBe("cross-checked");
    expect(record.backend.version).toBe("Maxima 5.45.1");
  });

  it("writes, lists, and validates first-class CAS check records", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });
    const runner: CasBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Maxima 5.47.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n",
        stderr: ""
      };
    };

    const result = await writeSymbolicCasCheckRecord({
      rootPath: root,
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      result: "1",
      maximaCommand: "maxima-test",
      now: new Date("2026-06-12T00:05:00.000Z"),
      runner
    });
    const list = await listSymbolicCasChecks(root);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(result.record.schemaVersion).toBe("truth-harness.cas-check.v0");
    expect(result.record.trust).toBe("cross-checked");
    expect(result.record.replay).toContain("truth-harness cas check");
    expect(result.record.replay).toContain("--write");
    expect(result.jsonPath).toContain(join(".truth-harness", "cas"));
    expect(result.markdown).toContain(`# CAS Check ${result.record.checkId}`);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      checkId: result.record.checkId,
      status: "passed",
      trust: "cross-checked"
    });
    expect(list[0]?.path).toContain(".truth-harness/cas/2026-06-12-cas_");
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.cas).toBe(1);
  });

  it("fails closed when independent CAS disagrees", () => {
    const runner: CasBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Maxima 5.47.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "TRUTH_HARNESS_MAXIMA_STATUS:failed:x\n",
        stderr: ""
      };
    };

    const record = checkSymbolicWithMaximaSync({
      prompt: {
        operation: "expand",
        expression: "(x + 1)^2",
        variable: "x"
      },
      result: "x^2 + 1",
      runner
    });

    expect(record.status).toBe("failed");
    expect(record.trust).toBe("unverified");
    expect(record.warnings.join(" ")).toContain("Independent CAS disagreement");
  });

  it("does not send unsafe expressions to Maxima", () => {
    const calls: string[][] = [];
    const runner: CasBackendCommandRunner = (_command, args) => {
      calls.push(args);
      return {
        status: 0,
        stdout: "Maxima 5.47.0\n",
        stderr: ""
      };
    };

    const record = checkSymbolicWithMaximaSync({
      prompt: {
        operation: "simplify",
        expression: "__import__(os)",
        variable: "x"
      },
      result: "0",
      runner
    });

    expect(calls).toEqual([["--version"]]);
    expect(record.status).toBe("error");
    expect(record.trust).toBe("unverified");
    expect(record.error).toContain("outside the supported Maxima-safe subset");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-cas-"));
  roots.push(root);
  return root;
}

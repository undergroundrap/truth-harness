import { describe, expect, it } from "vitest";
import {
  checkSymbolicWithMaximaSync,
  getCasBackendStatus,
  type CasBackendCommandRunner
} from "./cas-backend.js";

describe("CAS backend status", () => {
  it("reports an available local Maxima CAS without minting a check", () => {
    const calls: Array<{ command: string; args: string[]; timeoutMs: number }> = [];
    const runner: CasBackendCommandRunner = (command, args, timeoutMs) => {
      calls.push({ command, args, timeoutMs });
      return {
        status: 0,
        stdout: "Maxima 5.47.0\n",
        stderr: ""
      };
    };

    const report = getCasBackendStatus({
      maximaCommand: "maxima-test",
      now: new Date("2026-06-12T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([{ command: "maxima-test", args: ["--version"], timeoutMs: 3000 }]);
    expect(report.schemaVersion).toBe("theorem.cas-backends.v0");
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
        stdout: "THEOREM_MAXIMA_STATUS:passed:0\n",
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
    expect(calls[1]?.[2]).toContain("fullratsimp");
    expect(calls[1]?.[2]).toContain("sin(x)^2 + cos(x)^2");
    expect(record.schemaVersion).toBe("theorem.symbolic-cas-check.v0");
    expect(record.status).toBe("passed");
    expect(record.trust).toBe("cross-checked");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.residual).toBe("0");
    expect(record.limitations.join(" ")).toContain("not a proof-checker-backed proof");
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
        stdout: "THEOREM_MAXIMA_STATUS:failed:x\n",
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

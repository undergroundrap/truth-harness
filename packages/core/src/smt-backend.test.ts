import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { validateJsonSchema } from "./json-schema-validation.js";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  checkSmtLibArtifact,
  getSmtBackendStatus,
  listSmtChecks,
  parseSmtModel,
  writeSmtCheckRecord,
  type SmtBackendCommandRunner
} from "./smt-backend.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const schemasDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("SMT backend status", () => {
  it("reports an available local Z3 solver without minting a check", () => {
    const calls: Array<{ command: string; args: string[]; timeoutMs: number }> = [];
    const runner: SmtBackendCommandRunner = (command, args, timeoutMs) => {
      calls.push({ command, args, timeoutMs });
      return {
        status: 0,
        stdout: "Z3 version 4.13.0 - 64 bit\n",
        stderr: ""
      };
    };

    const report = getSmtBackendStatus({
      z3Command: "z3-test",
      now: new Date("2026-06-10T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([{ command: "z3-test", args: ["-version"], timeoutMs: 3000 }]);
    expect(report.schemaVersion).toBe("theorem.smt-backends.v0");
    expect(report.localOnly).toBe(true);
    expect(report.networkAccess).toBe("none");
    expect(report.smtSolversAvailable).toBe(1);
    expect(report.trustBoundary.statusProbeIsNotCheck).toBe(true);
    expect(report.trustBoundary.smtCheckedIsNotProofCheckerProof).toBe(true);
    expect(report.backends[0]).toMatchObject({
      backendId: "z3",
      adapter: "local-z3-smtlib-subprocess",
      role: "checker",
      acceptedProofChecker: false,
      status: "available",
      canCheckSmt: true,
      statusProbeMintedCheck: false,
      version: "Z3 version 4.13.0 - 64 bit"
    });
  });

  it("keeps smt-checked unavailable when Z3 is missing", () => {
    const runner: SmtBackendCommandRunner = () => ({
      status: null,
      stdout: "",
      stderr: "",
      error: {
        name: "Error",
        message: "spawn z3 ENOENT"
      }
    });

    const report = getSmtBackendStatus({ runner });

    expect(report.smtSolversAvailable).toBe(0);
    expect(report.backends[0]).toMatchObject({
      backendId: "z3",
      status: "missing",
      canCheckSmt: false,
      statusProbeMintedCheck: false
    });
    expect(report.warnings.join(" ")).toContain("must not label results `smt-checked`");
  });

  it("labels SAT and UNSAT SMT-LIB checks as smt-checked, not proved", () => {
    const calls: string[][] = [];
    const runner: SmtBackendCommandRunner = (_command, args) => {
      calls.push(args);
      if (args[0] === "-version") {
        return {
          status: 0,
          stdout: "Z3 version 4.13.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "unsat\n",
        stderr: ""
      };
    };

    const record = checkSmtLibArtifact({
      sourcePath: "constraints/nonnegative.smt2",
      sourceText: "(set-logic QF_LIA)\n(assert false)\n(check-sat)\n",
      queryName: "inconsistent_constraints",
      now: new Date("2026-06-10T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([["-version"], ["-smt2", "constraints/nonnegative.smt2"]]);
    expect(record.schemaVersion).toBe("theorem.smt-check.v0");
    expect(record.checkId).toMatch(/^smt_[a-f0-9]{16}$/);
    expect(record.status).toBe("unsat");
    expect(record.trust).toBe("smt-checked");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.backend.acceptedProofChecker).toBe(false);
    expect(record.backend.version).toBe("Z3 version 4.13.0");
    expect(record.source.queryName).toBe("inconsistent_constraints");
    expect(record.limitations.join(" ")).toContain("not a proof-checker-backed proof");
  });

  it("keeps unknown SMT results unverified", () => {
    const runner: SmtBackendCommandRunner = (_command, args) => {
      if (args[0] === "-version") {
        return {
          status: 0,
          stdout: "Z3 version 4.13.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "unknown\n",
        stderr: ""
      };
    };

    const record = checkSmtLibArtifact({
      sourcePath: "constraints/unknown.smt2",
      sourceText: "(set-logic ALL)\n(check-sat)\n",
      runner
    });

    expect(record.status).toBe("unknown");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.warnings.join(" ")).toContain("unknown or unrecognized");
  });

  it("parses Z3 define-fun model bindings into structured values", () => {
    const model = parseSmtModel("sat\n(\n  (define-fun x () Int\n    1)\n  (define-fun y () Int\n    (- 2))\n)\n");

    expect(model).toEqual({
      format: "z3-define-fun",
      bindings: [
        {
          name: "x",
          sort: "Int",
          value: "1",
          raw: "(define-fun x () Int\n    1)"
        },
        {
          name: "y",
          sort: "Int",
          value: "(- 2)",
          raw: "(define-fun y () Int\n    (- 2))"
        }
      ],
      warnings: []
    });
  });

  it("does not run an SMT check when the solver is unavailable", () => {
    const calls: string[][] = [];
    const runner: SmtBackendCommandRunner = (_command, args) => {
      calls.push(args);
      return {
        status: null,
        stdout: "",
        stderr: "",
        error: {
          name: "Error",
          message: "spawn z3 ENOENT"
        }
      };
    };

    const record = checkSmtLibArtifact({
      sourcePath: "constraints/missing.smt2",
      sourceText: "(check-sat)\n",
      runner
    });

    expect(calls).toEqual([["-version"]]);
    expect(record.status).toBe("solver-unavailable");
    expect(record.trust).toBe("unverified");
    expect(record.error).toContain("ENOENT");
  });

  it("emits SMT check records that match the checked-in schema", async () => {
    const runner: SmtBackendCommandRunner = (_command, args) => {
      if (args[0] === "-version") {
        return {
          status: 0,
          stdout: "Z3 version 4.13.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "sat\n",
        stderr: ""
      };
    };
    const record = checkSmtLibArtifact({
      sourcePath: "constraints/schema.smt2",
      sourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      runner
    });
    const schema = JSON.parse(await readFile(resolve(schemasDir, "smt-check.schema.json"), "utf8")) as unknown;

    expect(validateJsonSchema(record, schema)).toEqual([]);
  });

  it("writes, lists, and validates SMT check records in the local workspace", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "SMT Lab" });
    await writeFile(
      join(root, "constraints.smt2"),
      "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n(get-model)\n",
      "utf8"
    );
    const runner: SmtBackendCommandRunner = (_command, args) => {
      if (args[0] === "-version") {
        return {
          status: 0,
          stdout: "Z3 version 4.13.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "sat\n(\n  (define-fun x () Int\n    1)\n)\n",
        stderr: ""
      };
    };

    const write = await writeSmtCheckRecord({
      rootPath: root,
      sourcePath: "constraints.smt2",
      queryName: "positive_integer_model",
      runner
    });
    const list = await listSmtChecks(root);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(write.record.trust).toBe("smt-checked");
    expect(write.record.status).toBe("sat");
    expect(write.record.model).toMatchObject({
      format: "z3-define-fun",
      bindings: [
        {
          name: "x",
          sort: "Int",
          value: "1"
        }
      ]
    });
    expect(write.jsonPath).toContain(".theorem-workbench");
    expect(write.markdownPath).toContain(".theorem-workbench");
    expect(write.markdown).toContain("SMT Check");
    expect(write.markdown).toContain("x: Int = 1");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      checkId: write.record.checkId,
      sourcePath: "constraints.smt2",
      queryName: "positive_integer_model",
      trust: "smt-checked",
      proofCheckerBacked: false
    });
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.smt).toBe(1);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-smt-"));
  tempRoots.push(root);
  return root;
}

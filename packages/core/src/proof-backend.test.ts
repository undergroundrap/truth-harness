import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  checkLeanProofArtifact,
  getProofBackendStatus,
  listLeanProofChecks,
  readLeanProofCheckRecord,
  writeLeanProofCheckRecord,
  writeLeanProofCheckVisualArtifact,
  type ProofBackendCommandRunner
} from "./proof-backend.js";
import { readVisualArtifact } from "./visual-artifact.js";
import { validateJsonSchema } from "./json-schema-validation.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const schemasDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("proof backend status", () => {
  it.skipIf(process.platform === "win32")("checks proof entry containment before listing or direct lookup", async () => {
    const root = await tempRoot();
    const otherRoot = await tempRoot();
    await initLocalWorkspace(root);
    const other = join(otherRoot, "outside.json");
    await writeFile(other, "{}", "utf8");
    const ref = ".truth-harness/proofs/linked.json";
    await symlink(other, join(root, ref));
    await expect(listLeanProofChecks(root)).rejects.toThrow("Path escapes workspace root");
    await expect(readLeanProofCheckRecord(root, ref)).rejects.toThrow("Path escapes workspace root");
  });
  it("reports runnable Lean but no trusted independent proof checker", () => {
    const calls: Array<{ command: string; args: string[]; timeoutMs: number }> = [];
    const runner: ProofBackendCommandRunner = (command, args, timeoutMs) => {
      calls.push({ command, args, timeoutMs });
      return {
        status: 0,
        stdout: "Lean (version 4.12.0, x86_64-unknown-linux-gnu)\n",
        stderr: ""
      };
    };

    const report = getProofBackendStatus({
      leanCommand: "lean-test",
      now: new Date("2026-06-10T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([{ command: "lean-test", args: ["--version"], timeoutMs: 3000 }]);
    expect(report.schemaVersion).toBe("truth-harness.proof-backends.v0");
    expect(report.localOnly).toBe(true);
    expect(report.networkAccess).toBe("none");
    expect(report.proofCheckersAvailable).toBe(0);
    expect(report.trustBoundary.statusProbeIsNotProof).toBe(true);
    expect(report.trustBoundary.provedRequiresSuccessfulProofRun).toBe(true);
    expect(report.backends[0]).toMatchObject({
      backendId: "lean",
      adapter: "local-lean-subprocess",
      role: "proof-checker",
      acceptedProofChecker: true,
      status: "available",
      canCheckProofs: false,
      statusProbeMintedProof: false,
      version: "Lean (version 4.12.0, x86_64-unknown-linux-gnu)"
    });
    expect(report.backends[0]?.limitations.join(" ")).toContain("trusted independent kernel check and transitive axiom audit is missing");
    expect(report.warnings.join(" ")).toContain("does not prove any claim");
  });

  it("rejects a successful executable that does not identify itself as Lean", () => {
    const runner: ProofBackendCommandRunner = () => ({
      status: 0,
      stdout: "v22.17.0\n",
      stderr: ""
    });

    const report = getProofBackendStatus({ leanCommand: "node", runner });

    expect(report.proofCheckersAvailable).toBe(0);
    expect(report.backends[0]).toMatchObject({
      backendId: "lean",
      status: "error",
      canCheckProofs: false,
      statusProbeMintedProof: false,
      error: "Backend version output did not identify a Lean proof checker."
    });
    expect(report.backends[0]?.limitations.join(" ")).toContain("non-Lean executable");
  });

  it("keeps proved unavailable when Lean is missing", () => {
    const runner: ProofBackendCommandRunner = () => ({
      status: null,
      stdout: "",
      stderr: "",
      error: {
        name: "Error",
        message: "spawn lean ENOENT"
      }
    });

    const report = getProofBackendStatus({ runner });

    expect(report.proofCheckersAvailable).toBe(0);
    expect(report.backends[0]).toMatchObject({
      backendId: "lean",
      status: "missing",
      canCheckProofs: false,
      statusProbeMintedProof: false
    });
    expect(report.backends[0]?.limitations.join(" ")).toContain("not found");
    expect(report.warnings.join(" ")).toContain("must not label results `proved`");
  });

  it("treats failed Lean probes as unavailable for proved trust", () => {
    const runner: ProofBackendCommandRunner = () => ({
      status: 2,
      stdout: "",
      stderr: "bad option"
    });

    const report = getProofBackendStatus({ runner });

    expect(report.proofCheckersAvailable).toBe(0);
    expect(report.backends[0]).toMatchObject({
      backendId: "lean",
      status: "error",
      exitCode: 2,
      canCheckProofs: false,
      statusProbeMintedProof: false
    });
    expect(report.backends[0]?.limitations.join(" ")).toContain("cannot support `proved`");
  });

  it("records exit-zero compilation of exact hashed stdin without minting proved", () => {
    const calls: Array<{ command: string; args: string[]; timeoutMs: number; input?: string }> = [];
    const runner: ProofBackendCommandRunner = (command, args, timeoutMs, options) => {
      calls.push({ command, args, timeoutMs, input: options?.input });
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: ""
      };
    };

    const sourceText = "theorem one_plus_one : 1 + 1 = 2 := by rfl\n";
    const record = checkLeanProofArtifact({
      sourcePath: "proofs/parity.lean",
      sourceText,
      declarationName: "one_plus_one",
      now: new Date("2026-06-10T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([
      { command: "lean", args: ["--version"], timeoutMs: 3000, input: undefined },
      { command: "lean", args: ["--stdin"], timeoutMs: 3000, input: sourceText }
    ]);
    expect(record.schemaVersion).toBe("truth-harness.proof-check.v0");
    expect(record.checkId).toMatch(/^proof_[a-f0-9]{16}$/);
    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.backend.exitCode).toBe(0);
    expect(record.backend.acceptedProofChecker).toBe(true);
    expect(record.backend.version).toBe("Lean (version 4.12.0)");
    expect(record.source.sha256).toBe(createHash("sha256").update(sourceText).digest("hex"));
    expect(record.source.byteLength).toBe(Buffer.byteLength(sourceText, "utf8"));
    expect(record.source.declarationName).toBe("one_plus_one");
    expect(record.source.declaration).toMatchObject({
      declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
      kind: "theorem",
      name: "one_plus_one",
      path: "proofs/parity.lean",
      line: 1,
      column: 1,
      signature: "theorem one_plus_one : 1 + 1 = 2",
      signatureSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      sourceSha256: record.source.sha256
    });
    expect(record.limitations.join(" ")).toContain("trusted independent kernel check and transitive axiom audit is missing");
    expect(record.limitations.join(" ")).toContain("does not refute");
  });

  it("checks Lean artifacts through a Lake project environment when a project root is supplied", () => {
    const calls: Array<{ command: string; args: string[]; timeoutMs: number; cwd?: string; input?: string }> = [];
    const runner: ProofBackendCommandRunner = (command, args, timeoutMs, options) => {
      calls.push({ command, args, timeoutMs, cwd: options?.cwd, input: options?.input });
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: ""
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath: "C:/workspace/MathlibProofs/Algebra.lean",
      sourceRef: "MathlibProofs/Algebra.lean",
      sourceText: "theorem add_comm_fixture (a b : Nat) : a + b = b + a := by exact Nat.add_comm a b\n",
      declarationName: "add_comm_fixture",
      projectRoot: "C:/workspace",
      leanCommand: "lean-test",
      lakeCommand: "lake-test",
      now: new Date("2026-06-10T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([
      { command: "lean-test", args: ["--version"], timeoutMs: 3000, cwd: undefined, input: undefined },
      {
        command: "lake-test",
        args: ["env", "lean-test", "--stdin"],
        timeoutMs: 3000,
        cwd: "C:/workspace",
        input: "theorem add_comm_fixture (a b : Nat) : a + b = b + a := by exact Nat.add_comm a b\n"
      }
    ]);
    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.backend).toMatchObject({
      command: "lake-test",
      args: ["env", "lean-test", "--stdin"]
    });
    expect(record.replay).toBe(
      "truth-harness proof check MathlibProofs/Algebra.lean --json --project C:/workspace --lean-command lean-test --lake-command lake-test"
    );
    expect(record.warnings.join(" ")).toContain("Lake project environment");
  });

  it("does not run Lake or mint proved when an external dependency manifest is missing", async () => {
    const root = await tempRoot();
    const projectRoot = join(root, "MathlibProject");
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, "lakefile.lean"),
      [
        "import Lake",
        "open Lake DSL",
        "package mathlib_boundary where",
        "require mathlib from git \"https://github.com/leanprover-community/mathlib4.git\" @ \"v4.12.0\""
      ].join("\n"),
      "utf8"
    );

    const calls: Array<{ command: string; args: string[]; timeoutMs: number; cwd?: string }> = [];
    const runner: ProofBackendCommandRunner = (command, args, timeoutMs, options) => {
      calls.push({ command, args, timeoutMs, cwd: options?.cwd });
      return {
        status: 0,
        stdout: args[0] === "--version" ? "Lean (version 4.12.0)\n" : "",
        stderr: ""
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath: join(projectRoot, "TruthHarnessMathlib/Algebra.lean"),
      sourceRef: "TruthHarnessMathlib/Algebra.lean",
      sourceText: "theorem add_comm_fixture (a b : Nat) : a + b = b + a := by exact Nat.add_comm a b\n",
      declarationName: "add_comm_fixture",
      projectRoot,
      leanCommand: "lean-test",
      lakeCommand: "lake-test",
      now: new Date("2026-06-10T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([{ command: "lean-test", args: ["--version"], timeoutMs: 3000, cwd: undefined }]);
    expect(record.status).toBe("error");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.backend.command).toBe("lake-test");
    expect(record.warnings.join(" ")).toContain("has no lake-manifest.json");
    expect(record.warnings.join(" ")).toContain("did not run the Lake proof check");
    expect(record.limitations.join(" ")).toContain("not pinned by lake-manifest.json");
  });

  it("does not run Lake or mint proved when the dependency manifest is malformed", async () => {
    const root = await tempRoot();
    const projectRoot = join(root, "MalformedManifestProject");
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, "lakefile.lean"),
      [
        "import Lake",
        "open Lake DSL",
        "package malformed_manifest_boundary where",
        "require mathlib from git \"https://github.com/leanprover-community/mathlib4.git\" @ \"v4.12.0\""
      ].join("\n"),
      "utf8"
    );
    await writeFile(join(projectRoot, "lake-manifest.json"), "not json\n", "utf8");

    const calls: Array<{ command: string; args: string[]; timeoutMs: number; cwd?: string }> = [];
    const runner: ProofBackendCommandRunner = (command, args, timeoutMs, options) => {
      calls.push({ command, args, timeoutMs, cwd: options?.cwd });
      return {
        status: 0,
        stdout: args[0] === "--version" ? "Lean (version 4.12.0)\n" : "",
        stderr: ""
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath: join(projectRoot, "TruthHarnessMathlib/Algebra.lean"),
      sourceRef: "TruthHarnessMathlib/Algebra.lean",
      sourceText: "theorem add_comm_fixture (a b : Nat) : a + b = b + a := by exact Nat.add_comm a b\n",
      declarationName: "add_comm_fixture",
      projectRoot,
      leanCommand: "lean-test",
      lakeCommand: "lake-test",
      now: new Date("2026-06-10T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([{ command: "lean-test", args: ["--version"], timeoutMs: 3000, cwd: undefined }]);
    expect(record.status).toBe("error");
    expect(record.trust).toBe("unverified");
    expect(record.warnings.join(" ")).toContain("Could not parse Lake dependency manifest");
    expect(record.limitations.join(" ")).toContain("not readable JSON");
  });

  it("allows external Lake proof checks when the dependency manifest is present", async () => {
    const root = await tempRoot();
    const projectRoot = join(root, "PinnedMathlibProject");
    const sourcePath = join(projectRoot, "TruthHarnessMathlib/Algebra.lean");
    await mkdir(join(projectRoot, "TruthHarnessMathlib"), { recursive: true });
    await writeFile(
      join(projectRoot, "lakefile.lean"),
      [
        "import Lake",
        "open Lake DSL",
        "package pinned_mathlib_boundary where",
        "require mathlib from git \"https://github.com/leanprover-community/mathlib4.git\" @ \"v4.12.0\""
      ].join("\n"),
      "utf8"
    );
    await writeFile(join(projectRoot, "lake-manifest.json"), "{\"version\": 7, \"packages\": []}\n", "utf8");

    const calls: Array<{ command: string; args: string[]; timeoutMs: number; cwd?: string }> = [];
    const runner: ProofBackendCommandRunner = (command, args, timeoutMs, options) => {
      calls.push({ command, args, timeoutMs, cwd: options?.cwd });
      return {
        status: 0,
        stdout: args[0] === "--version" ? "Lean (version 4.12.0)\n" : "",
        stderr: ""
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath,
      sourceRef: "TruthHarnessMathlib/Algebra.lean",
      sourceText: "theorem add_comm_fixture (a b : Nat) : a + b = b + a := by exact Nat.add_comm a b\n",
      declarationName: "add_comm_fixture",
      projectRoot,
      leanCommand: "lean-test",
      lakeCommand: "lake-test",
      now: new Date("2026-06-10T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([
      { command: "lean-test", args: ["--version"], timeoutMs: 3000, cwd: undefined },
      { command: "lake-test", args: ["env", "lean-test", "--stdin"], timeoutMs: 3000, cwd: projectRoot }
    ]);
    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.warnings.join(" ")).toContain("Lake dependency manifest detected");
  });

  it("keeps rejected Lean proof attempts unverified", () => {
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 1,
        stdout: "",
        stderr: "unsolved goals"
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath: "proofs/bad.lean",
      sourceText: "example : 1 + 1 = 3 := by sorry\n",
      runner
    });

    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.stderr).toBe("unsolved goals");
    expect(record.limitations.join(" ")).toContain("does not refute the claim");
  });

  it("does not mint proved for Lean-accepted sources with sorry placeholders", () => {
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: "declaration uses 'sorry'"
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath: "proofs/placeholder.lean",
      sourceText: "example : 1 + 1 = 3 := by sorry\n",
      runner
    });

    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.limitations.join(" ")).toContain("contains `sorry`");
    expect(record.warnings.join(" ")).toContain("Lean success is necessary but not sufficient");
  });

  it("does not mint proved for Lean-accepted sources with metavariable holes", () => {
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: ""
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath: "proofs/hole.lean",
      sourceText: "theorem hole : True := by\n  exact ?_\n",
      runner
    });

    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.limitations.join(" ")).toContain("metavariable hole");
  });

  it("does not mint proved for Lean-accepted sources with local axioms", () => {
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: ""
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath: "proofs/axiom.lean",
      sourceText: [
        "-- comments mentioning sorry should not matter",
        "axiom fake : False",
        "example : False := fake"
      ].join("\n"),
      runner
    });

    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.limitations.join(" ")).toContain("local `axiom`");
  });

  it("does not run a proof check when the accepted backend is unavailable", () => {
    const calls: string[][] = [];
    const runner: ProofBackendCommandRunner = (_command, args) => {
      calls.push(args);
      return {
        status: null,
        stdout: "",
        stderr: "",
        error: {
          name: "Error",
          message: "spawn lean ENOENT"
        }
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath: "proofs/missing.lean",
      sourceText: "example : True := by trivial\n",
      runner
    });

    expect(calls).toEqual([["--version"]]);
    expect(record.status).toBe("backend-unavailable");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.error).toContain("ENOENT");
    expect(record.warnings.join(" ")).toContain("Treat the claim as unverified");
  });

  it("emits proof-check records that match the checked-in schema", async () => {
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: ""
      };
    };
    const record = checkLeanProofArtifact({
      sourcePath: "proofs/schema.lean",
      sourceText: "example : True := by trivial\n",
      scope: {
        routeId: "route_0123456789abcdef",
        obligationId: "obl_0123456789abcdef",
        statementHash: "0123456789abcdef",
        statement: "example : True"
      },
      runner
    });
    const schema = JSON.parse(await readFile(resolve(schemasDir, "proof-check.schema.json"), "utf8")) as unknown;

    expect(record.scope).toMatchObject({
      routeId: "route_0123456789abcdef",
      obligationId: "obl_0123456789abcdef"
    });
    expect(record.source.declaration).toMatchObject({
      kind: "example",
      signature: "example : True",
      sourceSha256: record.source.sha256
    });
    expect(validateJsonSchema(record, schema)).toEqual([]);
  });

  it("writes, lists, and validates proof-check records in the local workspace", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Proof Check Lab" });
    await writeFile(join(root, "trivial.lean"), "theorem trivial_true : True := by trivial\n", "utf8");
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: ""
      };
    };

    const write = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "trivial.lean",
      declarationName: "trivial_true",
      scope: {
        routeId: "route_0123456789abcdef",
        obligationId: "obl_0123456789abcdef",
        statementHash: "0123456789abcdef",
        statement: "example : True"
      },
      runner
    });
    const list = await listLeanProofChecks(root);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(write.record.trust).toBe("unverified");
    expect(write.record.status).toBe("rejected");
    expect(write.jsonPath).toContain(".truth-harness");
    expect(write.markdownPath).toContain(".truth-harness");
    expect(write.markdown).toContain("Lean Proof Check");
    expect(write.markdown).toContain("Declaration id");
    expect(write.markdown).toContain("Declaration signature SHA-256");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      checkId: write.record.checkId,
      sourcePath: "trivial.lean",
      sourceSha256: write.record.source.sha256,
      sourceByteLength: write.record.source.byteLength,
      declarationName: "trivial_true",
      declaration: {
        declarationId: write.record.source.declaration?.declarationId,
        kind: "theorem",
        name: "trivial_true",
        signatureSha256: write.record.source.declaration?.signatureSha256,
        sourceSha256: write.record.source.sha256
      },
      scope: {
        routeId: "route_0123456789abcdef",
        obligationId: "obl_0123456789abcdef",
        statementHash: "0123456789abcdef",
        statement: "example : True"
      },
      trust: "unverified",
      proofCheckerBacked: false
    });
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.proofs).toBe(1);
  });

  it("fails closed when a requested Lean declaration name is not found in the checked source", () => {
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: ""
      };
    };

    const record = checkLeanProofArtifact({
      sourcePath: "proofs/mismatch.lean",
      sourceText: "theorem actual_name : True := by trivial\n",
      declarationName: "requested_name",
      runner
    });

    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.source.declarationName).toBe("requested_name");
    expect(record.source.declaration).toBeUndefined();
    expect(record.warnings.join(" ")).toContain("requested Lean declaration");
    expect(record.warnings.join(" ")).toContain("does not resolve or prove the requested declaration");
  });

  it.each([
    { name: "named theorem", source: "theorem target : True := by trivial\n", target: "target" },
    { name: "explicit sorryAx", source: "theorem target : False := sorryAx False true\n", target: "target" },
    { name: "imported false axiom", source: "import FalseAxiom\ntheorem target : False := importedFalse\n", target: "target" },
    { name: "whole-file named theorems", source: "theorem first : True := by trivial\ntheorem second : True := first\n" },
    { name: "anonymous-only file", source: "example : True := by trivial\n" }
  ])("never promotes generic exit-zero output for $name", ({ source, target }) => {
    const runner: ProofBackendCommandRunner = (_command, args) => ({
      status: 0,
      stdout: args[0] === "--version"
        ? "Lean (version 4.12.0)\n"
        : "TRUTH_HARNESS_AXIOM_AUDIT: {\"target\":\"target\",\"axioms\":[],\"accepted\":true}\n",
      stderr: args[0] === "--version" ? "" : "warning: audit accepted; no axioms found"
    });

    const record = checkLeanProofArtifact({
      sourcePath: "proofs/target.lean",
      sourceText: source,
      declarationName: target,
      runner
    });

    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.backend.exitCode).toBe(0);
    expect(record.limitations.join(" ")).toContain("trusted independent kernel check and transitive axiom audit is missing");
    expect(record.stdout).toContain("TRUTH_HARNESS_AXIOM_AUDIT");
    expect(record.stderr).toContain("warning: audit accepted");
  });

  it("does not treat a selected local def as a theorem proof", () => {
    const runner: ProofBackendCommandRunner = (_command, args) => ({
      status: 0,
      stdout: args[0] === "--version" ? "Lean (version 4.12.0)\n" : "",
      stderr: ""
    });

    const record = checkLeanProofArtifact({
      sourcePath: "proofs/definition.lean",
      sourceText: "def target : True := True.intro\n",
      declarationName: "target",
      runner
    });

    expect(record.source.declaration?.kind).toBe("def");
    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    expect(record.warnings.join(" ")).toContain("is a def, not a theorem target");
  });

  it("passes exact UTF-8 source including comments and line endings to the runner", () => {
    const sourceText = `-- a claimed audit is only source text\r\ntheorem target : True := by trivial\r\n#eval "${String.fromCodePoint(0x03bb)}"\r\n`;
    let checkedInput: string | undefined;
    const runner: ProofBackendCommandRunner = (_command, args, _timeoutMs, options) => {
      if (args[0] !== "--version") checkedInput = options?.input;
      return { status: 0, stdout: args[0] === "--version" ? "Lean (version 4.12.0)\n" : "", stderr: "" };
    };

    const record = checkLeanProofArtifact({ sourcePath: "not-read-from-disk.lean", sourceText, runner });

    expect(checkedInput).toBe(sourceText);
    expect(record.source.sha256).toBe(createHash("sha256").update(checkedInput!).digest("hex"));
    expect(record.source.byteLength).toBe(Buffer.byteLength(sourceText, "utf8"));
    expect(record.trust).toBe("unverified");
  });

  it("includes bounded diagnostics in listed proof-check summaries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Proof Repair Lab" });
    await writeFile(join(root, "bad.lean"), "theorem bad : True := by\n  exact False.elim\n", "utf8");
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 1,
        stdout: "",
        stderr: "type mismatch\n  has type False\n  but is expected to have type True\n"
      };
    };

    const write = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "bad.lean",
      declarationName: "bad",
      scope: {
        routeId: "route_0123456789abcdef",
        obligationId: "obl_0123456789abcdef",
        statement: "bad : True"
      },
      runner
    });
    const list = await listLeanProofChecks(root);

    expect(write.record.status).toBe("rejected");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      checkId: write.record.checkId,
      status: "rejected",
      diagnosticSnippet: "type mismatch has type False but is expected to have type True"
    });
  });

  it("rejects malformed proof-check records before writing artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Malformed Proof Check Lab" });
    await writeFile(join(root, "trivial.lean"), "theorem trivial_true : True := by trivial\n", "utf8");
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: ""
      };
    };

    await expect(
      writeLeanProofCheckRecord({
        rootPath: root,
        sourcePath: "trivial.lean",
        scope: {
          routeId: "not-a-route-id"
        },
        runner
      })
    ).rejects.toThrow("Proof-check record failed JSON Schema validation before write");

    await expect(listLeanProofChecks(root)).resolves.toEqual([]);
  });

  it("writes visual artifacts from proof-check records without upgrading trust", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Proof Visual Lab" });
    await writeFile(join(root, "trivial.lean"), "theorem trivial_true : True := by trivial\n", "utf8");
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Lean (version 4.12.0)\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "",
        stderr: ""
      };
    };

    const proofWrite = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "trivial.lean",
      declarationName: "trivial_true",
      runner
    });
    const visualWrite = await writeLeanProofCheckVisualArtifact({
      rootPath: root,
      proofRef: proofWrite.record.checkId,
      now: "2026-06-10T00:00:00.000Z"
    });
    const visual = await readVisualArtifact(root, visualWrite.visual.visualId);
    const rereadProof = await readLeanProofCheckRecord(root, proofWrite.record.checkId);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(rereadProof.checkId).toBe(proofWrite.record.checkId);
    expect(visual.kind).toBe("proof-tree");
    expect(visual.renderer.adapter).toBe("lean-proof-check-visual");
    expect(visual.payload.format).toBe("svg");
    expect(String(visual.payload.content)).toContain(proofWrite.record.checkId);
    expect(String(visual.payload.content)).toContain(proofWrite.record.source.declaration?.declarationId);
    expect(visual.sourceRefs).toContainEqual(
      expect.objectContaining({
        kind: "proof",
        ref: expect.stringContaining(".truth-harness/proofs/")
      })
    );
    expect(visual.trustBoundary.visualDoesNotUpgradeTrust).toBe(true);
    expect(visual.warnings.join(" ")).toContain("proof-check JSON remains the authoritative");
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.proofs).toBe(1);
    expect(validation.summary.byKind.visuals).toBe(1);
  });
});

describe.runIf(process.env.TRUTH_HARNESS_TEST_REAL_LEAN === "1")("real Lean compilation-only boundary", () => {
  it.each([
    { name: "valid theorem", source: "theorem target : 1 + 1 = 2 := by rfl\n", target: "target", exitCode: 0 },
    { name: "invalid theorem", source: "theorem target : False := True.intro\n", target: "target", exitCode: 1 },
    { name: "explicit sorryAx", source: "theorem target : False := sorryAx False true\n", target: "target", exitCode: 0 },
    { name: "missing requested theorem", source: "theorem actual : True := by trivial\n", target: "target", exitCode: 0 },
    { name: "local def", source: "def target : True := True.intro\n", target: "target", exitCode: 0 },
    { name: "whole-file theorems", source: "theorem first : True := by trivial\ntheorem second : True := first\n", exitCode: 0 },
    { name: "anonymous-only file", source: "example : True := by trivial\n", exitCode: 0 },
    { name: "theorem with compiler diagnostics", source: "theorem target : True := by trivial\n#check target\n", target: "target", exitCode: 0 }
  ])("keeps $name unverified", ({ name, source, target, exitCode }) => {
    const record = checkLeanProofArtifact({
      sourcePath: "fixture-not-read-from-disk.lean",
      sourceText: source,
      declarationName: target,
      timeoutMs: 10000
    });

    expect(record.backend.version).toContain("version 4.12.0");
    expect(record.backend.exitCode, record.stdout || record.stderr || record.error).toBe(exitCode);
    expect(record.backend.args).toEqual(["--stdin"]);
    expect(record.source.sha256).toBe(createHash("sha256").update(source).digest("hex"));
    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
    if (exitCode === 0) {
      expect(record.limitations.join(" ")).toContain("trusted independent kernel check and transitive axiom audit is missing");
    }
    if (name === "theorem with compiler diagnostics") expect(record.stdout).toContain("target : True");
  }, 30000);

  it("keeps a theorem depending on an imported false axiom unverified", async () => {
    const root = await tempRoot();
    const leanCommand = process.env.TRUTH_HARNESS_LEAN?.trim() || "lean";
    await writeFile(join(root, "FalseAxiom.lean"), "axiom importedFalse : False\n", "utf8");
    const compile = spawnSync(leanCommand, ["-o", "FalseAxiom.olean", "FalseAxiom.lean"], {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true
    });
    expect(compile.error).toBeUndefined();
    expect(compile.status, compile.stdout || compile.stderr).toBe(0);

    const previousLeanPath = process.env.LEAN_PATH;
    process.env.LEAN_PATH = [root, previousLeanPath].filter(Boolean).join(delimiter);
    try {
      const record = checkLeanProofArtifact({
        sourcePath: "imported-false-not-read-from-disk.lean",
        sourceText: "import FalseAxiom\ntheorem target : False := importedFalse\n#print axioms target\n",
        declarationName: "target",
        timeoutMs: 10000
      });
      expect(record.backend.exitCode, record.stdout || record.stderr || record.error).toBe(0);
      expect(record.stdout).toContain("importedFalse");
      expect(record.status).toBe("rejected");
      expect(record.trust).toBe("unverified");
      expect(record.proofCheckerBacked).toBe(false);
    } finally {
      if (previousLeanPath === undefined) delete process.env.LEAN_PATH;
      else process.env.LEAN_PATH = previousLeanPath;
    }
  }, 30000);

  it("runs a Lake project compile using the same exact stdin source", async () => {
    const root = await tempRoot();
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\npackage compile_only_fixture where\n", "utf8");
    const record = checkLeanProofArtifact({
      sourcePath: join(root, "not-read-from-disk.lean"),
      sourceText: "theorem target : True := by trivial\n",
      declarationName: "target",
      projectRoot: root,
      timeoutMs: 10000
    });

    expect(record.backend.args).toEqual(["env", process.env.TRUTH_HARNESS_LEAN?.trim() || "lean", "--stdin"]);
    expect(record.backend.exitCode, record.stdout || record.stderr || record.error).toBe(0);
    expect(record.status).toBe("rejected");
    expect(record.trust).toBe("unverified");
    expect(record.proofCheckerBacked).toBe(false);
  }, 30000);
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-proof-"));
  tempRoots.push(root);
  return root;
}

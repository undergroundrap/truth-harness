import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
  it("reports an available local Lean proof checker without minting proof", () => {
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
    expect(report.proofCheckersAvailable).toBe(1);
    expect(report.trustBoundary.statusProbeIsNotProof).toBe(true);
    expect(report.trustBoundary.provedRequiresSuccessfulProofRun).toBe(true);
    expect(report.backends[0]).toMatchObject({
      backendId: "lean",
      adapter: "local-lean-subprocess",
      role: "proof-checker",
      acceptedProofChecker: true,
      status: "available",
      canCheckProofs: true,
      statusProbeMintedProof: false,
      version: "Lean (version 4.12.0, x86_64-unknown-linux-gnu)"
    });
    expect(report.backends[0]?.limitations.join(" ")).toContain("only after Lean accepts");
    expect(report.warnings.join(" ")).toContain("does not prove any claim");
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

  it("labels a Lean-accepted proof artifact as proved with proof-checker metadata", () => {
    const calls: Array<{ command: string; args: string[]; timeoutMs: number }> = [];
    const runner: ProofBackendCommandRunner = (command, args, timeoutMs) => {
      calls.push({ command, args, timeoutMs });
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
      sourcePath: "proofs/parity.lean",
      sourceText: "theorem one_plus_one : 1 + 1 = 2 := by norm_num\n",
      declarationName: "one_plus_one",
      now: new Date("2026-06-10T00:00:00.000Z"),
      runner
    });

    expect(calls).toEqual([
      { command: "lean", args: ["--version"], timeoutMs: 3000 },
      { command: "lean", args: ["proofs/parity.lean"], timeoutMs: 3000 }
    ]);
    expect(record.schemaVersion).toBe("truth-harness.proof-check.v0");
    expect(record.checkId).toMatch(/^proof_[a-f0-9]{16}$/);
    expect(record.status).toBe("accepted");
    expect(record.trust).toBe("proved");
    expect(record.proofCheckerBacked).toBe(true);
    expect(record.backend.acceptedProofChecker).toBe(true);
    expect(record.backend.version).toBe("Lean (version 4.12.0)");
    expect(record.source.sha256).toMatch(/^[a-f0-9]{64}$/);
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
    expect(record.limitations.join(" ")).toContain("formal statement checked by Lean");
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

    expect(write.record.trust).toBe("proved");
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
      trust: "proved",
      proofCheckerBacked: true
    });
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.proofs).toBe(1);
  });

  it("warns when a requested Lean declaration name is not found in the checked source", () => {
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

    expect(record.status).toBe("accepted");
    expect(record.trust).toBe("proved");
    expect(record.source.declarationName).toBe("requested_name");
    expect(record.source.declaration).toBeUndefined();
    expect(record.warnings.join(" ")).toContain("requested Lean declaration");
    expect(record.warnings.join(" ")).toContain("whole source file");
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

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-proof-"));
  tempRoots.push(root);
  return root;
}

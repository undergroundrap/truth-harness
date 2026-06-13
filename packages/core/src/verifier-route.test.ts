import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeSymbolicCasCheckRecord, type CasBackendCommandRunner } from "./cas-backend.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeLeanProofCheckRecord, type ProofBackendCommandRunner } from "./proof-backend.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import {
  createVerifierRoute,
  listVerifierRoutes,
  readVerifierRoute,
  satisfyVerifierRouteObligation,
  writeVerifierRoute
} from "./verifier-route.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("verifier route", () => {
  it("routes exact arithmetic through the native rational kernel without pretending proof", () => {
    const route = createVerifierRoute("compute 3 / 4 + 5 / 8", {
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });

    expect(route.schemaVersion).toBe("theorem.verifier-route.v0");
    expect(route.localOnly).toBe(true);
    expect(route.networkAccess).toBe("none");
    expect(route.status).toBe("verified");
    expect(route.finalTrust).toBe("exact-computed");
    expect(route.evidenceKind).toBe("exact-arithmetic");
    expect(route.usedCapabilities).toContainEqual(
      expect.objectContaining({
        capabilityId: "local-rational-arithmetic",
        status: "used",
        canMintTrust: true
      })
    );
    expect(route.gaps).toContainEqual(
      expect.objectContaining({
        capabilityId: "accepted-proof-checker",
        severity: "info"
      })
    );
    expect(route.proofObligations).toContainEqual(
      expect.objectContaining({
        kind: "formal-proof",
        status: "not-required",
        sourceCapabilityId: "accepted-proof-checker",
        title: "Formal proof-checker obligation"
      })
    );
    expect(route.trustBoundary.routeIsNotProof).toBe(true);
    expect(route.trustBoundary.receiptTrustIsUpperBound).toBe(true);
  });

  it("routes symbolic claims through SymPy and records independent Maxima when available", () => {
    const route = createVerifierRoute("symbolic simplify sin(x)^2 + cos(x)^2", {
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "maxima-test",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50,
      casRunner: (_command, args) => {
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
      }
    });

    if (route.finalTrust === "unverified" && route.receipt.findings[0]?.message.includes("SymPy adapter")) {
      return;
    }

    expect(route.finalTrust).toBe("cross-checked");
    expect(route.usedCapabilities.map((step) => step.capabilityId)).toContain("sympy-symbolic-adapter");
    expect(route.usedCapabilities.map((step) => step.capabilityId)).toContain("maxima-cas");
    expect(route.blockedCapabilities).toContainEqual(
      expect.objectContaining({
        capabilityId: "lean-proof-checker",
        status: "blocked"
      })
    );
    expect(route.gaps.map((gap) => gap.capabilityId)).toContain("accepted-proof-checker");
  });

  it("keeps unsupported prompts unverified and points to stronger route gaps", () => {
    const route = createVerifierRoute("prove the Riemann hypothesis", {
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });

    expect(route.status).toBe("unverified");
    expect(route.finalTrust).toBe("unverified");
    expect(route.evidenceKind).toBe("unsupported");
    expect(route.usedCapabilities).toEqual([]);
    expect(route.blockedCapabilities.map((step) => step.capabilityId)).toEqual([
      "lean-proof-checker",
      "z3-smt-solver",
      "maxima-cas"
    ]);
    expect(route.gaps.every((gap) => gap.severity === "critical" || gap.severity === "info")).toBe(true);
    expect(route.proofObligations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "formal-proof",
          status: "open",
          sourceCapabilityId: "lean-proof-checker"
        }),
        expect.objectContaining({
          kind: "solver-encoding",
          status: "open",
          sourceCapabilityId: "z3-smt-solver"
        }),
        expect.objectContaining({
          kind: "independent-check",
          status: "open",
          sourceCapabilityId: "maxima-cas"
        })
      ])
    );
    expect(route.nextActions.join(" ")).toContain("Lean");
  });

  it("writes, lists, reads, and validates verifier route artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-12T00:00:00.000Z"
    });

    const result = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const routes = await listVerifierRoutes(root);
    const readBack = await readVerifierRoute(root, result.route.routeId);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(result.jsonPath).toContain(join(".theorem-workbench", "routes"));
    expect(result.markdown).toContain(`# Verifier Route ${result.route.routeId}`);
    expect(result.markdown).toContain("## Proof Obligations");
    expect(result.route.replay).toBe("theorem verify \"compute 3 / 4 + 5 / 8\" --json");
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      routeId: result.route.routeId,
      finalTrust: "exact-computed",
      evidenceKind: "exact-arithmetic",
      receiptRunId: result.route.receipt.runId,
      usedCapabilities: ["local-rational-arithmetic"],
      proofObligations: result.route.proofObligations.length,
      openProofObligations: result.route.proofObligations.filter((obligation) => obligation.status === "open").length,
      satisfiedProofObligations: 0,
      notRequiredProofObligations: result.route.proofObligations.filter((obligation) => obligation.status === "not-required").length,
      criticalOpenProofObligations: result.route.proofObligations.filter((obligation) =>
        obligation.status === "open" && obligation.severity === "critical"
      ).length
    });
    expect(readBack.routeId).toBe(result.route.routeId);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.routes).toBe(1);
  });

  it("satisfies a formal proof obligation only with accepted proof-check evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-12T00:00:00.000Z"
    });
    await writeFile(join(root, "trivial.lean"), "example : True := by trivial\n", "utf8");
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

    const routeWrite = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "formal-proof");
    expect(obligation).toMatchObject({
      status: "open",
      sourceCapabilityId: "lean-proof-checker"
    });
    const proofWrite = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "trivial.lean",
      theoremName: "trivial_true",
      now: new Date("2026-06-12T00:01:00.000Z"),
      runner
    });
    const proofRef = relative(root, proofWrite.jsonPath);

    const satisfied = await satisfyVerifierRouteObligation({
      rootPath: root,
      routeRef: routeWrite.route.routeId,
      obligationId: obligation?.obligationId ?? "",
      evidenceRef: { kind: "proof", ref: proofRef },
      now: new Date("2026-06-12T00:02:00.000Z")
    });
    const readBack = await readVerifierRoute(root, routeWrite.route.routeId);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(satisfied.obligation.status).toBe("satisfied");
    expect(satisfied.obligation.satisfiedBy).toEqual([
      expect.objectContaining({
        kind: "proof",
        ref: proofRef,
        trust: "proved"
      })
    ]);
    expect(satisfied.markdown).toContain("Satisfied by:");
    expect(satisfied.markdown).toContain(`proof:${proofRef}`);
    expect(readBack.proofObligations.find((candidate) => candidate.obligationId === obligation?.obligationId)).toMatchObject({
      status: "satisfied",
      satisfactionSummary: "Accepted proof-check record supplies `proved` evidence for this obligation."
    });
    expect(validation.passed).toBe(true);
  });

  it("satisfies independent-check obligations with cross-checked CAS evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-12T00:00:00.000Z"
    });
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
        stdout: "THEOREM_MAXIMA_STATUS:passed:0\n",
        stderr: ""
      };
    };

    const routeWrite = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "independent-check");
    expect(obligation).toMatchObject({
      status: "open",
      sourceCapabilityId: "maxima-cas"
    });
    const casWrite = await writeSymbolicCasCheckRecord({
      rootPath: root,
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      result: "1",
      maximaCommand: "maxima-test",
      now: new Date("2026-06-12T00:01:00.000Z"),
      runner
    });
    const casRef = relative(root, casWrite.jsonPath);

    const satisfied = await satisfyVerifierRouteObligation({
      rootPath: root,
      routeRef: routeWrite.route.routeId,
      obligationId: obligation?.obligationId ?? "",
      evidenceRef: { kind: "cas", ref: casRef },
      now: new Date("2026-06-12T00:02:00.000Z")
    });
    const readBack = await readVerifierRoute(root, routeWrite.route.routeId);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(satisfied.obligation.status).toBe("satisfied");
    expect(satisfied.obligation.satisfiedBy).toEqual([
      expect.objectContaining({
        kind: "cas",
        ref: casRef,
        trust: "cross-checked"
      })
    ]);
    expect(satisfied.evidence).toMatchObject({
      kind: "cas",
      trust: "cross-checked",
      schemaVersion: "theorem.cas-check.v0"
    });
    expect(readBack.proofObligations.find((candidate) => candidate.obligationId === obligation?.obligationId)).toMatchObject({
      status: "satisfied",
      satisfactionSummary: "Independent cross-check evidence satisfies this obligation."
    });
    expect(validation.passed).toBe(true);
  });

  it("refuses malformed CAS JSON even when it claims cross-checked", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-12T00:00:00.000Z"
    });
    const routeWrite = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "independent-check");
    const casRef = join(".theorem-workbench", "cas", "forged-cas.json");
    await mkdir(join(root, ".theorem-workbench", "cas"), { recursive: true });
    await writeFile(
      join(root, casRef),
      `${JSON.stringify({
        schemaVersion: "theorem.cas-check.v0",
        checkId: "cas_0123456789abcdef",
        status: "passed",
        trust: "cross-checked",
        proofCheckerBacked: false
      })}\n`,
      "utf8"
    );

    await expect(
      satisfyVerifierRouteObligation({
        rootPath: root,
        routeRef: routeWrite.route.routeId,
        obligationId: obligation?.obligationId ?? "",
        evidenceRef: { kind: "cas", ref: casRef },
        now: new Date("2026-06-12T00:01:00.000Z")
      })
    ).rejects.toThrow("Invalid CAS check record");
  });

  it("refuses malformed SMT JSON even when it claims smt-checked", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-12T00:00:00.000Z"
    });
    const routeWrite = await writeVerifierRoute({
      rootPath: root,
      problem: "solve integer constraints x > 0 and x < 3",
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "solver-encoding");
    const smtRef = join(".theorem-workbench", "smt", "forged-smt.json");
    await mkdir(join(root, ".theorem-workbench", "smt"), { recursive: true });
    await writeFile(
      join(root, smtRef),
      `${JSON.stringify({
        schemaVersion: "theorem.smt-check.v0",
        checkId: "smt_0123456789abcdef",
        status: "sat",
        trust: "smt-checked",
        proofCheckerBacked: false
      })}\n`,
      "utf8"
    );

    await expect(
      satisfyVerifierRouteObligation({
        rootPath: root,
        routeRef: routeWrite.route.routeId,
        obligationId: obligation?.obligationId ?? "",
        evidenceRef: { kind: "smt", ref: smtRef },
        now: new Date("2026-06-12T00:01:00.000Z")
      })
    ).rejects.toThrow("Invalid SMT check record");
  });

  it("refuses to satisfy a formal proof obligation with non-proof evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-12T00:00:00.000Z"
    });
    const receiptRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const routeWrite = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-12T00:01:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "formal-proof");
    const receiptRef = relative(root, receiptRoute.jsonPath);

    await expect(
      satisfyVerifierRouteObligation({
        rootPath: root,
        routeRef: routeWrite.route.routeId,
        obligationId: obligation?.obligationId ?? "",
        evidenceRef: { kind: "route", ref: receiptRef },
        now: new Date("2026-06-12T00:02:00.000Z")
      })
    ).rejects.toThrow("formal-proof obligations require `proved` evidence");
  });

  it("refuses route evidence as a substitute for the proof artifact itself", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-12T00:00:00.000Z"
    });
    const routeWrite = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "formal-proof");
    const forgedRouteRef = join(".theorem-workbench", "routes", "forged-proved-route.json");
    const forgedReceipt = {
      ...routeWrite.route.receipt,
      trust: "proved" as const,
      evidenceProfile: {
        ...routeWrite.route.receipt.evidenceProfile,
        proofCheckerBacked: true,
        backends: [
          {
            ...routeWrite.route.receipt.evidenceProfile.backends[0],
            id: "lean",
            role: "proof-checker" as const,
            acceptedProofChecker: true
          }
        ]
      }
    };
    const forgedRoute = {
      ...routeWrite.route,
      routeId: "route_0123456789abcdef",
      status: "verified" as const,
      finalTrust: "proved" as const,
      receipt: forgedReceipt
    };
    await mkdir(join(root, ".theorem-workbench", "routes"), { recursive: true });
    await writeFile(join(root, forgedRouteRef), `${JSON.stringify(forgedRoute, null, 2)}\n`, "utf8");

    await expect(
      satisfyVerifierRouteObligation({
        rootPath: root,
        routeRef: routeWrite.route.routeId,
        obligationId: obligation?.obligationId ?? "",
        evidenceRef: { kind: "route", ref: forgedRouteRef },
        now: new Date("2026-06-12T00:01:00.000Z")
      })
    ).rejects.toThrow("formal-proof obligations require a proof-check record or proof-backed receipt");
  });

  it("refuses malformed proof-check JSON even when it claims proved", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-12T00:00:00.000Z"
    });
    const routeWrite = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "formal-proof");
    const proofRef = join(".theorem-workbench", "proofs", "forged-proof.json");
    await mkdir(join(root, ".theorem-workbench", "proofs"), { recursive: true });
    await writeFile(
      join(root, proofRef),
      `${JSON.stringify({
        schemaVersion: "theorem.proof-check.v0",
        checkId: "proof_0123456789abcdef",
        backend: { acceptedProofChecker: true },
        status: "accepted",
        trust: "proved",
        proofCheckerBacked: true
      })}\n`,
      "utf8"
    );

    await expect(
      satisfyVerifierRouteObligation({
        rootPath: root,
        routeRef: routeWrite.route.routeId,
        obligationId: obligation?.obligationId ?? "",
        evidenceRef: { kind: "proof", ref: proofRef },
        now: new Date("2026-06-12T00:01:00.000Z")
      })
    ).rejects.toThrow("Invalid proof-check record");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-"));
  roots.push(root);
  return root;
}

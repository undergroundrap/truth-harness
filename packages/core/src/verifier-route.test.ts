import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeSymbolicCasCheckRecord, type CasBackendCommandRunner } from "./cas-backend.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeLeanProofCheckRecord, type ProofBackendCommandRunner } from "./proof-backend.js";
import type { SmtBackendCommandRunner } from "./smt-backend.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import {
  createVerifierRoute,
  listVerifierRoutes,
  readVerifierRoute,
  satisfyVerifierRouteObligation,
  verifierRouteReadiness,
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
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    expect(route.schemaVersion).toBe("truth-harness.verifier-route.v0");
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
    const formalProofObligation = route.proofObligations.find((obligation) => obligation.kind === "formal-proof");
    expect(formalProofObligation).toMatchObject({
      status: "not-required",
      sourceCapabilityId: "accepted-proof-checker",
      title: "Formal proof-checker obligation"
    });
    expect(formalProofObligation?.command).toContain(`--route ${route.routeId}`);
    expect(formalProofObligation?.command).toContain(`--obligation ${formalProofObligation?.obligationId}`);
    expect(route.trustBoundary.routeIsNotProof).toBe(true);
    expect(route.trustBoundary.receiptTrustIsUpperBound).toBe(true);
    expect(verifierRouteReadiness(route)).toMatchObject({
      readyForNarrowClaim: true,
      strongestTrust: "exact-computed",
      openObligations: 0,
      criticalOpenObligations: 0
    });
  });

  it("routes symbolic claims through SymPy and records independent Maxima when available", () => {
    const route = createVerifierRoute("symbolic simplify sin(x)^2 + cos(x)^2", {
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "maxima-test",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
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
          stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n",
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
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
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
    const openObligations = route.proofObligations.filter((obligation) => obligation.status === "open").length;
    const criticalOpenObligations = route.proofObligations.filter(
      (obligation) => obligation.status === "open" && obligation.severity === "critical"
    ).length;
    expect(verifierRouteReadiness(route)).toMatchObject({
      readyForNarrowClaim: false,
      strongestTrust: "unverified",
      openObligations,
      criticalOpenObligations
    });
    expect(verifierRouteReadiness(route).summary).toContain(`Not final: ${openObligations} open obligations`);
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
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const routes = await listVerifierRoutes(root);
    const readBack = await readVerifierRoute(root, result.route.routeId);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(result.jsonPath).toContain(join(".truth-harness", "routes"));
    expect(result.markdown).toContain(`# Verifier Route ${result.route.routeId}`);
    expect(result.markdown).toContain("## Readiness");
    expect(result.markdown).toContain("Ready for narrow claim: `true`");
    expect(result.markdown).toContain("## Proof Obligations");
    expect(result.route.replay).toBe("truth-harness verify \"compute 3 / 4 + 5 / 8\" --json");
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
      ).length,
      readyForNarrowClaim: true,
      strongestRouteTrust: "exact-computed",
      blockingObligations: 0
    });
    expect(routes[0].readinessSummary).toContain("Ready only as a narrow exact-computed claim");
    expect(readBack.routeId).toBe(result.route.routeId);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.routes).toBe(1);
  });

  it("forwards cvc5 command overrides into written verifier route manifests", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-12T00:00:00.000Z"
    });
    const now = new Date("2026-06-12T00:00:00.000Z");
    const smtRunner: SmtBackendCommandRunner = (command, args) => {
      if (command === "cvc5-test" && args[0] === "--version") {
        return {
          status: 0,
          stdout: "cvc5 version 1.1.2\n",
          stderr: ""
        };
      }

      return {
        status: null,
        stdout: "",
        stderr: "",
        error: {
          message: `spawn ${command} ENOENT`
        }
      };
    };
    const common = {
      now,
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50,
      smtRunner
    };
    const withoutCvc5 = createVerifierRoute("prove the Riemann hypothesis", common);
    const expectedWithCvc5 = createVerifierRoute("prove the Riemann hypothesis", {
      ...common,
      cvc5Command: "cvc5-test"
    });
    const written = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      ...common,
      cvc5Command: "cvc5-test"
    });

    expect(expectedWithCvc5.manifest.readyCount).toBeGreaterThan(withoutCvc5.manifest.readyCount);
    expect(written.route.manifest.readyCount).toBe(expectedWithCvc5.manifest.readyCount);
  });

  it("satisfies a formal proof obligation only with scoped accepted proof-check evidence", async () => {
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
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
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
      declarationName: "trivial_true",
      now: new Date("2026-06-12T00:01:00.000Z"),
      runner
    });
    const proofRef = relative(root, proofWrite.jsonPath);

    await expect(
      satisfyVerifierRouteObligation({
        rootPath: root,
        routeRef: routeWrite.route.routeId,
        obligationId: obligation?.obligationId ?? "",
        evidenceRef: { kind: "proof", ref: proofRef },
        now: new Date("2026-06-12T00:02:00.000Z")
      })
    ).rejects.toThrow("scoped to this exact route and obligation");

    const scopedProofWrite = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "trivial.lean",
      declarationName: "trivial_true",
      scope: {
        routeId: routeWrite.route.routeId,
        obligationId: obligation?.obligationId,
        statementHash: "0123456789abcdef"
      },
      now: new Date("2026-06-12T00:03:00.000Z"),
      runner
    });
    const scopedProofRef = relative(root, scopedProofWrite.jsonPath);

    const satisfied = await satisfyVerifierRouteObligation({
      rootPath: root,
      routeRef: routeWrite.route.routeId,
      obligationId: obligation?.obligationId ?? "",
      evidenceRef: { kind: "proof", ref: scopedProofRef },
      now: new Date("2026-06-12T00:04:00.000Z")
    });
    const readBack = await readVerifierRoute(root, routeWrite.route.routeId);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(satisfied.obligation.status).toBe("satisfied");
    expect(satisfied.obligation.satisfiedBy).toEqual([
      expect.objectContaining({
        kind: "proof",
        ref: scopedProofRef,
        trust: "proved",
        scope: expect.objectContaining({
          routeId: routeWrite.route.routeId,
          obligationId: obligation?.obligationId
        })
      })
    ]);
    expect(satisfied.markdown).toContain("Satisfied by:");
    expect(satisfied.markdown).toContain(`proof:${scopedProofRef}`);
    const openObligations = satisfied.route.proofObligations.filter((candidate) => candidate.status === "open").length;
    const criticalOpenObligations = satisfied.route.proofObligations.filter(
      (candidate) => candidate.status === "open" && candidate.severity === "critical"
    ).length;
    expect(verifierRouteReadiness(satisfied.route)).toMatchObject({
      readyForNarrowClaim: false,
      strongestTrust: "proved",
      openObligations,
      criticalOpenObligations
    });
    expect(readBack.proofObligations.find((candidate) => candidate.obligationId === obligation?.obligationId)).toMatchObject({
      status: "satisfied",
      satisfactionSummary: "Accepted scoped proof-check record supplies `proved` evidence for this obligation."
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
        stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n",
        stderr: ""
      };
    };

    const routeWrite = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-12T00:00:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
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
      schemaVersion: "truth-harness.cas-check.v0"
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
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "independent-check");
    const casRef = join(".truth-harness", "cas", "forged-cas.json");
    await mkdir(join(root, ".truth-harness", "cas"), { recursive: true });
    await writeFile(
      join(root, casRef),
      `${JSON.stringify({
        schemaVersion: "truth-harness.cas-check.v0",
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
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "solver-encoding");
    const smtRef = join(".truth-harness", "smt", "forged-smt.json");
    await mkdir(join(root, ".truth-harness", "smt"), { recursive: true });
    await writeFile(
      join(root, smtRef),
      `${JSON.stringify({
        schemaVersion: "truth-harness.smt-check.v0",
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
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const routeWrite = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-12T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
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
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "formal-proof");
    const forgedRouteRef = join(".truth-harness", "routes", "forged-proved-route.json");
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
    await mkdir(join(root, ".truth-harness", "routes"), { recursive: true });
    await writeFile(join(root, forgedRouteRef), `${JSON.stringify(forgedRoute, null, 2)}\n`, "utf8");

    await expect(
      satisfyVerifierRouteObligation({
        rootPath: root,
        routeRef: routeWrite.route.routeId,
        obligationId: obligation?.obligationId ?? "",
        evidenceRef: { kind: "route", ref: forgedRouteRef },
        now: new Date("2026-06-12T00:01:00.000Z")
      })
    ).rejects.toThrow("formal-proof obligations require a scoped proof-check record");
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
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const obligation = routeWrite.route.proofObligations.find((candidate) => candidate.kind === "formal-proof");
    const proofRef = join(".truth-harness", "proofs", "forged-proof.json");
    await mkdir(join(root, ".truth-harness", "proofs"), { recursive: true });
    await writeFile(
      join(root, proofRef),
      `${JSON.stringify({
        schemaVersion: "truth-harness.proof-check.v0",
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
  const root = await mkdtemp(join(tmpdir(), "truth-harness-"));
  roots.push(root);
  return root;
}

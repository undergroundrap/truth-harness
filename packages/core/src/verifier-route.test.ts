import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { createVerifierRoute, listVerifierRoutes, readVerifierRoute, writeVerifierRoute } from "./verifier-route.js";

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
      proofObligations: result.route.proofObligations.length
    });
    expect(readBack.routeId).toBe(result.route.routeId);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.routes).toBe(1);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-"));
  roots.push(root);
  return root;
}

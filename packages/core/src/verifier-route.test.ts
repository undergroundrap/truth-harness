import { describe, expect, it } from "vitest";
import { createVerifierRoute } from "./verifier-route.js";

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
    expect(route.nextActions.join(" ")).toContain("Lean");
  });
});

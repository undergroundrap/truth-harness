import { describe, expect, it } from "vitest";
import { parseExpression } from "./expression.js";
import { proveUniversalParity } from "./parity-proof.js";

describe("local modular parity checker", () => {
  it("certifies universal even polynomial parity claims in the narrow checker", () => {
    const result = proveUniversalParity("n^2+n", parseExpression("n^2+n"), "even");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.residues).toEqual([
        { nMod2: 0, valueMod2: 0, satisfiesPredicate: true },
        { nMod2: 1, valueMod2: 0, satisfiesPredicate: true }
      ]);
    }
  });

  it("certifies universal odd polynomial parity claims in the narrow checker", () => {
    const result = proveUniversalParity("2*n+1", parseExpression("2*n+1"), "odd");

    expect(result.ok).toBe(true);
  });

  it("rejects claims that fail modulo 2", () => {
    const result = proveUniversalParity("n^2", parseExpression("n^2"), "even");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("residue class");
    }
  });

  it("does not certify expressions outside the polynomial checker", () => {
    const result = proveUniversalParity("2*(n/1)", parseExpression("2*(n/1)"), "even");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Division");
    }
  });
});

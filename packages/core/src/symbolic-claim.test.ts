import { describe, expect, it } from "vitest";
import { compileSymbolicClaim, isCompiledSymbolicClaim, listSymbolicClaimCompilerContracts } from "./symbolic-claim.js";

describe("symbolic claim compiler", () => {
  it("exposes stable compiler contracts for agents and docs", () => {
    const contracts = listSymbolicClaimCompilerContracts();

    expect(contracts.map((contract) => contract.contractId)).toEqual([
      "symbolic.trig-pythagorean.v1",
      "symbolic.polynomial-identity-residual.v1"
    ]);
    expect(new Set(contracts.map((contract) => contract.contractId)).size).toBe(contracts.length);
    expect(contracts.every((contract) => contract.runNextAction === "truth-harness verify <claim> --write --json")).toBe(true);
    expect(contracts.every((contract) => contract.refusalBoundary.length > 0)).toBe(true);
  });

  it("compiles human trig identity claims into a bounded symbolic prompt", () => {
    expect(compileSymbolicClaim("For real x, sin(x)^2 + cos(x)^2 = 1.")).toMatchObject({
      contractId: "symbolic.trig-pythagorean.v1",
      contractLabel: "Pythagorean trigonometric identity",
      claimKind: "trig-pythagorean-identity",
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      expectedResult: "1",
      expectedResultMeaning: "The supported left-hand side must simplify exactly to 1.",
      boundarySummary: "For real x, sin(x)^2 + cos(x)^2 = 1; The supported left-hand side must simplify exactly to 1."
    });
  });

  it("accepts common notational variants without changing the evidence boundary", () => {
    expect(compileSymbolicClaim("Show that for all real numbers x, cos^2(x) + sin^2(x) = 1")?.prompt).toEqual({
      operation: "simplify",
      expression: "sin(x)^2 + cos(x)^2",
      variable: "x"
    });
  });

  it("compiles safe one-variable polynomial identities into residual checks", () => {
    expect(compileSymbolicClaim("For all real x, (x + 1)^2 = x^2 + 2*x + 1")).toMatchObject({
      contractId: "symbolic.polynomial-identity-residual.v1",
      contractLabel: "One-variable polynomial identity residual",
      claimKind: "polynomial-identity",
      prompt: {
        operation: "simplify",
        expression: "((x + 1)^2) - (x^2 + 2*x + 1)",
        variable: "x"
      },
      expectedResult: "0",
      expectedResultMeaning: "The residual (left) - (right) must simplify exactly to 0.",
      boundarySummary: "For all real x, <polynomial in x> = <polynomial in x>; The residual (left) - (right) must simplify exactly to 0."
    });
    expect(isCompiledSymbolicClaim("For every real x, x^2 + 2*x + 1 = (x + 1)^2")).toBe(true);
  });

  it("keeps only safe polynomial identities inside the explicit residual boundary", () => {
    expect(isCompiledSymbolicClaim("For all real x, (x + 1)^2 = x^2 + 2*x + 2")).toBe(true);
    expect(isCompiledSymbolicClaim("For all real x, 1 / x = x^-1")).toBe(false);
  });

  it("compiles false Pythagorean trig equality claims as refutable symbolic checks", () => {
    expect(compileSymbolicClaim("For all real x, sin(x)^2 + cos(x)^2 = 2")).toMatchObject({
      contractId: "symbolic.trig-pythagorean.v1",
      claimKind: "trig-pythagorean-identity",
      expectedResult: "2",
      expectedResultMeaning: "The supported left-hand side must simplify exactly to 2.",
      boundarySummary: "For real x, sin(x)^2 + cos(x)^2 = 2; The supported left-hand side must simplify exactly to 2.",
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      }
    });
  });
});

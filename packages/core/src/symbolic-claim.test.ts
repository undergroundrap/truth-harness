import { describe, expect, it } from "vitest";
import { compileSymbolicClaim, isCompiledSymbolicClaim } from "./symbolic-claim.js";

describe("symbolic claim compiler", () => {
  it("compiles human trig identity claims into a bounded symbolic prompt", () => {
    expect(compileSymbolicClaim("For real x, sin(x)^2 + cos(x)^2 = 1.")).toEqual({
      claimKind: "trig-pythagorean-identity",
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      expectedResult: "1",
      boundarySummary: "Pythagorean trigonometric identity over a real variable."
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
    expect(compileSymbolicClaim("For all real x, (x + 1)^2 = x^2 + 2*x + 1")).toEqual({
      claimKind: "polynomial-identity",
      prompt: {
        operation: "simplify",
        expression: "((x + 1)^2) - (x^2 + 2*x + 1)",
        variable: "x"
      },
      expectedResult: "0",
      boundarySummary: "One-variable polynomial identity over a real variable; the residual must simplify to 0."
    });
    expect(isCompiledSymbolicClaim("For every real x, x^2 + 2*x + 1 = (x + 1)^2")).toBe(true);
  });

  it("keeps only safe polynomial identities inside the explicit residual boundary", () => {
    expect(isCompiledSymbolicClaim("For all real x, (x + 1)^2 = x^2 + 2*x + 2")).toBe(true);
    expect(isCompiledSymbolicClaim("For all real x, 1 / x = x^-1")).toBe(false);
    expect(isCompiledSymbolicClaim("For all real x, sin(x)^2 + cos(x)^2 = 2")).toBe(false);
  });
});

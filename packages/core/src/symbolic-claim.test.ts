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

  it("rejects unrelated symbolic equalities until they have an explicit residual verifier", () => {
    expect(isCompiledSymbolicClaim("For all real x, (x + 1)^2 = x^2 + 2*x + 1")).toBe(false);
    expect(isCompiledSymbolicClaim("For all real x, sin(x)^2 + cos(x)^2 = 2")).toBe(false);
  });
});

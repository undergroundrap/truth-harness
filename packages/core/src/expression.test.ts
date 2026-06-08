import { describe, expect, it } from "vitest";
import { evaluateExpression, parseExpression } from "./expression.js";
import { Rational } from "./rational.js";

describe("expression evaluator", () => {
  it("evaluates integer expressions with precedence", () => {
    const value = evaluateExpression(parseExpression("2 + 2 * 3"));
    expect(value.toString()).toBe("8");
  });

  it("keeps rational arithmetic exact", () => {
    const value = evaluateExpression(parseExpression("3 / 4 + 5 / 8"));
    expect(value.toString()).toBe("11/8");
  });

  it("evaluates variable expressions exactly", () => {
    const value = evaluateExpression(parseExpression("n^2 + n + 1"), { n: Rational.integer(-20) });
    expect(value.toString()).toBe("381");
  });

  it("supports named variables", () => {
    const value = evaluateExpression(parseExpression("x^2 + 2*x + 1"), { x: Rational.integer(2) });
    expect(value.toString()).toBe("9");
  });
});

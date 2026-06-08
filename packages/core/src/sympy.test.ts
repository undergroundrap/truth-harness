import { describe, expect, it } from "vitest";
import { parseSymbolicPrompt } from "./sympy.js";

describe("symbolic prompt parsing", () => {
  it("parses simplify prompts", () => {
    expect(parseSymbolicPrompt("symbolic simplify (x^2 - 1)/(x - 1)")).toEqual({
      operation: "simplify",
      expression: "(x^2 - 1)/(x - 1)",
      variable: "x"
    });
  });

  it("parses differentiation aliases", () => {
    expect(parseSymbolicPrompt("sympy diff x^3 + x wrt x")).toEqual({
      operation: "differentiate",
      expression: "x^3 + x",
      variable: "x"
    });
  });

  it("ignores unsupported prompts", () => {
    expect(parseSymbolicPrompt("dimension check force = mass * acceleration")).toBeUndefined();
  });
});

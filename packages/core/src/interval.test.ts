import { describe, expect, it } from "vitest";
import { evaluateIntervalPrompt, formatInterval, parseIntervalPrompt } from "./interval.js";

describe("rational interval arithmetic", () => {
  it("parses interval prompts", () => {
    const prompt = parseIntervalPrompt("bound x^2 + 2*x + 1 for x in [0, 2]");

    expect(prompt?.expressionSource).toBe("x^2 + 2*x + 1");
    expect(prompt?.variable).toBe("x");
    expect(prompt?.input.lower.toString()).toBe("0");
    expect(prompt?.input.upper.toString()).toBe("2");
  });

  it("computes conservative polynomial bounds", () => {
    const result = evaluateIntervalPrompt(parseIntervalPrompt("bound x^2 + 2*x + 1 for x in [0, 2]")!);

    expect(result.output).toEqual({ lower: "1", upper: "9" });
  });

  it("handles intervals crossing zero for even powers", () => {
    const result = evaluateIntervalPrompt(parseIntervalPrompt("bound x^2 for x in [-2, 3]")!);

    expect(result.output).toEqual({ lower: "0", upper: "9" });
  });

  it("keeps dependency loss conservative", () => {
    const result = evaluateIntervalPrompt(parseIntervalPrompt("bound x - x for x in [0, 1]")!);

    expect(result.output).toEqual({ lower: "-1", upper: "1" });
  });

  it("rejects division by intervals containing zero", () => {
    expect(() => evaluateIntervalPrompt(parseIntervalPrompt("bound 1 / x for x in [-1, 1]")!)).toThrow(
      "contains zero"
    );
  });

  it("formats intervals", () => {
    const prompt = parseIntervalPrompt("bound 1 / x for x in [2, 4]")!;

    expect(formatInterval(prompt.input)).toBe("[2, 4]");
  });
});

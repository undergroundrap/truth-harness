import { describe, expect, it } from "vitest";
import { createArithmeticTrace } from "./arithmetic-trace.js";
import { parseExpression } from "./expression.js";

describe("arithmetic trace", () => {
  it("records exact calculation steps and audience explanations", () => {
    const trace = createArithmeticTrace("3 / 4 + 5 / 8", parseExpression("3 / 4 + 5 / 8"));

    expect(trace.schemaVersion).toBe("truth-harness.arithmetic-trace.v0");
    expect(trace.result).toBe("11/8");
    expect(trace.exact).toBe(true);
    expect(trace.steps.map((step) => step.result)).toContain("3/4");
    expect(trace.steps.map((step) => step.result)).toContain("5/8");
    expect(trace.steps.at(-1)).toMatchObject({
      operation: "add",
      inputValues: ["3/4", "5/8"],
      result: "11/8"
    });
    expect(trace.explanations.map((view) => view.audience)).toEqual([
      "middle-school",
      "high-school",
      "college",
      "expert"
    ]);
    expect(trace.explanations[0]?.summary).toContain("final answer is 11/8");
  });
});

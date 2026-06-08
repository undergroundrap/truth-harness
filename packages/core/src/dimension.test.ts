import { describe, expect, it } from "vitest";
import { checkDimensionEquation, formatDimension, parseDimensionPrompt } from "./dimension.js";

describe("dimension checks", () => {
  it("detects dimensionally consistent equations", () => {
    const result = checkDimensionEquation("force = mass * acceleration");

    expect(result.matched).toBe(true);
    expect(result.lhsText).toBe("M L T^-2");
    expect(result.rhsText).toBe("M L T^-2");
  });

  it("detects dimension mismatches", () => {
    const result = checkDimensionEquation("force = mass * velocity");

    expect(result.matched).toBe(false);
    expect(result.lhsText).toBe("M L T^-2");
    expect(result.rhsText).toBe("M L T^-1");
  });

  it("handles powers and dimensionless constants", () => {
    const result = checkDimensionEquation("energy = 0.5 * mass * velocity^2");

    expect(result.matched).toBe(true);
    expect(result.rhsText).toBe("M L^2 T^-2");
  });

  it("handles negative exponents", () => {
    const result = checkDimensionEquation("acceleration = length * time^-2");

    expect(result.matched).toBe(true);
    expect(result.rhsText).toBe("L T^-2");
  });

  it("parses dimension-check prompts", () => {
    expect(parseDimensionPrompt("dimension check energy = force * length")).toBe("energy = force * length");
    expect(parseDimensionPrompt("compute 2 + 2")).toBeUndefined();
  });

  it("formats dimensionless values", () => {
    expect(formatDimension({ M: 0, L: 0, T: 0, I: 0, Theta: 0, N: 0 })).toBe("1");
  });
});

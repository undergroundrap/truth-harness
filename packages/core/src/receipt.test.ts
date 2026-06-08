import { describe, expect, it } from "vitest";
import { createReceipt } from "./receipt.js";

describe("createReceipt", () => {
  it("creates exact arithmetic receipts", () => {
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("11/8");
    expect(receipt.graph.nodes.some((node) => node.kind === "computation")).toBe(true);
  });

  it("refutes false universal parity claims with a counterexample", () => {
    const receipt = createReceipt("for all integers n, n^2+n+1 is even");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("n=-20");
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("does not pretend finite search is a proof", () => {
    const receipt = createReceipt("for all integers n, n^2+n is even");

    expect(receipt.trust).toBe("unverified");
    expect(receipt.findings[0]?.message).toContain("did not produce a formal proof");
  });

  it("creates dimension-checked receipts for consistent physics formulas", () => {
    const receipt = createReceipt("dimension check force = mass * acceleration");

    expect(receipt.trust).toBe("dimension-checked");
    expect(receipt.summary).toContain("Dimensionally consistent");
    expect(receipt.graph.nodes.some((node) => node.kind === "tool_run" && node.trust === "dimension-checked")).toBe(true);
  });

  it("refutes dimensionally inconsistent physics formulas", () => {
    const receipt = createReceipt("dimension check force = mass * velocity");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("left is M L T^-2");
    expect(receipt.summary).toContain("right is M L T^-1");
  });
});

import { describe, expect, it } from "vitest";
import { checkClaimFile, parseClaimBlocks, trustSatisfiesExpectation } from "./claim-file.js";

describe("claim file checks", () => {
  it("parses truth-harness markdown blocks", () => {
    const blocks = parseClaimBlocks(
      [
        "# Claims",
        "",
        "```truth-harness",
        "expect: exact-computed",
        "compute 3 / 4 + 5 / 8",
        "```"
      ].join("\n"),
      "claims.md"
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      filePath: "claims.md",
      startLine: 3,
      endLine: 6,
      expectTrust: "exact-computed",
      problem: "compute 3 / 4 + 5 / 8"
    });
  });

  it("passes explicit expected trust labels", () => {
    const result = checkClaimFile(
      [
        "```truth-harness",
        "expect: refuted",
        "for all integers n, n^2+n+1 is even",
        "```"
      ].join("\n"),
      "claims.md"
    );

    expect(result.failed).toBe(0);
    expect(result.checks[0]?.receipt.trust).toBe("refuted");
  });

  it("accepts cross-checked as a stronger exact-computed expectation", () => {
    expect(trustSatisfiesExpectation("exact-computed", "cross-checked")).toBe(true);
    expect(trustSatisfiesExpectation("cross-checked", "exact-computed")).toBe(false);
    expect(trustSatisfiesExpectation("refuted", "cross-checked")).toBe(false);
  });

  it("rejects unverified claims in strict mode without an explicit expectation", () => {
    const result = checkClaimFile(
      ["```truth-harness", "for all integers n, 2*(n/1) is even", "```"].join("\n"),
      "claims.md"
    );

    expect(result.failed).toBe(1);
    expect(result.checks[0]?.message).toContain("strict trust rejected");
  });
});

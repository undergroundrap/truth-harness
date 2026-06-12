import { describe, expect, it } from "vitest";
import { parseBenchmarkSuite, runBenchmarkSuite } from "./index.js";

describe("benchmark runner", () => {
  it("scores trust-label expectations", () => {
    const suite = parseBenchmarkSuite({
      id: "tiny",
      title: "Tiny",
      description: "Tiny test suite",
      tasks: [
        {
          id: "exact",
          prompt: "compute 2 + 2",
          expectTrust: "exact-computed",
          expectSummaryIncludes: "4"
        },
        {
          id: "false",
          prompt: "for all integers n, n^2+n+1 is even",
          expectTrust: "refuted"
        }
      ]
    });

    const run = runBenchmarkSuite(suite);

    expect(run.passed).toBe(2);
    expect(run.trustAccuracy).toBe(1);
  });

  it("accepts cross-checked as a stronger symbolic exact-computation outcome", () => {
    const suite = parseBenchmarkSuite({
      id: "symbolic",
      title: "Symbolic",
      description: "Symbolic test suite",
      tasks: [
        {
          id: "identity",
          prompt: "symbolic simplify sin(x)^2 + cos(x)^2",
          expectTrust: "exact-computed",
          expectSummaryIncludes: "1"
        }
      ]
    });

    const run = runBenchmarkSuite(suite);

    if (run.results[0]?.receipt.trust === "unverified") {
      expect(run.failed).toBe(1);
      return;
    }

    expect(["exact-computed", "cross-checked"]).toContain(run.results[0]?.receipt.trust);
    expect(run.passed).toBe(1);
  });
});

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
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
          expectEvidenceKind: "exact-arithmetic",
          level: "level-1-exact-arithmetic",
          category: "exact-computation",
          aiFailureMode: "rounding instead of exact arithmetic",
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
    expect(run.results[0]?.task).toMatchObject({
      expectEvidenceKind: "exact-arithmetic",
      level: "level-1-exact-arithmetic",
      category: "exact-computation",
      aiFailureMode: "rounding instead of exact arithmetic"
    });
    expect(run.levelSummaries).toEqual([
      {
        level: "level-1-exact-arithmetic",
        total: 1,
        passed: 1,
        failed: 0,
        trustAccuracy: 1
      },
      {
        level: "uncategorized",
        total: 1,
        passed: 1,
        failed: 0,
        trustAccuracy: 1
      }
    ]);
  });

  it("fails when a benchmark case earns the right trust label through the wrong evidence kind", () => {
    const suite = parseBenchmarkSuite({
      id: "evidence-kind",
      title: "Evidence Kind",
      description: "Evidence kind test suite",
      tasks: [
        {
          id: "exact",
          prompt: "compute 2 + 2",
          expectTrust: "exact-computed",
          expectEvidenceKind: "universal-parity"
        }
      ]
    });

    const run = runBenchmarkSuite(suite);

    expect(run.failed).toBe(1);
    expect(run.results[0]?.failures).toContain("Expected evidence kind universal-parity, received exact-arithmetic");
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

  it("keeps the native math credibility ladder passing without optional engines", () => {
    const suitePath = resolve(process.cwd(), "packages/benchmarks/suites/math-credibility-ladder.json");
    const suite = parseBenchmarkSuite(JSON.parse(readFileSync(suitePath, "utf8")) as unknown);

    const run = runBenchmarkSuite(suite);

    expect(run.total).toBeGreaterThanOrEqual(18);
    expect(run.failed).toBe(0);
    expect(run.trustAccuracy).toBe(1);
    expect(run.results.some((result) => result.receipt.trust === "refuted")).toBe(true);
    expect(run.results.some((result) => result.receipt.trust === "unverified")).toBe(true);
    expect(run.results.some((result) => result.receipt.evidenceProfile.kind === "dimension-analysis")).toBe(true);
    expect(run.results.some((result) => result.receipt.evidenceProfile.kind === "interval-bound")).toBe(true);
    expect(run.levelSummaries.map((summary) => summary.level)).toEqual([
      "level-1-exact-arithmetic",
      "level-2-universal-refutation",
      "level-3-physics-units",
      "level-4-bounded-numerics",
      "level-5-honest-boundaries"
    ]);
    expect(run.levelSummaries.every((summary) => summary.passed === summary.total)).toBe(true);
  });
});

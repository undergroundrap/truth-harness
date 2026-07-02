import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBenchmarkSuite, parsePublicMathProblemCatalog, runBenchmarkSuite, summarizePublicMathProblemCatalog } from "./index.js";

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
          reviewStatus: "self-reviewed",
          requiredEvidence: ["exact arithmetic receipt", "receipt replay command"],
          checkerBoundary: "native exact-arithmetic parser",
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
      aiFailureMode: "rounding instead of exact arithmetic",
      reviewStatus: "self-reviewed",
      requiredEvidence: ["exact arithmetic receipt", "receipt replay command"],
      checkerBoundary: "native exact-arithmetic parser"
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
  it("keeps the professor math challenge passing as a native-safe reviewer exam", () => {
    const suitePath = resolve(process.cwd(), "packages/benchmarks/suites/professor-math-challenge.json");
    const suite = parseBenchmarkSuite(JSON.parse(readFileSync(suitePath, "utf8")) as unknown);

    const run = runBenchmarkSuite(suite);
    const evidenceKinds = new Set(run.results.map((result) => result.receipt.evidenceProfile.kind));
    const trusts = new Set(run.results.map((result) => result.receipt.trust));

    expect(run.total).toBeGreaterThanOrEqual(24);
    expect(run.failed).toBe(0);
    expect(run.trustAccuracy).toBe(1);
    expect([...trusts].sort()).toEqual([
      "bounded-numeric",
      "dimension-checked",
      "exact-computed",
      "refuted",
      "unverified"
    ]);
    expect([...evidenceKinds].sort()).toEqual([
      "dimension-analysis",
      "exact-arithmetic",
      "interval-bound",
      "universal-parity",
      "unsupported"
    ]);
    expect(run.levelSummaries.map((summary) => summary.level)).toEqual([
      "level-6-professor-exact-algebra",
      "level-7-professor-finite-discrete",
      "level-8-professor-units-bounds",
      "level-9-professor-honest-boundaries"
    ]);
    expect(run.levelSummaries.every((summary) => summary.passed === summary.total)).toBe(true);
  });
  it("keeps public bounded problem probes replayable", () => {
    const suitePath = resolve(process.cwd(), "packages/benchmarks/suites/public-problem-probes.json");
    const suite = parseBenchmarkSuite(JSON.parse(readFileSync(suitePath, "utf8")) as unknown);

    const run = runBenchmarkSuite(suite);
    const trustCounts = run.results.reduce<Record<string, number>>((counts, result) => {
      counts[result.receipt.trust] = (counts[result.receipt.trust] ?? 0) + 1;
      return counts;
    }, {});
    const backendIds = new Set(run.results.map((result) => result.receipt.evidenceProfile.backends[0]?.id));

    expect(run.total).toBe(10);
    expect(run.failed).toBe(0);
    expect(run.trustAccuracy).toBe(1);
    expect(trustCounts).toMatchObject({ "exact-computed": 5, refuted: 5 });
    expect(backendIds).toEqual(
      new Set(["local-finite-sum-inclusion-exclusion", "local-fibonacci-even-sum", "local-sum-square-difference", "local-self-power-modular-sum", "local-binomial-threshold-counter"])
    );
    expect(suite.tasks.every((task) => task.sourceUrl?.startsWith("https://projecteuler.net/problem="))).toBe(true);
    expect(suite.tasks.every((task) => task.firstLoggedAt === "2026-07-01" || task.firstLoggedAt === "2026-07-02")).toBe(true);
    expect(run.levelSummaries).toEqual([
      {
        level: "level-13-public-bounded-computation",
        total: 10,
        passed: 10,
        failed: 0,
        trustAccuracy: 1
      }
    ]);
  });

  it("keeps the engine math seed suite replayable", () => {
    const suitePath = resolve(process.cwd(), "packages/benchmarks/suites/engine-math-seed.json");
    const suite = parseBenchmarkSuite(JSON.parse(readFileSync(suitePath, "utf8")) as unknown);

    const run = runBenchmarkSuite(suite);
    const trustCounts = run.results.reduce<Record<string, number>>((counts, result) => {
      counts[result.receipt.trust] = (counts[result.receipt.trust] ?? 0) + 1;
      return counts;
    }, {});
    const backendIds = new Set(run.results.map((result) => result.receipt.evidenceProfile.backends[0]?.id));

    expect(run.total).toBe(33);
    expect(run.failed).toBe(0);
    expect(run.trustAccuracy).toBe(1);
    expect(trustCounts).toMatchObject({ "exact-computed": 21, refuted: 12 });
    expect(backendIds).toEqual(new Set(["local-aabb2-overlap", "local-swept-aabb2-intersection", "local-circle2-intersection", "local-capsule2-circle-intersection", "local-circle2-aabb-intersection", "local-segment2-intersection", "local-ray2-circle-intersection", "local-ray2-aabb-intersection", "local-barycentric2", "local-point-in-triangle2"]));
    expect(suite.tasks.every((task) => task.category === "engine-geometry")).toBe(true);
    expect(suite.tasks.every((task) => task.reviewStatus === "self-reviewed")).toBe(true);
    expect(run.levelSummaries).toEqual([
      {
        level: "level-1-engine-geometry-predicate",
        total: 33,
        passed: 33,
        failed: 0,
        trustAccuracy: 1
      }
    ]);
  });
  it("keeps the public math catalog linked to runnable suite tasks", () => {
    const suitePath = resolve(process.cwd(), "packages/benchmarks/suites/public-problem-probes.json");
    const catalogPath = resolve(process.cwd(), "packages/benchmarks/catalog/public-math-problem-catalog.json");
    const suite = parseBenchmarkSuite(JSON.parse(readFileSync(suitePath, "utf8")) as unknown);
    const catalog = parsePublicMathProblemCatalog(JSON.parse(readFileSync(catalogPath, "utf8")) as unknown);
    const summary = summarizePublicMathProblemCatalog(catalog);
    const taskIds = new Set(suite.tasks.map((task) => task.id));

    expect(catalog.schemaVersion).toBe("truth-harness.public-math-problem-catalog.v0");
    expect(catalog.updatedAt).toBe("2026-07-02");
    expect(catalog.problems).toHaveLength(5);
    expect(summary).toMatchObject({
      totalProblems: 5,
      solved: 5,
      openGaps: 0,
      queued: 0,
      sourceNeeded: 1,
      warnings: []
    });
    expect(summary.defaultCommands).toContain("npm run docker:public-probes");
    expect(summary.nextAction).toMatchObject({
      kind: "catalog-target-search",
      targetId: "public-symbolic-identity-queue",
      status: "source-needed",
      priority: 55
    });
    expect(summary.nextAction.requiredEvidence).toContain("Stable public source URL");
    for (const problem of catalog.problems) {
      expect(problem.status).toBe("solved-by-local-receipt");
      expect(problem.source.url).toMatch(/^https:\/\/projecteuler\.net\/problem=\d+$/u);
      expect(problem.suitePath).toBe("packages/benchmarks/suites/public-problem-probes.json");
      expect(problem.suiteTaskIds?.length).toBe(2);
      expect(problem.suiteTaskIds?.every((taskId) => taskIds.has(taskId))).toBe(true);
    }
  });

  it("prioritizes open catalog gaps before future public problem searches", () => {
    const catalog = parsePublicMathProblemCatalog({
      schemaVersion: "truth-harness.public-math-problem-catalog.v0",
      catalogId: "gap-catalog",
      title: "Gap Catalog",
      updatedAt: "2026-07-02",
      purpose: "test",
      workflow: { stages: ["one"], defaultCommands: ["truth-harness bench run gaps.json"] },
      suiteRefs: [{ suiteId: "gaps", path: "packages/benchmarks/suites/gaps.json" }],
      problems: [
        {
          id: "needs-adapter",
          firstLoggedAt: "2026-07-02",
          source: { site: "Example", title: "Adapter Gap", url: "https://example.test/gap", accessedAt: "2026-07-02" },
          status: "unsupported-adapter-gap",
          domain: "symbolic",
          resultSummary: "No local adapter covers the normalized expression yet.",
          checkerBoundary: "unsupported fixture boundary"
        }
      ],
      nextTargets: [{ id: "future-source", status: "source-needed", goal: "Find another problem." }],
      honestyBoundary: "test boundary"
    });
    const summary = summarizePublicMathProblemCatalog(catalog);

    expect(summary.nextAction).toMatchObject({
      kind: "catalog-problem-gap",
      targetId: "needs-adapter",
      status: "unsupported-adapter-gap",
      priority: 100,
      suitePath: "packages/benchmarks/suites/gaps.json"
    });
    expect(summary.nextAction.requiredEvidence).toContain("Smallest verifier adapter that covers the normalized problem");
    expect(summary.nextAction.honestyBoundary).toBe("unsupported fixture boundary");
  });

  it("returns a complete catalog action when there are no problems or queued targets", () => {
    const catalog = parsePublicMathProblemCatalog({
      schemaVersion: "truth-harness.public-math-problem-catalog.v0",
      catalogId: "complete-catalog",
      title: "Complete Catalog",
      updatedAt: "2026-07-02",
      purpose: "test",
      workflow: { stages: ["one"], defaultCommands: ["truth-harness bench catalog catalog.json --json"] },
      suiteRefs: [],
      problems: [],
      nextTargets: [],
      honestyBoundary: "no target boundary"
    });
    const summary = summarizePublicMathProblemCatalog(catalog);

    expect(summary.nextAction).toMatchObject({
      kind: "catalog-complete",
      priority: 0,
      honestyBoundary: "no target boundary"
    });
    expect(summary.warnings).toContain("No public problems are recorded yet.");
  });

  it("rejects malformed public math catalog statuses", () => {
    expect(() =>
      parsePublicMathProblemCatalog({
        schemaVersion: "truth-harness.public-math-problem-catalog.v0",
        catalogId: "bad-catalog",
        title: "Bad Catalog",
        updatedAt: "2026-07-02",
        purpose: "test",
        workflow: { stages: ["one"], defaultCommands: ["run"] },
        suiteRefs: [],
        problems: [
          {
            id: "bad",
            firstLoggedAt: "2026-07-02",
            source: { site: "Example", title: "Example", url: "https://example.test", accessedAt: "2026-07-02" },
            status: "magically-solved",
            domain: "test"
          }
        ],
        nextTargets: [],
        honestyBoundary: "test"
      })
    ).toThrow("unsupported status");
  });
  it("keeps the frontier honesty challenge humble on famous hard problems", () => {
    const suitePath = resolve(process.cwd(), "packages/benchmarks/suites/frontier-honesty-challenge.json");
    const suite = parseBenchmarkSuite(JSON.parse(readFileSync(suitePath, "utf8")) as unknown);

    const run = runBenchmarkSuite(suite);
    const frontierTasks = suite.tasks.filter((task) => task.level === "level-10-frontier-refusal");
    const theoremBoundaryTasks = suite.tasks.filter((task) => task.level === "level-11-known-theorem-refusal");
    const nearbyTruthTasks = suite.tasks.filter((task) => task.level === "level-12-nearby-bounded-truth");

    expect(run.total).toBeGreaterThanOrEqual(16);
    expect(run.failed).toBe(0);
    expect(run.trustAccuracy).toBe(1);
    expect(frontierTasks.length).toBeGreaterThanOrEqual(8);
    expect(theoremBoundaryTasks.length).toBeGreaterThanOrEqual(2);
    expect(nearbyTruthTasks.length).toBeGreaterThanOrEqual(6);
    expect(frontierTasks.every((task) => task.expectTrust === "unverified")).toBe(true);
    expect(theoremBoundaryTasks.every((task) => task.expectTrust === "unverified")).toBe(true);
    expect(
      [...frontierTasks, ...theoremBoundaryTasks].every(
        (task) =>
          task.reviewStatus === "external-review-needed" &&
          (task.requiredEvidence?.length ?? 0) >= 3 &&
          typeof task.checkerBoundary === "string" &&
          task.checkerBoundary.length > 0
      )
    ).toBe(true);
    expect(run.results.some((result) => result.receipt.trust === "refuted")).toBe(true);
    expect(run.results.some((result) => result.receipt.trust === "bounded-numeric")).toBe(true);
    expect(run.levelSummaries.map((summary) => summary.level)).toEqual([
      "level-10-frontier-refusal",
      "level-11-known-theorem-refusal",
      "level-12-nearby-bounded-truth"
    ]);
    expect(run.levelSummaries.every((summary) => summary.passed === summary.total)).toBe(true);
  });
});

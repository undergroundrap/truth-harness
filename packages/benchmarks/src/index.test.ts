import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createPublicMathProblemCatalogHandoff, createPublicMathProblemJourney, parseBenchmarkSuite, parsePublicMathProblemCatalog, renderPublicMathProblemCatalogHandoffMarkdown, renderPublicMathProblemJourneyMarkdown, runBenchmarkSuite, summarizePublicMathProblemCatalog } from "./index.js";

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
  it("tracks solved public tasks and the next public catalog target", () => {
    const boundedSuitePath = resolve(process.cwd(), "packages/benchmarks/suites/public-problem-probes.json");
    const symbolicSuitePath = resolve(process.cwd(), "packages/benchmarks/suites/public-symbolic-probes.json");
    const catalogPath = resolve(process.cwd(), "packages/benchmarks/catalog/public-math-problem-catalog.json");
    const boundedSuite = parseBenchmarkSuite(JSON.parse(readFileSync(boundedSuitePath, "utf8")) as unknown);
    const symbolicSuite = parseBenchmarkSuite(JSON.parse(readFileSync(symbolicSuitePath, "utf8")) as unknown);
    const catalog = parsePublicMathProblemCatalog(JSON.parse(readFileSync(catalogPath, "utf8")) as unknown);
    const summary = summarizePublicMathProblemCatalog(catalog);
    const taskIdsByPath = new Map([
      ["packages/benchmarks/suites/public-problem-probes.json", new Set(boundedSuite.tasks.map((task) => task.id))],
      ["packages/benchmarks/suites/public-symbolic-probes.json", new Set(symbolicSuite.tasks.map((task) => task.id))]
    ]);

    expect(catalog.schemaVersion).toBe("truth-harness.public-math-problem-catalog.v0");
    expect(catalog.updatedAt).toBe("2026-07-03");
    expect(catalog.problems).toHaveLength(7);
    expect(summary).toMatchObject({
      totalProblems: 7,
      solved: 7,
      openGaps: 0,
      queued: 0,
      sourceNeeded: 1
    });
    expect(summary.warnings).toEqual([]);
    expect(summary.defaultCommands).toContain("npm run docker:public-probes");
    expect(summary.defaultCommands).toContain("npm run docker:public-symbolic");
    expect(summary.nextAction).toMatchObject({
      kind: "catalog-target-search",
      targetId: "public-symbolic-identity-queue",
      status: "source-needed",
      priority: 55
    });
    expect(summary.nextAction.requiredEvidence).toContain("Stable public source URL");

    const solvedProblems = catalog.problems.filter((problem) => problem.status === "solved-by-local-receipt");
    expect(solvedProblems).toHaveLength(7);
    for (const problem of solvedProblems) {
      expect(problem.suitePath).toBeTruthy();
      expect(problem.suiteTaskIds?.length).toBe(2);
      const taskIds = taskIdsByPath.get(problem.suitePath ?? "");
      expect(taskIds).toBeDefined();
      expect(problem.suiteTaskIds?.every((taskId) => taskIds?.has(taskId))).toBe(true);
    }

    const eulerProblems = solvedProblems.filter((problem) => problem.source.site === "Project Euler");
    expect(eulerProblems).toHaveLength(5);
    expect(eulerProblems.every((problem) => problem.source.url.match(/^https:\/\/projecteuler\.net\/problem=\d+$/u))).toBe(true);

    const polynomialProblem = catalog.problems.find((problem) => problem.id === "wikipedia-binomial-square-identity");
    expect(polynomialProblem).toMatchObject({
      status: "solved-by-local-receipt",
      domain: "symbolic-polynomial",
      suitePath: "packages/benchmarks/suites/public-symbolic-probes.json",
      source: {
        url: "https://en.wikipedia.org/wiki/Binomial_theorem"
      },
      trustOutcomes: ["cross-checked", "refuted"],
      verifierBackends: expect.arrayContaining(["local-sympy-subprocess", "local-maxima-symbolic-subprocess"])
    });
    const symbolicProblem = catalog.problems.find((problem) => problem.id === "wikipedia-pythagorean-trig-identity");
    expect(symbolicProblem).toMatchObject({
      status: "solved-by-local-receipt",
      domain: "symbolic-trigonometry",
      suitePath: "packages/benchmarks/suites/public-symbolic-probes.json",
      source: {
        url: "https://en.wikipedia.org/wiki/Pythagorean_trigonometric_identity"
      },
      trustOutcomes: ["cross-checked", "refuted"],
      verifierBackends: expect.arrayContaining(["local-sympy-subprocess", "local-maxima-symbolic-subprocess"])
    });
  });

  it("builds wiki-style journey stats from the public math catalog", () => {
    const catalogPath = "packages/benchmarks/catalog/public-math-problem-catalog.json";
    const catalog = parsePublicMathProblemCatalog(JSON.parse(readFileSync(resolve(process.cwd(), catalogPath), "utf8")) as unknown);
    const journey = createPublicMathProblemJourney(catalog, { generatedAt: "2026-07-03T00:00:00.000Z" });
    const markdown = renderPublicMathProblemJourneyMarkdown(journey, catalogPath);

    expect(journey).toMatchObject({
      schemaVersion: "truth-harness.public-math-journey.v0",
      generatedAt: "2026-07-03T00:00:00.000Z",
      totals: {
        totalProblems: 7,
        solved: 7,
        openGaps: 0,
        queued: 0,
        sourceNeededTargets: 1
      }
    });
    expect(journey.byTrustOutcome).toContainEqual({ trust: "exact-computed", count: 5 });
    expect(journey.byTrustOutcome).toContainEqual({ trust: "cross-checked", count: 2 });
    expect(journey.byTrustOutcome).toContainEqual({ trust: "refuted", count: 7 });
    expect(journey.bySourceSite).toContainEqual({ site: "Project Euler", total: 5, solved: 5 });
    expect(journey.bySourceSite).toContainEqual({ site: "Wikipedia", total: 2, solved: 2 });
    expect(journey.timeline).toEqual([
      {
        date: "2026-07-01",
        total: 3,
        solved: 3,
        problemIds: ["project-euler-001", "project-euler-002", "project-euler-006"]
      },
      {
        date: "2026-07-02",
        total: 2,
        solved: 2,
        problemIds: ["project-euler-048", "project-euler-053"]
      },
      {
        date: "2026-07-03",
        total: 2,
        solved: 2,
        problemIds: ["wikipedia-binomial-square-identity", "wikipedia-pythagorean-trig-identity"]
      }
    ]);
    expect(journey.problemIndex).toHaveLength(7);
    expect(journey.problemIndex.find((problem) => problem.id === "wikipedia-binomial-square-identity")?.replayCommands).toContain("npm run docker:public-symbolic");
    expect(markdown).toContain("# Public Math Journey");
    expect(markdown).toContain("| Problems tracked | 7 |");
    expect(markdown).toContain("## Problem Wiki Index");
    expect(markdown).toContain("`wikipedia-binomial-square-identity`");
    expect(markdown).toContain("This page is a tracker, not a proof certificate.");
  });
  it("renders an agent handoff for the public math catalog next action", () => {
    const catalogPath = "packages/benchmarks/catalog/public-math-problem-catalog.json";
    const catalog = parsePublicMathProblemCatalog(JSON.parse(readFileSync(resolve(process.cwd(), catalogPath), "utf8")) as unknown);
    const handoff = createPublicMathProblemCatalogHandoff(catalog, {
      catalogPath,
      generatedAt: "2026-07-03T00:00:00.000Z"
    });
    const markdown = renderPublicMathProblemCatalogHandoffMarkdown(handoff);

    expect(handoff).toMatchObject({
      schemaVersion: "truth-harness.public-math-catalog-handoff.v0",
      generatedAt: "2026-07-03T00:00:00.000Z",
      catalogPath,
      nextAction: {
        kind: "catalog-target-search",
        targetId: "public-symbolic-identity-queue",
        status: "source-needed"
      }
    });
    expect(handoff.handoffCommands).toContain(`truth-harness bench catalog ${catalogPath} --handoff`);
    expect(handoff.handoffCommands).toContain("npm run docker:public-probes");
    expect(handoff.handoffCommands).toContain("npm run docker:public-symbolic");
    expect(markdown).toContain("# Public Math Problem Catalog 2026 - Agent Handoff");
    expect(markdown).toContain("## Evidence Required");
    expect(markdown).toContain("Stable public source URL");
    expect(markdown).toContain("## Selected Catalog Target");
    expect(markdown).toContain("public-symbolic-identity-queue");
    expect(markdown).toContain("Do not promote this work beyond the listed trust labels");
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
      priority: 100
    });
    expect(summary.nextAction.requiredEvidence).toContain("Smallest verifier adapter that covers the normalized problem");
    expect(summary.nextAction.suitePath).toBeUndefined();
    expect(summary.nextAction.recommendedCommand).toBe("truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json --json");
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
  it("tracks the Millennium problems as a conservative stress-test catalog", () => {
    const suitePath = resolve(process.cwd(), "packages/benchmarks/suites/frontier-honesty-challenge.json");
    const catalogPath = "packages/benchmarks/catalog/millennium-stress-test-catalog.json";
    const suite = parseBenchmarkSuite(JSON.parse(readFileSync(suitePath, "utf8")) as unknown);
    const catalog = parsePublicMathProblemCatalog(JSON.parse(readFileSync(resolve(process.cwd(), catalogPath), "utf8")) as unknown);
    const summary = summarizePublicMathProblemCatalog(catalog);
    const taskIds = new Set(suite.tasks.map((task) => task.id));
    const journey = createPublicMathProblemJourney(catalog, { generatedAt: "2026-07-06T00:00:00.000Z" });
    const handoff = createPublicMathProblemCatalogHandoff(catalog, {
      catalogPath,
      generatedAt: "2026-07-06T00:00:00.000Z"
    });
    const markdown = renderPublicMathProblemCatalogHandoffMarkdown(handoff);

    expect(catalog).toMatchObject({
      catalogId: "millennium-stress-test-2026",
      updatedAt: "2026-07-06",
      title: "Millennium Stress Test 2026"
    });
    expect(catalog.problems).toHaveLength(7);
    expect(summary).toMatchObject({
      totalProblems: 7,
      solved: 0,
      openGaps: 7,
      queued: 0,
      sourceNeeded: 0
    });
    expect(summary.warnings).toEqual([]);
    expect(summary.defaultCommands).toContain("npm run docker:millennium-stress");
    expect(summary.nextAction).toMatchObject({
      kind: "catalog-problem-gap",
      targetId: "millennium-riemann-hypothesis",
      status: "unsupported-adapter-gap",
      priority: 100
    });
    expect(summary.nextAction.honestyBoundary).toContain("Numerical zero checks");
    expect(catalog.problems.every((problem) => problem.source.site === "Clay Mathematics Institute")).toBe(true);
    expect(catalog.problems.every((problem) => problem.source.url.startsWith("https://www.claymath.org/millennium/"))).toBe(true);
    expect(catalog.problems.every((problem) => problem.trustOutcomes?.includes("unverified"))).toBe(true);
    expect(catalog.problems.every((problem) => problem.suitePath === "packages/benchmarks/suites/frontier-honesty-challenge.json")).toBe(true);
    expect(catalog.problems.every((problem) => problem.suiteTaskIds?.every((taskId) => taskIds.has(taskId)))).toBe(true);
    expect(catalog.problems.map((problem) => problem.id)).toEqual([
      "millennium-riemann-hypothesis",
      "millennium-p-vs-np",
      "millennium-navier-stokes",
      "millennium-birch-swinnerton-dyer",
      "millennium-hodge-conjecture",
      "millennium-yang-mills-mass-gap",
      "millennium-poincare-conjecture"
    ]);
    expect(journey).toMatchObject({
      catalogId: "millennium-stress-test-2026",
      totals: {
        totalProblems: 7,
        solved: 0,
        openGaps: 7,
        queued: 0,
        sourceNeededTargets: 0
      }
    });
    expect(journey.byTrustOutcome).toContainEqual({ trust: "unverified", count: 7 });
    expect(handoff.handoffCommands).toContain(`truth-harness bench catalog ${catalogPath} --handoff`);
    expect(markdown).toContain("# Millennium Stress Test 2026 - Agent Handoff");
    expect(markdown).toContain("Do not promote this work beyond the listed trust labels");
  });
  it("keeps the frontier honesty challenge humble on famous hard problems", () => {
    const suitePath = resolve(process.cwd(), "packages/benchmarks/suites/frontier-honesty-challenge.json");
    const suite = parseBenchmarkSuite(JSON.parse(readFileSync(suitePath, "utf8")) as unknown);

    const run = runBenchmarkSuite(suite);
    const frontierTasks = suite.tasks.filter((task) => task.level === "level-10-frontier-refusal");
    const theoremBoundaryTasks = suite.tasks.filter((task) => task.level === "level-11-known-theorem-refusal");
    const nearbyTruthTasks = suite.tasks.filter((task) => task.level === "level-12-nearby-bounded-truth");

    expect(run.total).toBeGreaterThanOrEqual(19);
    expect(run.failed).toBe(0);
    expect(run.trustAccuracy).toBe(1);
    expect(frontierTasks.length).toBeGreaterThanOrEqual(9);
    expect(theoremBoundaryTasks.length).toBeGreaterThanOrEqual(3);
    expect(nearbyTruthTasks.length).toBeGreaterThanOrEqual(6);
    expect(frontierTasks.map((task) => task.id)).toEqual(
      expect.arrayContaining([
        "unsupported-riemann-hypothesis",
        "unsupported-p-versus-np",
        "unsupported-navier-stokes",
        "unsupported-birch-swinnerton-dyer",
        "unsupported-hodge-conjecture",
        "unsupported-yang-mills-mass-gap"
      ])
    );
    expect(theoremBoundaryTasks.map((task) => task.id)).toContain("poincare-known-solved-without-local-proof");
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

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  benchmarkComparisonFailsGate,
  benchmarkRunFailsGate,
  createBenchmarkComparisonRecord,
  createBenchmarkRunRecord,
  listBenchmarkArtifacts,
  listBenchmarkComparisonRecords,
  listBenchmarkRunRecords,
  parseBenchmarkRunRecordJson,
  writeBenchmarkComparisonRecord,
  writeBenchmarkRunRecord
} from "./benchmark-run.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { createReceipt } from "./receipt.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("benchmark run records", () => {
  it("requires a local workspace before writing benchmark provenance", async () => {
    const root = await tempRoot();
    const receipt = createReceipt("compute 2 + 2");

    await expect(
      createBenchmarkRunRecord({
        rootPath: root,
        run: benchmarkRun(receipt)
      })
    ).rejects.toThrow("No Truth Harness workspace found");
  });

  it("writes local benchmark run records with replay and validation boundaries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Benchmark Lab",
      now: "2026-06-10T00:00:00.000Z"
    });
    const receipt = createReceipt("compute 2 + 2");

    const result = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt),
      suiteDescription: "Tiny local regression suite.",
      suitePath: "packages/benchmarks/suites/tiny.json",
      runnerName: "vitest",
      runnerAdapter: "local-receipt-engine",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json",
      workingDirectory: root,
      now: "2026-06-10T01:00:00.000Z"
    });
    const records = await listBenchmarkRunRecords(root);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(result.jsonPath).toContain(join(".truth-harness", "benchmarks"));
    expect(result.markdownPath).toContain(join(".truth-harness", "benchmarks"));
    expect(result.record.schemaVersion).toBe("truth-harness.benchmark-run.v0");
    expect(result.record.benchmarkRunId).toMatch(/^bench_[a-f0-9]{16}$/);
    expect(result.record.privacy.mode).toBe("local-only");
    expect(result.record.verificationBoundary.executionPerformedByWorkbench).toBe(true);
    expect(result.record.verificationBoundary.benchmarkRunIsNotTruth).toBe(true);
    expect(benchmarkRunFailsGate(result.record)).toBe(false);
    expect(result.record.cases[0]?.receiptRunId).toBe(receipt.runId);
    expect(result.record.cases[0]?.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.record.cases[0]).toMatchObject({
      level: "level-1-exact-arithmetic",
      category: "exact-computation",
      aiFailureMode: "wrong arithmetic",
      expectedEvidenceKind: "exact-arithmetic",
      evidenceKind: "exact-arithmetic"
    });
    expect(result.record.levels).toEqual([
      {
        level: "level-1-exact-arithmetic",
        total: 1,
        passed: 1,
        failed: 0,
        trustAccuracy: 1
      }
    ]);
    expect(result.markdown).toContain("## Replay");
    expect(result.markdown).toContain("## Levels");
    expect(result.markdown).toContain("level-1-exact-arithmetic");
    expect(result.markdown).toContain("level=level-1-exact-arithmetic");
    expect(result.markdown).toContain("category=exact-computation");
    expect(result.markdown).toContain("expected-evidence=exact-arithmetic");
    expect(parseBenchmarkRunRecordJson(JSON.stringify(result.record), "roundtrip").benchmarkRunId).toBe(
      result.record.benchmarkRunId
    );
    expect(() => parseBenchmarkRunRecordJson(JSON.stringify({ schemaVersion: "truth-harness.legacy.v0" }), "legacy")).toThrow(
      "truth-harness.benchmark-run.v0"
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.benchmarkRunId).toBe(result.record.benchmarkRunId);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.benchmarks).toBe(1);
  });

  it("writes benchmark comparison records that flag regressions", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Benchmark Compare Lab",
      now: "2026-06-10T00:00:00.000Z"
    });
    const receipt = createReceipt("compute 2 + 2");
    const baseline = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt),
      suitePath: "packages/benchmarks/suites/tiny.json",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json",
      now: "2026-06-10T01:00:00.000Z"
    });
    const current = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt, {
        expectTrust: "refuted",
        passed: false,
        failures: ["Expected trust refuted, received exact-computed"]
      }),
      suitePath: "packages/benchmarks/suites/tiny.json",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json",
      now: "2026-06-10T01:05:00.000Z"
    });

    const preview = createBenchmarkComparisonRecord({
      baseline: baseline.record,
      current: current.record,
      baselineRef: baseline.jsonPath,
      currentRef: current.jsonPath,
      now: "2026-06-10T01:10:00.000Z"
    });
    const written = await writeBenchmarkComparisonRecord({
      rootPath: root,
      baseline: baseline.record,
      current: current.record,
      baselineRef: baseline.jsonPath,
      currentRef: current.jsonPath,
      now: "2026-06-10T01:10:00.000Z"
    });
    const artifacts = await listBenchmarkArtifacts(root);
    const comparisons = await listBenchmarkComparisonRecords(root);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(preview.verdict).toBe("regressed");
    expect(written.record.schemaVersion).toBe("truth-harness.benchmark-comparison.v0");
    expect(written.record.verdict).toBe("regressed");
    expect(benchmarkComparisonFailsGate(written.record)).toBe(true);
    expect(written.record.summary.regressions).toBe(1);
    expect(written.record.summary.failedDelta).toBe(1);
    expect(written.record.cases[0]?.status).toBe("regression");
    expect(written.record.boundary.benchmarkComparisonIsNotTruth).toBe(true);
    expect(written.markdown).toContain("## Case Changes");
    expect(artifacts).toHaveLength(3);
    expect(artifacts.map((artifact) => artifact.kind).sort()).toEqual(["comparison", "run", "run"]);
    expect(artifacts.find((artifact) => artifact.kind === "comparison")?.path).toContain(".truth-harness/benchmarks/");
    expect(artifacts.find((artifact) => artifact.artifactId === current.record.benchmarkRunId)).toMatchObject({
      replayCommand: "truth-harness bench run packages/benchmarks/suites/tiny.json",
      replaySuitePath: "packages/benchmarks/suites/tiny.json",
      deterministic: true,
      receiptRunIds: [receipt.runId],
      receiptReplays: [receipt.replay],
      failedCaseIds: ["tiny-case"],
      requiredNextChecks: expect.arrayContaining(["fix or explicitly triage failing benchmark cases"])
    });
    expect(comparisons).toHaveLength(1);
    expect(comparisons[0]?.comparisonId).toBe(written.record.comparisonId);
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.benchmarks).toBe(3);
  });

  it("validates benchmark run JSON before writing sidecars", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Benchmark Lab",
      now: "2026-06-10T00:00:00.000Z"
    });
    const receipt = createReceipt("compute 2 + 2");

    await expect(
      writeBenchmarkRunRecord({
        rootPath: root,
        run: benchmarkRun(receipt),
        now: "not-a-date"
      })
    ).rejects.toThrow("$.createdAt must be a valid date-time string");

    await expect(listBenchmarkArtifacts(root)).resolves.toEqual([]);
  });

  it("validates benchmark comparison JSON before writing sidecars", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Benchmark Compare Lab",
      now: "2026-06-10T00:00:00.000Z"
    });
    const receipt = createReceipt("compute 2 + 2");
    const baseline = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt),
      suitePath: "packages/benchmarks/suites/tiny.json",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json",
      now: "2026-06-10T01:00:00.000Z"
    });
    const current = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt),
      suitePath: "packages/benchmarks/suites/tiny.json",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json",
      now: "2026-06-10T01:05:00.000Z"
    });

    await expect(
      writeBenchmarkComparisonRecord({
        rootPath: root,
        baseline: baseline.record,
        current: current.record,
        baselineRef: baseline.jsonPath,
        currentRef: current.jsonPath,
        now: "not-a-date"
      })
    ).rejects.toThrow("$.createdAt must be a valid date-time string");

    await expect(listBenchmarkComparisonRecords(root)).resolves.toEqual([]);
    await expect(listBenchmarkArtifacts(root)).resolves.toHaveLength(2);
  });

  it("warns when benchmark replay metadata is incomplete", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const receipt = createReceipt("integrate x^2 from 0 to 1");

    const record = await createBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt, {
        expectTrust: "exact-computed",
        passed: false,
        failures: ["Expected trust exact-computed, received unverified"]
      })
    });

    expect(record.warnings).toContain("This benchmark run contains failed cases or less than perfect trust accuracy.");
    expect(benchmarkRunFailsGate(record)).toBe(true);
    expect(record.warnings).toContain("No benchmark suite path was recorded.");
    expect(record.warnings).toContain("No replay command was recorded.");
    expect(record.verificationBoundary.requiredNextChecks).toContain("fix or explicitly triage failing benchmark cases");
  });
});

function benchmarkRun(
  receipt: ReturnType<typeof createReceipt>,
  options: { expectTrust?: ReturnType<typeof createReceipt>["trust"]; passed?: boolean; failures?: string[] } = {}
) {
  const expectedTrust = options.expectTrust ?? receipt.trust;
  const passed = options.passed ?? true;

  return {
    suiteId: "tiny-suite",
    title: "Tiny Suite",
    startedAt: "2026-06-10T00:30:00.000Z",
    completedAt: "2026-06-10T00:30:01.000Z",
    total: 1,
    passed: passed ? 1 : 0,
    failed: passed ? 0 : 1,
    trustAccuracy: passed ? 1 : 0,
    results: [
      {
        task: {
          id: "tiny-case",
          prompt: receipt.problem,
          expectTrust: expectedTrust,
          expectEvidenceKind: receipt.evidenceProfile.kind,
          level: "level-1-exact-arithmetic",
          category: "exact-computation",
          aiFailureMode: "wrong arithmetic"
        },
        receipt,
        passed,
        failures: options.failures ?? []
      }
    ]
  };
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-benchmark-"));
  roots.push(root);
  return root;
}

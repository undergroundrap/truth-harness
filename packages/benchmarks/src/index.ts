import { createReceipt, type Receipt, type TrustLabel } from "@truth-harness/core";

export type BenchmarkEvidenceKind = Receipt["evidenceProfile"]["kind"];

export interface BenchmarkTask {
  id: string;
  prompt: string;
  expectTrust: TrustLabel;
  expectSummaryIncludes?: string;
  expectEvidenceKind?: BenchmarkEvidenceKind;
  level?: string;
  category?: string;
  aiFailureMode?: string;
}

export interface BenchmarkSuite {
  id: string;
  title: string;
  description: string;
  tasks: BenchmarkTask[];
}

export interface BenchmarkTaskResult {
  task: BenchmarkTask;
  receipt: Receipt;
  passed: boolean;
  failures: string[];
}

export interface BenchmarkLevelSummary {
  level: string;
  total: number;
  passed: number;
  failed: number;
  trustAccuracy: number;
}

export interface BenchmarkRun {
  suiteId: string;
  title: string;
  startedAt: string;
  completedAt: string;
  total: number;
  passed: number;
  failed: number;
  trustAccuracy: number;
  levelSummaries: BenchmarkLevelSummary[];
  results: BenchmarkTaskResult[];
}

export function parseBenchmarkSuite(raw: unknown): BenchmarkSuite {
  if (!raw || typeof raw !== "object") {
    throw new Error("Benchmark suite must be an object");
  }

  const suite = raw as Partial<BenchmarkSuite>;
  if (typeof suite.id !== "string" || typeof suite.title !== "string" || typeof suite.description !== "string") {
    throw new Error("Benchmark suite requires id, title, and description");
  }

  if (!Array.isArray(suite.tasks)) {
    throw new Error("Benchmark suite requires tasks");
  }

  return {
    id: suite.id,
    title: suite.title,
    description: suite.description,
    tasks: suite.tasks.map((task, index) => parseBenchmarkTask(task, index))
  };
}

export function runBenchmarkSuite(suite: BenchmarkSuite): BenchmarkRun {
  const startedAt = new Date().toISOString();
  const results = suite.tasks.map(runTask);
  const passed = results.filter((result) => result.passed).length;
  const completedAt = new Date().toISOString();

  return {
    suiteId: suite.id,
    title: suite.title,
    startedAt,
    completedAt,
    total: results.length,
    passed,
    failed: results.length - passed,
    trustAccuracy: results.length === 0 ? 1 : passed / results.length,
    levelSummaries: summarizeLevels(results),
    results
  };
}

function runTask(task: BenchmarkTask): BenchmarkTaskResult {
  const receipt = createReceipt(task.prompt);
  const failures: string[] = [];

  if (!trustSatisfiesExpectation(receipt.trust, task.expectTrust)) {
    failures.push(`Expected trust ${task.expectTrust}, received ${receipt.trust}`);
  }

  if (task.expectSummaryIncludes && !receipt.summary.includes(task.expectSummaryIncludes)) {
    failures.push(`Expected summary to include ${JSON.stringify(task.expectSummaryIncludes)}`);
  }

  if (task.expectEvidenceKind && receipt.evidenceProfile.kind !== task.expectEvidenceKind) {
    failures.push(`Expected evidence kind ${task.expectEvidenceKind}, received ${receipt.evidenceProfile.kind}`);
  }

  return {
    task,
    receipt,
    passed: failures.length === 0,
    failures
  };
}

function trustSatisfiesExpectation(actual: TrustLabel, expected: TrustLabel): boolean {
  if (actual === expected) {
    return true;
  }

  return expected === "exact-computed" && actual === "cross-checked";
}

function parseBenchmarkTask(raw: unknown, index: number): BenchmarkTask {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Task ${index} must be an object`);
  }

  const task = raw as Partial<BenchmarkTask>;
  if (typeof task.id !== "string" || typeof task.prompt !== "string" || typeof task.expectTrust !== "string") {
    throw new Error(`Task ${index} requires id, prompt, and expectTrust`);
  }

  return {
    id: task.id,
    prompt: task.prompt,
    expectTrust: task.expectTrust as TrustLabel,
    expectSummaryIncludes: task.expectSummaryIncludes,
    expectEvidenceKind: parseOptionalString(task.expectEvidenceKind, `Task ${index} expectEvidenceKind`) as BenchmarkEvidenceKind | undefined,
    level: parseOptionalString(task.level, `Task ${index} level`),
    category: parseOptionalString(task.category, `Task ${index} category`),
    aiFailureMode: parseOptionalString(task.aiFailureMode, `Task ${index} aiFailureMode`)
  };
}

function summarizeLevels(results: BenchmarkTaskResult[]): BenchmarkLevelSummary[] {
  const order: string[] = [];
  const summaries = new Map<string, { total: number; passed: number }>();

  for (const result of results) {
    const level = result.task.level ?? result.task.category ?? "uncategorized";
    const current = summaries.get(level);
    if (!current) {
      order.push(level);
      summaries.set(level, { total: 1, passed: result.passed ? 1 : 0 });
      continue;
    }

    current.total += 1;
    if (result.passed) {
      current.passed += 1;
    }
  }

  return order.sort(compareLevelLabels).map((level) => {
    const summary = summaries.get(level);
    const total = summary?.total ?? 0;
    const passed = summary?.passed ?? 0;

    return {
      level,
      total,
      passed,
      failed: total - passed,
      trustAccuracy: total === 0 ? 1 : passed / total
    };
  });
}

function compareLevelLabels(left: string, right: string): number {
  const leftOrdinal = parseLevelOrdinal(left);
  const rightOrdinal = parseLevelOrdinal(right);
  if (leftOrdinal !== undefined && rightOrdinal !== undefined && leftOrdinal !== rightOrdinal) {
    return leftOrdinal - rightOrdinal;
  }
  if (leftOrdinal !== undefined && rightOrdinal === undefined) {
    return -1;
  }
  if (leftOrdinal === undefined && rightOrdinal !== undefined) {
    return 1;
  }

  return 0;
}

function parseLevelOrdinal(value: string): number | undefined {
  const match = /^level-(\d+)/u.exec(value);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function parseOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string when provided`);
  }

  return value;
}

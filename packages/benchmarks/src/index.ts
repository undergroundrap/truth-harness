import { createReceipt, type Receipt, type TrustLabel } from "@truth-harness/core";

export interface BenchmarkTask {
  id: string;
  prompt: string;
  expectTrust: TrustLabel;
  expectSummaryIncludes?: string;
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

export interface BenchmarkRun {
  suiteId: string;
  title: string;
  startedAt: string;
  completedAt: string;
  total: number;
  passed: number;
  failed: number;
  trustAccuracy: number;
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
    expectSummaryIncludes: task.expectSummaryIncludes
  };
}

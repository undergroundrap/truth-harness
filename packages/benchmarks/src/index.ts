import { createReceipt, type Receipt, type TrustLabel } from "@truth-harness/core";

export type BenchmarkEvidenceKind = Receipt["evidenceProfile"]["kind"];
export type BenchmarkTaskReviewStatus = "unreviewed" | "self-reviewed" | "external-review-needed" | "external-reviewed";

export interface BenchmarkTask {
  id: string;
  prompt: string;
  expectTrust: TrustLabel;
  expectSummaryIncludes?: string;
  expectEvidenceKind?: BenchmarkEvidenceKind;
  level?: string;
  category?: string;
  aiFailureMode?: string;
  reviewStatus?: BenchmarkTaskReviewStatus;
  requiredEvidence?: string[];
  checkerBoundary?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  firstLoggedAt?: string;
}

export interface BenchmarkSuite {
  id: string;
  title: string;
  description: string;
  tasks: BenchmarkTask[];
}

export type PublicMathProblemStatus =
  | "solved-by-local-receipt"
  | "unsupported-adapter-gap"
  | "queued"
  | "source-needed"
  | "external-review-needed";

export interface PublicMathProblemSource {
  site: string;
  title: string;
  url: string;
  accessedAt: string;
}

export interface PublicMathProblemCatalogEntry {
  id: string;
  firstLoggedAt: string;
  source: PublicMathProblemSource;
  status: PublicMathProblemStatus;
  domain: string;
  suitePath?: string;
  suiteTaskIds?: string[];
  verifierBackends?: string[];
  trustOutcomes?: TrustLabel[];
  resultSummary?: string;
  requiredEvidence?: string[];
  checkerBoundary?: string;
}

export interface PublicMathProblemCatalogTarget {
  id: string;
  status: "source-needed" | "queued" | "adapter-needed" | "external-review-needed";
  goal: string;
}

export interface PublicMathProblemCatalog {
  schemaVersion: "truth-harness.public-math-problem-catalog.v0";
  catalogId: string;
  title: string;
  updatedAt: string;
  purpose: string;
  workflow: {
    stages: string[];
    defaultCommands: string[];
  };
  suiteRefs: Array<{ suiteId: string; path: string; description?: string }>;
  problems: PublicMathProblemCatalogEntry[];
  nextTargets: PublicMathProblemCatalogTarget[];
  honestyBoundary: string;
}

export interface PublicMathProblemCatalogSummary {
  catalogId: string;
  title: string;
  updatedAt: string;
  totalProblems: number;
  solved: number;
  openGaps: number;
  queued: number;
  sourceNeeded: number;
  suiteRefs: Array<{ suiteId: string; path: string }>;
  defaultCommands: string[];
  problems: Array<{
    id: string;
    status: PublicMathProblemStatus;
    domain: string;
    sourceTitle: string;
    sourceUrl: string;
    resultSummary?: string;
    suiteTaskIds: string[];
    verifierBackends: string[];
    trustOutcomes: string[];
  }>;
  nextTargets: PublicMathProblemCatalogTarget[];
  warnings: string[];
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

export function parsePublicMathProblemCatalog(raw: unknown): PublicMathProblemCatalog {
  if (!raw || typeof raw !== "object") {
    throw new Error("Public math problem catalog must be an object");
  }

  const catalog = raw as Partial<PublicMathProblemCatalog>;
  if (catalog.schemaVersion !== "truth-harness.public-math-problem-catalog.v0") {
    throw new Error("Public math problem catalog requires schemaVersion truth-harness.public-math-problem-catalog.v0");
  }
  if (
    typeof catalog.catalogId !== "string" ||
    typeof catalog.title !== "string" ||
    typeof catalog.updatedAt !== "string" ||
    typeof catalog.purpose !== "string" ||
    typeof catalog.honestyBoundary !== "string"
  ) {
    throw new Error("Public math problem catalog requires catalogId, title, updatedAt, purpose, and honestyBoundary");
  }
  if (!catalog.workflow || typeof catalog.workflow !== "object") {
    throw new Error("Public math problem catalog requires workflow");
  }
  if (!Array.isArray(catalog.suiteRefs) || !Array.isArray(catalog.problems) || !Array.isArray(catalog.nextTargets)) {
    throw new Error("Public math problem catalog requires suiteRefs, problems, and nextTargets arrays");
  }

  return {
    schemaVersion: "truth-harness.public-math-problem-catalog.v0",
    catalogId: catalog.catalogId,
    title: catalog.title,
    updatedAt: catalog.updatedAt,
    purpose: catalog.purpose,
    workflow: parseCatalogWorkflow(catalog.workflow),
    suiteRefs: catalog.suiteRefs.map(parseCatalogSuiteRef),
    problems: catalog.problems.map(parseCatalogProblem),
    nextTargets: catalog.nextTargets.map(parseCatalogTarget),
    honestyBoundary: catalog.honestyBoundary
  };
}

export function summarizePublicMathProblemCatalog(catalog: PublicMathProblemCatalog): PublicMathProblemCatalogSummary {
  const warnings: string[] = [];
  const solved = catalog.problems.filter((problem) => problem.status === "solved-by-local-receipt").length;
  const openGaps = catalog.problems.filter((problem) => problem.status === "unsupported-adapter-gap" || problem.status === "external-review-needed").length;
  const queued = catalog.problems.filter((problem) => problem.status === "queued").length;
  const sourceNeeded = catalog.nextTargets.filter((target) => target.status === "source-needed").length;

  if (catalog.problems.length === 0) {
    warnings.push("No public problems are recorded yet.");
  }
  for (const problem of catalog.problems) {
    if (!problem.suitePath || (problem.suiteTaskIds?.length ?? 0) === 0) {
      warnings.push(`${problem.id} has no runnable suite task refs yet.`);
    }
    if (problem.status === "solved-by-local-receipt" && (problem.verifierBackends?.length ?? 0) === 0) {
      warnings.push(`${problem.id} is marked solved without verifier backend metadata.`);
    }
  }

  return {
    catalogId: catalog.catalogId,
    title: catalog.title,
    updatedAt: catalog.updatedAt,
    totalProblems: catalog.problems.length,
    solved,
    openGaps,
    queued,
    sourceNeeded,
    suiteRefs: catalog.suiteRefs.map((suite) => ({ suiteId: suite.suiteId, path: suite.path })),
    defaultCommands: catalog.workflow.defaultCommands,
    problems: catalog.problems.map((problem) => ({
      id: problem.id,
      status: problem.status,
      domain: problem.domain,
      sourceTitle: problem.source.title,
      sourceUrl: problem.source.url,
      resultSummary: problem.resultSummary,
      suiteTaskIds: problem.suiteTaskIds ?? [],
      verifierBackends: problem.verifierBackends ?? [],
      trustOutcomes: problem.trustOutcomes ?? []
    })),
    nextTargets: catalog.nextTargets,
    warnings
  };
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
    aiFailureMode: parseOptionalString(task.aiFailureMode, `Task ${index} aiFailureMode`),
    reviewStatus: parseReviewStatus(task.reviewStatus, index),
    requiredEvidence: parseOptionalStringArray(task.requiredEvidence, `Task ${index} requiredEvidence`),
    checkerBoundary: parseOptionalString(task.checkerBoundary, `Task ${index} checkerBoundary`),
    sourceUrl: parseOptionalString(task.sourceUrl, `Task ${index} sourceUrl`),
    sourceTitle: parseOptionalString(task.sourceTitle, `Task ${index} sourceTitle`),
    firstLoggedAt: parseOptionalString(task.firstLoggedAt, `Task ${index} firstLoggedAt`)
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

function parseCatalogWorkflow(value: unknown): PublicMathProblemCatalog["workflow"] {
  if (!value || typeof value !== "object") {
    throw new Error("Public math problem catalog workflow must be an object");
  }
  const workflow = value as Partial<PublicMathProblemCatalog["workflow"]>;
  return {
    stages: parseRequiredStringArray(workflow.stages, "workflow.stages"),
    defaultCommands: parseRequiredStringArray(workflow.defaultCommands, "workflow.defaultCommands")
  };
}

function parseCatalogSuiteRef(value: unknown, index: number): PublicMathProblemCatalog["suiteRefs"][number] {
  if (!value || typeof value !== "object") {
    throw new Error(`Catalog suiteRef ${index} must be an object`);
  }
  const suite = value as Partial<PublicMathProblemCatalog["suiteRefs"][number]>;
  if (typeof suite.suiteId !== "string" || typeof suite.path !== "string") {
    throw new Error(`Catalog suiteRef ${index} requires suiteId and path`);
  }
  return {
    suiteId: suite.suiteId,
    path: suite.path,
    description: parseOptionalString(suite.description, `Catalog suiteRef ${index} description`)
  };
}

function parseCatalogProblem(value: unknown, index: number): PublicMathProblemCatalogEntry {
  if (!value || typeof value !== "object") {
    throw new Error(`Catalog problem ${index} must be an object`);
  }
  const problem = value as Partial<PublicMathProblemCatalogEntry>;
  if (
    typeof problem.id !== "string" ||
    typeof problem.firstLoggedAt !== "string" ||
    typeof problem.domain !== "string" ||
    typeof problem.status !== "string"
  ) {
    throw new Error(`Catalog problem ${index} requires id, firstLoggedAt, domain, and status`);
  }

  return {
    id: problem.id,
    firstLoggedAt: problem.firstLoggedAt,
    source: parseCatalogSource(problem.source, index),
    status: parsePublicMathProblemStatus(problem.status, `Catalog problem ${index} status`),
    domain: problem.domain,
    suitePath: parseOptionalString(problem.suitePath, `Catalog problem ${index} suitePath`),
    suiteTaskIds: parseOptionalStringArray(problem.suiteTaskIds, `Catalog problem ${index} suiteTaskIds`),
    verifierBackends: parseOptionalStringArray(problem.verifierBackends, `Catalog problem ${index} verifierBackends`),
    trustOutcomes: parseOptionalTrustArray(problem.trustOutcomes, `Catalog problem ${index} trustOutcomes`),
    resultSummary: parseOptionalString(problem.resultSummary, `Catalog problem ${index} resultSummary`),
    requiredEvidence: parseOptionalStringArray(problem.requiredEvidence, `Catalog problem ${index} requiredEvidence`),
    checkerBoundary: parseOptionalString(problem.checkerBoundary, `Catalog problem ${index} checkerBoundary`)
  };
}

function parseCatalogSource(value: unknown, index: number): PublicMathProblemSource {
  if (!value || typeof value !== "object") {
    throw new Error(`Catalog problem ${index} source must be an object`);
  }
  const source = value as Partial<PublicMathProblemSource>;
  if (
    typeof source.site !== "string" ||
    typeof source.title !== "string" ||
    typeof source.url !== "string" ||
    typeof source.accessedAt !== "string"
  ) {
    throw new Error(`Catalog problem ${index} source requires site, title, url, and accessedAt`);
  }
  return {
    site: source.site,
    title: source.title,
    url: source.url,
    accessedAt: source.accessedAt
  };
}

function parseCatalogTarget(value: unknown, index: number): PublicMathProblemCatalogTarget {
  if (!value || typeof value !== "object") {
    throw new Error(`Catalog target ${index} must be an object`);
  }
  const target = value as Partial<PublicMathProblemCatalogTarget>;
  if (typeof target.id !== "string" || typeof target.status !== "string" || typeof target.goal !== "string") {
    throw new Error(`Catalog target ${index} requires id, status, and goal`);
  }
  if (
    target.status !== "source-needed" &&
    target.status !== "queued" &&
    target.status !== "adapter-needed" &&
    target.status !== "external-review-needed"
  ) {
    throw new Error(`Catalog target ${index} has unsupported status ${JSON.stringify(target.status)}.`);
  }
  return {
    id: target.id,
    status: target.status,
    goal: target.goal
  };
}

function parsePublicMathProblemStatus(value: string, field: string): PublicMathProblemStatus {
  if (
    value === "solved-by-local-receipt" ||
    value === "unsupported-adapter-gap" ||
    value === "queued" ||
    value === "source-needed" ||
    value === "external-review-needed"
  ) {
    return value;
  }
  throw new Error(`${field} has unsupported status ${JSON.stringify(value)}.`);
}

function parseOptionalTrustArray(value: unknown, field: string): TrustLabel[] | undefined {
  const values = parseOptionalStringArray(value, field);
  if (!values) {
    return undefined;
  }
  for (const entry of values) {
    if (!isTrustLabel(entry)) {
      throw new Error(`${field} contains unsupported trust label ${JSON.stringify(entry)}.`);
    }
  }
  return values as TrustLabel[];
}

function isTrustLabel(value: string): value is TrustLabel {
  return (
    value === "proved" ||
    value === "exact-computed" ||
    value === "bounded-numeric" ||
    value === "smt-checked" ||
    value === "dimension-checked" ||
    value === "source-cited" ||
    value === "cross-checked" ||
    value === "unverified" ||
    value === "refuted"
  );
}

function parseRequiredStringArray(value: unknown, field: string): string[] {
  const parsed = parseOptionalStringArray(value, field);
  if (!parsed || parsed.length === 0) {
    throw new Error(`${field} must contain at least one string`);
  }
  return parsed;
}
function parseReviewStatus(value: unknown, index: number): BenchmarkTaskReviewStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    value === "unreviewed" ||
    value === "self-reviewed" ||
    value === "external-review-needed" ||
    value === "external-reviewed"
  ) {
    return value;
  }

  throw new Error(`Task ${index} has unsupported reviewStatus ${JSON.stringify(value)}`);
}

function parseOptionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array when provided`);
  }
  const normalized = value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`${field}[${index}] must be a string`);
    }
    return entry.trim();
  }).filter((entry) => entry.length > 0);

  return normalized.length > 0 ? normalized : undefined;
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

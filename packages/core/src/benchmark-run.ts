import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, Receipt, TrustLabel } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export interface BenchmarkRunTaskLike {
  id: string;
  prompt: string;
  expectTrust: TrustLabel;
  expectSummaryIncludes?: string;
  expectEvidenceKind?: Receipt["evidenceProfile"]["kind"];
  category?: string;
  aiFailureMode?: string;
}

export interface BenchmarkRunTaskResultLike {
  task: BenchmarkRunTaskLike;
  receipt: Pick<Receipt, "runId" | "createdAt" | "trust" | "summary" | "replay" | "privacy" | "evidenceProfile">;
  passed: boolean;
  failures: string[];
}

export interface BenchmarkRunLike {
  suiteId: string;
  title: string;
  startedAt: string;
  completedAt: string;
  total: number;
  passed: number;
  failed: number;
  trustAccuracy: number;
  results: BenchmarkRunTaskResultLike[];
}

export interface BenchmarkRunCaseRecord {
  taskId: string;
  prompt: string;
  category?: string;
  aiFailureMode?: string;
  expectedTrust: TrustLabel;
  expectedSummaryIncludes?: string;
  expectedEvidenceKind?: Receipt["evidenceProfile"]["kind"];
  actualTrust: TrustLabel;
  receiptRunId: string;
  receiptCreatedAt: string;
  receiptSummary: string;
  receiptReplay: string;
  receiptHash: string;
  evidenceKind: string;
  backendIds: string[];
  proofCheckerBacked: boolean;
  receiptReplayable: boolean;
  passed: boolean;
  failures: string[];
}

export interface BenchmarkRunRecord {
  schemaVersion: "truth-harness.benchmark-run.v0";
  benchmarkRunId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  suite: {
    suiteId: string;
    title: string;
    description?: string;
    path?: string;
  };
  runner: {
    name: string;
    adapter: string;
    version?: string;
  };
  command?: string;
  workingDirectory?: string;
  startedAt: string;
  completedAt: string;
  totals: {
    total: number;
    passed: number;
    failed: number;
    trustAccuracy: number;
  };
  cases: BenchmarkRunCaseRecord[];
  replay: {
    command?: string;
    suitePath?: string;
    deterministic: boolean;
    requiresManualReplay: boolean;
    notes: string[];
  };
  verificationBoundary: {
    executionPerformedByWorkbench: true;
    benchmarkMeasuresSystemBehavior: true;
    benchmarkRunIsNotTruth: true;
    receiptsRetainOwnTrustLabels: true;
    requiresIndependentSuiteReview: boolean;
    requiresRegressionComparison: boolean;
    requiredNextChecks: string[];
  };
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface CreateBenchmarkRunRecordInput {
  rootPath: string;
  run: BenchmarkRunLike;
  suiteDescription?: string;
  suitePath?: string;
  runnerName?: string;
  runnerAdapter?: string;
  runnerVersion?: string;
  command?: string;
  workingDirectory?: string;
  nextChecks?: string[];
  replayNotes?: string[];
  now?: string;
}

export interface BenchmarkRunWriteResult {
  record: BenchmarkRunRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export type BenchmarkComparisonVerdict = "improved" | "regressed" | "changed" | "unchanged" | "incomparable";
export type BenchmarkCaseComparisonStatus =
  | "unchanged-pass"
  | "unchanged-fail"
  | "regression"
  | "improvement"
  | "changed-trust"
  | "changed-receipt"
  | "added"
  | "removed";

export interface BenchmarkComparisonCaseSnapshot {
  prompt: string;
  expectedTrust: TrustLabel;
  actualTrust: TrustLabel;
  passed: boolean;
  receiptRunId: string;
  receiptHash: string;
  receiptSummary: string;
  failures: string[];
}

export interface BenchmarkComparisonCase {
  taskId: string;
  status: BenchmarkCaseComparisonStatus;
  baseline?: BenchmarkComparisonCaseSnapshot;
  current?: BenchmarkComparisonCaseSnapshot;
  warnings: string[];
}

export interface BenchmarkComparisonRecord {
  schemaVersion: "truth-harness.benchmark-comparison.v0";
  comparisonId: string;
  projectId: string;
  createdAt: string;
  baseline: BenchmarkComparisonRunSummary;
  current: BenchmarkComparisonRunSummary;
  verdict: BenchmarkComparisonVerdict;
  summary: {
    comparable: boolean;
    totalDelta: number;
    passedDelta: number;
    failedDelta: number;
    trustAccuracyDelta: number;
    regressions: number;
    improvements: number;
    changedTrust: number;
    changedReceipts: number;
    addedCases: number;
    removedCases: number;
    unchanged: number;
  };
  cases: BenchmarkComparisonCase[];
  boundary: {
    comparesRecordedRunsOnly: true;
    benchmarkComparisonIsNotTruth: true;
    requiresHumanReviewForClaims: true;
    requiredNextChecks: string[];
  };
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface BenchmarkComparisonRunSummary {
  benchmarkRunId: string;
  ref?: string;
  suiteId: string;
  title: string;
  createdAt: string;
  runnerName: string;
  runnerAdapter: string;
  total: number;
  passed: number;
  failed: number;
  trustAccuracy: number;
}

export interface CreateBenchmarkComparisonRecordInput {
  baseline: BenchmarkRunRecord;
  current: BenchmarkRunRecord;
  baselineRef?: string;
  currentRef?: string;
  projectId?: string;
  privacy?: PrivacyMetadata;
  now?: string;
}

export interface WriteBenchmarkComparisonRecordInput extends CreateBenchmarkComparisonRecordInput {
  rootPath: string;
}

export interface BenchmarkComparisonWriteResult {
  record: BenchmarkComparisonRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export type BenchmarkArtifactSummaryKind = "run" | "comparison";

export interface BenchmarkArtifactSummary {
  kind: BenchmarkArtifactSummaryKind;
  path: string;
  schemaVersion: "truth-harness.benchmark-run.v0" | "truth-harness.benchmark-comparison.v0";
  artifactId: string;
  createdAt: string;
  suiteId: string;
  title: string;
  passed?: number;
  failed?: number;
  total?: number;
  trustAccuracy?: number;
  verdict?: BenchmarkComparisonVerdict;
  baselineRunId?: string;
  currentRunId?: string;
  warnings: string[];
}

export function benchmarkRunFailsGate(run: BenchmarkRunLike | BenchmarkRunRecord): boolean {
  return benchmarkRunFailedCount(run) > 0;
}

export function benchmarkComparisonFailsGate(comparison: BenchmarkComparisonRecord): boolean {
  return comparison.verdict === "regressed" || comparison.verdict === "incomparable";
}

export async function createBenchmarkRunRecord(input: CreateBenchmarkRunRecordInput): Promise<BenchmarkRunRecord> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const suitePath = normalizeOptionalText(input.suitePath);
  const command = normalizeOptionalText(input.command);
  const cases = input.run.results.map(toCaseRecord);
  const totals = {
    total: input.run.total,
    passed: input.run.passed,
    failed: input.run.failed,
    trustAccuracy: input.run.trustAccuracy
  };
  const nextChecks = normalizeStringList(input.nextChecks ?? defaultNextChecks({ suitePath, command, totals }));
  const allReceiptsReplayable = cases.every((result) => result.receiptReplayable);
  const recordWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    suite: {
      suiteId: requireText(input.run.suiteId, "Benchmark suite id is required."),
      title: requireText(input.run.title, "Benchmark suite title is required."),
      description: normalizeOptionalText(input.suiteDescription),
      path: suitePath
    },
    runner: {
      name: normalizeOptionalText(input.runnerName) ?? "truth-harness-benchmark-runner",
      adapter: normalizeOptionalText(input.runnerAdapter) ?? "local-receipt-engine",
      version: normalizeOptionalText(input.runnerVersion)
    },
    command,
    workingDirectory: normalizeOptionalText(input.workingDirectory),
    startedAt: requireText(input.run.startedAt, "Benchmark start time is required."),
    completedAt: requireText(input.run.completedAt, "Benchmark completion time is required."),
    totals,
    cases,
    replay: {
      command,
      suitePath,
      deterministic: allReceiptsReplayable,
      requiresManualReplay: true,
      notes: normalizeStringList(input.replayNotes ?? replayNotesFor({ suitePath, command, allReceiptsReplayable }))
    },
    verificationBoundary: {
      executionPerformedByWorkbench: true as const,
      benchmarkMeasuresSystemBehavior: true as const,
      benchmarkRunIsNotTruth: true as const,
      receiptsRetainOwnTrustLabels: true as const,
      requiresIndependentSuiteReview: true,
      requiresRegressionComparison: true,
      requiredNextChecks: nextChecks
    },
    privacy: manifest.privacy
  };
  const benchmarkRunId = `bench_${stableHash(recordWithoutId).slice(0, 16)}`;
  const record: BenchmarkRunRecord = {
    schemaVersion: "truth-harness.benchmark-run.v0",
    benchmarkRunId,
    ...recordWithoutId,
    updatedAt: createdAt,
    warnings: warningsFor({ totals, suitePath, command, allReceiptsReplayable })
  };

  return record;
}

export async function writeBenchmarkRunRecord(input: CreateBenchmarkRunRecordInput): Promise<BenchmarkRunWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const record = await createBenchmarkRunRecord(input);
  const benchmarksDir = resolve(status.root, status.manifest.directories.benchmarks);
  await mkdir(benchmarksDir, { recursive: true });
  const baseName = `${record.createdAt.slice(0, 10)}-${record.benchmarkRunId}`;
  const jsonPath = join(benchmarksDir, `${baseName}.json`);
  const markdownPath = join(benchmarksDir, `${baseName}.md`);
  const markdown = renderBenchmarkRunMarkdown(record);
  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "benchmarks",
    now: record.createdAt,
    staleReason: "benchmark run record written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

export function parseBenchmarkRunRecordJson(raw: string, source = "benchmark run record"): BenchmarkRunRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const nodeError = error as Error;
    throw new Error(`${source} is not valid JSON: ${nodeError.message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`${source} must be a JSON object.`);
  }

  if (parsed.schemaVersion !== "truth-harness.benchmark-run.v0") {
    throw new Error(`${source} must have schemaVersion "truth-harness.benchmark-run.v0".`);
  }

  if (typeof parsed.benchmarkRunId !== "string" || !isRecord(parsed.suite) || !isRecord(parsed.totals) || !Array.isArray(parsed.cases)) {
    throw new Error(`${source} is missing required benchmark run fields.`);
  }

  return parsed as unknown as BenchmarkRunRecord;
}

export function createBenchmarkComparisonRecord(input: CreateBenchmarkComparisonRecordInput): BenchmarkComparisonRecord {
  const createdAt = input.now ?? new Date().toISOString();
  const baseline = summarizeRun(input.baseline, input.baselineRef);
  const current = summarizeRun(input.current, input.currentRef);
  const cases = compareCases(input.baseline.cases, input.current.cases);
  const summary = summarizeComparison({ baseline, current, cases });
  const verdict = verdictFor(summary);
  const boundary = {
    comparesRecordedRunsOnly: true as const,
    benchmarkComparisonIsNotTruth: true as const,
    requiresHumanReviewForClaims: true as const,
    requiredNextChecks: requiredNextChecksFor({ baseline, current, summary })
  };
  const warnings = comparisonWarnings({ baseline, current, summary });
  const projectId = input.projectId ?? currentProjectId(input.baseline, input.current);
  const privacy = input.privacy ?? input.current.privacy;
  const comparisonWithoutId = {
    projectId,
    createdAt,
    baseline,
    current,
    verdict,
    summary,
    cases,
    boundary,
    privacy,
    warnings
  };
  const comparisonId = `bcmp_${stableHash(comparisonWithoutId).slice(0, 16)}`;

  return {
    schemaVersion: "truth-harness.benchmark-comparison.v0",
    comparisonId,
    ...comparisonWithoutId
  };
}

export async function writeBenchmarkComparisonRecord(
  input: WriteBenchmarkComparisonRecordInput
): Promise<BenchmarkComparisonWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const record = createBenchmarkComparisonRecord({
    ...input,
    projectId: status.manifest.projectId,
    privacy: status.manifest.privacy
  });
  const benchmarksDir = resolve(status.root, status.manifest.directories.benchmarks);
  await mkdir(benchmarksDir, { recursive: true });
  const baseName = `${record.createdAt.slice(0, 10)}-${record.comparisonId}`;
  const jsonPath = join(benchmarksDir, `${baseName}.json`);
  const markdownPath = join(benchmarksDir, `${baseName}.md`);
  const markdown = renderBenchmarkComparisonMarkdown(record);
  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "benchmarks",
    now: record.createdAt,
    staleReason: "benchmark comparison record written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listBenchmarkComparisonRecords(rootPath: string): Promise<BenchmarkComparisonRecord[]> {
  const status = await requireLocalWorkspace(rootPath);
  const benchmarksDir = resolve(status.root, status.manifest.directories.benchmarks);

  let files: string[];
  try {
    files = await readdir(benchmarksDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const records = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(benchmarksDir, file), "utf8")) as BenchmarkComparisonRecord)
  );

  return records
    .filter((record) => record.schemaVersion === "truth-harness.benchmark-comparison.v0")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listBenchmarkRunRecords(rootPath: string): Promise<BenchmarkRunRecord[]> {
  const status = await requireLocalWorkspace(rootPath);
  const benchmarksDir = resolve(status.root, status.manifest.directories.benchmarks);

  let files: string[];
  try {
    files = await readdir(benchmarksDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const records = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(benchmarksDir, file), "utf8")) as BenchmarkRunRecord)
  );

  return records
    .filter((record) => record.schemaVersion === "truth-harness.benchmark-run.v0")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listBenchmarkArtifacts(rootPath: string): Promise<BenchmarkArtifactSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const benchmarksDir = resolve(status.root, status.manifest.directories.benchmarks);

  let files: string[];
  try {
    files = await readdir(benchmarksDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const summaries = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const path = join(benchmarksDir, file);
        return summarizeBenchmarkArtifact(status.root, path, await readFile(path, "utf8"));
      })
  );

  return summaries
    .filter((summary): summary is BenchmarkArtifactSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function renderBenchmarkComparisonMarkdown(record: BenchmarkComparisonRecord): string {
  const lines = [
    `# Benchmark Comparison ${record.comparisonId}`,
    "",
    `Verdict: \`${record.verdict}\``,
    `Suite: \`${record.current.suiteId}\``,
    `Created: ${record.createdAt}`,
    `Privacy: ${record.privacy.mode} (network: ${record.privacy.networkAccess})`,
    "",
    `Baseline: \`${record.baseline.benchmarkRunId}\` (${record.baseline.passed}/${record.baseline.total}, ${(record.baseline.trustAccuracy * 100).toFixed(1)}%)`,
    `Current: \`${record.current.benchmarkRunId}\` (${record.current.passed}/${record.current.total}, ${(record.current.trustAccuracy * 100).toFixed(1)}%)`,
    "",
    "## Summary",
    "",
    `- Comparable: ${String(record.summary.comparable)}`,
    `- Passed delta: ${formatSigned(record.summary.passedDelta)}`,
    `- Failed delta: ${formatSigned(record.summary.failedDelta)}`,
    `- Trust accuracy delta: ${formatSignedPercent(record.summary.trustAccuracyDelta)}`,
    `- Regressions: ${record.summary.regressions}`,
    `- Improvements: ${record.summary.improvements}`,
    `- Changed trust labels: ${record.summary.changedTrust}`,
    `- Changed receipt hashes: ${record.summary.changedReceipts}`,
    `- Added cases: ${record.summary.addedCases}`,
    `- Removed cases: ${record.summary.removedCases}`
  ];

  lines.push("", "## Case Changes", "");
  for (const entry of record.cases.filter((candidate) => candidate.status !== "unchanged-pass")) {
    lines.push(`- ${entry.status} \`${entry.taskId}\``);
    if (entry.baseline) {
      lines.push(`  - Baseline: ${entry.baseline.actualTrust}, passed=${String(entry.baseline.passed)}`);
    }
    if (entry.current) {
      lines.push(`  - Current: ${entry.current.actualTrust}, passed=${String(entry.current.passed)}`);
    }
    for (const warning of entry.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  if (record.boundary.requiredNextChecks.length > 0) {
    lines.push("", "## Next Checks", "");
    for (const check of record.boundary.requiredNextChecks) {
      lines.push(`- ${check}`);
    }
  }

  if (record.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of record.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "This comparison only compares recorded benchmark runs. It does not prove model quality, scientific validity, medical safety, regulatory approval, or legal conclusions."
  );

  return `${lines.join("\n")}\n`;
}

export function renderBenchmarkRunMarkdown(record: BenchmarkRunRecord): string {
  const lines = [
    `# ${record.suite.title}`,
    "",
    `Benchmark run: \`${record.benchmarkRunId}\``,
    `Suite: \`${record.suite.suiteId}\``,
    `Created: ${record.createdAt}`,
    `Privacy: ${record.privacy.mode} (network: ${record.privacy.networkAccess})`,
    "",
    `Passed: ${record.totals.passed}/${record.totals.total}`,
    `Trust accuracy: ${(record.totals.trustAccuracy * 100).toFixed(1)}%`
  ];

  if (record.suite.description) {
    lines.push("", record.suite.description);
  }

  lines.push("", "## Runner", "");
  lines.push(`- Runner: ${record.runner.name}`);
  lines.push(`- Adapter: ${record.runner.adapter}`);
  if (record.runner.version) lines.push(`- Version: ${record.runner.version}`);
  if (record.command) lines.push(`- Command: \`${record.command}\``);
  if (record.workingDirectory) lines.push(`- Working directory: \`${record.workingDirectory}\``);
  if (record.suite.path) lines.push(`- Suite path: \`${record.suite.path}\``);

  lines.push("", "## Cases", "");
  for (const result of record.cases) {
    const status = result.passed ? "PASS" : "FAIL";
    const context = [
      result.category ? `category=${result.category}` : undefined,
      result.aiFailureMode ? `failure-mode=${result.aiFailureMode}` : undefined,
      result.expectedEvidenceKind ? `expected-evidence=${result.expectedEvidenceKind}` : undefined,
      `actual-evidence=${result.evidenceKind}`
    ].filter((part): part is string => Boolean(part));
    lines.push(`- ${status} \`${result.taskId}\`: ${result.actualTrust} - ${result.receiptSummary}`);
    if (context.length > 0) {
      lines.push(`  - ${context.join("; ")}`);
    }
    for (const failure of result.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  lines.push("", "## Replay", "");
  lines.push(`- Deterministic receipts: ${String(record.replay.deterministic)}`);
  lines.push(`- Manual replay required: ${String(record.replay.requiresManualReplay)}`);
  for (const note of record.replay.notes) {
    lines.push(`- ${note}`);
  }

  if (record.verificationBoundary.requiredNextChecks.length > 0) {
    lines.push("", "## Next Checks", "");
    for (const check of record.verificationBoundary.requiredNextChecks) {
      lines.push(`- ${check}`);
    }
  }

  if (record.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of record.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "This benchmark run measures system behavior against a suite. It does not prove mathematical, scientific, medical, regulatory, or legal truth by itself."
  );

  return `${lines.join("\n")}\n`;
}

function toCaseRecord(result: BenchmarkRunTaskResultLike): BenchmarkRunCaseRecord {
  const receipt = result.receipt;

  return {
    taskId: requireText(result.task.id, "Benchmark task id is required."),
    prompt: requireText(result.task.prompt, "Benchmark task prompt is required."),
    category: normalizeOptionalText(result.task.category),
    aiFailureMode: normalizeOptionalText(result.task.aiFailureMode),
    expectedTrust: result.task.expectTrust,
    expectedSummaryIncludes: normalizeOptionalText(result.task.expectSummaryIncludes),
    expectedEvidenceKind: result.task.expectEvidenceKind,
    actualTrust: receipt.trust,
    receiptRunId: receipt.runId,
    receiptCreatedAt: receipt.createdAt,
    receiptSummary: receipt.summary,
    receiptReplay: receipt.replay,
    receiptHash: stableHash(receipt),
    evidenceKind: receipt.evidenceProfile.kind,
    backendIds: receipt.evidenceProfile.backends.map(formatBackendId),
    proofCheckerBacked: receipt.evidenceProfile.proofCheckerBacked,
    receiptReplayable: receipt.evidenceProfile.replayable,
    passed: result.passed,
    failures: normalizeStringList(result.failures)
  };
}

function formatBackendId(backend: Receipt["evidenceProfile"]["backends"][number]): string {
  return backend.version ? `${backend.id}@${backend.version}` : backend.id;
}

function defaultNextChecks(input: {
  suitePath?: string;
  command?: string;
  totals: BenchmarkRunRecord["totals"];
}): string[] {
  const checks = [
    "compare this run against prior benchmark-run records before claiming improvement",
    "inspect failed cases before treating aggregate accuracy as meaningful",
    "review the suite for leakage, overfitting, and missing adversarial tasks before publishing scores"
  ];

  if (!input.suitePath) {
    checks.push("record the suite path or immutable suite artifact used for replay");
  }

  if (!input.command) {
    checks.push("record the exact replay command");
  }

  if (input.totals.failed > 0) {
    checks.push("fix or explicitly triage failing benchmark cases");
  }

  return checks;
}

function replayNotesFor(input: { suitePath?: string; command?: string; allReceiptsReplayable: boolean }): string[] {
  const notes = [];

  if (input.command) {
    notes.push("Replay command is recorded for human or agent execution.");
  } else {
    notes.push("No replay command was recorded; benchmark replay needs manual reconstruction.");
  }

  if (input.suitePath) {
    notes.push("Suite path is recorded relative to the project/workspace context.");
  } else {
    notes.push("Suite path is missing; attach an immutable suite ref before publishing this score.");
  }

  if (!input.allReceiptsReplayable) {
    notes.push("At least one underlying receipt is not replayable.");
  }

  return notes;
}

function warningsFor(input: {
  totals: BenchmarkRunRecord["totals"];
  suitePath?: string;
  command?: string;
  allReceiptsReplayable: boolean;
}): string[] {
  const warnings = [
    "Benchmark records measure system behavior; they do not prove the benchmark tasks, scientific claims, safety, regulatory approval, or patentability by themselves.",
    "Each case keeps its receipt trust label; aggregate accuracy is not a substitute for proof, replay, source review, or expert review."
  ];

  if (input.totals.failed > 0 || input.totals.trustAccuracy < 1) {
    warnings.push("This benchmark run contains failed cases or less than perfect trust accuracy.");
  }

  if (!input.suitePath) {
    warnings.push("No benchmark suite path was recorded.");
  }

  if (!input.command) {
    warnings.push("No replay command was recorded.");
  }

  if (!input.allReceiptsReplayable) {
    warnings.push("At least one receipt was marked non-replayable.");
  }

  return warnings;
}

function summarizeRun(record: BenchmarkRunRecord, ref: string | undefined): BenchmarkComparisonRunSummary {
  return {
    benchmarkRunId: record.benchmarkRunId,
    ref: normalizeOptionalText(ref),
    suiteId: record.suite.suiteId,
    title: record.suite.title,
    createdAt: record.createdAt,
    runnerName: record.runner.name,
    runnerAdapter: record.runner.adapter,
    total: record.totals.total,
    passed: record.totals.passed,
    failed: record.totals.failed,
    trustAccuracy: record.totals.trustAccuracy
  };
}

function compareCases(
  baselineCases: BenchmarkRunCaseRecord[],
  currentCases: BenchmarkRunCaseRecord[]
): BenchmarkComparisonCase[] {
  const baselineByTask = new Map(baselineCases.map((entry) => [entry.taskId, entry]));
  const currentByTask = new Map(currentCases.map((entry) => [entry.taskId, entry]));
  const taskIds = new Set([...baselineByTask.keys(), ...currentByTask.keys()]);

  return [...taskIds].sort().map((taskId) => {
    const baseline = baselineByTask.get(taskId);
    const current = currentByTask.get(taskId);
    const status = compareCaseStatus(baseline, current);
    return {
      taskId,
      status,
      baseline: baseline ? snapshotCase(baseline) : undefined,
      current: current ? snapshotCase(current) : undefined,
      warnings: caseWarnings({ baseline, current, status })
    };
  });
}

function compareCaseStatus(
  baseline: BenchmarkRunCaseRecord | undefined,
  current: BenchmarkRunCaseRecord | undefined
): BenchmarkCaseComparisonStatus {
  if (!baseline) {
    return "added";
  }

  if (!current) {
    return "removed";
  }

  if (baseline.passed && !current.passed) {
    return "regression";
  }

  if (!baseline.passed && current.passed) {
    return "improvement";
  }

  if (baseline.actualTrust !== current.actualTrust) {
    return "changed-trust";
  }

  if (baseline.receiptHash !== current.receiptHash) {
    return "changed-receipt";
  }

  return current.passed ? "unchanged-pass" : "unchanged-fail";
}

function snapshotCase(entry: BenchmarkRunCaseRecord): BenchmarkComparisonCaseSnapshot {
  return {
    prompt: entry.prompt,
    expectedTrust: entry.expectedTrust,
    actualTrust: entry.actualTrust,
    passed: entry.passed,
    receiptRunId: entry.receiptRunId,
    receiptHash: entry.receiptHash,
    receiptSummary: entry.receiptSummary,
    failures: entry.failures
  };
}

function caseWarnings(input: {
  baseline: BenchmarkRunCaseRecord | undefined;
  current: BenchmarkRunCaseRecord | undefined;
  status: BenchmarkCaseComparisonStatus;
}): string[] {
  switch (input.status) {
    case "regression":
      return ["Case passed in the baseline run and failed in the current run."];
    case "improvement":
      return ["Case failed in the baseline run and passed in the current run; inspect the receipt before claiming a fix."];
    case "changed-trust":
      return ["Case trust label changed; inspect backend metadata, summary, and receipt hash before relying on the score."];
    case "changed-receipt":
      return ["Case still has the same pass/fail and trust label, but the receipt hash changed."];
    case "added":
      return ["Case exists only in the current run; aggregate deltas include suite-shape drift."];
    case "removed":
      return ["Case exists only in the baseline run; removed cases can hide regressions."];
    case "unchanged-fail":
      return ["Case failed in both runs."];
    case "unchanged-pass":
      return [];
  }
}

function summarizeComparison(input: {
  baseline: BenchmarkComparisonRunSummary;
  current: BenchmarkComparisonRunSummary;
  cases: BenchmarkComparisonCase[];
}): BenchmarkComparisonRecord["summary"] {
  const count = (status: BenchmarkCaseComparisonStatus) =>
    input.cases.filter((entry) => entry.status === status).length;
  const unchanged = input.cases.filter((entry) => entry.status === "unchanged-pass" || entry.status === "unchanged-fail").length;

  return {
    comparable: input.baseline.suiteId === input.current.suiteId,
    totalDelta: input.current.total - input.baseline.total,
    passedDelta: input.current.passed - input.baseline.passed,
    failedDelta: input.current.failed - input.baseline.failed,
    trustAccuracyDelta: input.current.trustAccuracy - input.baseline.trustAccuracy,
    regressions: count("regression"),
    improvements: count("improvement"),
    changedTrust: count("changed-trust"),
    changedReceipts: count("changed-receipt"),
    addedCases: count("added"),
    removedCases: count("removed"),
    unchanged
  };
}

function verdictFor(summary: BenchmarkComparisonRecord["summary"]): BenchmarkComparisonVerdict {
  if (!summary.comparable) {
    return "incomparable";
  }

  if (summary.regressions > 0 || summary.removedCases > 0 || summary.failedDelta > 0) {
    return "regressed";
  }

  if (summary.improvements > 0 || summary.passedDelta > 0 || summary.trustAccuracyDelta > 0) {
    return "improved";
  }

  if (summary.changedTrust > 0 || summary.changedReceipts > 0 || summary.addedCases > 0 || summary.totalDelta !== 0) {
    return "changed";
  }

  return "unchanged";
}

function requiredNextChecksFor(input: {
  baseline: BenchmarkComparisonRunSummary;
  current: BenchmarkComparisonRunSummary;
  summary: BenchmarkComparisonRecord["summary"];
}): string[] {
  const checks = [
    "inspect every non-unchanged case before publishing benchmark claims",
    "keep the compared benchmark-run records and workspace snapshot with any reported score"
  ];

  if (!input.summary.comparable) {
    checks.push("compare runs from the same suite before claiming improvement or regression");
  }

  if (input.summary.regressions > 0 || input.summary.failedDelta > 0) {
    checks.push("triage regressions and new failures before claiming progress");
  }

  if (input.summary.changedTrust > 0 || input.summary.changedReceipts > 0) {
    checks.push("replay changed receipts and inspect backend/version differences");
  }

  if (input.summary.addedCases > 0 || input.summary.removedCases > 0) {
    checks.push("review suite-shape drift; added or removed cases make aggregate deltas harder to interpret");
  }

  if (input.baseline.runnerAdapter !== input.current.runnerAdapter) {
    checks.push("record why runner adapters changed between baseline and current runs");
  }

  return checks;
}

function comparisonWarnings(input: {
  baseline: BenchmarkComparisonRunSummary;
  current: BenchmarkComparisonRunSummary;
  summary: BenchmarkComparisonRecord["summary"];
}): string[] {
  const warnings = [
    "Benchmark comparisons are regression evidence only; they do not prove mathematical, scientific, medical, regulatory, or legal truth.",
    "A better aggregate score can still hide weak benchmarks, leakage, overfitting, or unsupported downstream claims."
  ];

  if (!input.summary.comparable) {
    warnings.push("The compared runs use different suite ids.");
  }

  if (input.summary.regressions > 0 || input.summary.failedDelta > 0) {
    warnings.push("The current run has regressions or more failed cases than the baseline.");
  }

  if (input.summary.addedCases > 0 || input.summary.removedCases > 0) {
    warnings.push("The suite case set changed between runs.");
  }

  if (input.baseline.runnerAdapter !== input.current.runnerAdapter) {
    warnings.push("Runner adapters differ between baseline and current runs.");
  }

  return warnings;
}

function benchmarkRunFailedCount(run: BenchmarkRunLike | BenchmarkRunRecord): number {
  return "totals" in run ? run.totals.failed : run.failed;
}

function summarizeBenchmarkArtifact(
  root: string,
  path: string,
  raw: string
): BenchmarkArtifactSummary | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }

  if (!isRecord(parsed)) {
    return undefined;
  }

  if (parsed.schemaVersion === "truth-harness.benchmark-run.v0") {
    return summarizeBenchmarkRunArtifact(root, path, parsed as unknown as BenchmarkRunRecord);
  }

  if (parsed.schemaVersion === "truth-harness.benchmark-comparison.v0") {
    return summarizeBenchmarkComparisonArtifact(root, path, parsed as unknown as BenchmarkComparisonRecord);
  }

  return undefined;
}

function summarizeBenchmarkRunArtifact(
  root: string,
  path: string,
  record: BenchmarkRunRecord
): BenchmarkArtifactSummary {
  return {
    kind: "run",
    path: toPortablePath(relative(root, path)),
    schemaVersion: "truth-harness.benchmark-run.v0",
    artifactId: record.benchmarkRunId,
    createdAt: record.createdAt,
    suiteId: record.suite.suiteId,
    title: record.suite.title,
    passed: record.totals.passed,
    failed: record.totals.failed,
    total: record.totals.total,
    trustAccuracy: record.totals.trustAccuracy,
    warnings: record.warnings
  };
}

function summarizeBenchmarkComparisonArtifact(
  root: string,
  path: string,
  record: BenchmarkComparisonRecord
): BenchmarkArtifactSummary {
  return {
    kind: "comparison",
    path: toPortablePath(relative(root, path)),
    schemaVersion: "truth-harness.benchmark-comparison.v0",
    artifactId: record.comparisonId,
    createdAt: record.createdAt,
    suiteId: record.current.suiteId,
    title: `${record.baseline.benchmarkRunId} -> ${record.current.benchmarkRunId}`,
    verdict: record.verdict,
    baselineRunId: record.baseline.benchmarkRunId,
    currentRunId: record.current.benchmarkRunId,
    warnings: record.warnings
  };
}

function currentProjectId(baseline: BenchmarkRunRecord, current: BenchmarkRunRecord): string {
  return baseline.projectId === current.projectId ? current.projectId : current.projectId;
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing benchmark run records.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function requireText(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

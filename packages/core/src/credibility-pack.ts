import { mkdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { listBenchmarkArtifacts, type BenchmarkArtifactSummary } from "./benchmark-run.js";
import {
  engineVerificationCaseEvidenceMeaning,
  engineVerificationCaseEvidenceTier,
  listEngineVerificationRuns,
  verifyEngineEvidence,
  type EngineVerificationCommandRunner,
  type EngineVerificationReport,
  type EngineVerificationRequirements,
  type EngineVerificationRunSummary
} from "./engine-verification.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { listHardMathClosureReports, type HardMathClosureReportSummary } from "./hard-math-closure-report.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";
import { validateWorkspaceArtifacts, type WorkspaceValidation } from "./workspace-validation.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";
import { createWorkspaceReview, type WorkspaceReview, type WorkspaceReviewItem } from "./workspace-review.js";
import { createWorkspaceSnapshot, type WorkspaceSnapshot } from "./workspace-snapshot.js";

export type CredibilityPackStatus = "ready-for-review" | "blocked";

export interface CredibilityPackCommandSet {
  validateWorkspace: string;
  verifyEngines: string;
  runAdversarialBenchmark: string;
  runMathCredibilityLadder: string;
  runExactHardMathClosure: string;
  runSymbolicHardMathClosure: string;
  runSmtHardMathClosure: string;
  reviewWorkspace: string;
  reproducePack: string;
  dockerProfessorEvidence: string;
  dockerStrictProfessorEvidence: string;
  dockerCoreEngines: string;
  dockerLeanFixture: string;
  dockerSageFixture: string;
  dockerAllEngines: string;
}

export interface CredibilityPackReviewItem {
  itemId: string;
  kind: WorkspaceReviewItem["kind"];
  priority: WorkspaceReviewItem["priority"];
  title: string;
  summary: string;
  command: string;
  source: WorkspaceReviewItem["source"];
}

export type CredibilityPackActionCategory = "validation" | "engine" | "benchmark" | "closure" | "workspace-review";

export interface CredibilityPackActionItem {
  actionId: string;
  category: CredibilityPackActionCategory;
  priority: WorkspaceReviewItem["priority"];
  title: string;
  detail: string;
  command: string;
  closes: string[];
  source: {
    kind: string;
    ref: string;
  };
}

export interface CredibilityPackEngineRunLedger {
  savedRuns: number;
  latestRuns: EngineVerificationRunSummary[];
  latestProfessorReviewerRun?: EngineVerificationRunSummary;
  latestStrictReviewerRun?: EngineVerificationRunSummary;
}

export interface CredibilityPackBenchmarkLedger {
  savedRuns: number;
  latestRuns: BenchmarkArtifactSummary[];
  latestAdversarialRun?: BenchmarkArtifactSummary;
  latestMathCredibilityLadderRun?: BenchmarkArtifactSummary;
}

export interface CredibilityPackHardMathClosureLedger {
  savedReports: number;
  latestReports: HardMathClosureReportSummary[];
  latestExactClosure?: HardMathClosureReportSummary;
  latestSymbolicClosure?: HardMathClosureReportSummary;
  latestSmtClosure?: HardMathClosureReportSummary;
}

export interface CredibilityPackEngineEvidenceLadderEntry {
  caseId: string;
  displayName: string;
  gate: "required" | "optional";
  status: EngineVerificationReport["cases"][number]["status"];
  trust: EngineVerificationReport["cases"][number]["trust"];
  evidenceTier: string;
  reviewerMeaning: string;
  replayCommand: string;
}

export interface CredibilityPack {
  schemaVersion: typeof CREDIBILITY_PACK_SCHEMA_VERSION;
  packId: string;
  title: string;
  createdAt: string;
  projectId: string;
  workspacePath: string;
  status: CredibilityPackStatus;
  localOnly: true;
  networkAccess: "none";
  privacy: PrivacyMetadata;
  summary: {
    validationPassed: boolean;
    validationErrors: number;
    validationWarnings: number;
    checkedFiles: number;
    snapshotFiles: number;
    snapshotBytes: number;
    engineStatus: EngineVerificationReport["status"];
    concreteEngineGates: string;
    requiredEngineGates: string;
    engineEvidenceMinted: number;
    savedEngineRuns: number;
    latestStrictEngineRunStatus?: EngineVerificationReport["status"];
    latestProfessorEngineRunStatus?: EngineVerificationReport["status"];
    savedBenchmarkRuns: number;
    latestAdversarialBenchmarkStatus: "missing" | "passed" | "failed";
    latestAdversarialBenchmarkAccuracy?: number;
    latestMathCredibilityLadderStatus: "missing" | "passed" | "failed";
    latestMathCredibilityLadderAccuracy?: number;
    savedHardMathClosureReports: number;
    hardMathExactClosureStatus: "missing" | "passed" | "failed";
    hardMathSymbolicClosureStatus: "missing" | "passed" | "failed";
    hardMathSmtClosureStatus: "missing" | "passed" | "failed";
    savedReportDrafts: number;
    reportDraftsNeedingAttention: number;
    reviewItems: number;
    criticalReviewItems: number;
    highReviewItems: number;
    leanProofSafetyItems: number;
    professorReady: boolean;
  };
  embeddedSnapshot: WorkspaceSnapshot;
  validation: {
    passed: boolean;
    checkedFiles: number;
    validFiles: number;
    invalidFiles: number;
    errors: number;
    warnings: number;
    issueCodes: string[];
  };
  engineEvidence: EngineVerificationReport;
  engineEvidenceLadder: CredibilityPackEngineEvidenceLadderEntry[];
  engineRunLedger: CredibilityPackEngineRunLedger;
  benchmarkLedger: CredibilityPackBenchmarkLedger;
  hardMathClosureLedger: CredibilityPackHardMathClosureLedger;
  workspaceReview: {
    reviewId: string;
    summary: WorkspaceReview["summary"];
    autonomy: Pick<WorkspaceReview["autonomy"], "mode" | "canRunUnattended" | "suggestedBatchSize" | "nextCommand" | "stopConditions">;
    topItems: CredibilityPackReviewItem[];
  };
  reviewerActionPlan: {
    totalActions: number;
    criticalActions: number;
    highActions: number;
    actions: CredibilityPackActionItem[];
  };
  reviewerCommands: CredibilityPackCommandSet;
  limitations: string[];
  warnings: string[];
  markdown: string;
}

export interface CreateCredibilityPackInput {
  rootPath: string;
  now?: string;
  maxRoutes?: number;
  maxClaims?: number;
  maxSessions?: number;
  maxReports?: number;
  engineRequirements?: EngineVerificationRequirements;
  timeoutMs?: number;
  maximaCommand?: string;
  z3Command?: string;
  leanCommand?: string;
  sageCommand?: string;
  smtSourcePath?: string;
  smtSourceText?: string;
  leanSourcePath?: string;
  leanSourceText?: string;
  cvc5Command?: string;
  runner?: EngineVerificationCommandRunner;
}

export interface CredibilityPackWriteResult {
  pack: CredibilityPack;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

const CREDIBILITY_PACK_SCHEMA_VERSION = "truth-harness.credibility-pack.v0" as const;

export async function createCredibilityPack(input: CreateCredibilityPackInput): Promise<CredibilityPack> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const snapshot = await createWorkspaceSnapshot({
    rootPath: status.root,
    now: createdAt
  });
  const validation = await validateWorkspaceArtifacts({
    rootPath: status.root,
    now: createdAt
  });
  const engineEvidence = await verifyEngineEvidence({
    rootPath: status.root,
    now: new Date(createdAt),
    timeoutMs: input.timeoutMs,
    maximaCommand: input.maximaCommand,
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command,
    leanCommand: input.leanCommand,
    sageCommand: input.sageCommand,
    smtSourcePath: input.smtSourcePath,
    smtSourceText: input.smtSourceText,
    leanSourcePath: input.leanSourcePath,
    leanSourceText: input.leanSourceText,
    requirements: input.engineRequirements,
    runner: input.runner
  });
  const engineRunLedger = summarizeEngineRunLedger(await listEngineVerificationRuns(status.root));
  const benchmarkLedger = summarizeBenchmarkLedger(await listBenchmarkArtifacts(status.root));
  const hardMathClosureLedger = summarizeHardMathClosureLedger(await listHardMathClosureReports(status.root));
  const review = await createWorkspaceReview({
    rootPath: status.root,
    maxRoutes: input.maxRoutes,
    maxClaims: input.maxClaims,
    maxSessions: input.maxSessions,
    maxReports: input.maxReports,
    now: createdAt
  });
  const reviewerCommands = createReviewerCommands(input);
  const warnings = credibilityWarnings({
    validation,
    engineEvidence,
    engineRunLedger,
    benchmarkLedger,
    hardMathClosureLedger,
    review
  });
  const statusLabel: CredibilityPackStatus = warnings.length === 0 ? "ready-for-review" : "blocked";
  const packWithoutIdAndMarkdown = {
    schemaVersion: CREDIBILITY_PACK_SCHEMA_VERSION,
    title: "Truth Harness Professor Credibility Pack",
    createdAt,
    projectId: status.manifest.projectId,
    workspacePath: status.root,
    status: statusLabel,
    localOnly: true as const,
    networkAccess: "none" as const,
    privacy: status.manifest.privacy,
    summary: {
      validationPassed: validation.passed,
      validationErrors: validation.summary.errors,
      validationWarnings: validation.summary.warnings,
      checkedFiles: validation.summary.checkedFiles,
      snapshotFiles: snapshot.summary.totalFiles,
      snapshotBytes: snapshot.summary.totalBytes,
      engineStatus: engineEvidence.status,
      concreteEngineGates: `${engineEvidence.concretePassed}/${engineEvidence.concreteTotal}`,
      requiredEngineGates: `${engineEvidence.requiredPassed}/${engineEvidence.requiredTotal}`,
      engineEvidenceMinted: engineEvidence.evidenceMinted,
      savedEngineRuns: engineRunLedger.savedRuns,
      latestStrictEngineRunStatus: engineRunLedger.latestStrictReviewerRun?.status,
      latestProfessorEngineRunStatus: engineRunLedger.latestProfessorReviewerRun?.status,
      savedBenchmarkRuns: benchmarkLedger.savedRuns,
      latestAdversarialBenchmarkStatus: adversarialBenchmarkStatus(benchmarkLedger.latestAdversarialRun),
      latestAdversarialBenchmarkAccuracy: benchmarkLedger.latestAdversarialRun?.trustAccuracy,
      latestMathCredibilityLadderStatus: benchmarkStatus(benchmarkLedger.latestMathCredibilityLadderRun),
      latestMathCredibilityLadderAccuracy: benchmarkLedger.latestMathCredibilityLadderRun?.trustAccuracy,
      savedHardMathClosureReports: hardMathClosureLedger.savedReports,
      hardMathExactClosureStatus: closureStatus(hardMathClosureLedger.latestExactClosure),
      hardMathSymbolicClosureStatus: closureStatus(hardMathClosureLedger.latestSymbolicClosure),
      hardMathSmtClosureStatus: closureStatus(hardMathClosureLedger.latestSmtClosure),
      savedReportDrafts: review.summary.reportDrafts ?? 0,
      reportDraftsNeedingAttention: review.summary.reportDraftsNeedingAttention ?? 0,
      reviewItems: review.summary.totalItems,
      criticalReviewItems: review.summary.criticalItems,
      highReviewItems: review.summary.highItems,
      leanProofSafetyItems: review.summary.leanProofSafetyItems,
      professorReady: statusLabel === "ready-for-review"
    },
    embeddedSnapshot: snapshot,
    validation: summarizeValidation(validation),
    engineEvidence,
    engineEvidenceLadder: summarizeEngineEvidenceLadder(engineEvidence),
    engineRunLedger,
    benchmarkLedger,
    hardMathClosureLedger,
    workspaceReview: {
      reviewId: review.reviewId,
      summary: review.summary,
      autonomy: {
        mode: review.autonomy.mode,
        canRunUnattended: review.autonomy.canRunUnattended,
        suggestedBatchSize: review.autonomy.suggestedBatchSize,
        nextCommand: review.autonomy.nextCommand,
        stopConditions: review.autonomy.stopConditions
      },
      topItems: review.items.slice(0, 8).map(toReviewItemSummary)
    },
    reviewerActionPlan: createReviewerActionPlan({
      validation,
      engineEvidence,
      engineRunLedger,
      benchmarkLedger,
      hardMathClosureLedger,
      review,
      reviewerCommands
    }),
    reviewerCommands,
    limitations: [
      "This pack is a local reviewer packet. It does not prove every claim in the workspace.",
      "The embedded snapshot hashes local artifacts at pack creation time; hashes prove file identity, not mathematical or scientific truth.",
      "Engine readiness and smoke evidence do not upgrade future claims. Each future claim still needs its own replayable receipt, CAS/SMT/proof record, source record, simulation record, or expert review.",
      "`proved` remains reserved for accepted proof-checker output over a concrete formal artifact."
    ],
    warnings
  };
  const packId = `cred_${stableHash(packWithoutIdAndMarkdown).slice(0, 16)}`;
  const packWithoutMarkdown = {
    ...packWithoutIdAndMarkdown,
    packId
  };

  return {
    ...packWithoutMarkdown,
    markdown: renderCredibilityPackMarkdown(packWithoutMarkdown)
  };
}

export async function writeCredibilityPack(input: CreateCredibilityPackInput): Promise<CredibilityPackWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const pack = await createCredibilityPack({
    ...input,
    rootPath: status.root
  });
  await assertCredibilityPackSchema(pack);
  const findingsDir = resolve(status.root, status.manifest.directories.findings);
  await mkdir(findingsDir, { recursive: true });
  const baseName = `${pack.createdAt.slice(0, 10)}-${pack.packId}-credibility-pack`;
  const jsonPath = join(findingsDir, `${baseName}.json`);
  const markdownPath = join(findingsDir, `${baseName}.md`);

  await writeJsonFileAtomic(jsonPath, pack);
  await writeFileAtomic(markdownPath, pack.markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "findings",
    now: pack.createdAt,
    staleReason: "credibility pack written"
  });

  return {
    pack,
    jsonPath,
    markdownPath,
    markdown: pack.markdown
  };
}

async function assertCredibilityPackSchema(pack: CredibilityPack): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: pack,
    schemaFile: "credibility-pack.schema.json",
    artifactName: "Credibility pack"
  });
}

export function renderCredibilityPackMarkdown(pack: Omit<CredibilityPack, "markdown">): string {
  const lines = [
    `# ${pack.title}`,
    "",
    `Pack: \`${pack.packId}\``,
    `Status: \`${pack.status}\``,
    `Created: ${pack.createdAt}`,
    `Project: \`${pack.projectId}\``,
    `Privacy: local-only (network: ${pack.networkAccess})`,
    "",
    "## Executive Summary",
    "",
    `- Professor ready: ${pack.summary.professorReady ? "yes" : "no"}`,
    `- Workspace validation: ${pack.summary.validationPassed ? "passed" : "failed"} (${pack.summary.validationErrors} errors, ${pack.summary.validationWarnings} warnings)`,
    `- Engine evidence: ${formatCredibilityPackEngineEvidenceSummary(pack)}`,
    `- Saved engine-run ledger: ${pack.summary.savedEngineRuns} saved${formatCredibilityPackSavedEngineRunLedgerLabel(pack)}`,
    `- Adversarial benchmark: ${formatAdversarialBenchmarkSummary(pack.summary.latestAdversarialBenchmarkStatus, pack.summary.latestAdversarialBenchmarkAccuracy)} (${pack.summary.savedBenchmarkRuns} saved benchmark run${pack.summary.savedBenchmarkRuns === 1 ? "" : "s"})`,
    `- Math credibility ladder: ${formatBenchmarkSummary(pack.summary.latestMathCredibilityLadderStatus, pack.summary.latestMathCredibilityLadderAccuracy)}`,
    `- Hard-math closure: ${formatHardMathClosureSummary(pack)}`,
    `- Saved report drafts: ${formatReportDraftSummary(pack.summary.savedReportDrafts, pack.summary.reportDraftsNeedingAttention)}`,
    `- Embedded artifact snapshot: ${pack.summary.snapshotFiles} files, ${pack.summary.snapshotBytes} bytes`,
    `- Open work queue: ${pack.summary.reviewItems} items (${pack.summary.criticalReviewItems} critical, ${pack.summary.highReviewItems} high)`,
    `- Lean proof-safety blockers: ${pack.summary.leanProofSafetyItems}`,
    `- Reviewer action plan: ${pack.reviewerActionPlan.totalActions} actions (${pack.reviewerActionPlan.criticalActions} critical, ${pack.reviewerActionPlan.highActions} high)`,
    "",
    "## Reviewer Commands",
    "",
    `- Validate workspace: \`${pack.reviewerCommands.validateWorkspace}\``,
    `- Verify engines: \`${pack.reviewerCommands.verifyEngines}\``,
    `- Run adversarial benchmark: \`${pack.reviewerCommands.runAdversarialBenchmark}\``,
    `- Run math credibility ladder: \`${pack.reviewerCommands.runMathCredibilityLadder}\``,
    `- Run exact hard-math closure: \`${pack.reviewerCommands.runExactHardMathClosure}\``,
    `- Run symbolic hard-math closure: \`${pack.reviewerCommands.runSymbolicHardMathClosure}\``,
    `- Run SMT hard-math closure: \`${pack.reviewerCommands.runSmtHardMathClosure}\``,
    `- Review open obligations: \`${pack.reviewerCommands.reviewWorkspace}\``,
    `- Reproduce this pack: \`${pack.reviewerCommands.reproducePack}\``,
    `- Docker professor evidence: \`${pack.reviewerCommands.dockerProfessorEvidence}\``,
    `- Docker strict professor evidence: \`${pack.reviewerCommands.dockerStrictProfessorEvidence}\``,
    `- Docker core engines: \`${pack.reviewerCommands.dockerCoreEngines}\``,
    `- Docker Lean fixture: \`${pack.reviewerCommands.dockerLeanFixture}\``,
    `- Docker Sage fixture: \`${pack.reviewerCommands.dockerSageFixture}\``,
    `- Docker all engines: \`${pack.reviewerCommands.dockerAllEngines}\``,
    "",
    "## Reviewer Action Plan",
    ""
  ];

  if (pack.reviewerActionPlan.actions.length === 0) {
    lines.push("No open reviewer actions were generated for this bounded pack.", "");
  } else {
    for (const item of pack.reviewerActionPlan.actions) {
      lines.push(
        `### ${item.title}`,
        "",
        `- Priority: \`${item.priority}\``,
        `- Category: \`${item.category}\``,
        `- Source: \`${item.source.kind}:${item.source.ref}\``,
        `- Closes: ${item.closes.map((entry) => `\`${entry}\``).join(", ")}`,
        `- Command: \`${item.command}\``,
        `- Detail: ${item.detail}`,
        ""
      );
    }
  }

  lines.push(
    "## Engine Evidence Ladder",
    "",
    "| Case | Gate | Status | Trust | Evidence status | Reviewer meaning |",
    "| --- | --- | --- | --- | --- | --- |"
  );
  for (const item of pack.engineEvidenceLadder) {
    lines.push(
      `| ${markdownCell(item.displayName)} | ${item.gate} | \`${item.status}\` | \`${item.trust}\` | ${markdownCell(item.evidenceTier)} | ${markdownCell(item.reviewerMeaning)} |`
    );
  }
  lines.push("");

  lines.push(
    "## Engine Gates",
    ""
  );

  for (const item of pack.engineEvidence.cases) {
    lines.push(
      `### ${item.displayName}`,
      "",
      `- Status: \`${item.status}\`${item.required ? " (required)" : ""}`,
      `- Trust: \`${item.trust}\``,
      `- Evidence minted: ${String(item.evidenceMinted)}`,
      `- Reviewer meaning: ${engineVerificationCaseEvidenceMeaning(item)}`,
      `- Command: \`${item.command}\``,
      `- Summary: ${item.summary}`,
      ""
    );
  }

  lines.push("## Saved Engine Run Ledger", "");
  if (pack.engineRunLedger.savedRuns === 0) {
    lines.push(
      "No saved engine evidence runs were found. Run the reviewer command with `--write` to create a durable `.truth-harness/engine-runs` record.",
      ""
    );
  } else {
    if (pack.engineRunLedger.latestStrictReviewerRun) {
      const strictRun = pack.engineRunLedger.latestStrictReviewerRun;
      lines.push(
        `Latest strict reviewer run: \`${strictRun.runId}\` (${strictRun.status}, ${strictRun.requiredPassed}/${strictRun.requiredTotal} required gates)`,
        `Path: \`${strictRun.path}\``,
        ""
      );
    } else {
      lines.push("No saved strict all-engines reviewer run was found yet.", "");
    }
    for (const run of pack.engineRunLedger.latestRuns) {
      lines.push(
        `- \`${run.runId}\`: ${run.status}, ${run.concretePassed}/${run.concreteTotal} concrete, ${run.requiredPassed}/${run.requiredTotal} required, ${run.evidenceMinted} evidence records, \`${run.path}\``
      );
    }
    lines.push("");
  }

  lines.push("## Benchmark Ledger", "");
  if (pack.benchmarkLedger.latestAdversarialRun) {
    const run = pack.benchmarkLedger.latestAdversarialRun;
    lines.push(
      `Latest adversarial benchmark: \`${run.artifactId}\` (${run.passed}/${run.total}, ${((run.trustAccuracy ?? 0) * 100).toFixed(1)}%)`,
      `Path: \`${run.path}\``,
      `Replay: \`${run.replayCommand ?? run.command ?? pack.reviewerCommands.runAdversarialBenchmark}\``,
      `Receipt replay examples: ${formatBenchmarkReceiptReplays(run.receiptReplays)}`,
      ""
    );
  } else {
    lines.push(
      "No saved `ai-failure-seed` benchmark run was found. Run the adversarial benchmark command before asking a professor to review the workspace.",
      ""
    );
  }
  if (pack.benchmarkLedger.latestMathCredibilityLadderRun) {
    const run = pack.benchmarkLedger.latestMathCredibilityLadderRun;
    lines.push(
      `Latest math credibility ladder: \`${run.artifactId}\` (${run.passed}/${run.total}, ${((run.trustAccuracy ?? 0) * 100).toFixed(1)}%)`,
      `Path: \`${run.path}\``,
      `Replay: \`${run.replayCommand ?? run.command ?? pack.reviewerCommands.runMathCredibilityLadder}\``,
      `Receipt replay examples: ${formatBenchmarkReceiptReplays(run.receiptReplays)}`,
      ""
    );
  } else {
    lines.push(
      "No saved `math-credibility-ladder` benchmark run was found. Run the ladder before claiming the native-safe hard-math floor is green.",
      ""
    );
  }
  for (const run of pack.benchmarkLedger.latestRuns) {
    lines.push(
      `- \`${run.artifactId}\`: ${run.suiteId}, ${run.passed}/${run.total}, ${((run.trustAccuracy ?? 0) * 100).toFixed(1)}%, \`${run.path}\``
    );
  }
  lines.push("");

  lines.push("## Hard-Math Closure Ledger", "");
  if (pack.hardMathClosureLedger.savedReports === 0) {
    lines.push(
      "No saved hard-math closure reports were found. Run the Docker closure smokes before claiming autonomous math closure is reviewer-ready.",
      ""
    );
  } else {
    lines.push(
      `Saved closure reports: ${pack.hardMathClosureLedger.savedReports}`,
      `Exact closure: ${formatClosureReportSummary(pack.hardMathClosureLedger.latestExactClosure)}`,
      `Symbolic closure: ${formatClosureReportSummary(pack.hardMathClosureLedger.latestSymbolicClosure)}`,
      `SMT closure: ${formatClosureReportSummary(pack.hardMathClosureLedger.latestSmtClosure)}`,
      ""
    );
    for (const report of pack.hardMathClosureLedger.latestReports) {
      lines.push(
        `- \`${report.closureId}\`: ${report.runtimeKind}, ${report.passedCases}/${report.totalCases} passed, cases ${report.caseIds.join(", ")}, trusts ${report.trusts.join(", ") || "none"}, \`${report.path}\``
      );
    }
    lines.push("");
  }

  lines.push("## Top Open Work", "");
  if (pack.workspaceReview.topItems.length === 0) {
    lines.push("No open review items were found in the bounded workspace review.", "");
  } else {
    for (const item of pack.workspaceReview.topItems) {
      lines.push(
        `### ${item.title}`,
        "",
        `- Priority: \`${item.priority}\``,
        `- Kind: \`${item.kind}\``,
        `- Source: ${item.source.label} (${item.source.ref})`,
        `- Command: \`${item.command}\``,
        `- Summary: ${item.summary}`,
        ""
      );
    }
  }

  lines.push(
    "## Snapshot Boundary",
    "",
    `The embedded snapshot \`${pack.embeddedSnapshot.snapshotId}\` records file hashes for the local workspace at pack creation time.`,
    "It is embedded in this pack so reviewers can inspect artifact identity without trusting the UI.",
    "",
    "## Limitations",
    ""
  );
  for (const limitation of pack.limitations) {
    lines.push(`- ${limitation}`);
  }
  if (pack.warnings.length > 0) {
    lines.push("", "## Blocking Warnings", "");
    for (const warning of pack.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatBenchmarkReceiptReplays(replays: string[] | undefined): string {
  if (!replays || replays.length === 0) {
    return "none recorded";
  }

  const rendered = replays.slice(0, 3).map((replay) => `\`${replay}\``).join(", ");
  return replays.length > 3 ? `${rendered}, ...` : rendered;
}

function summarizeValidation(validation: WorkspaceValidation): CredibilityPack["validation"] {
  return {
    passed: validation.passed,
    checkedFiles: validation.summary.checkedFiles,
    validFiles: validation.summary.validFiles,
    invalidFiles: validation.summary.invalidFiles,
    errors: validation.summary.errors,
    warnings: validation.summary.warnings,
    issueCodes: [...new Set(validation.issues.map((issue) => issue.code))].sort()
  };
}

function toReviewItemSummary(item: WorkspaceReviewItem): CredibilityPackReviewItem {
  return {
    itemId: item.itemId,
    kind: item.kind,
    priority: item.priority,
    title: item.title,
    summary: item.summary,
    command: item.command,
    source: item.source
  };
}

function summarizeEngineRunLedger(runs: EngineVerificationRunSummary[]): CredibilityPackEngineRunLedger {
  return {
    savedRuns: runs.length,
    latestRuns: runs.slice(0, 5),
    latestProfessorReviewerRun: runs.find(isPassedProfessorEngineRun),
    latestStrictReviewerRun: runs.find((run) => run.requiredTotal >= 5)
  };
}

function summarizeEngineEvidenceLadder(report: EngineVerificationReport): CredibilityPackEngineEvidenceLadderEntry[] {
  return report.cases.map((item) => ({
    caseId: item.id,
    displayName: item.displayName,
    gate: item.required ? "required" : "optional",
    status: item.status,
    trust: item.trust,
    evidenceTier: engineVerificationCaseEvidenceTier(item),
    reviewerMeaning: engineVerificationCaseEvidenceMeaning(item),
    replayCommand: item.command
  }));
}

function summarizeBenchmarkLedger(artifacts: BenchmarkArtifactSummary[]): CredibilityPackBenchmarkLedger {
  const runs = artifacts.filter((artifact) => artifact.kind === "run");
  return {
    savedRuns: runs.length,
    latestRuns: runs.slice(0, 5),
    latestAdversarialRun: runs.find((run) => run.suiteId === "ai-failure-seed"),
    latestMathCredibilityLadderRun: runs.find((run) => run.suiteId === "math-credibility-ladder")
  };
}

function summarizeHardMathClosureLedger(reports: HardMathClosureReportSummary[]): CredibilityPackHardMathClosureLedger {
  return {
    savedReports: reports.length,
    latestReports: reports.slice(0, 5),
    latestExactClosure: reports.find((report) => closureReportSatisfies(report, "exact-fraction-lemma", "exact-computed")),
    latestSymbolicClosure: reports.find((report) => closureReportSatisfies(report, "symbolic-cas-closure-fixture", "cross-checked")),
    latestSmtClosure: reports.find((report) => closureReportSatisfies(report, "smt-bounded-closure-fixture", "smt-checked"))
  };
}

function adversarialBenchmarkStatus(run: BenchmarkArtifactSummary | undefined): "missing" | "passed" | "failed" {
  return benchmarkStatus(run);
}

function benchmarkStatus(run: BenchmarkArtifactSummary | undefined): "missing" | "passed" | "failed" {
  if (!run) {
    return "missing";
  }

  return (run.failed ?? 0) === 0 ? "passed" : "failed";
}

function closureStatus(report: HardMathClosureReportSummary | undefined): "missing" | "passed" | "failed" {
  if (!report) {
    return "missing";
  }

  return report.failedCases === 0 && report.validationErrors === 0 ? "passed" : "failed";
}

function closureReportSatisfies(report: HardMathClosureReportSummary, caseId: string, trust: string): boolean {
  return (
    report.runtimeKind === "docker" &&
    report.containerized &&
    report.passedCaseIds.includes(caseId) &&
    report.failedCases === 0 &&
    report.validationErrors === 0 &&
    report.trusts.includes(trust)
  );
}

function formatAdversarialBenchmarkSummary(
  status: "missing" | "passed" | "failed",
  accuracy: number | undefined
): string {
  if (status === "missing") {
    return "missing";
  }

  return `${status}${accuracy === undefined ? "" : ` (${(accuracy * 100).toFixed(1)}%)`}`;
}

function formatBenchmarkSummary(status: "missing" | "passed" | "failed", accuracy: number | undefined): string {
  return formatAdversarialBenchmarkSummary(status, accuracy);
}

function formatReportDraftSummary(saved: number, needingAttention: number): string {
  const savedLabel = `${saved} saved draft${saved === 1 ? "" : "s"}`;
  if (needingAttention === 0) {
    return `${savedLabel}, 0 need attention`;
  }

  return `${savedLabel}, ${needingAttention} need${needingAttention === 1 ? "s" : ""} attention`;
}

function formatHardMathClosureSummary(pack: Pick<CredibilityPack, "summary">): string {
  return (
    `${pack.summary.savedHardMathClosureReports} saved ` +
    `(exact ${pack.summary.hardMathExactClosureStatus}, ` +
    `symbolic ${pack.summary.hardMathSymbolicClosureStatus}, ` +
    `SMT ${pack.summary.hardMathSmtClosureStatus})`
  );
}

function formatClosureReportSummary(report: HardMathClosureReportSummary | undefined): string {
  if (!report) {
    return "missing";
  }
  return `${closureStatus(report)} (${report.runtimeKind}, ${report.passedCases}/${report.totalCases}, ${report.closureId}, ${report.path})`;
}

function createReviewerActionPlan(input: {
  validation: WorkspaceValidation;
  engineEvidence: EngineVerificationReport;
  engineRunLedger: CredibilityPackEngineRunLedger;
  benchmarkLedger: CredibilityPackBenchmarkLedger;
  hardMathClosureLedger: CredibilityPackHardMathClosureLedger;
  review: WorkspaceReview;
  reviewerCommands: CredibilityPackCommandSet;
}): CredibilityPack["reviewerActionPlan"] {
  const actions: CredibilityPackActionItem[] = [];
  const pushAction = (action: Omit<CredibilityPackActionItem, "actionId">) => {
    const actionId = `cred_action_${stableHash(action).slice(0, 16)}`;
    if (!actions.some((existing) => existing.actionId === actionId)) {
      actions.push({
        actionId,
        ...action
      });
    }
  };

  if (!input.validation.passed) {
    pushAction({
      category: "validation",
      priority: "critical",
      title: "Fix workspace validation before review",
      detail: `${input.validation.summary.errors} validation error(s) and ${input.validation.summary.warnings} warning(s) were found across ${input.validation.summary.checkedFiles} checked files.`,
      command: input.reviewerCommands.validateWorkspace,
      closes: ["workspace-validation"],
      source: {
        kind: "workspace-validation",
        ref: input.validation.projectId
      }
    });
  }

  for (const item of input.engineEvidence.cases) {
    if (item.status === "passed" || item.status === "not-required") {
      continue;
    }
    if (caseGapIsCoveredBySavedRun(item, input.engineRunLedger)) {
      continue;
    }
    if (!item.required && (item.id === "cvc5-smt-check" || item.id === "sage-symbolic-cross-check")) {
      continue;
    }

    const priority: WorkspaceReviewItem["priority"] = item.required ? "critical" : "high";
    const command = reviewerEngineActionCommand(item, input.reviewerCommands);
    pushAction({
      category: "engine",
      priority,
      title: `${item.required ? "Close required" : "Close concrete"} ${item.displayName} gate`,
      detail: `${reviewerEngineSummary(item.summary)} Evidence status: ${engineVerificationCaseEvidenceTier(item)}. ${engineVerificationCaseEvidenceMeaning(item)} This gate currently reports ${item.status}; ${reviewerEngineActionDetail(item, command, input.reviewerCommands)}.`,
      command,
      closes: [
        item.required ? `required-engine:${item.id}` : `concrete-engine:${item.id}`,
        "engine-evidence"
      ],
      source: {
        kind: "engine-case",
        ref: item.id
      }
    });
  }

  if (!input.engineRunLedger.latestStrictReviewerRun && input.engineEvidence.requiredTotal >= 5) {
    pushAction({
      category: "engine",
      priority: "high",
      title: "Save a strict all-engines reviewer run",
      detail: "The current pack requires all engines, but no saved strict all-engines run is present in `.truth-harness/engine-runs` yet.",
      command: input.reviewerCommands.verifyEngines,
      closes: ["strict-engine-run-ledger"],
      source: {
        kind: "engine-run-ledger",
        ref: "latest-strict-reviewer-run"
      }
    });
  }

  const adversarialBenchmark = input.benchmarkLedger.latestAdversarialRun;
  if (!adversarialBenchmark) {
    pushAction({
      category: "benchmark",
      priority: "high",
      title: "Run adversarial AI failure benchmark",
      detail: "No saved `ai-failure-seed` benchmark run was found. Professor review should include a local run that catches fluent-but-wrong AI math behavior and preserves evidence-kind expectations.",
      command: input.reviewerCommands.runAdversarialBenchmark,
      closes: ["benchmark:ai-failure-seed", "adversarial-benchmark-ledger"],
      source: {
        kind: "benchmark-suite",
        ref: "ai-failure-seed"
      }
    });
  } else if ((adversarialBenchmark.failed ?? 0) > 0) {
    pushAction({
      category: "benchmark",
      priority: "critical",
      title: "Fix adversarial AI failure benchmark regressions",
      detail: `Latest \`ai-failure-seed\` run ${adversarialBenchmark.artifactId} has ${adversarialBenchmark.failed ?? 0} failing case(s). Fix or explicitly triage before professor review.`,
      command: input.reviewerCommands.runAdversarialBenchmark,
      closes: ["benchmark:ai-failure-seed", `benchmark-run:${adversarialBenchmark.artifactId}`],
      source: {
        kind: "benchmark-run",
        ref: adversarialBenchmark.path
      }
    });
  }

  const mathLadder = input.benchmarkLedger.latestMathCredibilityLadderRun;
  if (!mathLadder) {
    pushAction({
      category: "benchmark",
      priority: "high",
      title: "Run math credibility ladder",
      detail: "No saved `math-credibility-ladder` benchmark run was found. Professor review should include the native-safe hard-math readiness floor: exact equality, common-denominator lemmas, parity boundaries, dimensional mistakes, interval bounds, and honest theorem-boundary refusals.",
      command: input.reviewerCommands.runMathCredibilityLadder,
      closes: ["benchmark:math-credibility-ladder", "math-credibility-ladder-ledger"],
      source: {
        kind: "benchmark-suite",
        ref: "math-credibility-ladder"
      }
    });
  } else if ((mathLadder.failed ?? 0) > 0) {
    pushAction({
      category: "benchmark",
      priority: "critical",
      title: "Fix math credibility ladder regressions",
      detail: `Latest \`math-credibility-ladder\` run ${mathLadder.artifactId} has ${mathLadder.failed ?? 0} failing case(s). Fix or explicitly triage before treating the math lane as professor-ready.`,
      command: input.reviewerCommands.runMathCredibilityLadder,
      closes: ["benchmark:math-credibility-ladder", `benchmark-run:${mathLadder.artifactId}`],
      source: {
        kind: "benchmark-run",
        ref: mathLadder.path
      }
    });
  }

  pushHardMathClosureAction({
    report: input.hardMathClosureLedger.latestExactClosure,
    expectedCaseId: "exact-fraction-lemma",
    expectedTrust: "exact-computed",
    title: "Run exact hard-math closure smoke",
    command: input.reviewerCommands.runExactHardMathClosure,
    closes: ["hard-math-closure:exact-fraction-lemma", "hard-math-closure-ledger"],
    pushAction
  });
  pushHardMathClosureAction({
    report: input.hardMathClosureLedger.latestSymbolicClosure,
    expectedCaseId: "symbolic-cas-closure-fixture",
    expectedTrust: "cross-checked",
    title: "Run symbolic CAS hard-math closure smoke",
    command: input.reviewerCommands.runSymbolicHardMathClosure,
    closes: ["hard-math-closure:symbolic-cas-closure-fixture", "hard-math-closure-ledger"],
    pushAction
  });
  pushHardMathClosureAction({
    report: input.hardMathClosureLedger.latestSmtClosure,
    expectedCaseId: "smt-bounded-closure-fixture",
    expectedTrust: "smt-checked",
    title: "Run SMT hard-math closure smoke",
    command: input.reviewerCommands.runSmtHardMathClosure,
    closes: ["hard-math-closure:smt-bounded-closure-fixture", "hard-math-closure-ledger"],
    pushAction
  });

  for (const item of input.review.items.slice(0, 8)) {
    pushAction({
      category: "workspace-review",
      priority: item.priority,
      title: item.title,
      detail: item.summary,
      command: item.command,
      closes: [
        item.kind,
        ...reviewItemExtraCloses(item),
        ...(item.routeId ? [`route:${item.routeId}`] : []),
        ...(item.obligationId ? [`obligation:${item.obligationId}`] : []),
        ...(item.claimId ? [`claim:${item.claimId}`] : [])
      ],
      source: {
        kind: item.kind,
        ref: item.source.ref
      }
    });
  }

  const sorted = actions.sort((left, right) => {
    const priorityRank: Record<WorkspaceReviewItem["priority"], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };
    return (
      priorityRank[left.priority] - priorityRank[right.priority] ||
      reviewerActionRank(left) - reviewerActionRank(right) ||
      reviewerActionabilityRank(left) - reviewerActionabilityRank(right) ||
      left.title.localeCompare(right.title)
    );
  });

  return {
    totalActions: sorted.length,
    criticalActions: sorted.filter((item) => item.priority === "critical").length,
    highActions: sorted.filter((item) => item.priority === "high").length,
    actions: sorted
  };
}

function reviewerActionRank(action: CredibilityPackActionItem): number {
  if (action.category === "validation") {
    return 0;
  }
  if (action.category === "workspace-review" && action.source.ref.startsWith("lean-marker:")) {
    return 5;
  }
  if (action.category !== "engine") {
    if (action.category === "benchmark") {
      return 46;
    }
    if (action.category === "closure") {
      return 47;
    }
    return 50;
  }

  const engineRank: Record<string, number> = {
    "maxima-symbolic-cross-check": 10,
    "z3-smt-check": 11,
    "lean-proof-fixture": 20,
    "sage-symbolic-cross-check": 30,
    "cvc5-smt-check": 40,
    "latest-strict-reviewer-run": 45
  };
  return engineRank[action.source.ref] ?? 49;
}

function reviewItemExtraCloses(item: WorkspaceReviewItem): string[] {
  if (item.source.label === "Lean proof safety") {
    return ["proof-safety-boundary", `lean-proof-safety:${item.source.ref}`];
  }
  return [];
}

function reviewerActionabilityRank(action: CredibilityPackActionItem): number {
  if (writesVerifierEvidenceCommand(action.command)) {
    return 0;
  }
  if (/^npm\s+run\s+docker:(?:hard-math-closure|symbolic-closure|smt-closure)\b/u.test(action.command)) {
    return 0;
  }
  if (isPassiveReviewerCommand(action.command)) {
    return 2;
  }
  return 1;
}

function pushHardMathClosureAction(input: {
  report?: HardMathClosureReportSummary;
  expectedCaseId: string;
  expectedTrust: string;
  title: string;
  command: string;
  closes: string[];
  pushAction: (action: Omit<CredibilityPackActionItem, "actionId">) => void;
}): void {
  if (input.report && closureStatus(input.report) === "passed") {
    return;
  }
  const detail = input.report
    ? `Latest closure report ${input.report.closureId} did not satisfy ${input.expectedCaseId} with Docker ${input.expectedTrust} evidence. Status: ${closureStatus(input.report)}; runtime: ${input.report.runtimeKind}; trusts: ${input.report.trusts.join(", ") || "none"}.`
    : `No saved Docker hard-math closure report satisfies ${input.expectedCaseId} with ${input.expectedTrust} evidence.`;
  input.pushAction({
    category: "closure",
    priority: "high",
    title: input.title,
    detail: `${detail} Run the closure smoke so autonomous run-next proof blockers have a durable reviewer artifact.`,
    command: input.command,
    closes: input.closes,
    source: {
      kind: "hard-math-closure",
      ref: input.expectedCaseId
    }
  });
}

function writesVerifierEvidenceCommand(command: string): boolean {
  return (
    /^truth-harness\s+(?:smt|cas|proof)\s+check\b/u.test(command) &&
    hasCliFlag(command, "--write")
  ) || /^truth-harness\s+validation\s+attach\b/u.test(command);
}

function isPassiveReviewerCommand(command: string): boolean {
  return /^truth-harness\s+(?:route show|claim review|cas backends|smt backends|proof backends|research show|workspace report)\b/u.test(command);
}

function hasCliFlag(command: string, flag: string): boolean {
  return new RegExp(`(?:^|\\s)${escapeRegExp(flag)}(?:\\s|=|$)`, "u").test(command);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function reviewerEngineSummary(summary: string): string {
  if (isHostProcessBlocked(summary)) {
    return "The local OS or sandbox blocked the engine process, so Truth Harness did not count this backend as reviewer evidence.";
  }
  if (/\bspawn(?:Sync)?\b.*\bENOENT\b/iu.test(summary)) {
    return "The configured engine executable was not found, so Truth Harness did not count this backend as reviewer evidence.";
  }

  return summary;
}

function isHostProcessBlocked(summary: string): boolean {
  return /\bspawn(?:Sync)?\b.*\bEPERM\b/iu.test(summary);
}

function markdownCell(value: string): string {
  return value.replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ").trim();
}

function credibilityWarnings(input: {
  validation: WorkspaceValidation;
  engineEvidence: EngineVerificationReport;
  engineRunLedger: CredibilityPackEngineRunLedger;
  benchmarkLedger: CredibilityPackBenchmarkLedger;
  hardMathClosureLedger: CredibilityPackHardMathClosureLedger;
  review: WorkspaceReview;
}): string[] {
  const warnings: string[] = [];

  if (!input.validation.passed) {
    warnings.push(`Workspace validation failed with ${input.validation.summary.errors} error(s).`);
  }
  const requiredGaps = input.engineEvidence.cases.filter((entry) => entry.required && entry.status !== "passed");
  const concreteGaps = concreteEngineCases(input.engineEvidence).filter((entry) => entry.status !== "passed");
  if (
    input.engineEvidence.requiredTotal > 0 &&
    input.engineEvidence.requiredPassed !== input.engineEvidence.requiredTotal &&
    !requiredGaps.every((entry) => caseGapIsCoveredBySavedRun(entry, input.engineRunLedger))
  ) {
    warnings.push(
      `Required engine evidence gates are incomplete: ${input.engineEvidence.requiredPassed}/${input.engineEvidence.requiredTotal} passed.`
    );
  }
  if (
    input.engineEvidence.concretePassed !== input.engineEvidence.concreteTotal &&
    !concreteGaps.every((entry) => caseGapIsCoveredBySavedRun(entry, input.engineRunLedger))
  ) {
    warnings.push(
      `Concrete engine smoke gates are incomplete: ${input.engineEvidence.concretePassed}/${input.engineEvidence.concreteTotal} passed.`
    );
  }
  if (!input.benchmarkLedger.latestAdversarialRun) {
    warnings.push("No saved `ai-failure-seed` adversarial benchmark run found.");
  } else if ((input.benchmarkLedger.latestAdversarialRun.failed ?? 0) > 0) {
    warnings.push(
      `Latest \`ai-failure-seed\` adversarial benchmark run has ${input.benchmarkLedger.latestAdversarialRun.failed ?? 0} failing case(s).`
    );
  }
  if (!input.benchmarkLedger.latestMathCredibilityLadderRun) {
    warnings.push("No saved `math-credibility-ladder` hard-math readiness run found.");
  } else if ((input.benchmarkLedger.latestMathCredibilityLadderRun.failed ?? 0) > 0) {
    warnings.push(
      `Latest \`math-credibility-ladder\` hard-math readiness run has ${input.benchmarkLedger.latestMathCredibilityLadderRun.failed ?? 0} failing case(s).`
    );
  }
  addHardMathClosureWarnings(warnings, input.hardMathClosureLedger);
  if (input.review.summary.criticalItems > 0) {
    warnings.push(`Workspace review has ${input.review.summary.criticalItems} critical open item(s).`);
  }
  if (input.review.summary.leanProofSafetyItems > 0) {
    warnings.push(
      `Lean proof-safety scan found ${input.review.summary.leanProofSafetyItems} blocking marker(s); remove or rewrite them before treating affected Lean source as proved.`
    );
  }
  if ((input.review.summary.reportDraftsNeedingAttention ?? 0) > 0) {
    warnings.push(
      `Saved report drafts need integrity review before sharing: ${input.review.summary.reportDraftsNeedingAttention} draft(s) are missing Markdown or have SHA-256 mismatches.`
    );
  }

  return [...new Set(warnings)];
}

function addHardMathClosureWarnings(warnings: string[], ledger: CredibilityPackHardMathClosureLedger): void {
  const required = [
    {
      label: "exact-fraction",
      report: ledger.latestExactClosure,
      caseId: "exact-fraction-lemma"
    },
    {
      label: "symbolic-CAS",
      report: ledger.latestSymbolicClosure,
      caseId: "symbolic-cas-closure-fixture"
    },
    {
      label: "SMT",
      report: ledger.latestSmtClosure,
      caseId: "smt-bounded-closure-fixture"
    }
  ];

  for (const item of required) {
    if (!item.report) {
      warnings.push(`No saved Docker ${item.label} hard-math closure report found for ${item.caseId}.`);
    } else if (closureStatus(item.report) !== "passed") {
      warnings.push(`Latest Docker ${item.label} hard-math closure report ${item.report.closureId} is ${closureStatus(item.report)}.`);
    }
  }
}

function createReviewerCommands(input: {
  engineRequirements?: EngineVerificationRequirements;
  timeoutMs?: number;
  maximaCommand?: string;
  z3Command?: string;
  cvc5Command?: string;
  leanCommand?: string;
  sageCommand?: string;
  smtSourcePath?: string;
  leanSourcePath?: string;
}): CredibilityPackCommandSet {
  const requirements = input.engineRequirements;
  const requiresAllEngines = Boolean(
    requirements?.maxima && requirements.z3 && requirements.cvc5 && requirements.lean && requirements.sage
  );
  const engineFlags = requiresAllEngines
    ? ["--require-all-engines"]
    : [
        requirements?.maxima ? "--require-maxima" : undefined,
        requirements?.z3 ? "--require-z3" : undefined,
        requirements?.cvc5 ? "--require-cvc5" : undefined,
        requirements?.lean ? "--require-lean" : undefined,
        requirements?.sage ? "--require-sage" : undefined
      ].filter((flag): flag is string => Boolean(flag));
  const engineOptions = [
    input.timeoutMs !== undefined ? `--timeout-ms ${input.timeoutMs}` : undefined,
    input.maximaCommand ? `--maxima-command ${quoteCommandArg(input.maximaCommand)}` : undefined,
    input.z3Command ? `--z3-command ${quoteCommandArg(input.z3Command)}` : undefined,
    input.cvc5Command ? `--cvc5-command ${quoteCommandArg(input.cvc5Command)}` : undefined,
    input.leanCommand ? `--lean-command ${quoteCommandArg(input.leanCommand)}` : undefined,
    input.sageCommand ? `--sage-command ${quoteCommandArg(input.sageCommand)}` : undefined,
    input.smtSourcePath ? `--smt-source ${quoteCommandArg(input.smtSourcePath)}` : undefined,
    input.leanSourcePath ? `--lean-source ${quoteCommandArg(input.leanSourcePath)}` : undefined
  ].filter((flag): flag is string => Boolean(flag));
  const engineSuffix = [...engineFlags, ...engineOptions].length > 0
    ? ` ${[...engineFlags, ...engineOptions].join(" ")}`
    : "";

  return {
    validateWorkspace: "truth-harness workspace validate .",
    verifyEngines: `truth-harness engines verify --write${engineSuffix}`,
    runAdversarialBenchmark: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
    runMathCredibilityLadder: "truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures",
    runExactHardMathClosure: "npm run docker:hard-math-closure",
    runSymbolicHardMathClosure: "npm run docker:symbolic-closure",
    runSmtHardMathClosure: "npm run docker:smt-closure",
    reviewWorkspace: "truth-harness workspace review .",
    reproducePack: `truth-harness workspace credibility-pack .${engineSuffix}`,
    dockerProfessorEvidence: "npm run docker:professor",
    dockerStrictProfessorEvidence: "npm run docker:professor:all",
    dockerCoreEngines: "npm run docker:engines",
    dockerLeanFixture: "docker compose run --rm lean-proof npm run cli -- engines verify --require-lean",
    dockerSageFixture: "npm run docker:sage",
    dockerAllEngines: "npm run docker:all-engines:write"
  };
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/u.test(value) ? value : JSON.stringify(value);
}

function reviewerEngineActionCommand(
  item: EngineVerificationReport["cases"][number],
  commands: CredibilityPackCommandSet
): string {
  if (!isHostProcessBlocked(item.summary)) {
    return commands.verifyEngines;
  }
  if (commands.verifyEngines.includes("--require-all-engines")) {
    return commands.dockerAllEngines;
  }

  switch (item.id) {
    case "maxima-symbolic-cross-check":
    case "z3-smt-check":
    case "cvc5-smt-check":
      return commands.dockerCoreEngines;
    case "lean-proof-fixture":
      return commands.dockerLeanFixture;
    case "sage-symbolic-cross-check":
      return commands.dockerSageFixture;
  }
}

const PROFESSOR_ENGINE_CAPABILITIES = ["maxima-cas", "z3-smt-solver", "cvc5-smt-solver", "lean-proof-checker"] as const;

export function formatCredibilityPackEngineEvidenceSummary(pack: Pick<CredibilityPack, "summary">): string {
  const liveSummary =
    `${pack.summary.engineStatus} (` +
    `${pack.summary.concreteEngineGates} concrete gates, ` +
    `${pack.summary.requiredEngineGates} required gates, ` +
    `${pack.summary.engineEvidenceMinted} evidence records earned)`;
  const savedCoverage = savedEngineEvidenceCoverageLabel(pack);
  if (savedCoverage && pack.summary.engineStatus !== "passed") {
    return `${savedCoverage}; live host smoke: ${liveSummary}`;
  }
  return liveSummary;
}

export function formatCredibilityPackSavedEngineRunLedgerLabel(pack: Pick<CredibilityPack, "summary">): string {
  const labels: string[] = [];
  if (pack.summary.latestProfessorEngineRunStatus) {
    labels.push(`latest professor Docker: ${pack.summary.latestProfessorEngineRunStatus}`);
  }
  if (pack.summary.latestStrictEngineRunStatus) {
    labels.push(`latest strict reviewer: ${pack.summary.latestStrictEngineRunStatus}`);
  }
  return labels.length > 0 ? ` (${labels.join(", ")})` : "";
}

function savedEngineEvidenceCoverageLabel(pack: Pick<CredibilityPack, "summary">): string | undefined {
  if (pack.summary.latestStrictEngineRunStatus === "passed") {
    return "saved strict Docker evidence covers these gates";
  }
  if (pack.summary.latestProfessorEngineRunStatus === "passed") {
    return "saved Docker professor evidence covers these gates";
  }
  return undefined;
}

function concreteEngineCases(report: EngineVerificationReport): EngineVerificationReport["cases"] {
  return report.cases.filter((entry) => {
    if (entry.id === "sage-symbolic-cross-check" || entry.id === "cvc5-smt-check") {
      return entry.required;
    }
    return true;
  });
}

function caseGapIsCoveredBySavedRun(
  item: EngineVerificationReport["cases"][number],
  ledger: CredibilityPackEngineRunLedger
): boolean {
  if (item.status === "passed" || item.status === "not-required") {
    return true;
  }
  if (!isRecoverableEngineProbeGap(item)) {
    return false;
  }
  return hasPassedSavedRunForCapabilities(ledger, [item.capabilityId]);
}

function hasPassedSavedRunForCapabilities(ledger: CredibilityPackEngineRunLedger, capabilities: readonly string[]): boolean {
  const candidates = [
    ledger.latestProfessorReviewerRun,
    ledger.latestStrictReviewerRun,
    ...ledger.latestRuns
  ].filter((run): run is EngineVerificationRunSummary => run !== undefined);

  return candidates.some((run) =>
    run.status === "passed" &&
    capabilities.every((capability) => run.tags.includes(capability))
  );
}

function isPassedProfessorEngineRun(run: EngineVerificationRunSummary): boolean {
  return run.status === "passed" && PROFESSOR_ENGINE_CAPABILITIES.every((capability) => run.tags.includes(capability));
}

function isRecoverableEngineProbeGap(item: EngineVerificationReport["cases"][number]): boolean {
  return item.status === "missing" || isHostProcessBlocked(item.summary) || /\bspawn(?:Sync)?\b.*\bENOENT\b/iu.test(item.summary);
}

function reviewerEngineActionDetail(
  item: EngineVerificationReport["cases"][number],
  command: string,
  commands: CredibilityPackCommandSet
): string {
  if (command === commands.verifyEngines) {
    return "rerun the writable reviewer command after installing or fixing the backend";
  }
  if (command === commands.dockerAllEngines) {
    return "run the heavy no-network all-engine gate because strict review requires Maxima, Z3, cvc5, Lean, and SageMath evidence";
  }
  if (item.id === "maxima-symbolic-cross-check" || item.id === "z3-smt-check" || item.id === "cvc5-smt-check") {
    return "run the no-network Docker core gate because the host blocked direct Maxima/Z3/cvc5 execution";
  }
  if (item.id === "lean-proof-fixture") {
    return "run the pinned no-network Lean Docker fixture because the host blocked direct Lean execution";
  }
  if (item.id === "sage-symbolic-cross-check") {
    return "run the heavier no-network Sage Docker gate because the host blocked direct Sage execution";
  }
  return "use the reviewer command shown here";
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before creating a credibility pack.");
  }
  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}. Run \`truth-harness workspace repair\`.`);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

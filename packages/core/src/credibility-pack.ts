import { mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import {
  listEngineVerificationRuns,
  verifyEngineEvidence,
  type EngineVerificationCommandRunner,
  type EngineVerificationReport,
  type EngineVerificationRequirements,
  type EngineVerificationRunSummary
} from "./engine-verification.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
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
  reviewWorkspace: string;
  reproducePack: string;
  dockerCoreEngines: string;
  dockerLeanFixture: string;
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

export type CredibilityPackActionCategory = "validation" | "engine" | "workspace-review";

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
  latestStrictReviewerRun?: EngineVerificationRunSummary;
}

export interface CredibilityPack {
  schemaVersion: "truth-harness.credibility-pack.v0";
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
    reviewItems: number;
    criticalReviewItems: number;
    highReviewItems: number;
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
  engineRunLedger: CredibilityPackEngineRunLedger;
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
  const review = await createWorkspaceReview({
    rootPath: status.root,
    maxRoutes: input.maxRoutes,
    maxClaims: input.maxClaims,
    maxSessions: input.maxSessions,
    now: createdAt
  });
  const reviewerCommands = createReviewerCommands(input.engineRequirements);
  const warnings = credibilityWarnings({
    validation,
    engineEvidence,
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
      reviewItems: review.summary.totalItems,
      criticalReviewItems: review.summary.criticalItems,
      highReviewItems: review.summary.highItems,
      professorReady: statusLabel === "ready-for-review"
    },
    embeddedSnapshot: snapshot,
    validation: summarizeValidation(validation),
    engineEvidence,
    engineRunLedger,
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
    `- Engine evidence: ${pack.summary.engineStatus} (${pack.summary.concreteEngineGates} concrete gates, ${pack.summary.requiredEngineGates} required gates, ${pack.summary.engineEvidenceMinted} evidence records earned)`,
    `- Saved engine-run ledger: ${pack.summary.savedEngineRuns} saved${pack.summary.latestStrictEngineRunStatus ? ` (latest strict reviewer: ${pack.summary.latestStrictEngineRunStatus})` : ""}`,
    `- Embedded artifact snapshot: ${pack.summary.snapshotFiles} files, ${pack.summary.snapshotBytes} bytes`,
    `- Open work queue: ${pack.summary.reviewItems} items (${pack.summary.criticalReviewItems} critical, ${pack.summary.highReviewItems} high)`,
    `- Reviewer action plan: ${pack.reviewerActionPlan.totalActions} actions (${pack.reviewerActionPlan.criticalActions} critical, ${pack.reviewerActionPlan.highActions} high)`,
    "",
    "## Reviewer Commands",
    "",
    `- Validate workspace: \`${pack.reviewerCommands.validateWorkspace}\``,
    `- Verify engines: \`${pack.reviewerCommands.verifyEngines}\``,
    `- Review open obligations: \`${pack.reviewerCommands.reviewWorkspace}\``,
    `- Reproduce this pack: \`${pack.reviewerCommands.reproducePack}\``,
    `- Docker core engines: \`${pack.reviewerCommands.dockerCoreEngines}\``,
    `- Docker Lean fixture: \`${pack.reviewerCommands.dockerLeanFixture}\``,
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
    latestStrictReviewerRun: runs.find((run) => run.requiredTotal >= 5)
  };
}

function createReviewerActionPlan(input: {
  validation: WorkspaceValidation;
  engineEvidence: EngineVerificationReport;
  engineRunLedger: CredibilityPackEngineRunLedger;
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
    if (!item.required && (item.id === "cvc5-smt-check" || item.id === "sage-symbolic-cross-check")) {
      continue;
    }

    const priority: WorkspaceReviewItem["priority"] = item.required ? "critical" : "high";
    pushAction({
      category: "engine",
      priority,
      title: `${item.required ? "Close required" : "Close concrete"} ${item.displayName} gate`,
      detail: `${reviewerEngineSummary(item.summary)} This gate currently reports ${item.status}; rerun the writable reviewer command after installing or fixing the backend.`,
      command: input.reviewerCommands.verifyEngines,
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

  for (const item of input.review.items.slice(0, 8)) {
    pushAction({
      category: "workspace-review",
      priority: item.priority,
      title: item.title,
      detail: item.summary,
      command: item.command,
      closes: [
        item.kind,
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
    return priorityRank[left.priority] - priorityRank[right.priority] || left.title.localeCompare(right.title);
  });

  return {
    totalActions: sorted.length,
    criticalActions: sorted.filter((item) => item.priority === "critical").length,
    highActions: sorted.filter((item) => item.priority === "high").length,
    actions: sorted
  };
}

function reviewerEngineSummary(summary: string): string {
  if (/\bspawn(?:Sync)?\b.*\bEPERM\b/iu.test(summary)) {
    return "The local OS or sandbox blocked the engine process, so Truth Harness did not count this backend as reviewer evidence.";
  }
  if (/\bspawn(?:Sync)?\b.*\bENOENT\b/iu.test(summary)) {
    return "The configured engine executable was not found, so Truth Harness did not count this backend as reviewer evidence.";
  }

  return summary;
}

function credibilityWarnings(input: {
  validation: WorkspaceValidation;
  engineEvidence: EngineVerificationReport;
  review: WorkspaceReview;
}): string[] {
  const warnings: string[] = [];

  if (!input.validation.passed) {
    warnings.push(`Workspace validation failed with ${input.validation.summary.errors} error(s).`);
  }
  if (input.engineEvidence.requiredTotal > 0 && input.engineEvidence.requiredPassed !== input.engineEvidence.requiredTotal) {
    warnings.push(
      `Required engine evidence gates are incomplete: ${input.engineEvidence.requiredPassed}/${input.engineEvidence.requiredTotal} passed.`
    );
  }
  if (input.engineEvidence.concretePassed !== input.engineEvidence.concreteTotal) {
    warnings.push(
      `Concrete engine smoke gates are incomplete: ${input.engineEvidence.concretePassed}/${input.engineEvidence.concreteTotal} passed.`
    );
  }
  if (input.review.summary.criticalItems > 0) {
    warnings.push(`Workspace review has ${input.review.summary.criticalItems} critical open item(s).`);
  }

  return [...new Set(warnings)];
}

function createReviewerCommands(requirements: EngineVerificationRequirements | undefined): CredibilityPackCommandSet {
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
  const engineSuffix = engineFlags.length > 0 ? ` ${engineFlags.join(" ")}` : "";

  return {
    validateWorkspace: "truth-harness workspace validate .",
    verifyEngines: `truth-harness engines verify --write${engineSuffix}`,
    reviewWorkspace: "truth-harness workspace review .",
    reproducePack: `truth-harness workspace credibility-pack .${engineSuffix}`,
    dockerCoreEngines: "npm run docker:engines",
    dockerLeanFixture: "docker compose run --rm lean-proof npm run cli -- engines verify --require-lean"
  };
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

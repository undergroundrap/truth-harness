import { mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { verifyEngineEvidence, type EngineVerificationCommandRunner, type EngineVerificationReport, type EngineVerificationRequirements } from "./engine-verification.js";
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
  workspaceReview: {
    reviewId: string;
    summary: WorkspaceReview["summary"];
    autonomy: Pick<WorkspaceReview["autonomy"], "mode" | "canRunUnattended" | "suggestedBatchSize" | "nextCommand" | "stopConditions">;
    topItems: CredibilityPackReviewItem[];
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
      reviewItems: review.summary.totalItems,
      criticalReviewItems: review.summary.criticalItems,
      highReviewItems: review.summary.highItems,
      professorReady: statusLabel === "ready-for-review"
    },
    embeddedSnapshot: snapshot,
    validation: summarizeValidation(validation),
    engineEvidence,
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
    `- Embedded artifact snapshot: ${pack.summary.snapshotFiles} files, ${pack.summary.snapshotBytes} bytes`,
    `- Open work queue: ${pack.summary.reviewItems} items (${pack.summary.criticalReviewItems} critical, ${pack.summary.highReviewItems} high)`,
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
    "## Engine Gates",
    ""
  ];

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
  const engineFlags = [
    requirements?.maxima ? "--require-maxima" : undefined,
    requirements?.z3 ? "--require-z3" : undefined,
    requirements?.cvc5 ? "--require-cvc5" : undefined,
    requirements?.lean ? "--require-lean" : undefined,
    requirements?.sage ? "--require-sage" : undefined
  ].filter((flag): flag is string => Boolean(flag));
  const engineSuffix = engineFlags.length > 0 ? ` ${engineFlags.join(" ")}` : "";

  return {
    validateWorkspace: "truth-harness workspace validate .",
    verifyEngines: `truth-harness engines verify${engineSuffix}`,
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

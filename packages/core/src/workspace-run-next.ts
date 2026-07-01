import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import {
  parseBenchmarkRunRecordJson,
  writeBenchmarkComparisonRecord,
  writeBenchmarkRunRecord,
  type BenchmarkRunLike,
  type BenchmarkRunTaskLike,
  type BenchmarkRunTaskResultLike
} from "./benchmark-run.js";
import {
  CLAIM_LEDGER_DOMAINS,
  CLAIM_LEDGER_STATUSES,
  createClaimReviewPacket,
  writeClaimLedgerRecord,
  type ClaimLedgerDomain,
  type ClaimLedgerEvidenceRef,
  type ClaimLedgerStatus
} from "./claim-ledger.js";
import { orderCredibilityActionsForRunNext } from "./credibility-action-order.js";
import type { CredibilityPack } from "./credibility-pack.js";
import {
  getCasBackendStatus,
  writeSymbolicCasCheckRecord,
  type SymbolicCasBackendId
} from "./cas-backend.js";
import { createEnginePlan, type CreateEnginePlanOptions, type EnginePlan } from "./engine-plan.js";
import {
  isExpertReviewKind,
  isExpertReviewOutcome,
  isExpertReviewStatus,
  writeExpertReview,
  type ExpertReviewEvidenceRef,
  type ExpertReviewKind,
  type ExpertReviewOutcome,
  type ExpertReviewStatus
} from "./expert-review.js";
import { writeEngineVerificationRun, type EngineVerificationRequirements } from "./engine-verification.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { inspectLeanProject } from "./lean-project.js";
import { getProofBackendStatus, writeLeanProofCheckRecord } from "./proof-backend.js";
import { readReportDraft } from "./report-draft.js";
import { createReceipt } from "./receipt.js";
import {
  addResearchSessionCheckpoint,
  readResearchSession,
  type ResearchEvidenceRef,
  type ResearchSessionCheckpointWriteResult
} from "./research-session.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { getSmtBackendStatus, writeSmtCheckRecord, type SmtBackendId } from "./smt-backend.js";
import type { SympyOperation } from "./sympy.js";
import type { Receipt, TrustLabel } from "./types.js";
import {
  attachValidationGateEvidence,
  type AttachValidationGateEvidenceResult,
  type ValidationEvidenceRef
} from "./validation-plan.js";
import {
  readVerifierRoute,
  satisfyVerifierRouteObligation,
  writeVerifierRoute,
  type SatisfyVerifierRouteObligationResult,
  type VerifierRouteEvidenceRef
} from "./verifier-route.js";
import { refreshWorkspaceCatalogArtifact, searchWorkspaceCatalog } from "./workspace-catalog.js";
import { verifyWorkspaceSnapshot, writeWorkspaceSnapshot } from "./workspace-snapshot.js";
import {
  verifyWorkspaceRevision,
  writeWorkspaceRevision,
  type WorkspaceRevisionVerification
} from "./workspace-revision.js";
import type { WorkspaceReview, WorkspaceReviewItem } from "./workspace-review.js";

export type WorkspaceRunNextStatus = "planned" | "executed" | "blocked";
const WORKSPACE_RUN_NEXT_SCHEMA_VERSION = "truth-harness.workspace-run-next.v0" as const;

export interface WorkspaceRunNextWriteResult {
  plan: WorkspaceRunNextPlan;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface WorkspaceRunNextSourceSnapshot {
  snapshotId: string;
  path: string;
  totalFiles: number;
  totalBytes: number;
}

export interface WorkspaceRunNextSourceRevision {
  revisionId: string;
  path: string;
  sourceSnapshotId: string;
  sourceSnapshotPath: string;
  totalFiles: number;
  totalBytes: number;
}

export type WorkspaceRunNextArtifactRefRole =
  | "run-next-packet"
  | "source-revision"
  | "source-snapshot"
  | "candidate-evidence"
  | "execution-evidence"
  | "referenced-artifact";

export interface WorkspaceRunNextArtifactRef {
  path: string;
  role: WorkspaceRunNextArtifactRefRole;
  source: string;
  sizeBytes?: number;
  sha256?: string;
  sha256Scope?: "file";
  citation?: string;
}

export interface WorkspaceRunNextImpactRef {
  refPath: string;
  citedByPath: string;
  citedByKind: string;
  source: "workspace-catalog";
  citedByArtifactId?: string;
  citedByTitle?: string;
  citedByTrust?: TrustLabel;
  citedByStatus?: string;
  fieldPath?: string;
  refKind?: string;
}

export type WorkspaceRunNextRevalidationPriority = "high" | "medium";

export interface WorkspaceRunNextRevalidationItem {
  itemId: string;
  refPath: string;
  dependentPath: string;
  dependentKind: string;
  source: "impact-ref";
  priority: WorkspaceRunNextRevalidationPriority;
  reason: string;
  command: string;
  evidenceRequired: string;
  boundary: string;
  dependentArtifactId?: string;
  dependentTitle?: string;
  dependentTrust?: TrustLabel;
  dependentStatus?: string;
  fieldPath?: string;
}

export type WorkspaceRunNextSourceSnapshotStatus = "not-recorded" | "verified" | "drifted" | "missing";
export type WorkspaceRunNextResumeStatus =
  | "safe-to-resume"
  | "choose-idle-action"
  | "verify-snapshot-first"
  | "rerun-run-next";
export type WorkspaceRunNextResumeAction =
  | "run-selected-command"
  | "choose-idle-action"
  | "verify-source-snapshot"
  | "rerun-workspace-run-next";

export interface WorkspaceRunNextListOptions {
  verifySnapshots?: boolean;
  limit?: number;
  now?: string;
}

export type WorkspaceRunNextSourceSnapshotCheck = Pick<
  WorkspaceRunNextSummary,
  | "sourceSnapshotStatus"
  | "sourceSnapshotVerifiedAt"
  | "sourceSnapshotMissing"
  | "sourceSnapshotChanged"
  | "sourceSnapshotAdded"
  | "sourceSnapshotIgnoredAdded"
  | "sourceSnapshotDriftSummary"
>;

export type WorkspaceRunNextSourceRevisionCheck = Pick<
  WorkspaceRunNextSummary,
  | "sourceRevisionStatus"
  | "sourceRevisionVerifiedAt"
  | "sourceRevisionMissing"
  | "sourceRevisionChanged"
  | "sourceRevisionAdded"
  | "sourceRevisionIgnoredAdded"
  | "sourceRevisionDriftSummary"
>;

export interface WorkspaceRunNextInspection {
  schemaVersion: "truth-harness.workspace-run-next-inspection.v0";
  plan: WorkspaceRunNextPlan;
  path: string;
  artifactRefs?: WorkspaceRunNextArtifactRef[];
  impactRefs?: WorkspaceRunNextImpactRef[];
  revalidationQueue?: WorkspaceRunNextRevalidationItem[];
  sourceRevision?: WorkspaceRunNextSourceRevisionCheck;
  sourceSnapshot?: WorkspaceRunNextSourceSnapshotCheck;
  resumeDecision: WorkspaceRunNextResumeDecision;
}

export interface WorkspaceRunNextSavedHandoffInput {
  rootPath: string;
  planRef: string;
  executeLocal: boolean;
  now?: string;
  enginePlanOptions?: CreateEnginePlanOptions;
}

export interface WorkspaceRunNextSavedHandoffResult {
  plan: WorkspaceRunNextPlan;
  sourcePlan: WorkspaceRunNextPlan;
  sourcePlanPath: string;
  inspection: WorkspaceRunNextInspection;
}

export interface WorkspaceRunNextResumeDecision {
  safeToResume: boolean;
  status: WorkspaceRunNextResumeStatus;
  action: WorkspaceRunNextResumeAction;
  reason: string;
  nextCommand: string;
}

export interface WorkspaceRunNextProofRepairTargetSummary {
  repairTargetId: string;
  sourcePath: string;
  sourceSha256: string;
  markerKind: NonNullable<WorkspaceReviewItem["proofRepairTarget"]>["markerKind"];
  markerLine: number;
  markerColumn: number;
  declarationId?: string;
  declarationName?: string;
  declarationSignatureSha256?: string;
  afterEditCommand?: string;
  evidenceRequired: string[];
  boundary: string;
}

export interface WorkspaceRunNextProofAttemptHistorySummary {
  total: number;
  latestCheckId: string;
  latestStatus: NonNullable<WorkspaceReviewItem["proofAttempt"]>["status"];
  latestSourcePath: string;
  latestSourceStatus?: NonNullable<WorkspaceReviewItem["proofAttempt"]>["sourceStatus"];
  latestDiagnosticSnippet?: string;
  priorCheckIds: string[];
}

export interface WorkspaceRunNextSummary {
  schemaVersion: typeof WORKSPACE_RUN_NEXT_SCHEMA_VERSION;
  planId: string;
  createdAt: string;
  path: string;
  localOnly: true;
  networkAccess: "none";
  dryRun: boolean;
  status: WorkspaceRunNextStatus;
  mode: WorkspaceReview["autonomy"]["mode"];
  reviewId: string;
  itemTitle?: string;
  itemKind?: WorkspaceReviewItem["kind"];
  itemPriority?: WorkspaceReviewItem["priority"];
  proofRepairTargetSummary?: WorkspaceRunNextProofRepairTargetSummary;
  proofAttemptHistorySummary?: WorkspaceRunNextProofAttemptHistorySummary;
  executionKind: string;
  executionStatus: WorkspaceRunNextStatus;
  rationaleTarget?: string;
  rationaleSource?: string;
  rationaleCandidateEvidenceRef?: string;
  rationaleExecutionBoundary?: string;
  enginePlanStatus?: EnginePlan["status"];
  enginePlanClassifications?: EnginePlan["classifications"];
  enginePlanTargetTrustCeiling?: EnginePlan["targetTrustCeiling"];
  enginePlanRecommendedFirstCommand?: string;
  artifactRefs?: WorkspaceRunNextArtifactRef[];
  impactRefs?: WorkspaceRunNextImpactRef[];
  revalidationQueue?: WorkspaceRunNextRevalidationItem[];
  sourceRevisionId?: string;
  sourceRevisionPath?: string;
  sourceRevisionSourceSnapshotId?: string;
  sourceRevisionSourceSnapshotPath?: string;
  sourceRevisionStatus?: WorkspaceRunNextSourceSnapshotStatus;
  sourceRevisionVerifiedAt?: string;
  sourceRevisionMissing?: number;
  sourceRevisionChanged?: number;
  sourceRevisionAdded?: number;
  sourceRevisionIgnoredAdded?: number;
  sourceRevisionDriftSummary?: string;
  sourceSnapshotId?: string;
  sourceSnapshotPath?: string;
  sourceSnapshotFiles?: number;
  sourceSnapshotBytes?: number;
  sourceSnapshotStatus?: WorkspaceRunNextSourceSnapshotStatus;
  sourceSnapshotVerifiedAt?: string;
  sourceSnapshotMissing?: number;
  sourceSnapshotChanged?: number;
  sourceSnapshotAdded?: number;
  sourceSnapshotIgnoredAdded?: number;
  sourceSnapshotDriftSummary?: string;
  resumeDecision: WorkspaceRunNextResumeDecision;
}

export interface WorkspaceRunNextRationale {
  target: string;
  source: string;
  candidateEvidenceRef?: string;
  executionBoundary: string;
  firstStopCondition?: string;
  firstWarning?: string;
}

export interface WorkspaceRunNextIdleAction {
  actionId: string;
  title: string;
  command: string;
  reason: string;
  boundary: string;
  requiresHumanInput: boolean;
}

export interface WorkspaceRunNextPlan {
  schemaVersion: typeof WORKSPACE_RUN_NEXT_SCHEMA_VERSION;
  planId: string;
  createdAt: string;
  workspacePath: string;
  localOnly: true;
  networkAccess: "none";
  dryRun: boolean;
  status: WorkspaceRunNextStatus;
  mode: WorkspaceReview["autonomy"]["mode"];
  reviewId: string;
  item?: Pick<
    WorkspaceReviewItem,
    | "itemId"
    | "kind"
    | "priority"
    | "title"
    | "summary"
    | "command"
    | "routeId"
    | "obligationId"
    | "obligationKind"
    | "claimId"
    | "sessionId"
    | "validationPlanId"
    | "validationGateId"
    | "validationGateKind"
    | "proofDeclaration"
    | "proofAttempt"
    | "proofAttemptHistory"
    | "proofRepairTarget"
    | "reportId"
  >;
  execution: {
    status: WorkspaceRunNextStatus;
    kind: string;
    summary: string;
    command?: string;
    evidenceRef?: string;
    attached?: boolean;
    result?: unknown;
  };
  rationale?: WorkspaceRunNextRationale;
  enginePlan?: EnginePlan;
  idleNextActions?: WorkspaceRunNextIdleAction[];
  sourceRevision?: WorkspaceRunNextSourceRevision;
  sourceSnapshot?: WorkspaceRunNextSourceSnapshot;
  artifactRefs?: WorkspaceRunNextArtifactRef[];
  impactRefs?: WorkspaceRunNextImpactRef[];
  revalidationQueue?: WorkspaceRunNextRevalidationItem[];
  stopConditions: string[];
  warnings: string[];
}

interface RunNextBenchmarkSuite {
  id: string;
  title: string;
  description: string;
  tasks: BenchmarkRunTaskLike[];
}

export async function createWorkspaceRunNextPlan(input: {
  rootPath: string;
  review: WorkspaceReview;
  executeLocal: boolean;
  now?: string;
  enginePlanOptions?: CreateEnginePlanOptions;
}): Promise<WorkspaceRunNextPlan> {
  const createdAt = input.now ?? new Date().toISOString();
  const planId = workspaceRunNextPlanId(createdAt, input.review.reviewId);
  const nextItem = input.review.autonomy.nextItemId
    ? input.review.items.find((item) => item.itemId === input.review.autonomy.nextItemId)
    : undefined;
  const enginePlan = nextItem
    ? workspaceRunNextEnginePlanFor(nextItem, createdAt, input.enginePlanOptions)
    : undefined;
  const engineGuidance = workspaceRunNextEngineGuidance(enginePlan);
  const noNextItemSummary = input.review.items.length > 0
    ? "No executable local work item is available; remaining review items are passive inspection blockers."
    : "No open workspace review item is available.";
  const dryRunExecution = workspaceRunNextDryRunExecution(nextItem, engineGuidance, noNextItemSummary);
  const basePlan: WorkspaceRunNextPlan = {
    schemaVersion: WORKSPACE_RUN_NEXT_SCHEMA_VERSION,
    planId,
    createdAt,
    workspacePath: input.rootPath,
    localOnly: true,
    networkAccess: "none",
    dryRun: !input.executeLocal,
    status: dryRunExecution.status === "blocked" ? "blocked" : "planned",
    mode: input.review.autonomy.mode,
    reviewId: input.review.reviewId,
    item: nextItem ? workspaceRunNextItemSummary(nextItem) : undefined,
    ...(enginePlan ? { enginePlan } : {}),
    execution: dryRunExecution,
    stopConditions: [...input.review.autonomy.stopConditions, ...engineGuidance.stopConditions],
    warnings: [
      "Run-next never executes shell strings. Only supported local Truth Harness actions can run.",
      "Execution can create evidence artifacts, but trust labels change only when matching obligations accept those artifacts.",
      ...engineGuidance.warnings
    ]
  };

  if (!nextItem) {
    return finalizeWorkspaceRunNextPlan(input.rootPath, {
      ...basePlan,
      status: "blocked",
      idleNextActions: workspaceRunNextIdleActions(input.rootPath),
      execution: {
        status: "blocked",
        kind: "no-open-item",
        summary: `${noNextItemSummary} Use idle next actions to start a validation-backed session or refresh reviewer evidence.`
      }
    });
  }

  if (!input.executeLocal) {
    return finalizeWorkspaceRunNextPlan(input.rootPath, basePlan);
  }

  if (!input.review.autonomy.canRunUnattended) {
    return finalizeWorkspaceRunNextPlan(input.rootPath, {
      ...basePlan,
      status: "blocked",
      execution: {
        status: "blocked",
        kind: "autonomy-contract",
        command: nextItem.command,
        summary: "The autonomy contract does not allow unattended local work."
      }
    });
  }

  const execution = await executeWorkspaceRunNextItem(input.rootPath, nextItem);
  return finalizeWorkspaceRunNextPlan(input.rootPath, {
    ...basePlan,
    status: execution.status,
    execution
  });
}

function workspaceRunNextDryRunExecution(
  item: WorkspaceReviewItem | undefined,
  engineGuidance: { dryRunSummary?: string },
  noNextItemSummary: string
): WorkspaceRunNextPlan["execution"] {
  if (!item) {
    return {
      status: "planned",
      kind: "dry-run",
      summary: noNextItemSummary
    };
  }

  const proofRepair = workspaceRunNextProofRepairDryRunExecution(item);
  if (proofRepair) {
    return proofRepair;
  }

  const manualBoundary = manualContainerGateBoundary(item.command);
  if (manualBoundary) {
    return {
      ...manualBoundary,
      summary: `Dry-run preflight: ${manualBoundary.summary}`
    };
  }

  return {
    status: "planned",
    kind: "dry-run",
    summary:
      engineGuidance.dryRunSummary ??
      "Dry-run only. Re-run with --execute-local to run one supported local Truth Harness action."
  };
}

function workspaceRunNextProofRepairDryRunExecution(
  item: WorkspaceReviewItem
): WorkspaceRunNextPlan["execution"] | undefined {
  const attempt = item.proofAttempt;
  if (!attempt || !/^truth-harness\s+proof\s+check\b/u.test(item.command)) {
    return undefined;
  }

  if (attempt.sourceStatus === "unchanged") {
    return {
      status: "planned",
      kind: "proof-repair-source-unchanged",
      command: item.command,
      summary: `Dry-run preflight: proof source ${attempt.sourcePath} is unchanged since failed attempt ${attempt.checkId}. Edit the Lean source before running --execute-local.`
    };
  }

  if (attempt.sourceStatus === "changed") {
    return {
      status: "planned",
      kind: "proof-repair-source-changed",
      command: item.command,
      summary: `Dry-run preflight: proof source ${attempt.sourcePath} changed since failed attempt ${attempt.checkId}. Re-run this scoped proof check to create fresh evidence.`
    };
  }

  if (attempt.sourceStatus === "missing") {
    return {
      status: "planned",
      kind: "proof-repair-source-missing",
      command: item.command,
      summary: `Dry-run preflight: proof source ${attempt.sourcePath} is missing. Restore or recreate it before running --execute-local.`
    };
  }

  if (attempt.sourceStatus === "unchecked") {
    return {
      status: "planned",
      kind: "proof-repair-source-unchecked",
      command: item.command,
      summary: `Dry-run preflight: proof source status for ${attempt.sourcePath} is unchecked. Inspect the proof artifact before running --execute-local.`
    };
  }

  return undefined;
}

export function createWorkspaceReviewFromCredibilityPack(input: {
  rootPath: string;
  pack: CredibilityPack;
}): WorkspaceReview {
  const actions = orderCredibilityActionsForRunNext(input.pack.reviewerActionPlan.actions);
  const nextAction = actions[0];
  return {
    schemaVersion: "truth-harness.workspace-review.v0",
    reviewId: `wrev_${input.pack.packId}_actions`,
    projectId: input.pack.projectId,
    createdAt: input.pack.createdAt,
    workspacePath: input.rootPath,
    localOnly: true,
    networkAccess: "none",
    privacy: input.pack.privacy,
    summary: {
      routes: input.pack.workspaceReview.summary.routes,
      claims: input.pack.workspaceReview.summary.claims,
      sessions: input.pack.workspaceReview.summary.sessions,
      reportDrafts: input.pack.workspaceReview.summary.reportDrafts ?? 0,
      totalItems: actions.length,
      routeObligations: 0,
      leanProofSafetyItems: actions.filter((action) => action.source.ref.startsWith("lean-marker:")).length,
      readyRoutesWithoutClaims: 0,
      blockedClaims: 0,
      reportDraftReviewItems: 0,
      reportDraftsNeedingAttention: 0,
      sessionTasks: 0,
      sessionNextChecks: 0,
      criticalItems: actions.filter((action) => action.priority === "critical").length,
      highItems: actions.filter((action) => action.priority === "high").length,
      mediumItems: actions.filter((action) => action.priority === "medium").length,
      lowItems: actions.filter((action) => action.priority === "low").length
    },
    autonomy: {
      mode: actions.length > 0 ? "local-verifier-loop" : "idle",
      canRunUnattended: true,
      suggestedBatchSize: 1,
      nextItemId: nextAction?.actionId,
      nextCommand: nextAction?.command,
      allowedActions: ["Run only supported local Truth Harness commands parsed by workspace run-next."],
      blockedActions: ["Do not execute shell strings, network clients, package mutations, or arbitrary code."],
      stopConditions: input.pack.limitations,
      requiredArtifacts: actions.map((action) => action.closes.join(", ")),
      humanReviewRequiredFor: actions.map((action) => action.actionId),
      agentPacket: renderCredibilityActionAgentPacket(input.pack)
    },
    items: actions.map((action) => {
      const validationTarget = credibilityActionValidationTarget(action);
      return {
        itemId: action.actionId,
        kind: validationTarget ? "validation-gate" : "credibility-action",
        priority: action.priority,
        title: action.title,
        summary: action.detail,
        command: action.command,
        ...validationTarget,
        acceptanceCriteria: action.closes.map((target) => `Close ${target}.`),
        agentPacket: `${action.title}\n\n${action.detail}\n\nCommand: ${action.command}`,
        source: {
          label: `credibility ${action.category}`,
          ref: `${input.pack.packId}:${action.source.kind}:${action.source.ref}`
        }
      };
    }),
    warnings: input.pack.warnings,
    markdown: renderCredibilityActionAgentPacket(input.pack)
  };
}

function credibilityActionValidationTarget(action: CredibilityPack["reviewerActionPlan"]["actions"][number]): Pick<
  WorkspaceReviewItem,
  "sessionId" | "validationPlanId" | "validationGateId" | "validationGateKind"
> | undefined {
  if (action.source.kind !== "validation-gate") {
    return undefined;
  }
  const [sessionId, validationPlanId, validationGateId] = action.source.ref.split(":");
  if (!sessionId || !validationPlanId || !validationGateId) {
    return undefined;
  }
  return {
    sessionId,
    validationPlanId,
    validationGateId,
    validationGateKind: validationGateKindFromCredibilityAction(action)
  };
}

function validationGateKindFromCredibilityAction(
  action: CredibilityPack["reviewerActionPlan"]["actions"][number]
): string | undefined {
  const match = /^Validation gate:\s*(?<kind>[A-Za-z0-9_-]+)/u.exec(action.title);
  return match?.groups?.kind;
}

export async function writeWorkspaceRunNextPlan(input: {
  rootPath: string;
  plan: WorkspaceRunNextPlan;
}): Promise<WorkspaceRunNextWriteResult> {
  const status = await requireRunNextWorkspace(input.rootPath);
  const basePlan = withWorkspaceRunNextArtifactRefs({
    ...input.plan,
    workspacePath: status.root
  });
  await assertWorkspaceRunNextPlanSchema(basePlan);
  const revision = await writeWorkspaceRevision({
    rootPath: status.root,
    now: input.plan.createdAt,
    title: workspaceRunNextRevisionTitle(basePlan),
    reason: workspaceRunNextRevisionReason(basePlan),
    sessionRefs: uniqueStrings([basePlan.item?.sessionId]),
    validationPlanRefs: uniqueStrings([basePlan.item?.validationPlanId]),
    claimRefs: uniqueStrings([basePlan.item?.claimId]),
    artifactRefs: workspaceRunNextRevisionArtifactRefs(basePlan)
  });
  const plan = await finalizeWorkspaceRunNextPlan(status.root, {
    ...basePlan,
    sourceRevision: {
      revisionId: revision.revision.revisionId,
      path: toPortablePath(relative(status.root, revision.path)),
      sourceSnapshotId: revision.revision.sourceSnapshot.snapshotId,
      sourceSnapshotPath: revision.revision.sourceSnapshot.path,
      totalFiles: revision.revision.sourceSnapshot.totalFiles,
      totalBytes: revision.revision.sourceSnapshot.totalBytes
    },
    sourceSnapshot: {
      snapshotId: revision.revision.sourceSnapshot.snapshotId,
      path: revision.revision.sourceSnapshot.path,
      totalFiles: revision.revision.sourceSnapshot.totalFiles,
      totalBytes: revision.revision.sourceSnapshot.totalBytes
    }
  });
  await assertWorkspaceRunNextPlanSchema(plan);
  const findingsDir = resolve(status.root, status.manifest.directories.findings);
  const baseName = `${plan.createdAt.slice(0, 10)}-${plan.planId}-workspace-run-next`;
  const jsonPath = join(findingsDir, `${baseName}.json`);
  const markdownPath = join(findingsDir, `${baseName}.md`);
  const markdown = renderWorkspaceRunNextMarkdown(plan);
  await mkdir(findingsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, plan);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "findings",
    now: plan.createdAt,
    staleReason: "workspace run-next plan written"
  });

  return {
    plan,
    jsonPath,
    markdownPath,
    markdown
  };
}

async function assertWorkspaceRunNextPlanSchema(plan: WorkspaceRunNextPlan): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: plan,
    schemaFile: "workspace-run-next.schema.json",
    artifactName: "Workspace run-next plan"
  });
}

export async function listWorkspaceRunNextPlans(
  rootPath: string,
  options: WorkspaceRunNextListOptions = {}
): Promise<WorkspaceRunNextSummary[]> {
  const status = await requireRunNextWorkspace(rootPath);
  const findingsDir = resolve(status.root, status.manifest.directories.findings);

  let files: string[];
  try {
    files = await readdir(findingsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const candidates = (
    await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          const path = join(findingsDir, file);
          const plan = tryParseWorkspaceRunNextJson(await readFile(path, "utf8"));
          if (!plan) {
            return undefined;
          }
          return {
            plan,
            portablePath: toPortablePath(relative(status.root, path))
          };
        })
    )
  )
    .filter((candidate): candidate is { plan: WorkspaceRunNextPlan; portablePath: string } => candidate !== undefined)
    .sort((left, right) => right.plan.createdAt.localeCompare(left.plan.createdAt));

  const selectedCandidates = typeof options.limit === "number" ? candidates.slice(0, options.limit) : candidates;
  const summaries = await Promise.all(
    selectedCandidates.map(async ({ plan, portablePath }) => {
      const sourceChecks = options.verifySnapshots
        ? await verifyRunNextSourceChecks(status.root, plan, portablePath, options.now)
        : {};
      const artifactRefs = await enrichWorkspaceRunNextArtifactRefs(
        status.root,
        workspaceRunNextPacketArtifactRefs(plan, portablePath)
      );
      return summarizeWorkspaceRunNextPlan(
        plan,
        portablePath,
        sourceChecks.sourceSnapshot,
        sourceChecks.sourceRevision,
        artifactRefs
      );
    })
  );

  return summaries;
}

export async function readWorkspaceRunNextPlan(rootPath: string, planRef: string): Promise<WorkspaceRunNextPlan> {
  const status = await requireRunNextWorkspace(rootPath);
  return (await readWorkspaceRunNextPlanWithPath(status, planRef)).plan;
}

export async function inspectWorkspaceRunNextPlan(
  rootPath: string,
  planRef: string,
  options: { verifySnapshot?: boolean; now?: string } = {}
): Promise<WorkspaceRunNextInspection> {
  const status = await requireRunNextWorkspace(rootPath);
  const { plan, path } = await readWorkspaceRunNextPlanWithPath(status, planRef);
  const sourceChecks = options.verifySnapshot
    ? await verifyRunNextSourceChecks(status.root, plan, path, options.now)
    : {};
  const sourceRevision = sourceChecks.sourceRevision;
  const sourceSnapshot = sourceChecks.sourceSnapshot;

  return {
    schemaVersion: "truth-harness.workspace-run-next-inspection.v0",
    plan,
    path,
    artifactRefs: await enrichWorkspaceRunNextArtifactRefs(status.root, workspaceRunNextPacketArtifactRefs(plan, path)),
    ...(plan.impactRefs && plan.impactRefs.length > 0 ? { impactRefs: plan.impactRefs } : {}),
    ...(plan.revalidationQueue && plan.revalidationQueue.length > 0
      ? { revalidationQueue: plan.revalidationQueue }
      : {}),
    resumeDecision: createWorkspaceRunNextResumeDecision(plan, sourceSnapshot, sourceRevision),
    ...(sourceRevision ? { sourceRevision } : {}),
    ...(sourceSnapshot ? { sourceSnapshot } : {})
  };
}

export async function createWorkspaceRunNextPlanFromSavedHandoff(
  input: WorkspaceRunNextSavedHandoffInput
): Promise<WorkspaceRunNextSavedHandoffResult> {
  const status = await requireRunNextWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const inspection = await inspectWorkspaceRunNextPlan(status.root, input.planRef, {
    verifySnapshot: true,
    now: createdAt
  });
  const sourcePlan = inspection.plan;
  const sourcePlanPath = inspection.path;

  if (!inspection.resumeDecision.safeToResume) {
    return {
      plan: await createBlockedSavedHandoffRunNextPlan({
        status,
        sourcePlan,
        sourcePlanPath,
        createdAt,
        executeLocal: input.executeLocal,
        inspection
      }),
      sourcePlan,
      sourcePlanPath,
      inspection
    };
  }

  if (!sourcePlan.item) {
    return {
      plan: await createBlockedSavedHandoffRunNextPlan({
        status,
        sourcePlan,
        sourcePlanPath,
        createdAt,
        executeLocal: input.executeLocal,
        inspection: {
          ...inspection,
          resumeDecision: {
            safeToResume: false,
            status: "rerun-run-next",
            action: "rerun-workspace-run-next",
            reason: "Saved handoff has no selected item to resume.",
            nextCommand: `truth-harness workspace run-next ${quoteCommandArg(status.root)} --json`
          }
        }
      }),
      sourcePlan,
      sourcePlanPath,
      inspection
    };
  }

  const review = createWorkspaceReviewFromSavedRunNextPlan({
    status,
    sourcePlan,
    sourcePlanPath,
    createdAt
  });
  const resumedPlan = await createWorkspaceRunNextPlan({
    rootPath: status.root,
    review,
    executeLocal: input.executeLocal,
    now: createdAt,
    enginePlanOptions: input.enginePlanOptions
  });

  return {
    plan: await finalizeWorkspaceRunNextPlan(status.root, {
      ...resumedPlan,
      rationale: {
        ...workspaceRunNextRationaleFor(resumedPlan),
        source: `saved-run-next:${sourcePlanPath}`,
        candidateEvidenceRef: sourcePlanPath,
        executionBoundary: input.executeLocal
          ? "Resumed from a saved run-next handoff after source revision and source snapshot verification."
          : "Dry-run resume preview from a saved run-next handoff after source revision and source snapshot verification."
      },
      warnings: uniqueStrings([
        `Resumed from saved run-next handoff ${sourcePlan.planId} at ${sourcePlanPath}.`,
        ...resumedPlan.warnings
      ])
    }),
    sourcePlan,
    sourcePlanPath,
    inspection
  };
}

async function readWorkspaceRunNextPlanWithPath(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  planRef: string
): Promise<{ plan: WorkspaceRunNextPlan; path: string }> {
  const ref = requireText(planRef, "Workspace run-next plan ref is required.");

  if (isWorkspaceRunNextPlanId(ref)) {
    const findingsDir = resolve(status.root, status.manifest.directories.findings);
    let files: string[];
    try {
      files = await readdir(findingsDir);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new Error(`Workspace run-next plan not found: ${ref}`);
      }

      throw error;
    }

    for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
      const path = join(findingsDir, file);
      const plan = tryParseWorkspaceRunNextJson(await readFile(path, "utf8"));
      if (plan?.planId === ref) {
        return {
          plan,
          path: toPortablePath(relative(status.root, path))
        };
      }
    }

    throw new Error(`Workspace run-next plan not found: ${ref}`);
  }

  const path = resolveUnderRoot(status.root, ref);
  return {
    plan: parseWorkspaceRunNextJson(await readFile(path, "utf8")),
    path: toPortablePath(relative(status.root, path))
  };
}

export function parseWorkspaceRunNextJson(raw: string): WorkspaceRunNextPlan {
  const plan = JSON.parse(raw) as WorkspaceRunNextPlan;
  if (plan.schemaVersion !== WORKSPACE_RUN_NEXT_SCHEMA_VERSION) {
    throw new Error(`Unsupported workspace run-next schema: ${JSON.stringify(plan.schemaVersion)}`);
  }
  if (!isWorkspaceRunNextPlanId(plan.planId)) {
    throw new Error(`Invalid workspace run-next plan id: ${JSON.stringify(plan.planId)}`);
  }
  if (plan.localOnly !== true || plan.networkAccess !== "none") {
    throw new Error("Workspace run-next plans must be local-only with networkAccess none.");
  }

  return plan;
}

export function renderWorkspaceRunNextMarkdown(plan: WorkspaceRunNextPlan): string {
  const item = plan.item;
  const lines = [
    "# Truth Harness Run-Next Plan",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Plan | \`${plan.planId}\` |`,
    `| Review | \`${plan.reviewId}\` |`,
    `| Created | ${escapeMarkdownTable(plan.createdAt)} |`,
    ...(plan.sourceRevision
      ? [`| Source revision | \`${plan.sourceRevision.revisionId}\` (${escapeMarkdownTable(plan.sourceRevision.path)}) |`]
      : []),
    ...(plan.sourceSnapshot
      ? [`| Source snapshot | \`${plan.sourceSnapshot.snapshotId}\` (${escapeMarkdownTable(plan.sourceSnapshot.path)}) |`]
      : []),
    `| Local only | \`${String(plan.localOnly)}\` |`,
    `| Network | \`${plan.networkAccess}\` |`,
    `| Dry run | \`${String(plan.dryRun)}\` |`,
    `| Status | \`${plan.status}\` |`,
    `| Mode | \`${plan.mode}\` |`,
    "",
    "## Why This Action",
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...workspaceRunNextWhyRows(plan).map(([field, value]) => `| ${field} | ${escapeMarkdownTable(value)} |`),
    "",
    "## Next Item",
    "",
    item
      ? `- ${item.title} (\`${item.kind}\`, \`${item.priority}\`)`
      : "- No open workspace review item.",
    ...(item?.summary ? [`- Summary: ${item.summary}`] : []),
    ...(item?.command ? [`- Command: \`${item.command}\``] : []),
    ...(item?.routeId ? [`- Route: \`${item.routeId}\``] : []),
    ...(item?.obligationId ? [`- Obligation: \`${item.obligationId}\` (${item.obligationKind ?? "evidence"})`] : []),
    ...(item?.claimId ? [`- Claim: \`${item.claimId}\``] : []),
    ...(item?.sessionId ? [`- Session: \`${item.sessionId}\``] : []),
    ...(item?.validationPlanId ? [`- Validation plan: \`${item.validationPlanId}\``] : []),
    ...(item?.validationGateId
      ? [`- Validation gate: \`${item.validationGateId}\` (${item.validationGateKind ?? "gate"})`]
      : []),
    ...(item?.proofDeclaration
      ? [
          `- Proof declaration: \`${item.proofDeclaration.declarationId}\` ${item.proofDeclaration.path}:${item.proofDeclaration.line}:${item.proofDeclaration.column}`,
          `- Proof declaration signature: \`${item.proofDeclaration.signature}\``,
          `- Proof declaration signature sha256: \`${item.proofDeclaration.signatureSha256}\``,
          `- Proof declaration source sha256: \`${item.proofDeclaration.sourceSha256}\``
        ]
      : []),
    ...(item?.proofAttempt
      ? [
          `- Proof attempt: \`${item.proofAttempt.checkId}\` (${item.proofAttempt.status}, ${item.proofAttempt.path})`,
          `- Proof source: \`${item.proofAttempt.sourcePath}\`${
            item.proofAttempt.sourceSha256 ? ` sha256:\`${item.proofAttempt.sourceSha256}\`` : ""
          }`
        ]
      : []),
    ...(item?.proofAttemptHistory && item.proofAttemptHistory.length > 0
      ? [
          `- Proof attempt history: ${item.proofAttemptHistory.length} scoped Lean attempt${
            item.proofAttemptHistory.length === 1 ? "" : "s"
          } (newest first)`,
          ...item.proofAttemptHistory.map(
            (attempt) =>
              `  - \`${attempt.checkId}\` ${attempt.status} ${attempt.sourcePath}${
                attempt.sourceStatus ? ` (${attempt.sourceStatus})` : ""
              }${attempt.diagnosticSnippet ? ` - ${attempt.diagnosticSnippet}` : ""}`
          )
        ]
      : []),
    ...(item?.proofRepairTarget
      ? [
          `- Proof repair target: \`${item.proofRepairTarget.repairTargetId}\` ${item.proofRepairTarget.sourcePath}:${item.proofRepairTarget.markerLine}:${item.proofRepairTarget.markerColumn}`,
          `- Proof repair source sha256: \`${item.proofRepairTarget.sourceSha256}\``,
          ...(item.proofRepairTarget.declarationSignatureSha256
            ? [`- Proof repair declaration signature sha256: \`${item.proofRepairTarget.declarationSignatureSha256}\``]
            : []),
          `- Proof repair after-edit command: \`${item.proofRepairTarget.afterEditCommands[0]}\``
        ]
      : []),
    ...(item?.reportId ? [`- Report: \`${item.reportId}\``] : []),
    "",
    "## Execution",
    "",
    `- Status: \`${plan.execution.status}\``,
    `- Kind: \`${plan.execution.kind}\``,
    `- Summary: ${plan.execution.summary}`,
    ...(plan.execution.command ? [`- Command: \`${plan.execution.command}\``] : []),
    ...(plan.execution.evidenceRef ? [`- Evidence ref: \`${plan.execution.evidenceRef}\``] : []),
    ...(typeof plan.execution.attached === "boolean" ? [`- Attached: \`${String(plan.execution.attached)}\``] : []),
    ...(plan.artifactRefs && plan.artifactRefs.length > 0
      ? [
          "",
          "## Artifact Refs",
          "",
          "| Role | Path | Source | SHA-256 | Citation |",
          "| --- | --- | --- | --- | --- |",
          ...plan.artifactRefs.map((ref) =>
            `| \`${ref.role}\` | \`${escapeMarkdownTable(ref.path)}\` | ${escapeMarkdownTable(ref.source)} | ${
              ref.sha256 ? `\`${ref.sha256}\`` : "not recorded"
            } | ${ref.citation ? `\`${escapeMarkdownTable(ref.citation)}\`` : "not recorded"} |`
          )
        ]
      : []),
    ...(plan.impactRefs && plan.impactRefs.length > 0
      ? [
          "",
          "## Citation Impact",
          "",
          "| Referenced artifact | Cited by | Kind | Field |",
          "| --- | --- | --- | --- |",
          ...plan.impactRefs.map((ref) =>
            `| \`${escapeMarkdownTable(ref.refPath)}\` | \`${escapeMarkdownTable(ref.citedByPath)}\` | \`${escapeMarkdownTable(ref.citedByKind)}\` | ${
              ref.fieldPath ? `\`${escapeMarkdownTable(ref.fieldPath)}\`` : "not recorded"
            } |`
          ),
          "",
          "Citation impact is dependency navigation only; it does not close gates or upgrade trust labels."
        ]
      : []),
    ...(plan.revalidationQueue && plan.revalidationQueue.length > 0
      ? [
          "",
          "## Revalidation Queue",
          "",
          "| Priority | Dependent artifact | Required evidence | Command |",
          "| --- | --- | --- | --- |",
          ...plan.revalidationQueue.map((item) =>
            `| \`${item.priority}\` | \`${escapeMarkdownTable(item.dependentPath)}\` | ${escapeMarkdownTable(
              item.evidenceRequired
            )} | \`${escapeMarkdownTable(item.command)}\` |`
          ),
          "",
          "Revalidation queue entries are review tasks only; they do not execute commands, close gates, or upgrade trust labels."
        ]
      : []),
    ...(plan.enginePlan
      ? [
          "",
          "## Engine Plan",
          "",
          `- Problem: ${plan.enginePlan.problem}`,
          `- Status: \`${plan.enginePlan.status}\``,
          `- Classification: ${plan.enginePlan.classifications.map((kind) => `\`${kind}\``).join(", ")}`,
          `- Target trust ceiling: \`${plan.enginePlan.targetTrustCeiling}\``,
          `- First command: \`${plan.enginePlan.recommendedFirstCommand}\``,
          "- Verifier stack:",
          ...plan.enginePlan.steps.map((step) =>
            `  - ${step.rank}. ${step.displayName} (\`${step.capabilityId}\`, \`${step.role}\`, \`${step.status}\`) - ${step.evidenceRequired}`
          ),
          "- Planner boundary: engine plans are routing contracts only; concrete receipts/proof/SMT/CAS artifacts must still be written."
        ]
      : []),
    ...(plan.idleNextActions && plan.idleNextActions.length > 0
      ? [
          "",
          "## Idle Next Actions",
          "",
          ...plan.idleNextActions.flatMap((action) => [
            `### ${action.title}`,
            "",
            `- Action: \`${action.actionId}\``,
            `- Command: \`${action.command}\``,
            `- Reason: ${action.reason}`,
            `- Boundary: ${action.boundary}`,
            `- Requires human input: \`${String(action.requiresHumanInput)}\``,
            ""
          ])
        ]
      : []),
    "",
    "## Stop Conditions",
    "",
    ...(plan.stopConditions.length > 0 ? plan.stopConditions.map((condition) => `- ${condition}`) : ["- None recorded."]),
    "",
    "## Warnings",
    "",
    ...plan.warnings.map((warning) => `- ${warning}`),
    "",
    "## Trust Boundary",
    "",
    "- This packet records what the local planner selected or did.",
    "- It is not proof, not a trust-label upgrade, and not a substitute for the evidence artifact.",
    "- Trust labels move only when replayable evidence satisfies the matching route or claim gate.",
    ""
  ];
  return lines.join("\n");
}

function workspaceRunNextWhyRows(plan: WorkspaceRunNextPlan): Array<[string, string]> {
  const rationale = plan.rationale ?? workspaceRunNextRationaleFor(plan);
  return [
    ["Target", rationale.target],
    ["Source", rationale.source],
    ...workspaceRunNextEngineWhyRows(plan.enginePlan),
    ["Candidate evidence", rationale.candidateEvidenceRef ?? "No candidate evidence ref selected."],
    ["Execution boundary", rationale.executionBoundary],
    ["First stop condition", rationale.firstStopCondition ?? "No stop condition recorded."],
    ["First warning", rationale.firstWarning ?? "No warning recorded."]
  ];
}

function withWorkspaceRunNextRationale(plan: WorkspaceRunNextPlan): WorkspaceRunNextPlan {
  return withWorkspaceRunNextArtifactRefs({
    ...plan,
    rationale: plan.rationale ?? workspaceRunNextRationaleFor(plan)
  });
}

async function finalizeWorkspaceRunNextPlan(rootPath: string, plan: WorkspaceRunNextPlan): Promise<WorkspaceRunNextPlan> {
  const withRefs = await withWorkspaceRunNextArtifactRefIntegrity(rootPath, withWorkspaceRunNextRationale(plan));
  const withImpact = await withWorkspaceRunNextImpactRefs(rootPath, withRefs);
  return withWorkspaceRunNextRevalidationQueue(withImpact);
}

function workspaceRunNextRationaleFor(plan: WorkspaceRunNextPlan): WorkspaceRunNextRationale {
  const item = plan.item;
  const candidateEvidenceRef = plan.execution.evidenceRef ?? evidenceRefFromRunNextCommand(item?.command ?? plan.execution.command);
  return {
    target: workspaceRunNextTarget(item),
    source: item ? `${item.kind} / ${item.priority}` : "workspace-review",
    ...(candidateEvidenceRef ? { candidateEvidenceRef } : {}),
    executionBoundary: workspaceRunNextExecutionBoundary(plan),
    ...(plan.stopConditions[0] ? { firstStopCondition: plan.stopConditions[0] } : {}),
    ...(plan.warnings[0] ? { firstWarning: plan.warnings[0] } : {})
  };
}

function workspaceRunNextExecutionBoundary(plan: WorkspaceRunNextPlan): string {
  if (plan.execution.kind === "manual-container-gate") {
    return "Manual container gate; run-next will not execute npm, Docker, or shell strings. Run the command only through an approved container workflow.";
  }
  if (plan.dryRun) {
    return "Dry-run only; execute through CLI/MCP with explicit local execution approval.";
  }
  return "Executed through the bounded in-process run-next planner.";
}

function workspaceRunNextTarget(item: WorkspaceRunNextPlan["item"] | undefined): string {
  if (!item) {
    return "No open workspace review item.";
  }
  if (item.validationGateId) {
    return `validation ${item.validationGateKind ?? "gate"} ${item.validationGateId}`;
  }
  if (item.obligationId) {
    return `${item.obligationKind ?? "obligation"} ${item.obligationId}`;
  }
  return item.claimId ?? item.routeId ?? item.reportId ?? item.sessionId ?? "workspace queue";
}

function workspaceRunNextEngineGuidance(enginePlan: EnginePlan | undefined): {
  dryRunSummary?: string;
  stopConditions: string[];
  warnings: string[];
} {
  if (!enginePlan) {
    return { stopConditions: [], warnings: [] };
  }

  const firstStep = workspaceRunNextFirstEngineStep(enginePlan);
  const openGates = workspaceRunNextOpenEngineGates(enginePlan);
  const firstStepSummary = firstStep
    ? `${firstStep.displayName} (${firstStep.capabilityId})`
    : "no runnable verifier capability";
  const evidenceRequired = firstStep?.evidenceRequired ?? "Install or enable a local verifier before attempting this item.";

  return {
    dryRunSummary:
      `Dry-run only. Engine plan starts with ${firstStepSummary}; evidence required: ${evidenceRequired} ` +
      "Re-run with --execute-local only when the local action is explicitly approved.",
    stopConditions: [
      `Engine evidence required: ${evidenceRequired}`,
      `Engine trust ceiling: do not claim stronger than ${enginePlan.targetTrustCeiling} without concrete accepted artifacts.`
    ],
    warnings: [
      `Engine plan selected ${enginePlan.classifications.join(", ")} route; first command: ${enginePlan.recommendedFirstCommand}.`,
      openGates.length > 0
        ? `Engine plan still has open verifier gates: ${openGates.map((step) => step.capabilityId).join(", ")}.`
        : "Engine plan has no unavailable required verifier gates in this runtime."
    ]
  };
}

function workspaceRunNextEngineWhyRows(enginePlan: EnginePlan | undefined): Array<[string, string]> {
  if (!enginePlan) {
    return [];
  }

  const firstStep = workspaceRunNextFirstEngineStep(enginePlan);
  const openGates = workspaceRunNextOpenEngineGates(enginePlan);
  return [
    [
      "Engine first route",
      firstStep
        ? `${firstStep.displayName} (${firstStep.capabilityId}, ${firstStep.role}, ${firstStep.status})`
        : "No runnable verifier capability is available."
    ],
    ["Engine evidence required", firstStep?.evidenceRequired ?? "Install or enable a local verifier first."],
    [
      "Engine open gates",
      openGates.length > 0 ? openGates.map((step) => `${step.capabilityId} (${step.status})`).join(", ") : "None."
    ]
  ];
}

function workspaceRunNextFirstEngineStep(enginePlan: EnginePlan): EnginePlan["steps"][number] | undefined {
  return (
    enginePlan.steps.find(
      (step) => step.canRunNow && step.role !== "provenance-check" && step.role !== "planned-upgrade"
    ) ??
    enginePlan.steps.find((step) => step.canRunNow) ??
    enginePlan.steps.find((step) => step.role !== "planned-upgrade") ??
    enginePlan.steps[0]
  );
}

function workspaceRunNextOpenEngineGates(enginePlan: EnginePlan): EnginePlan["steps"] {
  return enginePlan.steps.filter((step) => !step.canRunNow && step.role !== "planned-upgrade");
}

function workspaceRunNextEnginePlanFor(
  item: WorkspaceReviewItem,
  createdAt: string,
  options: CreateEnginePlanOptions | undefined
): EnginePlan | undefined {
  const problem = workspaceRunNextEngineProblemFor(item);
  if (!problem) {
    return undefined;
  }

  const now = new Date(createdAt);
  return createEnginePlan(problem, {
    ...options,
    now: Number.isNaN(now.getTime()) ? options?.now : now
  });
}

function workspaceRunNextEngineProblemFor(item: WorkspaceReviewItem): string | undefined {
  const fromCommand = engineProblemFromRunNextCommand(item.command);
  if (fromCommand) {
    return fromCommand;
  }

  if (item.kind === "validation-gate") {
    return validationClaimFromReviewSummary(item.summary);
  }

  if (item.kind === "route-obligation") {
    const [routeProblem] = item.summary.split(" - ");
    return normalizeEngineProblem(routeProblem);
  }

  return undefined;
}

function engineProblemFromRunNextCommand(command: string | undefined): string | undefined {
  if (!command) {
    return undefined;
  }

  const parsed = parseLocalTruthHarnessCommand(command);
  if (!parsed.ok) {
    return undefined;
  }

  const [group, action, ...rest] = parsed.args;
  const options = commandOptionMap(parsed.args);

  if (group === "verify") {
    return normalizeEngineProblem(positionalArgsBeforeFirstOption([action, ...rest]).join(" "));
  }

  if (group === "claim" && action === "add") {
    return normalizeEngineProblem(positionalArgsBeforeFirstOption(rest).join(" "));
  }

  if (group === "source" && action === "search") {
    return normalizeEngineProblem(positionalArgsBeforeFirstOption(rest).join(" "));
  }

  if (group === "proof" && action === "check") {
    return normalizeEngineProblem(optionString(options.statement));
  }

  if (group === "cas" && action === "check") {
    const operation = optionString(options.operation);
    const expression = optionString(options.expression);
    return normalizeEngineProblem(expression ? `symbolic ${operation ?? "check"} ${expression}` : undefined);
  }

  return undefined;
}

function validationClaimFromReviewSummary(summary: string): string | undefined {
  const match = /^Validation plan:\s*(.+?)\s+-\s+/u.exec(summary);
  return normalizeEngineProblem(match?.[1]);
}

function normalizeEngineProblem(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized && !normalized.includes("<") && !normalized.includes(">") ? normalized : undefined;
}

function workspaceRunNextIdleActions(rootPath: string): WorkspaceRunNextIdleAction[] {
  const workspace = quoteCommandArg(rootPath);
  return [
    {
      actionId: "start-validation-backed-harness",
      title: "Start a new hard-problem harness",
      command:
        "truth-harness research harness \"State the narrow hard problem or conjecture here\" --domain math --plan-next",
      reason:
        "There is no open local queue item. A fresh research harness creates a session, linked validation plan, first checkpoint, and saved run-next handoff.",
      boundary:
        "Requires a human or supervising agent to choose a narrow objective before any claim can be validated.",
      requiresHumanInput: true
    },
    {
      actionId: "refresh-strict-docker-professor-rehearsal",
      title: "Refresh the strict all-engine professor rehearsal",
      command: "npm run docker:professor:all",
      reason:
        "Writes the no-network Maxima/Z3/cvc5/Lean/SageMath reviewer evidence, closure reports, credibility pack, and portable reviewer bundle in one strict route.",
      boundary:
        "Starts the heavier all-engine Docker image through npm. Run-next will not execute this command; a human or approved agent must accept the container boundary first.",
      requiresHumanInput: true
    },
    {
      actionId: "refresh-docker-professor-rehearsal",
      title: "Refresh the Docker professor reviewer rehearsal",
      command: "npm run docker:professor",
      reason:
        "Writes no-network Maxima/Z3/cvc5/Lean evidence, adversarial and math-ladder benchmark evidence, exact/symbolic/SMT closure reports, the credibility pack, and the portable reviewer bundle in one practical route.",
      boundary:
        "Starts Docker through npm without SageMath. Run-next will not execute this command; a human or approved agent must accept the container boundary first.",
      requiresHumanInput: true
    },
    {
      actionId: "refresh-professor-review",
      title: "Refresh the professor credibility packet",
      command: `truth-harness workspace credibility-pack ${workspace} --require-all-engines`,
      reason:
        "Recomputes the reviewer packet from already-saved local artifacts so a professor or agent can see whether new blockers appeared.",
      boundary:
        "Reads local evidence and engine-run records only; use the Docker professor rehearsal first when reviewer artifacts need to be refreshed.",
      requiresHumanInput: false
    },
    {
      actionId: "refresh-release-audit",
      title: "Refresh the strict release audit",
      command:
        `truth-harness workspace release-audit ${workspace} ` +
        "--require-all-engines --require-saved-strict-engine-run --require-sandbox",
      reason:
        "Confirms the workspace is still reviewer-clean before starting another autonomous loop.",
      boundary:
        "Composes existing local evidence only; Docker reviewer commands remain explicit separate actions.",
      requiresHumanInput: false
    }
  ];
}

function evidenceRefFromRunNextCommand(command: string | undefined): string | undefined {
  if (!command) {
    return undefined;
  }
  const match = command.match(/--evidence\s+("[^"]+"|'[^']+'|\S+)/u);
  if (!match) {
    return undefined;
  }
  return match[1].replace(/^["']|["']$/gu, "");
}

function tryParseWorkspaceRunNextJson(raw: string): WorkspaceRunNextPlan | undefined {
  try {
    return parseWorkspaceRunNextJson(raw);
  } catch {
    return undefined;
  }
}

function summarizeWorkspaceRunNextPlan(
  plan: WorkspaceRunNextPlan,
  path: string,
  sourceSnapshotCheck?: WorkspaceRunNextSourceSnapshotCheck,
  sourceRevisionCheck?: WorkspaceRunNextSourceRevisionCheck,
  artifactRefs = workspaceRunNextPacketArtifactRefs(plan, path)
): WorkspaceRunNextSummary {
  const rationale = plan.rationale ?? workspaceRunNextRationaleFor(plan);

  return {
    schemaVersion: plan.schemaVersion,
    planId: plan.planId,
    createdAt: plan.createdAt,
    path,
    localOnly: plan.localOnly,
    networkAccess: plan.networkAccess,
    dryRun: plan.dryRun,
    status: plan.status,
    mode: plan.mode,
    reviewId: plan.reviewId,
    itemTitle: plan.item?.title,
    itemKind: plan.item?.kind,
    itemPriority: plan.item?.priority,
    proofRepairTargetSummary: summarizeWorkspaceRunNextProofRepairTarget(plan.item?.proofRepairTarget),
    proofAttemptHistorySummary: summarizeWorkspaceRunNextProofAttemptHistory(plan.item?.proofAttemptHistory),
    executionKind: plan.execution.kind,
    executionStatus: plan.execution.status,
    rationaleTarget: rationale.target,
    rationaleSource: rationale.source,
    rationaleCandidateEvidenceRef: rationale.candidateEvidenceRef,
    rationaleExecutionBoundary: rationale.executionBoundary,
    enginePlanStatus: plan.enginePlan?.status,
    enginePlanClassifications: plan.enginePlan?.classifications,
    enginePlanTargetTrustCeiling: plan.enginePlan?.targetTrustCeiling,
    enginePlanRecommendedFirstCommand: plan.enginePlan?.recommendedFirstCommand,
    artifactRefs,
    impactRefs: plan.impactRefs,
    revalidationQueue: plan.revalidationQueue,
    sourceRevisionId: plan.sourceRevision?.revisionId,
    sourceRevisionPath: plan.sourceRevision?.path,
    sourceRevisionSourceSnapshotId: plan.sourceRevision?.sourceSnapshotId,
    sourceRevisionSourceSnapshotPath: plan.sourceRevision?.sourceSnapshotPath,
    sourceSnapshotId: plan.sourceSnapshot?.snapshotId,
    sourceSnapshotPath: plan.sourceSnapshot?.path,
    sourceSnapshotFiles: plan.sourceSnapshot?.totalFiles,
    sourceSnapshotBytes: plan.sourceSnapshot?.totalBytes,
    resumeDecision: createWorkspaceRunNextResumeDecision(plan, sourceSnapshotCheck, sourceRevisionCheck),
    ...(sourceRevisionCheck ?? {}),
    ...(sourceSnapshotCheck ?? {})
  };
}

function summarizeWorkspaceRunNextProofRepairTarget(
  target: WorkspaceReviewItem["proofRepairTarget"] | undefined
): WorkspaceRunNextProofRepairTargetSummary | undefined {
  if (!target) {
    return undefined;
  }

  return {
    repairTargetId: target.repairTargetId,
    sourcePath: target.sourcePath,
    sourceSha256: target.sourceSha256,
    markerKind: target.markerKind,
    markerLine: target.markerLine,
    markerColumn: target.markerColumn,
    ...(target.declarationId ? { declarationId: target.declarationId } : {}),
    ...(target.declarationName ? { declarationName: target.declarationName } : {}),
    ...(target.declarationSignatureSha256
      ? { declarationSignatureSha256: target.declarationSignatureSha256 }
      : {}),
    ...(target.afterEditCommands[0] ? { afterEditCommand: target.afterEditCommands[0] } : {}),
    evidenceRequired: [...target.evidenceRequired],
    boundary: target.boundary
  };
}

function summarizeWorkspaceRunNextProofAttemptHistory(
  history: WorkspaceReviewItem["proofAttemptHistory"] | undefined
): WorkspaceRunNextProofAttemptHistorySummary | undefined {
  if (!history || history.length === 0) {
    return undefined;
  }

  const attempts = history.slice(0, 5);
  const latest = attempts[0];
  if (!latest) {
    return undefined;
  }

  return {
    total: attempts.length,
    latestCheckId: latest.checkId,
    latestStatus: latest.status,
    latestSourcePath: latest.sourcePath,
    ...(latest.sourceStatus ? { latestSourceStatus: latest.sourceStatus } : {}),
    ...(latest.diagnosticSnippet ? { latestDiagnosticSnippet: latest.diagnosticSnippet } : {}),
    priorCheckIds: attempts.slice(1).map((attempt) => attempt.checkId)
  };
}

async function verifyRunNextSourceSnapshot(
  rootPath: string,
  plan: WorkspaceRunNextPlan,
  planPath: string,
  now?: string
): Promise<WorkspaceRunNextSourceSnapshotCheck> {
  if (!plan.sourceSnapshot?.snapshotId) {
    return {
      sourceSnapshotStatus: "not-recorded",
      sourceSnapshotDriftSummary: "No source snapshot was recorded on this run-next handoff."
    };
  }

  try {
    const verification = await verifyWorkspaceSnapshot({
      rootPath,
      snapshotRef: plan.sourceSnapshot.snapshotId,
      now
    });
    const ignoredSelfAdded = verification.addedSinceSnapshot.filter((entry) =>
      isRunNextExpectedAddedPath(planPath, entry.path)
    );
    const added = verification.addedSinceSnapshot.length - ignoredSelfAdded.length;
    const missing = verification.missing.length;
    const changed = verification.changed.length;
    const verified = missing === 0 && changed === 0 && added === 0;

    return {
      sourceSnapshotStatus: verified ? "verified" : "drifted",
      sourceSnapshotVerifiedAt: verification.verifiedAt,
      sourceSnapshotMissing: missing,
      sourceSnapshotChanged: changed,
      sourceSnapshotAdded: added,
      sourceSnapshotIgnoredAdded: ignoredSelfAdded.length,
      sourceSnapshotDriftSummary: verified
        ? `Source snapshot still matches after ignoring ${ignoredSelfAdded.length} run-next handoff file(s).`
        : `${missing} missing, ${changed} changed, ${added} added since source snapshot.`
    };
  } catch (error) {
    return {
      sourceSnapshotStatus: "missing",
      sourceSnapshotMissing: 1,
      sourceSnapshotDriftSummary: error instanceof Error ? error.message : "Source snapshot could not be verified."
    };
  }
}

async function verifyRunNextSourceChecks(
  rootPath: string,
  plan: WorkspaceRunNextPlan,
  planPath: string,
  now?: string
): Promise<{
  sourceRevision?: WorkspaceRunNextSourceRevisionCheck;
  sourceSnapshot?: WorkspaceRunNextSourceSnapshotCheck;
}> {
  if (!plan.sourceRevision?.revisionId) {
    return {
      sourceSnapshot: await verifyRunNextSourceSnapshot(rootPath, plan, planPath, now)
    };
  }

  try {
    const verification = await verifyWorkspaceRevision({
      rootPath,
      revisionRef: plan.sourceRevision.revisionId,
      ignoreAddedPaths: runNextSelfAddedPaths(planPath),
      now
    });
    return {
      sourceRevision: runNextSourceRevisionCheckFromVerification(verification, planPath),
      sourceSnapshot: runNextSourceSnapshotCheckFromRevisionVerification(verification)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source revision could not be verified.";
    const sourceSnapshot = await verifyRunNextSourceSnapshot(rootPath, plan, planPath, now);
    return {
      sourceRevision: {
        sourceRevisionStatus: "missing",
        sourceRevisionMissing: 1,
        sourceRevisionDriftSummary: message
      },
      sourceSnapshot
    };
  }
}

function isRunNextSelfAddedPath(planPath: string, addedPath: string): boolean {
  if (addedPath === planPath) {
    return true;
  }
  return planPath.endsWith(".json") && addedPath === planPath.replace(/\.json$/u, ".md");
}

function runNextSourceSnapshotCheckFromRevisionVerification(
  verification: WorkspaceRevisionVerification
): WorkspaceRunNextSourceSnapshotCheck {
  const snapshotVerification = verification.snapshotVerification;
  if (!snapshotVerification) {
    if (verification.sourceSnapshotFile.status === "missing") {
      return {
        sourceSnapshotStatus: "missing",
        sourceSnapshotVerifiedAt: verification.verifiedAt,
        sourceSnapshotMissing: 1,
        sourceSnapshotChanged: 0,
        sourceSnapshotAdded: 0,
        sourceSnapshotIgnoredAdded: 0,
        sourceSnapshotDriftSummary: "Source snapshot file recorded by the source revision is missing."
      };
    }

    return {
      sourceSnapshotStatus: "drifted",
      sourceSnapshotVerifiedAt: verification.verifiedAt,
      sourceSnapshotMissing: 0,
      sourceSnapshotChanged: verification.sourceSnapshotFile.status === "changed" ? 1 : 0,
      sourceSnapshotAdded: 0,
      sourceSnapshotIgnoredAdded: 0,
      sourceSnapshotDriftSummary:
        verification.sourceSnapshotFile.status === "changed"
          ? "Source snapshot file hash no longer matches the source revision."
          : "Source snapshot could not be verified from the source revision."
    };
  }

  const missing = snapshotVerification.missing.length;
  const changed = snapshotVerification.changed.length;
  const added = snapshotVerification.addedSinceSnapshot.length;
  const ignored = ignoredAddedCountFromRevisionWarnings(verification.warnings);
  const status =
    verification.sourceSnapshotFile.status === "missing"
      ? "missing"
      : snapshotVerification.passed && verification.sourceSnapshotFile.status === "verified"
        ? "verified"
        : "drifted";

  return {
    sourceSnapshotStatus: status,
    sourceSnapshotVerifiedAt: verification.verifiedAt,
    sourceSnapshotMissing: missing,
    sourceSnapshotChanged: changed,
    sourceSnapshotAdded: added,
    sourceSnapshotIgnoredAdded: ignored,
    sourceSnapshotDriftSummary:
      status === "verified"
        ? `Source snapshot still matches after ignoring ${ignored} expected handoff/revision file(s).`
        : `${missing} missing, ${changed} changed, ${added} added since source snapshot.`
  };
}

function runNextSourceRevisionCheckFromVerification(
  verification: WorkspaceRevisionVerification,
  planPath: string
): WorkspaceRunNextSourceRevisionCheck {
  const snapshotVerification = verification.snapshotVerification;
  const missing =
    snapshotVerification?.missing.length ?? (verification.sourceSnapshotFile.status === "missing" ? 1 : 0);
  const changed =
    snapshotVerification?.changed.length ?? (verification.sourceSnapshotFile.status === "changed" ? 1 : 0);
  const added = snapshotVerification?.addedSinceSnapshot.length ?? 0;
  const ignored = ignoredAddedCountFromRevisionWarnings(verification.warnings);
  const status =
    verification.passed
      ? "verified"
      : verification.sourceSnapshotFile.status === "missing"
        ? "missing"
        : "drifted";

  return {
    sourceRevisionStatus: status,
    sourceRevisionVerifiedAt: verification.verifiedAt,
    sourceRevisionMissing: missing,
    sourceRevisionChanged: changed,
    sourceRevisionAdded: added,
    sourceRevisionIgnoredAdded: ignored,
    sourceRevisionDriftSummary: verification.passed
      ? `Source revision still matches after ignoring ${ignored} expected handoff/revision file(s).`
      : `${missing} missing, ${changed} changed, ${added} added since source revision ${planPath}.`
  };
}

function ignoredAddedCountFromRevisionWarnings(warnings: string[]): number {
  return warnings.reduce((total, warning) => {
    const match = /^Ignored\s+(\d+)\s+/u.exec(warning);
    return total + (match ? Number.parseInt(match[1], 10) : 0);
  }, 0);
}

function runNextSelfAddedPaths(planPath: string): string[] {
  return planPath.endsWith(".json") ? [planPath, planPath.replace(/\.json$/u, ".md")] : [planPath];
}

function isRunNextExpectedAddedPath(planPath: string, addedPath: string): boolean {
  return isRunNextSelfAddedPath(planPath, addedPath) || isRevisionManifestPath(addedPath);
}

function isRevisionManifestPath(path: string): boolean {
  return path.startsWith(".truth-harness/revisions/") && path.endsWith(".json");
}

function createWorkspaceRunNextResumeDecision(
  plan: WorkspaceRunNextPlan,
  sourceSnapshot: WorkspaceRunNextSourceSnapshotCheck | undefined,
  sourceRevision: WorkspaceRunNextSourceRevisionCheck | undefined
): WorkspaceRunNextResumeDecision {
  if (plan.sourceRevision) {
    if (!sourceRevision) {
      return {
        safeToResume: false,
        status: "verify-snapshot-first",
        action: "verify-source-snapshot",
        reason: "This handoff has not been checked against its source workspace revision in this inspection.",
        nextCommand: `truth-harness workspace show-run-next ${quoteCommandArg(plan.planId)} --workspace ${quoteCommandArg(
          plan.workspacePath
        )} --verify-snapshot --json`
      };
    }

    if (sourceRevision.sourceRevisionStatus !== "verified") {
      return {
        safeToResume: false,
        status: "rerun-run-next",
        action: "rerun-workspace-run-next",
        reason:
          sourceRevision.sourceRevisionDriftSummary ??
          `Source revision status is ${sourceRevision.sourceRevisionStatus ?? "unknown"}, so the saved handoff should not be resumed.`,
        nextCommand: `truth-harness workspace run-next ${quoteCommandArg(plan.workspacePath)} --json`
      };
    }
  }

  if (!sourceSnapshot) {
    return {
      safeToResume: false,
      status: "verify-snapshot-first",
      action: "verify-source-snapshot",
      reason: "This handoff has not been checked against its source workspace snapshot in this inspection.",
      nextCommand: `truth-harness workspace show-run-next ${quoteCommandArg(plan.planId)} --workspace ${quoteCommandArg(
        plan.workspacePath
      )} --verify-snapshot --json`
    };
  }

  if (sourceSnapshot.sourceSnapshotStatus !== "verified") {
    return {
      safeToResume: false,
      status: "rerun-run-next",
      action: "rerun-workspace-run-next",
      reason:
        sourceSnapshot.sourceSnapshotDriftSummary ??
        `Source snapshot status is ${sourceSnapshot.sourceSnapshotStatus ?? "unknown"}, so the saved handoff should not be resumed.`,
      nextCommand: `truth-harness workspace run-next ${quoteCommandArg(plan.workspacePath)} --json`
    };
  }

  const selectedCommand = plan.item?.command ?? plan.execution.command;
  if (plan.mode === "idle" && plan.idleNextActions && plan.idleNextActions.length > 0) {
    return {
      safeToResume: false,
      status: "choose-idle-action",
      action: "choose-idle-action",
      reason:
        "The source snapshot is verified and this packet is a healthy idle action menu, not a single resumable command. Choose one idle action explicitly.",
      nextCommand: `truth-harness workspace show-run-next ${quoteCommandArg(plan.planId)} --workspace ${quoteCommandArg(
        plan.workspacePath
      )} --verify-snapshot --json`
    };
  }

  if (plan.status !== "planned" || !plan.dryRun || !selectedCommand) {
    return {
      safeToResume: false,
      status: "rerun-run-next",
      action: "rerun-workspace-run-next",
      reason: "The source snapshot is verified, but this saved packet is not a pending dry-run handoff with a selected command.",
      nextCommand: `truth-harness workspace run-next ${quoteCommandArg(plan.workspacePath)} --json`
    };
  }

  return {
    safeToResume: true,
    status: "safe-to-resume",
    action: "run-selected-command",
    reason: plan.sourceRevision
      ? "The source workspace revision still matches, its source snapshot is verified, and this packet is a pending dry-run handoff."
      : "The source workspace snapshot still matches, and this packet is a pending dry-run handoff.",
    nextCommand: selectedCommand
  };
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Workspace run-next path escapes workspace root: ${JSON.stringify(path)}`);
  }

  return target;
}

function requireText(value: string | undefined, message: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function isWorkspaceRunNextPlanId(value: string): boolean {
  return /^wrn_[a-f0-9]{8}$/u.test(value);
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/u.test(value) ? value : JSON.stringify(value);
}

function toPortablePath(value: string): string {
  return value.split(sep).join("/");
}

function workspaceRunNextItemSummary(item: WorkspaceReviewItem): WorkspaceRunNextPlan["item"] {
  return {
    itemId: item.itemId,
    kind: item.kind,
    priority: item.priority,
    title: item.title,
    summary: item.summary,
    command: item.command,
    routeId: item.routeId,
    obligationId: item.obligationId,
    obligationKind: item.obligationKind,
    claimId: item.claimId,
    sessionId: item.sessionId,
    validationPlanId: item.validationPlanId,
    validationGateId: item.validationGateId,
    validationGateKind: item.validationGateKind,
    ...(item.proofDeclaration ? { proofDeclaration: item.proofDeclaration } : {}),
    ...(item.proofAttempt ? { proofAttempt: item.proofAttempt } : {}),
    ...(item.proofAttemptHistory ? { proofAttemptHistory: item.proofAttemptHistory } : {}),
    ...(item.proofRepairTarget ? { proofRepairTarget: item.proofRepairTarget } : {}),
    reportId: item.reportId
  };
}

function createWorkspaceReviewFromSavedRunNextPlan(input: {
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
  sourcePlan: WorkspaceRunNextPlan;
  sourcePlanPath: string;
  createdAt: string;
}): WorkspaceReview {
  const sourceItem = input.sourcePlan.item;
  if (!sourceItem) {
    throw new Error(`Saved run-next handoff ${input.sourcePlan.planId} has no selected item.`);
  }
  const item: WorkspaceReviewItem = {
    ...sourceItem,
    source: {
      label: "saved run-next handoff",
      ref: input.sourcePlanPath
    },
    acceptanceCriteria: [
      `Resume saved run-next handoff ${input.sourcePlan.planId} only after its source revision and source snapshot verify cleanly.`,
      `Produce the evidence required by ${sourceItem.title}.`
    ],
    agentPacket: [
      "# Saved Truth Harness Run-Next Handoff",
      "",
      `Saved plan: ${input.sourcePlan.planId}`,
      `Source path: ${input.sourcePlanPath}`,
      `Selected command: ${sourceItem.command}`,
      "",
      "This packet was reopened by the pilot loop after source revision and source snapshot verification. It remains bounded by the same run-next executor and never executes shell strings."
    ].join("\n")
  };
  const priorityCounts = workspaceReviewPriorityCounts([item]);

  return {
    schemaVersion: "truth-harness.workspace-review.v0",
    reviewId: `wrev_saved_${input.sourcePlan.planId.replace(/^wrn_/u, "")}`,
    projectId: input.status.manifest.projectId,
    createdAt: input.createdAt,
    workspacePath: input.status.root,
    localOnly: true,
    networkAccess: "none",
    privacy: input.status.manifest.privacy,
    summary: {
      routes: 0,
      claims: 0,
      sessions: item.sessionId ? 1 : 0,
      reportDrafts: item.reportId ? 1 : 0,
      totalItems: 1,
      routeObligations: item.kind === "route-obligation" ? 1 : 0,
      leanProofSafetyItems: item.source.label === "Lean proof safety" ? 1 : 0,
      readyRoutesWithoutClaims: item.kind === "route-ready-claim" ? 1 : 0,
      blockedClaims: item.kind === "claim-blocker" ? 1 : 0,
      reportDraftReviewItems: item.kind === "report-draft-review" ? 1 : 0,
      reportDraftsNeedingAttention: item.kind === "report-draft-review" ? 1 : 0,
      sessionTasks: item.kind === "session-task" ? 1 : 0,
      sessionNextChecks: item.kind === "session-next-check" ? 1 : 0,
      criticalItems: priorityCounts.critical,
      highItems: priorityCounts.high,
      mediumItems: priorityCounts.medium,
      lowItems: priorityCounts.low
    },
    autonomy: {
      mode: input.sourcePlan.mode,
      canRunUnattended: input.sourcePlan.mode === "local-verifier-loop",
      suggestedBatchSize: 1,
      nextItemId: item.itemId,
      nextCommand: item.command,
      allowedActions: [
        "Resume only the structured item from the verified saved run-next handoff.",
        "Use the bounded in-process run-next executor; never execute the saved command as a shell string."
      ],
      blockedActions: [
        "Do not resume when the saved handoff source revision or source snapshot drifted.",
        "Do not reinterpret old chat history as evidence."
      ],
      stopConditions: uniqueStrings([
        ...input.sourcePlan.stopConditions,
        "Stop when the saved handoff is executed, blocked, or no durable local evidence is produced."
      ]),
      requiredArtifacts: [
        `Verified source revision/snapshot for ${input.sourcePlan.planId}.`,
        `Evidence required by ${item.title}.`
      ],
      humanReviewRequiredFor: input.sourcePlan.mode === "human-review-gated" ? [item.itemId] : [],
      agentPacket: item.agentPacket ?? `Resume saved run-next handoff ${input.sourcePlan.planId}.`
    },
    items: [item],
    warnings: uniqueStrings([
      `Saved run-next source: ${input.sourcePlanPath}.`,
      ...input.sourcePlan.warnings
    ]),
    markdown: `# Saved Run-Next Review\n\nSaved plan ${input.sourcePlan.planId} from ${input.sourcePlanPath} is being resumed through the bounded run-next executor.\n`
  };
}

function workspaceReviewPriorityCounts(items: WorkspaceReviewItem[]): Record<WorkspaceReviewPriorityName, number> {
  return {
    critical: items.filter((item) => item.priority === "critical").length,
    high: items.filter((item) => item.priority === "high").length,
    medium: items.filter((item) => item.priority === "medium").length,
    low: items.filter((item) => item.priority === "low").length
  };
}

type WorkspaceReviewPriorityName = "critical" | "high" | "medium" | "low";

async function createBlockedSavedHandoffRunNextPlan(input: {
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
  sourcePlan: WorkspaceRunNextPlan;
  sourcePlanPath: string;
  createdAt: string;
  executeLocal: boolean;
  inspection: WorkspaceRunNextInspection;
}): Promise<WorkspaceRunNextPlan> {
  return finalizeWorkspaceRunNextPlan(input.status.root, {
    schemaVersion: WORKSPACE_RUN_NEXT_SCHEMA_VERSION,
    planId: workspaceRunNextPlanId(input.createdAt, `${input.sourcePlan.reviewId}:${input.sourcePlan.planId}:saved-run-next`),
    createdAt: input.createdAt,
    workspacePath: input.status.root,
    localOnly: true,
    networkAccess: "none",
    dryRun: !input.executeLocal,
    status: "blocked",
    mode: input.sourcePlan.mode,
    reviewId: `wrev_saved_${input.sourcePlan.planId.replace(/^wrn_/u, "")}`,
    ...(input.sourcePlan.item ? { item: input.sourcePlan.item } : {}),
    execution: {
      status: "blocked",
      kind: "saved-run-next-source-check",
      command: input.inspection.resumeDecision.nextCommand,
      summary: `Saved run-next handoff ${input.sourcePlan.planId} cannot be resumed: ${input.inspection.resumeDecision.reason}`
    },
    rationale: {
      target: input.sourcePlan.item ? workspaceRunNextTarget(input.sourcePlan.item) : `saved handoff ${input.sourcePlan.planId}`,
      source: `saved-run-next:${input.sourcePlanPath}`,
      candidateEvidenceRef: input.sourcePlanPath,
      executionBoundary:
        "Saved handoff execution is blocked until the source revision and source snapshot are verified cleanly.",
      firstWarning: input.inspection.resumeDecision.reason
    },
    stopConditions: uniqueStrings([
      ...input.sourcePlan.stopConditions,
      "Stop instead of resuming saved handoffs when source revision or source snapshot drift is detected."
    ]),
    warnings: uniqueStrings([
      `Saved run-next ${input.sourcePlan.planId} was not resumed: ${input.inspection.resumeDecision.reason}`,
      ...input.sourcePlan.warnings
    ])
  });
}

function workspaceRunNextRevisionTitle(plan: WorkspaceRunNextPlan): string {
  const target = workspaceRunNextTarget(plan.item);
  return plan.item ? `Run-next handoff for ${target}` : "Run-next idle handoff checkpoint";
}

function workspaceRunNextRevisionReason(plan: WorkspaceRunNextPlan): string {
  const rationale = plan.rationale ?? workspaceRunNextRationaleFor(plan);
  return `Checkpoint workspace evidence before saved run-next packet ${plan.planId}; selected target: ${rationale.target}.`;
}

function workspaceRunNextRevisionArtifactRefs(plan: WorkspaceRunNextPlan): WorkspaceRunNextArtifactRef[] {
  const ignoredRoles = new Set<WorkspaceRunNextArtifactRefRole>(["run-next-packet", "source-revision", "source-snapshot"]);
  return (plan.artifactRefs ?? [])
    .filter((ref) => !ignoredRoles.has(ref.role))
    .map((ref) => ({
      path: ref.path,
      role: ref.role,
      source: `workspace-run-next:${ref.source}`,
      ...(typeof ref.sizeBytes === "number" ? { sizeBytes: ref.sizeBytes } : {}),
      ...(ref.sha256 ? { sha256: ref.sha256 } : {}),
      ...(ref.sha256Scope ? { sha256Scope: ref.sha256Scope } : {}),
      ...(ref.citation ? { citation: ref.citation } : {})
    }));
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort();
}

async function executeWorkspaceRunNextItem(
  rootPath: string,
  item: WorkspaceReviewItem
): Promise<WorkspaceRunNextPlan["execution"]> {
  const manualBoundary = manualContainerGateBoundary(item.command);
  if (manualBoundary) {
    return manualBoundary;
  }

  const parsed = parseLocalTruthHarnessCommand(item.command);
  if (!parsed.ok) {
    return {
      status: "blocked",
      kind: "unsupported-command",
      command: item.command,
      summary: parsed.reason
    };
  }

  const [group, action, ...rest] = parsed.args;
  const options = commandOptionMap(parsed.args);
  const workspace = rootPath;
  const timeoutMs = parseOptionalPositiveIntegerOption(options["timeout-ms"], 3000);

  try {
    if (group === "review" && action === "log") {
      const subject = positionalArgsBeforeFirstOption(rest).join(" ").trim();
      if (!subject) {
        return {
          status: "blocked",
          kind: "expert-review",
          command: item.command,
          summary: "Expert-review run-next actions must include a review subject."
        };
      }
      const reviewerRole = optionString(options["reviewer-role"]);
      if (!reviewerRole) {
        return {
          status: "blocked",
          kind: "expert-review",
          command: item.command,
          summary: "Expert-review run-next actions must include --reviewer-role so the human review boundary is explicit."
        };
      }

      const result = await writeExpertReview({
        rootPath: workspace,
        title: optionString(options.title),
        subject,
        question: optionString(options.question),
        kind: parseRunNextExpertReviewKind(optionString(options.kind)),
        status: parseRunNextExpertReviewStatus(optionString(options.status)),
        reviewerRole,
        reviewerNameOrOrg: optionString(options.reviewer),
        reviewerCredentials: optionString(options.credentials),
        conflictDisclosure: optionString(options.conflict),
        evidenceRefs: commandOptionValues(parsed.args, "evidence").map(parseRunNextExpertReviewEvidenceRef),
        findings: commandOptionValues(parsed.args, "finding"),
        limitations: commandOptionValues(parsed.args, "limitation"),
        recommendations: commandOptionValues(parsed.args, "recommendation"),
        requiredNextChecks: commandOptionValues(parsed.args, "next-check"),
        outcomeStatus: parseRunNextExpertReviewOutcome(optionString(options.outcome)),
        outcomeSummary: optionString(options.summary)
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      return {
        status: "executed",
        kind: "expert-review",
        command: item.command,
        evidenceRef: `review:${evidenceRef}`,
        attached: false,
        summary: `Wrote expert review request ${result.review.reviewId} with status ${result.review.status}.`,
        result: result.review
      };
    }
    if (group === "verify") {
      const problem = positionalArgsBeforeFirstOption([action, ...rest]).join(" ").trim();
      if (!problem) {
        throw new Error("Missing problem for verifier route.");
      }
      if (options.write !== true) {
        return {
          status: "blocked",
          kind: "verifier-route",
          command: item.command,
          summary: "Validation-gate verifier actions must include --write so the result becomes durable route evidence."
        };
      }

      const result = await writeVerifierRoute({
        rootPath: workspace,
        problem,
        timeoutMs,
        maximaCommand: optionString(options["maxima-command"]),
        sageCommand: optionString(options["sage-command"]),
        leanCommand: optionString(options["lean-command"]),
        z3Command: optionString(options["z3-command"]),
        cvc5Command: optionString(options["cvc5-command"]),
        smtReviewPolicy: options["require-independent-smt"] === true ? "independent" : "single"
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const validationGateAttachment =
        item.validationPlanId && item.validationGateId
          ? await attachValidationGateEvidence({
              rootPath: workspace,
              planRef: item.validationPlanId,
              gateId: item.validationGateId,
              evidenceRef: {
                kind: "route",
                ref: result.route.routeId,
                trust: result.route.finalTrust,
                summary: `Verifier route final trust: ${result.route.finalTrust}.`
              }
            })
          : undefined;
      const checkpoint = item.sessionId
        ? await addResearchSessionCheckpoint({
            rootPath: workspace,
            sessionRef: item.sessionId,
            summary: `Ran verifier route ${result.route.routeId} for validation gate ${item.validationGateId ?? "unknown"}.`,
            evidenceRefs: [
              {
                kind: "route",
                ref: result.route.routeId,
                trust: result.route.finalTrust,
                summary: `Verifier route final trust: ${result.route.finalTrust}.`
              }
            ],
            decisions: [validationGateAttachment?.message ?? "Treat the verifier route as evidence for review; no linked validation gate target was present."],
            nextChecks: validationGateAttachment
              ? nextChecksForValidationAttachment(validationGateAttachment)
              : [`Review route:${result.route.routeId} against the validation gate.`]
          })
        : undefined;

      return {
        status: "executed",
        kind: "verifier-route",
        command: item.command,
        evidenceRef: `route:${evidenceRef}`,
        attached: Boolean(checkpoint || validationGateAttachment),
        summary: checkpoint
          ? `Wrote verifier route ${result.route.routeId}, ${validationGateAttachmentSummary(validationGateAttachment)}, and checkpointed session ${item.sessionId}.`
          : `Wrote verifier route ${result.route.routeId}.`,
        result: {
          route: result.route,
          validationGate: validationGateAttachment
            ? {
                planId: validationGateAttachment.plan.planId,
                gateId: validationGateAttachment.gate.gateId,
                status: validationGateAttachment.gate.status,
                closed: validationGateAttachment.closed,
                satisfied: validationGateAttachment.satisfied,
                blocked: validationGateAttachment.blocked,
                message: validationGateAttachment.message
              }
            : undefined,
          checkpoint: checkpoint?.checkpoint
        }
      };
    }

    if (group === "claim" && action === "review") {
      const claimRef = rest[0];
      if (!claimRef) {
        throw new Error("Missing claim ref for claim review.");
      }
      const packet = await createClaimReviewPacket({ rootPath: workspace, claimRef });
      return {
        status: "executed",
        kind: "claim-review",
        command: item.command,
        summary: `Created claim review packet for ${packet.claimId}.`,
        result: packet
      };
    }

    if (group === "claim" && action === "add") {
      const statement = positionalArgsBeforeFirstOption(rest).join(" ").trim();
      const title = optionString(options.title);
      const supersedes = optionString(options.supersedes);
      const evidence = optionString(options.evidence);
      const nextCheck = optionString(options["next-check"]);
      const tag = optionString(options.tag);
      const dependsOn = optionString(options["depends-on"]);
      const author = optionString(options.author);
      const derivedBy = optionString(options["derived-by"]);
      const checkedValues = [statement, title, supersedes, evidence, nextCheck, tag, dependsOn, author, derivedBy].filter(
        (value): value is string => Boolean(value)
      );

      if (!statement || checkedValues.some(containsPlaceholderToken)) {
        return blockedPlaceholderCommand(item.command, "claim-add");
      }
      if (item.claimId && supersedes !== item.claimId) {
        return {
          status: "blocked",
          kind: "claim-add",
          command: item.command,
          summary: supersedes
            ? `Claim add command supersedes ${supersedes}, but the review item targets ${item.claimId}.`
            : `Claim add command must include --supersedes ${item.claimId} for this blocked-claim review item.`
        };
      }

      const result = await writeClaimLedgerRecord({
        rootPath: workspace,
        title,
        statement,
        domain: parseRunNextClaimLedgerDomain(optionString(options.domain)),
        status: parseRunNextClaimLedgerStatus(optionString(options.status)),
        trust: parseRunNextTrustLabel(optionString(options.trust)),
        tags: tag ? [tag] : [],
        dependsOn: dependsOn ? [dependsOn] : [],
        supersedes: supersedes ? [supersedes] : [],
        derivedBy,
        authors: author ? [author] : [],
        evidenceRefs: evidence ? [parseRunNextClaimLedgerEvidenceRef(evidence)] : [],
        nextChecks: nextCheck ? [nextCheck] : []
      });

      return {
        status: "executed",
        kind: "claim-add",
        command: item.command,
        evidenceRef: `claim:${result.claim.claimId}`,
        attached: result.claim.evidenceRefs.length > 0 || result.claim.supersedes.length > 0,
        summary: `Wrote claim ${result.claim.claimId}${
          result.claim.supersedes.length > 0 ? ` superseding ${result.claim.supersedes.join(", ")}` : ""
        } with trust ${result.claim.trust}.`,
        result: {
          claim: result.claim,
          jsonPath: workspaceLocalRef(workspace, result.jsonPath),
          markdownPath: workspaceLocalRef(workspace, result.markdownPath)
        }
      };
    }

    if (group === "validation" && action === "attach") {
      const planRef = rest[0];
      const gateId = rest[1];
      const evidence = optionString(options.evidence);
      if (
        !planRef ||
        !gateId ||
        !evidence ||
        planRef.includes("<") ||
        planRef.includes(">") ||
        gateId.includes("<") ||
        gateId.includes(">") ||
        evidence.includes("<") ||
        evidence.includes(">")
      ) {
        return blockedPlaceholderCommand(item.command, "validation-attach");
      }
      if (item.validationPlanId && item.validationPlanId !== planRef) {
        return {
          status: "blocked",
          kind: "validation-attach",
          command: item.command,
          summary: `Validation attach command targets ${planRef}, but the review item targets ${item.validationPlanId}.`
        };
      }
      if (item.validationGateId && item.validationGateId !== gateId) {
        return {
          status: "blocked",
          kind: "validation-attach",
          command: item.command,
          summary: `Validation attach command targets ${gateId}, but the review item targets ${item.validationGateId}.`
        };
      }

      const evidenceRef = parseRunNextValidationEvidenceRef(evidence);
      const validationGate = await attachValidationGateEvidence({
        rootPath: workspace,
        planRef,
        gateId,
        evidenceRef
      });
      const checkpointEvidenceRef: ValidationEvidenceRef = {
        kind: validationGate.evidence.kind,
        ref: validationGate.evidence.ref,
        trust: validationGate.evidence.trust,
        summary: validationGate.evidence.summary
      };
      const checkpoint = await maybeCheckpointResearchSessionEvidence(workspace, item, checkpointEvidenceRef, {
        route: { attached: false, summary: "No route obligation target was present for validation attach." },
        validationGate: { attached: true, summary: validationGate.message, result: validationGate }
      });
      const summary = checkpoint.attached
        ? `${validationGate.message} ${checkpoint.summary}`
        : validationGate.message;
      return {
        status: "executed",
        kind: "validation-attach",
        command: item.command,
        evidenceRef: `${evidenceRef.kind}:${evidenceRef.ref}`,
        attached: true,
        summary,
        result: {
          validationGate,
          checkpoint: checkpoint.result?.checkpoint
        }
      };
    }

    if (group === "route" && action === "show") {
      const routeRef = rest[0];
      if (!routeRef) {
        throw new Error("Missing route ref for route show.");
      }
      const route = await readVerifierRoute(workspace, routeRef);
      return {
        status: "executed",
        kind: "route-show",
        command: item.command,
        summary: `Read verifier route ${route.routeId}.`,
        result: route
      };
    }

    if (group === "research" && action === "show") {
      const sessionRef = rest[0];
      if (!sessionRef) {
        throw new Error("Missing session ref for research show.");
      }
      const session = await readResearchSession(workspace, sessionRef);
      return {
        status: "executed",
        kind: "research-show",
        command: item.command,
        summary: `Read research session ${session.sessionId}.`,
        result: session
      };
    }

    if (group === "workspace" && action === "report") {
      const reportId = rest[0];
      if (!reportId) {
        throw new Error("Missing report id for workspace report.");
      }
      const report = await readReportDraft({ rootPath: workspace, reportId });
      return {
        status: "executed",
        kind: "report-read",
        command: item.command,
        evidenceRef: `report:${report.report.reportId}`,
        attached: false,
        summary: `Read saved report draft ${report.report.reportId}; Markdown verification is ${report.markdownVerified ? "passing" : "failing"}.`,
        result: report
      };
    }

    if (group === "workspace" && action === "snapshot") {
      const result = await writeWorkspaceSnapshot({ rootPath: workspace });
      const snapshotRef = workspaceLocalRef(workspace, result.path);
      const evidenceRef: ValidationEvidenceRef = {
        kind: "snapshot",
        ref: snapshotRef,
        summary: `Workspace snapshot ${result.snapshot.snapshotId} captured ${result.snapshot.summary.totalFiles} local artifact(s).`
      };
      const validationGate = await maybeAttachValidationGateEvidence(workspace, item, evidenceRef);
      const checkpoint = item.sessionId
        ? await addResearchSessionCheckpoint({
            rootPath: workspace,
            sessionRef: item.sessionId,
            summary: `Captured workspace snapshot ${result.snapshot.snapshotId} for ${item.validationGateId ?? "workspace review item"}.`,
            evidenceRefs: [toResearchEvidenceRef(evidenceRef)],
            snapshotRefs: [result.snapshot.snapshotId],
            decisions: [
              validationGate.result?.message ??
                `Recorded snapshot:${snapshotRef} as local workspace state evidence for review.`
            ],
            nextChecks: validationGate.result
              ? nextChecksForValidationAttachment(validationGate.result)
              : [`Review snapshot:${snapshotRef} against the targeted validation gate.`]
          })
        : undefined;
      const attached = validationGate.attached || Boolean(checkpoint);
      const summaries = [
        `Wrote workspace snapshot ${result.snapshot.snapshotId}.`,
        validationGate.attached ? validationGate.summary : undefined,
        checkpoint ? `Checkpointed research session ${item.sessionId}.` : undefined
      ].filter((value): value is string => Boolean(value));

      return {
        status: "executed",
        kind: "workspace-snapshot",
        command: item.command,
        evidenceRef: `snapshot:${snapshotRef}`,
        attached,
        summary: summaries.join(" "),
        result: {
          snapshot: {
            schemaVersion: result.snapshot.schemaVersion,
            snapshotId: result.snapshot.snapshotId,
            projectId: result.snapshot.projectId,
            createdAt: result.snapshot.createdAt,
            workspaceDir: result.snapshot.workspaceDir,
            summary: result.snapshot.summary,
            privacy: result.snapshot.privacy,
            warnings: result.snapshot.warnings
          },
          jsonPath: snapshotRef,
          validationGate: validationGate.result
            ? {
                planId: validationGate.result.plan.planId,
                gateId: validationGate.result.gate.gateId,
                status: validationGate.result.gate.status,
                closed: validationGate.result.closed,
                satisfied: validationGate.result.satisfied,
                blocked: validationGate.result.blocked,
                message: validationGate.result.message
              }
            : undefined,
          checkpoint: checkpoint?.checkpoint
        }
      };
    }

    if (group === "engines" && action === "verify") {
      if (options.write !== true) {
        return {
          status: "blocked",
          kind: "engine-verify",
          command: item.command,
          summary: "Engine verification run-next actions must include --write so the result becomes durable evidence."
        };
      }
      const result = await writeEngineVerificationRun({
        rootPath: workspace,
        timeoutMs,
        maximaCommand: optionString(options["maxima-command"]),
        sageCommand: optionString(options["sage-command"]),
        leanCommand: optionString(options["lean-command"]),
        z3Command: optionString(options["z3-command"]),
        cvc5Command: optionString(options["cvc5-command"]),
        smtSourcePath: optionString(options["smt-source"]),
        leanSourcePath: optionString(options["lean-source"]),
        requirements: engineRequirementsFromOptions(options),
        replayCommand: item.command
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      return {
        status: "executed",
        kind: "engine-verify",
        command: item.command,
        evidenceRef: `engine-run:${evidenceRef}`,
        attached: false,
        summary: `Wrote engine verification run ${result.record.runId} with status ${result.record.status}.`,
        result: result.record
      };
    }

    if (group === "bench" && action === "run") {
      const suitePath = rest[0];
      if (!suitePath || suitePath.includes("<") || suitePath.includes(">")) {
        return blockedPlaceholderCommand(item.command, "benchmark-run");
      }
      if (options.write !== true) {
        return {
          status: "blocked",
          kind: "benchmark-run",
          command: item.command,
          summary: "Benchmark run-next actions must include --write so the result becomes durable workspace evidence."
        };
      }

      const resolvedSuitePath = resolveUnderRoot(workspace, suitePath);
      const suite = parseRunNextBenchmarkSuite(JSON.parse(await readFile(resolvedSuitePath, "utf8")) as unknown);
      const run = runRunNextBenchmarkSuite(suite);
      const result = await writeBenchmarkRunRecord({
        rootPath: workspace,
        run,
        suiteDescription: suite.description,
        suitePath: toPortablePath(relative(workspace, resolvedSuitePath)),
        command: item.command,
        workingDirectory: workspace
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const failedText = result.record.totals.failed === 0
        ? "no failing cases"
        : `${result.record.totals.failed} failing case(s)`;
      const validationEvidenceRef: ValidationEvidenceRef = {
        kind: "benchmark",
        ref: evidenceRef,
        summary: `Benchmark run ${result.record.benchmarkRunId} for ${suite.id}: ${result.record.totals.passed}/${result.record.totals.total} cases passed.`
      };
      const validationGate = await maybeAttachValidationGateEvidence(workspace, item, validationEvidenceRef);
      const checkpoint = await maybeCheckpointResearchSessionEvidence(workspace, item, validationEvidenceRef, {
        route: { attached: false, summary: "No route obligation target was present for benchmark evidence." },
        validationGate
      });
      const attached = validationGate.attached || checkpoint.attached;
      const summaries = [
        `Wrote benchmark run ${result.record.benchmarkRunId} for ${suite.id} with ${failedText}.`,
        validationGate.attached ? validationGate.summary : undefined,
        checkpoint.attached ? checkpoint.summary : undefined
      ].filter((value): value is string => Boolean(value));
      return {
        status: "executed",
        kind: "benchmark-run",
        command: item.command,
        evidenceRef: `benchmark:${evidenceRef}`,
        attached,
        summary: summaries.join(" "),
        result: attached
          ? { benchmark: result.record, attachment: { validationGate: validationGate.result, checkpoint: checkpoint.result?.checkpoint } }
          : result.record
      };
    }

    if (group === "bench" && action === "compare") {
      const [baselinePath, currentPath] = positionalArgsBeforeFirstOption(rest);
      if (
        !baselinePath ||
        !currentPath ||
        baselinePath.includes("<") ||
        baselinePath.includes(">") ||
        currentPath.includes("<") ||
        currentPath.includes(">")
      ) {
        return blockedPlaceholderCommand(item.command, "benchmark-compare");
      }
      if (options.write !== true) {
        return {
          status: "blocked",
          kind: "benchmark-compare",
          command: item.command,
          summary: "Benchmark comparison run-next actions must include --write so the result becomes durable workspace evidence."
        };
      }

      const resolvedBaselinePath = resolveUnderRoot(workspace, baselinePath);
      const resolvedCurrentPath = resolveUnderRoot(workspace, currentPath);
      const baseline = parseBenchmarkRunRecordJson(await readFile(resolvedBaselinePath, "utf8"), baselinePath);
      const current = parseBenchmarkRunRecordJson(await readFile(resolvedCurrentPath, "utf8"), currentPath);
      const result = await writeBenchmarkComparisonRecord({
        rootPath: workspace,
        baseline,
        current,
        baselineRef: toPortablePath(relative(workspace, resolvedBaselinePath)),
        currentRef: toPortablePath(relative(workspace, resolvedCurrentPath))
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const validationEvidenceRef: ValidationEvidenceRef = {
        kind: "benchmark",
        ref: evidenceRef,
        summary: `Benchmark comparison ${result.record.comparisonId}: ${result.record.verdict}.`
      };
      const checkpoint = await maybeCheckpointResearchSessionEvidence(workspace, item, validationEvidenceRef, {
        route: { attached: false, summary: "No route obligation target was present for benchmark comparison evidence." },
        validationGate: { attached: false, summary: "Benchmark comparison evidence is checkpointed for review; validation gates currently require benchmark-run evidence." }
      });
      return {
        status: "executed",
        kind: "benchmark-compare",
        command: item.command,
        evidenceRef: `benchmark:${evidenceRef}`,
        attached: checkpoint.attached,
        summary: [
          `Wrote benchmark comparison ${result.record.comparisonId} with verdict ${result.record.verdict}.`,
          checkpoint.attached ? checkpoint.summary : undefined
        ].filter((value): value is string => Boolean(value)).join(" "),
        result: checkpoint.attached
          ? { comparison: result.record, attachment: { checkpoint: checkpoint.result?.checkpoint } }
          : result.record
      };
    }

    if (group === "proof" && action === "check") {
      const sourcePath = rest[0];
      if (!sourcePath || sourcePath.includes("<") || sourcePath.includes(">")) {
        return blockedPlaceholderCommand(item.command, "proof-check");
      }
      const unchangedAttempt = await blockUnchangedRejectedProofAttempt(workspace, item, sourcePath);
      if (unchangedAttempt) {
        return unchangedAttempt;
      }
      const declarationName = typeof options.declaration === "string" ? options.declaration : undefined;
      const scope = proofCheckScopeFromOptions(options);
      const leanCommand = typeof options["lean-command"] === "string" ? options["lean-command"] : undefined;
      const backendStatus = getProofBackendStatus({
        leanCommand,
        timeoutMs
      }).backends.find((candidate) => candidate.backendId === "lean");
      if (!backendStatus?.canCheckProofs) {
        return {
          status: "blocked",
          kind: "proof-check",
          command: item.command,
          summary: `Local Lean proof checker backend is not available for run-next (${
            backendStatus?.error ?? backendStatus?.status ?? "unknown"
          }). Use the Docker proof path instead: ${dockerProofCheckCommand({
            sourcePath,
            declarationName,
            scope
          })}`
        };
      }
      const result = await writeLeanProofCheckRecord({
        rootPath: workspace,
        sourcePath,
        declarationName,
        scope,
        leanCommand,
        timeoutMs
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const attachment = await attachRunNextVerifierEvidence(workspace, item, {
        kind: "proof",
        ref: evidenceRef,
        trust: result.record.trust,
        summary: result.record.status
      });
      return {
        status: "executed",
        kind: "proof-check",
        command: item.command,
        evidenceRef: `proof:${evidenceRef}`,
        attached: attachment.attached,
        summary: attachment.summary,
        result: { proof: result.record, attachment: attachment.result }
      };
    }

    if (group === "proof" && action === "project") {
      const projectPath = rest[0] ?? ".";
      if (projectPath.includes("<") || projectPath.includes(">")) {
        return blockedPlaceholderCommand(item.command, "lean-proof-safety");
      }
      const inspection = await inspectLeanProject({
        rootPath: workspace,
        projectPath,
        maxLeanFiles: parseOptionalPositiveIntegerOption(options["max-lean-files"], 40)
      });
      const markerCount = inspection.proofSafety.markers.total;
      const firstMarker = inspection.proofSafety.markers.sample[0];

      if (markerCount > 0) {
        return {
          status: "blocked",
          kind: "lean-proof-safety",
          command: item.command,
          attached: false,
          summary: firstMarker
            ? `Proof-safety scan still finds ${markerCount} blocking Lean marker(s); first marker is ${firstMarker.kind} at ${firstMarker.path}:${firstMarker.line}:${firstMarker.column}.`
            : `Proof-safety scan still finds ${markerCount} blocking Lean marker(s).`,
          result: inspection
        };
      }

      return {
        status: "executed",
        kind: "lean-proof-safety",
        command: item.command,
        attached: false,
        summary: `Proof-safety scan found no blocking Lean markers in ${inspection.proofSafety.scannedFiles} scanned file(s).`,
        result: inspection
      };
    }

    if (group === "smt" && action === "check") {
      const sourcePath = rest[0];
      if (!sourcePath || sourcePath.includes("<") || sourcePath.includes(">")) {
        return blockedPlaceholderCommand(item.command, "smt-check");
      }
      const backend = parseSmtBackendOption(options.backend);
      const z3Command = typeof options["z3-command"] === "string" ? options["z3-command"] : undefined;
      const cvc5Command = typeof options["cvc5-command"] === "string" ? options["cvc5-command"] : undefined;
      const selectedBackend = backend ?? "z3";
      const backendStatus = getSmtBackendStatus({
        z3Command,
        cvc5Command,
        timeoutMs
      }).backends.find((candidate) => candidate.backendId === selectedBackend);
      if (!backendStatus?.canCheckSmt) {
        return {
          status: "blocked",
          kind: "smt-check",
          command: item.command,
          summary: `Local ${selectedBackend} SMT backend is not available for run-next (${
            backendStatus?.error ?? backendStatus?.status ?? "unknown"
          }). Use the Docker evidence path instead: ${dockerSmtCheckCommand({
            sourcePath,
            backend: selectedBackend,
            queryName: typeof options.query === "string" ? options.query : undefined
          })}`
        };
      }
      const result = await writeSmtCheckRecord({
        rootPath: workspace,
        sourcePath,
        queryName: typeof options.query === "string" ? options.query : undefined,
        backend,
        z3Command,
        cvc5Command,
        timeoutMs
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const attachment = await attachRunNextVerifierEvidence(workspace, item, {
        kind: "smt",
        ref: evidenceRef,
        trust: result.record.trust,
        summary: result.record.status
      });
      return {
        status: "executed",
        kind: "smt-check",
        command: item.command,
        evidenceRef: `smt:${evidenceRef}`,
        attached: attachment.attached,
        summary: attachment.summary,
        result: { smt: result.record, attachment: attachment.result }
      };
    }

    if (group === "cas" && action === "check") {
      const operation = options.operation;
      const expression = options.expression;
      const resultText = options.result;
      if (typeof operation !== "string" || typeof expression !== "string" || typeof resultText !== "string") {
        return {
          status: "blocked",
          kind: "cas-check",
          command: item.command,
          summary: "CAS check execution requires --operation, --expression, and --result."
        };
      }
      const backend = parseSymbolicCasBackendOption(options.backend) ?? "maxima";
      const maximaCommand = typeof options["maxima-command"] === "string" ? options["maxima-command"] : undefined;
      const sageCommand = typeof options["sage-command"] === "string" ? options["sage-command"] : undefined;
      const variable = typeof options.variable === "string" ? options.variable : "x";
      const backendStatus = getCasBackendStatus({
        maximaCommand,
        sageCommand,
        timeoutMs
      }).backends.find((candidate) => candidate.backendId === backend);
      if (!backendStatus?.canCheckSymbolic) {
        return {
          status: "blocked",
          kind: "cas-check",
          command: item.command,
          summary: `Local ${backendStatus?.displayName ?? `${backend} CAS`} backend is not available for run-next (${
            backendStatus?.error ?? backendStatus?.status ?? "unknown"
          }). Use the Docker evidence path instead: ${dockerCasCheckCommand({
            operation,
            expression,
            result: resultText,
            variable,
            backend
          })}`
        };
      }
      const result = await writeSymbolicCasCheckRecord({
        rootPath: workspace,
        prompt: {
          operation: parseSympyOperation(operation),
          expression,
          variable
        },
        result: resultText,
        backend,
        maximaCommand,
        sageCommand,
        timeoutMs
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const attachment = await attachRunNextVerifierEvidence(workspace, item, {
        kind: "cas",
        ref: evidenceRef,
        trust: result.record.trust,
        summary: result.record.status
      });
      return {
        status: "executed",
        kind: "cas-check",
        command: item.command,
        evidenceRef: `cas:${evidenceRef}`,
        attached: attachment.attached,
        summary: attachment.summary,
        result: { cas: result.record, attachment: attachment.result }
      };
    }
  } catch (error) {
    return {
      status: "blocked",
      kind: `${group ?? "unknown"}-${action ?? "unknown"}`,
      command: item.command,
      summary: error instanceof Error ? error.message : "Local action failed."
    };
  }

  return {
    status: "blocked",
    kind: `${group ?? "unknown"}-${action ?? "unknown"}`,
    command: item.command,
    summary: "This Truth Harness command is not yet supported by workspace run-next execution."
  };
}

function manualContainerGateBoundary(command: string): WorkspaceRunNextPlan["execution"] | undefined {
  const normalized = command.trim();
  if (/^npm\s+run\s+docker:[\w:-]+(?:\s|$)/u.test(normalized)) {
    return {
      status: "blocked",
      kind: "manual-container-gate",
      command,
      summary: "This reviewer action starts a Docker-backed npm script. Workspace run-next does not execute npm, Docker, or shell commands; run it manually or through an approved container workflow."
    };
  }
  if (/^docker\s+compose\s+run(?:\s|$)/u.test(normalized)) {
    return {
      status: "blocked",
      kind: "manual-container-gate",
      command,
      summary: "This reviewer action starts a Docker compose service. Workspace run-next does not execute Docker or shell commands; run it manually after approving the container boundary."
    };
  }
  return undefined;
}

function containsPlaceholderToken(value: string): boolean {
  return /<[^<>\s][^<>]*>/u.test(value);
}

function blockedPlaceholderCommand(command: string, kind: string): WorkspaceRunNextPlan["execution"] {
  return {
    status: "blocked",
    kind,
    command,
    summary: "The next command contains a placeholder path. Prepare a concrete workspace-local artifact before executing it."
  };
}

async function blockUnchangedRejectedProofAttempt(
  rootPath: string,
  item: WorkspaceReviewItem,
  sourcePath: string
): Promise<WorkspaceRunNextPlan["execution"] | undefined> {
  const attempt = item.proofAttempt;
  if (!attempt || !["rejected", "error"].includes(attempt.status) || !attempt.sourceSha256) {
    return undefined;
  }

  if (toPortablePath(sourcePath) !== toPortablePath(attempt.sourcePath)) {
    return undefined;
  }

  const absoluteSourcePath = resolveUnderRoot(rootPath, sourcePath);
  let sourceSha256: string;
  try {
    sourceSha256 = await sha256FileHex(absoluteSourcePath);
  } catch {
    return {
      status: "blocked",
      kind: "proof-repair-source-missing",
      command: item.command,
      summary: `Cannot rerun failed proof attempt ${attempt.checkId}: source file ${attempt.sourcePath} is missing or unreadable. Restore or recreate the proof source before running Lean again.`
    };
  }

  if (sourceSha256 !== attempt.sourceSha256) {
    return undefined;
  }

  return {
    status: "blocked",
    kind: "proof-repair-source-unchanged",
    command: item.command,
    summary: `Proof source ${attempt.sourcePath} still matches failed attempt ${attempt.checkId} (sha256:${attempt.sourceSha256}). Edit the Lean source before rerunning this proof check so the agent does not create duplicate failed evidence.`
  };
}

function dockerSmtCheckCommand(input: { sourcePath: string; backend: SmtBackendId; queryName?: string }): string {
  const backendArgs = input.backend === "z3" ? "" : ` --backend ${quoteCommandArg(input.backend)}`;
  const queryArgs = input.queryName ? ` --query ${quoteCommandArg(input.queryName)}` : "";
  return `npm run docker:cli -- smt check ${quoteCommandArg(input.sourcePath)} --${backendArgs}${queryArgs} --write`;
}

function dockerProofCheckCommand(input: {
  sourcePath: string;
  declarationName?: string;
  scope?: { routeId?: string; obligationId?: string; statementHash?: string; statement?: string };
}): string {
  const args = [
    "docker compose run --build --rm lean-proof node apps/cli/dist/index.js proof check",
    quoteCommandArg(input.sourcePath),
    input.declarationName ? `--declaration ${quoteCommandArg(input.declarationName)}` : "",
    input.scope?.routeId ? `--route ${quoteCommandArg(input.scope.routeId)}` : "",
    input.scope?.obligationId ? `--obligation ${quoteCommandArg(input.scope.obligationId)}` : "",
    input.scope?.statement ? `--statement ${quoteCommandArg(input.scope.statement)}` : "",
    input.scope?.statementHash ? `--statement-hash ${quoteCommandArg(input.scope.statementHash)}` : "",
    "--write"
  ].filter((part) => part.length > 0);

  return args.join(" ");
}

function dockerCasCheckCommand(input: {
  operation: string;
  expression: string;
  result: string;
  variable: string;
  backend: SymbolicCasBackendId;
}): string {
  const backendArgs = input.backend === "maxima" ? "" : ` --backend ${quoteCommandArg(input.backend)}`;
  const variableArgs = input.variable === "x" ? "" : ` --variable ${quoteCommandArg(input.variable)}`;
  const casArgs = [
    "cas check --",
    `--operation ${quoteCommandArg(input.operation)}`,
    `--expression ${quoteCommandArg(input.expression)}`,
    `--result ${quoteCommandArg(input.result)}`,
    `${variableArgs}${backendArgs}`,
    "--write"
  ].filter((part) => part.length > 0).join(" ");

  if (input.backend === "sage") {
    return `docker compose run --rm all-engines npm run cli -- ${casArgs}`;
  }

  return `npm run docker:cli -- ${casArgs}`;
}

async function maybeAttachRouteEvidence(
  workspace: string,
  item: WorkspaceReviewItem,
  evidenceRef: VerifierRouteEvidenceRef
): Promise<{ attached: boolean; summary: string; result?: SatisfyVerifierRouteObligationResult }> {
  if (!item.routeId || !item.obligationId) {
    return {
      attached: false,
      summary: `Wrote ${evidenceRef.kind}:${evidenceRef.ref}. No route obligation target was present, so nothing was attached.`
    };
  }

  try {
    const result = await satisfyVerifierRouteObligation({
      rootPath: workspace,
      routeRef: item.routeId,
      obligationId: item.obligationId,
      evidenceRef
    });
    return {
      attached: true,
      summary: result.message,
      result
    };
  } catch (error) {
    return {
      attached: false,
      summary: `Wrote ${evidenceRef.kind}:${evidenceRef.ref}, but did not close ${item.obligationId}: ${
        error instanceof Error ? error.message : "attachment failed"
      }`
    };
  }
}

async function maybeAttachValidationGateEvidence(
  workspace: string,
  item: WorkspaceReviewItem,
  evidenceRef: ValidationEvidenceRef
): Promise<{ attached: boolean; summary: string; result?: AttachValidationGateEvidenceResult }> {
  if (!item.validationPlanId || !item.validationGateId) {
    return {
      attached: false,
      summary: `No validation gate target was present for ${evidenceRef.kind}:${evidenceRef.ref}.`
    };
  }

  try {
    const result = await attachValidationGateEvidence({
      rootPath: workspace,
      planRef: item.validationPlanId,
      gateId: item.validationGateId,
      evidenceRef
    });
    return {
      attached: true,
      summary: result.message,
      result
    };
  } catch (error) {
    return {
      attached: false,
      summary: `Wrote ${evidenceRef.kind}:${evidenceRef.ref}, but did not update validation gate ${item.validationGateId}: ${
        error instanceof Error ? error.message : "attachment failed"
      }`
    };
  }
}

async function attachRunNextVerifierEvidence(
  workspace: string,
  item: WorkspaceReviewItem,
  evidenceRef: VerifierRouteEvidenceRef & ValidationEvidenceRef
): Promise<{
  attached: boolean;
  summary: string;
  result: {
    route?: SatisfyVerifierRouteObligationResult;
    validationGate?: AttachValidationGateEvidenceResult;
    checkpoint?: ResearchSessionCheckpointWriteResult["checkpoint"];
  };
}> {
  const route = await maybeAttachRouteEvidence(workspace, item, evidenceRef);
  const validationGate = await maybeAttachValidationGateEvidence(workspace, item, evidenceRef);
  const checkpoint = await maybeCheckpointResearchSessionEvidence(workspace, item, evidenceRef, {
    route,
    validationGate
  });
  const summaries = [route, validationGate, checkpoint]
    .filter((attachment) => attachment.attached)
    .map((attachment) => attachment.summary);

  return {
    attached: route.attached || validationGate.attached || checkpoint.attached,
    summary: summaries.length > 0
      ? summaries.join(" ")
      : `Wrote ${evidenceRef.kind}:${evidenceRef.ref}. ${route.summary} ${validationGate.summary} ${checkpoint.summary}`,
    result: {
      route: route.result,
      validationGate: validationGate.result,
      checkpoint: checkpoint.result?.checkpoint
    }
  };
}

async function maybeCheckpointResearchSessionEvidence(
  workspace: string,
  item: WorkspaceReviewItem,
  evidenceRef: ValidationEvidenceRef,
  attachments: {
    route: { attached: boolean; summary: string; result?: SatisfyVerifierRouteObligationResult };
    validationGate: { attached: boolean; summary: string; result?: AttachValidationGateEvidenceResult };
  }
): Promise<{ attached: boolean; summary: string; result?: ResearchSessionCheckpointWriteResult }> {
  if (!item.sessionId) {
    return {
      attached: false,
      summary: `No research-session target was present for ${evidenceRef.kind}:${evidenceRef.ref}.`
    };
  }

  try {
    const validationAttachment = attachments.validationGate.result;
    const checkpoint = await addResearchSessionCheckpoint({
      rootPath: workspace,
      sessionRef: item.sessionId,
      summary: `Ran ${evidenceRef.kind} checker evidence for ${item.validationGateId ?? item.obligationId ?? "workspace review item"}.`,
      evidenceRefs: [
        toResearchEvidenceRef(evidenceRef)
      ],
      decisions: [
        validationAttachment?.message ??
          attachments.route.result?.message ??
          `Recorded ${evidenceRef.kind}:${evidenceRef.ref} as local evidence for review.`
      ],
      nextChecks: validationAttachment
        ? nextChecksForValidationAttachment(validationAttachment)
        : [`Review ${evidenceRef.kind}:${evidenceRef.ref} against the targeted route or validation gate before strengthening the claim.`]
    });

    return {
      attached: true,
      summary: `Checkpointed research session ${item.sessionId}.`,
      result: checkpoint
    };
  } catch (error) {
    return {
      attached: false,
      summary: `Did not checkpoint research session ${item.sessionId}: ${
        error instanceof Error ? error.message : "checkpoint failed"
      }`
    };
  }
}

function toResearchEvidenceRef(evidenceRef: ValidationEvidenceRef): ResearchEvidenceRef {
  if (evidenceRef.kind === "session") {
    return {
      kind: "other",
      ref: `session:${evidenceRef.ref}`,
      trust: evidenceRef.trust,
      summary: evidenceRef.summary
    };
  }

  return {
    kind: evidenceRef.kind,
    ref: evidenceRef.ref,
    trust: evidenceRef.trust,
    summary: evidenceRef.summary
  };
}

function validationGateAttachmentSummary(attachment: AttachValidationGateEvidenceResult | undefined): string {
  if (!attachment) {
    return "did not update a validation gate";
  }

  if (attachment.satisfied) {
    return `satisfied validation gate ${attachment.gate.gateId}`;
  }

  if (attachment.blocked) {
    return `blocked validation gate ${attachment.gate.gateId} with refuting evidence`;
  }

  return `updated validation gate ${attachment.gate.gateId} to ${attachment.gate.status}`;
}

function nextChecksForValidationAttachment(attachment: AttachValidationGateEvidenceResult): string[] {
  if (attachment.satisfied) {
    return [
      `Validation gate ${attachment.gate.gateId} is satisfied; rerun workspace run-next to choose the next open blocker.`
    ];
  }

  if (attachment.blocked) {
    return [
      `Validation gate ${attachment.gate.gateId} is blocked by local evidence; revise or record the refuted claim before continuing.`
    ];
  }

  return attachment.gate.nextChecks.length > 0
    ? attachment.gate.nextChecks
    : [`Validation gate ${attachment.gate.gateId} remains open; attach stronger evidence before strengthening the claim.`];
}

function parseLocalTruthHarnessCommand(command: string): { ok: true; args: string[] } | { ok: false; reason: string } {
  try {
    const tokens = splitLocalCommand(command);
    if (tokens[0] !== "truth-harness") {
      return { ok: false, reason: "Only truth-harness commands can be executed by workspace run-next." };
    }

    return { ok: true, args: tokens.slice(1) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Could not parse local command."
    };
  }
}

function splitLocalCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "\"" | undefined;

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === "\\") {
        const next = command[index + 1];
        if (next === quote || next === "\\") {
          current += next;
          index += 1;
        } else {
          current += character;
        }
        continue;
      }
      if (character === quote) {
        quote = undefined;
      } else {
        current += character;
      }
      continue;
    }

    if (character === "\"") {
      quote = character;
      continue;
    }

    if (/[;&|<>`$]/u.test(character)) {
      throw new Error(`Unsupported shell metacharacter ${JSON.stringify(character)} in local command.`);
    }

    if (/\s/u.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (quote) {
    throw new Error("Command ended with an unterminated quote.");
  }
  if (current) {
    tokens.push(current);
  }
  if (tokens.length === 0) {
    throw new Error("Empty local command.");
  }

  return tokens;
}

function commandOptionMap(args: string[]): Record<string, string | true> {
  const options: Record<string, string | true> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const name = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[name] = true;
      continue;
    }

    options[name] = next;
    index += 1;
  }

  return options;
}

function commandOptionValues(args: string[], optionName: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token !== `--${optionName}`) {
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      continue;
    }
    values.push(next);
    index += 1;
  }
  return values;
}

function positionalArgsBeforeFirstOption(args: Array<string | undefined>): string[] {
  const positional: string[] = [];
  for (const token of args) {
    if (!token || token.startsWith("--")) {
      break;
    }
    positional.push(token);
  }
  return positional;
}

function parseOptionalPositiveIntegerOption(value: string | true | undefined, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${JSON.stringify(value)}.`);
  }

  return parsed;
}

function parseSmtBackendOption(value: string | true | undefined): SmtBackendId | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "z3" || value === "cvc5") {
    return value;
  }

  throw new Error(`Unsupported SMT backend ${JSON.stringify(value)}. Use z3 or cvc5.`);
}

function parseSymbolicCasBackendOption(value: string | true | undefined): SymbolicCasBackendId | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "maxima" || value === "sage") {
    return value;
  }

  throw new Error(`Unsupported CAS backend ${JSON.stringify(value)}. Use maxima or sage.`);
}

function parseRunNextClaimLedgerDomain(value: string | undefined): ClaimLedgerDomain | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isRunNextClaimLedgerDomain(value)) {
    return value;
  }

  throw new Error(`Unsupported claim ledger domain ${JSON.stringify(value)}.`);
}

function isRunNextClaimLedgerDomain(value: string): value is ClaimLedgerDomain {
  return (CLAIM_LEDGER_DOMAINS as readonly string[]).includes(value);
}

function parseRunNextClaimLedgerStatus(value: string | undefined): ClaimLedgerStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isRunNextClaimLedgerStatus(value)) {
    return value;
  }

  throw new Error(`Unsupported claim ledger status ${JSON.stringify(value)}.`);
}

function isRunNextClaimLedgerStatus(value: string): value is ClaimLedgerStatus {
  return (CLAIM_LEDGER_STATUSES as readonly string[]).includes(value);
}

function parseRunNextTrustLabel(value: string | undefined): TrustLabel | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isTrustLabel(value)) {
    return value;
  }

  throw new Error(`Unsupported trust label ${JSON.stringify(value)}.`);
}

function parseRunNextClaimLedgerEvidenceRef(value: string): ClaimLedgerEvidenceRef {
  const trustSeparator = value.lastIndexOf("@");
  const maybeTrust = trustSeparator > 0 ? value.slice(trustSeparator + 1) : undefined;
  const trust = maybeTrust ? parseRunNextTrustLabel(maybeTrust) : undefined;
  const rawRef = trust ? value.slice(0, trustSeparator) : value;
  const separator = rawRef.indexOf(":");
  if (separator <= 0) {
    return { kind: "other", ref: rawRef, trust };
  }

  const maybeKind = rawRef.slice(0, separator);
  const ref = rawRef.slice(separator + 1);
  if (isRunNextClaimEvidenceKind(maybeKind)) {
    return { kind: maybeKind, ref, trust };
  }

  return { kind: "other", ref: rawRef, trust };
}

function isRunNextClaimEvidenceKind(value: string): value is ClaimLedgerEvidenceRef["kind"] {
  return (
    value === "claim" ||
    value === "receipt" ||
    value === "artifact" ||
    value === "source" ||
    value === "literature" ||
    value === "notebook" ||
    value === "notebook-run" ||
    value === "code-run" ||
    value === "benchmark" ||
    value === "disclosure" ||
    value === "simulation" ||
    value === "experiment" ||
    value === "vault" ||
    value === "audit" ||
    value === "snapshot" ||
    value === "review" ||
    value === "validation" ||
    value === "model-context" ||
    value === "cas" ||
    value === "proof" ||
    value === "smt" ||
    value === "route" ||
    value === "invention" ||
    value === "claim-chart" ||
    value === "discovery-package" ||
    value === "other"
  );
}

function parseRunNextExpertReviewKind(value: string | undefined): ExpertReviewKind | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isExpertReviewKind(value)) {
    return value;
  }
  throw new Error(`Unsupported expert review kind ${JSON.stringify(value)}.`);
}

function parseRunNextExpertReviewStatus(value: string | undefined): ExpertReviewStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isExpertReviewStatus(value)) {
    return value;
  }
  throw new Error(`Unsupported expert review status ${JSON.stringify(value)}.`);
}

function parseRunNextExpertReviewOutcome(value: string | undefined): ExpertReviewOutcome | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isExpertReviewOutcome(value)) {
    return value;
  }
  throw new Error(`Unsupported expert review outcome ${JSON.stringify(value)}.`);
}

function parseRunNextExpertReviewEvidenceRef(value: string): ExpertReviewEvidenceRef {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    return { kind: "other", ref: value };
  }

  const maybeKind = value.slice(0, separator);
  const ref = value.slice(separator + 1);
  if (isRunNextExpertReviewEvidenceKind(maybeKind)) {
    return { kind: maybeKind, ref };
  }

  return { kind: "other", ref: value };
}

function isRunNextExpertReviewEvidenceKind(value: string): value is ExpertReviewEvidenceRef["kind"] {
  return (
    value === "receipt" ||
    value === "artifact" ||
    value === "source" ||
    value === "literature" ||
    value === "notebook" ||
    value === "notebook-run" ||
    value === "code-run" ||
    value === "benchmark" ||
    value === "cas" ||
    value === "disclosure" ||
    value === "simulation" ||
    value === "experiment" ||
    value === "vault" ||
    value === "audit" ||
    value === "snapshot" ||
    value === "session" ||
    value === "review" ||
    value === "validation" ||
    value === "model-context" ||
    value === "route" ||
    value === "invention" ||
    value === "claim-chart" ||
    value === "discovery-package" ||
    value === "other"
  );
}

function parseRunNextValidationEvidenceRef(value: string): ValidationEvidenceRef {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    return { kind: "other", ref: value };
  }

  const maybeKind = value.slice(0, separator);
  const ref = value.slice(separator + 1);
  if (isRunNextValidationEvidenceKind(maybeKind)) {
    return { kind: maybeKind, ref };
  }

  return { kind: "other", ref: value };
}

function isRunNextValidationEvidenceKind(value: string): value is ValidationEvidenceRef["kind"] {
  return (
    value === "receipt" ||
    value === "artifact" ||
    value === "source" ||
    value === "literature" ||
    value === "notebook" ||
    value === "notebook-run" ||
    value === "code-run" ||
    value === "benchmark" ||
    value === "cas" ||
    value === "proof" ||
    value === "smt" ||
    value === "disclosure" ||
    value === "simulation" ||
    value === "experiment" ||
    value === "vault" ||
    value === "audit" ||
    value === "snapshot" ||
    value === "session" ||
    value === "review" ||
    value === "validation" ||
    value === "model-context" ||
    value === "route" ||
    value === "invention" ||
    value === "claim-chart" ||
    value === "discovery-package" ||
    value === "other"
  );
}

function parseRunNextBenchmarkSuite(raw: unknown): RunNextBenchmarkSuite {
  if (!isRecord(raw)) {
    throw new Error("Benchmark suite must be a JSON object.");
  }
  if (typeof raw.id !== "string" || !raw.id.trim()) {
    throw new Error("Benchmark suite requires a non-empty id.");
  }
  if (typeof raw.title !== "string" || !raw.title.trim()) {
    throw new Error("Benchmark suite requires a non-empty title.");
  }
  if (typeof raw.description !== "string" || !raw.description.trim()) {
    throw new Error("Benchmark suite requires a non-empty description.");
  }
  if (!Array.isArray(raw.tasks)) {
    throw new Error("Benchmark suite requires a tasks array.");
  }

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    tasks: raw.tasks.map(parseRunNextBenchmarkTask)
  };
}

function parseRunNextBenchmarkTask(raw: unknown, index: number): BenchmarkRunTaskLike {
  if (!isRecord(raw)) {
    throw new Error(`Benchmark task ${index} must be a JSON object.`);
  }
  if (typeof raw.id !== "string" || !raw.id.trim()) {
    throw new Error(`Benchmark task ${index} requires a non-empty id.`);
  }
  if (typeof raw.prompt !== "string" || !raw.prompt.trim()) {
    throw new Error(`Benchmark task ${index} requires a non-empty prompt.`);
  }
  if (!isTrustLabel(raw.expectTrust)) {
    throw new Error(`Benchmark task ${index} has unsupported expectTrust ${JSON.stringify(raw.expectTrust)}.`);
  }

  return {
    id: raw.id,
    prompt: raw.prompt,
    expectTrust: raw.expectTrust,
    expectSummaryIncludes: optionalString(raw.expectSummaryIncludes, `Benchmark task ${index} expectSummaryIncludes`),
    expectEvidenceKind: optionalString(raw.expectEvidenceKind, `Benchmark task ${index} expectEvidenceKind`) as
      | Receipt["evidenceProfile"]["kind"]
      | undefined,
    level: optionalString(raw.level, `Benchmark task ${index} level`),
    category: optionalString(raw.category, `Benchmark task ${index} category`),
    aiFailureMode: optionalString(raw.aiFailureMode, `Benchmark task ${index} aiFailureMode`),
    reviewStatus: parseBenchmarkTaskReviewStatus(raw.reviewStatus, index),
    requiredEvidence: optionalStringArray(raw.requiredEvidence, `Benchmark task ${index} requiredEvidence`),
    checkerBoundary: optionalString(raw.checkerBoundary, `Benchmark task ${index} checkerBoundary`)
  };
}

function runRunNextBenchmarkSuite(suite: RunNextBenchmarkSuite): BenchmarkRunLike {
  const startedAt = new Date().toISOString();
  const results = suite.tasks.map(runRunNextBenchmarkTask);
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

function runRunNextBenchmarkTask(task: BenchmarkRunTaskLike): BenchmarkRunTaskResultLike {
  const receipt = createReceipt(task.prompt);
  const failures: string[] = [];

  if (!runNextTrustSatisfiesExpectation(receipt.trust, task.expectTrust)) {
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

function runNextTrustSatisfiesExpectation(actual: TrustLabel, expected: TrustLabel): boolean {
  return actual === expected || (expected === "exact-computed" && actual === "cross-checked");
}

function isTrustLabel(value: unknown): value is TrustLabel {
  return (
    value === "proved" ||
    value === "unverified" ||
    value === "exact-computed" ||
    value === "bounded-numeric" ||
    value === "smt-checked" ||
    value === "dimension-checked" ||
    value === "source-cited" ||
    value === "cross-checked" ||
    value === "refuted"
  );
}

function parseBenchmarkTaskReviewStatus(value: unknown, index: number): BenchmarkRunTaskLike["reviewStatus"] {
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
  throw new Error(`Benchmark task ${index} has unsupported reviewStatus ${JSON.stringify(value)}.`);
}

function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array when provided.`);
  }
  const normalized = value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`${field}[${index}] must be a string.`);
    }
    return entry.trim();
  }).filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string when provided.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSympyOperation(value: string): SympyOperation {
  if (
    value === "simplify" ||
    value === "factor" ||
    value === "expand" ||
    value === "differentiate" ||
    value === "integrate"
  ) {
    return value;
  }

  throw new Error(
    `Unsupported symbolic operation ${JSON.stringify(value)}. Use simplify, factor, expand, differentiate, or integrate.`
  );
}

function engineRequirementsFromOptions(options: Record<string, string | true>): EngineVerificationRequirements {
  return {
    maxima: Boolean(options["require-maxima"] || options["require-docker-core"] || options["require-all-concrete"] || options["require-all-engines"]),
    z3: Boolean(options["require-z3"] || options["require-docker-core"] || options["require-all-concrete"] || options["require-all-engines"]),
    cvc5: Boolean(options["require-cvc5"] || options["require-docker-core"] || options["require-all-engines"]),
    lean: Boolean(options["require-lean"] || options["require-all-concrete"] || options["require-all-engines"]),
    sage: Boolean(options["require-sage"] || options["require-all-engines"])
  };
}

function proofCheckScopeFromOptions(
  options: Record<string, string | true>
): { routeId?: string; obligationId?: string; statementHash?: string; statement?: string } | undefined {
  const scope = {
    routeId: optionString(options.route),
    obligationId: optionString(options.obligation),
    statementHash: optionString(options["statement-hash"]),
    statement: optionString(options.statement)
  };

  return Object.values(scope).some((value) => value !== undefined) ? scope : undefined;
}

function optionString(value: string | true | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function workspaceLocalRef(rootPath: string, path: string): string {
  return relative(resolve(rootPath), resolve(path)).replace(/\\/gu, "/");
}

function withWorkspaceRunNextArtifactRefs(plan: WorkspaceRunNextPlan): WorkspaceRunNextPlan {
  const nextPlan: WorkspaceRunNextPlan = { ...plan };
  delete nextPlan.artifactRefs;
  delete nextPlan.impactRefs;
  delete nextPlan.revalidationQueue;
  const artifactRefs = collectWorkspaceRunNextArtifactRefs(nextPlan);
  return artifactRefs.length > 0 ? { ...nextPlan, artifactRefs } : nextPlan;
}

async function withWorkspaceRunNextArtifactRefIntegrity(
  rootPath: string,
  plan: WorkspaceRunNextPlan
): Promise<WorkspaceRunNextPlan> {
  if (!plan.artifactRefs || plan.artifactRefs.length === 0) {
    return plan;
  }
  return {
    ...plan,
    artifactRefs: await enrichWorkspaceRunNextArtifactRefs(rootPath, plan.artifactRefs)
  };
}

async function enrichWorkspaceRunNextArtifactRefs(
  rootPath: string,
  refs: WorkspaceRunNextArtifactRef[]
): Promise<WorkspaceRunNextArtifactRef[]> {
  return Promise.all(refs.map((ref) => enrichWorkspaceRunNextArtifactRef(rootPath, ref)));
}

async function withWorkspaceRunNextImpactRefs(rootPath: string, plan: WorkspaceRunNextPlan): Promise<WorkspaceRunNextPlan> {
  if (!plan.artifactRefs || plan.artifactRefs.length === 0) {
    return plan;
  }

  const refPaths = uniqueWorkspaceRunNextImpactSourcePaths(plan.artifactRefs);
  if (refPaths.length === 0) {
    return plan;
  }

  const impactRefs: WorkspaceRunNextImpactRef[] = [];
  const warnings = [...plan.warnings];
  for (const refPath of refPaths) {
    try {
      const search = await searchWorkspaceCatalog({
        rootPath,
        ref: refPath,
        limit: 6
      });
      for (const row of search.results) {
        const citedByPath = normalizeWorkspaceRunNextArtifactPath(row.path);
        if (!citedByPath || citedByPath === refPath) {
          continue;
        }
        const matchedRef = row.artifactRefs.find((ref) => normalizeWorkspaceRunNextArtifactPath(ref.path) === refPath);
        impactRefs.push({
          refPath,
          citedByPath,
          citedByKind: row.kind,
          source: "workspace-catalog",
          ...(row.artifactId ? { citedByArtifactId: row.artifactId } : {}),
          ...(row.title ? { citedByTitle: row.title } : {}),
          ...(row.trust ? { citedByTrust: row.trust } : {}),
          ...(row.status ? { citedByStatus: row.status } : {}),
          ...(matchedRef?.fieldPath ? { fieldPath: matchedRef.fieldPath } : {}),
          ...(matchedRef?.refKind ? { refKind: matchedRef.refKind } : {})
        });
      }
    } catch (error) {
      warnings.push(
        `Citation impact lookup unavailable for ${refPath}: ${
          error instanceof Error ? error.message : String(error)
        } Impact refs require a fresh local catalog and do not affect trust labels.`
      );
      break;
    }
  }

  const uniqueImpactRefs = uniqueWorkspaceRunNextImpactRefs(impactRefs);
  return {
    ...plan,
    ...(uniqueImpactRefs.length > 0 ? { impactRefs: uniqueImpactRefs } : {}),
    warnings
  };
}

function uniqueWorkspaceRunNextImpactSourcePaths(refs: WorkspaceRunNextArtifactRef[]): string[] {
  const ignoredRoles = new Set<WorkspaceRunNextArtifactRefRole>(["run-next-packet"]);
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const ref of refs) {
    if (ignoredRoles.has(ref.role)) {
      continue;
    }
    const normalized = normalizeWorkspaceRunNextArtifactPath(ref.path);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    paths.push(normalized);
  }
  return paths.slice(0, 8);
}

function uniqueWorkspaceRunNextImpactRefs(refs: WorkspaceRunNextImpactRef[]): WorkspaceRunNextImpactRef[] {
  const seen = new Set<string>();
  const unique: WorkspaceRunNextImpactRef[] = [];
  for (const ref of refs) {
    const key = `${ref.refPath}:${ref.citedByPath}:${ref.fieldPath ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(ref);
  }
  return unique.slice(0, 24);
}

function withWorkspaceRunNextRevalidationQueue(plan: WorkspaceRunNextPlan): WorkspaceRunNextPlan {
  if (!plan.impactRefs || plan.impactRefs.length === 0) {
    return plan;
  }

  const queue = uniqueWorkspaceRunNextRevalidationItems(
    plan.impactRefs.map((ref) => workspaceRunNextRevalidationItemForImpact(ref))
  );
  return queue.length > 0 ? { ...plan, revalidationQueue: queue } : plan;
}

function workspaceRunNextRevalidationItemForImpact(ref: WorkspaceRunNextImpactRef): WorkspaceRunNextRevalidationItem {
  return {
    itemId: workspaceRunNextStableId("reval", `${ref.refPath}:${ref.citedByPath}:${ref.fieldPath ?? ""}`),
    refPath: ref.refPath,
    dependentPath: ref.citedByPath,
    dependentKind: ref.citedByKind,
    source: "impact-ref",
    priority: workspaceRunNextRevalidationPriority(ref),
    reason: `${ref.citedByKind} artifact cites ${ref.refPath}; revalidate it before relying on or mutating that evidence.`,
    command: workspaceRunNextRevalidationCommand(ref),
    evidenceRequired: workspaceRunNextRevalidationEvidenceRequired(ref),
    boundary:
      "Dependency revalidation only; this queue item does not execute commands, close validation gates, or upgrade trust labels.",
    ...(ref.citedByArtifactId ? { dependentArtifactId: ref.citedByArtifactId } : {}),
    ...(ref.citedByTitle ? { dependentTitle: ref.citedByTitle } : {}),
    ...(ref.citedByTrust ? { dependentTrust: ref.citedByTrust } : {}),
    ...(ref.citedByStatus ? { dependentStatus: ref.citedByStatus } : {}),
    ...(ref.fieldPath ? { fieldPath: ref.fieldPath } : {})
  };
}

function workspaceRunNextRevalidationPriority(ref: WorkspaceRunNextImpactRef): WorkspaceRunNextRevalidationPriority {
  return ref.citedByKind === "claims" || ref.citedByKind === "findings" || ref.citedByTrust === "proved"
    ? "high"
    : "medium";
}

function workspaceRunNextRevalidationCommand(ref: WorkspaceRunNextImpactRef): string {
  if (ref.citedByKind === "claims" && ref.citedByArtifactId) {
    return `truth-harness claim review ${ref.citedByArtifactId} --json`;
  }

  return `truth-harness catalog search --ref ${ref.refPath} --json`;
}

function workspaceRunNextRevalidationEvidenceRequired(ref: WorkspaceRunNextImpactRef): string {
  if (ref.citedByKind === "claims") {
    return "Fresh claim review showing the cited evidence still supports the dependent claim.";
  }
  if (ref.citedByKind === "findings") {
    return "Fresh handoff or reviewer packet showing the cited evidence is still valid for the intended report.";
  }
  if (ref.citedByKind === "routes") {
    return "Fresh route readiness or obligation state after inspecting the cited evidence.";
  }
  return "Fresh local review of the dependent artifact and cited evidence boundary.";
}

function uniqueWorkspaceRunNextRevalidationItems(
  items: WorkspaceRunNextRevalidationItem[]
): WorkspaceRunNextRevalidationItem[] {
  const seen = new Set<string>();
  const unique: WorkspaceRunNextRevalidationItem[] = [];
  for (const item of items) {
    const key = `${item.refPath}:${item.dependentPath}:${item.fieldPath ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  return unique
    .sort((left, right) => workspaceRunNextPriorityRank(left.priority) - workspaceRunNextPriorityRank(right.priority))
    .slice(0, 24);
}

function workspaceRunNextPriorityRank(priority: WorkspaceRunNextRevalidationPriority): number {
  return priority === "high" ? 0 : 1;
}

async function enrichWorkspaceRunNextArtifactRef(
  rootPath: string,
  ref: WorkspaceRunNextArtifactRef
): Promise<WorkspaceRunNextArtifactRef> {
  const artifactPath = normalizeWorkspaceRunNextArtifactPath(ref.path);
  if (!artifactPath) {
    return ref;
  }

  try {
    const absolutePath = resolveUnderRoot(rootPath, artifactPath);
    const artifactStat = await stat(absolutePath);
    if (!artifactStat.isFile()) {
      return ref;
    }
    const sha256 = await sha256FileHex(absolutePath);
    return {
      ...ref,
      path: artifactPath,
      sizeBytes: artifactStat.size,
      sha256,
      sha256Scope: "file",
      citation: `${artifactPath} sha256:${sha256}`
    };
  } catch {
    return ref;
  }
}

function sha256FileHex(path: string): Promise<string> {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function workspaceRunNextPacketArtifactRefs(
  plan: WorkspaceRunNextPlan,
  packetPath: string
): WorkspaceRunNextArtifactRef[] {
  return uniqueWorkspaceRunNextArtifactRefs([
    {
      path: packetPath,
      role: "run-next-packet",
      source: "workspace-run-next packet"
    },
    ...(plan.artifactRefs ?? [])
  ]);
}

function collectWorkspaceRunNextArtifactRefs(plan: WorkspaceRunNextPlan): WorkspaceRunNextArtifactRef[] {
  const refs: WorkspaceRunNextArtifactRef[] = [];
  if (plan.sourceRevision?.path) {
    refs.push({
      path: plan.sourceRevision.path,
      role: "source-revision",
      source: "sourceRevision.path"
    });
  }
  if (plan.sourceSnapshot?.path) {
    refs.push({
      path: plan.sourceSnapshot.path,
      role: "source-snapshot",
      source: "sourceSnapshot.path"
    });
  }
  const rationale = plan.rationale ?? workspaceRunNextRationaleFor(plan);
  addWorkspaceRunNextArtifactRefFromString(refs, rationale.candidateEvidenceRef, "candidate-evidence", "rationale.candidateEvidenceRef");
  addWorkspaceRunNextArtifactRefFromString(refs, plan.execution.evidenceRef, "execution-evidence", "execution.evidenceRef");
  addWorkspaceRunNextArtifactRefsFromUnknown(refs, plan.item, "item");
  addWorkspaceRunNextArtifactRefsFromUnknown(refs, plan.execution, "execution");
  addWorkspaceRunNextArtifactRefsFromUnknown(refs, plan.enginePlan, "enginePlan");
  addWorkspaceRunNextArtifactRefsFromUnknown(refs, plan.idleNextActions, "idleNextActions");
  return uniqueWorkspaceRunNextArtifactRefs(refs);
}

function addWorkspaceRunNextArtifactRefsFromUnknown(
  refs: WorkspaceRunNextArtifactRef[],
  value: unknown,
  source: string,
  seen = new WeakSet<object>()
): void {
  if (typeof value === "string") {
    addWorkspaceRunNextArtifactRefFromString(refs, value, "referenced-artifact", source);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => addWorkspaceRunNextArtifactRefsFromUnknown(refs, entry, `${source}[${index}]`, seen));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === "artifactRefs") {
      continue;
    }
    addWorkspaceRunNextArtifactRefsFromUnknown(refs, entry, `${source}.${key}`, seen);
  }
}

function addWorkspaceRunNextArtifactRefFromString(
  refs: WorkspaceRunNextArtifactRef[],
  value: string | undefined,
  role: WorkspaceRunNextArtifactRefRole,
  source: string
): void {
  if (!value) {
    return;
  }
  for (const path of workspaceRunNextArtifactPathsFromString(value)) {
    refs.push({ path, role, source });
  }
}

function workspaceRunNextArtifactPathsFromString(value: string): string[] {
  const paths = new Set<string>();
  const pattern = /(?:[A-Za-z]:[\\/][^\s"'`<>|]*?\.truth-harness[^\s"'`<>|]*|\.truth-harness[\\/][^\s"'`<>|]+)/gu;
  for (const match of value.matchAll(pattern)) {
    const normalized = normalizeWorkspaceRunNextArtifactPath(match[0]);
    if (normalized) {
      paths.add(normalized);
    }
  }
  return [...paths];
}

function normalizeWorkspaceRunNextArtifactPath(value: string): string | undefined {
  let normalized = value.trim().replace(/\\/gu, "/");
  normalized = normalized.replace(/[),.;:\]]+$/gu, "");
  const marker = ".truth-harness/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) {
    return undefined;
  }
  return normalized.slice(markerIndex);
}

function uniqueWorkspaceRunNextArtifactRefs(refs: WorkspaceRunNextArtifactRef[]): WorkspaceRunNextArtifactRef[] {
  const seen = new Set<string>();
  const unique: WorkspaceRunNextArtifactRef[] = [];
  for (const ref of refs) {
    const key = `${ref.role}:${ref.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(ref);
  }
  return unique;
}

async function requireRunNextWorkspace(rootPath: string): Promise<
  LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }
> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing run-next plans.");
  }

  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}`);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function workspaceRunNextPlanId(createdAt: string, reviewId: string): string {
  return workspaceRunNextStableId("wrn", `${createdAt}:${reviewId}`);
}

function workspaceRunNextStableId(prefix: string, seed: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}_${hash.toString(16).padStart(8, "0")}`;
}

function renderCredibilityActionAgentPacket(pack: CredibilityPack): string {
  return [
    "# Truth Harness Credibility Action Queue",
    "",
    `Pack: ${pack.packId}`,
    `Status: ${pack.status}`,
    `Professor ready: ${pack.summary.professorReady ? "yes" : "no"}`,
    `Actions: ${pack.reviewerActionPlan.totalActions} (${pack.reviewerActionPlan.criticalActions} critical, ${pack.reviewerActionPlan.highActions} high)`,
    "",
    "This queue is generated from the local credibility pack. Run-next may execute only supported Truth Harness commands through core APIs; it never executes shell strings."
  ].join("\n");
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/gu, "\\|");
}

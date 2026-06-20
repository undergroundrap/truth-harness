import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import {
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
import type { CredibilityPack } from "./credibility-pack.js";
import { writeSymbolicCasCheckRecord } from "./cas-backend.js";
import { writeEngineVerificationRun, type EngineVerificationRequirements } from "./engine-verification.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { writeLeanProofCheckRecord } from "./proof-backend.js";
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
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";
import { verifyWorkspaceSnapshot, writeWorkspaceSnapshot } from "./workspace-snapshot.js";
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

export type WorkspaceRunNextSourceSnapshotStatus = "not-recorded" | "verified" | "drifted" | "missing";
export type WorkspaceRunNextResumeStatus = "safe-to-resume" | "verify-snapshot-first" | "rerun-run-next";
export type WorkspaceRunNextResumeAction =
  | "run-selected-command"
  | "verify-source-snapshot"
  | "rerun-workspace-run-next";

export interface WorkspaceRunNextListOptions {
  verifySnapshots?: boolean;
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

export interface WorkspaceRunNextInspection {
  schemaVersion: "truth-harness.workspace-run-next-inspection.v0";
  plan: WorkspaceRunNextPlan;
  path: string;
  sourceSnapshot?: WorkspaceRunNextSourceSnapshotCheck;
  resumeDecision: WorkspaceRunNextResumeDecision;
}

export interface WorkspaceRunNextResumeDecision {
  safeToResume: boolean;
  status: WorkspaceRunNextResumeStatus;
  action: WorkspaceRunNextResumeAction;
  reason: string;
  nextCommand: string;
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
  executionKind: string;
  executionStatus: WorkspaceRunNextStatus;
  rationaleTarget?: string;
  rationaleSource?: string;
  rationaleCandidateEvidenceRef?: string;
  rationaleExecutionBoundary?: string;
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
  idleNextActions?: WorkspaceRunNextIdleAction[];
  sourceSnapshot?: WorkspaceRunNextSourceSnapshot;
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
}): Promise<WorkspaceRunNextPlan> {
  const createdAt = input.now ?? new Date().toISOString();
  const planId = workspaceRunNextPlanId(createdAt, input.review.reviewId);
  const nextItem = input.review.autonomy.nextItemId
    ? input.review.items.find((item) => item.itemId === input.review.autonomy.nextItemId)
    : undefined;
  const noNextItemSummary = input.review.items.length > 0
    ? "No executable local work item is available; remaining review items are passive inspection blockers."
    : "No open workspace review item is available.";
  const basePlan: WorkspaceRunNextPlan = {
    schemaVersion: WORKSPACE_RUN_NEXT_SCHEMA_VERSION,
    planId,
    createdAt,
    workspacePath: input.rootPath,
    localOnly: true,
    networkAccess: "none",
    dryRun: !input.executeLocal,
    status: "planned",
    mode: input.review.autonomy.mode,
    reviewId: input.review.reviewId,
    item: nextItem ? workspaceRunNextItemSummary(nextItem) : undefined,
    execution: {
      status: "planned",
      kind: "dry-run",
      summary: nextItem
        ? "Dry-run only. Re-run with --execute-local to run one supported local Truth Harness action."
        : noNextItemSummary
    },
    stopConditions: input.review.autonomy.stopConditions,
    warnings: [
      "Run-next never executes shell strings. Only supported local Truth Harness actions can run.",
      "Execution can create evidence artifacts, but trust labels change only when matching obligations accept those artifacts."
    ]
  };

  if (!nextItem) {
    return withWorkspaceRunNextRationale({
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
    return withWorkspaceRunNextRationale(basePlan);
  }

  if (!input.review.autonomy.canRunUnattended) {
    return withWorkspaceRunNextRationale({
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
  return withWorkspaceRunNextRationale({
    ...basePlan,
    status: execution.status,
    execution
  });
}

export function createWorkspaceReviewFromCredibilityPack(input: {
  rootPath: string;
  pack: CredibilityPack;
}): WorkspaceReview {
  const actions = input.pack.reviewerActionPlan.actions;
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
    items: actions.map((action) => ({
      itemId: action.actionId,
      kind: "credibility-action",
      priority: action.priority,
      title: action.title,
      summary: action.detail,
      command: action.command,
      acceptanceCriteria: action.closes.map((target) => `Close ${target}.`),
      agentPacket: `${action.title}\n\n${action.detail}\n\nCommand: ${action.command}`,
      source: {
        label: `credibility ${action.category}`,
        ref: `${input.pack.packId}:${action.source.kind}:${action.source.ref}`
      }
    })),
    warnings: input.pack.warnings,
    markdown: renderCredibilityActionAgentPacket(input.pack)
  };
}

export async function writeWorkspaceRunNextPlan(input: {
  rootPath: string;
  plan: WorkspaceRunNextPlan;
}): Promise<WorkspaceRunNextWriteResult> {
  const status = await requireRunNextWorkspace(input.rootPath);
  const basePlan: WorkspaceRunNextPlan = {
    ...input.plan,
    workspacePath: status.root
  };
  await assertWorkspaceRunNextPlanSchema(basePlan);
  const snapshot = await writeWorkspaceSnapshot({
    rootPath: status.root,
    now: input.plan.createdAt
  });
  const plan: WorkspaceRunNextPlan = {
    ...basePlan,
    sourceSnapshot: {
      snapshotId: snapshot.snapshot.snapshotId,
      path: toPortablePath(relative(status.root, snapshot.path)),
      totalFiles: snapshot.snapshot.summary.totalFiles,
      totalBytes: snapshot.snapshot.summary.totalBytes
    }
  };
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

  const summaries = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const path = join(findingsDir, file);
        const plan = tryParseWorkspaceRunNextJson(await readFile(path, "utf8"));
        if (!plan) {
          return undefined;
        }
        const portablePath = toPortablePath(relative(status.root, path));
        const snapshotStatus = options.verifySnapshots
          ? await verifyRunNextSourceSnapshot(status.root, plan, portablePath, options.now)
          : undefined;
        return summarizeWorkspaceRunNextPlan(plan, portablePath, snapshotStatus);
      })
  );

  return summaries
    .filter((summary): summary is WorkspaceRunNextSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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
  const sourceSnapshot = options.verifySnapshot
    ? await verifyRunNextSourceSnapshot(status.root, plan, path, options.now)
    : undefined;

  return {
    schemaVersion: "truth-harness.workspace-run-next-inspection.v0",
    plan,
    path,
    resumeDecision: createWorkspaceRunNextResumeDecision(plan, sourceSnapshot),
    ...(sourceSnapshot ? { sourceSnapshot } : {})
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
    ["Candidate evidence", rationale.candidateEvidenceRef ?? "No candidate evidence ref selected."],
    ["Execution boundary", rationale.executionBoundary],
    ["First stop condition", rationale.firstStopCondition ?? "No stop condition recorded."],
    ["First warning", rationale.firstWarning ?? "No warning recorded."]
  ];
}

function withWorkspaceRunNextRationale(plan: WorkspaceRunNextPlan): WorkspaceRunNextPlan {
  return {
    ...plan,
    rationale: workspaceRunNextRationaleFor(plan)
  };
}

function workspaceRunNextRationaleFor(plan: WorkspaceRunNextPlan): WorkspaceRunNextRationale {
  const item = plan.item;
  const candidateEvidenceRef = plan.execution.evidenceRef ?? evidenceRefFromRunNextCommand(item?.command ?? plan.execution.command);
  return {
    target: workspaceRunNextTarget(item),
    source: item ? `${item.kind} / ${item.priority}` : "workspace-review",
    ...(candidateEvidenceRef ? { candidateEvidenceRef } : {}),
    executionBoundary: plan.dryRun
      ? "Dry-run only; execute through CLI/MCP with explicit local execution approval."
      : "Executed through the bounded in-process run-next planner.",
    ...(plan.stopConditions[0] ? { firstStopCondition: plan.stopConditions[0] } : {}),
    ...(plan.warnings[0] ? { firstWarning: plan.warnings[0] } : {})
  };
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
      actionId: "refresh-professor-review",
      title: "Refresh the professor credibility packet",
      command: `truth-harness workspace credibility-pack ${workspace} --require-all-engines`,
      reason:
        "Recomputes the reviewer packet from local artifacts so a professor or agent can see whether new blockers appeared.",
      boundary:
        "Reads local evidence and engine-run records; it does not prove new claims or execute Docker by itself.",
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
  sourceSnapshotCheck?: WorkspaceRunNextSourceSnapshotCheck
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
    executionKind: plan.execution.kind,
    executionStatus: plan.execution.status,
    rationaleTarget: rationale.target,
    rationaleSource: rationale.source,
    rationaleCandidateEvidenceRef: rationale.candidateEvidenceRef,
    rationaleExecutionBoundary: rationale.executionBoundary,
    sourceSnapshotId: plan.sourceSnapshot?.snapshotId,
    sourceSnapshotPath: plan.sourceSnapshot?.path,
    sourceSnapshotFiles: plan.sourceSnapshot?.totalFiles,
    sourceSnapshotBytes: plan.sourceSnapshot?.totalBytes,
    resumeDecision: createWorkspaceRunNextResumeDecision(plan, sourceSnapshotCheck),
    ...(sourceSnapshotCheck ?? {})
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
      isRunNextSelfAddedPath(planPath, entry.path)
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

function isRunNextSelfAddedPath(planPath: string, addedPath: string): boolean {
  if (addedPath === planPath) {
    return true;
  }
  return planPath.endsWith(".json") && addedPath === planPath.replace(/\.json$/u, ".md");
}

function createWorkspaceRunNextResumeDecision(
  plan: WorkspaceRunNextPlan,
  sourceSnapshot: WorkspaceRunNextSourceSnapshotCheck | undefined
): WorkspaceRunNextResumeDecision {
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
    reason: "The source workspace snapshot still matches, and this packet is a pending dry-run handoff.",
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
    reportId: item.reportId
  };
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
      return {
        status: "executed",
        kind: "benchmark-run",
        command: item.command,
        evidenceRef: `benchmark:${evidenceRef}`,
        attached: false,
        summary: `Wrote benchmark run ${result.record.benchmarkRunId} for ${suite.id} with ${failedText}.`,
        result: result.record
      };
    }

    if (group === "proof" && action === "check") {
      const sourcePath = rest[0];
      if (!sourcePath || sourcePath.includes("<") || sourcePath.includes(">")) {
        return blockedPlaceholderCommand(item.command, "proof-check");
      }
      const result = await writeLeanProofCheckRecord({
        rootPath: workspace,
        sourcePath,
        declarationName: typeof options.declaration === "string" ? options.declaration : undefined,
        scope: proofCheckScopeFromOptions(options),
        leanCommand: typeof options["lean-command"] === "string" ? options["lean-command"] : undefined,
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
          }). Use the Docker evidence path instead: ${dockerSmtCheckCommand(sourcePath, selectedBackend)}`
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
      const result = await writeSymbolicCasCheckRecord({
        rootPath: workspace,
        prompt: {
          operation: parseSympyOperation(operation),
          expression,
          variable: typeof options.variable === "string" ? options.variable : "x"
        },
        result: resultText,
        maximaCommand: typeof options["maxima-command"] === "string" ? options["maxima-command"] : undefined,
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
  return value.includes("<") || value.includes(">");
}

function blockedPlaceholderCommand(command: string, kind: string): WorkspaceRunNextPlan["execution"] {
  return {
    status: "blocked",
    kind,
    command,
    summary: "The next command contains a placeholder path. Prepare a concrete workspace-local artifact before executing it."
  };
}

function dockerSmtCheckCommand(sourcePath: string, backend: SmtBackendId): string {
  const backendArgs = backend === "z3" ? "" : ` --backend ${quoteCommandArg(backend)}`;
  return `npm run docker:cli -- smt check ${quoteCommandArg(sourcePath)} --${backendArgs} --write`;
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
    category: optionalString(raw.category, `Benchmark task ${index} category`),
    aiFailureMode: optionalString(raw.aiFailureMode, `Benchmark task ${index} aiFailureMode`)
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
  const seed = `${createdAt}:${reviewId}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `wrn_${hash.toString(16).padStart(8, "0")}`;
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

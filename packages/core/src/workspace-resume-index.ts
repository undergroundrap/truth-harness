import { resolve } from "node:path";
import { createEngineReadinessReport } from "./engine-readiness.js";
import { getLocalWorkspaceStatus } from "./local-workspace.js";
import { listWorkspacePilotLoopRecords, type WorkspacePilotLoopSummary } from "./workspace-pilot-loop.js";
import {
  createWorkspaceReview,
  workspaceReviewCommandActionability,
  type WorkspaceReviewCommandActionability,
  type WorkspaceReviewItem,
  type WorkspaceReviewPriority
} from "./workspace-review.js";
import { listWorkspaceRunNextPlans, type WorkspaceRunNextSummary } from "./workspace-run-next.js";

export type WorkspaceResumeIndexItemKind =
  | "saved-run-next"
  | "workspace-review-item"
  | "pilot-loop-transcript"
  | "engine-readiness-gate";

export type WorkspaceResumeIndexPriority = "critical" | "high" | "medium" | "low";

export interface WorkspaceResumeIndexInput {
  rootPath: string;
  now?: string;
  limit?: number;
  runNextLimit?: number;
  pilotLoopLimit?: number;
  reviewLimit?: number;
  verifySnapshots?: boolean;
}

export interface WorkspaceResumeIndexItem {
  rank: number;
  itemId: string;
  kind: WorkspaceResumeIndexItemKind;
  priority: WorkspaceResumeIndexPriority;
  title: string;
  summary: string;
  command: string;
  reason: string;
  evidenceRequired: string;
  boundary: string;
  source: {
    label: string;
    ref: string;
  };
  score: number;
  createdAt?: string;
  status?: string;
  safeToResume?: boolean;
  requiresHumanInput?: boolean;
  refs?: string[];
}

export interface WorkspaceResumeIndex {
  schemaVersion: "truth-harness.workspace-resume-index.v0";
  createdAt: string;
  workspacePath: string;
  localOnly: true;
  networkAccess: "none";
  summary: {
    totalItems: number;
    safeSavedRunNextHandoffs: number;
    savedRunNextHandoffs: number;
    pilotLoopTranscripts: number;
    openReviewItems: number;
    blockedEngineGates: number;
  };
  items: WorkspaceResumeIndexItem[];
  warnings: string[];
}

const DEFAULT_LIMIT = 12;
const DEFAULT_RUN_NEXT_LIMIT = 8;
const DEFAULT_PILOT_LOOP_LIMIT = 5;
const DEFAULT_REVIEW_LIMIT = 5;

export async function createWorkspaceResumeIndex(input: WorkspaceResumeIndexInput): Promise<WorkspaceResumeIndex> {
  const status = await getLocalWorkspaceStatus(input.rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before creating a resume index.");
  }

  const createdAt = input.now ?? new Date().toISOString();
  const root = status.root;
  const verifySnapshots = input.verifySnapshots ?? true;
  const runNexts = await listWorkspaceRunNextPlans(root, {
    verifySnapshots,
    limit: input.runNextLimit ?? DEFAULT_RUN_NEXT_LIMIT,
    now: createdAt
  });
  const pilotLoops = await listWorkspacePilotLoopRecords(root, {
    limit: input.pilotLoopLimit ?? DEFAULT_PILOT_LOOP_LIMIT
  });
  const review = await createWorkspaceReview({
    rootPath: root,
    maxRoutes: 100,
    maxClaims: 200,
    maxSessions: 100,
    maxReports: 50,
    now: createdAt
  });
  const engineReadiness = createEngineReadinessReport();

  const runNextItems = compactRunNextResumeItems(runNexts.flatMap((plan) => resumeIndexItemsFromRunNext(root, plan)));

  const items = [
    ...runNextItems,
    ...review.items.slice(0, input.reviewLimit ?? DEFAULT_REVIEW_LIMIT).map((item) => resumeIndexItemFromReview(item)),
    ...pilotLoops.flatMap((loop) => resumeIndexItemsFromPilotLoop(root, loop)),
    ...engineReadiness.gates
      .filter((gate) => gate.status === "blocked")
      .map((gate): WorkspaceResumeIndexItem => ({
        rank: 0,
        itemId: `engine-gate:${gate.id}`,
        kind: "engine-readiness-gate" as const,
        priority: gate.id.includes("professor") ? "high" : "medium",
        title: gate.title,
        summary: gate.summary,
        command: gate.nextActions[0] ?? "truth-harness engines",
        reason: "Engine readiness is blocked; concrete verifier evidence may require a Docker or local engine gate before a stronger claim can close.",
        evidenceRequired: "A concrete engine verification run, not a readiness probe.",
        boundary: "Readiness gates do not prove claims; they only tell agents which verifier stack is available.",
        source: {
          label: "engine-readiness",
          ref: gate.id
        },
        score: gate.id.includes("strict") ? 45 : 40,
        status: gate.status,
        requiresHumanInput: true
      }))
  ]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, input.limit ?? DEFAULT_LIMIT)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    schemaVersion: "truth-harness.workspace-resume-index.v0",
    createdAt,
    workspacePath: root,
    localOnly: true,
    networkAccess: "none",
    summary: {
      totalItems: items.length,
      safeSavedRunNextHandoffs: runNexts.filter((plan) => plan.resumeDecision.safeToResume).length,
      savedRunNextHandoffs: runNexts.length,
      pilotLoopTranscripts: pilotLoops.length,
      openReviewItems: review.items.length,
      blockedEngineGates: engineReadiness.gates.filter((gate) => gate.status === "blocked").length
    },
    items,
    warnings: [
      "The resume index is navigation only; it does not execute commands or upgrade trust.",
      "Resume saved run-next handoffs only when their resumeDecision is safe, or rerun workspace run-next first.",
      ...review.warnings.slice(0, 3)
    ]
  };
}

function compactRunNextResumeItems(items: WorkspaceResumeIndexItem[]): WorkspaceResumeIndexItem[] {
  const safe = items.filter((item) => item.safeToResume === true);
  const unsafe = items
    .filter((item) => item.safeToResume !== true)
    .sort((left, right) => right.score - left.score || (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));

  return [...safe, ...unsafe.slice(0, 2)];
}

function resumeIndexItemsFromRunNext(root: string, plan: WorkspaceRunNextSummary): WorkspaceResumeIndexItem[] {
  const title = plan.itemTitle ?? plan.rationaleTarget ?? "Saved run-next handoff";
  const refs = [plan.path, plan.sourceRevisionPath, plan.sourceSnapshotPath].filter((ref): ref is string => Boolean(ref));
  const safe = plan.resumeDecision.safeToResume;
  const priority = plan.itemPriority ?? (safe ? "high" : "medium");
  const score = (safe ? 100 : 58) + priorityWeight(priority);
  const command = safe
    ? plan.resumeDecision.nextCommand
    : plan.resumeDecision.nextCommand || `truth-harness workspace run-next ${quoteCommandArg(root)} --json`;

  return [
    {
      rank: 0,
      itemId: `run-next:${plan.planId}`,
      kind: "saved-run-next",
      priority,
      title,
      summary: plan.resumeDecision.reason,
      command,
      reason: safe
        ? "Saved run-next handoff verified cleanly and can be resumed through the structured autonomy contract."
        : "Saved run-next handoff exists but must be verified or refreshed before execution.",
      evidenceRequired: plan.enginePlanRecommendedFirstCommand ?? "Run the selected bounded Truth Harness command and attach its produced evidence.",
      boundary: plan.rationaleExecutionBoundary ?? "Only execute through CLI/MCP run-next gates; never run copied shell text directly.",
      source: {
        label: "workspace-run-next",
        ref: plan.path
      },
      score,
      createdAt: plan.createdAt,
      status: plan.resumeDecision.status,
      safeToResume: safe,
      requiresHumanInput: plan.resumeDecision.action !== "run-selected-command",
      refs
    }
  ];
}

function resumeIndexItemFromReview(item: WorkspaceReviewItem): WorkspaceResumeIndexItem {
  const priority = item.priority;
  const actionability = workspaceReviewCommandActionability(item.command);
  const firstOpenSlot = item.evidenceSlots?.find((slot) => slot.required && slot.status !== "satisfied");
  return {
    rank: 0,
    itemId: `review:${item.itemId}`,
    kind: "workspace-review-item",
    priority,
    title: item.title,
    summary: item.summary,
    command: item.command,
    reason:
      actionability === "passive-inspection"
        ? "Current workspace review selected this as context, but it is read-only inspection; close concrete verifier gates before spending agent time here."
        : "Current workspace review selected this as an open blocker.",
    evidenceRequired:
      firstOpenSlot?.description ??
      (actionability === "passive-inspection"
        ? "A follow-up checkpoint, verifier artifact, or refreshed run-next plan; inspection alone does not close the blocker."
        : "Write or attach the artifact requested by the review item."),
    boundary: item.agentPacket ?? "Use the existing Truth Harness command; do not treat review text as evidence.",
    source: {
      label: item.source.label,
      ref: item.source.ref
    },
    score: reviewItemBaseScore(actionability) + priorityWeight(priority),
    createdAt: item.createdAt,
    status: item.kind,
    requiresHumanInput: item.command.includes("<") || item.command.includes("review") || actionability === "passive-inspection",
    refs: [item.routeId, item.claimId, item.sessionId, item.validationPlanId, item.validationGateId].filter(
      (ref): ref is string => Boolean(ref)
    )
  };
}

function resumeIndexItemsFromPilotLoop(root: string, loop: WorkspacePilotLoopSummary): WorkspaceResumeIndexItem[] {
  if (loop.runNextPlanCount <= 0 || !loop.lastRunNextPlanPath) {
    return [];
  }

  return [
    {
      rank: 0,
      itemId: `pilot-loop:${loop.loopId}`,
      kind: "pilot-loop-transcript",
      priority: loop.status === "blocked" ? "high" : "medium",
      title: loop.lastItemTitle ?? loop.firstItemTitle ?? "Saved pilot-loop transcript",
      summary: `Saved loop ${loop.loopId} recorded ${loop.runNextPlanCount} run-next handoff(s); latest handoff is ${loop.lastRunNextPlanPath}.`,
      command: `truth-harness workspace continue-pilot-loop ${quoteCommandArg(loop.loopId)} --workspace ${quoteCommandArg(root)} --json`,
      reason: "A bounded pilot loop already recorded where the agent stopped; continue from its latest saved run-next handoff before inventing new work.",
      evidenceRequired: "A verified source revision/snapshot for the selected saved handoff, then the next bounded run-next artifact.",
      boundary: "The transcript is provenance only; continuation still verifies the saved handoff before returning a next action.",
      source: {
        label: "workspace-pilot-loop",
        ref: loop.path
      },
      score: 80 + (loop.status === "blocked" ? 10 : 0),
      createdAt: loop.createdAt,
      status: loop.status,
      safeToResume: undefined,
      requiresHumanInput: false,
      refs: [loop.path, loop.markdownPath, loop.lastRunNextPlanPath, loop.lastRunNextMarkdownPath].filter(
        (ref): ref is string => Boolean(ref)
      )
    }
  ];
}

function priorityWeight(priority: WorkspaceReviewPriority): number {
  switch (priority) {
    case "critical":
      return 9;
    case "high":
      return 6;
    case "medium":
      return 3;
    case "low":
      return 1;
  }
}

function reviewItemBaseScore(actionability: WorkspaceReviewCommandActionability): number {
  switch (actionability) {
    case "evidence-writing":
      return 90;
    case "bounded-action":
      return 70;
    case "passive-inspection":
      return 25;
  }
}

function quoteCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/u.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

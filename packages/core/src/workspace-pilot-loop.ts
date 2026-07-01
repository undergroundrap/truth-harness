import { mkdir, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { createCredibilityPack } from "./credibility-pack.js";
import type { EngineVerificationRequirements } from "./engine-verification.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";
import {
  createWorkspaceReview,
  type WorkspaceReview,
  type WorkspaceReviewItem
} from "./workspace-review.js";
import {
  createWorkspaceRunNextPlanFromSavedHandoff,
  createWorkspaceReviewFromCredibilityPack,
  createWorkspaceRunNextPlan,
  listWorkspaceRunNextPlans,
  writeWorkspaceRunNextPlan,
  type WorkspaceRunNextInspection,
  type WorkspaceRunNextPlan,
  type WorkspaceRunNextSavedHandoffResult,
  type WorkspaceRunNextWriteResult
} from "./workspace-run-next.js";
import type { CreateEnginePlanOptions, EnginePlan } from "./engine-plan.js";

export type WorkspacePilotLoopStatus = "completed" | "blocked" | "stopped";
export type WorkspacePilotLoopSource = "workspace-review" | "credibility-actions" | "saved-run-next";

const WORKSPACE_PILOT_LOOP_SCHEMA_VERSION = "truth-harness.workspace-pilot-loop.v0" as const;
const DEFAULT_MAX_STEPS = 3;
const MAX_ALLOWED_STEPS = 12;

export interface WorkspacePilotLoopInput {
  rootPath: string;
  source?: WorkspacePilotLoopSource;
  planRef?: string;
  executeLocal?: boolean;
  writeRunNextPlans?: boolean;
  maxSteps?: number;
  now?: string;
  maxRoutes?: number;
  maxClaims?: number;
  maxSessions?: number;
  maxReports?: number;
  timeoutMs?: number;
  maximaCommand?: string;
  sageCommand?: string;
  leanCommand?: string;
  z3Command?: string;
  cvc5Command?: string;
  smtSourcePath?: string;
  leanSourcePath?: string;
  engineRequirements?: EngineVerificationRequirements;
  enginePlanOptions?: CreateEnginePlanOptions;
}

export interface WorkspacePilotLoopStep {
  index: number;
  createdAt: string;
  reviewId: string;
  planId: string;
  runNextPlanPath?: string;
  runNextMarkdownPath?: string;
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
  enginePlan?: Pick<
    EnginePlan,
    "status" | "classifications" | "targetTrustCeiling" | "recommendedFirstCommand" | "readyCapabilityIds" | "blockedCapabilityIds"
  >;
  execution: WorkspaceRunNextPlan["execution"];
  status: WorkspaceRunNextPlan["status"];
  stopReason?: string;
}

export interface WorkspacePilotLoopRecord {
  schemaVersion: typeof WORKSPACE_PILOT_LOOP_SCHEMA_VERSION;
  loopId: string;
  createdAt: string;
  completedAt: string;
  workspacePath: string;
  localOnly: true;
  networkAccess: "none";
  dryRun: boolean;
  source: WorkspacePilotLoopSource;
  maxSteps: number;
  status: WorkspacePilotLoopStatus;
  stopReason: string;
  summary: {
    plannedSteps: number;
    executedSteps: number;
    blockedSteps: number;
    attachedEvidenceSteps: number;
    evidenceRefs: string[];
  };
  steps: WorkspacePilotLoopStep[];
  stopConditions: string[];
  warnings: string[];
}

export interface WorkspacePilotLoopRunResult {
  loop: WorkspacePilotLoopRecord;
  runNextWrites: WorkspaceRunNextWriteResult[];
}

export interface WorkspacePilotLoopWriteResult {
  loop: WorkspacePilotLoopRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface WorkspacePilotLoopListOptions {
  limit?: number;
}

export interface WorkspacePilotLoopSummary {
  schemaVersion: typeof WORKSPACE_PILOT_LOOP_SCHEMA_VERSION;
  loopId: string;
  createdAt: string;
  completedAt: string;
  path: string;
  markdownPath?: string;
  localOnly: true;
  networkAccess: "none";
  dryRun: boolean;
  source: WorkspacePilotLoopSource;
  maxSteps: number;
  status: WorkspacePilotLoopStatus;
  stopReason: string;
  plannedSteps: number;
  executedSteps: number;
  blockedSteps: number;
  attachedEvidenceSteps: number;
  evidenceRefs: string[];
  firstItemTitle?: string;
  firstCommand?: string;
  lastItemTitle?: string;
  lastExecutionKind?: string;
  enginePlanStatuses: string[];
  runNextPlanCount: number;
  firstRunNextPlanPath?: string;
  lastRunNextPlanPath?: string;
  lastRunNextMarkdownPath?: string;
}

export interface WorkspacePilotLoopInspection {
  schemaVersion: "truth-harness.workspace-pilot-loop-inspection.v0";
  loop: WorkspacePilotLoopRecord;
  path: string;
  markdownPath?: string;
}

export interface WorkspacePilotLoopContinuationInput {
  rootPath: string;
  loopRef: string;
  executeLocal?: boolean;
  writeRunNextPlan?: boolean;
  now?: string;
  timeoutMs?: number;
  maximaCommand?: string;
  sageCommand?: string;
  leanCommand?: string;
  z3Command?: string;
  cvc5Command?: string;
  enginePlanOptions?: CreateEnginePlanOptions;
}

export interface WorkspacePilotLoopContinuationResult {
  schemaVersion: "truth-harness.workspace-pilot-loop-continuation.v0";
  loop: WorkspacePilotLoopRecord;
  loopPath: string;
  loopMarkdownPath?: string;
  selectedStep: WorkspacePilotLoopStep;
  selectedPlanRef: string;
  sourcePlan: WorkspaceRunNextPlan;
  sourcePlanPath: string;
  sourceInspection: WorkspaceRunNextInspection;
  plan: WorkspaceRunNextPlan;
  written?: WorkspaceRunNextWriteResult;
  resumeCommand: string;
  warnings: string[];
}

export async function runWorkspacePilotLoop(input: WorkspacePilotLoopInput): Promise<WorkspacePilotLoopRunResult> {
  const status = await requirePilotLoopWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const maxSteps = normalizeMaxSteps(input.maxSteps);
  const source = input.source ?? "workspace-review";
  const steps: WorkspacePilotLoopStep[] = [];
  const runNextWrites: WorkspaceRunNextWriteResult[] = [];
  const seenTargets = new Set<string>();
  const warnings = [
    "Pilot-loop never executes shell strings; it only calls the bounded workspace run-next planner.",
    "Each iteration stops when no durable local evidence progress is produced.",
    "Trust labels move only when produced evidence satisfies an existing route, claim, or validation gate."
  ];
  let stopReason = "max-steps";
  let loopStatus: WorkspacePilotLoopStatus = "completed";
  let latestStopConditions: string[] = [];

  if (source === "saved-run-next") {
    return runSavedRunNextPilotLoop({
      input,
      status,
      createdAt,
      maxSteps,
      source,
      warnings
    });
  }

  for (let index = 0; index < maxSteps; index += 1) {
    const stepNow = timestampForStep(createdAt, index);
    const review = await createPilotLoopReview({
      ...input,
      rootPath: status.root,
      source
    });
    const dryPlan = await createWorkspaceRunNextPlan({
      rootPath: status.root,
      review,
      executeLocal: false,
      now: stepNow,
      enginePlanOptions: {
        timeoutMs: input.timeoutMs,
        maximaCommand: input.maximaCommand,
        sageCommand: input.sageCommand,
        leanCommand: input.leanCommand,
        z3Command: input.z3Command,
        cvc5Command: input.cvc5Command,
        ...input.enginePlanOptions
      }
    });
    latestStopConditions = dryPlan.stopConditions;

    const targetKey = pilotLoopTargetKey(dryPlan);
    if (seenTargets.has(targetKey)) {
      stopReason = "repeated-run-next-target";
      loopStatus = "blocked";
      const step = await recordPilotLoopStep({
        rootPath: status.root,
        plan: {
          ...dryPlan,
          status: "blocked",
          execution: {
            ...dryPlan.execution,
            status: "blocked",
            kind: "repeated-run-next-target",
            summary:
              "Pilot-loop stopped before execution because run-next selected the same item again; a human or stronger verifier route should inspect the blocker."
          }
        },
        index,
        writeRunNextPlan: Boolean(input.writeRunNextPlans)
      });
      steps.push(step.step);
      if (step.write) {
        runNextWrites.push(step.write);
      }
      break;
    }

    seenTargets.add(targetKey);

    const plan = input.executeLocal
      ? await createWorkspaceRunNextPlan({
          rootPath: status.root,
          review,
          executeLocal: true,
          now: stepNow,
          enginePlanOptions: {
            timeoutMs: input.timeoutMs,
            maximaCommand: input.maximaCommand,
            sageCommand: input.sageCommand,
            leanCommand: input.leanCommand,
            z3Command: input.z3Command,
            cvc5Command: input.cvc5Command,
            ...input.enginePlanOptions
          }
        })
      : dryPlan;
    const recorded = await recordPilotLoopStep({
      rootPath: status.root,
      plan,
      index,
      writeRunNextPlan: Boolean(input.writeRunNextPlans)
    });
    steps.push(recorded.step);
    if (recorded.write) {
      runNextWrites.push(recorded.write);
    }

    if (!input.executeLocal) {
      stopReason = "dry-run";
      loopStatus = "stopped";
      break;
    }
    if (!plan.item) {
      stopReason = "no-open-item";
      loopStatus = pilotLoopHasDurableProgress(steps) ? "completed" : "blocked";
      break;
    }
    if (plan.status === "blocked" || plan.execution.status === "blocked") {
      stopReason = plan.execution.kind || "blocked";
      loopStatus = "blocked";
      break;
    }
    if (!pilotLoopMadeDurableProgress(plan)) {
      stopReason = "no-durable-progress";
      loopStatus = "blocked";
      break;
    }
  }

  const completedAt = timestampForStep(createdAt, Math.max(steps.length, 1));
  const evidenceRefs = steps
    .map((step) => step.execution.evidenceRef)
    .filter((ref): ref is string => Boolean(ref));
  const loop: WorkspacePilotLoopRecord = {
    schemaVersion: WORKSPACE_PILOT_LOOP_SCHEMA_VERSION,
    loopId: workspacePilotLoopId(createdAt, status.root, source),
    createdAt,
    completedAt,
    workspacePath: status.root,
    localOnly: true,
    networkAccess: "none",
    dryRun: !input.executeLocal,
    source,
    maxSteps,
    status: loopStatus,
    stopReason,
    summary: {
      plannedSteps: steps.length,
      executedSteps: steps.filter((step) => step.execution.status === "executed").length,
      blockedSteps: steps.filter((step) => step.execution.status === "blocked").length,
      attachedEvidenceSteps: steps.filter((step) => step.execution.attached === true).length,
      evidenceRefs
    },
    steps,
    stopConditions: latestStopConditions,
    warnings
  };

  await assertWorkspacePilotLoopSchema(loop);
  return { loop, runNextWrites };
}

async function runSavedRunNextPilotLoop(input: {
  input: WorkspacePilotLoopInput;
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
  createdAt: string;
  maxSteps: number;
  source: WorkspacePilotLoopSource;
  warnings: string[];
}): Promise<WorkspacePilotLoopRunResult> {
  const stepNow = timestampForStep(input.createdAt, 0);
  const planRef = await resolveSavedRunNextPlanRef(input.status.root, input.input.planRef, stepNow);
  const resumed = await createWorkspaceRunNextPlanFromSavedHandoff({
    rootPath: input.status.root,
    planRef,
    executeLocal: input.input.executeLocal === true,
    now: stepNow,
    enginePlanOptions: {
      timeoutMs: input.input.timeoutMs,
      maximaCommand: input.input.maximaCommand,
      sageCommand: input.input.sageCommand,
      leanCommand: input.input.leanCommand,
      z3Command: input.input.z3Command,
      cvc5Command: input.input.cvc5Command,
      ...input.input.enginePlanOptions
    }
  });
  const recorded = await recordPilotLoopStep({
    rootPath: input.status.root,
    plan: resumed.plan,
    index: 0,
    writeRunNextPlan: Boolean(input.input.writeRunNextPlans)
  });
  const steps = [recorded.step];
  const runNextWrites = recorded.write ? [recorded.write] : [];
  const stopReason = savedRunNextPilotLoopStopReason(input.input, resumed.plan);
  const loopStatus = savedRunNextPilotLoopStatus(input.input, resumed.plan, stopReason);
  const completedAt = timestampForStep(input.createdAt, 1);
  const evidenceRefs = steps
    .map((step) => step.execution.evidenceRef)
    .filter((ref): ref is string => Boolean(ref));
  const loop: WorkspacePilotLoopRecord = {
    schemaVersion: WORKSPACE_PILOT_LOOP_SCHEMA_VERSION,
    loopId: workspacePilotLoopId(input.createdAt, input.status.root, input.source),
    createdAt: input.createdAt,
    completedAt,
    workspacePath: input.status.root,
    localOnly: true,
    networkAccess: "none",
    dryRun: input.input.executeLocal !== true,
    source: input.source,
    maxSteps: input.maxSteps,
    status: loopStatus,
    stopReason,
    summary: {
      plannedSteps: steps.length,
      executedSteps: steps.filter((step) => step.execution.status === "executed").length,
      blockedSteps: steps.filter((step) => step.execution.status === "blocked").length,
      attachedEvidenceSteps: steps.filter((step) => step.execution.attached === true).length,
      evidenceRefs
    },
    steps,
    stopConditions: resumed.plan.stopConditions,
    warnings: [
      ...input.warnings,
      `Pilot-loop source saved-run-next resumed ${resumed.sourcePlan.planId} from ${resumed.sourcePlanPath}.`,
      `Saved handoff resume decision: ${resumed.inspection.resumeDecision.status} (${resumed.inspection.resumeDecision.reason})`
    ]
  };

  await assertWorkspacePilotLoopSchema(loop);
  return { loop, runNextWrites };
}

async function resolveSavedRunNextPlanRef(rootPath: string, planRef: string | undefined, now: string): Promise<string> {
  if (planRef?.trim()) {
    return planRef.trim();
  }

  const plans = await listWorkspaceRunNextPlans(rootPath, { verifySnapshots: true, now });
  const selected = plans.find((plan) => plan.resumeDecision.safeToResume) ?? plans[0];
  if (!selected) {
    throw new Error(
      "No saved run-next handoff is available. Write one with `truth-harness workspace run-next . --write` before using source saved-run-next."
    );
  }

  return selected.planId;
}

function savedRunNextPilotLoopStopReason(input: WorkspacePilotLoopInput, plan: WorkspaceRunNextPlan): string {
  if (input.executeLocal !== true) {
    return "dry-run";
  }
  if (!plan.item) {
    return "no-open-item";
  }
  if (plan.status === "blocked" || plan.execution.status === "blocked") {
    return plan.execution.kind || "blocked";
  }
  if (!pilotLoopMadeDurableProgress(plan)) {
    return "no-durable-progress";
  }
  return "saved-run-next-handoff-consumed";
}

function savedRunNextPilotLoopStatus(
  input: WorkspacePilotLoopInput,
  plan: WorkspaceRunNextPlan,
  stopReason: string
): WorkspacePilotLoopStatus {
  if (input.executeLocal !== true) {
    return "stopped";
  }
  if (plan.status === "blocked" || plan.execution.status === "blocked" || stopReason === "no-durable-progress") {
    return "blocked";
  }
  return "completed";
}

function selectPilotLoopContinuationStep(loop: WorkspacePilotLoopRecord): WorkspacePilotLoopStep {
  const selected = [...loop.steps].reverse().find((step) => step.runNextPlanPath || step.planId);
  if (!selected) {
    throw new Error(`Workspace pilot-loop ${loop.loopId} has no run-next step to continue.`);
  }
  if (!selected.runNextPlanPath) {
    throw new Error(
      `Workspace pilot-loop ${loop.loopId} step ${selected.index} has no saved run-next packet. Re-run the pilot loop with --write before continuing from the transcript.`
    );
  }
  return selected;
}

function pilotLoopContinuationResumeCommand(
  rootPath: string,
  loop: WorkspacePilotLoopRecord,
  plan: WorkspaceRunNextPlan,
  wrotePlan: boolean
): string {
  if (wrotePlan) {
    return `truth-harness workspace show-run-next ${quoteCommandArg(plan.planId)} --workspace ${quoteCommandArg(rootPath)} --verify-snapshot`;
  }
  return `truth-harness workspace continue-pilot-loop ${quoteCommandArg(loop.loopId)} --workspace ${quoteCommandArg(rootPath)} --json`;
}

function pilotLoopContinuationWarnings(
  loop: WorkspacePilotLoopRecord,
  loopPath: string,
  resumed: WorkspaceRunNextSavedHandoffResult,
  plan: WorkspaceRunNextPlan
): string[] {
  return uniqueStrings([
    `Continuation came from pilot-loop transcript ${loop.loopId} at ${loopPath}.`,
    `Selected saved run-next handoff ${resumed.sourcePlan.planId} at ${resumed.sourcePlanPath}.`,
    `Saved handoff resume decision: ${resumed.inspection.resumeDecision.status} (${resumed.inspection.resumeDecision.reason}).`,
    "The pilot-loop transcript is provenance only; it does not upgrade trust or close gates by itself.",
    "Continuation still uses the bounded run-next executor and never executes shell strings.",
    ...plan.warnings
  ]);
}

export async function writeWorkspacePilotLoopRecord(input: {
  rootPath: string;
  loop: WorkspacePilotLoopRecord;
}): Promise<WorkspacePilotLoopWriteResult> {
  const status = await requirePilotLoopWorkspace(input.rootPath);
  const loop: WorkspacePilotLoopRecord = {
    ...input.loop,
    workspacePath: status.root
  };
  await assertWorkspacePilotLoopSchema(loop);
  const findingsDir = resolve(status.root, status.manifest.directories.findings);
  const baseName = `${loop.createdAt.slice(0, 10)}-${loop.loopId}-workspace-pilot-loop`;
  const jsonPath = join(findingsDir, `${baseName}.json`);
  const markdownPath = join(findingsDir, `${baseName}.md`);
  const markdown = renderWorkspacePilotLoopMarkdown(loop);

  await mkdir(findingsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, loop);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: toPortablePath(relative(status.root, jsonPath)),
    kind: "findings",
    now: loop.completedAt,
    staleReason: "workspace pilot-loop record written"
  });

  return {
    loop,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listWorkspacePilotLoopRecords(
  rootPath: string,
  options: WorkspacePilotLoopListOptions = {}
): Promise<WorkspacePilotLoopSummary[]> {
  const status = await requirePilotLoopWorkspace(rootPath);
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
          const loop = tryParseWorkspacePilotLoopJson(await readFile(path, "utf8"));
          if (!loop) {
            return undefined;
          }
          return {
            loop,
            portablePath: toPortablePath(relative(status.root, path))
          };
        })
    )
  )
    .filter((candidate): candidate is { loop: WorkspacePilotLoopRecord; portablePath: string } => candidate !== undefined)
    .sort((left, right) => right.loop.createdAt.localeCompare(left.loop.createdAt));

  const selectedCandidates = typeof options.limit === "number" ? candidates.slice(0, options.limit) : candidates;
  return selectedCandidates.map(({ loop, portablePath }) => summarizeWorkspacePilotLoopRecord(loop, portablePath));
}

export async function readWorkspacePilotLoopRecord(rootPath: string, loopRef: string): Promise<WorkspacePilotLoopRecord> {
  const status = await requirePilotLoopWorkspace(rootPath);
  return (await readWorkspacePilotLoopRecordWithPath(status, loopRef)).loop;
}

export async function inspectWorkspacePilotLoopRecord(
  rootPath: string,
  loopRef: string
): Promise<WorkspacePilotLoopInspection> {
  const status = await requirePilotLoopWorkspace(rootPath);
  const { loop, path } = await readWorkspacePilotLoopRecordWithPath(status, loopRef);
  return {
    schemaVersion: "truth-harness.workspace-pilot-loop-inspection.v0",
    loop,
    path,
    ...(markdownPathForJsonPath(path) ? { markdownPath: markdownPathForJsonPath(path) } : {})
  };
}

export async function continueWorkspacePilotLoopRecord(
  input: WorkspacePilotLoopContinuationInput
): Promise<WorkspacePilotLoopContinuationResult> {
  const status = await requirePilotLoopWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const { loop, path } = await readWorkspacePilotLoopRecordWithPath(status, input.loopRef);
  const loopMarkdownPath = markdownPathForJsonPath(path);
  const selectedStep = selectPilotLoopContinuationStep(loop);
  const selectedPlanRef = selectedStep.runNextPlanPath ?? selectedStep.planId;
  const resumed = await createWorkspaceRunNextPlanFromSavedHandoff({
    rootPath: status.root,
    planRef: selectedPlanRef,
    executeLocal: input.executeLocal === true,
    now: createdAt,
    expectedAddedPaths: loopMarkdownPath ? [path, loopMarkdownPath] : [path],
    enginePlanOptions: {
      timeoutMs: input.timeoutMs,
      maximaCommand: input.maximaCommand,
      sageCommand: input.sageCommand,
      leanCommand: input.leanCommand,
      z3Command: input.z3Command,
      cvc5Command: input.cvc5Command,
      ...input.enginePlanOptions
    }
  });
  const written = input.writeRunNextPlan
    ? await writeWorkspaceRunNextPlan({
        rootPath: status.root,
        plan: resumed.plan
      })
    : undefined;
  const plan = written?.plan ?? resumed.plan;

  return {
    schemaVersion: "truth-harness.workspace-pilot-loop-continuation.v0",
    loop,
    loopPath: path,
    ...(loopMarkdownPath ? { loopMarkdownPath } : {}),
    selectedStep,
    selectedPlanRef,
    sourcePlan: resumed.sourcePlan,
    sourcePlanPath: resumed.sourcePlanPath,
    sourceInspection: resumed.inspection,
    plan,
    ...(written ? { written } : {}),
    resumeCommand: pilotLoopContinuationResumeCommand(status.root, loop, plan, Boolean(input.writeRunNextPlan)),
    warnings: pilotLoopContinuationWarnings(loop, path, resumed, plan)
  };
}

export function parseWorkspacePilotLoopJson(raw: string): WorkspacePilotLoopRecord {
  const loop = JSON.parse(raw) as WorkspacePilotLoopRecord;
  if (loop.schemaVersion !== WORKSPACE_PILOT_LOOP_SCHEMA_VERSION) {
    throw new Error(`Unsupported workspace pilot-loop schema: ${JSON.stringify(loop.schemaVersion)}`);
  }
  if (!isWorkspacePilotLoopId(loop.loopId)) {
    throw new Error(`Invalid workspace pilot-loop id: ${JSON.stringify(loop.loopId)}`);
  }
  if (loop.localOnly !== true || loop.networkAccess !== "none") {
    throw new Error("Workspace pilot-loop records must be local-only with networkAccess none.");
  }

  return loop;
}

async function readWorkspacePilotLoopRecordWithPath(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  loopRef: string
): Promise<{ loop: WorkspacePilotLoopRecord; path: string }> {
  const ref = requireText(loopRef, "Workspace pilot-loop ref is required.");

  if (isWorkspacePilotLoopId(ref)) {
    const findingsDir = resolve(status.root, status.manifest.directories.findings);
    let files: string[];
    try {
      files = await readdir(findingsDir);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new Error(`Workspace pilot-loop record not found: ${ref}`);
      }

      throw error;
    }

    for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
      const path = join(findingsDir, file);
      const loop = tryParseWorkspacePilotLoopJson(await readFile(path, "utf8"));
      if (loop?.loopId === ref) {
        return {
          loop,
          path: toPortablePath(relative(status.root, path))
        };
      }
    }

    throw new Error(`Workspace pilot-loop record not found: ${ref}`);
  }

  const path = resolveUnderRoot(status.root, ref);
  return {
    loop: parseWorkspacePilotLoopJson(await readFile(path, "utf8")),
    path: toPortablePath(relative(status.root, path))
  };
}

export function renderWorkspacePilotLoopMarkdown(loop: WorkspacePilotLoopRecord): string {
  const lines = [
    "# Truth Harness Pilot Loop",
    "",
    `Loop: ${loop.loopId}`,
    `Status: ${loop.status}`,
    `Stop reason: ${loop.stopReason}`,
    `Workspace: ${loop.workspacePath}`,
    `Source: ${loop.source}`,
    `Mode: ${loop.dryRun ? "dry-run" : "bounded local execution"}`,
    "",
    "## Summary",
    "",
    `- Planned steps: ${loop.summary.plannedSteps}`,
    `- Executed steps: ${loop.summary.executedSteps}`,
    `- Blocked steps: ${loop.summary.blockedSteps}`,
    `- Attached evidence steps: ${loop.summary.attachedEvidenceSteps}`,
    `- Evidence refs: ${loop.summary.evidenceRefs.length > 0 ? loop.summary.evidenceRefs.join(", ") : "none"}`,
    "",
    "## Steps",
    ""
  ];

  for (const step of loop.steps) {
    lines.push(
      `### ${step.index}. ${step.item?.title ?? "No open item"}`,
      "",
      `- Plan: ${step.planId}${step.runNextPlanPath ? ` (${step.runNextPlanPath})` : ""}`,
      `- Review: ${step.reviewId}`,
      `- Item kind: ${step.item?.kind ?? "none"}`,
      `- Command: ${step.item?.command ?? step.execution.command ?? "none"}`,
      `- Execution: ${step.execution.status} / ${step.execution.kind}`,
      `- Summary: ${step.execution.summary}`,
      step.execution.evidenceRef ? `- Evidence: ${step.execution.evidenceRef}` : "- Evidence: none",
      step.enginePlan
        ? `- Engine plan: ${step.enginePlan.status}, ${step.enginePlan.classifications.join(", ")}`
        : "- Engine plan: none",
      step.stopReason ? `- Step stop: ${step.stopReason}` : "- Step stop: none",
      ""
    );
  }

  lines.push(
    "## Stop Conditions",
    "",
    ...(loop.stopConditions.length > 0 ? loop.stopConditions.map((condition) => `- ${condition}`) : ["- None recorded."]),
    "",
    "## Warnings",
    "",
    ...loop.warnings.map((warning) => `- ${warning}`),
    "",
    "## Trust Boundary",
    "",
    "- This loop records verifier-directed work, not truth by itself.",
    "- It never executes arbitrary shell strings.",
    "- A result is trusted only when its receipt, proof, CAS, SMT, source, or validation artifact satisfies the matching gate.",
    ""
  );

  return lines.join("\n");
}

async function createPilotLoopReview(
  input: WorkspacePilotLoopInput & { source: WorkspacePilotLoopSource }
): Promise<WorkspaceReview> {
  if (input.source === "workspace-review") {
    return createWorkspaceReview({
      rootPath: input.rootPath,
      maxRoutes: input.maxRoutes,
      maxClaims: input.maxClaims,
      maxSessions: input.maxSessions,
      maxReports: input.maxReports
    });
  }

  const pack = await createCredibilityPack({
    rootPath: input.rootPath,
    maxRoutes: input.maxRoutes,
    maxClaims: input.maxClaims,
    maxSessions: input.maxSessions,
    maxReports: input.maxReports,
    timeoutMs: input.timeoutMs,
    maximaCommand: input.maximaCommand,
    sageCommand: input.sageCommand,
    leanCommand: input.leanCommand,
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command,
    smtSourcePath: input.smtSourcePath,
    leanSourcePath: input.leanSourcePath,
    engineRequirements: input.engineRequirements
  });
  return createWorkspaceReviewFromCredibilityPack({ rootPath: input.rootPath, pack });
}

async function recordPilotLoopStep(input: {
  rootPath: string;
  plan: WorkspaceRunNextPlan;
  index: number;
  writeRunNextPlan: boolean;
}): Promise<{ step: WorkspacePilotLoopStep; write?: WorkspaceRunNextWriteResult }> {
  const write = input.writeRunNextPlan
    ? await writeWorkspaceRunNextPlan({
        rootPath: input.rootPath,
        plan: input.plan
      })
    : undefined;
  const plan = write?.plan ?? input.plan;
  const step: WorkspacePilotLoopStep = {
    index: input.index + 1,
    createdAt: plan.createdAt,
    reviewId: plan.reviewId,
    planId: plan.planId,
    ...(write
      ? {
          runNextPlanPath: toPortablePath(relative(resolve(input.rootPath), resolve(write.jsonPath))),
          runNextMarkdownPath: toPortablePath(relative(resolve(input.rootPath), resolve(write.markdownPath)))
        }
      : {}),
    ...(plan.item ? { item: plan.item } : {}),
    ...(plan.enginePlan
      ? {
          enginePlan: {
            status: plan.enginePlan.status,
            classifications: plan.enginePlan.classifications,
            targetTrustCeiling: plan.enginePlan.targetTrustCeiling,
            recommendedFirstCommand: plan.enginePlan.recommendedFirstCommand,
            readyCapabilityIds: plan.enginePlan.readyCapabilityIds,
            blockedCapabilityIds: plan.enginePlan.blockedCapabilityIds
          }
        }
      : {}),
    execution: plan.execution,
    status: plan.status,
    stopReason: pilotLoopStepStopReason(plan)
  };
  return { step, write };
}

function pilotLoopMadeDurableProgress(plan: WorkspaceRunNextPlan): boolean {
  return Boolean(plan.execution.evidenceRef || plan.execution.attached);
}

function pilotLoopHasDurableProgress(steps: WorkspacePilotLoopStep[]): boolean {
  return steps.some((step) => Boolean(step.execution.evidenceRef || step.execution.attached));
}

function pilotLoopStepStopReason(plan: WorkspaceRunNextPlan): string | undefined {
  if (!plan.item) {
    return "no-open-item";
  }
  if (plan.execution.status === "blocked") {
    return plan.execution.kind;
  }
  if (!plan.dryRun && plan.execution.status === "executed" && !pilotLoopMadeDurableProgress(plan)) {
    return "no-durable-progress";
  }
  return undefined;
}

function pilotLoopTargetKey(plan: WorkspaceRunNextPlan): string {
  return [
    plan.item?.itemId ?? "no-item",
    plan.item?.command ?? plan.execution.command ?? "no-command",
    plan.item?.validationPlanId ?? "",
    plan.item?.validationGateId ?? "",
    plan.item?.routeId ?? "",
    plan.item?.obligationId ?? ""
  ].join("|");
}

function timestampForStep(createdAt: string, index: number): string {
  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) {
    return createdAt;
  }
  return new Date(base.getTime() + index * 1000).toISOString();
}

function normalizeMaxSteps(maxSteps: number | undefined): number {
  const value = Math.trunc(maxSteps ?? DEFAULT_MAX_STEPS);
  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_MAX_STEPS;
  }
  return Math.min(value, MAX_ALLOWED_STEPS);
}

async function assertWorkspacePilotLoopSchema(loop: WorkspacePilotLoopRecord): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: loop,
    schemaFile: "workspace-pilot-loop.schema.json",
    artifactName: "Workspace pilot-loop record"
  });
}

async function requirePilotLoopWorkspace(rootPath: string): Promise<
  LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }
> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before running a pilot loop.");
  }

  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}`);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function workspacePilotLoopId(createdAt: string, rootPath: string, source: WorkspacePilotLoopSource): string {
  const seed = `${createdAt}:${rootPath}:${source}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `wpl_${hash.toString(16).padStart(8, "0")}`;
}

function summarizeWorkspacePilotLoopRecord(loop: WorkspacePilotLoopRecord, path: string): WorkspacePilotLoopSummary {
  const firstStep = loop.steps[0];
  const lastStep = loop.steps.at(-1);
  const runNextSteps = loop.steps.filter((step) => step.runNextPlanPath);
  const firstRunNextStep = runNextSteps[0];
  const lastRunNextStep = runNextSteps.at(-1);

  return {
    schemaVersion: loop.schemaVersion,
    loopId: loop.loopId,
    createdAt: loop.createdAt,
    completedAt: loop.completedAt,
    path,
    ...(markdownPathForJsonPath(path) ? { markdownPath: markdownPathForJsonPath(path) } : {}),
    localOnly: loop.localOnly,
    networkAccess: loop.networkAccess,
    dryRun: loop.dryRun,
    source: loop.source,
    maxSteps: loop.maxSteps,
    status: loop.status,
    stopReason: loop.stopReason,
    plannedSteps: loop.summary.plannedSteps,
    executedSteps: loop.summary.executedSteps,
    blockedSteps: loop.summary.blockedSteps,
    attachedEvidenceSteps: loop.summary.attachedEvidenceSteps,
    evidenceRefs: loop.summary.evidenceRefs,
    firstItemTitle: firstStep?.item?.title,
    firstCommand: firstStep?.item?.command ?? firstStep?.execution.command,
    lastItemTitle: lastStep?.item?.title,
    lastExecutionKind: lastStep?.execution.kind,
    enginePlanStatuses: uniqueStrings(loop.steps.flatMap((step) => (step.enginePlan ? [step.enginePlan.status] : []))),
    runNextPlanCount: runNextSteps.length,
    ...(firstRunNextStep?.runNextPlanPath ? { firstRunNextPlanPath: firstRunNextStep.runNextPlanPath } : {}),
    ...(lastRunNextStep?.runNextPlanPath ? { lastRunNextPlanPath: lastRunNextStep.runNextPlanPath } : {}),
    ...(lastRunNextStep?.runNextMarkdownPath ? { lastRunNextMarkdownPath: lastRunNextStep.runNextMarkdownPath } : {})
  };
}

function tryParseWorkspacePilotLoopJson(raw: string): WorkspacePilotLoopRecord | undefined {
  try {
    return parseWorkspacePilotLoopJson(raw);
  } catch {
    return undefined;
  }
}

function markdownPathForJsonPath(path: string): string | undefined {
  return path.endsWith(".json") ? `${path.slice(0, -5)}.md` : undefined;
}

function resolveUnderRoot(rootPath: string, path: string): string {
  const root = resolve(rootPath);
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Workspace pilot-loop path escapes workspace root: ${JSON.stringify(path)}`);
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

function isWorkspacePilotLoopId(value: string): boolean {
  return /^wpl_[a-f0-9]{8}$/u.test(value);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function quoteCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:@=+-]+$/u.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function toPortablePath(value: string): string {
  return value.replace(/\\/gu, "/");
}

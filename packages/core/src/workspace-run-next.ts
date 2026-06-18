import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import {
  writeBenchmarkRunRecord,
  type BenchmarkRunLike,
  type BenchmarkRunTaskLike,
  type BenchmarkRunTaskResultLike
} from "./benchmark-run.js";
import { createClaimReviewPacket } from "./claim-ledger.js";
import type { CredibilityPack } from "./credibility-pack.js";
import { writeSymbolicCasCheckRecord } from "./cas-backend.js";
import { writeEngineVerificationRun, type EngineVerificationRequirements } from "./engine-verification.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { writeLeanProofCheckRecord } from "./proof-backend.js";
import { readReportDraft } from "./report-draft.js";
import { createReceipt } from "./receipt.js";
import { addResearchSessionCheckpoint, readResearchSession } from "./research-session.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { writeSmtCheckRecord, type SmtBackendId } from "./smt-backend.js";
import type { SympyOperation } from "./sympy.js";
import type { Receipt, TrustLabel } from "./types.js";
import { attachValidationGateEvidence, type AttachValidationGateEvidenceResult } from "./validation-plan.js";
import {
  readVerifierRoute,
  satisfyVerifierRouteObligation,
  writeVerifierRoute,
  type SatisfyVerifierRouteObligationResult,
  type VerifierRouteEvidenceRef
} from "./verifier-route.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";
import type { WorkspaceReview, WorkspaceReviewItem } from "./workspace-review.js";

export type WorkspaceRunNextStatus = "planned" | "executed" | "blocked";
const WORKSPACE_RUN_NEXT_SCHEMA_VERSION = "truth-harness.workspace-run-next.v0" as const;

export interface WorkspaceRunNextWriteResult {
  plan: WorkspaceRunNextPlan;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
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
  const nextItem = input.review.items.find((item) => item.itemId === input.review.autonomy.nextItemId) ?? input.review.items[0];
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
        : "No open workspace review item is available."
    },
    stopConditions: input.review.autonomy.stopConditions,
    warnings: [
      "Run-next never executes shell strings. Only supported local Truth Harness actions can run.",
      "Execution can create evidence artifacts, but trust labels change only when matching obligations accept those artifacts."
    ]
  };

  if (!nextItem) {
    return {
      ...basePlan,
      status: "blocked",
      execution: {
        status: "blocked",
        kind: "no-open-item",
        summary: "No open local work item is available."
      }
    };
  }

  if (!input.executeLocal) {
    return basePlan;
  }

  if (!input.review.autonomy.canRunUnattended) {
    return {
      ...basePlan,
      status: "blocked",
      execution: {
        status: "blocked",
        kind: "autonomy-contract",
        command: nextItem.command,
        summary: "The autonomy contract does not allow unattended local work."
      }
    };
  }

  const execution = await executeWorkspaceRunNextItem(input.rootPath, nextItem);
  return {
    ...basePlan,
    status: execution.status,
    execution
  };
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
  const plan: WorkspaceRunNextPlan = {
    ...input.plan,
    workspacePath: status.root
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

export async function listWorkspaceRunNextPlans(rootPath: string): Promise<WorkspaceRunNextSummary[]> {
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
        return plan ? summarizeWorkspaceRunNextPlan(plan, toPortablePath(relative(status.root, path))) : undefined;
      })
  );

  return summaries
    .filter((summary): summary is WorkspaceRunNextSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function readWorkspaceRunNextPlan(rootPath: string, planRef: string): Promise<WorkspaceRunNextPlan> {
  const status = await requireRunNextWorkspace(rootPath);
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
        return plan;
      }
    }

    throw new Error(`Workspace run-next plan not found: ${ref}`);
  }

  return parseWorkspaceRunNextJson(await readFile(resolveUnderRoot(status.root, ref), "utf8"));
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
    `| Local only | \`${String(plan.localOnly)}\` |`,
    `| Network | \`${plan.networkAccess}\` |`,
    `| Dry run | \`${String(plan.dryRun)}\` |`,
    `| Status | \`${plan.status}\` |`,
    `| Mode | \`${plan.mode}\` |`,
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

function tryParseWorkspaceRunNextJson(raw: string): WorkspaceRunNextPlan | undefined {
  try {
    return parseWorkspaceRunNextJson(raw);
  } catch {
    return undefined;
  }
}

function summarizeWorkspaceRunNextPlan(plan: WorkspaceRunNextPlan, path: string): WorkspaceRunNextSummary {
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
    executionStatus: plan.execution.status
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
      const attachment = await maybeAttachRouteEvidence(workspace, item, {
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
      const result = await writeSmtCheckRecord({
        rootPath: workspace,
        sourcePath,
        queryName: typeof options.query === "string" ? options.query : undefined,
        backend: parseSmtBackendOption(options.backend),
        z3Command: typeof options["z3-command"] === "string" ? options["z3-command"] : undefined,
        cvc5Command: typeof options["cvc5-command"] === "string" ? options["cvc5-command"] : undefined,
        timeoutMs
      });
      const evidenceRef = workspaceLocalRef(workspace, result.jsonPath);
      const attachment = await maybeAttachRouteEvidence(workspace, item, {
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
      const attachment = await maybeAttachRouteEvidence(workspace, item, {
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

function blockedPlaceholderCommand(command: string, kind: string): WorkspaceRunNextPlan["execution"] {
  return {
    status: "blocked",
    kind,
    command,
    summary: "The next command contains a placeholder path. Prepare a concrete workspace-local artifact before executing it."
  };
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
  let escaping = false;

  for (const character of command) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (quote) {
      if (character === "\\") {
        escaping = true;
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

  if (escaping) {
    throw new Error("Command ended with an incomplete escape.");
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
    value === "unverified" ||
    value === "exact-computed" ||
    value === "cross-checked" ||
    value === "proved" ||
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
    cvc5: Boolean(options["require-cvc5"] || options["require-all-engines"]),
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

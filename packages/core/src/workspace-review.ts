import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { listClaimRecords, type ClaimLedgerRecord } from "./claim-ledger.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { listReportDrafts, type ReportDraftSummary } from "./report-draft.js";
import {
  listVerifierRoutes,
  readVerifierRoute,
  verifierRouteReadiness,
  type ProofObligation,
  type VerifierRoute
} from "./verifier-route.js";
import {
  listResearchSessions,
  type ResearchSession,
  type ResearchSessionCheckpoint,
  type ResearchSessionTask
} from "./research-session.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";
import { listValidationPlans, type ValidationGate, type ValidationPlan } from "./validation-plan.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export type WorkspaceReviewItemKind =
  | "validation-gate"
  | "route-obligation"
  | "route-ready-claim"
  | "claim-blocker"
  | "report-draft-review"
  | "session-task"
  | "session-next-check"
  | "credibility-action";
export type WorkspaceReviewPriority = "critical" | "high" | "medium" | "low";
export type WorkspaceReviewEvidenceSlotStatus = "open" | "satisfied" | "not-required";
export type WorkspaceReviewAutonomyMode = "idle" | "local-verifier-loop" | "human-review-gated";

export interface WorkspaceReviewEvidenceSlot {
  slotId: string;
  label: string;
  required: boolean;
  status: WorkspaceReviewEvidenceSlotStatus;
  description: string;
  acceptedArtifacts: string[];
  suggestedCommand?: string;
  attachTo?: {
    routeId?: string;
    obligationId?: string;
    claimId?: string;
    sessionId?: string;
    validationPlanId?: string;
    validationGateId?: string;
  };
}

export interface WorkspaceReviewItem {
  itemId: string;
  kind: WorkspaceReviewItemKind;
  priority: WorkspaceReviewPriority;
  title: string;
  summary: string;
  command: string;
  routeId?: string;
  obligationId?: string;
  obligationKind?: ProofObligation["kind"];
  claimId?: string;
  sessionId?: string;
  validationPlanId?: string;
  validationGateId?: string;
  validationGateKind?: string;
  taskId?: string;
  checkpointId?: string;
  reportId?: string;
  domain?: string;
  trust?: TrustLabel;
  createdAt?: string;
  evidenceSlots?: WorkspaceReviewEvidenceSlot[];
  acceptanceCriteria?: string[];
  agentPacket?: string;
  source: {
    label: string;
    ref: string;
  };
}

export interface WorkspaceReviewAutonomyContract {
  mode: WorkspaceReviewAutonomyMode;
  canRunUnattended: boolean;
  suggestedBatchSize: number;
  nextItemId?: string;
  nextCommand?: string;
  allowedActions: string[];
  blockedActions: string[];
  stopConditions: string[];
  requiredArtifacts: string[];
  humanReviewRequiredFor: string[];
  agentPacket: string;
}

export interface WorkspaceReview {
  schemaVersion: "truth-harness.workspace-review.v0";
  reviewId: string;
  projectId: string;
  createdAt: string;
  workspacePath: string;
  localOnly: true;
  networkAccess: "none";
  privacy: PrivacyMetadata;
  summary: {
    routes: number;
    claims: number;
    sessions: number;
    reportDrafts: number;
    totalItems: number;
    routeObligations: number;
    readyRoutesWithoutClaims: number;
    blockedClaims: number;
    reportDraftReviewItems: number;
    reportDraftsNeedingAttention: number;
    sessionTasks: number;
    sessionNextChecks: number;
    criticalItems: number;
    highItems: number;
    mediumItems: number;
    lowItems: number;
  };
  autonomy: WorkspaceReviewAutonomyContract;
  items: WorkspaceReviewItem[];
  warnings: string[];
  markdown: string;
}

export interface CreateWorkspaceReviewInput {
  rootPath: string;
  maxRoutes?: number;
  maxClaims?: number;
  maxSessions?: number;
  maxReports?: number;
  now?: string;
}

export interface WorkspaceReviewWriteResult {
  review: WorkspaceReview;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface WorkspaceReviewSummary {
  schemaVersion: "truth-harness.workspace-review.v0";
  reviewId: string;
  projectId: string;
  createdAt: string;
  path: string;
  localOnly: true;
  networkAccess: "none";
  totalItems: number;
  criticalItems: number;
  highItems: number;
  mediumItems: number;
  lowItems: number;
  privacy: PrivacyMetadata;
  warnings: string[];
}

const WORKSPACE_REVIEW_SCHEMA_VERSION = "truth-harness.workspace-review.v0" as const;

export async function createWorkspaceReview(input: CreateWorkspaceReviewInput): Promise<WorkspaceReview> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const routeSummaries = (await listVerifierRoutes(status.root)).slice(0, input.maxRoutes ?? 100);
  const claims = (await listClaimRecords(status.root)).slice(0, input.maxClaims ?? 200);
  const sessions = (await listResearchSessions(status.root)).slice(0, input.maxSessions ?? 100);
  const reportDrafts = await listReportDrafts({ rootPath: status.root, limit: input.maxReports ?? 50 });
  const validationPlans = await listValidationPlans(status.root);
  const claimsByRouteRef = claimsByRouteEvidence(claims);
  const routes = await Promise.all(routeSummaries.map((route) => readVerifierRoute(status.root, route.routeId)));
  const items = attachAgentPackets(sortReviewItems([
    ...sessions.flatMap((session) => linkedValidationGateItems(status.root, session, validationPlans)),
    ...routes.flatMap((route) => routeReviewItems(status.root, route, claimsByRouteRef)),
    ...claims.flatMap((claim) => claimReviewItems(status.root, claim)),
    ...reportDrafts.map((report) => reportDraftReviewItem(status.root, report)),
    ...sessions.flatMap((session) => sessionReviewItems(status.root, session))
  ]));
  const autonomy = createAutonomyContract(items);
  const reviewWithoutMarkdown = {
    schemaVersion: WORKSPACE_REVIEW_SCHEMA_VERSION,
    projectId: status.manifest.projectId,
    createdAt,
    workspacePath: status.root,
    localOnly: true as const,
    networkAccess: "none" as const,
    privacy: status.manifest.privacy,
    summary: summarizeItems({
      routes: routeSummaries.length,
      claims: claims.length,
      sessions: sessions.length,
      reportDrafts: reportDrafts.length,
      items
    }),
    autonomy,
    items,
    warnings: [
      "Workspace review is a local planning queue. It does not upgrade trust or prove claims by itself.",
      "Follow item commands only inside the local workspace boundary and keep final claims scoped to attached evidence."
    ]
  };
  const reviewId = `wrev_${stableHash(reviewWithoutMarkdown).slice(0, 16)}`;
  const reviewWithoutMarkdownAndWithId = {
    ...reviewWithoutMarkdown,
    reviewId
  };

  return {
    ...reviewWithoutMarkdownAndWithId,
    markdown: renderWorkspaceReviewMarkdown(reviewWithoutMarkdownAndWithId)
  };
}

export async function writeWorkspaceReview(input: CreateWorkspaceReviewInput): Promise<WorkspaceReviewWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const review = await createWorkspaceReview({
    ...input,
    rootPath: status.root
  });
  await assertWorkspaceReviewSchema(review);
  const findingsDir = resolve(status.root, status.manifest.directories.findings);
  const baseName = `${review.createdAt.slice(0, 10)}-${review.reviewId}-workspace-review`;
  const jsonPath = join(findingsDir, `${baseName}.json`);
  const markdownPath = join(findingsDir, `${baseName}.md`);
  await mkdir(findingsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, review);
  await writeFileAtomic(markdownPath, review.markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "findings",
    now: review.createdAt,
    staleReason: "workspace review written"
  });

  return {
    review,
    jsonPath,
    markdownPath,
    markdown: review.markdown
  };
}

async function assertWorkspaceReviewSchema(review: WorkspaceReview): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: review,
    schemaFile: "workspace-review.schema.json",
    artifactName: "Workspace review"
  });
}

export async function listWorkspaceReviews(rootPath: string): Promise<WorkspaceReviewSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
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
        const review = tryParseWorkspaceReviewJson(await readFile(path, "utf8"));
        return review ? summarizeWorkspaceReview(review, toPortablePath(relative(status.root, path))) : undefined;
      })
  );

  return summaries
    .filter((summary): summary is WorkspaceReviewSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function readWorkspaceReview(rootPath: string, reviewRef: string): Promise<WorkspaceReview> {
  const status = await requireLocalWorkspace(rootPath);
  const ref = requireText(reviewRef, "Workspace review ref is required.");

  if (isWorkspaceReviewId(ref)) {
    const findingsDir = resolve(status.root, status.manifest.directories.findings);
    let files: string[];
    try {
      files = await readdir(findingsDir);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new Error(`Workspace review not found: ${ref}`);
      }

      throw error;
    }

    for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
      const path = join(findingsDir, file);
      const review = tryParseWorkspaceReviewJson(await readFile(path, "utf8"));
      if (review?.reviewId === ref) {
        return review;
      }
    }

    throw new Error(`Workspace review not found: ${ref}`);
  }

  return parseWorkspaceReviewJson(await readFile(resolveUnderRoot(status.root, ref), "utf8"));
}

export function parseWorkspaceReviewJson(raw: string): WorkspaceReview {
  const review = JSON.parse(raw) as WorkspaceReview;
  if (review.schemaVersion !== WORKSPACE_REVIEW_SCHEMA_VERSION) {
    throw new Error(`Unsupported workspace review schema: ${JSON.stringify(review.schemaVersion)}`);
  }
  if (!isWorkspaceReviewId(review.reviewId)) {
    throw new Error(`Invalid workspace review id: ${JSON.stringify(review.reviewId)}`);
  }

  return review;
}

export function renderWorkspaceReviewMarkdown(review: Omit<WorkspaceReview, "markdown">): string {
  const lines = [
    "# Truth Harness Workspace Review",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Review | \`${review.reviewId}\` |`,
    `| Project | \`${review.projectId}\` |`,
    `| Created | ${escapeMarkdownTable(review.createdAt)} |`,
    `| Local only | \`${String(review.localOnly)}\` |`,
    `| Network | \`${review.networkAccess}\` |`,
    `| Routes | \`${review.summary.routes}\` |`,
    `| Claims | \`${review.summary.claims}\` |`,
    `| Sessions | \`${review.summary.sessions ?? 0}\` |`,
    `| Report drafts | \`${review.summary.reportDrafts ?? 0}\` |`,
    `| Queue items | \`${review.summary.totalItems}\` |`,
    `| Autonomy mode | \`${review.autonomy.mode}\` |`,
    `| Unattended local work | \`${String(review.autonomy.canRunUnattended)}\` |`,
    "",
    "## Autonomy Contract",
    "",
    `- Mode: \`${review.autonomy.mode}\``,
    `- Can run unattended: \`${String(review.autonomy.canRunUnattended)}\``,
    `- Suggested batch size: \`${review.autonomy.suggestedBatchSize}\``,
    `- Next item: \`${review.autonomy.nextItemId ?? "n/a"}\``,
    `- Next command: \`${escapeMarkdownText(review.autonomy.nextCommand ?? "No open local work item.")}\``,
    "",
    "Allowed actions:",
    ...review.autonomy.allowedActions.map((action) => `- ${escapeMarkdownText(action)}`),
    "",
    "Blocked actions:",
    ...review.autonomy.blockedActions.map((action) => `- ${escapeMarkdownText(action)}`),
    "",
    "Stop conditions:",
    ...review.autonomy.stopConditions.map((condition) => `- ${escapeMarkdownText(condition)}`),
    "",
    "## Ordered Work Queue",
    ""
  ];

  if (review.items.length === 0) {
    lines.push("- No open workspace review items were found.");
  } else {
    for (const item of review.items) {
      lines.push(`- \`${item.priority}\` ${escapeMarkdownText(item.title)} (${item.itemId})`);
      lines.push(`  - ${escapeMarkdownText(item.summary)}`);
      lines.push(`  - Source: ${escapeMarkdownText(item.source.label)} \`${escapeMarkdownText(item.source.ref)}\``);
      lines.push(`  - Command: \`${escapeMarkdownText(item.command)}\``);
      const criteria = item.acceptanceCriteria ?? [];
      if (criteria.length > 0) {
        lines.push("  - Acceptance:");
        for (const criterion of criteria) {
          lines.push(`    - ${escapeMarkdownText(criterion)}`);
        }
      }
    }
  }

  lines.push("", "## Boundary", "");
  for (const warning of review.warnings) {
    lines.push(`- ${escapeMarkdownText(warning)}`);
  }

  return `${lines.join("\n")}\n`;
}

function tryParseWorkspaceReviewJson(raw: string): WorkspaceReview | undefined {
  try {
    return parseWorkspaceReviewJson(raw);
  } catch {
    return undefined;
  }
}

function summarizeWorkspaceReview(review: WorkspaceReview, path: string): WorkspaceReviewSummary {
  return {
    schemaVersion: review.schemaVersion,
    reviewId: review.reviewId,
    projectId: review.projectId,
    createdAt: review.createdAt,
    path,
    localOnly: review.localOnly,
    networkAccess: review.networkAccess,
    totalItems: review.summary.totalItems,
    criticalItems: review.summary.criticalItems,
    highItems: review.summary.highItems,
    mediumItems: review.summary.mediumItems,
    lowItems: review.summary.lowItems,
    privacy: review.privacy,
    warnings: review.warnings
  };
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before reviewing workspace work.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Workspace review path escapes workspace root: ${JSON.stringify(path)}`);
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

function isWorkspaceReviewId(value: string): boolean {
  return /^wrev_[a-f0-9]{16}$/u.test(value);
}

function toPortablePath(value: string): string {
  return value.split(sep).join("/");
}

function linkedValidationGateItems(
  workspacePath: string,
  session: ResearchSession,
  validationPlans: ValidationPlan[]
): WorkspaceReviewItem[] {
  const plans = linkedValidationPlansForSession(session, validationPlans);
  return plans.flatMap((plan) =>
    openValidationGates(plan).map((gate) => validationGateItem(workspacePath, session, plan, gate))
  );
}

function linkedValidationPlansForSession(session: ResearchSession, validationPlans: ValidationPlan[]): ValidationPlan[] {
  const linkedPlanRefs = new Set<string>();
  for (const ref of session.evidenceRefs) {
    if (ref.kind === "validation") {
      linkedPlanRefs.add(ref.ref);
    }
  }
  for (const checkpoint of session.checkpoints) {
    for (const ref of checkpoint.evidenceRefs) {
      if (ref.kind === "validation") {
        linkedPlanRefs.add(ref.ref);
      }
    }
  }

  return validationPlans.filter((plan) => {
    if (linkedPlanRefs.has(plan.planId)) {
      return true;
    }

    return plan.evidenceRefs.some((ref) => ref.kind === "session" && ref.ref === session.sessionId);
  });
}

function openValidationGates(plan: ValidationPlan): ValidationGate[] {
  return plan.gates.filter((gate) => gate.status !== "satisfied" && gate.status !== "not-applicable");
}

function validationGateItem(
  workspacePath: string,
  session: ResearchSession,
  plan: ValidationPlan,
  gate: ValidationGate
): WorkspaceReviewItem {
  return {
    itemId: itemIdFor({
      kind: "validation-gate",
      sessionId: session.sessionId,
      planId: plan.planId,
      gateId: gate.gateId,
      status: gate.status
    }),
    kind: "validation-gate",
    priority: priorityForValidationGate(gate),
    title: `Validation gate: ${gate.kind}`,
    summary: `${plan.title} - ${gate.description} Current status: ${gate.status}.`,
    command: commandForValidationGate(workspacePath, session, plan, gate),
    sessionId: session.sessionId,
    validationPlanId: plan.planId,
    validationGateId: gate.gateId,
    validationGateKind: gate.kind,
    domain: plan.domains[0],
    createdAt: plan.updatedAt,
    source: {
      label: "linked validation plan",
      ref: `${session.sessionId}:${plan.planId}:${gate.gateId}`
    }
  };
}

function commandForValidationGate(
  workspacePath: string,
  session: ResearchSession,
  plan: ValidationPlan,
  gate: ValidationGate
): string {
  if (gate.kind === "proof") {
    return `truth-harness verify ${quoteCommandArg(plan.claim)} --write --workspace ${quoteCommandArg(workspacePath)} --json`;
  }

  if (gate.kind === "source-citation" || gate.kind === "prior-art") {
    return `truth-harness source search ${quoteCommandArg(plan.claim)} --workspace ${quoteCommandArg(workspacePath)} --json`;
  }

  if (gate.kind === "benchmark") {
    return `truth-harness bench run packages/benchmarks/suites/foundations-seed.json --write --workspace ${quoteCommandArg(workspacePath)} --json`;
  }

  return `truth-harness research show ${quoteCommandArg(session.sessionId)} --workspace ${quoteCommandArg(workspacePath)} --json`;
}

function routeReviewItems(
  workspacePath: string,
  route: VerifierRoute,
  claimsByRouteRef: Map<string, ClaimLedgerRecord[]>
): WorkspaceReviewItem[] {
  const readiness = verifierRouteReadiness(route);
  const openObligations = (route.proofObligations ?? []).filter((obligation) => obligation.status === "open");
  const items = openObligations.map((obligation) => routeObligationItem(workspacePath, route, obligation));
  const hasClaim = (claimsByRouteRef.get(route.routeId)?.length ?? 0) > 0;

  if (readiness.readyForNarrowClaim && !hasClaim) {
    items.push({
      itemId: itemIdFor({
        kind: "route-ready-claim",
        routeId: route.routeId
      }),
      kind: "route-ready-claim",
      priority: "low",
      title: "Record a narrow claim from a ready route",
      summary: `Verifier route ${route.routeId} is ready only as a narrow ${readiness.strongestTrust} claim, but no claim ledger record cites it yet.`,
      command: `truth-harness claim add ${quoteCommandArg(route.problem)} --workspace ${quoteCommandArg(workspacePath)} --evidence ${quoteCommandArg(`route:${route.routeId}`)} --trust ${quoteCommandArg(readiness.strongestTrust)} --json`,
      routeId: route.routeId,
      trust: readiness.strongestTrust,
      createdAt: route.createdAt,
      source: {
        label: "verifier route",
        ref: route.routeId
      }
    });
  }

  return items;
}

function routeObligationItem(workspacePath: string, route: VerifierRoute, obligation: ProofObligation): WorkspaceReviewItem {
  const command = commandForRouteObligation(workspacePath, route, obligation);
  return {
    itemId: itemIdFor({
      kind: "route-obligation",
      routeId: route.routeId,
      obligationId: obligation.obligationId
    }),
    kind: "route-obligation",
    priority: priorityForRouteObligation(route, obligation),
    title: obligation.title,
    summary: `${route.problem} - ${obligation.requiredBefore}`,
    command,
    routeId: route.routeId,
    obligationId: obligation.obligationId,
    obligationKind: obligation.kind,
    trust: route.finalTrust,
    createdAt: route.createdAt,
    source: {
      label: "route obligation",
      ref: `${route.routeId}:${obligation.obligationId}`
    }
  };
}

function commandForRouteObligation(workspacePath: string, route: VerifierRoute, obligation: ProofObligation): string {
  const scopedCommand = scopedProofCommand(obligation.command, route.routeId, obligation.obligationId);
  if (scopedCommand) {
    return scopedCommand;
  }

  return obligation.command ?? `truth-harness route show ${quoteCommandArg(route.routeId)} --workspace ${quoteCommandArg(workspacePath)} --json`;
}

function scopedProofCommand(command: string | undefined, routeId: string, obligationId: string): string | undefined {
  if (!command?.startsWith("truth-harness proof check ")) {
    return command;
  }

  let scoped = command;
  if (!hasCliFlag(scoped, "--route")) {
    scoped += ` --route ${quoteCommandArg(routeId)}`;
  }
  if (!hasCliFlag(scoped, "--obligation")) {
    scoped += ` --obligation ${quoteCommandArg(obligationId)}`;
  }

  return scoped;
}

function hasCliFlag(command: string, flag: string): boolean {
  return new RegExp(`(?:^|\\s)${escapeRegExp(flag)}(?:\\s|=|$)`, "u").test(command);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function claimReviewItems(workspacePath: string, claim: ClaimLedgerRecord): WorkspaceReviewItem[] {
  if (claim.finalization.readyForNarrowClaim || claim.status !== "active") {
    return [];
  }

  const openChecks = claim.finalization.openChecks ?? [];
  return [
    {
      itemId: itemIdFor({
        kind: "claim-blocker",
        claimId: claim.claimId,
        updatedAt: claim.updatedAt
      }),
      kind: "claim-blocker",
      priority: priorityForClaim(claim),
      title: `Review blocked claim: ${claim.title}`,
      summary: openChecks[0] ?? claim.finalization.summary,
      command: `truth-harness claim review ${quoteCommandArg(claim.claimId)} --workspace ${quoteCommandArg(workspacePath)} --json`,
      claimId: claim.claimId,
      domain: claim.domain,
      trust: claim.trust,
      createdAt: claim.updatedAt,
      source: {
        label: "claim ledger",
        ref: claim.claimId
      }
    }
  ];
}

function sessionReviewItems(workspacePath: string, session: ResearchSession): WorkspaceReviewItem[] {
  const command = researchSessionCommand(workspacePath, session.sessionId);
  const taskItems = session.tasks
    .filter((task) => task.status !== "done")
    .map((task) => sessionTaskItem(command, session, task));
  const nextCheckItems = recentSessionNextChecks(session).map(({ checkpoint, check }) =>
    sessionNextCheckItem(command, session, checkpoint, check)
  );

  return [...taskItems, ...nextCheckItems];
}

function reportDraftReviewItem(workspacePath: string, summary: ReportDraftSummary): WorkspaceReviewItem {
  const report = summary.report;
  const verified = summary.markdownVerified;
  return {
    itemId: itemIdFor({
      kind: "report-draft-review",
      reportId: report.reportId,
      markdownStatus: summary.markdownStatus,
      markdownSha256: summary.markdownSha256
    }),
    kind: "report-draft-review",
    priority: verified ? "low" : "high",
    title: verified ? `Review saved report draft: ${report.title}` : `Fix report draft before sharing: ${report.title}`,
    summary: verified
      ? `Saved report draft ${report.reportId} has Markdown SHA-256 ${report.markdownSha256} verified against its JSON sidecar.`
      : `Saved report draft ${report.reportId} has Markdown status ${summary.markdownStatus}; treat it as unreviewed until the JSON and Markdown agree.`,
    command: `truth-harness workspace report ${quoteCommandArg(report.reportId)} ${quoteCommandArg(workspacePath)} --json`,
    reportId: report.reportId,
    trust: isTrustLabel(report.trust) ? report.trust : undefined,
    createdAt: report.createdAt,
    source: {
      label: "report draft",
      ref: report.reportId
    }
  };
}

function sessionTaskItem(command: string, session: ResearchSession, task: ResearchSessionTask): WorkspaceReviewItem {
  return {
    itemId: itemIdFor({
      kind: "session-task",
      sessionId: session.sessionId,
      taskId: task.taskId,
      updatedAt: session.updatedAt
    }),
    kind: "session-task",
    priority: priorityForSessionTask(task),
    title: `Research task: ${task.title}`,
    summary: `${session.title} - ${task.status}`,
    command,
    sessionId: session.sessionId,
    taskId: task.taskId,
    domain: session.domains[0],
    createdAt: session.updatedAt,
    source: {
      label: "research session",
      ref: `${session.sessionId}:${task.taskId}`
    }
  };
}

function sessionNextCheckItem(
  command: string,
  session: ResearchSession,
  checkpoint: ResearchSessionCheckpoint,
  check: string
): WorkspaceReviewItem {
  return {
    itemId: itemIdFor({
      kind: "session-next-check",
      sessionId: session.sessionId,
      checkpointId: checkpoint.checkpointId,
      check
    }),
    kind: "session-next-check",
    priority: "medium",
    title: `Session next check: ${check}`,
    summary: `${session.title} checkpoint ${checkpoint.checkpointId}`,
    command,
    sessionId: session.sessionId,
    checkpointId: checkpoint.checkpointId,
    domain: session.domains[0],
    createdAt: checkpoint.createdAt,
    source: {
      label: "research checkpoint",
      ref: `${session.sessionId}:${checkpoint.checkpointId}`
    }
  };
}

function recentSessionNextChecks(
  session: ResearchSession
): Array<{ checkpoint: ResearchSessionCheckpoint; check: string }> {
  return [...session.checkpoints]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .flatMap((checkpoint) => checkpoint.nextChecks.map((check) => ({ checkpoint, check })))
    .slice(0, 20);
}

function claimsByRouteEvidence(claims: ClaimLedgerRecord[]): Map<string, ClaimLedgerRecord[]> {
  const map = new Map<string, ClaimLedgerRecord[]>();
  for (const claim of claims) {
    for (const ref of claim.evidenceRefs ?? []) {
      if (ref.kind !== "route") {
        continue;
      }

      const bucket = map.get(ref.ref) ?? [];
      bucket.push(claim);
      map.set(ref.ref, bucket);
    }
  }

  return map;
}

function summarizeItems(input: {
  routes: number;
  claims: number;
  sessions: number;
  reportDrafts: number;
  items: WorkspaceReviewItem[];
}): WorkspaceReview["summary"] {
  return {
    routes: input.routes,
    claims: input.claims,
    sessions: input.sessions,
    reportDrafts: input.reportDrafts,
    totalItems: input.items.length,
    routeObligations: input.items.filter((item) => item.kind === "route-obligation").length,
    readyRoutesWithoutClaims: input.items.filter((item) => item.kind === "route-ready-claim").length,
    blockedClaims: input.items.filter((item) => item.kind === "claim-blocker").length,
    reportDraftReviewItems: input.items.filter((item) => item.kind === "report-draft-review").length,
    reportDraftsNeedingAttention: input.items.filter((item) => item.kind === "report-draft-review" && item.priority !== "low").length,
    sessionTasks: input.items.filter((item) => item.kind === "session-task").length,
    sessionNextChecks: input.items.filter((item) => item.kind === "session-next-check").length,
    criticalItems: input.items.filter((item) => item.priority === "critical").length,
    highItems: input.items.filter((item) => item.priority === "high").length,
    mediumItems: input.items.filter((item) => item.priority === "medium").length,
    lowItems: input.items.filter((item) => item.priority === "low").length
  };
}

function createAutonomyContract(items: WorkspaceReviewItem[]): WorkspaceReviewAutonomyContract {
  const nextItem = items[0];
  const highStakeItems = items.filter((item) => itemRequiresHumanReview(item));
  const mode: WorkspaceReviewAutonomyMode = items.length === 0
    ? "idle"
    : highStakeItems.length > 0 ? "human-review-gated" : "local-verifier-loop";
  const requiredArtifacts = uniqueSorted(
    items
      .slice(0, 5)
      .flatMap((item) => item.evidenceSlots ?? [])
      .flatMap((slot) => slot.acceptedArtifacts)
  );
  const humanReviewRequiredFor = uniqueSorted([
    ...highStakeItems.map((item) => `${item.kind}:${item.claimId ?? item.sessionId ?? item.routeId ?? item.itemId}`),
    "any final medical, patent, finance, safety, or real-world scientific claim",
    "any claim whose strongest evidence is only a model answer, simulation, notebook output, or CAS output"
  ]);
  const contractWithoutPacket = {
    mode,
    canRunUnattended: items.length > 0,
    suggestedBatchSize: Math.min(3, items.length),
    nextItemId: nextItem?.itemId,
    nextCommand: nextItem?.command,
    allowedActions: autonomyAllowedActions(mode),
    blockedActions: autonomyBlockedActions(),
    stopConditions: autonomyStopConditions(mode),
    requiredArtifacts,
    humanReviewRequiredFor
  };

  return {
    ...contractWithoutPacket,
    agentPacket: renderAutonomyAgentPacket(contractWithoutPacket)
  };
}

function itemRequiresHumanReview(item: WorkspaceReviewItem): boolean {
  if (item.kind === "report-draft-review" && item.priority !== "low") {
    return true;
  }

  if (item.kind === "claim-blocker") {
    return true;
  }

  return item.domain === "biology"
    || item.domain === "biomedical"
    || item.domain === "finance"
    || item.domain === "security"
    || item.domain === "patent"
    || item.domain === "climate"
    || item.domain === "energy";
}

function autonomyAllowedActions(mode: WorkspaceReviewAutonomyMode): string[] {
  const actions = [
    "Read local Truth Harness receipts, routes, claims, sessions, report drafts, reviews, and snapshots.",
    "Run only the exact local truth-harness commands listed in the ordered work queue.",
    "Write replayable local receipts, CAS checks, SMT checks, proof checks, research checkpoints, workspace reviews, and snapshots.",
    "Prepare model-context packets without sending them to a hosted model."
  ];

  if (mode === "local-verifier-loop") {
    actions.push("Batch up to the suggested number of verifier tasks before pausing for review.");
  }

  if (mode === "human-review-gated") {
    actions.push("Gather local evidence and draft review packets, but leave final interpretation to a human expert.");
  }

  return actions;
}

function autonomyBlockedActions(): string[] {
  return [
    "Do not use network access, hosted models, package installs, or external services unless a user-approved model-context and disclosure log already exists.",
    "Do not run arbitrary code or unsandboxed commands outside the explicit Truth Harness command surface.",
    "Do not mark tasks done without attached evidence refs.",
    "Do not upgrade a trust label unless an accepted local artifact satisfies the exact matching obligation.",
    "Do not make final medical, legal, patent, finance, safety, or scientific claims from AI output alone."
  ];
}

function autonomyStopConditions(mode: WorkspaceReviewAutonomyMode): string[] {
  const conditions = [
    "A required verifier is unavailable, returns unknown, disagrees, or produces malformed evidence.",
    "A command would require network, package installation, credentials, private data export, or unsandboxed execution.",
    "The next step would broaden the claim beyond the current receipt, route, source, or validation boundary.",
    "Workspace validation fails or a referenced artifact is missing.",
    "The suggested batch size is exhausted; write a checkpoint or workspace review before continuing."
  ];

  if (mode === "human-review-gated") {
    conditions.push("A high-stakes interpretation, final claim, treatment, patentability, or real-world recommendation is requested.");
  }

  return conditions;
}

function renderAutonomyAgentPacket(contract: Omit<WorkspaceReviewAutonomyContract, "agentPacket">): string {
  const lines = [
    "# Truth Harness Autonomy Contract",
    "",
    `Mode: ${contract.mode}`,
    `Can run unattended: ${String(contract.canRunUnattended)}`,
    `Suggested batch size: ${contract.suggestedBatchSize}`,
    `Next item: ${contract.nextItemId ?? "n/a"}`,
    "",
    "Next command:",
    "```sh",
    contract.nextCommand ?? "No open local work item.",
    "```",
    "",
    "Allowed actions:",
    ...contract.allowedActions.map((action) => `- ${action}`),
    "",
    "Blocked actions:",
    ...contract.blockedActions.map((action) => `- ${action}`),
    "",
    "Stop conditions:",
    ...contract.stopConditions.map((condition) => `- ${condition}`),
    "",
    "Required artifacts:",
    ...(contract.requiredArtifacts.length === 0
      ? ["- No open artifacts required right now."]
      : contract.requiredArtifacts.map((artifact) => `- ${artifact}`)),
    "",
    "Human review required for:",
    ...contract.humanReviewRequiredFor.map((boundary) => `- ${boundary}`),
    "",
    "Truth boundary:",
    "- This contract can authorize local work. It cannot certify truth.",
    "- Truth labels move only when replayable evidence satisfies explicit gates.",
    ""
  ];

  return lines.join("\n");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function priorityForRouteObligation(route: VerifierRoute, obligation: ProofObligation): WorkspaceReviewPriority {
  if (isStrongerLabelUpgrade(obligation)) {
    return route.finalTrust === "unverified" ? "medium" : "low";
  }

  if (obligation.severity === "critical") {
    return route.finalTrust === "unverified" ? "high" : "critical";
  }

  if (route.finalTrust !== "unverified" && route.finalTrust !== "refuted") {
    return "medium";
  }

  if (obligation.kind === "formal-proof" || obligation.kind === "solver-encoding") {
    return "high";
  }

  return obligation.severity === "warning" ? "high" : "medium";
}

function isStrongerLabelUpgrade(obligation: ProofObligation): boolean {
  return obligation.requiredBefore === "Before making a stronger claim than the current receipt supports.";
}

function priorityForClaim(claim: ClaimLedgerRecord): WorkspaceReviewPriority {
  if (claim.trust === "refuted" || claim.trust === "unverified") {
    return "high";
  }

  if (claim.domain === "biology" || claim.domain === "finance" || claim.domain === "security" || claim.domain === "patent") {
    return "high";
  }

  return "medium";
}

function priorityForValidationGate(gate: ValidationGate): WorkspaceReviewPriority {
  if (gate.status === "blocked" || gate.kind === "proof") {
    return gate.blocking ? "critical" : "high";
  }

  if (gate.blocking) {
    return "high";
  }

  if (gate.status === "missing" || gate.status === "planned") {
    return "medium";
  }

  return "low";
}

function priorityForSessionTask(task: ResearchSessionTask): WorkspaceReviewPriority {
  if (task.status === "blocked" || task.status === "doing") {
    return "high";
  }

  return "medium";
}

function sortReviewItems(items: WorkspaceReviewItem[]): WorkspaceReviewItem[] {
  const rank: Record<WorkspaceReviewPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  };
  const kindRank: Record<WorkspaceReviewItemKind, number> = {
    "validation-gate": 0,
    "route-obligation": 1,
    "claim-blocker": 2,
    "report-draft-review": 3,
    "session-task": 4,
    "session-next-check": 5,
    "route-ready-claim": 6,
    "credibility-action": 7
  };

  return [...items].sort((left, right) => {
    const priority = rank[left.priority] - rank[right.priority];
    if (priority !== 0) {
      return priority;
    }

    const kind = kindRank[left.kind] - kindRank[right.kind];
    if (kind !== 0) {
      return kind;
    }

    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}

function attachAgentPackets(items: WorkspaceReviewItem[]): WorkspaceReviewItem[] {
  return items.map((item) => {
    const acceptanceCriteria = workspaceReviewAcceptanceCriteria(item);
    const evidenceSlots = workspaceReviewEvidenceSlots(item);

    return {
      ...item,
      evidenceSlots,
      acceptanceCriteria,
      agentPacket: workspaceReviewAgentPacket(item, acceptanceCriteria, evidenceSlots)
    };
  });
}

function workspaceReviewEvidenceSlots(item: WorkspaceReviewItem): WorkspaceReviewEvidenceSlot[] {
  if (item.kind === "validation-gate") {
    return [
      {
        slotId: `validation-${item.validationGateKind ?? "gate"}-evidence`,
        label: "Validation gate evidence",
        required: true,
        status: "open",
        description: "Attach the evidence artifact required by this linked validation gate before strengthening the research claim.",
        acceptedArtifacts: acceptedArtifactsForValidationGate(item.validationGateKind),
        suggestedCommand: item.command,
        attachTo: {
          sessionId: item.sessionId,
          validationPlanId: item.validationPlanId,
          validationGateId: item.validationGateId
        }
      }
    ];
  }

  if (item.kind === "route-obligation") {
    return [routeObligationEvidenceSlot(item)];
  }

  if (item.kind === "route-ready-claim") {
    return [
      {
        slotId: "claim-ledger-record",
        label: "Claim ledger record",
        required: true,
        status: "open",
        description: "A narrow local claim must cite the ready verifier route without upgrading its trust label.",
        acceptedArtifacts: ["truth-harness claim add", ".truth-harness/claims/*.json"],
        suggestedCommand: item.command,
        attachTo: {
          routeId: item.routeId
        }
      }
    ];
  }

  if (item.kind === "claim-blocker") {
    return [
      {
        slotId: "claim-supporting-evidence",
        label: "Supporting evidence",
        required: true,
        status: "open",
        description: "Attach receipts, verifier routes, source citations, expert review, or a validation plan that resolves the open check.",
        acceptedArtifacts: [
          ".truth-harness/receipts/*.json",
          ".truth-harness/routes/*.json",
          ".truth-harness/literature/*.json",
          ".truth-harness/reviews/*.json",
          ".truth-harness/validation/*.json"
        ],
        suggestedCommand: item.command,
        attachTo: {
          claimId: item.claimId
        }
      }
    ];
  }

  if (item.kind === "report-draft-review") {
    const verified = item.priority === "low";
    return [
      {
        slotId: verified ? "verified-report-markdown" : "report-markdown-hash-review",
        label: verified ? "Verified report draft" : "Report draft integrity review",
        required: !verified,
        status: verified ? "satisfied" : "open",
        description: verified
          ? "The saved Markdown matches the SHA-256 recorded in the report draft JSON sidecar."
          : "The report draft Markdown is missing or no longer matches the JSON sidecar hash. Regenerate or review before sharing.",
        acceptedArtifacts: [
          "truth-harness workspace report <report_id> --json",
          ".truth-harness/findings/*report-draft.json",
          ".truth-harness/findings/*report-draft.md"
        ],
        suggestedCommand: item.command
      }
    ];
  }

  if (item.kind === "session-task" || item.kind === "session-next-check") {
    return [
      {
        slotId: "research-checkpoint",
        label: "Research checkpoint",
        required: true,
        status: "open",
        description: "Update the research session with linked receipts, routes, notes, or unresolved blockers so future agents can resume.",
        acceptedArtifacts: [".truth-harness/sessions/*.json", ".truth-harness/findings/*workspace-review*.json"],
        suggestedCommand: item.command,
        attachTo: {
          sessionId: item.sessionId
        }
      }
    ];
  }

  return [];
}

function acceptedArtifactsForValidationGate(kind: string | undefined): string[] {
  switch (kind) {
    case "proof":
      return [
        "truth-harness verify <claim> --write",
        ".truth-harness/routes/*.json",
        ".truth-harness/receipts/*.json",
        ".truth-harness/proofs/*.json",
        ".truth-harness/smt/*.json",
        ".truth-harness/cas/*.json"
      ];
    case "source-citation":
    case "literature-record":
    case "prior-art":
      return [".truth-harness/indexes/*.json", ".truth-harness/literature/*.json", "source-cited local refs"];
    case "notebook-run":
      return [".truth-harness/notebook-runs/*.json"];
    case "code-run":
      return [".truth-harness/code-runs/*.json"];
    case "simulation-log":
    case "simulation-review":
      return [".truth-harness/simulations/*.json", ".truth-harness/reviews/*.json"];
    case "benchmark":
      return [".truth-harness/benchmarks/*.json"];
    case "expert-review":
    case "safety":
    case "patent-legal":
      return [".truth-harness/reviews/*.json"];
    case "workspace-snapshot":
      return [".truth-harness/snapshots/*.json"];
    default:
      return [".truth-harness/**/*.json", "local evidence refs matching the validation gate"];
  }
}

function routeObligationEvidenceSlot(item: WorkspaceReviewItem): WorkspaceReviewEvidenceSlot {
  const attachTo = {
    routeId: item.routeId,
    obligationId: item.obligationId
  };

  if (item.obligationKind === "formal-proof") {
    return {
      slotId: "accepted-proof-check",
      label: "Accepted proof-check artifact",
      required: true,
      status: "open",
      description: "Close this only with an accepted proof-checking backend record scoped to this exact route obligation.",
      acceptedArtifacts: ["truth-harness proof check --route <route_id> --obligation <obl_id>", ".truth-harness/proofs/*.json"],
      suggestedCommand: item.command,
      attachTo
    };
  }

  if (item.obligationKind === "solver-encoding") {
    return {
      slotId: "smt-solver-check",
      label: "SMT solver artifact",
      required: true,
      status: "open",
      description: "Close this with a replayable SMT record that encodes the exact scoped claim and earns smt-checked or stronger.",
      acceptedArtifacts: ["truth-harness smt check", "truth-harness smt solve", ".truth-harness/smt/*.json"],
      suggestedCommand: item.command,
      attachTo
    };
  }

  if (item.obligationKind === "independent-check") {
    return {
      slotId: "independent-cross-check",
      label: "Independent cross-check artifact",
      required: true,
      status: "open",
      description: "Close this with an independent CAS, SMT, or proof artifact that agrees with the current route result.",
      acceptedArtifacts: ["truth-harness cas check", "truth-harness smt check", ".truth-harness/cas/*.json", ".truth-harness/smt/*.json"],
      suggestedCommand: item.command,
      attachTo
    };
  }

  return {
    slotId: "route-evidence-artifact",
    label: "Route evidence artifact",
    required: true,
    status: "open",
    description: "Attach replayable local evidence that satisfies this obligation without widening the claim.",
    acceptedArtifacts: [".truth-harness/**/*.json", "proof/CAS/SMT/source/review artifact"],
    suggestedCommand: item.command,
    attachTo
  };
}

function workspaceReviewAcceptanceCriteria(item: WorkspaceReviewItem): string[] {
  const criteria: string[] = [];

  if (item.kind === "route-obligation") {
    criteria.push(
      "Open the source route and satisfy this exact obligation before upgrading trust.",
      "Attach the resulting proof, solver, CAS, or review artifact to the route.",
      "Keep any final claim inside the route problem, checker output, and limitations."
    );
  } else if (item.kind === "validation-gate") {
    criteria.push(
      "Open the linked validation plan and close this exact gate before broadening the research claim.",
      "Produce or attach the required local evidence artifact listed in the evidence slot.",
      "Checkpoint the owning research session with the new evidence ref and any remaining blocker."
    );
  } else if (item.kind === "route-ready-claim") {
    criteria.push(
      "Record a narrow claim that cites this route as evidence.",
      "Use the route's strongest trust label without upgrading it.",
      "Leave broader claims open until independent obligations are satisfied."
    );
  } else if (item.kind === "claim-blocker") {
    criteria.push(
      "Run the claim review and resolve the named open check.",
      "Attach citations, receipts, routes, or expert review before finalizing.",
      "Do not finalize the claim until open blockers are represented in the ledger."
    );
  } else if (item.kind === "report-draft-review") {
    if (item.priority === "low") {
      criteria.push(
        "Read the report draft through the local report command and inspect its warnings.",
        "Confirm cited receipts, routes, and bundle verifications still support the written wording.",
        "Use the draft as a review artifact, not as independent proof."
      );
    } else {
      criteria.push(
        "Treat the draft as tampered, stale, or manually edited until its Markdown hash is reconciled.",
        "Regenerate or review the saved draft before sharing it with a reviewer.",
        "Do not cite the draft as a stable artifact while the sidecar verification is failing."
      );
    }
  } else if (item.kind === "session-task") {
    criteria.push(
      "Open the research session and update only this task or its attached evidence.",
      "Record a checkpoint when the task changes state.",
      "Keep generated notes linked to receipts, routes, or sources."
    );
  } else if (item.kind === "session-next-check") {
    criteria.push(
      "Open the research session and answer this checkpoint check directly.",
      "Attach any resulting receipt, source, or route before marking it addressed.",
      "Record a new checkpoint with unresolved questions."
    );
  }

  criteria.push(
    "Run this only inside the local workspace boundary.",
    "Do not claim more than the attached evidence earns."
  );

  return criteria;
}

function workspaceReviewAgentPacket(
  item: WorkspaceReviewItem,
  acceptanceCriteria: string[],
  evidenceSlots: WorkspaceReviewEvidenceSlot[]
): string {
  const lines = [
    "# Truth Harness Workspace Action",
    "",
    `Item: ${item.itemId}`,
    `Priority: ${item.priority}`,
    `Kind: ${item.kind}`,
    `Objective: ${item.title}`,
    `Summary: ${item.summary}`,
    `Source: ${item.source.label} ${item.source.ref}`,
    `Route: ${item.routeId ?? "n/a"}`,
    `Claim: ${item.claimId ?? "n/a"}`,
    `Session: ${item.sessionId ?? "n/a"}`,
    `Validation plan: ${item.validationPlanId ?? "n/a"}`,
    `Validation gate: ${item.validationGateId ?? "n/a"} (${item.validationGateKind ?? "n/a"})`,
    `Report: ${item.reportId ?? "n/a"}`,
    `Obligation: ${item.obligationId ?? "n/a"}`,
    `Trust: ${item.trust ?? "n/a"}`,
    "",
    "Command:",
    "```sh",
    item.command,
    "```",
    "",
    "Acceptance criteria:",
    ...acceptanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Evidence slots:",
    ...(evidenceSlots.length === 0
      ? ["- No explicit evidence slot recorded for this action."]
      : evidenceSlots.flatMap((slot) => [
        `- ${slot.label} (${slot.status}${slot.required ? ", required" : ""})`,
        `  - Accepts: ${slot.acceptedArtifacts.join("; ")}`,
        `  - Attach to: ${formatEvidenceSlotTarget(slot)}`
      ])),
    "",
    "Trust boundary:",
    "- Local-only packet; no network access is required by this action.",
    "- This packet is a plan, not evidence. Trust only changes after a replayable artifact/check is attached.",
    ""
  ];

  return lines.join("\n");
}

function formatEvidenceSlotTarget(slot: WorkspaceReviewEvidenceSlot): string {
  const target = slot.attachTo;
  if (!target) {
    return "local workspace artifact";
  }

  return [
    target.routeId ? `route:${target.routeId}` : undefined,
    target.obligationId ? `obligation:${target.obligationId}` : undefined,
    target.claimId ? `claim:${target.claimId}` : undefined,
    target.sessionId ? `session:${target.sessionId}` : undefined,
    target.validationPlanId ? `validation:${target.validationPlanId}` : undefined,
    target.validationGateId ? `gate:${target.validationGateId}` : undefined
  ].filter(Boolean).join(" ") || "local workspace artifact";
}

function itemIdFor(value: unknown): string {
  return `work_${stableHash(value).slice(0, 16)}`;
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/u.test(value) ? value : JSON.stringify(value);
}

function researchSessionCommand(workspacePath: string, sessionId: string): string {
  return `truth-harness research show ${quoteCommandArg(sessionId)} --workspace ${quoteCommandArg(workspacePath)} --json`;
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/gu, "\\|").replace(/\n/gu, " ");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\*/gu, "\\*").replace(/_/gu, "\\_").replace(/`/gu, "\\`");
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

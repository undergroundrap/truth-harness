import { createHash } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { createClaimReviewPacket, listClaimRecords, type ClaimLedgerDomain, type ClaimLedgerRecord } from "./claim-ledger.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import {
  inspectLeanProject,
  type LeanProjectDeclaration,
  type LeanProjectInspection,
  type LeanProjectProofMarker,
  type LeanProjectProofMarkerRepairTarget
} from "./lean-project.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { listLeanProofChecks, type LeanProofCheckSummary } from "./proof-backend.js";
import { listReportDrafts, type ReportDraftSummary } from "./report-draft.js";
import {
  listVerifierRoutes,
  readVerifierRoute,
  verifierRouteStatementBoundaryHash,
  verifierRouteReadiness,
  type ProofObligation,
  type VerifierRoute
} from "./verifier-route.js";
import {
  isResearchHarnessDefaultTaskTitle,
  listResearchSessions,
  type ResearchSession,
  type ResearchSessionCheckpoint,
  type ResearchEvidenceRef,
  type ResearchSessionTask
} from "./research-session.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { listSmtChecks, type SmtCheckSummary } from "./smt-backend.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";
import { listValidationPlans, type ValidationEvidenceRef, type ValidationGate, type ValidationPlan } from "./validation-plan.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";
import { listWorkspaceSnapshots, type WorkspaceSnapshotSummary } from "./workspace-snapshot.js";

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
  attachCommand?: string;
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
  candidateEvidenceRefs?: ValidationEvidenceRef[];
  proofDeclaration?: WorkspaceReviewProofDeclaration;
  proofAttempt?: WorkspaceReviewProofAttempt;
  proofAttemptHistory?: WorkspaceReviewProofAttempt[];
  proofRepairTarget?: WorkspaceReviewProofRepairTarget;
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

export interface WorkspaceReviewProofDeclaration {
  declarationId: string;
  kind: LeanProjectDeclaration["kind"];
  name?: string;
  path: string;
  line: number;
  column: number;
  signature: string;
  signatureSha256: string;
  sourceSha256: string;
}

type WorkspaceReviewProofDeclarationSource = WorkspaceReviewProofDeclaration;

export interface WorkspaceReviewProofRepairTarget {
  repairTargetId: string;
  sourcePath: string;
  sourceSha256: string;
  markerKind: LeanProjectProofMarkerRepairTarget["markerKind"];
  markerLine: number;
  markerColumn: number;
  declarationId?: string;
  declarationName?: string;
  declarationSignatureSha256?: string;
  afterEditCommands: string[];
  evidenceRequired: string[];
  boundary: string;
}

export interface WorkspaceReviewProofAttempt {
  checkId: string;
  path: string;
  sourcePath: string;
  sourceSha256?: string;
  sourceByteLength?: number;
  sourceStatus?: "unchanged" | "changed" | "missing" | "unchecked";
  sourceCurrentSha256?: string;
  sourceCurrentByteLength?: number;
  declarationName?: string;
  declaration?: WorkspaceReviewProofDeclaration;
  status: LeanProofCheckSummary["status"];
  trust: TrustLabel;
  createdAt: string;
  diagnosticSnippet?: string;
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
    leanProofSafetyItems: number;
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
const MAX_PROOF_ATTEMPT_HISTORY = 5;

type ReviewLeanProofCheckSummary = LeanProofCheckSummary & {
  reviewSourceStatus?: NonNullable<WorkspaceReviewProofAttempt["sourceStatus"]>;
  reviewSourceCurrentSha256?: string;
  reviewSourceCurrentByteLength?: number;
};

export async function createWorkspaceReview(input: CreateWorkspaceReviewInput): Promise<WorkspaceReview> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const routeSummaries = (await listVerifierRoutes(status.root)).slice(0, input.maxRoutes ?? 100);
  const claims = (await listClaimRecords(status.root)).slice(0, input.maxClaims ?? 200);
  const sessions = (await listResearchSessions(status.root)).slice(0, input.maxSessions ?? 100);
  const reportDrafts = await listReportDrafts({ rootPath: status.root, limit: input.maxReports ?? 50 });
  const validationPlans = await listValidationPlans(status.root);
  const proofChecks = await enrichProofChecksWithSourceStatus(status.root, await listLeanProofChecks(status.root));
  const smtChecks = await listSmtChecks(status.root);
  const snapshots = await listWorkspaceSnapshots(status.root);
  const leanInspection = await inspectLeanProject({
    rootPath: status.root,
    projectPath: ".",
    maxLeanFiles: 40
  });
  const proofSafetyItems = leanProofSafetyReviewItems(status.root, leanInspection);
  const claimsByRouteRef = claimsByRouteEvidence(claims);
  const claimsByStatementKey = claimsByReviewStatementKey(claims);
  const supersededClaimIds = supersededClaimIdSet(claims);
  const routes = await Promise.all(routeSummaries.map((route) => readVerifierRoute(status.root, route.routeId)));
  const staleEquivalentRouteIds = staleEquivalentVerifierRouteIds(routes);
  const activeRoutes = routes.filter((route) => !staleEquivalentRouteIds.has(route.routeId));
  const readyRoutesByStatementKey = readyRoutesByReviewStatementKey(activeRoutes);
  const claimItems = (await Promise.all(
    claims.map((claim) => claimReviewItems(status.root, claim, supersededClaimIds, readyRoutesByStatementKey))
  )).flat();
  const candidateItems = sortReviewItems([
    ...proofSafetyItems,
    ...sessions.flatMap((session) =>
      linkedValidationGateItems(status.root, session, validationPlans, readyRoutesByStatementKey, proofChecks, smtChecks, snapshots)
    ),
    ...activeRoutes.flatMap((route) =>
      routeReviewItems(status.root, route, claimsByRouteRef, claimsByStatementKey, leanInspection, proofChecks)
    ),
    ...claimItems,
    ...reportDrafts.flatMap((report) => reportDraftReviewItems(status.root, report)),
    ...sessions.flatMap((session) => sessionReviewItems(status.root, session, validationPlans))
  ]);
  const passiveRouteInspectionItems = candidateItems.filter(isPassiveRouteInspectionItem);
  const passiveRouteInspectionWarning = passiveRouteInspectionItems.length > 0
    ? `${passiveRouteInspectionItems.length} passive route obligation${passiveRouteInspectionItems.length === 1 ? "" : "s"} ${passiveRouteInspectionItems.length === 1 ? "remains" : "remain"} on verifier routes but were omitted from the executable work queue. Inspect the source routes before upgrading any claim beyond its current trust label.`
    : undefined;
  const items = attachAgentPackets(candidateItems.filter((item) => !isPassiveRouteInspectionItem(item)));
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
      "Follow item commands only inside the local workspace boundary and keep final claims scoped to attached evidence.",
      ...(passiveRouteInspectionWarning ? [passiveRouteInspectionWarning] : [])
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

function leanProofSafetyReviewItems(workspacePath: string, inspection: LeanProjectInspection): WorkspaceReviewItem[] {
  if (!inspection.proofSafety.blocksProvedTrust) {
    return [];
  }

  const scanCommand = `truth-harness proof project ${quoteCommandArg(inspection.projectPath)} --workspace ${quoteCommandArg(workspacePath)} --max-lean-files 40 --json`;
  return inspection.proofSafety.markers.sample.slice(0, 5).map((marker) =>
    leanProofSafetyReviewItem({
      command: scanCommand,
      marker,
      totalMarkers: inspection.proofSafety.markers.total,
      completeProjectScan: inspection.proofSafety.completeProjectScan
    })
  );
}

function leanProofSafetyReviewItem(input: {
  command: string;
  marker: LeanProjectProofMarker;
  totalMarkers: number;
  completeProjectScan: boolean;
}): WorkspaceReviewItem {
  const markerRef = `${input.marker.path}:${input.marker.line}:${input.marker.column}`;
  return {
    itemId: itemIdFor({
      kind: "lean-proof-safety",
      path: input.marker.path,
      line: input.marker.line,
      column: input.marker.column,
      marker: input.marker.kind
    }),
    kind: "route-obligation",
    priority: "critical",
    title: `Resolve Lean proof marker: ${input.marker.kind}`,
    summary: `${markerRef} contains ${input.marker.kind}. ${input.marker.message} Truth Harness found ${input.totalMarkers} blocking Lean marker(s) and will not treat affected source as proved until each marker is removed or the proof boundary is rewritten. ${input.completeProjectScan ? "" : "The project scan was truncated; increase --max-lean-files for full coverage."}`.trim(),
    command: input.command,
    obligationKind: "formal-proof",
    domain: "math",
    trust: "unverified",
    createdAt: "1970-01-01T00:00:00.000Z",
    ...(input.marker.declaration ? { proofDeclaration: workspaceReviewMarkerProofDeclaration(input.marker) } : {}),
    proofRepairTarget: workspaceReviewProofRepairTarget(input.marker.repairTarget),
    source: {
      label: "Lean proof safety",
      ref: `lean-marker:${markerRef}`
    }
  };
}

function workspaceReviewProofRepairTarget(
  repairTarget: LeanProjectProofMarkerRepairTarget
): WorkspaceReviewProofRepairTarget {
  return {
    repairTargetId: repairTarget.repairTargetId,
    sourcePath: repairTarget.sourcePath,
    sourceSha256: repairTarget.sourceSha256,
    markerKind: repairTarget.markerKind,
    markerLine: repairTarget.markerLine,
    markerColumn: repairTarget.markerColumn,
    ...(repairTarget.declarationId ? { declarationId: repairTarget.declarationId } : {}),
    ...(repairTarget.declarationName ? { declarationName: repairTarget.declarationName } : {}),
    ...(repairTarget.declarationSignatureSha256
      ? { declarationSignatureSha256: repairTarget.declarationSignatureSha256 }
      : {}),
    afterEditCommands: [...repairTarget.afterEditCommands],
    evidenceRequired: [...repairTarget.evidenceRequired],
    boundary: repairTarget.boundary
  };
}

function workspaceReviewMarkerProofDeclaration(marker: LeanProjectProofMarker): WorkspaceReviewProofDeclaration {
  const declaration = marker.declaration;
  if (!declaration) {
    throw new Error("Lean proof marker has no enclosing declaration.");
  }

  return {
    declarationId: declaration.declarationId,
    kind: declaration.kind,
    ...(declaration.name ? { name: declaration.name } : {}),
    path: declaration.path,
    line: declaration.line,
    column: declaration.column,
    signature: declaration.signature,
    signatureSha256: declaration.signatureSha256,
    sourceSha256: declaration.sourceSha256
  };
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
  validationPlans: ValidationPlan[],
  readyRoutesByStatementKey: Map<string, VerifierRoute>,
  proofChecks: ReviewLeanProofCheckSummary[],
  smtChecks: SmtCheckSummary[],
  snapshots: WorkspaceSnapshotSummary[]
): WorkspaceReviewItem[] {
  const plans = linkedValidationPlansForSession(session, validationPlans);
  return plans.flatMap((plan) =>
    openValidationGates(plan).map((gate) =>
      validationGateItem(workspacePath, session, plan, gate, readyRoutesByStatementKey, proofChecks, smtChecks, snapshots)
    )
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
  gate: ValidationGate,
  readyRoutesByStatementKey: Map<string, VerifierRoute>,
  proofChecks: ReviewLeanProofCheckSummary[],
  smtChecks: SmtCheckSummary[],
  snapshots: WorkspaceSnapshotSummary[]
): WorkspaceReviewItem {
  const candidateEvidenceRefs = candidateEvidenceRefsForValidationGate(
    session,
    plan,
    gate,
    readyRoutesByStatementKey,
    proofChecks,
    smtChecks,
    snapshots
  );

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
    command: commandForValidationGate(workspacePath, session, plan, gate, candidateEvidenceRefs),
    sessionId: session.sessionId,
    validationPlanId: plan.planId,
    validationGateId: gate.gateId,
    validationGateKind: gate.kind,
    candidateEvidenceRefs,
    domain: plan.domains[0],
    createdAt: plan.updatedAt,
    source: {
      label: "linked validation plan",
      ref: `${session.sessionId}:${plan.planId}:${gate.gateId}`
    }
  };
}

function candidateEvidenceRefsForValidationGate(
  session: ResearchSession,
  plan: ValidationPlan,
  gate: ValidationGate,
  readyRoutesByStatementKey: Map<string, VerifierRoute>,
  proofChecks: ReviewLeanProofCheckSummary[],
  smtChecks: SmtCheckSummary[],
  snapshots: WorkspaceSnapshotSummary[]
): ValidationEvidenceRef[] {
  const attached = new Set(gate.evidenceRefs.map((ref) => validationEvidenceKey(ref)));
  const candidates: ValidationEvidenceRef[] = [];
  const seen = new Set<string>();
  const collectCandidate = (candidate: ValidationEvidenceRef): void => {
    if (!isEvidenceCandidateForValidationGate(candidate, gate)) {
      return;
    }
    const key = validationEvidenceKey(candidate);
    if (attached.has(key) || seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  };
  const collect = (ref: ResearchEvidenceRef): void => {
    const candidate = toValidationEvidenceRef(ref);
    if (!candidate) {
      return;
    }
    collectCandidate(candidate);
  };

  session.evidenceRefs.forEach(collect);
  for (const checkpoint of session.checkpoints) {
    checkpoint.evidenceRefs.forEach(collect);
  }
  for (const key of reviewStatementKeys(plan.claim)) {
    const route = readyRoutesByStatementKey.get(key);
    if (!route) {
      continue;
    }
    collectCandidate({
      kind: "route",
      ref: route.routeId,
      trust: verifierRouteReadiness(route).strongestTrust,
      summary: `Ready verifier route ${route.routeId} matches validation claim ${JSON.stringify(plan.claim)}.`
    });
  }
  for (const proof of proofChecks) {
    if (!isProofCheckCandidateForValidationPlan(proof, plan, gate)) {
      continue;
    }
    collectCandidate({
      kind: "proof",
      ref: proof.path,
      trust: proof.trust,
      summary: `Accepted Lean proof check ${proof.checkId} matches validation claim ${JSON.stringify(plan.claim)}.`
    });
  }
  for (const smt of smtChecks) {
    if (!isSmtCheckCandidateForValidationPlan(smt, plan, gate)) {
      continue;
    }
    collectCandidate({
      kind: "smt",
      ref: smt.path,
      trust: smt.trust,
      summary: `SMT check ${smt.checkId} matches validation claim ${JSON.stringify(plan.claim)}.`
    });
  }
  for (const snapshot of snapshots) {
    if (!isSnapshotCandidateForValidationPlan(snapshot, plan, gate)) {
      continue;
    }
    collectCandidate({
      kind: "snapshot",
      ref: snapshot.path,
      summary: `Workspace snapshot ${snapshot.snapshotId} captured ${snapshot.totalFiles} local artifact(s) after validation plan ${plan.planId} was updated.`
    });
  }

  return rankValidationEvidenceCandidates(candidates, gate);
}

function isSnapshotCandidateForValidationPlan(
  snapshot: WorkspaceSnapshotSummary,
  plan: ValidationPlan,
  gate: ValidationGate
): boolean {
  if (gate.kind !== "workspace-snapshot" || snapshot.projectId !== plan.projectId) {
    return false;
  }

  return snapshot.createdAt >= plan.updatedAt;
}

function isProofCheckCandidateForValidationPlan(
  proof: ReviewLeanProofCheckSummary,
  plan: ValidationPlan,
  gate: ValidationGate
): boolean {
  if (gate.kind !== "proof" || proof.status !== "accepted" || proof.trust !== "proved" || !proof.proofCheckerBacked) {
    return false;
  }
  if (proof.scope?.statement && equivalentRouteProblems(proof.scope.statement, plan.claim)) {
    return true;
  }
  const concreteCommand = concreteValidationGateProofCommand(plan);
  if (!concreteCommand || !concreteCommand.startsWith("truth-harness proof check ")) {
    return false;
  }
  const expectedPath = commandArgumentAfterPrefix(concreteCommand, "truth-harness proof check");
  if (!expectedPath || toPortablePath(proof.sourcePath) !== toPortablePath(expectedPath)) {
    return false;
  }
  const expectedDeclaration = commandOptionValue(concreteCommand, "--declaration");
  return !expectedDeclaration || proof.declarationName === expectedDeclaration;
}

function isSmtCheckCandidateForValidationPlan(
  smt: SmtCheckSummary,
  plan: ValidationPlan,
  gate: ValidationGate
): boolean {
  if (gate.kind !== "proof" || smt.trust !== "smt-checked") {
    return false;
  }
  const scopedClaim = smt.queryName ? `SMT query ${smt.queryName}` : undefined;
  if (scopedClaim && equivalentRouteProblems(scopedClaim, plan.claim)) {
    return true;
  }
  const concreteCommand = concreteValidationGateProofCommand(plan);
  if (!concreteCommand || !concreteCommand.startsWith("truth-harness smt check ")) {
    return false;
  }
  const expectedPath = commandArgumentAfterPrefix(concreteCommand, "truth-harness smt check");
  if (!expectedPath || toPortablePath(smt.sourcePath) !== toPortablePath(expectedPath)) {
    return false;
  }
  const expectedQuery = commandOptionValue(concreteCommand, "--query");
  return !expectedQuery || smt.queryName === expectedQuery;
}

function rankValidationEvidenceCandidates(
  candidates: ValidationEvidenceRef[],
  gate: ValidationGate
): ValidationEvidenceRef[] {
  return candidates
    .map((ref, index) => ({ ref, index }))
    .sort((left, right) => {
      const trust = validationEvidenceTrustRank(right.ref) - validationEvidenceTrustRank(left.ref);
      if (trust !== 0) {
        return trust;
      }

      const kind = validationEvidenceKindRank(right.ref, gate) - validationEvidenceKindRank(left.ref, gate);
      if (kind !== 0) {
        return kind;
      }

      return left.index - right.index;
    })
    .map((candidate) => candidate.ref);
}

function validationEvidenceTrustRank(ref: ValidationEvidenceRef): number {
  switch (ref.trust) {
    case "refuted":
      return 100;
    case "proved":
      return 95;
    case "cross-checked":
      return 90;
    case "smt-checked":
      return 85;
    case "exact-computed":
      return 80;
    case "dimension-checked":
      return 75;
    case "source-cited":
      return 70;
    case "bounded-numeric":
      return 65;
    case "unverified":
      return 10;
    default:
      return 0;
  }
}

function validationEvidenceKindRank(ref: ValidationEvidenceRef, gate: ValidationGate): number {
  if (gate.kind === "proof") {
    if (ref.kind === "proof") {
      return 50;
    }
    if (ref.kind === "smt") {
      return 45;
    }
    if (ref.kind === "cas") {
      return 40;
    }
    if (ref.kind === "route") {
      return 35;
    }
    if (ref.kind === "receipt") {
      return 30;
    }
  }
  if (gate.kind === "source-citation" || gate.kind === "literature-record" || gate.kind === "prior-art") {
    if (ref.kind === "source" || ref.kind === "literature") {
      return 50;
    }
    if (ref.kind === "review" || ref.kind === "audit") {
      return 40;
    }
  }
  if (gate.kind === "expert-review" || gate.kind === "wet-lab" || gate.kind === "preclinical" || gate.kind === "clinical" || gate.kind === "safety" || gate.kind === "ethics" || gate.kind === "regulatory" || gate.kind === "patent-legal") {
    if (ref.kind === "review") {
      return 50;
    }
    if (ref.kind === "source" || ref.kind === "literature") {
      return 35;
    }
  }

  return 10;
}

function isEvidenceCandidateForValidationGate(ref: ValidationEvidenceRef, gate: ValidationGate): boolean {
  if (gate.kind === "proof") {
    return ref.kind === "proof" || ref.kind === "smt" || ref.kind === "cas" || ref.kind === "route" || ref.kind === "receipt";
  }
  if (gate.kind === "source-citation" || gate.kind === "literature-record" || gate.kind === "prior-art") {
    return ref.kind === "source" || ref.kind === "literature" || ref.kind === "review" || ref.kind === "audit";
  }
  if (gate.kind === "benchmark") {
    return ref.kind === "benchmark";
  }
  if (gate.kind === "notebook-run") {
    return ref.kind === "notebook-run" || ref.kind === "notebook";
  }
  if (gate.kind === "code-run") {
    return ref.kind === "code-run" || ref.kind === "benchmark";
  }
  if (gate.kind === "simulation-log" || gate.kind === "simulation-review") {
    return ref.kind === "simulation" || ref.kind === "review";
  }
  if (gate.kind === "experiment-record" || gate.kind === "experiment-replication") {
    return ref.kind === "experiment" || ref.kind === "review";
  }
  if (gate.kind === "expert-review" || gate.kind === "wet-lab" || gate.kind === "preclinical" || gate.kind === "clinical" || gate.kind === "safety" || gate.kind === "ethics" || gate.kind === "regulatory" || gate.kind === "patent-legal") {
    return ref.kind === "review" || ref.kind === "source" || ref.kind === "literature";
  }
  if (gate.kind === "claim-chart") {
    return ref.kind === "claim-chart" || ref.kind === "invention";
  }
  if (gate.kind === "workspace-snapshot") {
    return ref.kind === "snapshot";
  }
  if (gate.kind === "replay") {
    return ref.kind === "snapshot" || ref.kind === "receipt" || ref.kind === "route";
  }

  return ref.kind !== "session" && ref.kind !== "validation";
}

function toValidationEvidenceRef(ref: ResearchEvidenceRef): ValidationEvidenceRef | undefined {
  if (!isValidationEvidenceKind(ref.kind)) {
    return undefined;
  }

  return {
    kind: ref.kind,
    ref: ref.ref,
    trust: ref.trust,
    summary: ref.summary
  };
}

function isValidationEvidenceKind(value: string): value is ValidationEvidenceRef["kind"] {
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

function validationEvidenceKey(ref: ValidationEvidenceRef): string {
  return `${ref.kind}:${ref.ref}`;
}

function commandForValidationGate(
  workspacePath: string,
  session: ResearchSession,
  plan: ValidationPlan,
  gate: ValidationGate,
  candidateEvidenceRefs: ValidationEvidenceRef[] = []
): string {
  const candidate = candidateEvidenceRefs[0];
  if (candidate) {
    return validationGateAttachCommandForEvidence(plan.planId, gate.gateId, candidate);
  }

  if (gate.kind === "proof") {
    const concreteVerifierCommand = concreteValidationGateProofCommand(plan, workspacePath);
    if (concreteVerifierCommand) {
      return concreteVerifierCommand;
    }

    const escalationCommand = commandForAttachedValidationGate(gate);
    if (escalationCommand) {
      return escalationCommand;
    }

    return `truth-harness verify ${quoteCommandArg(plan.claim)} --write --workspace ${quoteCommandArg(workspacePath)} --json`;
  }

  if (gate.kind === "source-citation" || gate.kind === "prior-art") {
    return `truth-harness source search ${quoteCommandArg(plan.claim)} --workspace ${quoteCommandArg(workspacePath)} --json`;
  }

  if (gate.kind === "benchmark") {
    return `truth-harness bench run packages/benchmarks/suites/foundations-seed.json --write --workspace ${quoteCommandArg(workspacePath)} --json`;
  }

  if (gate.kind === "workspace-snapshot") {
    return `truth-harness workspace snapshot ${quoteCommandArg(workspacePath)} --json`;
  }

  return `truth-harness research show ${quoteCommandArg(session.sessionId)} --workspace ${quoteCommandArg(workspacePath)} --json`;
}

function commandForAttachedValidationGate(gate: ValidationGate): string | undefined {
  if (gate.kind !== "proof" || gate.evidenceRefs.length === 0 || gate.status !== "in-progress") {
    return undefined;
  }

  for (const nextCheck of gate.nextChecks) {
    const normalized = nextCheck.toLowerCase();
    if (/\bsage\b|sagemath/u.test(normalized)) {
      return "npm run docker:sage";
    }
    if (/\blean\b|proof checker|proof-checker|proof project/u.test(normalized)) {
      return "docker compose run --rm lean-proof";
    }
    if (/\bmaxima\b|\bcas\b|\bz3\b|\bcvc5\b|\bsmt\b|solver|docker-derived/u.test(normalized)) {
      return "npm run docker:engines";
    }
  }

  return undefined;
}

function concreteValidationGateProofCommand(plan: ValidationPlan, workspacePath?: string): string | undefined {
  const claim = plan.claim.trim();
  const normalized = claim.toLowerCase().replace(/\s+/gu, " ");

  if (isBoundedIntegerSolutionSetClaim(normalized) || isUniversalParityClaim(normalized)) {
    const workspaceArgs = workspacePath ? ` --workspace ${quoteCommandArg(workspacePath)}` : "";
    return `truth-harness verify ${quoteCommandArg(claim)} --write${workspaceArgs} --json`;
  }

  if (normalized === "smt query bounded_integer_sat") {
    return "truth-harness smt check docs/examples/constraints.smt2 --query bounded_integer_sat --write";
  }

  if (normalized === "symbolic simplify sin(x)^2 + cos(x)^2") {
    return 'truth-harness cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write';
  }

  if (normalized.includes("lean fixture theorem") && normalized.includes("smoke : true")) {
    return `truth-harness proof check docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean --declaration smoke --statement ${quoteCommandArg(claim)} --write`;
  }

  return undefined;
}

function isBoundedIntegerSolutionSetClaim(normalizedClaim: string): boolean {
  return /^(?:the\s+)?integer constraints [a-z]\s*(?:<=|>=|<|>|=)\s*-?\d+\s+and\s+[a-z]\s*(?:<=|>=|<|>|=)\s*-?\d+\s+have exactly (?:the )?solutions? [a-z]\s*=\s*-?\d+(?:\s*(?:,|and)\s*[a-z]\s*=\s*-?\d+)*\.?$/iu.test(
    normalizedClaim
  );
}

function isUniversalParityClaim(normalizedClaim: string): boolean {
  return /^for (?:all|every) integers? n,?\s+.+\s+is\s+(?:even|odd)\.?$/iu.test(normalizedClaim);
}

function routeReviewItems(
  workspacePath: string,
  route: VerifierRoute,
  claimsByRouteRef: Map<string, ClaimLedgerRecord[]>,
  claimsByStatementKey: Map<string, ClaimLedgerRecord[]>,
  leanInspection: LeanProjectInspection,
  proofChecks: ReviewLeanProofCheckSummary[]
): WorkspaceReviewItem[] {
  const readiness = verifierRouteReadiness(route);
  const openObligations = (route.proofObligations ?? []).filter((obligation) => obligation.status === "open");
  const items = openObligations.map((obligation) =>
    routeObligationItem(workspacePath, route, obligation, leanInspection, proofChecks)
  );
  const hasClaim = (claimsByRouteRef.get(route.routeId)?.length ?? 0) > 0;

  if (readiness.readyForNarrowClaim && !hasClaim) {
    const equivalentClaim = firstEquivalentClaim(route.problem, claimsByStatementKey);
    const claimDomain = claimDomainForVerifierRoute(route);
    const command = equivalentClaim
      ? `truth-harness claim review ${quoteCommandArg(equivalentClaim.claimId)} --workspace ${quoteCommandArg(workspacePath)} --json`
      : `truth-harness claim add ${quoteCommandArg(route.problem)} --workspace ${quoteCommandArg(workspacePath)} --domain ${quoteCommandArg(claimDomain)} --evidence ${quoteCommandArg(`route:${route.routeId}`)} --trust ${quoteCommandArg(readiness.strongestTrust)} --json`;

    items.push({
      itemId: itemIdFor({
        kind: "route-ready-claim",
        routeId: route.routeId,
        claimId: equivalentClaim?.claimId
      }),
      kind: "route-ready-claim",
      priority: "low",
      title: equivalentClaim ? "Link ready route to an existing claim" : "Record a narrow claim from a ready route",
      summary: equivalentClaim
        ? `Verifier route ${route.routeId} is ready as ${readiness.strongestTrust}; equivalent claim ${equivalentClaim.claimId} exists but does not cite this route yet. Review or supersede it instead of creating a duplicate claim.`
        : `Verifier route ${route.routeId} is ready only as a narrow ${readiness.strongestTrust} claim, but no claim ledger record cites it yet.`,
      command,
      routeId: route.routeId,
      claimId: equivalentClaim?.claimId,
      domain: claimDomain,
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

function claimDomainForVerifierRoute(route: VerifierRoute): ClaimLedgerDomain {
  switch (route.evidenceKind) {
    case "exact-arithmetic":
    case "universal-parity":
    case "symbolic-cas":
    case "interval-bound":
      return "math";
    case "dimension-analysis":
      return "physics";
    case "source-citation":
      return "sources";
    case "unsupported":
      return route.finalTrust === "smt-checked" ? "math" : "general";
    default:
      return "general";
  }
}

function staleEquivalentVerifierRouteIds(routes: VerifierRoute[]): Set<string> {
  const staleRouteIds = new Set<string>();

  for (const candidate of routes) {
    for (const other of routes) {
      if (candidate.routeId === other.routeId || staleRouteIds.has(candidate.routeId)) {
        continue;
      }

      if (equivalentRouteProblems(candidate.problem, other.problem) && routeSupersedesForReview(other, candidate)) {
        staleRouteIds.add(candidate.routeId);
      }
    }
  }

  return staleRouteIds;
}

function readyRoutesByReviewStatementKey(routes: VerifierRoute[]): Map<string, VerifierRoute> {
  const map = new Map<string, VerifierRoute>();

  for (const route of routes) {
    const readiness = verifierRouteReadiness(route);
    if (!readiness.readyForNarrowClaim) {
      continue;
    }

    for (const key of reviewStatementKeys(route.problem)) {
      const existing = map.get(key);
      if (!existing || routeSupersedesForReview(route, existing)) {
        map.set(key, route);
      }
    }
  }

  return map;
}

function equivalentRouteProblems(left: string, right: string): boolean {
  const leftKeys = new Set(reviewStatementKeys(left));
  return reviewStatementKeys(right).some((key) => leftKeys.has(key));
}

function routeSupersedesForReview(candidate: VerifierRoute, stale: VerifierRoute): boolean {
  const readiness = verifierRouteReadiness(candidate);
  if (!readiness.readyForNarrowClaim) {
    return false;
  }

  const candidateRank = reviewTrustRank(readiness.strongestTrust);
  const staleRank = reviewTrustRank(stale.finalTrust);

  return candidateRank > staleRank || (candidateRank === staleRank && candidate.createdAt.localeCompare(stale.createdAt) > 0);
}

function routeObligationItem(
  workspacePath: string,
  route: VerifierRoute,
  obligation: ProofObligation,
  leanInspection: LeanProjectInspection,
  proofChecks: ReviewLeanProofCheckSummary[]
): WorkspaceReviewItem {
  const proofAttemptHistory = scopedProofAttemptHistoryForRouteObligation(route, obligation, proofChecks);
  const latestProofAttempt = proofAttemptHistory[0];
  const proofDeclaration = latestProofAttempt
    ? latestProofAttempt.declaration
    : concreteLeanDeclarationForRouteObligation(route, obligation, leanInspection);
  const proofAttemptHistorySummary =
    proofAttemptHistory.length > 1
      ? ` ${proofAttemptHistory.length} scoped Lean attempts are recorded for this route obligation; inspect the history before making another repair.`
      : "";
  const command = commandForRouteObligation(workspacePath, route, obligation, leanInspection, latestProofAttempt);
  const proofAttemptSummary = latestProofAttempt
    ? ` Latest scoped Lean attempt ${latestProofAttempt.checkId} is ${latestProofAttempt.status} for ${latestProofAttempt.sourcePath}; repair that artifact before rerunning the proof check.${proofAttemptSourceStatusSummary(latestProofAttempt)}${latestProofAttempt.diagnosticSnippet ? ` Diagnostic: ${latestProofAttempt.diagnosticSnippet}` : ""}`
    : "";
  return {
    itemId: itemIdFor({
      kind: "route-obligation",
      routeId: route.routeId,
      obligationId: obligation.obligationId
    }),
    kind: "route-obligation",
    priority: priorityForRouteObligation(route, obligation, command),
    title: obligation.title,
    summary: `${route.problem} - ${obligation.requiredBefore}${proofAttemptSummary}${proofAttemptHistorySummary}`,
    command,
    routeId: route.routeId,
    obligationId: obligation.obligationId,
    obligationKind: obligation.kind,
    ...(proofDeclaration ? { proofDeclaration: workspaceReviewProofDeclaration(proofDeclaration) } : {}),
    ...(latestProofAttempt ? { proofAttempt: workspaceReviewProofAttempt(latestProofAttempt) } : {}),
    ...(proofAttemptHistory.length > 0
      ? { proofAttemptHistory: proofAttemptHistory.map((proof) => workspaceReviewProofAttempt(proof)) }
      : {}),
    trust: route.finalTrust,
    createdAt: route.createdAt,
    source: {
      label: "route obligation",
      ref: `${route.routeId}:${obligation.obligationId}`
    }
  };
}

function workspaceReviewProofDeclaration(declaration: WorkspaceReviewProofDeclarationSource): WorkspaceReviewProofDeclaration {
  return {
    declarationId: declaration.declarationId,
    kind: declaration.kind,
    ...(declaration.name ? { name: declaration.name } : {}),
    path: declaration.path,
    line: declaration.line,
    column: declaration.column,
    signature: declaration.signature,
    signatureSha256: declaration.signatureSha256,
    sourceSha256: declaration.sourceSha256
  };
}

function workspaceReviewProofAttempt(proof: ReviewLeanProofCheckSummary): WorkspaceReviewProofAttempt {
  return {
    checkId: proof.checkId,
    path: proof.path,
    sourcePath: proof.sourcePath,
    sourceSha256: proof.sourceSha256,
    sourceByteLength: proof.sourceByteLength,
    sourceStatus: proof.reviewSourceStatus,
    sourceCurrentSha256: proof.reviewSourceCurrentSha256,
    sourceCurrentByteLength: proof.reviewSourceCurrentByteLength,
    declarationName: proof.declarationName,
    ...(proof.declaration ? { declaration: workspaceReviewProofDeclaration(proof.declaration) } : {}),
    status: proof.status,
    trust: proof.trust,
    createdAt: proof.createdAt,
    diagnosticSnippet: proof.diagnosticSnippet
  };
}

function commandForRouteObligation(
  workspacePath: string,
  route: VerifierRoute,
  obligation: ProofObligation,
  leanInspection: LeanProjectInspection,
  latestProofAttempt: ReviewLeanProofCheckSummary | undefined
): string {
  const inspectRouteCommand = `truth-harness route show ${quoteCommandArg(route.routeId)} --workspace ${quoteCommandArg(workspacePath)} --json`;
  const concreteSmtCommand = concreteSmtCommandForRouteObligation(route, obligation);
  if (concreteSmtCommand) {
    return concreteSmtCommand;
  }

  const repairLeanCommand = proofRepairCommandForRouteObligation(route, obligation, latestProofAttempt);
  if (repairLeanCommand) {
    return repairLeanCommand;
  }

  const concreteLeanCommand = concreteLeanProofCommandForRouteObligation(route, obligation, leanInspection);
  if (concreteLeanCommand) {
    return concreteLeanCommand;
  }

  if (smtCommandNeedsConcreteSource(obligation.command)) {
    return inspectRouteCommand;
  }

  if (proofCommandNeedsConcreteSource(obligation.command)) {
    return inspectRouteCommand;
  }

  const scopedCommand = scopedProofCommand(obligation.command, route.routeId, obligation.obligationId, obligation.statement);
  if (scopedCommand) {
    return scopedCommand;
  }

  return obligation.command ?? inspectRouteCommand;
}

function scopedProofAttemptHistoryForRouteObligation(
  route: VerifierRoute,
  obligation: ProofObligation,
  proofChecks: ReviewLeanProofCheckSummary[]
): ReviewLeanProofCheckSummary[] {
  if (obligation.kind !== "formal-proof") {
    return [];
  }

  return proofChecks
    .filter((proof) =>
      proof.scope?.routeId === route.routeId &&
      proof.scope.obligationId === obligation.obligationId &&
      (proof.status === "rejected" || proof.status === "error")
    )
    .slice(0, MAX_PROOF_ATTEMPT_HISTORY);
}

function proofRepairCommandForRouteObligation(
  route: VerifierRoute,
  obligation: ProofObligation,
  proof: ReviewLeanProofCheckSummary | undefined
): string | undefined {
  if (!proof) {
    return undefined;
  }

  const declarationArg = proof.declarationName ? ` --declaration ${quoteCommandArg(proof.declarationName)}` : "";
  const baseCommand = `truth-harness proof check ${quoteCommandArg(proof.sourcePath)}${declarationArg} --write`;
  return scopedProofCommand(baseCommand, route.routeId, obligation.obligationId, proof.scope?.statement ?? obligation.statement);
}

async function enrichProofChecksWithSourceStatus(
  rootPath: string,
  proofChecks: LeanProofCheckSummary[]
): Promise<ReviewLeanProofCheckSummary[]> {
  return Promise.all(
    proofChecks.map(async (proof): Promise<ReviewLeanProofCheckSummary> => {
      if (!proof.sourceSha256) {
        return { ...proof, reviewSourceStatus: "unchecked" };
      }

      let bytes: Buffer;
      try {
        bytes = await readFile(resolveUnderRoot(rootPath, proof.sourcePath));
      } catch {
        return { ...proof, reviewSourceStatus: "missing" };
      }

      const currentSha256 = createHash("sha256").update(bytes).digest("hex");
      return {
        ...proof,
        reviewSourceStatus: currentSha256 === proof.sourceSha256 ? "unchanged" : "changed",
        reviewSourceCurrentSha256: currentSha256,
        reviewSourceCurrentByteLength: bytes.byteLength
      };
    })
  );
}

function proofAttemptSourceStatusSummary(proof: ReviewLeanProofCheckSummary): string {
  if (proof.reviewSourceStatus === "unchanged") {
    return " Source unchanged since that failed attempt; edit the file before rerunning.";
  }
  if (proof.reviewSourceStatus === "changed") {
    return " Source changed since that failed attempt; rerun the scoped proof check to create fresh evidence.";
  }
  if (proof.reviewSourceStatus === "missing") {
    return " Source file is missing; restore or recreate it before rerunning.";
  }
  if (proof.reviewSourceStatus === "unchecked") {
    return " Source hash was unavailable; inspect the proof artifact before rerunning.";
  }
  return "";
}

function concreteLeanProofCommandForRouteObligation(
  route: VerifierRoute,
  obligation: ProofObligation,
  leanInspection: LeanProjectInspection
): string | undefined {
  const declaration = concreteLeanDeclarationForRouteObligation(route, obligation, leanInspection);
  if (!declaration) {
    return undefined;
  }

  const declarationArg = declaration.name ? ` --declaration ${quoteCommandArg(declaration.name)}` : "";
  const baseCommand = `truth-harness proof check ${quoteCommandArg(declaration.path)}${declarationArg} --write`;
  return scopedProofCommand(baseCommand, route.routeId, obligation.obligationId, obligation.statement);
}

function concreteLeanDeclarationForRouteObligation(
  route: VerifierRoute,
  obligation: ProofObligation,
  leanInspection: LeanProjectInspection
): LeanProjectDeclaration | undefined {
  if (obligation.kind !== "formal-proof" || !proofCommandNeedsConcreteSource(obligation.command)) {
    return undefined;
  }
  if (leanInspection.proofSafety.blocksProvedTrust) {
    return undefined;
  }

  return findLeanDeclarationForRouteObligation(route, obligation, leanInspection);
}

function findLeanDeclarationForRouteObligation(
  route: VerifierRoute,
  obligation: ProofObligation,
  leanInspection: LeanProjectInspection
): LeanProjectDeclaration | undefined {
  const targets = uniqueSorted([obligation.statement, route.problem, route.normalizedProblem]);
  return leanInspection.declarations.sample.find((declaration) =>
    declaration.kind !== "def" && targets.some((target) => leanDeclarationMatchesTarget(declaration, target))
  );
}

function leanDeclarationMatchesTarget(declaration: LeanProjectDeclaration, target: string): boolean {
  const targetText = normalizeLeanMatchText(target);
  const declarationText = normalizeLeanMatchText(
    [declaration.name, declaration.signature, declaration.snippet].filter(Boolean).join(" ")
  );
  if (!targetText || !declarationText) {
    return false;
  }

  if (targetText.length >= 6 && (declarationText.includes(targetText) || targetText.includes(declarationText))) {
    return true;
  }

  const targetTokens = significantLeanMatchTokens(targetText);
  if (targetTokens.length < 2) {
    return false;
  }

  const declarationTokens = new Set(significantLeanMatchTokens(declarationText));
  const overlap = targetTokens.filter((token) => declarationTokens.has(token)).length;
  return overlap >= Math.max(2, Math.ceil(targetTokens.length * 0.75));
}

function normalizeLeanMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/gu, "$1/$2")
    .replace(/\\operatorname\{([^{}]+)\}/gu, "$1")
    .replace(/:=.*$/u, " ")
    .replace(/[_'.]/gu, " ")
    .replace(/\\/gu, " ")
    .replace(/[{}[\],;:]/gu, " ")
    .replace(/[^a-z0-9/+*^=<>()-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function significantLeanMatchTokens(value: string): string[] {
  const stop = new Set([
    "theorem",
    "lemma",
    "example",
    "def",
    "by",
    "prop",
    "type",
    "true",
    "false"
  ]);
  return value
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stop.has(token));
}

function concreteSmtCommandForRouteObligation(route: VerifierRoute, obligation: ProofObligation): string | undefined {
  if (obligation.kind !== "solver-encoding") {
    return undefined;
  }

  const sourcePath = concreteSmtCheckSource(obligation.command) ?? siblingConcreteSmtCheckSource(route, obligation);
  if (!sourcePath) {
    return undefined;
  }

  const backend = smtBackendForObligation(obligation) ?? smtBackendFromCommand(obligation.command);
  const backendArg = backend && backend !== "z3" ? ` --backend ${quoteCommandArg(backend)}` : "";
  return `truth-harness smt check ${quoteCommandArg(sourcePath)}${backendArg} --write`;
}

function siblingConcreteSmtCheckSource(route: VerifierRoute, obligation: ProofObligation): string | undefined {
  for (const candidate of route.proofObligations ?? []) {
    if (candidate.obligationId === obligation.obligationId || candidate.kind !== "solver-encoding") {
      continue;
    }

    const sourcePath = concreteSmtCheckSource(candidate.command);
    if (sourcePath) {
      return sourcePath;
    }
  }

  return undefined;
}

function concreteSmtCheckSource(command: string | undefined): string | undefined {
  if (!command?.startsWith("truth-harness smt check ")) {
    return undefined;
  }
  if (smtCommandNeedsConcreteSource(command)) {
    return undefined;
  }

  const match = /^truth-harness\s+smt\s+check\s+((?:"(?:\\.|[^"\\])*")|(?:[^\s]+))(?:\s|$)/u.exec(command);
  if (!match?.[1]) {
    return undefined;
  }

  return unquoteCommandToken(match[1]);
}

function unquoteCommandToken(token: string): string | undefined {
  if (!token.startsWith("\"")) {
    return token;
  }

  try {
    const parsed = JSON.parse(token) as unknown;
    return typeof parsed === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function smtBackendForObligation(obligation: ProofObligation): "z3" | "cvc5" | undefined {
  if (obligation.sourceCapabilityId === "z3-smt-solver") {
    return "z3";
  }

  if (obligation.sourceCapabilityId === "cvc5-smt-solver") {
    return "cvc5";
  }

  return undefined;
}

function smtBackendFromCommand(command: string | undefined): "z3" | "cvc5" | undefined {
  const match = command?.match(/(?:^|\s)--backend(?:\s+|=)(z3|cvc5)(?:\s|$)/u);
  return match?.[1] === "z3" || match?.[1] === "cvc5" ? match[1] : undefined;
}

function smtCommandNeedsConcreteSource(command: string | undefined): boolean {
  if (!command?.startsWith("truth-harness smt check ")) {
    return false;
  }

  return command.includes("<workspace-local.smt2>") || command.includes("<");
}

function scopedProofCommand(
  command: string | undefined,
  routeId: string,
  obligationId: string,
  statement: string
): string | undefined {
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
  if (!hasCliFlag(scoped, "--statement")) {
    scoped += ` --statement ${quoteCommandArg(statement)}`;
  }
  if (!hasCliFlag(scoped, "--statement-hash")) {
    scoped += ` --statement-hash ${quoteCommandArg(verifierRouteStatementBoundaryHash(statement))}`;
  }

  return scoped;
}

function proofCommandNeedsConcreteSource(command: string | undefined): boolean {
  if (!command?.startsWith("truth-harness proof check ")) {
    return false;
  }

  return (
    command.includes("<workspace-local.lean>") ||
    /^truth-harness proof check\s+(?:"docs[\\/]examples[\\/]trivial\.lean"|docs[\\/]examples[\\/]trivial\.lean)(?:\s|$)/u.test(command)
  );
}

function hasCliFlag(command: string, flag: string): boolean {
  return new RegExp(`(?:^|\\s)${escapeRegExp(flag)}(?:\\s|=|$)`, "u").test(command);
}

function commandArgumentAfterPrefix(command: string, prefix: string): string | undefined {
  if (!command.startsWith(prefix)) {
    return undefined;
  }
  return firstShellishToken(command.slice(prefix.length).trim());
}

function commandOptionValue(command: string, option: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${escapeRegExp(option)}\\s+("([^"]+)"|'([^']+)'|(\\S+))`, "u").exec(command);
  return match?.[2] ?? match?.[3] ?? match?.[4];
}

function firstShellishToken(value: string): string | undefined {
  const match = /^(?:"([^"]+)"|'([^']+)'|(\S+))/u.exec(value.trim());
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function claimReviewItems(
  workspacePath: string,
  claim: ClaimLedgerRecord,
  supersededClaimIds: Set<string>,
  readyRoutesByStatementKey: Map<string, VerifierRoute>
): Promise<WorkspaceReviewItem[]> {
  if (claim.finalization.readyForNarrowClaim || claim.status !== "active" || supersededClaimIds.has(claim.claimId)) {
    return [];
  }

  const openChecks = claim.finalization.openChecks ?? [];
  const reviewCommand = `truth-harness claim review ${quoteCommandArg(claim.claimId)} --workspace ${quoteCommandArg(workspacePath)} --json`;
  const command = await preferredClaimBlockerCommand(workspacePath, claim, readyRoutesByStatementKey, reviewCommand);
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
      command,
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

async function preferredClaimBlockerCommand(
  workspacePath: string,
  claim: ClaimLedgerRecord,
  readyRoutesByStatementKey: Map<string, VerifierRoute>,
  fallbackCommand: string
): Promise<string> {
  const readyRoute = firstEquivalentReadyRoute(claim, readyRoutesByStatementKey);
  if (readyRoute) {
    const readiness = verifierRouteReadiness(readyRoute);
    return `truth-harness claim add ${quoteCommandArg(claim.statement)} --workspace ${quoteCommandArg(workspacePath)} --title ${quoteCommandArg(claim.title)} --domain ${quoteCommandArg(claim.domain)} --supersedes ${quoteCommandArg(claim.claimId)} --evidence ${quoteCommandArg(`route:${readyRoute.routeId}`)} --trust ${quoteCommandArg(readiness.strongestTrust)} --json`;
  }

  try {
    const packet = await createClaimReviewPacket({ rootPath: workspacePath, claimRef: claim.claimId });
    const action = packet.nextActions.find((nextAction) =>
      typeof nextAction.command === "string" && isActionableClaimReviewCommand(nextAction.command)
    );

    return action?.command ?? fallbackCommand;
  } catch {
    return fallbackCommand;
  }
}

function isActionableClaimReviewCommand(command: string): boolean {
  return writesEvidenceOrLedger(command) || /^truth-harness\s+source\s+cite\b/u.test(command);
}

function firstEquivalentReadyRoute(
  claim: ClaimLedgerRecord,
  readyRoutesByStatementKey: Map<string, VerifierRoute>
): VerifierRoute | undefined {
  for (const key of reviewStatementKeys(claim.normalizedStatement || claim.statement)) {
    const route = readyRoutesByStatementKey.get(key);
    if (route && !claim.evidenceRefs.some((ref) => ref.kind === "route" && ref.ref === route.routeId)) {
      return route;
    }
  }

  return undefined;
}

function sessionReviewItems(
  workspacePath: string,
  session: ResearchSession,
  validationPlans: ValidationPlan[]
): WorkspaceReviewItem[] {
  const command = researchSessionCommand(workspacePath, session.sessionId);
  const linkedPlans = linkedValidationPlansForSession(session, validationPlans);
  const hasLinkedValidationPlan = linkedPlans.length > 0;
  const taskItems = session.tasks
    .filter((task) => task.status !== "done")
    .filter((task) => shouldEmitSessionTask(session, task, hasLinkedValidationPlan))
    .map((task) => sessionTaskItem(command, session, task, hasLinkedValidationPlan));
  const nextCheckItems = recentSessionNextChecks(session)
    .filter(({ check }) => shouldEmitSessionNextCheck(check, linkedPlans))
    .map(({ checkpoint, check }) => sessionNextCheckItem(command, session, checkpoint, check, hasLinkedValidationPlan));

  return [...taskItems, ...nextCheckItems];
}

function shouldEmitSessionTask(
  session: ResearchSession,
  task: ResearchSessionTask,
  hasLinkedValidationPlan: boolean
): boolean {
  if (!hasLinkedValidationPlan) {
    return true;
  }
  if (task.status === "blocked" || task.status === "doing" || task.evidenceRefs.length > 0 || task.nextChecks.length > 0) {
    return true;
  }

  return !isResearchHarnessDefaultTaskTitle(task.title, session.domains);
}

function shouldEmitSessionNextCheck(check: string, linkedPlans: ValidationPlan[]): boolean {
  if (linkedPlans.length === 0) {
    return true;
  }

  return !isLinkedValidationPlanNextCheck(check);
}

function isLinkedValidationPlanNextCheck(check: string): boolean {
  const normalized = check.toLowerCase();
  return (
    /\bvalidation[- ]plan\b/u.test(normalized) ||
    /\bvalidation gates?\b/u.test(normalized) ||
    /\bblocking gates?\b/u.test(normalized) ||
    /\bgate_[a-f0-9]+\b/u.test(normalized) ||
    /\blinked validation\b/u.test(normalized)
  );
}

function reportDraftReviewItems(workspacePath: string, summary: ReportDraftSummary): WorkspaceReviewItem[] {
  if (summary.markdownVerified) {
    return [];
  }

  return [reportDraftReviewItem(workspacePath, summary)];
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

function sessionTaskItem(
  command: string,
  session: ResearchSession,
  task: ResearchSessionTask,
  hasLinkedValidationPlan: boolean
): WorkspaceReviewItem {
  return {
    itemId: itemIdFor({
      kind: "session-task",
      sessionId: session.sessionId,
      taskId: task.taskId,
      updatedAt: session.updatedAt
    }),
    kind: "session-task",
    priority: priorityForSessionTask(task, hasLinkedValidationPlan),
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
  check: string,
  hasLinkedValidationPlan: boolean
): WorkspaceReviewItem {
  return {
    itemId: itemIdFor({
      kind: "session-next-check",
      sessionId: session.sessionId,
      checkpointId: checkpoint.checkpointId,
      check
    }),
    kind: "session-next-check",
    priority: hasLinkedValidationPlan ? "low" : "medium",
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
  const latestCheckpoint = [...session.checkpoints].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )[0];

  return latestCheckpoint
    ? latestCheckpoint.nextChecks.map((check) => ({ checkpoint: latestCheckpoint, check })).slice(0, 20)
    : [];
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

function claimsByReviewStatementKey(claims: ClaimLedgerRecord[]): Map<string, ClaimLedgerRecord[]> {
  const map = new Map<string, ClaimLedgerRecord[]>();
  const supersededClaimIds = supersededClaimIdSet(claims);
  for (const claim of claims) {
    if (claim.status !== "active" || supersededClaimIds.has(claim.claimId)) {
      continue;
    }

    const claimKeys = [
      ...reviewStatementKeys(claim.normalizedStatement || claim.statement),
      ...reviewStatementKeys(claim.title)
    ];

    for (const key of uniqueSorted(claimKeys)) {
      const bucket = map.get(key) ?? [];
      bucket.push(claim);
      map.set(key, bucket);
    }
  }

  return map;
}

function supersededClaimIdSet(claims: ClaimLedgerRecord[]): Set<string> {
  return new Set(claims.flatMap((claim) => claim.supersedes ?? []));
}

function firstEquivalentClaim(routeProblem: string, claimsByStatementKey: Map<string, ClaimLedgerRecord[]>): ClaimLedgerRecord | undefined {
  for (const key of reviewStatementKeys(routeProblem)) {
    const claim = claimsByStatementKey.get(key)?.[0];
    if (claim) {
      return claim;
    }
  }

  return undefined;
}

function reviewStatementKeys(value: string): string[] {
  const normalized = value.replace(/\s+/gu, " ").trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const latexReadable = normalized
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/gu, "$1/$2")
    .replace(/\\operatorname\{([^{}]+)\}/gu, "$1")
    .replace(/\\[,;:! ]/gu, " ")
    .replace(/\\/gu, " ");
  const candidates = uniqueSorted([normalized, latexReadable]).flatMap((candidate) => {
    const withoutComputePrefix = candidate.replace(/^(?:compute|calculate|evaluate)\s+/u, "");

    return [
      candidate,
      withoutComputePrefix,
      withoutComputePrefix.split(/\s*=\s*/u)[0] ?? withoutComputePrefix
    ];
  });

  return uniqueSorted(candidates.flatMap((candidate) => {
    const compactOperators = candidate
      .replace(/\s*([+\-*/^=(),<>])\s*/gu, "$1")
      .replace(/\s+/gu, " ")
      .trim();

    return [candidate.trim(), compactOperators].filter(Boolean);
  }));
}

function reviewTrustRank(value: TrustLabel): number {
  switch (value) {
    case "refuted":
      return 100;
    case "proved":
      return 90;
    case "cross-checked":
      return 80;
    case "smt-checked":
      return 70;
    case "dimension-checked":
      return 60;
    case "exact-computed":
      return 50;
    case "bounded-numeric":
      return 40;
    case "source-cited":
      return 30;
    case "unverified":
      return 0;
  }
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
    leanProofSafetyItems: input.items.filter(isLeanProofSafetyItem).length,
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
  const actionableItems = items.filter((item) => isAutonomyActionableItem(item));
  const nextItem = actionableItems[0];
  const highStakeItems = items.filter((item) => itemRequiresHumanReview(item));
  const mode: WorkspaceReviewAutonomyMode = highStakeItems.length > 0
    ? "human-review-gated"
    : actionableItems.length > 0 ? "local-verifier-loop" : "idle";
  const artifactItems = actionableItems.length > 0 ? actionableItems : items;
  const requiredArtifacts = uniqueSorted(
    artifactItems
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
    canRunUnattended: actionableItems.length > 0,
    suggestedBatchSize: Math.min(3, actionableItems.length),
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

function isAutonomyActionableItem(item: WorkspaceReviewItem): boolean {
  return !isPassiveInspectionCommand(item.command);
}

function isPassiveRouteInspectionItem(item: WorkspaceReviewItem): boolean {
  return item.kind === "route-obligation" && isPassiveInspectionCommand(item.command);
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

function priorityForRouteObligation(route: VerifierRoute, obligation: ProofObligation, command: string): WorkspaceReviewPriority {
  if (isPassiveInspectionCommand(command)) {
    return "low";
  }

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
  if (gate.status === "blocked") {
    return gate.blocking ? "critical" : "high";
  }

  if (gate.kind === "proof") {
    if (gate.evidenceRefs.length > 0 && (gate.status === "planned" || gate.status === "in-progress")) {
      return "low";
    }

    return gate.blocking ? "critical" : "high";
  }

  if (gate.blocking) {
    return "high";
  }

  if (gate.kind === "workspace-snapshot") {
    return "low";
  }

  if (gate.status === "missing" || gate.status === "planned") {
    return "medium";
  }

  return "low";
}

function priorityForSessionTask(task: ResearchSessionTask, hasLinkedValidationPlan = false): WorkspaceReviewPriority {
  if (task.status === "blocked" || task.status === "doing") {
    return "high";
  }

  if (hasLinkedValidationPlan) {
    return "low";
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
    "route-obligation": 0,
    "validation-gate": 1,
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

    const actionability = actionabilityRank(left) - actionabilityRank(right);
    if (actionability !== 0) {
      return actionability;
    }

    const kind = kindRank[left.kind] - kindRank[right.kind];
    if (kind !== 0) {
      return kind;
    }

    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}

function actionabilityRank(item: WorkspaceReviewItem): number {
  if (writesEvidenceOrLedger(item.command)) {
    return 0;
  }
  if (isPassiveInspectionCommand(item.command)) {
    return 2;
  }
  return 1;
}

function writesEvidenceOrLedger(command: string): boolean {
  return (
    (/^truth-harness\s+verify\b/u.test(command) && hasCliFlag(command, "--write")) ||
    (/^truth-harness\s+(?:smt|cas|proof)\s+check\b/u.test(command) && hasCliFlag(command, "--write")) ||
    /^truth-harness\s+validation\s+attach\b/u.test(command) ||
    /^truth-harness\s+claim\s+add\b/u.test(command)
  );
}

function isPassiveInspectionCommand(command: string): boolean {
  return /^truth-harness\s+(?:route show|claim review|cas backends|smt backends|proof backends|research show|workspace report)\b/u.test(command);
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
        attachCommand: validationGateAttachCommand(item),
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
    const hasExistingEquivalentClaim = Boolean(item.claimId);

    return [
      {
        slotId: "claim-ledger-record",
        label: hasExistingEquivalentClaim ? "Claim ledger link" : "Claim ledger record",
        required: true,
        status: "open",
        description: hasExistingEquivalentClaim
          ? "An existing equivalent claim should be reviewed and linked to this route, or superseded without upgrading its trust label."
          : "A narrow local claim must cite the ready verifier route without upgrading its trust label.",
        acceptedArtifacts: hasExistingEquivalentClaim
          ? ["truth-harness claim review", "truth-harness claim add --supersedes", ".truth-harness/claims/*.json"]
          : ["truth-harness claim add", ".truth-harness/claims/*.json"],
        suggestedCommand: item.command,
        attachTo: {
          routeId: item.routeId,
          claimId: item.claimId
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

function isLeanProofSafetyItem(item: WorkspaceReviewItem): boolean {
  return item.kind === "route-obligation" && item.source.label === "Lean proof safety";
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
  if (isLeanProofSafetyItem(item)) {
    const declarationInstruction = workspaceReviewProofDeclarationInstruction(item);
    const repairTargetInstruction = item.proofRepairTarget
      ? `Repair target ${item.proofRepairTarget.repairTargetId} requires source sha256 ${item.proofRepairTarget.sourceSha256}; after editing, run ${item.proofRepairTarget.afterEditCommands[0]}.`
      : undefined;
    return {
      slotId: "lean-proof-safety-clearance",
      label: "Lean proof marker clearance",
      required: true,
      status: "open",
      description: [
        "Close this only by editing the workspace-local Lean source so the blocking marker is gone, then rerunning the project scan and proof check.",
        declarationInstruction,
        repairTargetInstruction
      ].filter((value): value is string => Boolean(value)).join(" "),
      acceptedArtifacts: [
        "workspace-local .lean source without the named marker",
        "truth-harness proof project <project> --json with zero blocking markers for the affected source",
        "truth-harness proof check <file> --write"
      ],
      suggestedCommand: item.command
    };
  }

  const attachTo = {
    routeId: item.routeId,
    obligationId: item.obligationId
  };

  if (item.obligationKind === "formal-proof") {
    if (isScopedLeanProofRepairItem(item)) {
      const sourceInstruction = proofRepairSourceInstruction(item);
      return {
        slotId: "lean-proof-repair",
        label: "Lean proof repair artifact",
        required: true,
        status: "open",
        description: [
          "Repair the same workspace-local Lean file from the failed scoped attempt, rerun the suggested proof check until Lean accepts it, then attach that accepted proof-check record to this exact route obligation.",
          sourceInstruction
        ].filter((value): value is string => Boolean(value)).join(" "),
        acceptedArtifacts: [
          "edited workspace-local .lean source",
          "accepted truth-harness proof check --route <route_id> --obligation <obl_id>",
          ".truth-harness/proofs/*.json with status accepted"
        ],
        suggestedCommand: item.command,
        attachCommand: routeObligationAttachCommand(item, "proof:<proof-check-id-or-path>"),
        attachTo
      };
    }

    return {
      slotId: "accepted-proof-check",
      label: "Accepted proof-check artifact",
      required: true,
      status: "open",
      description: "Close this only with an accepted proof-checking backend record scoped to this exact route obligation.",
      acceptedArtifacts: ["truth-harness proof check --route <route_id> --obligation <obl_id>", ".truth-harness/proofs/*.json"],
      suggestedCommand: item.command,
      attachCommand: routeObligationAttachCommand(item, "proof:<proof-check-id-or-path>"),
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
      attachCommand: routeObligationAttachCommand(item, "smt:<smt-check-id-or-path>"),
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
      attachCommand: routeObligationAttachCommand(item, "<kind>:<evidence-id-or-path>"),
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
    attachCommand: routeObligationAttachCommand(item, "<kind>:<evidence-id-or-path>"),
    attachTo
  };
}

function isScopedLeanProofRepairItem(item: WorkspaceReviewItem): boolean {
  return (
    item.kind === "route-obligation" &&
    item.obligationKind === "formal-proof" &&
    /^truth-harness\s+proof\s+check\b/u.test(item.command) &&
    /\bLatest scoped Lean attempt\b/u.test(item.summary)
  );
}

function proofRepairSourceInstruction(item: WorkspaceReviewItem): string | undefined {
  switch (item.proofAttempt?.sourceStatus) {
    case "unchanged":
      return "The source is unchanged since the failed attempt; edit it before rerunning Lean.";
    case "changed":
      return "The source changed since the failed attempt; rerun the scoped proof check to write fresh evidence.";
    case "missing":
      return "The recorded source file is missing; restore or recreate it before running Lean.";
    case "unchecked":
      return "The source status is unchecked; inspect the proof artifact and source before rerunning Lean.";
    default:
      return undefined;
  }
}

function workspaceReviewProofDeclarationInstruction(item: WorkspaceReviewItem): string | undefined {
  const declaration = item.proofDeclaration;
  if (!declaration) {
    return undefined;
  }

  const name = declaration.name ? `${declaration.kind} ${declaration.name}` : declaration.kind;
  return `Target declaration: ${name} (${declaration.declarationId}) at ${declaration.path}:${declaration.line}:${declaration.column}, signature sha256 ${declaration.signatureSha256}.`;
}

function routeObligationAttachCommand(item: WorkspaceReviewItem, evidencePlaceholder: string): string | undefined {
  if (!item.routeId || !item.obligationId) {
    return undefined;
  }

  return `truth-harness route satisfy ${quoteCommandArg(item.routeId)} ${quoteCommandArg(item.obligationId)} --evidence ${quoteCommandArg(evidencePlaceholder)} --json`;
}

function workspaceReviewAcceptanceCriteria(item: WorkspaceReviewItem): string[] {
  const criteria: string[] = [];

  if (isLeanProofSafetyItem(item)) {
    const declarationCriterion = workspaceReviewProofDeclarationCriterion(item);
    const repairTargetCriterion = item.proofRepairTarget
      ? `Resolve repair target ${item.proofRepairTarget.repairTargetId} in ${item.proofRepairTarget.sourcePath}; preserve or explain any source/declaration hash change.`
      : undefined;
    criteria.push(
      "Open the named Lean source and replace the proof placeholder or local unchecked assumption with real proof structure, a reviewed import, or a narrower theorem.",
      ...(declarationCriterion ? [declarationCriterion] : []),
      ...(repairTargetCriterion ? [repairTargetCriterion] : []),
      "Rerun the exact proof project scan command and confirm the named marker no longer appears.",
      "Only after the marker is gone, run a scoped `truth-harness proof check <file> --write` before using the source as proof evidence."
    );
  } else if (isScopedLeanProofRepairItem(item)) {
    const sourceCriterion = proofRepairSourceCriterion(item);
    if (sourceCriterion) {
      criteria.push(sourceCriterion);
    }
    criteria.push(
      "Review the scoped Lean attempt history before editing so the next repair does not repeat an earlier failed approach.",
      "Edit the same Lean source named in the suggested command; do not start a disconnected proof attempt.",
      "Use the diagnostic preview as a repair hint, but rerun Lean before trusting the fix.",
      "Close this only after an accepted proof-check record is attached to the exact route and obligation."
    );
  } else if (item.kind === "route-obligation") {
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
    if (item.claimId) {
      criteria.push(
        "Review the existing equivalent claim and link or supersede it with this ready route.",
        "Do not create a duplicate claim for the same scoped statement.",
        "Use the route's strongest trust label without upgrading it."
      );
    } else {
      criteria.push(
        "Record a narrow claim that cites this route as evidence.",
        "Use the route's strongest trust label without upgrading it.",
        "Leave broader claims open until independent obligations are satisfied."
      );
    }
  } else if (item.kind === "claim-blocker") {
    if (/^truth-harness\s+claim\s+add\b/u.test(item.command) && hasCliFlag(item.command, "--supersedes")) {
      criteria.push(
        "Write a superseding claim that cites the ready route or evidence artifact.",
        "Keep the new claim scoped to the attached evidence and trust label.",
        "Leave the old blocked claim superseded instead of duplicating unresolved work."
      );
    } else {
      criteria.push(
        "Run the claim review and resolve the named open check.",
        "Attach citations, receipts, routes, or expert review before finalizing.",
        "Do not finalize the claim until open blockers are represented in the ledger."
      );
    }
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

function workspaceReviewProofDeclarationCriterion(item: WorkspaceReviewItem): string | undefined {
  const declaration = item.proofDeclaration;
  if (!declaration) {
    return undefined;
  }

  const name = declaration.name ? `${declaration.kind} ${declaration.name}` : declaration.kind;
  return `Repair the enclosing ${name} with signature hash ${declaration.signatureSha256}; do not move the work to an unrelated declaration.`;
}

function proofRepairSourceCriterion(item: WorkspaceReviewItem): string | undefined {
  switch (item.proofAttempt?.sourceStatus) {
    case "unchanged":
      return "Do not rerun the proof check until the workspace-local Lean source changes from the rejected attempt hash.";
    case "changed":
      return "The Lean source has changed since the rejected attempt; rerun the suggested scoped proof check to create fresh evidence.";
    case "missing":
      return "Restore or recreate the recorded Lean source path before running the suggested proof check.";
    case "unchecked":
      return "Inspect the proof-check record and source path before rerunning because the source status could not be checked.";
    default:
      return undefined;
  }
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
    ...(item.proofDeclaration
      ? [
          `Proof declaration: ${item.proofDeclaration.declarationId} ${item.proofDeclaration.path}:${item.proofDeclaration.line}:${item.proofDeclaration.column}`,
          `Proof declaration signature: ${item.proofDeclaration.signature}`,
          `Proof declaration signature sha256:${item.proofDeclaration.signatureSha256}`
        ]
      : []),
    `Proof attempt: ${item.proofAttempt ? `${item.proofAttempt.checkId} (${item.proofAttempt.status}, ${item.proofAttempt.path})` : "n/a"}`,
    ...(item.proofAttempt?.sourceSha256
      ? [`Proof source: ${item.proofAttempt.sourcePath} sha256:${item.proofAttempt.sourceSha256}`]
      : []),
    ...(item.proofAttempt?.sourceStatus
      ? [
          `Proof source status: ${item.proofAttempt.sourceStatus}${
            item.proofAttempt.sourceCurrentSha256 ? ` (current sha256:${item.proofAttempt.sourceCurrentSha256})` : ""
          }`
        ]
      : []),
    ...(item.proofAttempt?.diagnosticSnippet ? [`Proof diagnostic: ${item.proofAttempt.diagnosticSnippet}`] : []),
    ...(item.proofAttemptHistory && item.proofAttemptHistory.length > 0
      ? [
          `Proof attempt history (${item.proofAttemptHistory.length} newest first):`,
          ...item.proofAttemptHistory.map(
            (attempt) =>
              `- ${attempt.checkId} ${attempt.status} ${attempt.sourcePath} ${attempt.sourceStatus ?? "source-unchecked"}${
                attempt.diagnosticSnippet ? ` :: ${attempt.diagnosticSnippet}` : ""
              }`
          )
        ]
      : []),
    ...(item.proofRepairTarget
      ? [
          `Proof repair target: ${item.proofRepairTarget.repairTargetId} ${item.proofRepairTarget.sourcePath}:${item.proofRepairTarget.markerLine}:${item.proofRepairTarget.markerColumn}`,
          `Proof repair source sha256:${item.proofRepairTarget.sourceSha256}`,
          ...(item.proofRepairTarget.declarationSignatureSha256
            ? [`Proof repair declaration signature sha256:${item.proofRepairTarget.declarationSignatureSha256}`]
            : []),
          `Proof repair after-edit command: ${item.proofRepairTarget.afterEditCommands[0]}`,
          `Proof repair boundary: ${item.proofRepairTarget.boundary}`
        ]
      : []),
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
        ...(slot.attachCommand ? [`  - Attach command: ${slot.attachCommand}`] : []),
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

function validationGateAttachCommand(item: WorkspaceReviewItem): string | undefined {
  if (!item.validationPlanId || !item.validationGateId) {
    return undefined;
  }

  const evidence = item.candidateEvidenceRefs?.[0];
  if (!evidence) {
    return `truth-harness validation attach ${quoteCommandArg(item.validationPlanId)} ${quoteCommandArg(item.validationGateId)} --evidence <kind:path-or-id> --json`;
  }

  return validationGateAttachCommandForEvidence(item.validationPlanId, item.validationGateId, evidence);
}

function validationGateAttachCommandForEvidence(
  validationPlanId: string,
  validationGateId: string,
  evidence: ValidationEvidenceRef
): string {
  const evidenceArg = formatValidationEvidenceArg(evidence);
  return `truth-harness validation attach ${quoteCommandArg(validationPlanId)} ${quoteCommandArg(validationGateId)} --evidence ${quoteCommandArg(evidenceArg)} --json`;
}

function formatValidationEvidenceArg(ref: ValidationEvidenceRef): string {
  return `${ref.kind}:${ref.ref}`;
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

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { listClaimRecords, type ClaimLedgerRecord } from "./claim-ledger.js";
import {
  listVerifierRoutes,
  readVerifierRoute,
  verifierRouteReadiness,
  type ProofObligation,
  type VerifierRoute
} from "./verifier-route.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";

export type WorkspaceReviewItemKind = "route-obligation" | "route-ready-claim" | "claim-blocker";
export type WorkspaceReviewPriority = "critical" | "high" | "medium" | "low";

export interface WorkspaceReviewItem {
  itemId: string;
  kind: WorkspaceReviewItemKind;
  priority: WorkspaceReviewPriority;
  title: string;
  summary: string;
  command: string;
  routeId?: string;
  obligationId?: string;
  claimId?: string;
  domain?: string;
  trust?: TrustLabel;
  createdAt?: string;
  source: {
    label: string;
    ref: string;
  };
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
    totalItems: number;
    routeObligations: number;
    readyRoutesWithoutClaims: number;
    blockedClaims: number;
    criticalItems: number;
    highItems: number;
    mediumItems: number;
    lowItems: number;
  };
  items: WorkspaceReviewItem[];
  warnings: string[];
  markdown: string;
}

export interface CreateWorkspaceReviewInput {
  rootPath: string;
  maxRoutes?: number;
  maxClaims?: number;
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
  const claimsByRouteRef = claimsByRouteEvidence(claims);
  const routes = await Promise.all(routeSummaries.map((route) => readVerifierRoute(status.root, route.routeId)));
  const items = sortReviewItems([
    ...routes.flatMap((route) => routeReviewItems(status.root, route, claimsByRouteRef)),
    ...claims.flatMap((claim) => claimReviewItems(status.root, claim))
  ]);
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
      items
    }),
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
  const findingsDir = resolve(status.root, status.manifest.directories.findings);
  await mkdir(findingsDir, { recursive: true });
  const baseName = `${review.createdAt.slice(0, 10)}-${review.reviewId}-workspace-review`;
  const jsonPath = join(findingsDir, `${baseName}.json`);
  const markdownPath = join(findingsDir, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, review.markdown, "utf8");

  return {
    review,
    jsonPath,
    markdownPath,
    markdown: review.markdown
  };
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
    `| Queue items | \`${review.summary.totalItems}\` |`,
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
  return {
    itemId: itemIdFor({
      kind: "route-obligation",
      routeId: route.routeId,
      obligationId: obligation.obligationId
    }),
    kind: "route-obligation",
    priority: priorityForRouteObligation(obligation),
    title: obligation.title,
    summary: `${route.problem} - ${obligation.requiredBefore}`,
    command: obligation.command ?? `truth-harness route show ${quoteCommandArg(route.routeId)} --workspace ${quoteCommandArg(workspacePath)} --json`,
    routeId: route.routeId,
    obligationId: obligation.obligationId,
    trust: route.finalTrust,
    createdAt: route.createdAt,
    source: {
      label: "route obligation",
      ref: `${route.routeId}:${obligation.obligationId}`
    }
  };
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
  items: WorkspaceReviewItem[];
}): WorkspaceReview["summary"] {
  return {
    routes: input.routes,
    claims: input.claims,
    totalItems: input.items.length,
    routeObligations: input.items.filter((item) => item.kind === "route-obligation").length,
    readyRoutesWithoutClaims: input.items.filter((item) => item.kind === "route-ready-claim").length,
    blockedClaims: input.items.filter((item) => item.kind === "claim-blocker").length,
    criticalItems: input.items.filter((item) => item.priority === "critical").length,
    highItems: input.items.filter((item) => item.priority === "high").length,
    mediumItems: input.items.filter((item) => item.priority === "medium").length,
    lowItems: input.items.filter((item) => item.priority === "low").length
  };
}

function priorityForRouteObligation(obligation: ProofObligation): WorkspaceReviewPriority {
  if (obligation.severity === "critical") {
    return "critical";
  }

  if (obligation.kind === "formal-proof" || obligation.kind === "solver-encoding") {
    return "high";
  }

  return obligation.severity === "warning" ? "high" : "medium";
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

function sortReviewItems(items: WorkspaceReviewItem[]): WorkspaceReviewItem[] {
  const rank: Record<WorkspaceReviewPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  };

  return [...items].sort((left, right) => {
    const priority = rank[left.priority] - rank[right.priority];
    if (priority !== 0) {
      return priority;
    }

    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}

function itemIdFor(value: unknown): string {
  return `work_${stableHash(value).slice(0, 16)}`;
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/u.test(value) ? value : JSON.stringify(value);
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/gu, "\\|").replace(/\n/gu, " ");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\*/gu, "\\*").replace(/_/gu, "\\_").replace(/`/gu, "\\`");
}

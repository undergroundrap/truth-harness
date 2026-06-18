import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { parseSymbolicCasCheckRecord } from "./cas-backend.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { validateJsonSchema } from "./json-schema-validation.js";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { parseLeanProofCheckRecord } from "./proof-backend.js";
import { parseReceiptJson } from "./receipt-validation.js";
import { parseSmtCheckRecord } from "./smt-backend.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";
import { readVerifierRoute, verifierRouteReadiness } from "./verifier-route.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

const CLAIM_SCHEMA_VERSION = "truth-harness.claim.v0" as const;
const SCHEMAS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");
let claimLedgerSchemaCache: Promise<unknown> | undefined;

export const CLAIM_LEDGER_DOMAINS = [
  "math",
  "sources",
  "code",
  "data",
  "writing",
  "physics",
  "biology",
  "chemistry",
  "finance",
  "hardware",
  "quantum",
  "security",
  "patent",
  "general"
] as const;

export const CLAIM_LEDGER_STATUSES = ["active", "superseded", "retracted"] as const;
export const CLAIM_VERIFICATION_STAGES = [
  "claim-stated",
  "exact-or-computed",
  "source-or-citation",
  "independent-check",
  "formal-proof",
  "human-review"
] as const;

export type ClaimLedgerDomain = (typeof CLAIM_LEDGER_DOMAINS)[number];
export type ClaimLedgerStatus = (typeof CLAIM_LEDGER_STATUSES)[number];
export type ClaimVerificationStage = (typeof CLAIM_VERIFICATION_STAGES)[number];
export type ClaimVerificationStageStatus = "satisfied" | "waiting" | "blocked" | "not-applicable";

export interface ClaimLedgerEvidenceRef {
  kind:
    | "claim"
    | "receipt"
    | "artifact"
    | "source"
    | "literature"
    | "notebook"
    | "notebook-run"
    | "code-run"
    | "benchmark"
    | "disclosure"
    | "simulation"
    | "experiment"
    | "vault"
    | "audit"
    | "snapshot"
    | "review"
    | "validation"
    | "model-context"
    | "cas"
    | "proof"
    | "smt"
    | "route"
    | "invention"
    | "claim-chart"
    | "discovery-package"
    | "other";
  ref: string;
  trust?: TrustLabel;
  summary?: string;
}

export interface ClaimVerificationStep {
  stage: ClaimVerificationStage;
  status: ClaimVerificationStageStatus;
  evidenceRefs: ClaimLedgerEvidenceRef[];
  summary: string;
}

export interface ClaimLedgerRecord {
  schemaVersion: typeof CLAIM_SCHEMA_VERSION;
  claimId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  statement: string;
  normalizedStatement: string;
  domain: ClaimLedgerDomain;
  status: ClaimLedgerStatus;
  trust: TrustLabel;
  tags: string[];
  dependsOn: string[];
  supersedes: string[];
  derivedBy?: string;
  authors: string[];
  evidenceRefs: ClaimLedgerEvidenceRef[];
  verification: ClaimVerificationStep[];
  finalization: {
    strongestTrust: TrustLabel;
    readyForNarrowClaim: boolean;
    openChecks: string[];
    summary: string;
  };
  privacy: PrivacyMetadata;
  warnings: string[];
  markdown: string;
}

export interface CreateClaimLedgerRecordInput {
  rootPath: string;
  title?: string;
  statement: string;
  domain?: ClaimLedgerDomain;
  status?: ClaimLedgerStatus;
  trust?: TrustLabel;
  tags?: string[];
  dependsOn?: string[];
  supersedes?: string[];
  derivedBy?: string;
  authors?: string[];
  evidenceRefs?: ClaimLedgerEvidenceRef[];
  nextChecks?: string[];
  now?: string;
}

export interface ClaimLedgerWriteResult {
  claim: ClaimLedgerRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface ClaimLedgerGraphNode {
  claimId: string;
  title: string;
  domain: ClaimLedgerDomain;
  status: ClaimLedgerStatus;
  trust: TrustLabel;
  tags: string[];
}

export interface ClaimLedgerGraphEdge {
  from: string;
  to: string;
  kind: "depends-on" | "supersedes";
}

export interface ClaimLedgerGraph {
  schemaVersion: "truth-harness.claim-graph.v0";
  nodes: ClaimLedgerGraphNode[];
  edges: ClaimLedgerGraphEdge[];
  warnings: string[];
}

export type ClaimReviewStatus = "ready" | "blocked" | "refuted" | "inactive";

export interface ClaimReviewAction {
  kind: "run-verifier-route" | "cite-sources" | "attach-proof" | "request-human-review" | "clear-finalization-check" | "record-successor";
  label: string;
  reason: string;
  command?: string;
  commandTemplate?: string;
}

export interface ClaimReviewPacket {
  schemaVersion: "truth-harness.claim-review.v0";
  claimId: string;
  title: string;
  statement: string;
  domain: ClaimLedgerDomain;
  claimStatus: ClaimLedgerStatus;
  reviewStatus: ClaimReviewStatus;
  trust: TrustLabel;
  readyForNarrowClaim: boolean;
  strongestTrust: TrustLabel;
  decision: string;
  workspacePath: string;
  claimPath: string;
  lineage: {
    dependsOn: string[];
    supersedes: string[];
    dependents: string[];
  };
  finalization: ClaimLedgerRecord["finalization"];
  blockingChecks: string[];
  verification: ClaimVerificationStep[];
  evidenceRefs: ClaimLedgerEvidenceRef[];
  nextActions: ClaimReviewAction[];
  commands: {
    showJson: string;
    reviewJson: string;
  };
  warnings: string[];
  markdown: string;
}

export function isClaimLedgerDomain(value: string): value is ClaimLedgerDomain {
  return (CLAIM_LEDGER_DOMAINS as readonly string[]).includes(value);
}

export function isClaimLedgerStatus(value: string): value is ClaimLedgerStatus {
  return (CLAIM_LEDGER_STATUSES as readonly string[]).includes(value);
}

export function createClaimLedgerGraph(claims: ClaimLedgerRecord[]): ClaimLedgerGraph {
  const ids = new Set(claims.map((claim) => claim.claimId));
  const warnings: string[] = [];
  const edges: ClaimLedgerGraphEdge[] = [];

  for (const claim of claims) {
    for (const dependency of claim.dependsOn) {
      edges.push({ from: dependency, to: claim.claimId, kind: "depends-on" });
      if (!ids.has(dependency)) {
        warnings.push(`${claim.claimId} depends on missing claim ${dependency}.`);
      }
    }

    for (const superseded of claim.supersedes) {
      edges.push({ from: superseded, to: claim.claimId, kind: "supersedes" });
      if (!ids.has(superseded)) {
        warnings.push(`${claim.claimId} supersedes missing claim ${superseded}.`);
      }
    }
  }

  return {
    schemaVersion: "truth-harness.claim-graph.v0",
    nodes: claims.map((claim) => ({
      claimId: claim.claimId,
      title: claim.title,
      domain: claim.domain,
      status: claim.status,
      trust: claim.trust,
      tags: claim.tags
    })),
    edges,
    warnings
  };
}

export async function createClaimLedgerRecord(input: CreateClaimLedgerRecordInput): Promise<ClaimLedgerRecord> {
  const status = await requireLocalWorkspace(input.rootPath);
  const existingClaims = await listClaimRecords(input.rootPath);
  const knownClaimIds = new Set(existingClaims.map((claim) => claim.claimId));
  const knownClaimsById = new Map(existingClaims.map((claim) => [claim.claimId, claim]));
  const createdAt = input.now ?? new Date().toISOString();
  const statement = requireText(input.statement, "Claim statement is required.");
  const domain = input.domain ?? inferClaimDomain(statement);
  const requestedTrust = input.trust;
  const resolvedEvidence = await resolveEvidenceRefs({
    root: status.root,
    evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs ?? []),
    knownClaimsById
  });
  const evidenceRefs = resolvedEvidence.evidenceRefs;
  const dependsOn = normalizeClaimRefs(input.dependsOn ?? [], "Claim dependency not found", knownClaimIds);
  const supersedes = normalizeClaimRefs(input.supersedes ?? [], "Superseded claim not found", knownClaimIds);
  const nextChecks = normalizeStringList(input.nextChecks ?? []);
  const evidenceTrust = strongestTrustFromTrusts(resolvedEvidence.supportingTrusts);
  const trust = effectiveClaimTrust(requestedTrust, evidenceTrust);
  const trustBoundaryChecks = trustBoundaryOpenChecks(requestedTrust, trust);
  const finalizationChecks = [...nextChecks, ...trustBoundaryChecks, ...resolvedEvidence.finalizationChecks];
  const statusValue = input.status ?? "active";
  const recordWithoutId = {
    projectId: status.manifest.projectId,
    createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromStatement(statement),
    statement,
    normalizedStatement: normalizeStatement(statement),
    domain,
    status: statusValue,
    trust,
    tags: normalizeTags(input.tags ?? []),
    dependsOn,
    supersedes,
    derivedBy: normalizeOptionalText(input.derivedBy),
    authors: normalizeStringList(input.authors ?? []),
    evidenceRefs,
    privacy: status.manifest.privacy
  };
  const claimId = `claim_${stableHash(recordWithoutId).slice(0, 16)}`;
  const baseClaim = {
    schemaVersion: CLAIM_SCHEMA_VERSION,
    claimId,
    ...recordWithoutId,
    updatedAt: createdAt,
    verification: verificationFor(trust, evidenceRefs, nextChecks),
    finalization: finalizationFor(trust, statusValue, finalizationChecks),
    warnings: warningsFor({
      statement,
      trust,
      status: statusValue,
      nextChecks: [...nextChecks, ...resolvedEvidence.finalizationChecks],
      domain,
      requestedTrust,
      evidenceTrust,
      evidenceWarnings: resolvedEvidence.warnings
    })
  };

  return {
    ...baseClaim,
    markdown: renderClaimLedgerMarkdown(baseClaim)
  };
}

export async function writeClaimLedgerRecord(input: CreateClaimLedgerRecordInput): Promise<ClaimLedgerWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const claim = await createClaimLedgerRecord(input);
  await assertClaimLedgerSchema(claim);
  const claimsDir = resolve(status.root, status.manifest.directories.claims);
  const baseName = `${claim.createdAt.slice(0, 10)}-${claim.claimId}`;
  const jsonPath = join(claimsDir, `${baseName}.json`);
  const markdownPath = join(claimsDir, `${baseName}.md`);

  await mkdir(claimsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, claim);
  await writeFileAtomic(markdownPath, claim.markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "claims",
    now: claim.createdAt,
    staleReason: "claim ledger record written"
  });

  return {
    claim,
    jsonPath,
    markdownPath,
    markdown: claim.markdown
  };
}

async function assertClaimLedgerSchema(claim: ClaimLedgerRecord): Promise<void> {
  const schema = await loadClaimLedgerSchema();
  const serializedClaim = parseJsonWithOptionalBom(JSON.stringify(claim));
  const issues = validateJsonSchema(serializedClaim, schema);
  if (issues.length === 0) {
    return;
  }

  throw new Error(
    `Claim ledger record failed JSON Schema validation before write: ${issues
      .map((issue) => `${issue.path} ${issue.message}`)
      .join("; ")}`
  );
}

function loadClaimLedgerSchema(): Promise<unknown> {
  claimLedgerSchemaCache ??= readFile(resolve(SCHEMAS_DIR, "claim-ledger.schema.json"), "utf8").then((raw) =>
    parseJsonWithOptionalBom(raw)
  );
  return claimLedgerSchemaCache;
}

export async function listClaimRecords(rootPath: string): Promise<ClaimLedgerRecord[]> {
  const status = await requireLocalWorkspace(rootPath);
  const claimsDir = resolve(status.root, status.manifest.directories.claims);

  let files: string[];
  try {
    files = await readdir(claimsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const claims = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => parseJsonWithOptionalBom(await readFile(join(claimsDir, file), "utf8")) as ClaimLedgerRecord)
  );

  return claims
    .filter((claim) => claim.schemaVersion === CLAIM_SCHEMA_VERSION)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function readClaimRecord(rootPath: string, claimRef: string): Promise<ClaimLedgerRecord> {
  const status = await requireLocalWorkspace(rootPath);
  return (await readClaimRecordRef(status, claimRef)).claim;
}

export async function createClaimReviewPacket(input: {
  rootPath: string;
  claimRef: string;
}): Promise<ClaimReviewPacket> {
  const status = await requireLocalWorkspace(input.rootPath);
  const { claim, path } = await readClaimRecordRef(status, input.claimRef);
  const allClaims = await listClaimRecords(status.root);
  const dependents = allClaims
    .filter((candidate) => candidate.dependsOn.includes(claim.claimId))
    .map((candidate) => candidate.claimId)
    .sort();
  const reviewStatus = reviewStatusForClaim(claim);
  const packetWithoutMarkdown = {
    schemaVersion: "truth-harness.claim-review.v0" as const,
    claimId: claim.claimId,
    title: claim.title,
    statement: claim.statement,
    domain: claim.domain,
    claimStatus: claim.status,
    reviewStatus,
    trust: claim.trust,
    readyForNarrowClaim: claim.finalization.readyForNarrowClaim,
    strongestTrust: claim.finalization.strongestTrust,
    decision: reviewDecisionForClaim(claim, reviewStatus),
    workspacePath: status.root,
    claimPath: path,
    lineage: {
      dependsOn: claim.dependsOn,
      supersedes: claim.supersedes,
      dependents
    },
    finalization: claim.finalization,
    blockingChecks: blockingChecksForClaim(claim),
    verification: claim.verification,
    evidenceRefs: claim.evidenceRefs,
    nextActions: claimReviewActions(claim, reviewStatus, status.root),
    commands: {
      showJson: `truth-harness claim show ${quoteCommandArg(claim.claimId)} --workspace ${quoteCommandArg(status.root)} --json`,
      reviewJson: `truth-harness claim review ${quoteCommandArg(claim.claimId)} --workspace ${quoteCommandArg(status.root)} --json`
    },
    warnings: claim.warnings
  };

  return {
    ...packetWithoutMarkdown,
    markdown: renderClaimReviewPacketMarkdown(packetWithoutMarkdown)
  };
}

export function renderClaimLedgerMarkdown(claim: Omit<ClaimLedgerRecord, "markdown">): string {
  const lines = [
    `# Claim: ${escapeMarkdownText(claim.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Claim | \`${claim.claimId}\` |`,
    `| Created | ${escapeMarkdownTable(claim.createdAt)} |`,
    `| Updated | ${escapeMarkdownTable(claim.updatedAt)} |`,
    `| Domain | \`${claim.domain}\` |`,
    `| Status | \`${claim.status}\` |`,
    `| Trust | \`${claim.trust}\` |`,
    `| Ready for narrow claim | \`${String(claim.finalization.readyForNarrowClaim)}\` |`,
    `| Privacy | \`${claim.privacy.mode}\` / network \`${claim.privacy.networkAccess}\` |`,
    "",
    "## Statement",
    "",
    escapeMarkdownText(claim.statement),
    "",
    "## Lineage",
    "",
    `- Depends on: ${claim.dependsOn.map((id) => `\`${id}\``).join(", ") || "none"}`,
    `- Supersedes: ${claim.supersedes.map((id) => `\`${id}\``).join(", ") || "none"}`,
    `- Derived by: ${escapeMarkdownText(claim.derivedBy ?? "No derivation note recorded.")}`,
    `- Tags: ${claim.tags.map((tag) => `#${tag}`).join(", ") || "none"}`,
    `- Authors: ${claim.authors.map(escapeMarkdownText).join(", ") || "not recorded"}`,
    "",
    "## Evidence Refs",
    "",
    "| Kind | Trust | Reference | Summary |",
    "| --- | --- | --- | --- |"
  ];

  if (claim.evidenceRefs.length === 0) {
    lines.push("|  |  |  | No evidence refs attached yet. |");
  } else {
    for (const ref of claim.evidenceRefs) {
      lines.push(
        [
          `\`${ref.kind}\``,
          ref.trust ? `\`${ref.trust}\`` : "",
          escapeMarkdownTable(ref.ref),
          escapeMarkdownTable(ref.summary ?? "")
        ]
          .join(" | ")
          .replace(/^/, "| ")
          .replace(/$/, " |")
      );
    }
  }

  lines.push("", "## Verification Ladder", "", "| Stage | Status | Summary | Evidence |", "| --- | --- | --- | --- |");
  for (const step of claim.verification) {
    lines.push(
      `| \`${step.stage}\` | \`${step.status}\` | ${escapeMarkdownTable(step.summary)} | ${escapeMarkdownTable(formatEvidenceRefs(step.evidenceRefs))} |`
    );
  }

  lines.push("", "## Finalization Boundary", "", escapeMarkdownText(claim.finalization.summary), "");
  if (claim.finalization.openChecks.length > 0) {
    lines.push("Open checks:");
    for (const check of claim.finalization.openChecks) {
      lines.push(`- ${escapeMarkdownText(check)}`);
    }
    lines.push("");
  }

  if (claim.warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const warning of claim.warnings) {
      lines.push(`- ${escapeMarkdownText(warning)}`);
    }
    lines.push("");
  }

  lines.push(
    "## Boundary",
    "",
    "This claim record is a local provenance and review artifact. It does not turn AI output, retrieval, simulation, or informal reasoning into truth by itself."
  );

  return `${lines.join("\n")}\n`;
}

export function renderClaimReviewPacketMarkdown(packet: Omit<ClaimReviewPacket, "markdown">): string {
  const lines = [
    `# Claim Review: ${escapeMarkdownText(packet.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Claim | \`${packet.claimId}\` |`,
    `| Review status | \`${packet.reviewStatus}\` |`,
    `| Trust | \`${packet.trust}\` |`,
    `| Ready for narrow claim | \`${String(packet.readyForNarrowClaim)}\` |`,
    `| Strongest trust | \`${packet.strongestTrust}\` |`,
    `| Domain | \`${packet.domain}\` |`,
    `| Claim status | \`${packet.claimStatus}\` |`,
    "",
    "## Decision",
    "",
    escapeMarkdownText(packet.decision),
    "",
    "## Statement",
    "",
    escapeMarkdownText(packet.statement),
    "",
    "## Blocking Checks",
    ""
  ];

  if (packet.blockingChecks.length === 0) {
    lines.push("- No blocking checks remain for the current narrow claim.", "");
  } else {
    for (const check of packet.blockingChecks) {
      lines.push(`- ${escapeMarkdownText(check)}`);
    }
    lines.push("");
  }

  lines.push("## Verification Ladder", "", "| Stage | Status | Summary | Evidence |", "| --- | --- | --- | --- |");
  for (const step of packet.verification) {
    lines.push(
      `| \`${step.stage}\` | \`${step.status}\` | ${escapeMarkdownTable(step.summary)} | ${escapeMarkdownTable(formatEvidenceRefs(step.evidenceRefs))} |`
    );
  }

  lines.push("", "## Evidence Refs", "", "| Kind | Trust | Reference | Summary |", "| --- | --- | --- | --- |");
  if (packet.evidenceRefs.length === 0) {
    lines.push("|  |  |  | No local evidence refs attached. |");
  } else {
    for (const ref of packet.evidenceRefs) {
      lines.push(
        [
          `\`${ref.kind}\``,
          ref.trust ? `\`${ref.trust}\`` : "",
          escapeMarkdownTable(ref.ref),
          escapeMarkdownTable(ref.summary ?? "")
        ]
          .join(" | ")
          .replace(/^/, "| ")
          .replace(/$/, " |")
      );
    }
  }

  lines.push("", "## Agent Next Actions", "");
  if (packet.nextActions.length === 0) {
    lines.push("- No next action required before citing the current narrow claim.", "");
  } else {
    for (const action of packet.nextActions) {
      lines.push(`- ${escapeMarkdownText(action.label)}: ${escapeMarkdownText(action.reason)}`);
      if (action.command) {
        lines.push(`  - Command: \`${action.command}\``);
      }
      if (action.commandTemplate) {
        lines.push(`  - Template: \`${action.commandTemplate}\``);
      }
    }
    lines.push("");
  }

  lines.push(
    "## Commands",
    "",
    `- Show JSON: \`${packet.commands.showJson}\``,
    `- Review JSON: \`${packet.commands.reviewJson}\``,
    "",
    "## Lineage",
    "",
    `- Depends on: ${packet.lineage.dependsOn.map((id) => `\`${id}\``).join(", ") || "none"}`,
    `- Supersedes: ${packet.lineage.supersedes.map((id) => `\`${id}\``).join(", ") || "none"}`,
    `- Dependents: ${packet.lineage.dependents.map((id) => `\`${id}\``).join(", ") || "none"}`,
    "",
    "## Warnings",
    ""
  );

  if (packet.warnings.length === 0) {
    lines.push("- No warnings recorded.");
  } else {
    for (const warning of packet.warnings) {
      lines.push(`- ${escapeMarkdownText(warning)}`);
    }
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "This review packet is a local decision aid. It does not upgrade trust, satisfy proof obligations, or make unsupported scientific, medical, finance, safety, legal, or patent claims true."
  );

  return `${lines.join("\n")}\n`;
}

async function readClaimRecordRef(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  claimRef: string
): Promise<{ claim: ClaimLedgerRecord; path: string }> {
  const ref = requireText(claimRef, "Claim ref is required.");

  if (isClaimId(ref)) {
    const claimsDir = resolve(status.root, status.manifest.directories.claims);
    const files = await readdir(claimsDir);
    for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
      const path = join(claimsDir, file);
      const claim = parseJsonWithOptionalBom(await readFile(path, "utf8")) as ClaimLedgerRecord;
      if (claim.schemaVersion === CLAIM_SCHEMA_VERSION && claim.claimId === ref) {
        return { claim, path };
      }
    }

    throw new Error(`Claim not found: ${ref}`);
  }

  const path = resolveUnderRoot(status.root, ref);
  return {
    claim: parseJsonWithOptionalBom(await readFile(path, "utf8")) as ClaimLedgerRecord,
    path
  };
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing claim ledger records.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function verificationFor(
  trust: TrustLabel,
  evidenceRefs: ClaimLedgerEvidenceRef[],
  nextChecks: string[]
): ClaimVerificationStep[] {
  return [
    {
      stage: "claim-stated",
      status: trust === "refuted" ? "blocked" : "satisfied",
      evidenceRefs: evidenceRefs.filter((ref) => ref.kind === "claim"),
      summary: "Claim wording is explicit and stored as a local ledger record."
    },
    {
      stage: "exact-or-computed",
      status: hasTrust(trust, ["exact-computed", "bounded-numeric", "dimension-checked", "smt-checked", "cross-checked", "proved"])
        ? "satisfied"
        : "waiting",
      evidenceRefs: evidenceRefs.filter((ref) =>
        hasTrust(ref.trust, ["exact-computed", "bounded-numeric", "dimension-checked", "smt-checked", "cross-checked", "proved"])
      ),
      summary: "Exact arithmetic, dimensions, bounded numeric checks, or deterministic computation backs the narrow claim."
    },
    {
      stage: "source-or-citation",
      status: hasTrust(trust, ["source-cited", "cross-checked", "proved"]) || evidenceRefs.some((ref) => ref.kind === "source" || ref.kind === "literature")
        ? "satisfied"
        : "waiting",
      evidenceRefs: evidenceRefs.filter((ref) => ref.kind === "source" || ref.kind === "literature" || ref.trust === "source-cited"),
      summary: "Relevant source, literature, or citation evidence is attached for factual claims."
    },
    {
      stage: "independent-check",
      status: hasTrust(trust, ["smt-checked", "cross-checked", "proved"]) || evidenceRefs.some((ref) => ref.kind === "cas" || ref.kind === "smt" || ref.kind === "benchmark")
        ? "satisfied"
        : "waiting",
      evidenceRefs: evidenceRefs.filter((ref) => ref.kind === "cas" || ref.kind === "smt" || ref.kind === "benchmark" || ref.trust === "smt-checked" || ref.trust === "cross-checked"),
      summary: "An independent solver, benchmark, cross-check, or equivalent verifier is linked."
    },
    {
      stage: "formal-proof",
      status: trust === "proved" || evidenceRefs.some((ref) => ref.kind === "proof" && ref.trust === "proved") ? "satisfied" : "waiting",
      evidenceRefs: evidenceRefs.filter((ref) => ref.kind === "proof" || ref.trust === "proved"),
      summary: "Only accepted proof-checker output can satisfy the formal proof gate."
    },
    {
      stage: "human-review",
      status: evidenceRefs.some((ref) => ref.kind === "review") ? "satisfied" : nextChecks.length > 0 ? "waiting" : "not-applicable",
      evidenceRefs: evidenceRefs.filter((ref) => ref.kind === "review"),
      summary: "Human expert review is required for broad scientific, biomedical, safety, finance, legal, or patent conclusions."
    }
  ];
}

function finalizationFor(
  trust: TrustLabel,
  status: ClaimLedgerStatus,
  nextChecks: string[]
): ClaimLedgerRecord["finalization"] {
  const openChecks = [...nextChecks];
  if (trust === "unverified") {
    openChecks.unshift("Attach at least one replayable evidence receipt, source citation, solver check, proof check, or review record.");
  }
  if (trust === "refuted") {
    openChecks.unshift("Do not advance this claim except as a refuted or superseded result.");
  }
  if (status !== "active") {
    openChecks.unshift(`Claim status is ${status}; use the active successor before making a final statement.`);
  }

  const readyForNarrowClaim = status === "active" && trust !== "unverified" && trust !== "refuted" && openChecks.length === 0;
  return {
    strongestTrust: trust,
    readyForNarrowClaim,
    openChecks: [...new Set(openChecks)],
    summary: readyForNarrowClaim
      ? "This can be shared only as a narrow claim matching the attached evidence and trust label."
      : "This claim is not final. Keep it scoped, attach more evidence, or explicitly label it as unresolved/refuted."
  };
}

function reviewStatusForClaim(claim: ClaimLedgerRecord): ClaimReviewStatus {
  if (claim.status !== "active") {
    return "inactive";
  }

  if (claim.trust === "refuted") {
    return "refuted";
  }

  return claim.finalization.readyForNarrowClaim ? "ready" : "blocked";
}

function reviewDecisionForClaim(claim: ClaimLedgerRecord, status: ClaimReviewStatus): string {
  switch (status) {
    case "ready":
      return `Ready only as a narrow ${claim.trust} claim matching the attached evidence, limitations, and lineage.`;
    case "refuted":
      return "Do not present this claim as true. Cite it only as a refuted result under the recorded assumptions.";
    case "inactive":
      return `Do not cite this claim as current because its lifecycle status is ${claim.status}. Use an active successor or record one first.`;
    case "blocked":
      return "Not ready for a final claim. Keep it as work-in-progress, attach stronger evidence, or explicitly label it unverified.";
  }
}

function blockingChecksForClaim(claim: ClaimLedgerRecord): string[] {
  const checks = [...claim.finalization.openChecks];
  for (const step of claim.verification) {
    if (step.status === "waiting" || step.status === "blocked") {
      checks.push(`${step.stage}: ${step.summary}`);
    }
  }

  return [...new Set(checks)];
}

function claimReviewActions(claim: ClaimLedgerRecord, status: ClaimReviewStatus, workspacePath: string): ClaimReviewAction[] {
  const actions: ClaimReviewAction[] = [];
  const statementArg = quoteCommandArg(claim.statement);
  const workspaceArg = quoteCommandArg(workspacePath);

  if (status === "ready") {
    return actions;
  }

  if (status === "refuted" || status === "inactive") {
    actions.push({
      kind: "record-successor",
      label: "Record a successor claim before downstream use",
      reason: status === "refuted"
        ? "Downstream work should depend on a corrected/refuted claim, not the false statement."
        : "Inactive claims should not be used as current evidence without an active successor.",
      commandTemplate: `truth-harness claim add ${statementArg} --workspace ${workspaceArg} --supersedes ${quoteCommandArg(claim.claimId)} --evidence <new-evidence-ref> --json`
    });
  }

  const waitingStages = new Set(
    claim.verification
      .filter((step) => step.status === "waiting" || step.status === "blocked")
      .map((step) => step.stage)
  );

  if (waitingStages.has("exact-or-computed") || waitingStages.has("independent-check")) {
    actions.push({
      kind: "run-verifier-route",
      label: "Run a manifest-aware verifier route",
      reason: "The claim still needs replayable local verifier evidence before it can be narrowed.",
      command: `truth-harness verify ${statementArg} --write --workspace ${workspaceArg} --json`
    });
  }

  if (waitingStages.has("source-or-citation")) {
    actions.push({
      kind: "cite-sources",
      label: "Create a local source-citation receipt",
      reason: "Factual or literature-backed claims need cited local source evidence and entailment review.",
      command: `truth-harness source cite ${statementArg} --workspace ${workspaceArg} --json`
    });
  }

  if (waitingStages.has("formal-proof")) {
    actions.push({
      kind: "attach-proof",
      label: "Attach accepted proof-checker evidence",
      reason: "Only an accepted proof-check backend can satisfy a formal proof claim.",
      commandTemplate: `truth-harness proof check <proof-file.lean> --write --workspace ${workspaceArg} --json`
    });
  }

  if (waitingStages.has("human-review")) {
    actions.push({
      kind: "request-human-review",
      label: "Record scoped human expert review",
      reason: "Broad or sensitive claims need qualified review before stronger presentation.",
      commandTemplate: `truth-harness review log ${statementArg} --workspace ${workspaceArg} --reviewer-role <domain-expert-role> --json`
    });
  }

  for (const check of claim.finalization.openChecks.slice(0, 8)) {
    actions.push({
      kind: "clear-finalization-check",
      label: "Clear finalization check",
      reason: check
    });
  }

  return actions;
}

function strongestTrustFromTrusts(values: TrustLabel[]): TrustLabel {
  const trusts = new Set(values);
  if (trusts.has("refuted")) {
    return "refuted";
  }

  const ranking: TrustLabel[] = [
    "proved",
    "cross-checked",
    "smt-checked",
    "dimension-checked",
    "exact-computed",
    "bounded-numeric",
    "source-cited",
    "unverified"
  ];
  for (const candidate of ranking) {
    if (trusts.has(candidate)) {
      return candidate;
    }
  }

  return "unverified";
}

async function resolveEvidenceRefs(input: {
  root: string;
  evidenceRefs: ClaimLedgerEvidenceRef[];
  knownClaimsById: Map<string, ClaimLedgerRecord>;
}): Promise<{
  evidenceRefs: ClaimLedgerEvidenceRef[];
  warnings: string[];
  supportingTrusts: TrustLabel[];
  finalizationChecks: string[];
}> {
  const warnings: string[] = [];
  const supportingTrusts: TrustLabel[] = [];
  const finalizationChecks: string[] = [];
  const evidenceRefs = await Promise.all(
    input.evidenceRefs.map(async (ref) => {
      const inferred = await inferEvidenceRefTrust({
        root: input.root,
        ref,
        knownClaimsById: input.knownClaimsById
      });

      if (!inferred) {
        if (ref.trust) {
          warnings.push(
            `Evidence ref ${ref.kind}:${ref.ref} carries manually declared trust ${ref.trust}; attach a resolvable receipt, proof, SMT check, or claim record before it can support finalization.`
          );
        }
        if (!ref.trust && shouldResolveEvidenceKind(ref.kind)) {
          warnings.push(`Could not resolve trust for evidence ref ${ref.kind}:${ref.ref}; it cannot support finalization yet.`);
        }
        return ref;
      }

      warnings.push(...(inferred.warnings ?? []));
      finalizationChecks.push(...(inferred.finalizationChecks ?? []));
      if (ref.trust && ref.trust !== inferred.trust) {
        warnings.push(
          `Evidence ref ${ref.kind}:${ref.ref} declared trust ${ref.trust}, but the local artifact reports ${inferred.trust}; using the artifact trust.`
        );
      }
      if (inferred.supportsFinalization !== false || inferred.trust === "refuted") {
        supportingTrusts.push(inferred.trust);
      }

      return {
        ...ref,
        trust: inferred.trust,
        summary: ref.summary ?? inferred.summary
      };
    })
  );

  return { evidenceRefs, warnings, supportingTrusts, finalizationChecks };
}

interface EvidenceTrustResolution {
  trust: TrustLabel;
  summary?: string;
  supportsFinalization?: boolean;
  warnings?: string[];
  finalizationChecks?: string[];
}

async function inferEvidenceRefTrust(input: {
  root: string;
  ref: ClaimLedgerEvidenceRef;
  knownClaimsById: Map<string, ClaimLedgerRecord>;
}): Promise<EvidenceTrustResolution | undefined> {
  if (input.ref.kind === "claim") {
    const claim = input.knownClaimsById.get(input.ref.ref);
    return claim ? { trust: claim.trust, summary: claim.title } : undefined;
  }

  if (input.ref.kind === "route") {
    try {
      const route = await readVerifierRoute(input.root, input.ref.ref);
      const readiness = verifierRouteReadiness(route);
      if (route.status === "refuted" || readiness.strongestTrust === "refuted") {
        return {
          trust: "refuted",
          summary: `Verifier route ${route.routeId} is refuted under the recorded assumptions.`
        };
      }

      if (!readiness.readyForNarrowClaim) {
        const summary = `Verifier route ${route.routeId} is not ready for a narrow claim: ${readiness.summary}`;
        return {
          trust: "unverified",
          summary,
          supportsFinalization: false,
          warnings: [summary],
          finalizationChecks: [summary]
        };
      }

      return {
        trust: readiness.strongestTrust,
        summary: `Verifier route ${route.routeId} is ready for a narrow ${readiness.strongestTrust} claim.`
      };
    } catch {
      return undefined;
    }
  }

  if (input.ref.kind !== "receipt" && input.ref.kind !== "cas" && input.ref.kind !== "proof" && input.ref.kind !== "smt") {
    return undefined;
  }

  const artifact = await readEvidenceArtifactJson(input.root, input.ref.ref);
  if (!artifact) {
    return undefined;
  }

  if (input.ref.kind === "receipt") {
    try {
      const receipt = parseReceiptJson(artifact.raw, input.ref.ref);
      return { trust: receipt.trust, summary: receipt.summary };
    } catch {
      return undefined;
    }
  }

  if (!isRecord(artifact.parsed) || typeof artifact.parsed.trust !== "string" || !isTrustLabel(artifact.parsed.trust)) {
    return undefined;
  }

  if (input.ref.kind === "cas" && artifact.parsed.schemaVersion === "truth-harness.cas-check.v0") {
    try {
      const record = parseSymbolicCasCheckRecord(artifact.raw, input.ref.ref);
      return { trust: record.trust, summary: `CAS check status: ${record.status}.` };
    } catch {
      return undefined;
    }
  }

  if (input.ref.kind === "proof" && artifact.parsed.schemaVersion === "truth-harness.proof-check.v0") {
    try {
      const record = parseLeanProofCheckRecord(artifact.raw, input.ref.ref);
      const missingStatementBoundary =
        record.trust === "proved" && (!record.scope?.statement || record.scope.statement.trim().length === 0);
      const statementBoundary =
        "Accepted proof-check evidence has no recorded statement boundary; a human must confirm the formal theorem matches the claim before final publication.";
      return {
        trust: record.trust,
        summary: `Lean proof check status: ${record.status}.`,
        ...(missingStatementBoundary ? { warnings: [statementBoundary], finalizationChecks: [statementBoundary] } : {})
      };
    } catch {
      return undefined;
    }
  }

  if (input.ref.kind === "smt" && artifact.parsed.schemaVersion === "truth-harness.smt-check.v0") {
    try {
      const record = parseSmtCheckRecord(artifact.raw, input.ref.ref);
      return { trust: record.trust, summary: `SMT check status: ${record.status}.` };
    } catch {
      return undefined;
    }
  }

  return undefined;
}

async function readEvidenceArtifactJson(root: string, ref: string): Promise<{ raw: string; parsed: unknown } | undefined> {
  let path: string;
  try {
    path = resolveUnderRoot(root, ref);
  } catch {
    return undefined;
  }

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return undefined;
  }

  try {
    return { raw, parsed: parseJsonWithOptionalBom(raw) as unknown };
  } catch {
    return { raw, parsed: undefined };
  }
}

function effectiveClaimTrust(_requestedTrust: TrustLabel | undefined, evidenceTrust: TrustLabel): TrustLabel {
  return evidenceTrust;
}

function trustBoundaryOpenChecks(requestedTrust: TrustLabel | undefined, effectiveTrust: TrustLabel): string[] {
  if (!requestedTrust || requestedTrust === "unverified" || requestedTrust === effectiveTrust) {
    return [];
  }

  if (requestedTrust === "refuted" || effectiveTrust === "refuted" || trustRank(requestedTrust) > trustRank(effectiveTrust)) {
    return [`Requested trust ${requestedTrust} is not backed by attached evidence; effective claim trust is ${effectiveTrust}.`];
  }

  return [];
}

function warningsFor(input: {
  statement: string;
  trust: TrustLabel;
  status: ClaimLedgerStatus;
  nextChecks: string[];
  domain: ClaimLedgerDomain;
  requestedTrust?: TrustLabel;
  evidenceTrust: TrustLabel;
  evidenceWarnings: string[];
}): string[] {
  const warnings = [
    "A claim ledger record preserves provenance and lineage; it is not proof by itself.",
    "No final claim may outrun the strongest attached trust label."
  ];
  warnings.push(...input.evidenceWarnings);
  if (input.requestedTrust && input.requestedTrust !== "unverified" && input.requestedTrust !== input.trust) {
    warnings.push(`Requested trust ${input.requestedTrust} was not recorded as claim trust because attached evidence supports ${input.evidenceTrust}.`);
  }
  if (input.trust === "unverified") {
    warnings.push("This claim has no verified local evidence yet.");
  }
  if (input.trust === "refuted") {
    warnings.push("This claim is refuted under the recorded assumptions and must not be presented as true.");
  }
  if (input.nextChecks.length > 0) {
    warnings.push("Open next checks remain before this can be treated as a narrow final claim.");
  }
  if (input.status !== "active") {
    warnings.push(`This claim is ${input.status}; use the active successor for current reporting.`);
  }
  if (input.domain === "biology" || input.domain === "finance" || input.domain === "patent" || /cancer|drug|clinical|patent|investment|safety/i.test(input.statement)) {
    warnings.push("Domain-sensitive conclusions require qualified human review and appropriate real-world validation.");
  }

  return warnings;
}

function inferClaimDomain(statement: string): ClaimLedgerDomain {
  if (/\b(proof|lemma|equation|integral|matrix|number theory|math|fraction)\b/i.test(statement)) return "math";
  if (/\b(source|citation|paper|literature|quote|doi)\b/i.test(statement)) return "sources";
  if (/\b(code|program|compiler|test|api|software)\b/i.test(statement)) return "code";
  if (/\b(data|dataset|statistics|regression|causal)\b/i.test(statement)) return "data";
  if (/\b(essay|book|argument|draft|paragraph)\b/i.test(statement)) return "writing";
  if (/\b(physics|force|mass|energy|velocity|quantum)\b/i.test(statement)) return "physics";
  if (/\b(cancer|hair loss|biology|protein|cell|drug|clinical)\b/i.test(statement)) return "biology";
  if (/\b(chemistry|reaction|molecule|compound|spectra)\b/i.test(statement)) return "chemistry";
  if (/\b(finance|ledger|portfolio|invoice|tax|investment)\b/i.test(statement)) return "finance";
  if (/\b(hardware|schematic|pcb|cad|firmware)\b/i.test(statement)) return "hardware";
  if (/\b(security|vulnerability|threat|exploit|cve)\b/i.test(statement)) return "security";
  if (/\b(patent|invention|prior art|claim chart|novelty)\b/i.test(statement)) return "patent";
  return "general";
}

function normalizeEvidenceRefs(values: ClaimLedgerEvidenceRef[]): ClaimLedgerEvidenceRef[] {
  return values.map((value) => ({
    kind: value.kind,
    ref: requireText(value.ref, "Evidence ref is required."),
    trust: value.trust,
    summary: normalizeOptionalText(value.summary)
  }));
}

function normalizeClaimRefs(values: string[], message: string, knownClaimIds: Set<string>): string[] {
  const refs = normalizeStringList(values);
  for (const ref of refs) {
    if (!knownClaimIds.has(ref)) {
      throw new Error(`${message}: ${ref}`);
    }
  }

  return refs;
}

function normalizeTags(values: string[]): string[] {
  return [...new Set(values.map((tag) => tag.trim().replace(/^#/u, "").toLowerCase()).filter(Boolean))].sort();
}

function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\s+/gu, " ").trim()).filter(Boolean))];
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized ? normalized : undefined;
}

function requireText(value: string, message: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeStatement(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}

function titleFromStatement(statement: string): string {
  return statement.length > 72 ? `${statement.slice(0, 69)}...` : statement;
}

function hasTrust(value: TrustLabel | undefined, allowed: TrustLabel[]): boolean {
  return value ? allowed.includes(value) : false;
}

function isTrustLabel(value: string): value is TrustLabel {
  return (
    value === "proved" ||
    value === "exact-computed" ||
    value === "bounded-numeric" ||
    value === "smt-checked" ||
    value === "dimension-checked" ||
    value === "source-cited" ||
    value === "cross-checked" ||
    value === "unverified" ||
    value === "refuted"
  );
}

function trustRank(value: TrustLabel): number {
  switch (value) {
    case "proved":
      return 7;
    case "cross-checked":
      return 6;
    case "smt-checked":
      return 5;
    case "dimension-checked":
    case "exact-computed":
    case "bounded-numeric":
      return 4;
    case "source-cited":
      return 3;
    case "unverified":
      return 0;
    case "refuted":
      return -1;
  }
}

function shouldResolveEvidenceKind(kind: ClaimLedgerEvidenceRef["kind"]): boolean {
  return kind === "claim" || kind === "receipt" || kind === "cas" || kind === "proof" || kind === "smt" || kind === "route";
}

function formatEvidenceRefs(refs: ClaimLedgerEvidenceRef[]): string {
  return refs.map((ref) => `${ref.kind}:${ref.ref}`).join("; ");
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/u.test(value) ? value : JSON.stringify(value);
}

function isClaimId(value: string): boolean {
  return /^claim_[a-f0-9]{16}$/u.test(value);
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Claim ledger path escapes workspace root: ${JSON.stringify(path)}`);
  }

  return target;
}

function escapeMarkdownText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\*/gu, "\\*").replace(/_/gu, "\\_").replace(/`/gu, "\\`");
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/gu, "\\|").replace(/\n/gu, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

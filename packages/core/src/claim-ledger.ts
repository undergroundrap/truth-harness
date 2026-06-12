import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { parseReceiptJson } from "./receipt-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";
import { readVerifierRoute } from "./verifier-route.js";

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
  schemaVersion: "theorem.claim.v0";
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
  schemaVersion: "theorem.claim-graph.v0";
  nodes: ClaimLedgerGraphNode[];
  edges: ClaimLedgerGraphEdge[];
  warnings: string[];
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
    schemaVersion: "theorem.claim-graph.v0",
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
    schemaVersion: "theorem.claim.v0" as const,
    claimId,
    ...recordWithoutId,
    updatedAt: createdAt,
    verification: verificationFor(trust, evidenceRefs, nextChecks),
    finalization: finalizationFor(trust, statusValue, [...nextChecks, ...trustBoundaryChecks]),
    warnings: warningsFor({
      statement,
      trust,
      status: statusValue,
      nextChecks,
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
  const claimsDir = resolve(status.root, status.manifest.directories.claims);
  await mkdir(claimsDir, { recursive: true });
  const baseName = `${claim.createdAt.slice(0, 10)}-${claim.claimId}`;
  const jsonPath = join(claimsDir, `${baseName}.json`);
  const markdownPath = join(claimsDir, `${baseName}.md`);

  await writeFile(jsonPath, `${JSON.stringify(claim, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, claim.markdown, "utf8");

  return {
    claim,
    jsonPath,
    markdownPath,
    markdown: claim.markdown
  };
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
      .map(async (file) => JSON.parse(await readFile(join(claimsDir, file), "utf8")) as ClaimLedgerRecord)
  );

  return claims
    .filter((claim) => claim.schemaVersion === "theorem.claim.v0")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function readClaimRecord(rootPath: string, claimRef: string): Promise<ClaimLedgerRecord> {
  const status = await requireLocalWorkspace(rootPath);
  return (await readClaimRecordRef(status, claimRef)).claim;
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
      const claim = JSON.parse(await readFile(path, "utf8")) as ClaimLedgerRecord;
      if (claim.schemaVersion === "theorem.claim.v0" && claim.claimId === ref) {
        return { claim, path };
      }
    }

    throw new Error(`Claim not found: ${ref}`);
  }

  const path = resolveUnderRoot(status.root, ref);
  return {
    claim: JSON.parse(await readFile(path, "utf8")) as ClaimLedgerRecord,
    path
  };
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Theorem workspace found. Run `theorem workspace init` before writing claim ledger records.");
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
}): Promise<{ evidenceRefs: ClaimLedgerEvidenceRef[]; warnings: string[]; supportingTrusts: TrustLabel[] }> {
  const warnings: string[] = [];
  const supportingTrusts: TrustLabel[] = [];
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

      if (ref.trust && ref.trust !== inferred.trust) {
        warnings.push(
          `Evidence ref ${ref.kind}:${ref.ref} declared trust ${ref.trust}, but the local artifact reports ${inferred.trust}; using the artifact trust.`
        );
      }
      supportingTrusts.push(inferred.trust);

      return {
        ...ref,
        trust: inferred.trust,
        summary: ref.summary ?? inferred.summary
      };
    })
  );

  return { evidenceRefs, warnings, supportingTrusts };
}

async function inferEvidenceRefTrust(input: {
  root: string;
  ref: ClaimLedgerEvidenceRef;
  knownClaimsById: Map<string, ClaimLedgerRecord>;
}): Promise<{ trust: TrustLabel; summary?: string } | undefined> {
  if (input.ref.kind === "claim") {
    const claim = input.knownClaimsById.get(input.ref.ref);
    return claim ? { trust: claim.trust, summary: claim.title } : undefined;
  }

  if (input.ref.kind === "route") {
    try {
      const route = await readVerifierRoute(input.root, input.ref.ref);
      return { trust: route.finalTrust, summary: `Verifier route ${route.routeId} ended with ${route.finalTrust}.` };
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

  if (input.ref.kind === "cas" && artifact.parsed.schemaVersion === "theorem.cas-check.v0") {
    const status = typeof artifact.parsed.status === "string" ? artifact.parsed.status : "unknown";
    return { trust: artifact.parsed.trust, summary: `CAS check status: ${status}.` };
  }

  if (input.ref.kind === "proof" && artifact.parsed.schemaVersion === "theorem.proof-check.v0") {
    const status = typeof artifact.parsed.status === "string" ? artifact.parsed.status : "unknown";
    return { trust: artifact.parsed.trust, summary: `Lean proof check status: ${status}.` };
  }

  if (input.ref.kind === "smt" && artifact.parsed.schemaVersion === "theorem.smt-check.v0") {
    const status = typeof artifact.parsed.status === "string" ? artifact.parsed.status : "unknown";
    return { trust: artifact.parsed.trust, summary: `SMT check status: ${status}.` };
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
    return { raw, parsed: JSON.parse(raw) as unknown };
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
  if (/\b(theorem|proof|lemma|equation|integral|matrix|number theory|math|fraction)\b/i.test(statement)) return "math";
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

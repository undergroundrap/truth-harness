import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import type { CodeRunRecord } from "./code-run.js";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import type { ExperimentLogEntry } from "./experiment-log.js";
import type { ExpertReviewRecord } from "./expert-review.js";
import type { ExternalDisclosureLogEntry } from "./disclosure-log.js";
import type { InventionEvidenceRef } from "./invention-log.js";
import { validateJsonSchema } from "./json-schema-validation.js";
import type { LiteratureRecord } from "./literature-record.js";
import type { NotebookRunRecord } from "./notebook-run.js";
import type { SimulationLogEntry } from "./simulation-log.js";
import type { VaultEnvelope, VaultEnvelopeSummary } from "./vault.js";
import { parseReceiptJson, ReceiptValidationError } from "./receipt-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, Receipt, TrustLabel } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export const EVIDENCE_AUDIT_CLAIM_TYPES = [
  "math",
  "source-grounded",
  "simulation",
  "experiment",
  "biomedical",
  "patent",
  "engineering",
  "general"
] as const;

export const EVIDENCE_AUDIT_VERDICTS = [
  "refuted",
  "verified-narrow",
  "source-grounded",
  "protocol-evidence",
  "computational-evidence",
  "hypothesis",
  "unsupported",
  "overclaimed"
] as const;

export const EVIDENCE_AUDIT_REVIEW_STATUSES = ["resolved", "referenced", "missing"] as const;
export const EVIDENCE_AUDIT_STRENGTHS = [
  "none",
  "weak",
  "context",
  "computational",
  "protocol",
  "strong",
  "refuting"
] as const;

export type EvidenceAuditClaimType = (typeof EVIDENCE_AUDIT_CLAIM_TYPES)[number];
export type EvidenceAuditVerdict = (typeof EVIDENCE_AUDIT_VERDICTS)[number];
export type EvidenceAuditReviewStatus = (typeof EVIDENCE_AUDIT_REVIEW_STATUSES)[number];
export type EvidenceAuditStrength = (typeof EVIDENCE_AUDIT_STRENGTHS)[number];

export interface EvidenceAuditReview {
  kind: InventionEvidenceRef["kind"];
  ref: string;
  status: EvidenceAuditReviewStatus;
  strength: EvidenceAuditStrength;
  trust?: TrustLabel;
  summary: string;
  warnings: string[];
}

export interface EvidenceAudit {
  schemaVersion: typeof EVIDENCE_AUDIT_SCHEMA_VERSION;
  auditId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  claim: string;
  claimTypes: EvidenceAuditClaimType[];
  evidenceRefs: InventionEvidenceRef[];
  reviews: EvidenceAuditReview[];
  evidenceSummary: {
    total: number;
    resolved: number;
    referenced: number;
    missing: number;
    byKind: Record<string, number>;
    byStrength: Record<EvidenceAuditStrength, number>;
    byTrust: Partial<Record<TrustLabel, number>>;
  };
  verdict: {
    status: EvidenceAuditVerdict;
    summary: string;
  };
  requiredNextChecks: string[];
  overclaimWarnings: string[];
  privacy: PrivacyMetadata;
}

export interface CreateEvidenceAuditInput {
  rootPath: string;
  claim: string;
  title?: string;
  evidenceRefs?: InventionEvidenceRef[];
  now?: string;
}

export interface EvidenceAuditWriteResult {
  audit: EvidenceAudit;
  path: string;
}

export interface EvidenceAuditReportWriteResult {
  audit: EvidenceAudit;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

const EVIDENCE_AUDIT_SCHEMA_VERSION = "truth-harness.evidence-audit.v0" as const;
const SCHEMAS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");
let evidenceAuditSchemaCache: Promise<unknown> | undefined;

export async function createEvidenceAudit(input: CreateEvidenceAuditInput): Promise<EvidenceAudit> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const claim = requireText(input.claim, "Evidence audit claim is required.");
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs ?? []);
  const reviews = await Promise.all(evidenceRefs.map((ref) => reviewEvidenceRef(status.root, manifest, ref)));
  const claimTypes = classifyClaim(claim, evidenceRefs, reviews);
  const evidenceSummary = summarizeEvidence(reviews);
  const verdict = verdictFor({ claim, claimTypes, reviews });
  const overclaimWarnings = overclaimWarningsFor({ claim, claimTypes, reviews, verdict });
  const requiredNextChecks = nextChecksFor({ claimTypes, reviews, verdict });
  const auditWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    updatedAt: createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromClaim(claim),
    claim,
    claimTypes,
    evidenceRefs,
    reviews,
    evidenceSummary,
    verdict,
    requiredNextChecks,
    overclaimWarnings,
    privacy: manifest.privacy
  };
  const auditId = `audit_${stableHash(auditWithoutId).slice(0, 16)}`;

  return {
    schemaVersion: EVIDENCE_AUDIT_SCHEMA_VERSION,
    auditId,
    ...auditWithoutId
  };
}

export async function writeEvidenceAudit(input: CreateEvidenceAuditInput): Promise<EvidenceAuditWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const audit = await createEvidenceAudit(input);
  await assertEvidenceAuditSchema(audit);
  const auditsDir = resolve(status.root, status.manifest.directories.audits);
  await mkdir(auditsDir, { recursive: true });
  const path = join(auditsDir, `${audit.createdAt.slice(0, 10)}-${audit.auditId}.json`);
  await writeJsonFileAtomic(path, audit);
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, path),
    kind: "audits",
    now: audit.createdAt,
    staleReason: "evidence audit written"
  });

  return { audit, path };
}

export async function writeEvidenceAuditReport(input: CreateEvidenceAuditInput): Promise<EvidenceAuditReportWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const audit = await createEvidenceAudit(input);
  await assertEvidenceAuditSchema(audit);
  const auditsDir = resolve(status.root, status.manifest.directories.audits);
  await mkdir(auditsDir, { recursive: true });
  const baseName = `${audit.createdAt.slice(0, 10)}-${audit.auditId}`;
  const jsonPath = join(auditsDir, `${baseName}.json`);
  const markdownPath = join(auditsDir, `${baseName}.md`);
  const markdown = renderEvidenceAuditMarkdown(audit);

  await writeJsonFileAtomic(jsonPath, audit);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "audits",
    now: audit.createdAt,
    staleReason: "evidence audit report written"
  });

  return {
    audit,
    jsonPath,
    markdownPath,
    markdown
  };
}

async function assertEvidenceAuditSchema(audit: EvidenceAudit): Promise<void> {
  const schema = await loadEvidenceAuditSchema();
  const serializedAudit = parseJsonWithOptionalBom(JSON.stringify(audit));
  const issues = validateJsonSchema(serializedAudit, schema);
  if (issues.length === 0) {
    return;
  }

  throw new Error(
    `Evidence audit failed JSON Schema validation before write: ${issues
      .map((issue) => `${issue.path} ${issue.message}`)
      .join("; ")}`
  );
}

function loadEvidenceAuditSchema(): Promise<unknown> {
  evidenceAuditSchemaCache ??= readFile(resolve(SCHEMAS_DIR, "evidence-audit.schema.json"), "utf8").then((raw) =>
    parseJsonWithOptionalBom(raw)
  );
  return evidenceAuditSchemaCache;
}

export async function listEvidenceAudits(rootPath: string): Promise<EvidenceAudit[]> {
  const status = await requireLocalWorkspace(rootPath);
  const auditsDir = resolve(status.root, status.manifest.directories.audits);

  let files: string[];
  try {
    files = await readdir(auditsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const audits = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => parseJsonWithOptionalBom(await readFile(join(auditsDir, file), "utf8")) as EvidenceAudit)
  );

  return audits
    .filter((audit) => audit.schemaVersion === EVIDENCE_AUDIT_SCHEMA_VERSION)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function renderEvidenceAuditMarkdown(audit: EvidenceAudit): string {
  const lines: string[] = [
    `# Evidence Audit: ${escapeMarkdownText(audit.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Audit | \`${audit.auditId}\` |`,
    `| Created | ${escapeMarkdownTable(audit.createdAt)} |`,
    `| Verdict | \`${audit.verdict.status}\` |`,
    `| Claim types | ${audit.claimTypes.map((type) => `\`${type}\``).join(", ")} |`,
    `| Privacy | \`${audit.privacy.mode}\` / network \`${audit.privacy.networkAccess}\` |`,
    "",
    "## Claim",
    "",
    escapeMarkdownText(audit.claim),
    "",
    "## Verdict",
    "",
    escapeMarkdownText(audit.verdict.summary),
    "",
    "## Evidence Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Total refs | ${audit.evidenceSummary.total} |`,
    `| Resolved | ${audit.evidenceSummary.resolved} |`,
    `| Referenced | ${audit.evidenceSummary.referenced} |`,
    `| Missing | ${audit.evidenceSummary.missing} |`,
    "",
    "## Evidence Review",
    "",
    "| Status | Kind | Strength | Trust | Reference | Summary |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  if (audit.reviews.length === 0) {
    lines.push("| `missing` | `none` | `none` |  |  | No evidence references were attached. |");
  } else {
    for (const review of audit.reviews) {
      lines.push(
        [
          `\`${review.status}\``,
          `\`${review.kind}\``,
          `\`${review.strength}\``,
          review.trust ? `\`${review.trust}\`` : "",
          escapeMarkdownTable(review.ref),
          escapeMarkdownTable(review.summary)
        ]
          .join(" | ")
          .replace(/^/, "| ")
          .replace(/$/, " |")
      );
    }
  }

  if (audit.overclaimWarnings.length > 0) {
    lines.push("", "## Overclaim Warnings", "");
    for (const warning of audit.overclaimWarnings) {
      lines.push(`- ${escapeMarkdownText(warning)}`);
    }
  }

  const evidenceWarnings = audit.reviews.flatMap((review) => review.warnings);
  if (evidenceWarnings.length > 0) {
    lines.push("", "## Evidence Warnings", "");
    for (const warning of evidenceWarnings) {
      lines.push(`- ${escapeMarkdownText(warning)}`);
    }
  }

  if (audit.requiredNextChecks.length > 0) {
    lines.push("", "## Required Next Checks", "");
    for (const check of audit.requiredNextChecks) {
      lines.push(`- ${escapeMarkdownText(check)}`);
    }
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "This audit classifies local evidence posture. It is not proof, medical advice, regulatory approval, or legal advice."
  );

  return `${lines.join("\n")}\n`;
}

async function reviewEvidenceRef(
  root: string,
  manifest: NonNullable<LocalWorkspaceStatus["manifest"]>,
  ref: InventionEvidenceRef
): Promise<EvidenceAuditReview> {
  if (ref.kind === "receipt") {
    return reviewReceiptRef(root, ref);
  }

  if (ref.kind === "simulation") {
    return reviewSimulationRef(root, manifest, ref);
  }

  if (ref.kind === "experiment") {
    return reviewExperimentRef(root, manifest, ref);
  }

  if (ref.kind === "disclosure") {
    return reviewDisclosureRef(root, manifest, ref);
  }

  if (ref.kind === "vault") {
    return reviewVaultRef(root, manifest, ref);
  }

  if (ref.kind === "review") {
    return reviewExpertReviewRef(root, manifest, ref);
  }

  if (ref.kind === "source") {
    return {
      kind: "source",
      ref: ref.ref,
      status: "referenced",
      strength: "context",
      trust: ref.trust ?? "source-cited",
      summary: ref.summary ?? "Source reference recorded; source retrieval is context, not proof of entailment.",
      warnings: ["Source refs need claim-level entailment review before they support scientific or mathematical conclusions."]
    };
  }

  if (ref.kind === "literature") {
    return reviewLiteratureRef(root, manifest, ref);
  }

  if (ref.kind === "notebook-run") {
    return reviewNotebookRunRef(root, manifest, ref);
  }

  if (ref.kind === "code-run") {
    return reviewCodeRunRef(root, manifest, ref);
  }

  if (ref.kind === "benchmark") {
    return {
      kind: "benchmark",
      ref: ref.ref,
      status: "referenced",
      strength: "context",
      trust: ref.trust,
      summary: ref.summary ?? "Benchmark reference recorded.",
      warnings: ["Benchmark refs measure system behavior; they do not prove the audited claim by themselves."]
    };
  }

  if (ref.kind === "cas") {
    return {
      kind: "cas",
      ref: ref.ref,
      status: "referenced",
      strength: "computational",
      trust: ref.trust,
      summary: ref.summary ?? "CAS check reference recorded.",
      warnings: ["CAS checks can cross-check scoped symbolic equalities; they are not accepted proof-checker proofs."]
    };
  }

  return {
    kind: ref.kind,
    ref: ref.ref,
    status: "referenced",
    strength: "weak",
    trust: ref.trust,
    summary: ref.summary ?? "Evidence reference recorded but not independently resolved by the audit.",
    warnings: [`${ref.kind} refs require human review or a future resolver before supporting the claim.`]
  };
}

async function reviewReceiptRef(root: string, ref: InventionEvidenceRef): Promise<EvidenceAuditReview> {
  const path = resolveUnderRoot(root, ref.ref);
  try {
    const receipt = parseReceiptJson(await readFile(path, "utf8"), ref.ref);
    return {
      kind: "receipt",
      ref: ref.ref,
      status: "resolved",
      strength: strengthForReceipt(receipt),
      trust: receipt.trust,
      summary: receipt.summary,
      warnings: warningsForReceipt(receipt)
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return missingReview(ref, "Receipt file was not found under the local workspace root.");
    }

    if (error instanceof ReceiptValidationError) {
      return invalidReceiptReview(ref, error);
    }

    throw error;
  }
}

async function reviewSimulationRef(
  root: string,
  manifest: NonNullable<LocalWorkspaceStatus["manifest"]>,
  ref: InventionEvidenceRef
): Promise<EvidenceAuditReview> {
  const entry = await readWorkspaceJsonRef<SimulationLogEntry>(root, manifest.directories.simulations, ref.ref, "simulationId");
  if (!entry) {
    return missingReview(ref, "Simulation log was not found by id or workspace-local path.");
  }

  return {
    kind: "simulation",
    ref: ref.ref,
    status: "resolved",
    strength: "computational",
    summary: `${entry.title}: ${entry.question}`,
    warnings: entry.warnings.length > 0 ? entry.warnings : ["Simulation is computational evidence, not real-world validation."]
  };
}

async function reviewExperimentRef(
  root: string,
  manifest: NonNullable<LocalWorkspaceStatus["manifest"]>,
  ref: InventionEvidenceRef
): Promise<EvidenceAuditReview> {
  const entry = await readWorkspaceJsonRef<ExperimentLogEntry>(root, manifest.directories.experiments, ref.ref, "experimentId");
  if (!entry) {
    return missingReview(ref, "Experiment log was not found by id or workspace-local path.");
  }

  const strength: EvidenceAuditStrength = entry.stage === "completed" || entry.stage === "replicated" ? "protocol" : "weak";
  return {
    kind: "experiment",
    ref: ref.ref,
    status: "resolved",
    strength,
    summary: `${entry.title}: ${entry.outcome.status}. ${entry.outcome.summary}`,
    warnings: entry.warnings
  };
}

async function reviewDisclosureRef(
  root: string,
  manifest: NonNullable<LocalWorkspaceStatus["manifest"]>,
  ref: InventionEvidenceRef
): Promise<EvidenceAuditReview> {
  const entry = await readWorkspaceJsonRef<ExternalDisclosureLogEntry>(
    root,
    manifest.directories.disclosures,
    ref.ref,
    "disclosureId"
  );
  if (!entry) {
    return missingReview(ref, "External disclosure log was not found by id or workspace-local path.");
  }

  return {
    kind: "disclosure",
    ref: ref.ref,
    status: "resolved",
    strength: "context",
    summary: `${entry.service}: ${entry.purpose}`,
    warnings: [
      "External disclosure records document context leaving the local workspace; they do not prove the external output is true.",
      ...entry.warnings
    ]
  };
}

async function reviewVaultRef(
  root: string,
  manifest: NonNullable<LocalWorkspaceStatus["manifest"]>,
  ref: InventionEvidenceRef
): Promise<EvidenceAuditReview> {
  const entry = await readWorkspaceJsonRef<VaultEnvelope>(root, manifest.directories.vault, ref.ref, "vaultId");
  if (!entry) {
    return missingReview(ref, "Vault envelope was not found by id or workspace-local path.");
  }

  const summary = summarizeVaultEnvelope(entry);
  return {
    kind: "vault",
    ref: ref.ref,
    status: "resolved",
    strength: "context",
    summary: `${summary.label}; encrypted ${summary.ciphertextBytes} bytes at rest.`,
    warnings: [
      "Vault refs preserve encrypted private evidence provenance; they do not reveal plaintext or prove the audited claim.",
      ...summary.warnings
    ]
  };
}

async function reviewExpertReviewRef(
  root: string,
  manifest: NonNullable<LocalWorkspaceStatus["manifest"]>,
  ref: InventionEvidenceRef
): Promise<EvidenceAuditReview> {
  const entry = await readWorkspaceJsonRef<ExpertReviewRecord>(root, manifest.directories.reviews, ref.ref, "reviewId");
  if (!entry) {
    return missingReview(ref, "Expert review record was not found by id or workspace-local path.");
  }

  const strength: EvidenceAuditStrength =
    entry.status === "completed" && entry.outcome.status === "supported-with-limitations" ? "protocol" : "context";

  return {
    kind: "review",
    ref: ref.ref,
    status: "resolved",
    strength,
    summary: `${entry.kind}/${entry.status}: ${entry.outcome.summary}`,
    warnings: [
      "Expert review records are scoped human-review artifacts; they do not prove broad truth by themselves.",
      ...entry.warnings
    ]
  };
}

async function reviewLiteratureRef(
  root: string,
  manifest: NonNullable<LocalWorkspaceStatus["manifest"]>,
  ref: InventionEvidenceRef
): Promise<EvidenceAuditReview> {
  const record = await readWorkspaceJsonRef<LiteratureRecord>(root, manifest.directories.literature, ref.ref, "recordId");
  if (!record) {
    return missingReview(ref, "Literature record was not found by id or workspace-local path.");
  }

  return {
    kind: "literature",
    ref: ref.ref,
    status: "resolved",
    strength: record.status === "retracted" || record.status === "disputed" ? "weak" : "context",
    trust: ref.trust ?? "source-cited",
    summary: `${record.kind}/${record.status}: ${record.title}`,
    warnings:
      record.warnings.length > 0
        ? record.warnings
        : ["Literature records provide source context; they do not prove entailment or real-world validity."]
  };
}

async function reviewNotebookRunRef(
  root: string,
  manifest: NonNullable<LocalWorkspaceStatus["manifest"]>,
  ref: InventionEvidenceRef
): Promise<EvidenceAuditReview> {
  const record = await readWorkspaceJsonRef<NotebookRunRecord>(root, manifest.directories["notebook-runs"], ref.ref, "runRecordId");
  if (!record) {
    return missingReview(ref, "Notebook run record was not found by id or workspace-local path.");
  }

  return {
    kind: "notebook-run",
    ref: ref.ref,
    status: "resolved",
    strength: record.status === "reproduced" ? "computational" : "context",
    summary: `${record.kind}/${record.status}: ${record.title}`,
    warnings:
      record.warnings.length > 0
        ? record.warnings
        : ["Notebook run records provide provenance and replay context; they do not prove output truth by themselves."]
  };
}

async function reviewCodeRunRef(
  root: string,
  manifest: NonNullable<LocalWorkspaceStatus["manifest"]>,
  ref: InventionEvidenceRef
): Promise<EvidenceAuditReview> {
  const record = await readWorkspaceJsonRef<CodeRunRecord>(root, manifest.directories["code-runs"], ref.ref, "runId");
  if (!record) {
    return missingReview(ref, "Code run record was not found by id or workspace-local path.");
  }

  return {
    kind: "code-run",
    ref: ref.ref,
    status: "resolved",
    strength: record.execution.status === "passed" ? "computational" : "weak",
    summary: `${record.execution.status}: ${record.title}`,
    warnings:
      record.warnings.length > 0
        ? record.warnings
        : ["Code run records capture local process execution; they do not prove code correctness by themselves."]
  };
}

async function readWorkspaceJsonRef<T extends object>(
  root: string,
  directory: string,
  ref: string,
  idKey: string
): Promise<T | undefined> {
  if (ref.endsWith(".json") || ref.includes("/") || ref.includes("\\")) {
    const path = resolveUnderRoot(root, ref);
    try {
      return JSON.parse(await readFile(path, "utf8")) as T;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

  const targetDir = resolve(root, directory);
  let files: string[];
  try {
    files = await readdir(targetDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
    const entry = JSON.parse(await readFile(join(targetDir, file), "utf8")) as T;
    if ((entry as Record<string, unknown>)[idKey] === ref) {
      return entry;
    }
  }

  return undefined;
}

function verdictFor(input: {
  claim: string;
  claimTypes: EvidenceAuditClaimType[];
  reviews: EvidenceAuditReview[];
}): EvidenceAudit["verdict"] {
  if (input.reviews.some((review) => review.strength === "refuting" || review.trust === "refuted")) {
    return {
      status: "refuted",
      summary: "At least one resolved evidence receipt refutes the claim."
    };
  }

  if (isOverclaimed(input)) {
    return {
      status: "overclaimed",
      summary: "The claim uses stronger language than the attached evidence can justify."
    };
  }

  if (input.reviews.some((review) => review.strength === "strong")) {
    return {
      status: "verified-narrow",
      summary: "The claim has narrow verified evidence; do not generalize beyond the verified scope."
    };
  }

  if (input.reviews.some((review) => review.strength === "protocol")) {
    return {
      status: "protocol-evidence",
      summary: "The claim has protocol-scoped experimental evidence and still needs replication and expert review."
    };
  }

  if (input.reviews.some((review) => review.strength === "computational")) {
    return {
      status: "computational-evidence",
      summary: "The claim has computational evidence and still needs source, expert, or real-world validation as appropriate."
    };
  }

  if (input.reviews.some((review) => review.trust === "source-cited" || review.kind === "source")) {
    return {
      status: "source-grounded",
      summary: "The claim has source context, but source retrieval is not proof of entailment."
    };
  }

  if (input.reviews.length === 0 || input.reviews.every((review) => review.status === "missing")) {
    return {
      status: "unsupported",
      summary: "No usable local evidence refs support this claim yet."
    };
  }

  return {
    status: "hypothesis",
    summary: "Evidence refs are present but remain weak, contextual, or unresolved."
  };
}

function isOverclaimed(input: {
  claim: string;
  claimTypes: EvidenceAuditClaimType[];
  reviews: EvidenceAuditReview[];
}): boolean {
  if (!hasStrongClaimLanguage(input.claim)) {
    return false;
  }

  if (input.claimTypes.includes("biomedical")) {
    return true;
  }

  if (input.claimTypes.includes("patent") && !input.reviews.some((review) => review.strength === "protocol" || review.strength === "strong")) {
    return true;
  }

  return input.reviews.every((review) => review.strength !== "strong");
}

function classifyClaim(
  claim: string,
  evidenceRefs: InventionEvidenceRef[],
  reviews: EvidenceAuditReview[]
): EvidenceAuditClaimType[] {
  const types = new Set<EvidenceAuditClaimType>();
  const normalized = claim.toLowerCase();

  if (/\b(prove|proof|lemma|for all|integer|rational|equals|equation|derive|simplify|factor|integrate|differentiate)\b/i.test(claim)) {
    types.add("math");
  }

  if (
    /\b(source|paper|citation|literature|study|prior art|patent search|pubmed|arxiv)\b/i.test(claim) ||
    evidenceRefs.some((ref) => ref.kind === "source" || ref.kind === "literature")
  ) {
    types.add("source-grounded");
  }

  if (/\b(simulation|model|simulated|ODE|solver|molecular|physics|climate|materials?)\b/i.test(claim) || evidenceRefs.some((ref) => ref.kind === "simulation")) {
    types.add("simulation");
  }

  if (/\b(experiment|assay|wet[- ]lab|protocol|observed|bench[- ]test|clinical|preclinical)\b/i.test(claim) || evidenceRefs.some((ref) => ref.kind === "experiment")) {
    types.add("experiment");
  }

  if (/\b(cancer|hair loss|disease|rare disease|drug|therapy|treatment|patient|clinical|preclinical|efficacy|safety|medicine|biolog(?:y|ical)|molecular|ligand|protein)\b/i.test(claim)) {
    types.add("biomedical");
  }

  if (/\b(patent|novel|non[- ]obvious|claim chart|invention|provisional|prior art|reduction to practice)\b/i.test(claim)) {
    types.add("patent");
  }

  if (/\b(engineer|system|constraint|unit|dimension|energy|materials?|device|manufactur|optimi[sz]ation)\b/i.test(claim)) {
    types.add("engineering");
  }

  if (reviews.some((review) => review.kind === "source" || review.kind === "literature")) {
    types.add("source-grounded");
  }

  if (types.size === 0 || normalized.length === 0) {
    types.add("general");
  }

  return [...types];
}

function summarizeEvidence(reviews: EvidenceAuditReview[]): EvidenceAudit["evidenceSummary"] {
  const byKind: Record<string, number> = {};
  const byTrust: Partial<Record<TrustLabel, number>> = {};
  const byStrength: Record<EvidenceAuditStrength, number> = {
    none: 0,
    weak: 0,
    context: 0,
    computational: 0,
    protocol: 0,
    strong: 0,
    refuting: 0
  };

  for (const review of reviews) {
    byKind[review.kind] = (byKind[review.kind] ?? 0) + 1;
    byStrength[review.strength] += 1;
    if (review.trust) {
      byTrust[review.trust] = (byTrust[review.trust] ?? 0) + 1;
    }
  }

  return {
    total: reviews.length,
    resolved: reviews.filter((review) => review.status === "resolved").length,
    referenced: reviews.filter((review) => review.status === "referenced").length,
    missing: reviews.filter((review) => review.status === "missing").length,
    byKind,
    byStrength,
    byTrust
  };
}

function overclaimWarningsFor(input: {
  claim: string;
  claimTypes: EvidenceAuditClaimType[];
  reviews: EvidenceAuditReview[];
  verdict: EvidenceAudit["verdict"];
}): string[] {
  const warnings = [
    "Evidence audits classify local evidence posture; they do not prove broad truth by themselves."
  ];

  if (input.verdict.status === "overclaimed") {
    warnings.push("The claim should be rewritten as a hypothesis or narrowed to the exact evidence scope before sharing.");
  }

  if (input.claimTypes.includes("biomedical")) {
    warnings.push("Biomedical claims require expert review and may require wet-lab, preclinical, clinical, safety, ethics, and regulatory validation.");
  }

  if (input.claimTypes.includes("simulation")) {
    warnings.push("Simulation evidence is not reality; record assumptions, uncertainty, limitations, and real-world validation requirements.");
  }

  if (input.claimTypes.includes("patent")) {
    warnings.push("Patent or invention conclusions require prior-art search and human legal review; this audit is not a patentability opinion.");
  }

  if (input.reviews.some((review) => review.status === "missing")) {
    warnings.push("One or more evidence refs could not be resolved locally.");
  }

  return [...new Set(warnings)];
}

function nextChecksFor(input: {
  claimTypes: EvidenceAuditClaimType[];
  reviews: EvidenceAuditReview[];
  verdict: EvidenceAudit["verdict"];
}): string[] {
  const checks: string[] = [];

  if (input.reviews.length === 0 || input.verdict.status === "unsupported") {
    checks.push("Attach at least one local evidence ref: receipt, source, literature, notebook-run, code-run, simulation, experiment, vault, benchmark, or disclosure.");
  }

  if (input.reviews.some((review) => review.status === "missing")) {
    checks.push("Fix or remove missing evidence refs before relying on this claim.");
  }

  if (input.claimTypes.includes("math") && !input.reviews.some((review) => review.strength === "strong" || review.strength === "refuting")) {
    checks.push("Create a replayable proof, exact computation, counterexample, SMT, or CAS receipt for the mathematical claim.");
  }

  if (
    input.claimTypes.includes("source-grounded") &&
    !input.reviews.some((review) => review.kind === "source" || review.kind === "literature" || review.trust === "source-cited")
  ) {
    checks.push("Attach source-cited local retrieval or literature-record evidence and check whether the cited text actually entails the claim.");
  }

  if (input.claimTypes.includes("simulation") && !input.reviews.some((review) => review.kind === "simulation" || review.kind === "notebook-run")) {
    checks.push("Attach a local simulation log or notebook-run record with assumptions, uncertainty, limitations, environment, outputs, and next validation checks.");
  }

  if (input.claimTypes.includes("biomedical")) {
    checks.push("Record expert review and required wet-lab, preclinical, clinical, safety, ethics, or regulatory validation before efficacy or cure claims.");
  }

  if (input.claimTypes.includes("patent")) {
    checks.push("Attach prior-art notes, claim charts, reduction-to-practice evidence, and human patent-attorney review before filing decisions.");
  }

  if (input.verdict.status === "overclaimed") {
    checks.push("Rewrite the claim to match the evidence scope and label unsupported parts as hypotheses.");
  }

  return [...new Set(checks)];
}

function warningsForReceipt(receipt: Receipt): string[] {
  const warnings: string[] = [];

  if (receipt.trust === "unverified") {
    warnings.push(`Receipt ${receipt.runId} is unverified and cannot support the claim.`);
  }

  if (receipt.trust === "source-cited") {
    warnings.push(`Receipt ${receipt.runId} is source-cited retrieval, not proof of entailment or real-world validity.`);
  }

  if (receipt.trust === "dimension-checked") {
    warnings.push(`Receipt ${receipt.runId} checks dimensional consistency only, not full physical truth.`);
  }

  if (receipt.trust === "bounded-numeric") {
    warnings.push(`Receipt ${receipt.runId} gives bounded numeric evidence under stated intervals, not a global proof.`);
  }

  return warnings;
}

function strengthForReceipt(receipt: Receipt): EvidenceAuditStrength {
  if (receipt.trust === "refuted") {
    return "refuting";
  }

  if (receipt.trust === "proved" || receipt.trust === "exact-computed" || receipt.trust === "smt-checked" || receipt.trust === "cross-checked") {
    return "strong";
  }

  if (receipt.trust === "bounded-numeric" || receipt.trust === "dimension-checked") {
    return "computational";
  }

  if (receipt.trust === "source-cited") {
    return "context";
  }

  return "weak";
}

function missingReview(ref: InventionEvidenceRef, summary: string): EvidenceAuditReview {
  return {
    kind: ref.kind,
    ref: ref.ref,
    status: "missing",
    strength: "none",
    trust: ref.trust,
    summary,
    warnings: [`Missing local evidence: ${ref.kind}:${ref.ref}`]
  };
}

function invalidReceiptReview(ref: InventionEvidenceRef, error: ReceiptValidationError): EvidenceAuditReview {
  const issueSummary = error.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ");

  return {
    kind: "receipt",
    ref: ref.ref,
    status: "missing",
    strength: "none",
    trust: ref.trust,
    summary: "Receipt file failed receipt schema validation and cannot be used as evidence.",
    warnings: [`Invalid receipt evidence: ${ref.ref}${issueSummary ? ` (${issueSummary})` : ""}`]
  };
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before creating evidence audits.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function summarizeVaultEnvelope(entry: VaultEnvelope): VaultEnvelopeSummary {
  return {
    schemaVersion: entry.schemaVersion,
    vaultId: entry.vaultId,
    projectId: entry.projectId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    label: entry.label,
    payloadContentType: entry.payloadContentType,
    payloadBytes: entry.payloadBytes,
    ciphertextBytes: entry.ciphertextBytes,
    ciphertextSha256: entry.ciphertextSha256,
    encryption: {
      algorithm: entry.encryption.algorithm,
      kdf: entry.encryption.kdf,
      keyPolicy: entry.encryption.keyPolicy,
      keyRef: entry.encryption.keyRef
    },
    privacy: entry.privacy,
    warnings: entry.warnings
  };
}

function normalizeEvidenceRefs(values: InventionEvidenceRef[]): InventionEvidenceRef[] {
  return values.map((value) => ({
    kind: value.kind,
    ref: requireText(value.ref, "Evidence ref is required."),
    trust: value.trust,
    summary: normalizeOptionalText(value.summary)
  }));
}

function hasStrongClaimLanguage(claim: string): boolean {
  return /\b(cures?|proves?|proven|guaranteed|safe|effective|validated|solves?|breakthrough|clinically|approved|patentable|novel)\b/i.test(
    claim
  );
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Evidence audit path escapes workspace root: ${JSON.stringify(path)}`);
  }

  return target;
}

function titleFromClaim(claim: string): string {
  return claim.length <= 72 ? claim : `${claim.slice(0, 69)}...`;
}

function requireText(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

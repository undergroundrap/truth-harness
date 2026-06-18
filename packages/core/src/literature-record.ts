import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export const LITERATURE_RECORD_KINDS = [
  "paper",
  "preprint",
  "patent",
  "dataset",
  "database-export",
  "book",
  "web-page",
  "protocol",
  "standard",
  "note",
  "other"
] as const;

export const LITERATURE_RECORD_STATUSES = [
  "unreviewed",
  "triaged",
  "read",
  "annotated",
  "reproduced",
  "replicated",
  "disputed",
  "retracted",
  "superseded"
] as const;

export const LITERATURE_IDENTIFIER_KINDS = [
  "doi",
  "pmid",
  "pmcid",
  "arxiv",
  "isbn",
  "patent",
  "url",
  "local-path",
  "other"
] as const;

export type LiteratureRecordKind = (typeof LITERATURE_RECORD_KINDS)[number];
export type LiteratureRecordStatus = (typeof LITERATURE_RECORD_STATUSES)[number];
export type LiteratureIdentifierKind = (typeof LITERATURE_IDENTIFIER_KINDS)[number];

export interface LiteratureIdentifier {
  kind: LiteratureIdentifierKind;
  value: string;
}

export interface LiteratureRecord {
  schemaVersion: typeof LITERATURE_RECORD_SCHEMA_VERSION;
  recordId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  kind: LiteratureRecordKind;
  status: LiteratureRecordStatus;
  authors: string[];
  venue?: string;
  year?: number;
  identifiers: LiteratureIdentifier[];
  localRefs: string[];
  corpusRefs: string[];
  evidenceRefs: string[];
  summary?: string;
  keyClaims: string[];
  methodNotes: string[];
  limitations: string[];
  relevance: string[];
  qualityFlags: string[];
  nextChecks: string[];
  reviewBoundary: {
    sourceRecordOnly: true;
    sourceRetrievalIsNotEntailment: true;
    requiresEntailmentReview: boolean;
    requiresDomainExpertReview: boolean;
    requiresReplicationForScientificClaims: boolean;
    requiresPatentLegalReview: boolean;
    requiredNextChecks: string[];
  };
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface CreateLiteratureRecordInput {
  rootPath: string;
  title: string;
  kind?: LiteratureRecordKind;
  status?: LiteratureRecordStatus;
  authors?: string[];
  venue?: string;
  year?: number;
  identifiers?: LiteratureIdentifier[];
  localRefs?: string[];
  corpusRefs?: string[];
  evidenceRefs?: string[];
  summary?: string;
  keyClaims?: string[];
  methodNotes?: string[];
  limitations?: string[];
  relevance?: string[];
  qualityFlags?: string[];
  nextChecks?: string[];
  now?: string;
}

export interface LiteratureRecordWriteResult {
  record: LiteratureRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

const LITERATURE_RECORD_SCHEMA_VERSION = "truth-harness.literature.v0" as const;

export function isLiteratureRecordKind(value: string): value is LiteratureRecordKind {
  return (LITERATURE_RECORD_KINDS as readonly string[]).includes(value);
}

export function isLiteratureRecordStatus(value: string): value is LiteratureRecordStatus {
  return (LITERATURE_RECORD_STATUSES as readonly string[]).includes(value);
}

export function isLiteratureIdentifierKind(value: string): value is LiteratureIdentifierKind {
  return (LITERATURE_IDENTIFIER_KINDS as readonly string[]).includes(value);
}

export async function createLiteratureRecord(input: CreateLiteratureRecordInput): Promise<LiteratureRecord> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const title = requireText(input.title, "Literature record title is required.");
  const kind = input.kind ?? "paper";
  const recordStatus = input.status ?? "unreviewed";
  const summary = normalizeOptionalText(input.summary);
  const keyClaims = normalizeStringList(input.keyClaims ?? []);
  const methodNotes = normalizeStringList(input.methodNotes ?? []);
  const limitations = normalizeStringList(input.limitations ?? []);
  const relevance = normalizeStringList(input.relevance ?? []);
  const qualityFlags = normalizeStringList(input.qualityFlags ?? []);
  const nextChecks = normalizeStringList(input.nextChecks ?? []);
  const identifiers = normalizeIdentifiers(input.identifiers ?? []);
  const recordWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    title,
    kind,
    status: recordStatus,
    authors: normalizeStringList(input.authors ?? []),
    venue: normalizeOptionalText(input.venue),
    year: input.year,
    identifiers,
    localRefs: normalizeStringList(input.localRefs ?? []),
    corpusRefs: normalizeStringList(input.corpusRefs ?? []),
    evidenceRefs: normalizeStringList(input.evidenceRefs ?? []),
    summary,
    keyClaims,
    methodNotes,
    limitations,
    relevance,
    qualityFlags,
    nextChecks
  };
  const recordId = `lit_${stableHash(recordWithoutId).slice(0, 16)}`;
  const reviewBoundary = reviewBoundaryFor({ kind, status: recordStatus, title, summary, keyClaims, relevance, nextChecks });
  const record: LiteratureRecord = {
    schemaVersion: LITERATURE_RECORD_SCHEMA_VERSION,
    recordId,
    ...recordWithoutId,
    updatedAt: createdAt,
    reviewBoundary,
    privacy: manifest.privacy,
    warnings: warningsFor({
      kind,
      status: recordStatus,
      title,
      summary,
      identifiers,
      localRefs: recordWithoutId.localRefs,
      corpusRefs: recordWithoutId.corpusRefs,
      keyClaims,
      methodNotes,
      limitations,
      qualityFlags,
      reviewBoundary
    })
  };

  return record;
}

export async function writeLiteratureRecord(input: CreateLiteratureRecordInput): Promise<LiteratureRecordWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const record = await createLiteratureRecord(input);
  await assertLiteratureRecordSchema(record);
  const literatureDir = resolve(status.root, status.manifest.directories.literature);
  await mkdir(literatureDir, { recursive: true });
  const baseName = `${record.createdAt.slice(0, 10)}-${record.recordId}`;
  const jsonPath = join(literatureDir, `${baseName}.json`);
  const markdownPath = join(literatureDir, `${baseName}.md`);
  const markdown = renderLiteratureRecordMarkdown(record);
  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "literature",
    now: record.createdAt,
    staleReason: "literature record written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

async function assertLiteratureRecordSchema(record: LiteratureRecord): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: record,
    schemaFile: "literature-record.schema.json",
    artifactName: "Literature record"
  });
}

export async function listLiteratureRecords(rootPath: string): Promise<LiteratureRecord[]> {
  const status = await requireLocalWorkspace(rootPath);
  const literatureDir = resolve(status.root, status.manifest.directories.literature);

  let files: string[];
  try {
    files = await readdir(literatureDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const records = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => parseJsonWithOptionalBom(await readFile(join(literatureDir, file), "utf8")) as LiteratureRecord)
  );

  return records
    .filter((record) => record.schemaVersion === LITERATURE_RECORD_SCHEMA_VERSION)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function renderLiteratureRecordMarkdown(record: LiteratureRecord): string {
  const lines = [
    `# ${record.title}`,
    "",
    `Record: \`${record.recordId}\``,
    `Kind/status: \`${record.kind}\` / \`${record.status}\``,
    `Created: ${record.createdAt}`,
    `Privacy: ${record.privacy.mode} (network: ${record.privacy.networkAccess})`
  ];

  if (record.authors.length > 0) {
    lines.push(`Authors: ${record.authors.join(", ")}`);
  }

  if (record.venue || record.year) {
    lines.push(`Venue/year: ${record.venue ?? "unknown"} / ${record.year ?? "unknown"}`);
  }

  if (record.identifiers.length > 0) {
    lines.push("", "## Identifiers", "");
    for (const identifier of record.identifiers) {
      lines.push(`- \`${identifier.kind}:${identifier.value}\``);
    }
  }

  pushOptionalSection(lines, "Summary", record.summary ? [record.summary] : []);
  pushOptionalSection(lines, "Key Claims", record.keyClaims);
  pushOptionalSection(lines, "Methods", record.methodNotes);
  pushOptionalSection(lines, "Limitations", record.limitations);
  pushOptionalSection(lines, "Relevance", record.relevance);
  pushOptionalSection(lines, "Quality Flags", record.qualityFlags);
  pushOptionalSection(lines, "Local Refs", record.localRefs);
  pushOptionalSection(lines, "Corpus Refs", record.corpusRefs);
  pushOptionalSection(lines, "Evidence Refs", record.evidenceRefs);
  pushOptionalSection(lines, "Next Checks", record.reviewBoundary.requiredNextChecks);

  if (record.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of record.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "This literature record is local evidence organization. It is not proof of entailment, experimental validity, medical advice, regulatory approval, or a patentability opinion."
  );

  return `${lines.join("\n")}\n`;
}

function reviewBoundaryFor(input: {
  kind: LiteratureRecordKind;
  status: LiteratureRecordStatus;
  title: string;
  summary?: string;
  keyClaims: string[];
  relevance: string[];
  nextChecks: string[];
}): LiteratureRecord["reviewBoundary"] {
  const text = [input.kind, input.status, input.title, input.summary, ...input.keyClaims, ...input.relevance].join(" ");
  const biomedical = /\b(biomedical|clinical|cancer|tumou?r|drug|therapy|disease|hair[- ]?loss|patient|preclinical)\b/i.test(text);
  const patent = input.kind === "patent" || /\b(patent|prior art|claim|novelty|obviousness|invent)\b/i.test(text);
  const scientific = ["paper", "preprint", "dataset", "database-export", "protocol", "standard"].includes(input.kind);
  const requiredNextChecks = input.nextChecks.length > 0 ? input.nextChecks : defaultNextChecks({ biomedical, patent, scientific });

  return {
    sourceRecordOnly: true,
    sourceRetrievalIsNotEntailment: true,
    requiresEntailmentReview: true,
    requiresDomainExpertReview: biomedical || scientific,
    requiresReplicationForScientificClaims: scientific,
    requiresPatentLegalReview: patent,
    requiredNextChecks
  };
}

function defaultNextChecks(input: { biomedical: boolean; patent: boolean; scientific: boolean }): string[] {
  const checks = [
    "check exact claim entailment against the cited passage or local source",
    "attach local corpus/source refs and a workspace snapshot before relying on this record"
  ];

  if (input.scientific) {
    checks.push("compare methods, assumptions, and limitations against independent sources");
  }

  if (input.biomedical) {
    checks.push("record domain expert review before biomedical, safety, or clinical conclusions");
  }

  if (input.patent) {
    checks.push("record prior-art search scope and patent-attorney review before patentability language");
  }

  return checks;
}

function warningsFor(input: {
  kind: LiteratureRecordKind;
  status: LiteratureRecordStatus;
  title: string;
  summary?: string;
  identifiers: LiteratureIdentifier[];
  localRefs: string[];
  corpusRefs: string[];
  keyClaims: string[];
  methodNotes: string[];
  limitations: string[];
  qualityFlags: string[];
  reviewBoundary: LiteratureRecord["reviewBoundary"];
}): string[] {
  const warnings = [
    "Literature records organize local source evidence; they do not prove that a claim is true.",
    "Citation or retrieval is not entailment. Check the exact claim wording against the local source."
  ];
  const text = [input.kind, input.status, input.title, input.summary, ...input.keyClaims, ...input.qualityFlags].join(" ");

  if (input.identifiers.length === 0) {
    warnings.push("No DOI, PMID, arXiv, patent, URL, local-path, or other identifier was recorded.");
  }

  if (input.localRefs.length === 0 && input.corpusRefs.length === 0) {
    warnings.push("No local source or corpus refs were attached; reviewers need the actual local evidence, not just metadata.");
  }

  if (input.keyClaims.length === 0) {
    warnings.push("No key claims were extracted from the source.");
  }

  if (input.methodNotes.length === 0 && ["paper", "preprint", "dataset", "database-export", "protocol"].includes(input.kind)) {
    warnings.push("No methods or data provenance notes were recorded.");
  }

  if (input.limitations.length === 0) {
    warnings.push("No source limitations were recorded.");
  }

  if (input.status === "retracted" || input.status === "disputed" || /\b(retracted|withdrawn|disputed|expression of concern)\b/i.test(text)) {
    warnings.push("This source is marked retracted, disputed, withdrawn, or concern-bearing; do not use it as positive support without expert review.");
  }

  if (input.reviewBoundary.requiresDomainExpertReview) {
    warnings.push("Domain expert review is required before strong scientific, biomedical, safety, or clinical conclusions.");
  }

  if (input.reviewBoundary.requiresPatentLegalReview) {
    warnings.push("Patent and prior-art records require human patent/legal review before novelty, non-obviousness, freedom-to-operate, or filing-readiness conclusions.");
  }

  return warnings;
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing literature records.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function pushOptionalSection(lines: string[], title: string, values: string[]): void {
  if (values.length === 0) {
    return;
  }

  lines.push("", `## ${title}`, "");
  for (const value of values) {
    lines.push(`- ${value}`);
  }
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

function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value)))];
}

function normalizeIdentifiers(values: LiteratureIdentifier[]): LiteratureIdentifier[] {
  const seen = new Set<string>();
  const normalized: LiteratureIdentifier[] = [];
  for (const value of values) {
    const identifier = {
      kind: value.kind,
      value: requireText(value.value, "Literature identifier value is required.")
    };
    const key = `${identifier.kind}:${identifier.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(identifier);
    }
  }

  return normalized;
}

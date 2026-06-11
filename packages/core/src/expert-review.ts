import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";

export const EXPERT_REVIEW_KINDS = [
  "math",
  "physics",
  "engineering",
  "software",
  "biomedical",
  "clinical",
  "safety",
  "ethics",
  "regulatory",
  "patent-legal",
  "domain-expert",
  "other"
] as const;

export const EXPERT_REVIEW_STATUSES = ["needed", "requested", "in-review", "completed", "rejected", "superseded"] as const;

export const EXPERT_REVIEW_OUTCOMES = [
  "not-reviewed",
  "needs-more-evidence",
  "supported-with-limitations",
  "not-supported",
  "inconclusive",
  "requires-validation",
  "legal-review-only"
] as const;

export type ExpertReviewKind = (typeof EXPERT_REVIEW_KINDS)[number];
export type ExpertReviewStatus = (typeof EXPERT_REVIEW_STATUSES)[number];
export type ExpertReviewOutcome = (typeof EXPERT_REVIEW_OUTCOMES)[number];

export interface ExpertReviewEvidenceRef {
  kind:
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
    | "session"
    | "review"
    | "validation"
    | "model-context"
    | "invention"
    | "claim-chart"
    | "discovery-package"
    | "other";
  ref: string;
  trust?: TrustLabel;
  summary?: string;
}

export interface ExpertReviewRecord {
  schemaVersion: "theorem.expert-review.v0";
  reviewId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  subject: string;
  question: string;
  kind: ExpertReviewKind;
  status: ExpertReviewStatus;
  reviewer: {
    role: string;
    nameOrOrg?: string;
    credentials?: string;
    conflictDisclosure: string;
  };
  evidenceRefs: ExpertReviewEvidenceRef[];
  findings: string[];
  limitations: string[];
  recommendations: string[];
  requiredNextChecks: string[];
  outcome: {
    status: ExpertReviewOutcome;
    summary: string;
  };
  boundary: {
    humanReviewRecord: true;
    notProof: true;
    notMedicalAdvice: true;
    notRegulatoryApproval: true;
    notLegalAdvice: true;
    requiresIndependentVerification: true;
  };
  privacy: PrivacyMetadata;
  warnings: string[];
  markdown: string;
}

export interface CreateExpertReviewInput {
  rootPath: string;
  title?: string;
  subject: string;
  question?: string;
  kind?: ExpertReviewKind;
  status?: ExpertReviewStatus;
  reviewerRole: string;
  reviewerNameOrOrg?: string;
  reviewerCredentials?: string;
  conflictDisclosure?: string;
  evidenceRefs?: ExpertReviewEvidenceRef[];
  findings?: string[];
  limitations?: string[];
  recommendations?: string[];
  requiredNextChecks?: string[];
  outcomeStatus?: ExpertReviewOutcome;
  outcomeSummary?: string;
  now?: string;
}

export interface ExpertReviewWriteResult {
  review: ExpertReviewRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export function isExpertReviewKind(value: string): value is ExpertReviewKind {
  return (EXPERT_REVIEW_KINDS as readonly string[]).includes(value);
}

export function isExpertReviewStatus(value: string): value is ExpertReviewStatus {
  return (EXPERT_REVIEW_STATUSES as readonly string[]).includes(value);
}

export function isExpertReviewOutcome(value: string): value is ExpertReviewOutcome {
  return (EXPERT_REVIEW_OUTCOMES as readonly string[]).includes(value);
}

export async function createExpertReview(input: CreateExpertReviewInput): Promise<ExpertReviewRecord> {
  const status = await requireLocalWorkspace(input.rootPath);
  const manifest = status.manifest;
  const createdAt = input.now ?? new Date().toISOString();
  const subject = requireText(input.subject, "Expert review subject is required.");
  const kind = input.kind ?? inferReviewKind(subject, input.question);
  const reviewStatus = input.status ?? "needed";
  const findings = normalizeStringList(input.findings ?? []);
  const limitations = normalizeStringList(input.limitations ?? []);
  const recommendations = normalizeStringList(input.recommendations ?? []);
  const requiredNextChecks = normalizeStringList(input.requiredNextChecks ?? []);
  const outcome = {
    status: input.outcomeStatus ?? defaultOutcomeForStatus(reviewStatus),
    summary: normalizeOptionalText(input.outcomeSummary) ?? defaultOutcomeSummary(reviewStatus)
  };
  const reviewWithoutId = {
    projectId: manifest.projectId,
    createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromSubject(subject),
    subject,
    question: normalizeOptionalText(input.question) ?? "Review the attached evidence and scope.",
    kind,
    status: reviewStatus,
    reviewer: {
      role: requireText(input.reviewerRole, "Expert review reviewer role is required."),
      nameOrOrg: normalizeOptionalText(input.reviewerNameOrOrg),
      credentials: normalizeOptionalText(input.reviewerCredentials),
      conflictDisclosure: normalizeOptionalText(input.conflictDisclosure) ?? "not-recorded"
    },
    evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs ?? []),
    findings,
    limitations,
    recommendations,
    requiredNextChecks,
    outcome,
    boundary: boundary(),
    privacy: manifest.privacy,
    warnings: warningsFor({ kind, status: reviewStatus, findings, limitations, requiredNextChecks, outcome })
  };
  const reviewId = `review_${stableHash(reviewWithoutId).slice(0, 16)}`;
  const review: Omit<ExpertReviewRecord, "markdown"> = {
    schemaVersion: "theorem.expert-review.v0",
    reviewId,
    ...reviewWithoutId,
    updatedAt: createdAt
  };

  return {
    ...review,
    markdown: renderExpertReviewMarkdown(review)
  };
}

export async function writeExpertReview(input: CreateExpertReviewInput): Promise<ExpertReviewWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const review = await createExpertReview(input);
  const reviewsDir = resolve(status.root, status.manifest.directories.reviews);
  await mkdir(reviewsDir, { recursive: true });
  const baseName = `${review.createdAt.slice(0, 10)}-${review.reviewId}`;
  const jsonPath = join(reviewsDir, `${baseName}.json`);
  const markdownPath = join(reviewsDir, `${baseName}.md`);

  await writeFile(jsonPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, review.markdown, "utf8");

  return {
    review,
    jsonPath,
    markdownPath,
    markdown: review.markdown
  };
}

export async function listExpertReviews(rootPath: string): Promise<ExpertReviewRecord[]> {
  const status = await requireLocalWorkspace(rootPath);
  const reviewsDir = resolve(status.root, status.manifest.directories.reviews);

  let files: string[];
  try {
    files = await readdir(reviewsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const reviews = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => JSON.parse(await readFile(join(reviewsDir, file), "utf8")) as ExpertReviewRecord)
  );

  return reviews
    .filter((review) => review.schemaVersion === "theorem.expert-review.v0")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function renderExpertReviewMarkdown(review: Omit<ExpertReviewRecord, "markdown">): string {
  const lines: string[] = [
    `# Expert Review: ${escapeMarkdownText(review.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Review | \`${review.reviewId}\` |`,
    `| Created | ${escapeMarkdownTable(review.createdAt)} |`,
    `| Kind | \`${review.kind}\` |`,
    `| Status | \`${review.status}\` |`,
    `| Outcome | \`${review.outcome.status}\` |`,
    `| Reviewer role | ${escapeMarkdownTable(review.reviewer.role)} |`,
    `| Privacy | \`${review.privacy.mode}\` / network \`${review.privacy.networkAccess}\` |`,
    "",
    "## Subject",
    "",
    escapeMarkdownText(review.subject),
    "",
    "## Question",
    "",
    escapeMarkdownText(review.question),
    "",
    "## Outcome",
    "",
    escapeMarkdownText(review.outcome.summary),
    "",
    "## Evidence",
    "",
    "| Kind | Trust | Reference | Summary |",
    "| --- | --- | --- | --- |"
  ];

  if (review.evidenceRefs.length === 0) {
    lines.push("|  |  |  | No evidence refs attached yet. |");
  } else {
    for (const ref of review.evidenceRefs) {
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

  appendSection(lines, "Findings", review.findings);
  appendSection(lines, "Limitations", review.limitations);
  appendSection(lines, "Recommendations", review.recommendations);
  appendSection(lines, "Required Next Checks", review.requiredNextChecks);
  appendSection(lines, "Warnings", review.warnings);

  lines.push(
    "",
    "## Boundary",
    "",
    "This record captures a review artifact and its scope. It is not proof, medical advice, regulatory approval, or legal advice."
  );

  return `${lines.join("\n")}\n`;
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Theorem workspace found. Run `theorem workspace init` before writing expert reviews.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function boundary(): ExpertReviewRecord["boundary"] {
  return {
    humanReviewRecord: true,
    notProof: true,
    notMedicalAdvice: true,
    notRegulatoryApproval: true,
    notLegalAdvice: true,
    requiresIndependentVerification: true
  };
}

function inferReviewKind(subject: string, question: string | undefined): ExpertReviewKind {
  const normalized = `${subject} ${question ?? ""}`.toLowerCase();
  if (/\b(theorem|proof|lemma|equation|math)\b/i.test(normalized)) {
    return "math";
  }
  if (/\b(code|software|test|api|compiler)\b/i.test(normalized)) {
    return "software";
  }
  if (/\b(cancer|hair loss|disease|drug|therapy|clinical|patient|protein|biomedical)\b/i.test(normalized)) {
    return "biomedical";
  }
  if (/\b(regulatory|fda|approval|compliance)\b/i.test(normalized)) {
    return "regulatory";
  }
  if (/\b(patent|claim|prior art|novelty|non-obvious)\b/i.test(normalized)) {
    return "patent-legal";
  }

  return "domain-expert";
}

function defaultOutcomeForStatus(status: ExpertReviewStatus): ExpertReviewOutcome {
  if (status === "completed") {
    return "inconclusive";
  }

  if (status === "rejected") {
    return "not-reviewed";
  }

  return "not-reviewed";
}

function defaultOutcomeSummary(status: ExpertReviewStatus): string {
  if (status === "completed") {
    return "Review completed, but no outcome summary was recorded.";
  }

  return "Review outcome has not been completed or recorded yet.";
}

function warningsFor(input: {
  kind: ExpertReviewKind;
  status: ExpertReviewStatus;
  findings: string[];
  limitations: string[];
  requiredNextChecks: string[];
  outcome: ExpertReviewRecord["outcome"];
}): string[] {
  const warnings = [
    "Expert review records document human review scope and outcome; they do not replace independent verification or reproduce the reviewed evidence.",
    "Do not generalize beyond the evidence refs, reviewer role, stated findings, and recorded limitations."
  ];

  if (input.status !== "completed") {
    warnings.push("Review is not completed; do not cite it as completed expert support.");
  }

  if (input.status === "completed" && input.findings.length === 0) {
    warnings.push("Review is marked completed but no findings were recorded.");
  }

  if (input.limitations.length === 0) {
    warnings.push("No review limitations were recorded.");
  }

  if (input.requiredNextChecks.length === 0) {
    warnings.push("No required next checks were recorded.");
  }

  if (input.kind === "biomedical" || input.kind === "clinical" || input.kind === "safety") {
    warnings.push("Biomedical, clinical, and safety reviews do not establish safety, efficacy, clinical validity, or regulatory approval by themselves.");
  }

  if (input.kind === "patent-legal" || input.outcome.status === "legal-review-only") {
    warnings.push("Patent/legal review records are not a patentability guarantee, filing instruction, freedom-to-operate opinion, or legal advice from this software.");
  }

  return warnings;
}

function normalizeEvidenceRefs(values: ExpertReviewEvidenceRef[]): ExpertReviewEvidenceRef[] {
  return values.map((value) => ({
    kind: value.kind,
    ref: requireText(value.ref, "Expert review evidence ref is required."),
    trust: value.trust,
    summary: normalizeOptionalText(value.summary)
  }));
}

function appendSection(lines: string[], title: string, values: string[]): void {
  if (values.length === 0) {
    return;
  }

  lines.push("", `## ${title}`, "");
  for (const value of values) {
    lines.push(`- ${escapeMarkdownText(value)}`);
  }
}

function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value)))];
}

function requireText(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function titleFromSubject(subject: string): string {
  return subject.length <= 72 ? subject : `${subject.slice(0, 69)}...`;
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

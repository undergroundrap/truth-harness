import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { listInventionLogEntries, type InventionEvidenceRef, type InventionLogEntry } from "./invention-log.js";
import { parseReceiptJson, ReceiptValidationError } from "./receipt-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, Receipt, TrustLabel } from "./types.js";

export interface DiscoveryPackageInput {
  rootPath: string;
  entryId?: string;
  now?: string;
}

export interface DiscoveryEvidenceReview {
  kind: InventionEvidenceRef["kind"];
  ref: string;
  status: "resolved" | "referenced" | "missing";
  trust?: TrustLabel;
  summary: string;
  warnings: string[];
}

export interface DiscoveryPackage {
  schemaVersion: "truth-harness.discovery-package.v0";
  packageId: string;
  createdAt: string;
  projectId: string;
  entry: InventionLogEntry;
  evidenceReviews: DiscoveryEvidenceReview[];
  validation: {
    stage: InventionLogEntry["validationStage"];
    evidenceCount: number;
    resolvedReceiptCount: number;
    unresolvedEvidenceCount: number;
    required: string[];
    overclaimWarnings: string[];
  };
  patent: InventionLogEntry["patent"];
  privacy: PrivacyMetadata;
  markdown: string;
}

export interface DiscoveryPackageWriteResult {
  package: DiscoveryPackage;
  path: string;
}

export async function createDiscoveryPackage(input: DiscoveryPackageInput): Promise<DiscoveryPackage> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const entry = await findInventionEntry(input.rootPath, input.entryId);
  const evidenceReviews = await Promise.all(entry.evidenceRefs.map((ref) => reviewEvidenceRef(status.root, ref)));
  const validation = {
    stage: entry.validationStage,
    evidenceCount: entry.evidenceRefs.length,
    resolvedReceiptCount: evidenceReviews.filter((review) => review.kind === "receipt" && review.status === "resolved").length,
    unresolvedEvidenceCount: evidenceReviews.filter((review) => review.status !== "resolved").length,
    required: entry.safety.validationRequired,
    overclaimWarnings: entry.safety.overclaimWarnings
  };
  const packageId = `pkg_${stableHash({ entryId: entry.entryId, createdAt, evidenceReviews, validation }).slice(0, 16)}`;
  const basePackage = {
    schemaVersion: "truth-harness.discovery-package.v0" as const,
    packageId,
    createdAt,
    projectId: entry.projectId,
    entry,
    evidenceReviews,
    validation,
    patent: entry.patent,
    privacy: entry.privacy
  };
  const markdown = renderDiscoveryPackageMarkdown(basePackage);

  return {
    ...basePackage,
    markdown
  };
}

export async function writeDiscoveryPackage(input: DiscoveryPackageInput): Promise<DiscoveryPackageWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const discoveryPackage = await createDiscoveryPackage(input);
  const findingsDir = resolve(status.root, status.manifest.directories.findings);
  await mkdir(findingsDir, { recursive: true });
  const path = join(
    findingsDir,
    `${discoveryPackage.createdAt.slice(0, 10)}-${discoveryPackage.entry.entryId}-discovery-package.md`
  );
  await writeFile(path, discoveryPackage.markdown, "utf8");

  return {
    package: discoveryPackage,
    path
  };
}

export function renderDiscoveryPackageMarkdown(
  discoveryPackage: Omit<DiscoveryPackage, "markdown">
): string {
  const lines: string[] = [
    `# Discovery Package: ${escapeMarkdownText(discoveryPackage.entry.title)}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Package | \`${discoveryPackage.packageId}\` |`,
    `| Entry | \`${discoveryPackage.entry.entryId}\` |`,
    `| Created | ${escapeMarkdownTable(discoveryPackage.createdAt)} |`,
    `| Validation stage | \`${discoveryPackage.validation.stage}\` |`,
    `| Privacy | \`${discoveryPackage.privacy.mode}\` / network \`${discoveryPackage.privacy.networkAccess}\` |`,
    "",
    "## Problem",
    "",
    escapeMarkdownText(discoveryPackage.entry.problem),
    "",
    "## Hypothesis",
    "",
    escapeMarkdownText(discoveryPackage.entry.hypothesis),
    "",
    "## Evidence Review",
    "",
    "| Status | Kind | Trust | Reference | Summary |",
    "| --- | --- | --- | --- | --- |"
  ];

  if (discoveryPackage.evidenceReviews.length === 0) {
    lines.push("| `missing` | `none` |  |  | No evidence references were attached to this invention log. |");
  } else {
    for (const review of discoveryPackage.evidenceReviews) {
      lines.push(
        [
          `\`${review.status}\``,
          `\`${review.kind}\``,
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

  lines.push("", "## Validation Required", "");
  for (const item of discoveryPackage.validation.required) {
    lines.push(`- ${escapeMarkdownText(item)}`);
  }

  lines.push("", "## Overclaim Warnings", "");
  for (const warning of discoveryPackage.validation.overclaimWarnings) {
    lines.push(`- ${escapeMarkdownText(warning)}`);
  }

  const evidenceWarnings = discoveryPackage.evidenceReviews.flatMap((review) => review.warnings);
  if (evidenceWarnings.length > 0) {
    lines.push("", "## Evidence Warnings", "");
    for (const warning of evidenceWarnings) {
      lines.push(`- ${escapeMarkdownText(warning)}`);
    }
  }

  lines.push("", "## Patent Posture", "");
  lines.push(`- Human review required: \`${String(discoveryPackage.patent.humanReviewRequired)}\``);
  lines.push(`- Legal conclusion: \`${discoveryPackage.patent.legalConclusion}\``);
  lines.push(`- Provisional draft ready: \`${String(discoveryPackage.patent.provisionalDraftReady)}\``);
  for (const note of discoveryPackage.patent.notes) {
    lines.push(`- ${escapeMarkdownText(note)}`);
  }

  lines.push("", "## Next Checks", "");
  if (discoveryPackage.entry.nextChecks.length === 0) {
    lines.push("- Add concrete next checks before treating this as a discovery package.");
  } else {
    for (const check of discoveryPackage.entry.nextChecks) {
      lines.push(`- ${escapeMarkdownText(check)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function findInventionEntry(rootPath: string, entryId: string | undefined): Promise<InventionLogEntry> {
  const entries = await listInventionLogEntries(rootPath);
  if (entries.length === 0) {
    throw new Error("No invention logs found. Run `truth-harness invention log` before creating a discovery package.");
  }

  if (!entryId) {
    return entries[0];
  }

  const entry = entries.find((candidate) => candidate.entryId === entryId);
  if (!entry) {
    throw new Error(`No invention log found for entry id ${JSON.stringify(entryId)}.`);
  }

  return entry;
}

async function reviewEvidenceRef(root: string, ref: InventionEvidenceRef): Promise<DiscoveryEvidenceReview> {
  if (ref.kind !== "receipt") {
    const warning = warningForReferencedEvidence(ref);

    return {
      kind: ref.kind,
      ref: ref.ref,
      status: "referenced",
      trust: ref.trust,
      summary: ref.summary ?? "Reference recorded; this package does not resolve non-receipt evidence yet.",
      warnings: [warning]
    };
  }

  const path = resolveUnderRoot(root, ref.ref);
  try {
    const receipt = parseReceiptJson(await readFile(path, "utf8"), ref.ref);
    return {
      kind: ref.kind,
      ref: ref.ref,
      status: "resolved",
      trust: receipt.trust,
      summary: receipt.summary,
      warnings: warningsForReceipt(receipt)
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {
        kind: ref.kind,
        ref: ref.ref,
        status: "missing",
        trust: ref.trust,
        summary: "Receipt file was not found under the local workspace root.",
        warnings: [`Missing receipt evidence: ${ref.ref}`]
      };
    }

    if (error instanceof ReceiptValidationError) {
      return invalidReceiptReview(ref, error);
    }

    throw error;
  }
}

function invalidReceiptReview(ref: InventionEvidenceRef, error: ReceiptValidationError): DiscoveryEvidenceReview {
  const issueSummary = error.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ");

  return {
    kind: "receipt",
    ref: ref.ref,
    status: "missing",
    trust: ref.trust,
    summary: "Receipt file failed receipt schema validation and cannot be used as discovery evidence.",
    warnings: [`Invalid receipt evidence: ${ref.ref}${issueSummary ? ` (${issueSummary})` : ""}`]
  };
}

function warningForReferencedEvidence(ref: InventionEvidenceRef): string {
  if (ref.kind === "disclosure") {
    return "External disclosure records prove that selected context left the local workspace; they do not prove the external model or service output is true.";
  }

  if (ref.kind === "simulation") {
    return "Simulation records are computational evidence; they do not establish experimental validity, clinical efficacy, safety, regulatory validity, or real-world truth.";
  }

  if (ref.kind === "experiment") {
    return "Experiment records are provenance for a specific protocol and dataset; they still require expert review, replication, and any required ethics or regulatory review before broad claims.";
  }

  if (ref.kind === "vault") {
    return "Vault records preserve encrypted private evidence provenance; they do not reveal plaintext or independently prove the referenced claim.";
  }

  if (ref.kind === "review") {
    return "Expert review records capture scoped human review, limitations, and next checks; they are not standalone proof, medical advice, regulatory approval, or legal advice.";
  }

  if (ref.kind === "cas") {
    return "CAS checks can support scoped symbolic cross-checks, but they are not accepted proof-checker proofs or experimental validation.";
  }

  if (ref.kind === "validation") {
    return "Validation plans list required gates before stronger claims; they are checklists for review, not proof that the gates were satisfied.";
  }

  return `Evidence reference ${ref.ref} is recorded but not independently resolved by this package renderer.`;
}

function warningsForReceipt(receipt: Receipt): string[] {
  const warnings: string[] = [];
  if (receipt.trust === "unverified") {
    warnings.push(`Receipt ${receipt.runId} is unverified and cannot support a discovery claim.`);
  }

  if (receipt.trust === "source-cited") {
    warnings.push(`Receipt ${receipt.runId} is source-cited retrieval, not proof of entailment or real-world validity.`);
  }

  if (receipt.trust === "dimension-checked") {
    warnings.push(`Receipt ${receipt.runId} checks dimensional consistency only, not physical truth.`);
  }

  return warnings;
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before creating discovery packages.");
  }

  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}`);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Discovery package evidence path escapes workspace root: ${JSON.stringify(path)}`);
  }

  return target;
}

function escapeMarkdownTable(value: string): string {
  return escapeMarkdownText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

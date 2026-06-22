import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import type { TrustLabel } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export const HARD_MATH_CLOSURE_REPORT_SCHEMA_VERSION = "truth-harness.hard-math-closure.v0" as const;

export interface HardMathClosureGateEvidenceSummary {
  kind: string;
  trust?: TrustLabel;
  status?: string;
}

export interface HardMathClosureCaseReport {
  caseId: string;
  passed: boolean;
  requiredTrust?: string;
  transientWorkspacePath: string;
  transientWorkspaceCleaned: boolean;
  validationPlanId?: string;
  proofGateStatus?: string;
  gateEvidence: HardMathClosureGateEvidenceSummary[];
  executedSteps: number;
  attachedEvidenceSteps: number;
  loopStatus: string;
  loopStopReason: string;
  validationPassed: boolean;
  validationErrors: number;
  validationWarnings: number;
  evidenceSummary?: string;
  warnings: string[];
}

export interface HardMathClosureReport {
  schemaVersion: typeof HARD_MATH_CLOSURE_REPORT_SCHEMA_VERSION;
  closureId: string;
  createdAt: string;
  completedAt: string;
  localOnly: true;
  networkAccess: "none";
  reportWorkspacePath: string;
  runtime: {
    kind: "native" | "docker";
    command: string;
    containerized: boolean;
  };
  summary: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
    validationErrors: number;
    validationWarnings: number;
    cleanedTransientWorkspaces: number;
  };
  cases: HardMathClosureCaseReport[];
  trustBoundary: {
    reportIsNotProof: true;
    tempArtifactsMayBeCleaned: true;
    gatesCloseOnlyFromScopedEvidence: true;
    strongerClaimsNeedSeparateProof: true;
  };
  warnings: string[];
}

export interface WriteHardMathClosureReportInput {
  rootPath: string;
  createdAt?: string;
  completedAt?: string;
  runtime: HardMathClosureReport["runtime"];
  cases: HardMathClosureCaseReport[];
  warnings?: string[];
}

export interface HardMathClosureReportWriteResult {
  report: HardMathClosureReport;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface HardMathClosureReportSummary {
  closureId: string;
  path: string;
  createdAt: string;
  completedAt: string;
  runtimeKind: "native" | "docker";
  containerized: boolean;
  command: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  validationErrors: number;
  validationWarnings: number;
  cleanedTransientWorkspaces: number;
  caseIds: string[];
  passedCaseIds: string[];
  failedCaseIds: string[];
  trusts: string[];
  requiredTrusts: string[];
  warnings: string[];
}

export async function writeHardMathClosureReport(
  input: WriteHardMathClosureReportInput
): Promise<HardMathClosureReportWriteResult> {
  const workspace = await initLocalWorkspace(input.rootPath, {
    displayName: "Truth Harness",
    now: input.createdAt
  });
  const createdAt = input.createdAt ?? new Date().toISOString();
  const completedAt = input.completedAt ?? createdAt;
  const report: HardMathClosureReport = {
    schemaVersion: HARD_MATH_CLOSURE_REPORT_SCHEMA_VERSION,
    closureId: `hmc_${stableHash({
      createdAt,
      completedAt,
      runtime: input.runtime,
      cases: input.cases.map((closureCase) => ({
        caseId: closureCase.caseId,
        passed: closureCase.passed,
        gateEvidence: closureCase.gateEvidence
      }))
    }).slice(0, 12)}`,
    createdAt,
    completedAt,
    localOnly: true,
    networkAccess: "none",
    reportWorkspacePath: workspace.root,
    runtime: input.runtime,
    summary: summarizeCases(input.cases),
    cases: input.cases,
    trustBoundary: {
      reportIsNotProof: true,
      tempArtifactsMayBeCleaned: true,
      gatesCloseOnlyFromScopedEvidence: true,
      strongerClaimsNeedSeparateProof: true
    },
    warnings: [
      "This report records that closure smokes passed or failed; it is not proof of any broader mathematical claim.",
      "Transient workspace artifacts may be deleted after summary extraction.",
      ...(input.warnings ?? [])
    ]
  };

  await assertJsonSchemaBeforeWrite({
    value: report,
    schemaFile: "hard-math-closure.schema.json",
    artifactName: "Hard-math closure report"
  });

  const findingsDir = resolve(workspace.root, workspace.manifest.directories.findings);
  const baseName = `${report.createdAt.slice(0, 10)}-${report.closureId}-hard-math-closure`;
  const jsonPath = join(findingsDir, `${baseName}.json`);
  const markdownPath = join(findingsDir, `${baseName}.md`);
  const markdown = renderHardMathClosureReportMarkdown(report);

  await mkdir(findingsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, report);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: workspace.root,
    path: toPortablePath(relative(workspace.root, jsonPath)),
    kind: "findings",
    now: report.completedAt,
    staleReason: "hard-math closure report written"
  });

  return {
    report,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listHardMathClosureReports(rootPath: string): Promise<HardMathClosureReportSummary[]> {
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
        return summarizeHardMathClosureReport(status.root, path, await readFile(path, "utf8"));
      })
  );

  return summaries
    .filter((summary): summary is HardMathClosureReportSummary => summary !== undefined)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

export function renderHardMathClosureReportMarkdown(report: HardMathClosureReport): string {
  const lines = [
    "# Truth Harness Hard-Math Closure Report",
    "",
    `Closure: ${report.closureId}`,
    `Runtime: ${report.runtime.kind}${report.runtime.containerized ? " (containerized)" : ""}`,
    `Command: \`${report.runtime.command}\``,
    `Created: ${report.createdAt}`,
    `Completed: ${report.completedAt}`,
    "",
    "## Summary",
    "",
    `- Passed cases: ${report.summary.passedCases}/${report.summary.totalCases}`,
    `- Failed cases: ${report.summary.failedCases}`,
    `- Validation errors: ${report.summary.validationErrors}`,
    `- Validation warnings: ${report.summary.validationWarnings}`,
    `- Cleaned transient workspaces: ${report.summary.cleanedTransientWorkspaces}`,
    "",
    "## Cases",
    ""
  ];

  for (const closureCase of report.cases) {
    lines.push(
      `### ${closureCase.caseId}`,
      "",
      `- Status: ${closureCase.passed ? "passed" : "failed"}`,
      `- Required trust: ${closureCase.requiredTrust ?? "none"}`,
      `- Proof gate: ${closureCase.proofGateStatus ?? "missing"}`,
      `- Gate evidence: ${formatGateEvidence(closureCase.gateEvidence)}`,
      `- Executed steps: ${closureCase.executedSteps}`,
      `- Attached evidence steps: ${closureCase.attachedEvidenceSteps}`,
      `- Loop: ${closureCase.loopStatus} / ${closureCase.loopStopReason}`,
      `- Workspace validation: ${closureCase.validationPassed ? "passed" : "failed"} (${closureCase.validationErrors} errors, ${closureCase.validationWarnings} warnings)`,
      `- Transient workspace cleaned: ${closureCase.transientWorkspaceCleaned ? "yes" : "no"}`,
      closureCase.evidenceSummary ? `- Evidence summary: ${closureCase.evidenceSummary}` : "- Evidence summary: none",
      ""
    );
  }

  lines.push(
    "## Trust Boundary",
    "",
    "- This report is not proof.",
    "- Closure gates close only from scoped evidence inside the transient workspace.",
    "- Broader mathematical, scientific, medical, safety, regulatory, or patent claims need separate proof, validation, and review.",
    ""
  );

  if (report.warnings.length > 0) {
    lines.push("## Warnings", "");
    report.warnings.forEach((warning) => lines.push(`- ${warning}`));
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function summarizeCases(cases: HardMathClosureCaseReport[]): HardMathClosureReport["summary"] {
  return {
    totalCases: cases.length,
    passedCases: cases.filter((closureCase) => closureCase.passed).length,
    failedCases: cases.filter((closureCase) => !closureCase.passed).length,
    validationErrors: cases.reduce((total, closureCase) => total + closureCase.validationErrors, 0),
    validationWarnings: cases.reduce((total, closureCase) => total + closureCase.validationWarnings, 0),
    cleanedTransientWorkspaces: cases.filter((closureCase) => closureCase.transientWorkspaceCleaned).length
  };
}

function formatGateEvidence(gateEvidence: HardMathClosureGateEvidenceSummary[]): string {
  return gateEvidence.length > 0
    ? gateEvidence.map((evidence) => `${evidence.kind}:${evidence.trust ?? evidence.status ?? "unknown"}`).join(", ")
    : "none";
}

function toPortablePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function summarizeHardMathClosureReport(
  root: string,
  path: string,
  raw: string
): HardMathClosureReportSummary | undefined {
  let parsed: unknown;
  try {
    parsed = parseJsonWithOptionalBom(raw);
  } catch {
    return undefined;
  }

  if (!isHardMathClosureReport(parsed)) {
    return undefined;
  }

  const passedCases = parsed.cases.filter((closureCase) => closureCase.passed);
  const failedCases = parsed.cases.filter((closureCase) => !closureCase.passed);
  return {
    closureId: parsed.closureId,
    path: toPortablePath(relative(root, path)),
    createdAt: parsed.createdAt,
    completedAt: parsed.completedAt,
    runtimeKind: parsed.runtime.kind,
    containerized: parsed.runtime.containerized,
    command: parsed.runtime.command,
    totalCases: parsed.summary.totalCases,
    passedCases: parsed.summary.passedCases,
    failedCases: parsed.summary.failedCases,
    validationErrors: parsed.summary.validationErrors,
    validationWarnings: parsed.summary.validationWarnings,
    cleanedTransientWorkspaces: parsed.summary.cleanedTransientWorkspaces,
    caseIds: uniqueStrings(parsed.cases.map((closureCase) => closureCase.caseId)),
    passedCaseIds: uniqueStrings(passedCases.map((closureCase) => closureCase.caseId)),
    failedCaseIds: uniqueStrings(failedCases.map((closureCase) => closureCase.caseId)),
    trusts: uniqueStrings(
      parsed.cases.flatMap((closureCase) => closureCase.gateEvidence.map((evidence) => evidence.trust ?? evidence.status ?? "unknown"))
    ),
    requiredTrusts: uniqueStrings(parsed.cases.map((closureCase) => closureCase.requiredTrust ?? "").filter(Boolean)),
    warnings: parsed.warnings
  };
}

function isHardMathClosureReport(value: unknown): value is HardMathClosureReport {
  if (!isRecord(value) || value.schemaVersion !== HARD_MATH_CLOSURE_REPORT_SCHEMA_VERSION) {
    return false;
  }
  return (
    typeof value.closureId === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.completedAt === "string" &&
    isRecord(value.runtime) &&
    (value.runtime.kind === "native" || value.runtime.kind === "docker") &&
    typeof value.runtime.command === "string" &&
    typeof value.runtime.containerized === "boolean" &&
    isRecord(value.summary) &&
    Array.isArray(value.cases) &&
    Array.isArray(value.warnings)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before listing hard-math closure reports.");
  }
  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

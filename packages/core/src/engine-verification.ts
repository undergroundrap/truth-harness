import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import {
  expectArray,
  expectConst,
  expectDateTime,
  expectNonEmptyString,
  expectOneOf,
  expectPattern,
  expectRecord,
  expectStringArray,
  formatValidationError,
  parseJsonWithOptionalBom,
  parseJsonObject
} from "./artifact-record-validation.js";
import {
  checkSymbolicWithMaximaSync,
  checkSymbolicWithSageSync,
  getCasBackendStatus,
  type CasBackendCommandRunner,
  type SymbolicCasCheckResult
} from "./cas-backend.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { checkLeanProofArtifact, type LeanProofCheckRecord, type ProofBackendCommandRunner } from "./proof-backend.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import { checkSmtLibArtifact, type SmtBackendCommandRunner, type SmtCheckRecord } from "./smt-backend.js";
import type { SymbolicPrompt } from "./sympy.js";
import type { TrustLabel } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export type EngineVerificationCaseId =
  | "maxima-symbolic-cross-check"
  | "z3-smt-check"
  | "cvc5-smt-check"
  | "lean-proof-fixture"
  | "sage-symbolic-cross-check";
export type EngineVerificationCaseStatus = "passed" | "failed" | "missing" | "not-required";
export type EngineVerificationStatus = "passed" | "partial" | "failed";
export type EngineVerificationLevelId =
  | "engine-level-1-core-cas-smt"
  | "engine-level-2-smt-diversity"
  | "engine-level-3-formal-proof-fixture"
  | "engine-level-4-sage-breadth"
  | "engine-level-5-strict-all-engines";
export type EngineVerificationLevelStatus = "passed" | "blocked";

export type EngineVerificationCommandRunner =
  & CasBackendCommandRunner
  & SmtBackendCommandRunner
  & ProofBackendCommandRunner;

export interface EngineVerificationRequirements {
  maxima?: boolean;
  z3?: boolean;
  cvc5?: boolean;
  lean?: boolean;
  sage?: boolean;
}

export interface EngineVerificationInput {
  rootPath?: string;
  now?: Date;
  timeoutMs?: number;
  maximaCommand?: string;
  sageCommand?: string;
  leanCommand?: string;
  z3Command?: string;
  cvc5Command?: string;
  requirements?: EngineVerificationRequirements;
  symbolicPrompt?: SymbolicPrompt;
  symbolicResult?: string;
  smtSourcePath?: string;
  smtSourceText?: string;
  leanSourcePath?: string;
  leanSourceText?: string;
  runner?: EngineVerificationCommandRunner;
}

export interface EngineVerificationEvidence {
  schemaVersion: string;
  backendId: string;
  backendVersion?: string;
  checkId?: string;
  status: string;
  trust: TrustLabel;
  replay?: string;
  proofCheckerBacked: boolean;
  localOnly: true;
  networkAccess: "none";
}

export interface EngineVerificationCase {
  id: EngineVerificationCaseId;
  capabilityId: string;
  displayName: string;
  lane: string;
  required: boolean;
  status: EngineVerificationCaseStatus;
  trust: TrustLabel | "provenance-only" | "none";
  evidenceMinted: boolean;
  summary: string;
  command: string;
  replay?: string;
  evidence?: EngineVerificationEvidence;
  limitations: string[];
  warnings: string[];
}

export interface EngineVerificationLevel {
  levelId: EngineVerificationLevelId;
  title: string;
  status: EngineVerificationLevelStatus;
  caseIds: EngineVerificationCaseId[];
  passedCases: number;
  totalCases: number;
  evidenceMinted: number;
  summary: string;
}

export interface EngineVerificationReport {
  schemaVersion: "truth-harness.engine-verification.v0";
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  status: EngineVerificationStatus;
  requiredPassed: number;
  requiredTotal: number;
  concretePassed: number;
  concreteTotal: number;
  evidenceMinted: number;
  levels: EngineVerificationLevel[];
  cases: EngineVerificationCase[];
  docker: {
    coreCommand: string;
    professorCommand: string;
    leanCommand: string;
    sageCommand: string;
    allEnginesCommand: string;
    verifyImageCommand: string;
    networkPolicy: "compose-core-no-network";
  };
  trustBoundary: {
    statusProbeIsNotEvidence: true;
    concreteChecksCanMintEvidence: true;
    sageRequiredGateRunsConstrainedCas: true;
    provedRequiresAcceptedLeanRun: true;
    crossCheckedRequiresIndependentCasAgreement: true;
    smtCheckedRequiresZ3SatOrUnsat: true;
    smtCheckedRequiresConcreteSolverSatOrUnsat: true;
  };
  warnings: string[];
}

export interface EngineVerificationRunRecord {
  schemaVersion: "truth-harness.engine-run.v0";
  runId: string;
  title: string;
  summary: string;
  createdAt: string;
  status: EngineVerificationStatus;
  localOnly: true;
  networkAccess: "none";
  replay: string;
  report: EngineVerificationReport;
  artifacts: {
    json: string;
    markdown: string;
  };
  tags: string[];
  limitations: string[];
  warnings: string[];
}

export interface EngineVerificationRunSummary {
  runId: string;
  title: string;
  summary: string;
  createdAt: string;
  status: EngineVerificationStatus;
  concretePassed: number;
  concreteTotal: number;
  requiredPassed: number;
  requiredTotal: number;
  evidenceMinted: number;
  path: string;
  tags: string[];
  warnings: string[];
}

export interface WriteEngineVerificationRunInput extends EngineVerificationInput {
  rootPath: string;
  replayCommand?: string;
}

export interface EngineVerificationRunWriteResult {
  record: EngineVerificationRunRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

const DEFAULT_SYMBOLIC_PROMPT: SymbolicPrompt = {
  operation: "simplify",
  expression: "sin(x)^2 + cos(x)^2",
  variable: "x"
};
const DEFAULT_SYMBOLIC_RESULT = "1";
const DEFAULT_SMT_SOURCE = "docs/examples/constraints.smt2";
const DEFAULT_LEAN_SOURCE = "docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean";
const ENGINE_VERIFICATION_LEVELS: Array<{
  levelId: EngineVerificationLevelId;
  title: string;
  caseIds: EngineVerificationCaseId[];
  passSummary: string;
}> = [
  {
    levelId: "engine-level-1-core-cas-smt",
    title: "Core CAS and SMT evidence",
    caseIds: ["maxima-symbolic-cross-check", "z3-smt-check"],
    passSummary: "Maxima and Z3 both minted concrete scoped evidence for the pinned fixtures."
  },
  {
    levelId: "engine-level-2-smt-diversity",
    title: "Independent SMT diversity",
    caseIds: ["maxima-symbolic-cross-check", "z3-smt-check", "cvc5-smt-check"],
    passSummary: "Core CAS evidence plus independent Z3 and cvc5 SMT evidence are present."
  },
  {
    levelId: "engine-level-3-formal-proof-fixture",
    title: "Formal proof fixture",
    caseIds: ["maxima-symbolic-cross-check", "z3-smt-check", "lean-proof-fixture"],
    passSummary: "Core CAS/SMT evidence plus a Lean-accepted proof fixture are present."
  },
  {
    levelId: "engine-level-4-sage-breadth",
    title: "SageMath breadth gate",
    caseIds: ["maxima-symbolic-cross-check", "z3-smt-check", "sage-symbolic-cross-check"],
    passSummary: "Core CAS/SMT evidence plus constrained SageMath CAS evidence are present."
  },
  {
    levelId: "engine-level-5-strict-all-engines",
    title: "Strict all-engine reviewer gate",
    caseIds: [
      "maxima-symbolic-cross-check",
      "z3-smt-check",
      "cvc5-smt-check",
      "lean-proof-fixture",
      "sage-symbolic-cross-check"
    ],
    passSummary: "Maxima, Z3, cvc5, Lean, and SageMath each minted concrete scoped evidence."
  }
];

export async function verifyEngineEvidence(input: EngineVerificationInput = {}): Promise<EngineVerificationReport> {
  const rootPath = resolve(input.rootPath ?? ".");
  const createdAt = (input.now ?? new Date()).toISOString();
  const timeoutMs = input.timeoutMs ?? 3000;
  const requirements = input.requirements ?? {};
  const cases: EngineVerificationCase[] = [];

  cases.push(maximaCase(input, timeoutMs, Boolean(requirements.maxima)));
  cases.push(await z3Case(input, rootPath, timeoutMs, Boolean(requirements.z3)));
  cases.push(await cvc5Case(input, rootPath, timeoutMs, Boolean(requirements.cvc5)));
  cases.push(await leanCase(input, rootPath, timeoutMs, Boolean(requirements.lean)));
  cases.push(sageCase(input, timeoutMs, Boolean(requirements.sage)));
  const levels = summarizeEngineVerificationLevels(cases);

  const requiredCases = cases.filter((entry) => entry.required);
  const concreteCases = cases.filter((entry) => {
    if (entry.id === "sage-symbolic-cross-check" || entry.id === "cvc5-smt-check") {
      return entry.required;
    }
    return true;
  });
  const requiredPassed = requiredCases.filter((entry) => entry.status === "passed").length;
  const concretePassed = concreteCases.filter((entry) => entry.status === "passed").length;
  const evidenceMinted = cases.filter((entry) => entry.evidenceMinted).length;
  const status = reportStatus({
    requiredTotal: requiredCases.length,
    requiredPassed,
    concretePassed,
    concreteTotal: concreteCases.length
  });

  return {
    schemaVersion: "truth-harness.engine-verification.v0",
    createdAt,
    localOnly: true,
    networkAccess: "none",
    status,
    requiredPassed,
    requiredTotal: requiredCases.length,
    concretePassed,
    concreteTotal: concreteCases.length,
    evidenceMinted,
    levels,
    cases,
    docker: {
      coreCommand: "npm run docker:engines",
      professorCommand: "npm run docker:professor",
      leanCommand: "docker compose run --rm lean-proof npm run cli -- engines verify --require-lean",
      sageCommand: "docker compose run --rm sage-math npm run cli -- engines verify --require-sage",
      allEnginesCommand: "npm run docker:all-engines",
      verifyImageCommand: "npm run docker:verify",
      networkPolicy: "compose-core-no-network"
    },
    trustBoundary: {
      statusProbeIsNotEvidence: true,
      concreteChecksCanMintEvidence: true,
      sageRequiredGateRunsConstrainedCas: true,
      provedRequiresAcceptedLeanRun: true,
      crossCheckedRequiresIndependentCasAgreement: true,
      smtCheckedRequiresZ3SatOrUnsat: true,
      smtCheckedRequiresConcreteSolverSatOrUnsat: true
    },
    warnings: reportWarnings(cases)
  };
}

export async function createEngineVerificationRunRecord(
  input: EngineVerificationInput = {}
): Promise<EngineVerificationRunRecord> {
  const report = await verifyEngineEvidence(input);
  const runId = `engine_run_${stableHash({
    createdAt: report.createdAt,
    status: report.status,
    cases: report.cases.map((entry) => ({
      id: entry.id,
      status: entry.status,
      trust: entry.trust,
      evidenceMinted: entry.evidenceMinted,
      backend: entry.evidence?.backendId,
      backendVersion: entry.evidence?.backendVersion
    }))
  }).slice(0, 16)}`;
  const summary = `Engine verification ${report.status}: ${report.concretePassed}/${report.concreteTotal} concrete gates, ${report.requiredPassed}/${report.requiredTotal} required gates, ${report.evidenceMinted} evidence records earned.`;
  const strongestLevel = strongestEngineVerificationLevel(report.levels);

  return {
    schemaVersion: "truth-harness.engine-run.v0",
    runId,
    title: "Engine Evidence Verification Run",
    summary: strongestLevel ? `${summary} Strongest engine ladder level: ${strongestLevel.levelId}.` : summary,
    createdAt: report.createdAt,
    status: report.status,
    localOnly: true,
    networkAccess: "none",
    replay: "truth-harness engines verify --write",
    report,
    artifacts: {
      json: "",
      markdown: ""
    },
    tags: engineRunTags(report),
    limitations: [
      "This record verifies local engine availability and concrete smoke evidence only.",
      "A passing engine run does not prove future claims; each claim still needs its own replayable receipt or accepted checker artifact.",
      "SageMath can produce direct constrained CAS check records; it participates in this engine smoke only when `--require-sage` or the stricter all-engine reviewer gate is requested."
    ],
    warnings: report.warnings
  };
}

export async function writeEngineVerificationRun(
  input: WriteEngineVerificationRunInput
): Promise<EngineVerificationRunWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const record = await createEngineVerificationRunRecord({
    ...input,
    rootPath: status.root
  });
  record.replay = input.replayCommand ?? record.replay;

  const engineRunsDir = resolve(status.root, status.manifest.directories["engine-runs"]);
  const baseName = `${record.createdAt.slice(0, 10)}-${record.runId}`;
  const jsonPath = join(engineRunsDir, `${baseName}.json`);
  const markdownPath = join(engineRunsDir, `${baseName}.md`);
  record.artifacts = {
    json: toPortablePath(relative(status.root, jsonPath)),
    markdown: toPortablePath(relative(status.root, markdownPath))
  };
  const markdown = renderEngineVerificationRunMarkdown(record);

  await assertEngineVerificationRunSchema(record);
  await mkdir(engineRunsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "engine-runs",
    now: record.createdAt,
    staleReason: "Engine evidence run written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

async function assertEngineVerificationRunSchema(record: EngineVerificationRunRecord): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: record,
    schemaFile: "engine-run.schema.json",
    artifactName: "Engine verification run"
  });
}

export async function listEngineVerificationRuns(rootPath: string): Promise<EngineVerificationRunSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const engineRunsDir = resolve(status.root, status.manifest.directories["engine-runs"]);

  let files: string[];
  try {
    files = await readdir(engineRunsDir);
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
        const path = join(engineRunsDir, file);
        return summarizeEngineVerificationRun(status.root, path, await readFile(path, "utf8"));
      })
  );

  return summaries
    .filter((summary): summary is EngineVerificationRunSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function parseEngineVerificationRunJson(
  raw: string,
  sourcePath = "engine verification run"
): EngineVerificationRunRecord {
  const parsed = parseJsonObject(raw, sourcePath, "engine verification run");
  const issues: string[] = [];

  expectConst(parsed, "schemaVersion", "truth-harness.engine-run.v0", "$.schemaVersion", issues);
  expectPattern(parsed, "runId", /^engine_run_[a-f0-9]{16}$/u, "$.runId", issues);
  expectNonEmptyString(parsed, "title", "$.title", issues);
  expectNonEmptyString(parsed, "summary", "$.summary", issues);
  expectDateTime(parsed, "createdAt", "$.createdAt", issues);
  expectOneOf(parsed, "status", ["passed", "partial", "failed"], "$.status", issues);
  expectConst(parsed, "localOnly", true, "$.localOnly", issues);
  expectConst(parsed, "networkAccess", "none", "$.networkAccess", issues);
  expectNonEmptyString(parsed, "replay", "$.replay", issues);
  expectStringArray(parsed, "tags", "$.tags", issues);
  expectStringArray(parsed, "limitations", "$.limitations", issues);
  expectStringArray(parsed, "warnings", "$.warnings", issues);

  const artifacts = expectRecord(parsed, "artifacts", "$.artifacts", issues);
  if (artifacts) {
    expectNonEmptyString(artifacts, "json", "$.artifacts.json", issues);
    expectNonEmptyString(artifacts, "markdown", "$.artifacts.markdown", issues);
  }

  const report = expectRecord(parsed, "report", "$.report", issues);
  if (report) {
    expectConst(report, "schemaVersion", "truth-harness.engine-verification.v0", "$.report.schemaVersion", issues);
    expectDateTime(report, "createdAt", "$.report.createdAt", issues);
    expectConst(report, "localOnly", true, "$.report.localOnly", issues);
    expectConst(report, "networkAccess", "none", "$.report.networkAccess", issues);
    expectOneOf(report, "status", ["passed", "partial", "failed"], "$.report.status", issues);
    expectArray(report, "cases", "$.report.cases", issues);
    if ("levels" in report) {
      expectArray(report, "levels", "$.report.levels", issues);
    }
  }

  if (issues.length > 0) {
    throw formatValidationError("engine verification run", sourcePath, issues);
  }

  return parsed as unknown as EngineVerificationRunRecord;
}

export function renderEngineVerificationRunMarkdown(record: EngineVerificationRunRecord): string {
  const levels = record.report.levels ?? summarizeEngineVerificationLevels(record.report.cases);
  const lines = [
    `# ${record.title}`,
    "",
    `Run: \`${record.runId}\``,
    `Status: \`${record.status}\``,
    `Created: ${record.createdAt}`,
    `Privacy: local-only (network: ${record.networkAccess})`,
    "",
    "## Summary",
    "",
    record.summary,
    "",
    "## Replay",
    "",
    `\`${record.replay}\``,
    "",
    "## Engine Readiness Levels",
    "",
    "| Level | Status | Gates | Summary |",
    "| --- | --- | --- | --- |",
    ...levels.map((level) =>
      `| ${markdownCell(level.title)} | ${level.status} | ${level.passedCases}/${level.totalCases} | ${markdownCell(level.summary)} |`
    ),
    "",
    "## Evidence Ladder",
    "",
    "| Case | Gate | Evidence status | Reviewer meaning |",
    "| --- | --- | --- | --- |",
    ...record.report.cases.map((item) =>
      `| ${markdownCell(item.displayName)} | ${item.required ? "required" : "optional"} | ${markdownCell(engineVerificationCaseEvidenceTier(item))} | ${markdownCell(engineVerificationCaseEvidenceMeaning(item))} |`
    ),
    "",
    "## Engine Gates",
    ""
  ];

  for (const item of record.report.cases) {
    lines.push(
      `### ${item.displayName}`,
      "",
      `- Status: \`${item.status}\`${item.required ? " (required)" : ""}`,
      `- Trust: \`${item.trust}\``,
      `- Evidence minted: ${String(item.evidenceMinted)}`,
      `- Reviewer meaning: ${engineVerificationCaseEvidenceMeaning(item)}`,
      `- Command: \`${item.command}\``,
      `- Summary: ${item.summary}`
    );
    if (item.replay) {
      lines.push(`- Replay: \`${item.replay}\``);
    }
    if (item.evidence?.backendVersion) {
      lines.push(`- Backend: ${item.evidence.backendId} (${item.evidence.backendVersion})`);
    } else if (item.evidence?.backendId) {
      lines.push(`- Backend: ${item.evidence.backendId}`);
    }
    if (item.limitations.length > 0) {
      lines.push("- Limitations:");
      for (const limitation of item.limitations) {
        lines.push(`  - ${limitation}`);
      }
    }
    if (item.warnings.length > 0) {
      lines.push("- Warnings:");
      for (const warning of item.warnings) {
        lines.push(`  - ${warning}`);
      }
    }
    lines.push("");
  }

  lines.push(
    "## Trust Boundary",
    "",
    "- Engine readiness probes do not prove claims.",
    "- Maxima, Z3, cvc5, and Lean can only mint their scoped trust labels for concrete recorded checks.",
    "- SageMath direct CAS checks can mint scoped `cross-checked` records when `--require-sage` or the stricter all-engine reviewer gate is requested.",
    "- A future claim must attach its own receipt, proof, SMT, CAS, simulation, source, or review artifact.",
    "",
    "## Limitations",
    ""
  );
  for (const limitation of record.limitations) {
    lines.push(`- ${limitation}`);
  }
  if (record.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of record.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function summarizeEngineVerificationLevels(cases: EngineVerificationCase[]): EngineVerificationLevel[] {
  const caseMap = new Map(cases.map((entry) => [entry.id, entry]));

  return ENGINE_VERIFICATION_LEVELS.map((definition) => {
    const levelCases = definition.caseIds.map((caseId) => caseMap.get(caseId));
    const passedCases = levelCases.filter((entry) => isEngineCaseEvidencePassed(entry)).length;
    const evidenceMinted = levelCases.filter((entry) => entry?.evidenceMinted).length;
    const totalCases = definition.caseIds.length;
    const status: EngineVerificationLevelStatus = passedCases === totalCases ? "passed" : "blocked";
    const missing = definition.caseIds
      .filter((caseId, index) => !isEngineCaseEvidencePassed(levelCases[index]))
      .map((caseId) => caseMap.get(caseId)?.displayName ?? caseId);

    return {
      levelId: definition.levelId,
      title: definition.title,
      status,
      caseIds: definition.caseIds,
      passedCases,
      totalCases,
      evidenceMinted,
      summary:
        status === "passed"
          ? definition.passSummary
          : `Needs concrete evidence for: ${missing.join(", ")}.`
    };
  });
}

function strongestEngineVerificationLevel(levels: EngineVerificationLevel[]): EngineVerificationLevel | undefined {
  return [...levels].reverse().find((level) => level.status === "passed");
}

function isEngineCaseEvidencePassed(entry: EngineVerificationCase | undefined): boolean {
  return Boolean(entry && entry.status === "passed" && entry.evidenceMinted);
}

export function engineVerificationCaseEvidenceTier(item: EngineVerificationCase): string {
  if (item.evidenceMinted) {
    return "earned evidence";
  }
  if (item.status === "not-required") {
    return "readiness/provenance only";
  }
  if (item.status === "missing") {
    return "missing evidence";
  }
  return "failed evidence";
}

export function engineVerificationCaseEvidenceMeaning(item: EngineVerificationCase): string {
  if (item.evidenceMinted) {
    return `Concrete \`${item.trust}\` evidence earned for this fixture; replay it before citing the engine gate.`;
  }
  if (item.status === "not-required") {
    return "A local backend may be available, but no concrete trust-label evidence was requested or earned in this run.";
  }
  if (item.status === "missing" && item.required) {
    return "Required evidence is missing, so strict reviewer readiness fails closed.";
  }
  if (item.status === "missing") {
    return "Optional evidence is missing; this is not a blocker, but no claim can cite this engine until a concrete run succeeds.";
  }
  if (item.required) {
    return "Required evidence was attempted and failed, so strict reviewer readiness fails closed.";
  }
  return "Optional evidence was attempted and failed; do not cite this engine row as support.";
}

function maximaCase(
  input: EngineVerificationInput,
  timeoutMs: number,
  required: boolean
): EngineVerificationCase {
  const prompt = input.symbolicPrompt ?? DEFAULT_SYMBOLIC_PROMPT;
  const result = input.symbolicResult ?? DEFAULT_SYMBOLIC_RESULT;
  const record = checkSymbolicWithMaximaSync({
    prompt,
    result,
    maximaCommand: input.maximaCommand,
    timeoutMs,
    now: input.now,
    runner: input.runner
  });
  const passed = record.status === "passed" && record.trust === "cross-checked";
  const missing = record.status === "solver-unavailable";

  return {
    id: "maxima-symbolic-cross-check",
    capabilityId: "maxima-cas",
    displayName: "Maxima symbolic cross-check",
    lane: "math",
    required,
    status: passed ? "passed" : missing ? "missing" : "failed",
    trust: record.trust,
    evidenceMinted: passed,
    summary: passed
      ? `Maxima independently agreed that ${prompt.expression} simplifies to ${result}.`
      : record.error ?? `Maxima returned ${record.status}.`,
    command: "truth-harness cas check --operation simplify --expression \"sin(x)^2 + cos(x)^2\" --result 1 --fail-on-unverified",
    replay: `truth-harness cas check --operation ${prompt.operation} --expression ${quote(prompt.expression)} --result ${quote(result)} --fail-on-unverified`,
    evidence: summarizeEvidence(record),
    limitations: record.limitations,
    warnings: record.warnings
  };
}

async function z3Case(
  input: EngineVerificationInput,
  rootPath: string,
  timeoutMs: number,
  required: boolean
): Promise<EngineVerificationCase> {
  const sourcePath = input.smtSourcePath ?? DEFAULT_SMT_SOURCE;
  const resolvedPath = resolve(rootPath, sourcePath);
  const sourceRef = toPortablePath(relative(rootPath, resolvedPath));
  let sourceText: string;
  try {
    sourceText = input.smtSourceText ?? await readFile(resolvedPath, "utf8");
  } catch (error) {
    return sourceUnavailableCase({
      id: "z3-smt-check",
      capabilityId: "z3-smt-solver",
      displayName: "Z3 SMT-LIB check",
      sourceRef,
      command: `truth-harness smt check ${sourceRef} --fail-on-unverified`,
      required,
      error
    });
  }
  const record = checkSmtLibArtifact({
    sourcePath: resolvedPath,
    sourceRef,
    sourceText,
    queryName: "truth-harness-engine-smoke",
    z3Command: input.z3Command,
    timeoutMs,
    now: input.now,
    runner: input.runner,
    replayCommand: `truth-harness smt check ${sourceRef} --fail-on-unverified`
  });
  const passed = record.trust === "smt-checked" && (record.status === "sat" || record.status === "unsat");
  const missing = record.status === "solver-unavailable";

  return {
    id: "z3-smt-check",
    capabilityId: "z3-smt-solver",
    displayName: "Z3 SMT-LIB check",
    lane: "math",
    required,
    status: passed ? "passed" : missing ? "missing" : "failed",
    trust: record.trust,
    evidenceMinted: passed,
    summary: passed
      ? `Z3 returned ${record.status} for ${sourceRef}.`
      : record.error ?? `Z3 returned ${record.status}.`,
    command: `truth-harness smt check ${sourceRef} --fail-on-unverified`,
    replay: record.replay,
    evidence: summarizeEvidence(record),
    limitations: record.limitations,
    warnings: record.warnings
  };
}

async function cvc5Case(
  input: EngineVerificationInput,
  rootPath: string,
  timeoutMs: number,
  required: boolean
): Promise<EngineVerificationCase> {
  const sourcePath = input.smtSourcePath ?? DEFAULT_SMT_SOURCE;
  const resolvedPath = resolve(rootPath, sourcePath);
  const sourceRef = toPortablePath(relative(rootPath, resolvedPath));
  let sourceText: string;
  try {
    sourceText = input.smtSourceText ?? await readFile(resolvedPath, "utf8");
  } catch (error) {
    return sourceUnavailableCase({
      id: "cvc5-smt-check",
      capabilityId: "cvc5-smt-solver",
      displayName: "cvc5 SMT-LIB check",
      sourceRef,
      command: `truth-harness smt check ${sourceRef} --backend cvc5 --fail-on-unverified`,
      required,
      error
    });
  }
  const record = checkSmtLibArtifact({
    sourcePath: resolvedPath,
    sourceRef,
    sourceText,
    queryName: "truth-harness-engine-smoke",
    backend: "cvc5",
    cvc5Command: input.cvc5Command,
    timeoutMs,
    now: input.now,
    runner: input.runner,
    replayCommand: `truth-harness smt check ${sourceRef} --backend cvc5 --fail-on-unverified`
  });
  const passed = record.trust === "smt-checked" && (record.status === "sat" || record.status === "unsat");
  const missing = record.status === "solver-unavailable";

  return {
    id: "cvc5-smt-check",
    capabilityId: "cvc5-smt-solver",
    displayName: "cvc5 SMT-LIB check",
    lane: "math",
    required,
    status: passed ? "passed" : missing ? "missing" : "failed",
    trust: record.trust,
    evidenceMinted: passed,
    summary: passed
      ? `cvc5 returned ${record.status} for ${sourceRef}.`
      : record.error ?? `cvc5 returned ${record.status}.`,
    command: `truth-harness smt check ${sourceRef} --backend cvc5 --fail-on-unverified`,
    replay: record.replay,
    evidence: summarizeEvidence(record),
    limitations: record.limitations,
    warnings: record.warnings
  };
}

async function leanCase(
  input: EngineVerificationInput,
  rootPath: string,
  timeoutMs: number,
  required: boolean
): Promise<EngineVerificationCase> {
  const sourcePath = input.leanSourcePath ?? DEFAULT_LEAN_SOURCE;
  const resolvedPath = resolve(rootPath, sourcePath);
  const sourceRef = toPortablePath(relative(rootPath, resolvedPath));
  let sourceText: string;
  try {
    sourceText = input.leanSourceText ?? await readFile(resolvedPath, "utf8");
  } catch (error) {
    return sourceUnavailableCase({
      id: "lean-proof-fixture",
      capabilityId: "lean-proof-checker",
      displayName: "Lean proof fixture",
      sourceRef,
      command: `truth-harness proof check ${sourceRef} --fail-on-unproved`,
      required,
      error
    });
  }
  const record = checkLeanProofArtifact({
    sourcePath: resolvedPath,
    sourceRef,
    sourceText,
    declarationName: "one_plus_one",
    leanCommand: input.leanCommand,
    timeoutMs,
    now: input.now,
    runner: input.runner,
    replayCommand: `truth-harness proof check ${sourceRef} --fail-on-unproved`
  });
  const passed = record.status === "accepted" && record.trust === "proved" && record.proofCheckerBacked;
  const missing = record.status === "backend-unavailable";

  return {
    id: "lean-proof-fixture",
    capabilityId: "lean-proof-checker",
    displayName: "Lean proof fixture",
    lane: "math",
    required,
    status: passed ? "passed" : missing ? "missing" : "failed",
    trust: record.trust,
    evidenceMinted: passed,
    summary: passed
      ? `Lean accepted ${sourceRef}; this fixture can mint proved for the checked formal statement.`
      : record.error ?? `Lean returned ${record.status}.`,
    command: `truth-harness proof check ${sourceRef} --fail-on-unproved`,
    replay: record.replay,
    evidence: summarizeEvidence(record),
    limitations: record.limitations,
    warnings: record.warnings
  };
}

function sageCase(
  input: EngineVerificationInput,
  timeoutMs: number,
  required: boolean
): EngineVerificationCase {
  const prompt = input.symbolicPrompt ?? DEFAULT_SYMBOLIC_PROMPT;
  const result = input.symbolicResult ?? DEFAULT_SYMBOLIC_RESULT;
  const command = "truth-harness cas check --backend sage --operation simplify --expression \"sin(x)^2 + cos(x)^2\" --result 1 --fail-on-unverified";
  const replay = `truth-harness cas check --backend sage --operation ${prompt.operation} --expression ${quote(prompt.expression)} --result ${quote(result)} --fail-on-unverified`;

  if (!required) {
    const status = getCasBackendStatus({
      maximaCommand: input.maximaCommand,
      sageCommand: input.sageCommand,
      timeoutMs,
      now: input.now,
      runner: input.runner
    });
    const sage = status.backends.find((backend) => backend.backendId === "sage");
    const available = sage?.status === "available";

    return {
      id: "sage-symbolic-cross-check",
      capabilityId: "sage-cas",
      displayName: "SageMath symbolic cross-check",
      lane: "math",
      required,
      status: available ? "not-required" : sage?.status === "error" ? "failed" : "missing",
      trust: "provenance-only",
      evidenceMinted: false,
      summary: available
        ? "SageMath was detected; the constrained Sage gate was skipped because no Sage/all-engine requirement was requested."
        : sage?.error ?? "SageMath was not detected.",
      command,
      replay,
      limitations: sage?.limitations ?? ["SageMath has not been probed."],
      warnings: available
        ? ["Run `truth-harness engines verify --require-sage` or `truth-harness engines verify --require-all-engines` when a reviewer wants SageMath to earn concrete CAS evidence."]
        : []
    };
  }

  const record = checkSymbolicWithSageSync({
    prompt,
    result,
    sageCommand: input.sageCommand,
    timeoutMs,
    now: input.now,
    runner: input.runner
  });
  const passed = record.status === "passed" && record.trust === "cross-checked";
  const missing = record.status === "solver-unavailable";

  return {
    id: "sage-symbolic-cross-check",
    capabilityId: "sage-cas",
    displayName: "SageMath symbolic cross-check",
    lane: "math",
    required,
    status: passed ? "passed" : missing ? "missing" : "failed",
    trust: record.trust,
    evidenceMinted: passed,
    summary: passed
      ? `SageMath independently agreed that ${prompt.expression} simplifies to ${result}.`
      : record.error ?? `SageMath returned ${record.status}.`,
    command,
    replay,
    evidence: summarizeEvidence(record),
    limitations: record.limitations,
    warnings: record.warnings
  };
}

function summarizeEvidence(
  record: SymbolicCasCheckResult | SmtCheckRecord | LeanProofCheckRecord
): EngineVerificationEvidence {
  return {
    schemaVersion: record.schemaVersion,
    backendId: record.backend.id,
    backendVersion: record.backend.version,
    checkId: "checkId" in record ? record.checkId : undefined,
    status: record.status,
    trust: record.trust,
    replay: "replay" in record ? record.replay : undefined,
    proofCheckerBacked: record.proofCheckerBacked,
    localOnly: true,
    networkAccess: "none"
  };
}

function sourceUnavailableCase(input: {
  id: Extract<EngineVerificationCaseId, "z3-smt-check" | "cvc5-smt-check" | "lean-proof-fixture">;
  capabilityId: string;
  displayName: string;
  sourceRef: string;
  command: string;
  required: boolean;
  error: unknown;
}): EngineVerificationCase {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  return {
    id: input.id,
    capabilityId: input.capabilityId,
    displayName: input.displayName,
    lane: "math",
    required: input.required,
    status: "missing",
    trust: "unverified",
    evidenceMinted: false,
    summary: `${input.displayName} source ${input.sourceRef} could not be read: ${message}`,
    command: input.command,
    replay: input.command,
    limitations: [
      "The verifier could not read the pinned source artifact, so no checker-backed evidence was minted.",
      "Create or attach the source file, then rerun the engine evidence gate."
    ],
    warnings: [`Missing engine evidence source: ${input.sourceRef}.`]
  };
}

function reportStatus(input: {
  requiredTotal: number;
  requiredPassed: number;
  concretePassed: number;
  concreteTotal: number;
}): EngineVerificationStatus {
  if (input.requiredTotal > 0) {
    return input.requiredPassed === input.requiredTotal ? "passed" : "failed";
  }
  if (input.concretePassed === input.concreteTotal) {
    return "passed";
  }
  if (input.concretePassed > 0) {
    return "partial";
  }
  return "failed";
}

function reportWarnings(cases: EngineVerificationCase[]): string[] {
  const warnings = cases
    .filter((entry) => entry.required && entry.status !== "passed")
    .map((entry) => `Required engine gate failed: ${entry.displayName} (${entry.status}).`);

  return warnings;
}

function engineRunTags(report: EngineVerificationReport): string[] {
  const tags = new Set<string>(["engine-evidence", "verification", report.status]);
  for (const item of report.cases) {
    tags.add(item.capabilityId);
    tags.add(item.status);
    if (item.evidenceMinted) {
      tags.add("evidence-minted");
    }
    if (item.required) {
      tags.add("required-gate");
    }
  }
  for (const level of report.levels) {
    if (level.status === "passed") {
      tags.add(level.levelId);
    }
  }
  return [...tags].sort();
}

function summarizeEngineVerificationRun(
  rootPath: string,
  path: string,
  raw: string
): EngineVerificationRunSummary | undefined {
  try {
    const record = parseEngineVerificationRunJson(raw, path);
    return {
      runId: record.runId,
      title: record.title,
      summary: record.summary,
      createdAt: record.createdAt,
      status: record.status,
      concretePassed: record.report.concretePassed,
      concreteTotal: record.report.concreteTotal,
      requiredPassed: record.report.requiredPassed,
      requiredTotal: record.report.requiredTotal,
      evidenceMinted: record.report.evidenceMinted,
      path: toPortablePath(relative(rootPath, path)),
      tags: record.tags,
      warnings: record.warnings
    };
  } catch {
    return undefined;
  }
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing engine evidence runs.");
  }
  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}. Run \`truth-harness workspace repair\`.`);
  }
  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function markdownCell(value: string): string {
  return value.replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ").trim();
}

function toPortablePath(path: string): string {
  return path.split("\\").join("/");
}

import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import {
  checkSymbolicWithMaximaSync,
  getCasBackendStatus,
  type CasBackendCommandRunner,
  type SymbolicCasCheckResult
} from "./cas-backend.js";
import { checkLeanProofArtifact, type LeanProofCheckRecord, type ProofBackendCommandRunner } from "./proof-backend.js";
import { checkSmtLibArtifact, type SmtBackendCommandRunner, type SmtCheckRecord } from "./smt-backend.js";
import type { SymbolicPrompt } from "./sympy.js";
import type { TrustLabel } from "./types.js";

export type EngineVerificationCaseId =
  | "maxima-symbolic-cross-check"
  | "z3-smt-check"
  | "lean-proof-fixture"
  | "sage-status-only";
export type EngineVerificationCaseStatus = "passed" | "failed" | "missing" | "not-implemented";
export type EngineVerificationStatus = "passed" | "partial" | "failed";

export type EngineVerificationCommandRunner =
  & CasBackendCommandRunner
  & SmtBackendCommandRunner
  & ProofBackendCommandRunner;

export interface EngineVerificationRequirements {
  maxima?: boolean;
  z3?: boolean;
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
  cases: EngineVerificationCase[];
  docker: {
    coreCommand: string;
    leanCommand: string;
    verifyImageCommand: string;
    networkPolicy: "compose-core-no-network";
  };
  trustBoundary: {
    statusProbeIsNotEvidence: true;
    concreteChecksCanMintEvidence: true;
    sageIsStatusOnlyUntilConstrainedRecordsExist: true;
    provedRequiresAcceptedLeanRun: true;
    crossCheckedRequiresMaximaAgreement: true;
    smtCheckedRequiresZ3SatOrUnsat: true;
  };
  warnings: string[];
}

const DEFAULT_SYMBOLIC_PROMPT: SymbolicPrompt = {
  operation: "simplify",
  expression: "sin(x)^2 + cos(x)^2",
  variable: "x"
};
const DEFAULT_SYMBOLIC_RESULT = "1";
const DEFAULT_SMT_SOURCE = "docs/examples/constraints.smt2";
const DEFAULT_LEAN_SOURCE = "docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean";

export async function verifyEngineEvidence(input: EngineVerificationInput = {}): Promise<EngineVerificationReport> {
  const rootPath = resolve(input.rootPath ?? ".");
  const createdAt = (input.now ?? new Date()).toISOString();
  const timeoutMs = input.timeoutMs ?? 3000;
  const requirements = input.requirements ?? {};
  const cases: EngineVerificationCase[] = [];

  cases.push(maximaCase(input, timeoutMs, Boolean(requirements.maxima)));
  cases.push(await z3Case(input, rootPath, timeoutMs, Boolean(requirements.z3)));
  cases.push(await leanCase(input, rootPath, timeoutMs, Boolean(requirements.lean)));
  cases.push(sageCase(input, timeoutMs, Boolean(requirements.sage)));

  const requiredCases = cases.filter((entry) => entry.required);
  const concreteCases = cases.filter((entry) => entry.id !== "sage-status-only");
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
    cases,
    docker: {
      coreCommand: "npm run docker:engines",
      leanCommand: "docker compose run --rm lean-proof npm run cli -- engines verify --require-lean",
      verifyImageCommand: "npm run docker:verify",
      networkPolicy: "compose-core-no-network"
    },
    trustBoundary: {
      statusProbeIsNotEvidence: true,
      concreteChecksCanMintEvidence: true,
      sageIsStatusOnlyUntilConstrainedRecordsExist: true,
      provedRequiresAcceptedLeanRun: true,
      crossCheckedRequiresMaximaAgreement: true,
      smtCheckedRequiresZ3SatOrUnsat: true
    },
    warnings: reportWarnings(cases)
  };
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
  const sourceText = input.smtSourceText ?? await readFile(resolvedPath, "utf8");
  const sourceRef = toPortablePath(relative(rootPath, resolvedPath));
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

async function leanCase(
  input: EngineVerificationInput,
  rootPath: string,
  timeoutMs: number,
  required: boolean
): Promise<EngineVerificationCase> {
  const sourcePath = input.leanSourcePath ?? DEFAULT_LEAN_SOURCE;
  const resolvedPath = resolve(rootPath, sourcePath);
  const sourceText = input.leanSourceText ?? await readFile(resolvedPath, "utf8");
  const sourceRef = toPortablePath(relative(rootPath, resolvedPath));
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
    id: "sage-status-only",
    capabilityId: "sage-cas",
    displayName: "SageMath status-only probe",
    lane: "math",
    required,
    status: available ? "not-implemented" : sage?.status === "error" ? "failed" : "missing",
    trust: "provenance-only",
    evidenceMinted: false,
    summary: available
      ? "SageMath was detected, but Truth Harness has no constrained Sage check record yet."
      : sage?.error ?? "SageMath was not detected.",
    command: "truth-harness cas backends",
    limitations: sage?.limitations ?? ["SageMath has not been probed."],
    warnings: [
      "SageMath is intentionally status-only until constrained scripts, recorded inputs/outputs, and replayable check records are implemented."
    ]
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

  if (cases.some((entry) => entry.id === "sage-status-only" && entry.status === "not-implemented")) {
    warnings.push("SageMath was detected but remains status-only; do not route trust through Sage until constrained records exist.");
  }

  return warnings;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function toPortablePath(path: string): string {
  return path.split("\\").join("/");
}

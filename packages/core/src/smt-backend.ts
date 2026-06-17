import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import {
  expectBoolean,
  expectConst,
  expectDateTime,
  expectNonEmptyString,
  expectNonNegativeInteger,
  expectOneOf,
  expectPattern,
  expectRecord,
  expectStringArray,
  formatValidationError,
  isRecord,
  parseJsonObject
} from "./artifact-record-validation.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import type { TrustLabel } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export type SmtBackendId = "z3" | "cvc5";
export type SmtBackendStatus = "available" | "missing" | "error";

export interface SmtBackendCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: {
    name?: string;
    message: string;
  };
}

export type SmtBackendCommandRunner = (
  command: string,
  args: string[],
  timeoutMs: number
) => SmtBackendCommandResult;

export interface SmtBackendProbe {
  backendId: SmtBackendId;
  displayName: string;
  adapter: string;
  role: "checker";
  acceptedProofChecker: false;
  status: SmtBackendStatus;
  localOnly: true;
  networkAccess: "none";
  command: string;
  args: string[];
  version?: string;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  error?: string;
  canCheckSmt: boolean;
  statusProbeMintedCheck: false;
  limitations: string[];
}

export interface SmtBackendStatusReport {
  schemaVersion: "truth-harness.smt-backends.v0";
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  smtSolversAvailable: number;
  backends: SmtBackendProbe[];
  trustBoundary: {
    statusProbeIsNotCheck: true;
    smtCheckedRequiresSolverRun: true;
    smtCheckedIsNotProofCheckerProof: true;
    provedRequiresAcceptedProofChecker: true;
  };
  warnings: string[];
}

export interface SmtBackendStatusOptions {
  z3Command?: string;
  cvc5Command?: string;
  timeoutMs?: number;
  now?: Date;
  runner?: SmtBackendCommandRunner;
}

export type SmtCheckStatus = "sat" | "unsat" | "unknown" | "solver-unavailable" | "error";

export interface SmtModelBinding {
  name: string;
  sort: string;
  value: string;
  raw: string;
}

export interface SmtModelSummary {
  format: "z3-define-fun" | "smtlib-define-fun";
  bindings: SmtModelBinding[];
  warnings: string[];
}

export interface SmtCheckInput {
  sourcePath: string;
  sourceText: string;
  sourceRef?: string;
  queryName?: string;
  backend?: SmtBackendId;
  z3Command?: string;
  cvc5Command?: string;
  timeoutMs?: number;
  now?: Date;
  runner?: SmtBackendCommandRunner;
  replayCommand?: string;
}

export interface SmtCheckRecord {
  schemaVersion: "truth-harness.smt-check.v0";
  checkId: string;
  createdAt: string;
  backend: {
    id: SmtBackendId;
    displayName: string;
    adapter: string;
    role: "checker";
    acceptedProofChecker: false;
    command: string;
    args: string[];
    version?: string;
    exitCode?: number | null;
  };
  source: {
    path: string;
    sha256: string;
    byteLength: number;
    queryName?: string;
  };
  status: SmtCheckStatus;
  trust: TrustLabel;
  proofCheckerBacked: false;
  localOnly: true;
  networkAccess: "none";
  replay: string;
  model?: SmtModelSummary;
  stdout?: string;
  stderr?: string;
  error?: string;
  limitations: string[];
  warnings: string[];
}

export interface WriteSmtCheckInput {
  rootPath: string;
  sourcePath: string;
  queryName?: string;
  backend?: SmtBackendId;
  z3Command?: string;
  cvc5Command?: string;
  timeoutMs?: number;
  now?: Date;
  runner?: SmtBackendCommandRunner;
}

export interface SmtCheckWriteResult {
  record: SmtCheckRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface SmtCheckSummary {
  path: string;
  checkId: string;
  createdAt: string;
  sourcePath: string;
  queryName?: string;
  status: SmtCheckStatus;
  trust: TrustLabel;
  proofCheckerBacked: false;
  backendId: SmtBackendId;
  backendVersion?: string;
  warnings: string[];
}

const DEFAULT_TIMEOUT_MS = 3000;

export function getSmtBackendStatus(options: SmtBackendStatusOptions = {}): SmtBackendStatusReport {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.runner ?? runCommand;
  const z3Command = options.z3Command?.trim() || process.env.TRUTH_HARNESS_Z3?.trim() || "z3";
  const cvc5Command = options.cvc5Command?.trim() || process.env.TRUTH_HARNESS_CVC5?.trim() || "cvc5";
  const backends = [
    probeSmtBackend({ backendId: "z3", command: z3Command, timeoutMs, runner }),
    probeSmtBackend({ backendId: "cvc5", command: cvc5Command, timeoutMs, runner })
  ];
  const smtSolversAvailable = backends.filter((backend) => backend.status === "available").length;

  return {
    schemaVersion: "truth-harness.smt-backends.v0",
    createdAt: (options.now ?? new Date()).toISOString(),
    localOnly: true,
    networkAccess: "none",
    smtSolversAvailable,
    backends,
    trustBoundary: {
      statusProbeIsNotCheck: true,
      smtCheckedRequiresSolverRun: true,
      smtCheckedIsNotProofCheckerProof: true,
      provedRequiresAcceptedProofChecker: true
    },
    warnings:
      smtSolversAvailable > 0
        ? [
            "A detected SMT solver can check SMT-LIB constraints, but this status report does not prove or refute any claim.",
            "Independent Z3/cvc5 agreement can improve reviewer confidence, but it is still SMT evidence about the encoded artifact, not proof-checker-backed proof."
          ]
        : [
            "No accepted local SMT solver was detected. Truth Harness must not label results `smt-checked` until a solver run returns sat or unsat for a concrete SMT-LIB artifact."
          ]
  };
}

export function checkSmtLibArtifact(input: SmtCheckInput): SmtCheckRecord {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = input.runner ?? runCommand;
  const backendId = input.backend ?? "z3";
  const z3Command = input.z3Command?.trim() || process.env.TRUTH_HARNESS_Z3?.trim() || "z3";
  const cvc5Command = input.cvc5Command?.trim() || process.env.TRUTH_HARNESS_CVC5?.trim() || "cvc5";
  const backendMeta = smtBackendMetadata(backendId);
  const backendCommand = backendId === "z3" ? z3Command : cvc5Command;
  const createdAt = (input.now ?? new Date()).toISOString();
  const sourcePath = input.sourcePath;
  const sourceRef = input.sourceRef ?? sourcePath;
  const sourceSha256 = sha256(input.sourceText);
  const sourceByteLength = Buffer.byteLength(input.sourceText, "utf8");
  const queryName = normalizeOptional(input.queryName);
  const backendProbe = probeSmtBackend({
    backendId,
    command: backendCommand,
    timeoutMs,
    runner
  });
  const checkArgs = smtCheckArgs(backendId, sourcePath);
  const base = {
    schemaVersion: "truth-harness.smt-check.v0" as const,
    createdAt,
    backend: {
      id: backendId,
      displayName: backendMeta.displayName,
      adapter: backendMeta.adapter,
      role: "checker" as const,
      acceptedProofChecker: false as const,
      command: backendCommand,
      args: checkArgs,
      ...(backendProbe.version ? { version: backendProbe.version } : {})
    },
    source: {
      path: sourceRef,
      sha256: sourceSha256,
      byteLength: sourceByteLength,
      ...(queryName ? { queryName } : {})
    },
    proofCheckerBacked: false as const,
    localOnly: true as const,
    networkAccess: "none" as const,
    replay: input.replayCommand ?? `truth-harness smt check ${quoteCommandArg(sourceRef)} --backend ${backendId} --json`
  };

  if (backendProbe.status !== "available") {
    return withCheckId({
      ...base,
      backend: {
        ...base.backend,
        exitCode: backendProbe.exitCode
      },
      status: "solver-unavailable",
      trust: "unverified",
      stdout: backendProbe.stdout,
      stderr: backendProbe.stderr,
      error: backendProbe.error,
      limitations: [
        `${backendMeta.displayName} did not pass the local backend availability probe, so no SMT-LIB artifact was checked.`,
        "This record cannot support an `smt-checked` trust label."
      ],
      warnings: [
        "No local SMT solver run completed. Treat the claim as unverified until a solver checks the concrete SMT-LIB artifact."
      ]
    });
  }

  const result = runner(backendCommand, checkArgs, timeoutMs);
  const stdout = trimOutput(result.stdout);
  const stderr = trimOutput(result.stderr);
  const errorText = result.error ? `${result.error.name ? `${result.error.name}: ` : ""}${result.error.message}` : undefined;

  if (result.error && isMissingExecutable(result.error)) {
    return withCheckId({
      ...base,
      backend: {
        ...base.backend,
        exitCode: result.status
      },
      status: "solver-unavailable",
      trust: "unverified",
      stdout,
      stderr,
      error: errorText,
      limitations: [
        `${backendMeta.displayName} was available during probing but could not be launched for the SMT check.`,
        "This record cannot support an `smt-checked` trust label."
      ],
      warnings: [
        "No local SMT solver run completed. Treat the claim as unverified until a solver checks the concrete SMT-LIB artifact."
      ]
    });
  }

  if (result.error || result.status !== 0) {
    return withCheckId({
      ...base,
      backend: {
        ...base.backend,
        exitCode: result.status
      },
      status: "error",
      trust: "unverified",
      stdout,
      stderr,
      error: errorText ?? `${backendMeta.displayName} exited with status ${String(result.status)}.`,
      limitations: [
        `${backendMeta.displayName} failed before returning a reliable SMT result.`,
        "Execution errors cannot support `smt-checked` or `proved` trust labels."
      ],
      warnings: [
        "The SMT artifact was not checked successfully. Treat the claim as unverified."
      ]
    });
  }

  const solverStatus = parseSolverStatus(stdout);
  if (solverStatus === "sat" || solverStatus === "unsat") {
    const model = solverStatus === "sat" ? parseSmtModel(stdout, backendId) : undefined;

    return withCheckId({
      ...base,
      backend: {
        ...base.backend,
        exitCode: result.status
      },
      status: solverStatus,
      trust: "smt-checked",
      ...(model ? { model } : {}),
      stdout,
      stderr,
      limitations: [
        `${backendMeta.displayName} returned ${solverStatus} for the provided SMT-LIB artifact.`,
        "This is SMT-solver evidence for the encoded constraints, not a proof-checker-backed proof of an informal, scientific, medical, safety, regulatory, or patent claim."
      ],
      warnings: [
        "Review the SMT-LIB encoding, solver logic, assumptions, and model/unsat meaning before relying on this result."
      ]
    });
  }

  return withCheckId({
    ...base,
    backend: {
      ...base.backend,
      exitCode: result.status
    },
    status: "unknown",
    trust: "unverified",
    stdout,
    stderr,
    limitations: [
      `${backendMeta.displayName} did not return a conclusive sat or unsat result for this artifact.`,
      "Unknown or unrecognized SMT output cannot support `smt-checked` or `proved` trust labels."
    ],
    warnings: [
      "The SMT solver output was unknown or unrecognized. Treat the claim as unverified."
    ]
  });
}

export async function writeSmtCheckRecord(input: WriteSmtCheckInput): Promise<SmtCheckWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const resolvedSourcePath = resolveWorkspacePath(status.root, input.sourcePath);
  const sourceRef = toPortablePath(relative(status.root, resolvedSourcePath));
  const sourceText = await readFile(resolvedSourcePath, "utf8");
  const record = checkSmtLibArtifact({
    sourcePath: resolvedSourcePath,
    sourceRef,
    sourceText,
    queryName: input.queryName,
    backend: input.backend,
    z3Command: input.z3Command,
    cvc5Command: input.cvc5Command,
    timeoutMs: input.timeoutMs,
    now: input.now,
    runner: input.runner,
    replayCommand: `truth-harness smt check ${quoteCommandArg(sourceRef)} --backend ${input.backend ?? "z3"} --write --json`
  });
  const smtDir = resolve(status.root, status.manifest.directories.smt);
  await mkdir(smtDir, { recursive: true });
  const baseName = `${record.createdAt.slice(0, 10)}-${record.checkId}`;
  const jsonPath = join(smtDir, `${baseName}.json`);
  const markdownPath = join(smtDir, `${baseName}.md`);
  const markdown = renderSmtCheckMarkdown(record);

  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "smt",
    now: record.createdAt,
    staleReason: "SMT check record written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listSmtChecks(rootPath: string): Promise<SmtCheckSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const smtDir = resolve(status.root, status.manifest.directories.smt);

  let files: string[];
  try {
    files = await readdir(smtDir);
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
        const path = join(smtDir, file);
        return summarizeSmtCheck(status.root, path, await readFile(path, "utf8"));
      })
  );

  return summaries
    .filter((summary): summary is SmtCheckSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function parseSmtCheckRecord(raw: string, sourcePath = "SMT check record"): SmtCheckRecord {
  const parsed = parseJsonObject(raw, sourcePath, "SMT check");
  const issues: string[] = [];
  if (parsed.schemaVersion !== "truth-harness.smt-check.v0") {
    issues.push(`$.schemaVersion must equal "truth-harness.smt-check.v0"`);
  }
  expectPattern(parsed, "checkId", /^smt_[a-f0-9]{16}$/u, "$.checkId", issues);
  expectDateTime(parsed, "createdAt", "$.createdAt", issues);

  const backend = expectRecord(parsed, "backend", "$.backend", issues);
  if (backend) {
    const backendId = expectOneOf(backend, "id", ["z3", "cvc5"], "$.backend.id", issues);
    if (backendId === "z3") {
      expectConst(backend, "displayName", "Z3 SMT solver", "$.backend.displayName", issues);
      expectConst(backend, "adapter", "local-z3-smtlib-subprocess", "$.backend.adapter", issues);
    } else if (backendId === "cvc5") {
      expectConst(backend, "displayName", "cvc5 SMT solver", "$.backend.displayName", issues);
      expectConst(backend, "adapter", "local-cvc5-smtlib-subprocess", "$.backend.adapter", issues);
    }
    expectConst(backend, "role", "checker", "$.backend.role", issues);
    expectConst(backend, "acceptedProofChecker", false, "$.backend.acceptedProofChecker", issues);
    expectNonEmptyString(backend, "command", "$.backend.command", issues);
    expectStringArray(backend, "args", "$.backend.args", issues);
  }

  const source = expectRecord(parsed, "source", "$.source", issues);
  if (source) {
    expectNonEmptyString(source, "path", "$.source.path", issues);
    expectPattern(source, "sha256", /^[a-f0-9]{64}$/u, "$.source.sha256", issues);
    expectNonNegativeInteger(source, "byteLength", "$.source.byteLength", issues);
  }

  const status = expectOneOf(parsed, "status", ["sat", "unsat", "unknown", "solver-unavailable", "error"], "$.status", issues);
  const trust = expectOneOf(parsed, "trust", ["smt-checked", "unverified"], "$.trust", issues);
  const proofCheckerBacked = expectBoolean(parsed, "proofCheckerBacked", "$.proofCheckerBacked", issues);
  expectConst(parsed, "proofCheckerBacked", false, "$.proofCheckerBacked", issues);
  expectConst(parsed, "localOnly", true, "$.localOnly", issues);
  expectConst(parsed, "networkAccess", "none", "$.networkAccess", issues);
  expectNonEmptyString(parsed, "replay", "$.replay", issues);
  expectStringArray(parsed, "limitations", "$.limitations", issues);
  expectStringArray(parsed, "warnings", "$.warnings", issues);
  validateOptionalSmtModel(parsed.model, issues);

  if (trust === "smt-checked" && ((status !== "sat" && status !== "unsat") || proofCheckerBacked !== false)) {
    issues.push("$.trust may be `smt-checked` only when status is `sat` or `unsat` and proofCheckerBacked is false");
  }
  if ((status === "sat" || status === "unsat") && trust !== "smt-checked") {
    issues.push("$.status `sat` or `unsat` must carry trust `smt-checked`");
  }

  if (issues.length > 0) {
    throw formatValidationError("SMT check", sourcePath, issues);
  }

  return parsed as unknown as SmtCheckRecord;
}

export function renderSmtCheckMarkdown(record: SmtCheckRecord): string {
  const lines = [
    `# SMT Check ${record.checkId}`,
    "",
    `Status: \`${record.status}\``,
    `Trust: \`${record.trust}\``,
    `Proof-checker backed: ${String(record.proofCheckerBacked)}`,
    `Created: ${record.createdAt}`,
    `Privacy: local-only (network: none)`,
    "",
    "## Source",
    "",
    `- Path: \`${record.source.path}\``,
    `- SHA-256: \`${record.source.sha256}\``,
    `- Bytes: ${record.source.byteLength}`
  ];

  if (record.source.queryName) {
    lines.push(`- Query: \`${record.source.queryName}\``);
  }

  lines.push(
    "",
    "## Backend",
    "",
    `- Backend: ${record.backend.displayName}`,
    `- Adapter: \`${record.backend.adapter}\``,
    `- Accepted proof checker: ${String(record.backend.acceptedProofChecker)}`,
    `- Command: \`${[record.backend.command, ...record.backend.args].join(" ")}\``
  );

  if (record.backend.version) {
    lines.push(`- Version: ${record.backend.version}`);
  }

  if (record.backend.exitCode !== undefined) {
    lines.push(`- Exit code: ${String(record.backend.exitCode)}`);
  }

  lines.push("", "## Replay", "", `\`${record.replay}\``);

  if (record.model) {
    lines.push("", "## Model", "", `Format: \`${record.model.format}\``);

    if (record.model.bindings.length > 0) {
      lines.push("", "Bindings:");
      for (const binding of record.model.bindings) {
        lines.push(`- \`${binding.name}: ${binding.sort} = ${binding.value}\``);
      }
    }

    if (record.model.warnings.length > 0) {
      lines.push("", "Model warnings:");
      for (const warning of record.model.warnings) {
        lines.push(`- ${warning}`);
      }
    }
  }

  if (record.stdout) {
    lines.push("", "## Stdout", "", "```text", record.stdout, "```");
  }

  if (record.stderr) {
    lines.push("", "## Stderr", "", "```text", record.stderr, "```");
  }

  if (record.error) {
    lines.push("", "## Error", "", "```text", record.error, "```");
  }

  if (record.limitations.length > 0) {
    lines.push("", "## Limitations", "");
    for (const limitation of record.limitations) {
      lines.push(`- ${limitation}`);
    }
  }

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
    "An SMT result is evidence about the encoded constraints under the solver, selected logic, and assumptions. It is not a proof-checker-backed proof of surrounding informal, scientific, medical, safety, regulatory, or patent claims."
  );

  return `${lines.join("\n")}\n`;
}

export function parseSmtModel(stdout: string, backendId: SmtBackendId = "z3"): SmtModelSummary | undefined {
  const forms = extractDefineFunForms(stdout);
  if (forms.length === 0) {
    return undefined;
  }

  const bindings: SmtModelBinding[] = [];
  const warnings: string[] = [];

  for (const form of forms) {
    const parsed = parseDefineFunForm(form);
    if (parsed) {
      bindings.push(parsed);
      continue;
    }

    warnings.push(`Could not parse model binding: ${singleLine(form)}`);
  }

  return {
    format: backendId === "z3" ? "z3-define-fun" : "smtlib-define-fun",
    bindings,
    warnings
  };
}

function probeSmtBackend(args: {
  backendId: SmtBackendId;
  command: string;
  timeoutMs: number;
  runner: SmtBackendCommandRunner;
}): SmtBackendProbe {
  const backend = smtBackendMetadata(args.backendId);
  const probeArgs = smtVersionArgs(args.backendId);
  const result = args.runner(args.command, probeArgs, args.timeoutMs);
  const stdout = singleLine(result.stdout);
  const stderr = singleLine(result.stderr);
  const errorText = result.error ? `${result.error.name ? `${result.error.name}: ` : ""}${result.error.message}` : undefined;

  if (result.error && isMissingExecutable(result.error)) {
    return {
      backendId: args.backendId,
      displayName: backend.displayName,
      adapter: backend.adapter,
      role: "checker",
      acceptedProofChecker: false,
      status: "missing",
      localOnly: true,
      networkAccess: "none",
      command: args.command,
      args: probeArgs,
      exitCode: result.status,
      stderr,
      error: errorText,
      canCheckSmt: false,
      statusProbeMintedCheck: false,
      limitations: [
        `${backend.displayName} executable was not found or could not be launched.`,
        `Install/configure ${backend.displayName} before any record can use it for \`smt-checked\` evidence.`
      ]
    };
  }

  if (result.error || result.status !== 0) {
    return {
      backendId: args.backendId,
      displayName: backend.displayName,
      adapter: backend.adapter,
      role: "checker",
      acceptedProofChecker: false,
      status: "error",
      localOnly: true,
      networkAccess: "none",
      command: args.command,
      args: probeArgs,
      exitCode: result.status,
      stdout,
      stderr,
      error: errorText ?? `${backend.displayName} exited with status ${String(result.status)}.`,
      canCheckSmt: false,
      statusProbeMintedCheck: false,
      limitations: [
        `${backend.displayName} was detected but the local version probe failed.`,
        "A failed backend probe cannot support `smt-checked` trust labels."
      ]
    };
  }

  const version = stdout || stderr || "version unavailable";

  return {
    backendId: args.backendId,
    displayName: backend.displayName,
    adapter: backend.adapter,
    role: "checker",
    acceptedProofChecker: false,
    status: "available",
    localOnly: true,
    networkAccess: "none",
    command: args.command,
    args: probeArgs,
    version,
    exitCode: result.status,
    stdout,
    stderr,
    canCheckSmt: true,
    statusProbeMintedCheck: false,
    limitations: [
      "This is only a local SMT solver availability probe.",
      `A record may be labeled \`smt-checked\` only after ${backend.displayName} returns sat or unsat for a concrete SMT-LIB artifact.`
    ]
  };
}

function smtBackendMetadata(backendId: SmtBackendId): {
  displayName: string;
  adapter: string;
} {
  return backendId === "z3"
    ? {
        displayName: "Z3 SMT solver",
        adapter: "local-z3-smtlib-subprocess"
      }
    : {
        displayName: "cvc5 SMT solver",
        adapter: "local-cvc5-smtlib-subprocess"
      };
}

function smtVersionArgs(backendId: SmtBackendId): string[] {
  return backendId === "z3" ? ["-version"] : ["--version"];
}

function smtCheckArgs(backendId: SmtBackendId, sourcePath: string): string[] {
  return backendId === "z3" ? ["-smt2", sourcePath] : ["--lang", "smt2", sourcePath];
}

function runCommand(command: string, args: string[], timeoutMs: number): SmtBackendCommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error
      ? {
          name: result.error.name,
          message: result.error.message
        }
      : undefined
  };
}

function withCheckId(record: Omit<SmtCheckRecord, "checkId">): SmtCheckRecord {
  return {
    ...record,
    checkId: `smt_${sha256({
      schemaVersion: record.schemaVersion,
      backend: record.backend,
      source: record.source,
      status: record.status,
      trust: record.trust,
      model: record.model,
      stdout: record.stdout,
      stderr: record.stderr,
      error: record.error
    }).slice(0, 16)}`
  };
}

function parseSolverStatus(stdout: string): "sat" | "unsat" | "unknown" {
  const resultLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line === "sat" || line === "unsat" || line === "unknown");

  if (resultLine === "sat" || resultLine === "unsat" || resultLine === "unknown") {
    return resultLine;
  }

  return "unknown";
}

function extractDefineFunForms(stdout: string): string[] {
  const forms: string[] = [];
  let searchFrom = 0;
  while (searchFrom < stdout.length) {
    const start = stdout.indexOf("(define-fun", searchFrom);
    if (start === -1) {
      break;
    }

    const end = findBalancedSExpressionEnd(stdout, start);
    if (end === undefined) {
      forms.push(stdout.slice(start).trim());
      break;
    }

    forms.push(stdout.slice(start, end + 1).trim());
    searchFrom = end + 1;
  }

  return forms;
}

function findBalancedSExpressionEnd(source: string, start: number): number | undefined {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
}

function parseDefineFunForm(form: string): SmtModelBinding | undefined {
  const match = /^\(define-fun\s+([A-Za-z_][A-Za-z0-9_]*)\s+\(\)\s+([A-Za-z_][A-Za-z0-9_]*)\s+([\s\S]+)\)$/.exec(form);
  if (!match) {
    return undefined;
  }

  return {
    name: match[1] ?? "",
    sort: match[2] ?? "",
    value: singleLine(match[3] ?? ""),
    raw: form
  };
}

function isMissingExecutable(error: { name?: string; message: string }): boolean {
  return /\b(?:ENOENT|ENOTDIR|EPERM|EACCES)\b/i.test(`${error.name ?? ""} ${error.message}`);
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimOutput(value: string): string {
  return value.trim();
}

function sha256(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/.test(value) ? value : JSON.stringify(value);
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing SMT check records.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function resolveWorkspacePath(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace root: ${path}`);
  }

  return target;
}

function summarizeSmtCheck(root: string, path: string, raw: string): SmtCheckSummary | undefined {
  let record: SmtCheckRecord;
  try {
    record = parseSmtCheckRecord(raw, path);
  } catch {
    return undefined;
  }

  return {
    path: toPortablePath(relative(root, path)),
    checkId: record.checkId,
    createdAt: record.createdAt,
    sourcePath: record.source.path,
    queryName: record.source.queryName,
    status: record.status,
    trust: record.trust,
    proofCheckerBacked: record.proofCheckerBacked,
    backendId: record.backend.id,
    backendVersion: record.backend.version,
    warnings: record.warnings
  };
}

function validateOptionalSmtModel(value: unknown, issues: string[]): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    issues.push("$.model must be an object");
    return;
  }

  expectOneOf(value, "format", ["z3-define-fun", "smtlib-define-fun"], "$.model.format", issues);
  const bindings = value.bindings;
  if (!Array.isArray(bindings)) {
    issues.push("$.model.bindings must be an array");
  } else {
    bindings.forEach((binding, index) => {
      const path = `$.model.bindings[${index}]`;
      if (!isRecord(binding)) {
        issues.push(`${path} must be an object`);
        return;
      }

      expectNonEmptyString(binding, "name", `${path}.name`, issues);
      expectNonEmptyString(binding, "sort", `${path}.sort`, issues);
      expectNonEmptyString(binding, "value", `${path}.value`, issues);
      expectNonEmptyString(binding, "raw", `${path}.raw`, issues);
    });
  }
  expectStringArray(value, "warnings", "$.model.warnings", issues);
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

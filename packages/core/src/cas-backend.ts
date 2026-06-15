import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import {
  expectBoolean,
  expectConst,
  expectDateTime,
  expectNonEmptyString,
  expectOneOf,
  expectPattern,
  expectRecord,
  expectStringArray,
  formatValidationError,
  parseJsonObject
} from "./artifact-record-validation.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import type { SymbolicPrompt } from "./sympy.js";
import type { TrustLabel } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export type CasBackendId = "maxima" | "sage";
export type CasBackendStatus = "available" | "missing" | "error";
export type SymbolicCasCheckStatus = "passed" | "failed" | "solver-unavailable" | "error";

export interface CasBackendCommandResult {
  status: number | null;
  signal?: string | null;
  stdout: string;
  stderr: string;
  error?: {
    name?: string;
    message: string;
  };
}

export type CasBackendCommandRunner = (
  command: string,
  args: string[],
  timeoutMs: number
) => CasBackendCommandResult;

export interface CasBackendProbe {
  backendId: CasBackendId;
  displayName: string;
  adapter: string;
  role: "cas";
  acceptedProofChecker: false;
  status: CasBackendStatus;
  localOnly: true;
  networkAccess: "none";
  command: string;
  args: string[];
  version?: string;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  error?: string;
  canCheckSymbolic: boolean;
  statusProbeMintedCheck: false;
  limitations: string[];
}

export interface CasBackendStatusReport {
  schemaVersion: "truth-harness.cas-backends.v0";
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  casBackendsAvailable: number;
  backends: CasBackendProbe[];
  trustBoundary: {
    statusProbeIsNotCheck: true;
    crossCheckedRequiresIndependentRun: true;
    casOutputIsNotProofCheckerProof: true;
    provedRequiresAcceptedProofChecker: true;
  };
  warnings: string[];
}

export interface CasBackendStatusOptions {
  maximaCommand?: string;
  sageCommand?: string;
  timeoutMs?: number;
  now?: Date;
  runner?: CasBackendCommandRunner;
}

export interface SymbolicCasCheckInput {
  prompt: SymbolicPrompt;
  result: string;
  maximaCommand?: string;
  timeoutMs?: number;
  now?: Date;
  runner?: CasBackendCommandRunner;
}

export interface SymbolicCasCheckRecordInput extends SymbolicCasCheckInput {
  replayCommand?: string;
}

export interface SymbolicCasCheckResult {
  schemaVersion: "truth-harness.symbolic-cas-check.v0";
  checkId: string;
  createdAt: string;
  backend: {
    id: "maxima";
    displayName: "Maxima CAS";
    adapter: "local-maxima-symbolic-subprocess";
    role: "cas";
    acceptedProofChecker: false;
    command: string;
    args: string[];
    version?: string;
    exitCode?: number | null;
  };
  operation: SymbolicPrompt["operation"];
  expression: string;
  result: string;
  variable: string;
  status: SymbolicCasCheckStatus;
  trust: TrustLabel;
  proofCheckerBacked: false;
  localOnly: true;
  networkAccess: "none";
  residual?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
  limitations: string[];
  warnings: string[];
}

export type SymbolicCasCheckRecord = Omit<SymbolicCasCheckResult, "schemaVersion"> & {
  schemaVersion: "truth-harness.cas-check.v0";
  replay: string;
};

export interface WriteSymbolicCasCheckInput extends SymbolicCasCheckInput {
  rootPath: string;
}

export interface SymbolicCasCheckWriteResult {
  record: SymbolicCasCheckRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface SymbolicCasCheckSummary {
  path: string;
  checkId: string;
  createdAt: string;
  operation: SymbolicPrompt["operation"];
  expression: string;
  result: string;
  variable: string;
  status: SymbolicCasCheckStatus;
  trust: TrustLabel;
  backendId: "maxima";
  backendVersion?: string;
  warnings: string[];
}

const DEFAULT_TIMEOUT_MS = 3000;
const MAXIMA_MARKER = "TRUTH_HARNESS_MAXIMA_STATUS:";

export function getCasBackendStatus(options: CasBackendStatusOptions = {}): CasBackendStatusReport {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.runner ?? runCommand;
  const maximaCommand = resolveMaximaCommand(options.maximaCommand);
  const sageCommand = resolveSageCommand(options.sageCommand);
  const maxima = probeMaximaBackend({
    command: maximaCommand,
    timeoutMs,
    runner
  });
  const sage = probeSageBackend({
    command: sageCommand,
    timeoutMs,
    runner
  });
  const backends = [maxima, sage];
  const casBackendsAvailable = backends.filter((backend) => backend.status === "available").length;

  return {
    schemaVersion: "truth-harness.cas-backends.v0",
    createdAt: (options.now ?? new Date()).toISOString(),
    localOnly: true,
    networkAccess: "none",
    casBackendsAvailable,
    backends,
    trustBoundary: {
      statusProbeIsNotCheck: true,
      crossCheckedRequiresIndependentRun: true,
      casOutputIsNotProofCheckerProof: true,
      provedRequiresAcceptedProofChecker: true
    },
    warnings: casBackendStatusWarnings(backends)
  };
}

export function checkSymbolicWithMaximaSync(input: SymbolicCasCheckInput): SymbolicCasCheckResult {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = input.runner ?? runCommand;
  const maximaCommand = resolveMaximaCommand(input.maximaCommand);
  const createdAt = (input.now ?? new Date()).toISOString();
  const backendProbe = probeMaximaBackend({
    command: maximaCommand,
    timeoutMs,
    runner
  });
  const base = {
    schemaVersion: "truth-harness.symbolic-cas-check.v0" as const,
    checkId: `cas_${hashCasCheck(input.prompt, input.result).slice(0, 16)}`,
    createdAt,
    backend: {
      id: "maxima" as const,
      displayName: "Maxima CAS" as const,
      adapter: "local-maxima-symbolic-subprocess" as const,
      role: "cas" as const,
      acceptedProofChecker: false as const,
      command: maximaCommand,
      args: [] as string[],
      ...(backendProbe.version ? { version: backendProbe.version } : {}),
      ...(backendProbe.exitCode !== undefined ? { exitCode: backendProbe.exitCode } : {})
    },
    operation: input.prompt.operation,
    expression: input.prompt.expression,
    result: input.result,
    variable: input.prompt.variable,
    proofCheckerBacked: false as const,
    localOnly: true as const,
    networkAccess: "none" as const
  };

  if (backendProbe.status !== "available") {
    return {
      ...base,
      status: "solver-unavailable",
      trust: "unverified",
      error: backendProbe.error ?? backendProbe.stderr ?? "Maxima CAS is unavailable.",
      limitations: [
        "Independent CAS cross-check did not run because Maxima was unavailable.",
        "Unavailable CAS status must not upgrade a symbolic result to `cross-checked`."
      ],
      warnings: ["Install Maxima or configure TRUTH_HARNESS_MAXIMA to enable independent local CAS cross-checks."]
    };
  }

  let script: string;
  try {
    script = buildMaximaCheckScript(input.prompt, input.result);
  } catch (error) {
    return {
      ...base,
      status: "error",
      trust: "unverified",
      error: error instanceof Error ? error.message : "Could not build Maxima symbolic check script.",
      limitations: [
        "The independent CAS check was not run because the symbolic expression could not be translated safely.",
        "Translation failure must not upgrade a symbolic result to `cross-checked`."
      ],
      warnings: ["Keep symbolic CAS expressions inside the supported safe expression subset."]
    };
  }

  const args = ["--very-quiet", "--batch-string", script];
  const output = runner(maximaCommand, args, timeoutMs);
  const marker = parseMaximaMarker(output.stdout);
  const stderr = trimOptional(output.stderr);
  const stdout = trimOptional(output.stdout);

  const backend = {
    ...base.backend,
    args,
    exitCode: output.status,
    ...(backendProbe.version ? { version: backendProbe.version } : {})
  };

  if (output.error) {
    return {
      ...base,
      backend,
      status: "error",
      trust: "unverified",
      stderr,
      error: output.error.message,
      limitations: [
        "The independent CAS process failed before producing a check result.",
        "CAS execution failure must not upgrade a symbolic result to `cross-checked`."
      ],
      warnings: [output.error.message]
    };
  }

  if (output.status !== 0 || !marker) {
    return {
      ...base,
      backend,
      status: "error",
      trust: "unverified",
      stdout,
      stderr,
      error: marker ? undefined : "Maxima did not emit a recognizable Truth Harness check marker.",
      limitations: [
        "The independent CAS run did not produce a parseable agreement result.",
        "Unparseable CAS output must not upgrade a symbolic result to `cross-checked`."
      ],
      warnings: [stderr ?? "Maxima output could not be parsed."].filter(Boolean)
    };
  }

  return {
    ...base,
    backend,
    status: marker.status,
    trust: marker.status === "passed" ? "cross-checked" : "unverified",
    residual: marker.residual,
    stdout,
    stderr,
    limitations:
      marker.status === "passed"
        ? [
            "Cross-checked means SymPy and Maxima agreed on a normalized symbolic equality.",
            "CAS agreement is not a proof-checker-backed proof of an arbitrary informal truth-harness."
          ]
        : [
            "Maxima did not agree with the SymPy result under the generated equality check.",
            "A CAS disagreement leaves the symbolic claim unverified until a human or stronger checker resolves it."
          ],
    warnings:
      marker.status === "passed"
        ? []
        : ["Independent CAS disagreement: do not rely on the symbolic result without follow-up."]
  };
}

export function createSymbolicCasCheckRecord(input: SymbolicCasCheckRecordInput): SymbolicCasCheckRecord {
  const check = checkSymbolicWithMaximaSync(input);
  const replay = input.replayCommand ?? casCheckReplayCommand(input, false);

  return {
    ...check,
    schemaVersion: "truth-harness.cas-check.v0",
    replay
  };
}

export async function writeSymbolicCasCheckRecord(
  input: WriteSymbolicCasCheckInput
): Promise<SymbolicCasCheckWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const record = createSymbolicCasCheckRecord({
    prompt: input.prompt,
    result: input.result,
    maximaCommand: input.maximaCommand,
    timeoutMs: input.timeoutMs,
    now: input.now,
    runner: input.runner,
    replayCommand: casCheckReplayCommand(input, true)
  });
  const casDir = resolve(status.root, status.manifest.directories.cas);
  await mkdir(casDir, { recursive: true });
  const baseName = `${record.createdAt.slice(0, 10)}-${record.checkId}`;
  const jsonPath = join(casDir, `${baseName}.json`);
  const markdownPath = join(casDir, `${baseName}.md`);
  const markdown = renderSymbolicCasCheckMarkdown(record);

  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "cas",
    now: record.createdAt,
    staleReason: "CAS check record written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listSymbolicCasChecks(rootPath: string): Promise<SymbolicCasCheckSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const casDir = resolve(status.root, status.manifest.directories.cas);

  let files: string[];
  try {
    files = await readdir(casDir);
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
        const path = join(casDir, file);
        return summarizeSymbolicCasCheck(status.root, path, await readFile(path, "utf8"));
      })
  );

  return summaries
    .filter((summary): summary is SymbolicCasCheckSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function parseSymbolicCasCheckRecord(raw: string, sourcePath = "CAS check record"): SymbolicCasCheckRecord {
  const parsed = parseJsonObject(raw, sourcePath, "CAS check");
  const issues: string[] = [];
  if (parsed.schemaVersion !== "truth-harness.cas-check.v0") {
    issues.push(`$.schemaVersion must equal "truth-harness.cas-check.v0"`);
  }
  expectPattern(parsed, "checkId", /^cas_[a-f0-9]{16}$/u, "$.checkId", issues);
  expectDateTime(parsed, "createdAt", "$.createdAt", issues);

  const backend = expectRecord(parsed, "backend", "$.backend", issues);
  if (backend) {
    expectConst(backend, "id", "maxima", "$.backend.id", issues);
    expectConst(backend, "displayName", "Maxima CAS", "$.backend.displayName", issues);
    expectConst(backend, "adapter", "local-maxima-symbolic-subprocess", "$.backend.adapter", issues);
    expectConst(backend, "role", "cas", "$.backend.role", issues);
    expectConst(backend, "acceptedProofChecker", false, "$.backend.acceptedProofChecker", issues);
    expectNonEmptyString(backend, "command", "$.backend.command", issues);
    expectStringArray(backend, "args", "$.backend.args", issues);
  }

  expectOneOf(parsed, "operation", ["simplify", "factor", "expand", "differentiate", "integrate"], "$.operation", issues);
  expectNonEmptyString(parsed, "expression", "$.expression", issues);
  expectNonEmptyString(parsed, "result", "$.result", issues);
  expectPattern(parsed, "variable", /^[A-Za-z_][A-Za-z0-9_]*$/u, "$.variable", issues);
  const status = expectOneOf(parsed, "status", ["passed", "failed", "solver-unavailable", "error"], "$.status", issues);
  const trust = expectOneOf(parsed, "trust", ["cross-checked", "unverified"], "$.trust", issues);
  const proofCheckerBacked = expectBoolean(parsed, "proofCheckerBacked", "$.proofCheckerBacked", issues);
  expectConst(parsed, "proofCheckerBacked", false, "$.proofCheckerBacked", issues);
  expectConst(parsed, "localOnly", true, "$.localOnly", issues);
  expectConst(parsed, "networkAccess", "none", "$.networkAccess", issues);
  expectNonEmptyString(parsed, "replay", "$.replay", issues);
  expectStringArray(parsed, "limitations", "$.limitations", issues);
  expectStringArray(parsed, "warnings", "$.warnings", issues);

  if (trust === "cross-checked" && (status !== "passed" || proofCheckerBacked !== false)) {
    issues.push("$.trust may be `cross-checked` only when status is `passed` and proofCheckerBacked is false");
  }
  if (status === "passed" && trust !== "cross-checked") {
    issues.push("$.status `passed` must carry trust `cross-checked`");
  }

  if (issues.length > 0) {
    throw formatValidationError("CAS check", sourcePath, issues);
  }

  return parsed as unknown as SymbolicCasCheckRecord;
}

export function renderSymbolicCasCheckMarkdown(record: SymbolicCasCheckRecord): string {
  const lines = [
    `# CAS Check ${record.checkId}`,
    "",
    `Status: \`${record.status}\``,
    `Trust: \`${record.trust}\``,
    `Proof-checker backed: ${String(record.proofCheckerBacked)}`,
    `Created: ${record.createdAt}`,
    `Privacy: local-only (network: none)`,
    "",
    "## Prompt",
    "",
    `- Operation: \`${record.operation}\``,
    `- Expression: \`${record.expression}\``,
    `- Result: \`${record.result}\``,
    `- Variable: \`${record.variable}\``,
    "",
    "## Backend",
    "",
    `- Backend: ${record.backend.displayName}`,
    `- Adapter: \`${record.backend.adapter}\``,
    `- Accepted proof checker: ${String(record.backend.acceptedProofChecker)}`,
    `- Command: \`${[record.backend.command, ...record.backend.args].join(" ")}\``
  ];

  if (record.backend.version) {
    lines.push(`- Version: ${record.backend.version}`);
  }

  if (record.backend.exitCode !== undefined) {
    lines.push(`- Exit code: ${String(record.backend.exitCode)}`);
  }

  lines.push("", "## Replay", "", `\`${record.replay}\``);

  if (record.residual) {
    lines.push("", "## Residual", "", `\`${record.residual}\``);
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
    "A Maxima CAS agreement supports a narrow `cross-checked` symbolic equality. It is not a proof-checker-backed proof of an arbitrary formal math claim, scientific claim, medical claim, safety claim, regulatory claim, or patent claim."
  );

  return `${lines.join("\n")}\n`;
}

function probeMaximaBackend(args: {
  command: string;
  timeoutMs: number;
  runner: CasBackendCommandRunner;
}): CasBackendProbe {
  const versionArgs = ["--version"];
  const result = args.runner(args.command, versionArgs, args.timeoutMs);
  const version = firstMaximaVersionLine(result.stdout) ?? firstNonEmptyLine(result.stdout);
  const launchFailure = result.error ? isLaunchFailure(result.error) : false;
  const errorText = result.error?.message
    ?? (result.signal ? `Maxima exited by signal ${result.signal}.` : undefined)
    ?? (result.status !== 0 ? `Maxima exited with status ${String(result.status)}.` : undefined);
  const status: CasBackendStatus = result.status === 0 && version
    ? "available"
    : launchFailure
      ? "missing"
      : "error";

  return {
    backendId: "maxima",
    displayName: "Maxima CAS",
    adapter: "local-maxima-symbolic-subprocess",
    role: "cas",
    acceptedProofChecker: false,
    status,
    localOnly: true,
    networkAccess: "none",
    command: args.command,
    args: versionArgs,
    ...(version ? { version } : {}),
    exitCode: result.status,
    stdout: trimOptional(result.stdout),
    stderr: trimOptional(result.stderr),
    error: errorText,
    canCheckSymbolic: status === "available",
    statusProbeMintedCheck: false,
    limitations: [
      "A CAS backend probe only reports availability; it does not prove, refute, or cross-check a claim.",
      "CAS output is not proof-checker-backed proof."
    ]
  };
}

function probeSageBackend(args: {
  command: string;
  timeoutMs: number;
  runner: CasBackendCommandRunner;
}): CasBackendProbe {
  const versionArgs = ["--version"];
  const result = args.runner(args.command, versionArgs, args.timeoutMs);
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const version = firstSageVersionLine(combinedOutput) ?? firstNonEmptyLine(combinedOutput);
  const launchFailure = result.error ? isLaunchFailure(result.error) : false;
  const errorText = result.error?.message
    ?? (result.signal ? `SageMath exited by signal ${result.signal}.` : undefined)
    ?? (result.status !== 0 ? `SageMath exited with status ${String(result.status)}.` : undefined);
  const status: CasBackendStatus = result.status === 0 && version
    ? "available"
    : launchFailure
      ? "missing"
      : "error";

  return {
    backendId: "sage",
    displayName: "SageMath CAS",
    adapter: "local-sagemath-status-probe",
    role: "cas",
    acceptedProofChecker: false,
    status,
    localOnly: true,
    networkAccess: "none",
    command: args.command,
    args: versionArgs,
    ...(version ? { version } : {}),
    exitCode: result.status,
    stdout: trimOptional(result.stdout),
    stderr: trimOptional(result.stderr),
    error: errorText,
    canCheckSymbolic: false,
    statusProbeMintedCheck: false,
    limitations: [
      "This SageMath adapter is currently a local availability probe only; it does not run arbitrary Sage code or mint trust.",
      "Future SageMath checks must use constrained scripts, recorded inputs/outputs, timeouts, replay commands, and conservative trust labels.",
      "SageMath output is CAS evidence, not proof-checker-backed proof."
    ]
  };
}

function casBackendStatusWarnings(backends: CasBackendProbe[]): string[] {
  if (backends.some((backend) => backend.backendId === "maxima" && backend.canCheckSymbolic)) {
    return [
      "Detected a Maxima CAS backend that can run concrete symbolic agreement checks, but this status report does not prove, refute, or cross-check any claim.",
      "Detected CAS availability must not upgrade trust labels without a concrete recorded check."
    ];
  }

  if (backends.some((backend) => backend.backendId === "sage" && backend.status === "available")) {
    return [
      "Detected SageMath locally, but the current Sage adapter is status-only and cannot mint trust.",
      "Truth Harness must not label SageMath output `cross-checked` until a constrained Sage check record is implemented and replayable."
    ];
  }

  return [
    "No independent local CAS backend was detected. Truth Harness must not label symbolic results `cross-checked` until an independent CAS run agrees on a concrete result."
  ];
}

function buildMaximaCheckScript(prompt: SymbolicPrompt, result: string): string {
  const expression = toMaximaExpression(prompt.expression);
  const resultExpression = toMaximaExpression(result);
  const variable = toMaximaIdentifier(prompt.variable);
  const [left, right] = comparisonExpressions(prompt.operation, expression, resultExpression, variable);

  return [
    "display2d:false$",
    `residual: fullratsimp(trigsimp((${left}) - (${right})))$`,
    'status: if is(residual = 0) then "passed" else "failed"$',
    `printf(true, "${MAXIMA_MARKER}~a:~a~%", status, residual)$`,
    "quit();"
  ].join("\n");
}

function comparisonExpressions(
  operation: SymbolicPrompt["operation"],
  expression: string,
  result: string,
  variable: string
): [string, string] {
  if (operation === "differentiate") {
    return [`diff(${expression}, ${variable})`, result];
  }

  if (operation === "integrate") {
    return [`diff(${result}, ${variable})`, expression];
  }

  return [expression, result];
}

function toMaximaExpression(source: string): string {
  const converted = source
    .replaceAll("**", "^")
    .replace(/\bpi\b/gu, "%pi")
    .replace(/\bE\b/gu, "%e");

  if (converted.includes("__") || !/^[A-Za-z0-9_%+\-*/^().,\s]+$/u.test(converted)) {
    throw new Error(`Expression is outside the supported Maxima-safe subset: ${source}`);
  }

  return converted;
}

function toMaximaIdentifier(source: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(source)) {
    throw new Error(`Invalid symbolic variable for Maxima: ${source}`);
  }

  return source;
}

function parseMaximaMarker(stdout: string): { status: "passed" | "failed"; residual: string } | undefined {
  for (const line of stdout.split(/\r?\n/u)) {
    const markerStart = line.indexOf(MAXIMA_MARKER);
    if (markerStart < 0) {
      continue;
    }

    const payload = line.slice(markerStart + MAXIMA_MARKER.length).trim();
    const match = /^(passed|failed):(.*)$/u.exec(payload);
    if (match) {
      return {
        status: match[1] as "passed" | "failed",
        residual: match[2].trim()
      };
    }
  }

  return undefined;
}

function resolveMaximaCommand(command: string | undefined): string {
  return command?.trim() || process.env.TRUTH_HARNESS_MAXIMA?.trim() || "maxima";
}

function resolveSageCommand(command: string | undefined): string {
  return command?.trim() || process.env.TRUTH_HARNESS_SAGE?.trim() || "sage";
}

function runCommand(command: string, args: string[], timeoutMs: number): CasBackendCommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });

  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error ? { error: { name: result.error.name, message: result.error.message } } : {})
  };
}

function summarizeSymbolicCasCheck(
  root: string,
  path: string,
  raw: string
): SymbolicCasCheckSummary | undefined {
  let record: SymbolicCasCheckRecord;
  try {
    record = parseSymbolicCasCheckRecord(raw, path);
  } catch {
    return undefined;
  }

  return {
    path: toPortablePath(relative(root, path)),
    checkId: record.checkId,
    createdAt: record.createdAt,
    operation: record.operation,
    expression: record.expression,
    result: record.result,
    variable: record.variable,
    status: record.status,
    trust: record.trust,
    backendId: "maxima",
    backendVersion: record.backend.version,
    warnings: record.warnings
  };
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/u.test(value) ? value : JSON.stringify(value);
}

function casCheckReplayCommand(input: SymbolicCasCheckInput, write: boolean): string {
  return [
    "truth-harness cas check",
    `--operation ${quoteCommandArg(input.prompt.operation)}`,
    `--expression ${quoteCommandArg(input.prompt.expression)}`,
    `--result ${quoteCommandArg(input.result)}`,
    `--variable ${quoteCommandArg(input.prompt.variable)}`,
    ...(input.maximaCommand ? [`--maxima-command ${quoteCommandArg(input.maximaCommand)}`] : []),
    ...(input.timeoutMs ? [`--timeout-ms ${String(input.timeoutMs)}`] : []),
    ...(write ? ["--write"] : []),
    "--json"
  ].join(" ");
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing CAS check records.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function firstNonEmptyLine(text: string): string | undefined {
  return text.split(/\r?\n/u).map((line) => line.trim()).find(Boolean);
}

function firstMaximaVersionLine(text: string): string | undefined {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^Maxima\s+\d+(?:\.\d+)*/u.test(line));
}

function firstSageVersionLine(text: string): string | undefined {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^(?:SageMath|Sage)\s+(?:version\s+)?\d+(?:\.\d+)*/iu.test(line));
}

function trimOptional(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed ? trimmed : undefined;
}

function isLaunchFailure(error: { name?: string; message: string }): boolean {
  return /\b(?:ENOENT|EPERM|EACCES|ETIMEDOUT)\b/u.test(`${error.name ?? ""} ${error.message}`);
}

function hashCasCheck(prompt: SymbolicPrompt, result: string): string {
  const payload = JSON.stringify({
    operation: prompt.operation,
    expression: prompt.expression,
    variable: prompt.variable,
    result
  });
  let hash = 5381;
  for (const char of payload) {
    hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
  }
  return (hash >>> 0).toString(16).padStart(16, "0");
}

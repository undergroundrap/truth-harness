import { spawnSync } from "node:child_process";
import type { SymbolicPrompt } from "./sympy.js";
import type { TrustLabel } from "./types.js";

export type CasBackendId = "maxima";
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
  schemaVersion: "theorem.cas-backends.v0";
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

export interface SymbolicCasCheckResult {
  schemaVersion: "theorem.symbolic-cas-check.v0";
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

const DEFAULT_TIMEOUT_MS = 3000;
const MAXIMA_MARKER = "THEOREM_MAXIMA_STATUS:";

export function getCasBackendStatus(options: CasBackendStatusOptions = {}): CasBackendStatusReport {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.runner ?? runCommand;
  const maximaCommand = resolveMaximaCommand(options.maximaCommand);
  const maxima = probeMaximaBackend({
    command: maximaCommand,
    timeoutMs,
    runner
  });
  const casBackendsAvailable = maxima.status === "available" ? 1 : 0;

  return {
    schemaVersion: "theorem.cas-backends.v0",
    createdAt: (options.now ?? new Date()).toISOString(),
    localOnly: true,
    networkAccess: "none",
    casBackendsAvailable,
    backends: [maxima],
    trustBoundary: {
      statusProbeIsNotCheck: true,
      crossCheckedRequiresIndependentRun: true,
      casOutputIsNotProofCheckerProof: true,
      provedRequiresAcceptedProofChecker: true
    },
    warnings:
      casBackendsAvailable > 0
        ? [
            "A detected CAS can cross-check symbolic equalities, but this status report does not prove, refute, or cross-check any claim."
          ]
        : [
            "No independent local CAS backend was detected. Theorem Workbench must not label symbolic results `cross-checked` until an independent CAS run agrees on a concrete result."
          ]
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
    schemaVersion: "theorem.symbolic-cas-check.v0" as const,
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
      warnings: ["Install Maxima or configure THEOREM_MAXIMA to enable independent local CAS cross-checks."]
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
      error: marker ? undefined : "Maxima did not emit a recognizable Theorem check marker.",
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
            "CAS agreement is not a proof-checker-backed proof of an arbitrary informal theorem."
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

function probeMaximaBackend(args: {
  command: string;
  timeoutMs: number;
  runner: CasBackendCommandRunner;
}): CasBackendProbe {
  const versionArgs = ["--version"];
  const result = args.runner(args.command, versionArgs, args.timeoutMs);
  const version = firstNonEmptyLine(result.stdout);
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

function buildMaximaCheckScript(prompt: SymbolicPrompt, result: string): string {
  const expression = toMaximaExpression(prompt.expression);
  const resultExpression = toMaximaExpression(result);
  const variable = toMaximaIdentifier(prompt.variable);
  const [left, right] = comparisonExpressions(prompt.operation, expression, resultExpression, variable);

  return [
    "display2d:false$",
    `residual: fullratsimp((${left}) - (${right}))$`,
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
  const line = stdout.split(/\r?\n/u).find((item) => item.includes(MAXIMA_MARKER));
  if (!line) {
    return undefined;
  }

  const markerStart = line.indexOf(MAXIMA_MARKER);
  const payload = line.slice(markerStart + MAXIMA_MARKER.length).trim();
  const match = /^(passed|failed):(.*)$/u.exec(payload);
  if (!match) {
    return undefined;
  }

  return {
    status: match[1] as "passed" | "failed",
    residual: match[2].trim()
  };
}

function resolveMaximaCommand(command: string | undefined): string {
  return command?.trim() || process.env.THEOREM_MAXIMA?.trim() || "maxima";
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

function firstNonEmptyLine(text: string): string | undefined {
  return text.split(/\r?\n/u).map((line) => line.trim()).find(Boolean);
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

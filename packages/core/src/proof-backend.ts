import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import type { TrustLabel } from "./types.js";

export type ProofBackendId = "lean";
export type ProofBackendStatus = "available" | "missing" | "error";

export interface ProofBackendCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: {
    name?: string;
    message: string;
  };
}

export type ProofBackendCommandRunner = (
  command: string,
  args: string[],
  timeoutMs: number
) => ProofBackendCommandResult;

export interface ProofBackendProbe {
  backendId: ProofBackendId;
  displayName: string;
  adapter: string;
  role: "proof-checker";
  acceptedProofChecker: true;
  status: ProofBackendStatus;
  localOnly: true;
  networkAccess: "none";
  command: string;
  args: string[];
  version?: string;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  error?: string;
  canCheckProofs: boolean;
  statusProbeMintedProof: false;
  limitations: string[];
}

export interface ProofBackendStatusReport {
  schemaVersion: "theorem.proof-backends.v0";
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  proofCheckersAvailable: number;
  backends: ProofBackendProbe[];
  trustBoundary: {
    statusProbeIsNotProof: true;
    provedRequiresAcceptedProofChecker: true;
    provedRequiresSuccessfulProofRun: true;
    casOrSmtOutputIsNotLeanProof: true;
  };
  warnings: string[];
}

export interface ProofBackendStatusOptions {
  leanCommand?: string;
  timeoutMs?: number;
  now?: Date;
  runner?: ProofBackendCommandRunner;
}

export type LeanProofCheckStatus = "accepted" | "rejected" | "backend-unavailable" | "error";

export interface LeanProofCheckInput {
  sourcePath: string;
  sourceText: string;
  sourceRef?: string;
  theoremName?: string;
  leanCommand?: string;
  timeoutMs?: number;
  now?: Date;
  runner?: ProofBackendCommandRunner;
  replayCommand?: string;
}

export interface LeanProofCheckRecord {
  schemaVersion: "theorem.proof-check.v0";
  checkId: string;
  createdAt: string;
  backend: {
    id: "lean";
    displayName: "Lean proof checker";
    adapter: "local-lean-subprocess";
    role: "proof-checker";
    acceptedProofChecker: true;
    command: string;
    args: string[];
    version?: string;
    exitCode?: number | null;
  };
  source: {
    path: string;
    sha256: string;
    byteLength: number;
    theoremName?: string;
  };
  status: LeanProofCheckStatus;
  trust: TrustLabel;
  proofCheckerBacked: boolean;
  localOnly: true;
  networkAccess: "none";
  replay: string;
  stdout?: string;
  stderr?: string;
  error?: string;
  limitations: string[];
  warnings: string[];
}

export interface WriteLeanProofCheckInput {
  rootPath: string;
  sourcePath: string;
  theoremName?: string;
  leanCommand?: string;
  timeoutMs?: number;
  now?: Date;
  runner?: ProofBackendCommandRunner;
}

export interface LeanProofCheckWriteResult {
  record: LeanProofCheckRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface LeanProofCheckSummary {
  path: string;
  checkId: string;
  createdAt: string;
  sourcePath: string;
  theoremName?: string;
  status: LeanProofCheckStatus;
  trust: TrustLabel;
  proofCheckerBacked: boolean;
  backendId: "lean";
  backendVersion?: string;
  warnings: string[];
}

const DEFAULT_TIMEOUT_MS = 3000;

export function getProofBackendStatus(options: ProofBackendStatusOptions = {}): ProofBackendStatusReport {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.runner ?? runCommand;
  const leanCommand = options.leanCommand?.trim() || process.env.THEOREM_LEAN?.trim() || "lean";
  const lean = probeLeanBackend({
    command: leanCommand,
    timeoutMs,
    runner
  });
  const proofCheckersAvailable = lean.status === "available" ? 1 : 0;

  return {
    schemaVersion: "theorem.proof-backends.v0",
    createdAt: (options.now ?? new Date()).toISOString(),
    localOnly: true,
    networkAccess: "none",
    proofCheckersAvailable,
    backends: [lean],
    trustBoundary: {
      statusProbeIsNotProof: true,
      provedRequiresAcceptedProofChecker: true,
      provedRequiresSuccessfulProofRun: true,
      casOrSmtOutputIsNotLeanProof: true
    },
    warnings:
      proofCheckersAvailable > 0
        ? [
            "A detected proof checker can check proof artifacts, but this status report does not prove any theorem or mint `proved` receipts."
          ]
        : [
            "No accepted local proof checker was detected. Theorem Workbench must not label results `proved` on this machine until a proof-checking adapter succeeds."
          ]
  };
}

export function checkLeanProofArtifact(input: LeanProofCheckInput): LeanProofCheckRecord {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = input.runner ?? runCommand;
  const leanCommand = input.leanCommand?.trim() || process.env.THEOREM_LEAN?.trim() || "lean";
  const createdAt = (input.now ?? new Date()).toISOString();
  const sourcePath = input.sourcePath;
  const sourceRef = input.sourceRef ?? sourcePath;
  const sourceSha256 = sha256(input.sourceText);
  const sourceByteLength = Buffer.byteLength(input.sourceText, "utf8");
  const theoremName = normalizeOptional(input.theoremName);
  const backendProbe = probeLeanBackend({
    command: leanCommand,
    timeoutMs,
    runner
  });
  const proofArgs = [sourcePath];
  const base = {
    schemaVersion: "theorem.proof-check.v0" as const,
    createdAt,
    backend: {
      id: "lean" as const,
      displayName: "Lean proof checker" as const,
      adapter: "local-lean-subprocess" as const,
      role: "proof-checker" as const,
      acceptedProofChecker: true as const,
      command: leanCommand,
      args: proofArgs,
      ...(backendProbe.version ? { version: backendProbe.version } : {})
    },
    source: {
      path: sourceRef,
      sha256: sourceSha256,
      byteLength: sourceByteLength,
      ...(theoremName ? { theoremName } : {})
    },
    localOnly: true as const,
    networkAccess: "none" as const,
    replay: input.replayCommand ?? `theorem proof check ${quoteCommandArg(sourceRef)} --json`
  };

  if (backendProbe.status !== "available") {
    return withCheckId({
      ...base,
      backend: {
        ...base.backend,
        exitCode: backendProbe.exitCode
      },
      status: "backend-unavailable",
      trust: "unverified",
      proofCheckerBacked: false,
      stdout: backendProbe.stdout,
      stderr: backendProbe.stderr,
      error: backendProbe.error,
      limitations: [
        "Lean did not pass the local backend availability probe, so no proof artifact was checked.",
        "This record cannot support a `proved` trust label."
      ],
      warnings: [
        "No accepted local proof-checking run completed. Treat the claim as unverified until Lean accepts the concrete proof artifact."
      ]
    });
  }

  const result = runner(leanCommand, proofArgs, timeoutMs);
  const stdout = singleLine(result.stdout);
  const stderr = singleLine(result.stderr);
  const errorText = result.error ? `${result.error.name ? `${result.error.name}: ` : ""}${result.error.message}` : undefined;

  if (result.error && isMissingExecutable(result.error)) {
    return withCheckId({
      ...base,
      backend: {
        ...base.backend,
        exitCode: result.status
      },
      status: "backend-unavailable",
      trust: "unverified",
      proofCheckerBacked: false,
      stdout,
      stderr,
      error: errorText,
      limitations: [
        "Lean was available during probing but could not be launched for the proof check.",
        "This record cannot support a `proved` trust label."
      ],
      warnings: [
        "No accepted local proof-checking run completed. Treat the claim as unverified until Lean accepts the concrete proof artifact."
      ]
    });
  }

  if (result.error) {
    return withCheckId({
      ...base,
      backend: {
        ...base.backend,
        exitCode: result.status
      },
      status: "error",
      trust: "unverified",
      proofCheckerBacked: false,
      stdout,
      stderr,
      error: errorText,
      limitations: [
        "Lean proof checking failed due to a local execution error.",
        "Execution errors cannot support `proved` trust labels."
      ],
      warnings: [
        "The proof artifact was not accepted by an accepted proof checker. Treat the claim as unverified."
      ]
    });
  }

  if (result.status === 0) {
    return withCheckId({
      ...base,
      backend: {
        ...base.backend,
        exitCode: result.status
      },
      status: "accepted",
      trust: "proved",
      proofCheckerBacked: true,
      stdout,
      stderr,
      limitations: [
        "Lean accepted the provided local proof artifact under its imports and environment.",
        "This proves only the formal statement checked by Lean, not surrounding informal, scientific, medical, safety, regulatory, or patent claims."
      ],
      warnings: [
        "Review the Lean statement and imports to confirm they match the intended human claim."
      ]
    });
  }

  return withCheckId({
    ...base,
    backend: {
      ...base.backend,
      exitCode: result.status
    },
    status: "rejected",
    trust: "unverified",
    proofCheckerBacked: false,
    stdout,
    stderr,
    limitations: [
      "Lean did not accept the proof artifact.",
      "A rejected, incomplete, or malformed proof attempt does not refute the theorem; it leaves the claim unverified."
    ],
    warnings: [
      "Lean rejected this proof artifact, so Theorem Workbench must not label the claim `proved`."
    ]
  });
}

export async function writeLeanProofCheckRecord(input: WriteLeanProofCheckInput): Promise<LeanProofCheckWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const resolvedSourcePath = resolveWorkspacePath(status.root, input.sourcePath);
  const sourceRef = toPortablePath(relative(status.root, resolvedSourcePath));
  const sourceText = await readFile(resolvedSourcePath, "utf8");
  const record = checkLeanProofArtifact({
    sourcePath: resolvedSourcePath,
    sourceRef,
    sourceText,
    theoremName: input.theoremName,
    leanCommand: input.leanCommand,
    timeoutMs: input.timeoutMs,
    now: input.now,
    runner: input.runner,
    replayCommand: `theorem proof check ${quoteCommandArg(sourceRef)} --write --json`
  });
  const proofsDir = resolve(status.root, status.manifest.directories.proofs);
  await mkdir(proofsDir, { recursive: true });
  const baseName = `${record.createdAt.slice(0, 10)}-${record.checkId}`;
  const jsonPath = join(proofsDir, `${baseName}.json`);
  const markdownPath = join(proofsDir, `${baseName}.md`);
  const markdown = renderLeanProofCheckMarkdown(record);

  await writeFile(jsonPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdown, "utf8");

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listLeanProofChecks(rootPath: string): Promise<LeanProofCheckSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const proofsDir = resolve(status.root, status.manifest.directories.proofs);

  let files: string[];
  try {
    files = await readdir(proofsDir);
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
        const path = join(proofsDir, file);
        return summarizeLeanProofCheck(status.root, path, await readFile(path, "utf8"));
      })
  );

  return summaries
    .filter((summary): summary is LeanProofCheckSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function renderLeanProofCheckMarkdown(record: LeanProofCheckRecord): string {
  const lines = [
    `# Lean Proof Check ${record.checkId}`,
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

  if (record.source.theoremName) {
    lines.push(`- Theorem/declaration: \`${record.source.theoremName}\``);
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
    "A Lean-accepted artifact proves only the formal statement Lean checked under its imports and environment. It does not prove surrounding informal, scientific, medical, safety, regulatory, or patent claims."
  );

  return `${lines.join("\n")}\n`;
}

function probeLeanBackend(args: {
  command: string;
  timeoutMs: number;
  runner: ProofBackendCommandRunner;
}): ProofBackendProbe {
  const probeArgs = ["--version"];
  const result = args.runner(args.command, probeArgs, args.timeoutMs);
  const stdout = singleLine(result.stdout);
  const stderr = singleLine(result.stderr);
  const errorText = result.error ? `${result.error.name ? `${result.error.name}: ` : ""}${result.error.message}` : undefined;

  if (result.error && isMissingExecutable(result.error)) {
    return {
      backendId: "lean",
      displayName: "Lean proof checker",
      adapter: "local-lean-subprocess",
      role: "proof-checker",
      acceptedProofChecker: true,
      status: "missing",
      localOnly: true,
      networkAccess: "none",
      command: args.command,
      args: probeArgs,
      exitCode: result.status,
      stderr,
      error: errorText,
      canCheckProofs: false,
      statusProbeMintedProof: false,
      limitations: [
        "Lean executable was not found or could not be launched.",
        "Install/configure Lean before any receipt can use Lean as an accepted proof-checking backend."
      ]
    };
  }

  if (result.error || result.status !== 0) {
    return {
      backendId: "lean",
      displayName: "Lean proof checker",
      adapter: "local-lean-subprocess",
      role: "proof-checker",
      acceptedProofChecker: true,
      status: "error",
      localOnly: true,
      networkAccess: "none",
      command: args.command,
      args: probeArgs,
      exitCode: result.status,
      stdout,
      stderr,
      error: errorText ?? `Lean exited with status ${String(result.status)}.`,
      canCheckProofs: false,
      statusProbeMintedProof: false,
      limitations: [
        "Lean was detected but the local version probe failed.",
        "A failed backend probe cannot support `proved` trust labels."
      ]
    };
  }

  const version = stdout || stderr || "version unavailable";

  return {
    backendId: "lean",
    displayName: "Lean proof checker",
    adapter: "local-lean-subprocess",
    role: "proof-checker",
    acceptedProofChecker: true,
    status: "available",
    localOnly: true,
    networkAccess: "none",
    command: args.command,
    args: probeArgs,
    version,
    exitCode: result.status,
    stdout,
    stderr,
    canCheckProofs: true,
    statusProbeMintedProof: false,
    limitations: [
      "This is only a local backend availability probe.",
      "A receipt may be labeled `proved` only after Lean accepts a concrete proof artifact in a replayable proof-check run."
    ]
  };
}

function runCommand(command: string, args: string[], timeoutMs: number): ProofBackendCommandResult {
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

function withCheckId(record: Omit<LeanProofCheckRecord, "checkId">): LeanProofCheckRecord {
  return {
    ...record,
    checkId: `proof_${sha256({
      schemaVersion: record.schemaVersion,
      backend: record.backend,
      source: record.source,
      status: record.status,
      trust: record.trust,
      proofCheckerBacked: record.proofCheckerBacked,
      stdout: record.stdout,
      stderr: record.stderr,
      error: record.error
    }).slice(0, 16)}`
  };
}

function isMissingExecutable(error: { name?: string; message: string }): boolean {
  return /\b(?:ENOENT|ENOTDIR|EPERM|EACCES)\b/i.test(`${error.name ?? ""} ${error.message}`);
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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
    throw new Error("No Theorem workspace found. Run `theorem workspace init` before writing proof-check records.");
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

function summarizeLeanProofCheck(
  root: string,
  path: string,
  raw: string
): LeanProofCheckSummary | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== "theorem.proof-check.v0") {
    return undefined;
  }

  const record = parsed as unknown as LeanProofCheckRecord;
  return {
    path: toPortablePath(relative(root, path)),
    checkId: record.checkId,
    createdAt: record.createdAt,
    sourcePath: record.source.path,
    theoremName: record.source.theoremName,
    status: record.status,
    trust: record.trust,
    proofCheckerBacked: record.proofCheckerBacked,
    backendId: record.backend.id,
    backendVersion: record.backend.version,
    warnings: record.warnings
  };
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

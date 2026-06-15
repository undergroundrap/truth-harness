import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, initLocalWorkspace, type LocalWorkspaceStatus } from "./local-workspace.js";
import { getCodeRunSandboxStatus, sandboxMeasurementForStatus, type CodeRunSandboxMeasurement } from "./sandbox.js";
import { stableHash } from "./stable-hash.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export type CodeRunStatus = "passed" | "failed" | "timed-out" | "error";
export type CodeRunPolicyCategory =
  | "shell-launcher"
  | "network-command"
  | "destructive-command"
  | "package-mutation"
  | "git-mutation";

export interface CodeRunCommandResult {
  exitCode: number | null;
  signal?: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  outputMetadata?: {
    stdout?: CodeRunOutputMetadata;
    stderr?: CodeRunOutputMetadata;
  };
  error?: {
    name?: string;
    code?: string;
    message: string;
  };
}

export interface CodeRunOutputMetadata {
  sha256: string;
  byteLength: number;
  truncated: boolean;
}

export type CodeRunCommandRunner = (input: {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
}) => CodeRunCommandResult | Promise<CodeRunCommandResult>;

export interface CodeRunOutput {
  text: string;
  sha256: string;
  byteLength: number;
  truncated: boolean;
  maxBytes: number;
}

export interface CodeRunPolicyInput {
  allowedExecutables?: string[];
  requireSandbox?: boolean;
  allowShellLauncher?: boolean;
  allowNetworkCommand?: boolean;
  allowDestructiveCommand?: boolean;
  allowPackageMutation?: boolean;
  allowGitMutation?: boolean;
}

export interface CodeRunPolicyRecord {
  mode: "default-local";
  decision: "allowed";
  allowedExecutables: string[];
  matchedAllowlist: boolean;
  detected: {
    executableName: string;
    categories: CodeRunPolicyCategory[];
    packageMutation?: string;
  };
  overrides: {
    shellLauncher: boolean;
    networkCommand: boolean;
    destructiveCommand: boolean;
    packageMutation: boolean;
    gitMutation: boolean;
  };
  sandbox: {
    required: boolean;
    measurement: CodeRunSandboxMeasurement;
  };
  notes: string[];
}

export interface CodeRunPrivacyMetadata {
  mode: "unsandboxed-local-execution" | "sandboxed-local-execution";
  localFirst: true;
  networkAccess: "unknown" | "none";
  dataResidency: "local-workspace";
  externalDisclosures: [];
  measurement: CodeRunSandboxMeasurement;
}

export interface CodeRunRecord {
  schemaVersion: "truth-harness.code-run.v0";
  runId: string;
  projectId: string;
  createdAt: string;
  title: string;
  purpose: string;
  command: {
    executable: string;
    args: string[];
    workingDirectory: string;
    shell: false;
    timeoutMs: number;
    maxOutputBytes: number;
  };
  policy: CodeRunPolicyRecord;
  execution: {
    status: CodeRunStatus;
    exitCode: number | null;
    signal?: string | null;
    durationMs: number;
    timedOut: boolean;
    error?: string;
  };
  stdout: CodeRunOutput;
  stderr: CodeRunOutput;
  refs: {
    codeRefs: string[];
    inputRefs: string[];
    outputRefs: string[];
    evidenceRefs: string[];
  };
  environment: {
    platform: NodeJS.Platform;
    arch: string;
    nodeVersion: string;
    inheritedEnvironment: true;
    environmentVariablesCaptured: false;
  };
  replay: {
    command: string;
    workingDirectory: string;
    shell: false;
    localOnly: boolean;
    notes: string[];
  };
  reproducibilityBoundary: {
    workbenchExecuted: true;
    commandOutputCaptured: true;
    commandExecutionIsNotProof: true;
    outputsNeedIndependentReview: true;
    requiresCleanReplay: boolean;
    requiresWorkspaceSnapshot: boolean;
    requiresExpertReview: boolean;
    requiredNextChecks: string[];
  };
  privacy: CodeRunPrivacyMetadata;
  warnings: string[];
}

export interface ExecuteCodeRunInput {
  rootPath: string;
  command: string;
  args?: string[];
  workingDirectory?: string;
  title?: string;
  purpose: string;
  codeRefs?: string[];
  inputRefs?: string[];
  outputRefs?: string[];
  evidenceRefs?: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  policy?: CodeRunPolicyInput;
  now?: string;
  runner?: CodeRunCommandRunner;
}

export interface CodeRunWriteResult {
  record: CodeRunRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface CodeRunSummary {
  path: string;
  runId: string;
  createdAt: string;
  title: string;
  status: CodeRunStatus;
  exitCode: number | null;
  command: string;
  workingDirectory: string;
  warnings: string[];
}

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const DEFAULT_MAX_CONCURRENT_CODE_RUNS = 2;
const MAX_TIMEOUT_MS = 120000;
const MAX_OUTPUT_BYTES = 1048576;
const SHELL_LAUNCHERS = new Set(["cmd", "powershell", "pwsh", "bash", "sh", "zsh", "fish", "wscript", "cscript", "mshta"]);
const NETWORK_COMMANDS = new Set(["curl", "wget", "ssh", "scp", "sftp", "ftp", "telnet", "nc", "ncat", "netcat", "rsync"]);
const DESTRUCTIVE_COMMANDS = new Set(["rm", "rmdir", "del", "erase", "format", "shutdown", "reboot", "diskpart"]);
const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun", "pip", "pip3", "cargo"]);
const workspaceRunQueues = new Map<string, CodeRunQueueState>();

interface CodeRunQueueState {
  active: number;
  waiting: Array<() => void>;
}

export async function executeCodeRun(input: ExecuteCodeRunInput): Promise<CodeRunRecord> {
  const status = await requireLocalWorkspace(input.rootPath);
  const command = requireText(input.command, "Code run command is required.");
  const args = normalizeStringList(input.args ?? []);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = input.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  assertPositiveInteger(timeoutMs, "Code run timeoutMs");
  assertPositiveInteger(maxOutputBytes, "Code run maxOutputBytes");
  assertMaximumInteger(timeoutMs, MAX_TIMEOUT_MS, "Code run timeoutMs");
  assertMaximumInteger(maxOutputBytes, MAX_OUTPUT_BYTES, "Code run maxOutputBytes");
  const cwd = resolveWorkspacePath(status.root, input.workingDirectory ?? ".");
  const cwdRef = toPortablePath(relative(status.root, cwd)) || ".";
  const sandboxStatus = getCodeRunSandboxStatus();
  const sandboxMeasurement = sandboxMeasurementForStatus(sandboxStatus);
  const policy = evaluateCodeRunPolicy(command, args, input.policy ?? {}, sandboxMeasurement);
  const runner = input.runner ?? runCommand;
  const result = await withWorkspaceCodeRunSlot(status.root, () => runner({ command, args, cwd, timeoutMs, maxOutputBytes }));
  const stdout = normalizeOutput(result.stdout, maxOutputBytes, result.outputMetadata?.stdout);
  const stderr = normalizeOutput(result.stderr, maxOutputBytes, result.outputMetadata?.stderr);
  const error = result.error ? `${result.error.name ? `${result.error.name}: ` : ""}${result.error.message}` : undefined;
  const timedOut = result.error?.code === "ETIMEDOUT" || /timed out|timeout/i.test(error ?? "");
  const executionStatus = codeRunStatusFor(result, timedOut);
  const purpose = requireText(input.purpose, "Code run purpose is required.");
  const nextChecks = nextChecksFor({
    status: executionStatus,
    outputRefs: input.outputRefs ?? [],
    purpose
  });
  const createdAt = input.now ?? new Date().toISOString();
  const recordWithoutId = {
    projectId: status.manifest.projectId,
    createdAt,
    title: normalizeOptionalText(input.title) ?? titleFromPurpose(purpose),
    purpose,
    command: {
      executable: command,
      args,
      workingDirectory: cwdRef,
      shell: false as const,
      timeoutMs,
      maxOutputBytes
    },
    policy,
    execution: {
      status: executionStatus,
      exitCode: result.exitCode,
      signal: result.signal,
      durationMs: Math.max(0, Math.round(result.durationMs)),
      timedOut,
      ...(error ? { error } : {})
    },
    stdout,
    stderr,
    refs: {
      codeRefs: normalizeStringList(input.codeRefs ?? []),
      inputRefs: normalizeStringList(input.inputRefs ?? []),
      outputRefs: normalizeStringList(input.outputRefs ?? []),
      evidenceRefs: normalizeStringList(input.evidenceRefs ?? [])
    },
    environment: {
      platform: platform(),
      arch: arch(),
      nodeVersion: process.version,
      inheritedEnvironment: true as const,
      environmentVariablesCaptured: false as const
    },
    replay: {
      command: formatCommand([command, ...args]),
      workingDirectory: cwdRef,
      shell: false as const,
      localOnly: sandboxMeasurement.canAttestNetworkNone,
      notes: replayNotesFor({ executionStatus, timedOut, sandboxMeasurement })
    },
    reproducibilityBoundary: {
      workbenchExecuted: true as const,
      commandOutputCaptured: true as const,
      commandExecutionIsNotProof: true as const,
      outputsNeedIndependentReview: true as const,
      requiresCleanReplay: executionStatus !== "passed",
      requiresWorkspaceSnapshot: true,
      requiresExpertReview: requiresExpertReview(purpose),
      requiredNextChecks: nextChecks
    },
    privacy: createCodeRunPrivacy(sandboxMeasurement),
    warnings: warningsFor({
      executionStatus,
      timedOut,
      stdout,
      stderr,
      codeRefs: input.codeRefs ?? [],
      inputRefs: input.inputRefs ?? [],
      outputRefs: input.outputRefs ?? [],
      purpose,
      policy
    })
  };

  return {
    schemaVersion: "truth-harness.code-run.v0",
    runId: `code_run_${stableHash(recordWithoutId).slice(0, 16)}`,
    ...recordWithoutId
  };
}

export async function writeCodeRun(input: ExecuteCodeRunInput): Promise<CodeRunWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const record = await executeCodeRun(input);
  const runsDir = resolve(status.root, status.manifest.directories["code-runs"]);
  await mkdir(runsDir, { recursive: true });
  const baseName = `${record.createdAt.slice(0, 10)}-${record.runId}`;
  const jsonPath = join(runsDir, `${baseName}.json`);
  const markdownPath = join(runsDir, `${baseName}.md`);
  const markdown = renderCodeRunMarkdown(record);

  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, jsonPath),
    kind: "code-runs",
    now: record.createdAt,
    staleReason: "code run record written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listCodeRuns(rootPath: string): Promise<CodeRunSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const runsDir = resolve(status.root, status.manifest.directories["code-runs"]);

  let files: string[];
  try {
    files = await readdir(runsDir);
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
      .map(async (file) => summarizeCodeRun(status.root, join(runsDir, file), await readFile(join(runsDir, file), "utf8")))
  );

  return summaries
    .filter((summary): summary is CodeRunSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function renderCodeRunMarkdown(record: CodeRunRecord): string {
  const lines = [
    `# ${record.title}`,
    "",
    `Code run: \`${record.runId}\``,
    `Status: \`${record.execution.status}\``,
    `Exit code: ${String(record.execution.exitCode)}`,
    `Created: ${record.createdAt}`,
    `Privacy: ${record.privacy.mode} (network: ${record.privacy.networkAccess})`,
    "",
    record.purpose,
    "",
    "## Command",
    "",
    `- Executable: \`${record.command.executable}\``,
    `- Args: ${record.command.args.length > 0 ? record.command.args.map((arg) => `\`${arg}\``).join(", ") : "none"}`,
    `- Working directory: \`${record.command.workingDirectory}\``,
    `- Shell: ${String(record.command.shell)}`,
    `- Timeout: ${record.command.timeoutMs} ms`,
    `- Duration: ${record.execution.durationMs} ms`,
    "",
    "## Execution Policy",
    "",
    `- Mode: \`${record.policy.mode}\``,
    `- Decision: \`${record.policy.decision}\``,
    `- Executable name: \`${record.policy.detected.executableName}\``,
    `- Detected categories: ${record.policy.detected.categories.length > 0 ? record.policy.detected.categories.map((category) => `\`${category}\``).join(", ") : "none"}`,
    `- Matched allowlist: ${String(record.policy.matchedAllowlist)}`,
    "",
    "## Replay",
    "",
    `\`${record.replay.command}\``
  ];

  pushOptionalSection(lines, "Code Refs", record.refs.codeRefs);
  pushOptionalSection(lines, "Input Refs", record.refs.inputRefs);
  pushOptionalSection(lines, "Output Refs", record.refs.outputRefs);
  pushOptionalSection(lines, "Evidence Refs", record.refs.evidenceRefs);
  pushOutput(lines, "Stdout", record.stdout);
  pushOutput(lines, "Stderr", record.stderr);
  pushOptionalSection(lines, "Warnings", record.warnings);
  pushOptionalSection(lines, "Required Next Checks", record.reproducibilityBoundary.requiredNextChecks);

  lines.push(
    "",
    "## Boundary",
    "",
    "This record proves only that Truth Harness launched a local direct command without shell interpolation and captured its process result under the recorded execution policy. It does not prove code correctness, scientific validity, safety, regulatory approval, or patentability."
  );

  return `${lines.join("\n")}\n`;
}

function runCommand(input: Parameters<CodeRunCommandRunner>[0]): Promise<CodeRunCommandResult> {
  const started = process.hrtime.bigint();
  const stdout = createOutputCapture(input.maxOutputBytes);
  const stderr = createOutputCapture(input.maxOutputBytes);
  const aggregateOutputLimit = input.maxOutputBytes * 4;

  return new Promise((resolveResult) => {
    let settled = false;
    let timedOut = false;
    let killedForOutput = false;
    let spawnError: NodeJS.ErrnoException | undefined;
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, input.timeoutMs);

    const maybeKillForOutputBudget = () => {
      if (!killedForOutput && stdout.byteLength + stderr.byteLength > aggregateOutputLimit) {
        killedForOutput = true;
        child.kill("SIGTERM");
      }
    };

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout.push(chunk);
      maybeKillForOutputBudget();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr.push(chunk);
      maybeKillForOutputBudget();
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      spawnError = error;
    });
    child.on("close", (exitCode, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      const stdoutResult = stdout.finish();
      const stderrResult = stderr.finish();
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const error = errorForAsyncCommand({ timedOut, killedForOutput, spawnError, timeoutMs: input.timeoutMs, maxOutputBytes: input.maxOutputBytes });

      resolveResult({
        exitCode,
        signal,
        stdout: stdoutResult.text,
        stderr: stderrResult.text,
        durationMs,
        outputMetadata: {
          stdout: stdoutResult,
          stderr: stderrResult
        },
        ...(error ? { error } : {})
      });
    });
  });
}

function codeRunStatusFor(result: CodeRunCommandResult, timedOut: boolean): CodeRunStatus {
  if (timedOut) {
    return "timed-out";
  }

  if (result.error) {
    return "error";
  }

  return result.exitCode === 0 ? "passed" : "failed";
}

function createOutputCapture(maxBytes: number): {
  readonly byteLength: number;
  push(chunk: Buffer | string): void;
  finish(): CodeRunOutputMetadata & { text: string };
} {
  const chunks: string[] = [];
  const hash = createHash("sha256");
  let byteLength = 0;
  let storedBytes = 0;
  let truncated = false;

  return {
    get byteLength() {
      return byteLength;
    },
    push(chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
      byteLength += buffer.length;
      hash.update(buffer);

      if (storedBytes >= maxBytes) {
        truncated = true;
        return;
      }

      const remaining = maxBytes - storedBytes;
      const slice = buffer.subarray(0, remaining);
      chunks.push(slice.toString("utf8"));
      storedBytes += slice.length;
      if (buffer.length > remaining) {
        truncated = true;
      }
    },
    finish() {
      return {
        text: chunks.join(""),
        sha256: hash.digest("hex"),
        byteLength,
        truncated
      };
    }
  };
}

function errorForAsyncCommand(input: {
  timedOut: boolean;
  killedForOutput: boolean;
  spawnError?: NodeJS.ErrnoException;
  timeoutMs: number;
  maxOutputBytes: number;
}): CodeRunCommandResult["error"] | undefined {
  if (input.timedOut) {
    return {
      name: "Error",
      code: "ETIMEDOUT",
      message: `Command timed out after ${input.timeoutMs}ms.`
    };
  }

  if (input.killedForOutput) {
    return {
      name: "Error",
      code: "EMAXOUTPUT",
      message: `Command exceeded the aggregate captured output budget of ${input.maxOutputBytes * 4} bytes.`
    };
  }

  if (input.spawnError) {
    return {
      name: input.spawnError.name,
      code: input.spawnError.code,
      message: input.spawnError.message
    };
  }

  return undefined;
}

async function withWorkspaceCodeRunSlot<T>(root: string, task: () => T | Promise<T>): Promise<T> {
  const release = await acquireWorkspaceCodeRunSlot(root);
  try {
    return await task();
  } finally {
    release();
  }
}

function acquireWorkspaceCodeRunSlot(root: string): Promise<() => void> {
  const state = workspaceRunQueues.get(root) ?? { active: 0, waiting: [] };
  workspaceRunQueues.set(root, state);

  return new Promise((resolveSlot) => {
    const start = () => {
      state.active += 1;
      resolveSlot(() => releaseWorkspaceCodeRunSlot(root, state));
    };

    if (state.active < DEFAULT_MAX_CONCURRENT_CODE_RUNS && state.waiting.length === 0) {
      start();
      return;
    }

    state.waiting.push(start);
  });
}

function releaseWorkspaceCodeRunSlot(root: string, state: CodeRunQueueState): void {
  state.active = Math.max(0, state.active - 1);
  const next = state.waiting.shift();
  if (next) {
    next();
    return;
  }

  if (state.active === 0) {
    workspaceRunQueues.delete(root);
  }
}

function normalizeOutput(value: string, maxBytes: number, metadata?: CodeRunOutputMetadata): CodeRunOutput {
  if (metadata) {
    return {
      text: value,
      sha256: metadata.sha256,
      byteLength: metadata.byteLength,
      truncated: metadata.truncated,
      maxBytes
    };
  }

  const byteLength = Buffer.byteLength(value, "utf8");
  const truncated = byteLength > maxBytes;
  const text = truncated ? truncateUtf8(value, maxBytes) : value;

  return {
    text,
    sha256: sha256(value),
    byteLength,
    truncated,
    maxBytes
  };
}

function truncateUtf8(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, "utf8");
  return buffer.subarray(0, maxBytes).toString("utf8");
}

function nextChecksFor(input: { status: CodeRunStatus; outputRefs: string[]; purpose: string }): string[] {
  const checks = [
    "capture a workspace snapshot after important code runs",
    "replay in a clean local environment before treating outputs as stable evidence"
  ];

  if (input.outputRefs.length === 0) {
    checks.push("attach output artifact refs if this command produced files");
  }

  if (input.status !== "passed") {
    checks.push("fix or explain the non-passing command before using it as positive evidence");
  }

  if (requiresExpertReview(input.purpose)) {
    checks.push("obtain domain expert review before relying on biomedical, safety, patent, climate, materials, or scientific conclusions");
  }

  return checks;
}

function warningsFor(input: {
  executionStatus: CodeRunStatus;
  timedOut: boolean;
  stdout: CodeRunOutput;
  stderr: CodeRunOutput;
  codeRefs: string[];
  inputRefs: string[];
  outputRefs: string[];
  purpose: string;
  policy: CodeRunPolicyRecord;
}): string[] {
  const warnings = [
    "Code run records capture local process execution; they do not prove code correctness or scientific validity.",
    "Environment variables are inherited but not captured to avoid leaking secrets, so independent replay may need additional setup."
  ];

  if (input.executionStatus !== "passed") {
    warnings.push("The command did not pass; do not use this as positive evidence without follow-up.");
  }

  if (input.timedOut) {
    warnings.push("The command timed out before completing.");
  }

  if (input.stdout.truncated || input.stderr.truncated) {
    warnings.push("One or more output streams were truncated; inspect original artifacts or rerun with a larger output limit if needed.");
  }

  if (input.codeRefs.length === 0) {
    warnings.push("No code refs were attached to this run.");
  }

  if (input.inputRefs.length === 0) {
    warnings.push("No input refs were attached to this run.");
  }

  if (input.outputRefs.length === 0) {
    warnings.push("No output artifact refs were attached to this run.");
  }

  warnings.push(...input.policy.notes);

  if (requiresExpertReview(input.purpose)) {
    warnings.push("Domain expert review is required before strong biomedical, safety, patent, climate, materials, or scientific conclusions.");
  }

  return warnings;
}

function replayNotesFor(input: {
  executionStatus: CodeRunStatus;
  timedOut: boolean;
  sandboxMeasurement: CodeRunSandboxMeasurement;
}): string[] {
  const notes = ["The command executable was launched directly by Truth Harness without shell interpolation."];

  if (!input.sandboxMeasurement.canAttestNetworkNone) {
    notes.push("No OS sandbox or network-deny boundary was enforced for this run, so local-only replay is not guaranteed.");
  }

  if (input.executionStatus !== "passed") {
    notes.push("Replay should reproduce or explain the non-passing status before downstream use.");
  }

  if (input.timedOut) {
    notes.push("Replay may need a larger timeout or a smaller workload.");
  }

  return notes;
}

function evaluateCodeRunPolicy(
  command: string,
  args: string[],
  input: CodeRunPolicyInput,
  sandboxMeasurement: CodeRunSandboxMeasurement
): CodeRunPolicyRecord {
  const executableName = executablePolicyName(command);
  const allowedExecutables = normalizeStringList(input.allowedExecutables ?? []).map(executablePolicyName);
  const matchedAllowlist = allowedExecutables.length > 0 && allowedExecutables.includes(executableName);
  const categories = detectPolicyCategories(executableName, args);
  const packageMutation = detectPackageMutation(executableName, args);
  const blockedReasons: string[] = [];

  if (allowedExecutables.length === 0) {
    blockedReasons.push("Code execution requires a non-empty explicit executable allowlist.");
  }

  if (!matchedAllowlist) {
    blockedReasons.push(`Executable ${JSON.stringify(executableName)} is not in the explicit allowlist.`);
  }

  if (input.requireSandbox === true && !sandboxMeasurement.available) {
    blockedReasons.push("Code execution requires a measured sandbox provider, but no code-run sandbox provider is available.");
  }

  if (categories.includes("shell-launcher") && input.allowShellLauncher !== true) {
    blockedReasons.push(`Shell launcher ${JSON.stringify(executableName)} is blocked by the default local execution policy.`);
  }

  if (categories.includes("network-command") && input.allowNetworkCommand !== true) {
    blockedReasons.push(`Network-capable command ${JSON.stringify(executableName)} is blocked by the default local execution policy.`);
  }

  if (categories.includes("destructive-command") && input.allowDestructiveCommand !== true) {
    blockedReasons.push(`Destructive command ${JSON.stringify(executableName)} is blocked by the default local execution policy.`);
  }

  if (categories.includes("package-mutation") && input.allowPackageMutation !== true) {
    blockedReasons.push(`Package mutation command ${JSON.stringify([executableName, ...args].join(" "))} is blocked by the default local execution policy.`);
  }

  if (categories.includes("git-mutation") && input.allowGitMutation !== true) {
    blockedReasons.push(`Git mutation/network command ${JSON.stringify([executableName, ...args].join(" "))} is blocked by the default local execution policy.`);
  }

  if (blockedReasons.length > 0) {
    throw new Error(`Code run blocked by local execution policy: ${blockedReasons.join(" ")}`);
  }

  const overrides = {
    shellLauncher: categories.includes("shell-launcher") && input.allowShellLauncher === true,
    networkCommand: categories.includes("network-command") && input.allowNetworkCommand === true,
    destructiveCommand: categories.includes("destructive-command") && input.allowDestructiveCommand === true,
    packageMutation: categories.includes("package-mutation") && input.allowPackageMutation === true,
    gitMutation: categories.includes("git-mutation") && input.allowGitMutation === true
  };

  return {
    mode: "default-local",
    decision: "allowed",
    allowedExecutables,
    matchedAllowlist,
    detected: {
      executableName,
      categories,
      ...(packageMutation ? { packageMutation } : {})
    },
    overrides,
    sandbox: {
      required: input.requireSandbox === true,
      measurement: sandboxMeasurement
    },
    notes: policyNotesFor({ categories, overrides, allowedExecutables, sandboxRequired: input.requireSandbox === true, sandboxMeasurement })
  };
}

function detectPolicyCategories(executableName: string, args: string[]): CodeRunPolicyCategory[] {
  const categories = new Set<CodeRunPolicyCategory>();

  if (SHELL_LAUNCHERS.has(executableName)) {
    categories.add("shell-launcher");
  }

  if (NETWORK_COMMANDS.has(executableName)) {
    categories.add("network-command");
  }

  if (DESTRUCTIVE_COMMANDS.has(executableName)) {
    categories.add("destructive-command");
  }

  if (detectPackageMutation(executableName, args)) {
    categories.add("package-mutation");
  }

  if (detectGitMutation(executableName, args)) {
    categories.add("git-mutation");
  }

  return [...categories].sort();
}

function detectPackageMutation(executableName: string, args: string[]): string | undefined {
  const normalizedArgs = args.map((arg) => arg.toLowerCase());
  const firstCommand = firstNonOptionArg(normalizedArgs);

  if ((executableName === "python" || executableName === "python3" || executableName === "py") && normalizedArgs[0] === "-m") {
    const moduleName = normalizedArgs[1];
    const pipCommand = normalizedArgs[2];
    if (moduleName === "pip" && pipCommand && ["install", "uninstall"].includes(pipCommand)) {
      return `${moduleName} ${pipCommand}`;
    }
  }

  if (!PACKAGE_MANAGERS.has(executableName) || !firstCommand) {
    return undefined;
  }

  if (executableName === "npm" && ["install", "i", "uninstall", "remove", "rm", "update", "publish"].includes(firstCommand)) {
    return firstCommand;
  }

  if (executableName === "pnpm" && ["add", "install", "i", "remove", "rm", "update", "publish"].includes(firstCommand)) {
    return firstCommand;
  }

  if (executableName === "yarn" && ["add", "install", "remove", "upgrade", "publish"].includes(firstCommand)) {
    return firstCommand;
  }

  if (executableName === "bun" && ["add", "install", "remove", "update"].includes(firstCommand)) {
    return firstCommand;
  }

  if ((executableName === "pip" || executableName === "pip3") && ["install", "uninstall"].includes(firstCommand)) {
    return firstCommand;
  }

  if (executableName === "cargo" && ["install", "publish", "update"].includes(firstCommand)) {
    return firstCommand;
  }

  return undefined;
}

function detectGitMutation(executableName: string, args: string[]): string | undefined {
  if (executableName !== "git") {
    return undefined;
  }

  const firstCommand = firstNonOptionArg(args.map((arg) => arg.toLowerCase()));
  if (!firstCommand) {
    return undefined;
  }

  return ["push", "pull", "fetch", "clone", "reset", "clean", "checkout", "switch", "merge", "rebase"].includes(firstCommand)
    ? firstCommand
    : undefined;
}

function firstNonOptionArg(args: string[]): string | undefined {
  return args.find((arg) => !arg.startsWith("-"));
}

function policyNotesFor(input: {
  categories: CodeRunPolicyCategory[];
  overrides: CodeRunPolicyRecord["overrides"];
  allowedExecutables: string[];
  sandboxRequired: boolean;
  sandboxMeasurement: CodeRunSandboxMeasurement;
}): string[] {
  const notes = [
    "The default local execution policy is default-deny for executables and also blocks shell launchers, obvious network clients, destructive commands, package mutations, and git mutations unless explicitly overridden."
  ];

  if (input.sandboxMeasurement.canAttestNetworkNone) {
    notes.push("A measured sandbox provider attested a network-denied execution boundary for this run.");
  } else {
    notes.push("Executable allowlists and command-name checks are not a security sandbox; unsandboxed runs record network access as unknown.");
  }

  if (input.allowedExecutables.length > 0) {
    notes.push(`Executable allowlist applied: ${input.allowedExecutables.join(", ")}.`);
  }

  if (Object.values(input.overrides).some(Boolean)) {
    notes.push("One or more code-run policy blocks were explicitly overridden; review the command and outputs before using this as evidence.");
  }

  if (input.sandboxRequired) {
    notes.push("This run required a measured sandbox provider.");
  }

  if (!input.sandboxMeasurement.available) {
    notes.push("No measured code-run sandbox provider was available for this run.");
  }

  if (input.categories.includes("shell-launcher")) {
    notes.push("A shell launcher can execute further commands that are not represented as structured args.");
  }

  return notes;
}

function createCodeRunPrivacy(measurement: CodeRunSandboxMeasurement): CodeRunPrivacyMetadata {
  if (measurement.canAttestNetworkNone) {
    return {
      mode: "sandboxed-local-execution",
      localFirst: true,
      networkAccess: "none",
      dataResidency: "local-workspace",
      externalDisclosures: [],
      measurement
    };
  }

  return {
    mode: "unsandboxed-local-execution",
    localFirst: true,
    networkAccess: "unknown",
    dataResidency: "local-workspace",
    externalDisclosures: [],
    measurement
  };
}

function executablePolicyName(value: string): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  const fileName = trimmed.split(/[\\/]/).filter(Boolean).pop() ?? trimmed;
  return fileName.toLowerCase().replace(/\.(exe|cmd|bat|com)$/i, "");
}

function requiresExpertReview(purpose: string): boolean {
  return /\b(cancer|clinical|patient|drug|therapy|hair[- ]?loss|safety|toxicity|patent|novel|climate|materials?|biomedical|disease)\b/i.test(
    purpose
  );
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing code run records.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
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

function summarizeCodeRun(root: string, path: string, raw: string): CodeRunSummary | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== "truth-harness.code-run.v0") {
    return undefined;
  }

  const record = parsed as unknown as CodeRunRecord;
  return {
    path: toPortablePath(relative(root, path)),
    runId: record.runId,
    createdAt: record.createdAt,
    title: record.title,
    status: record.execution.status,
    exitCode: record.execution.exitCode,
    command: record.replay.command,
    workingDirectory: record.command.workingDirectory,
    warnings: record.warnings
  };
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

function pushOutput(lines: string[], title: string, output: CodeRunOutput): void {
  if (!output.text) {
    return;
  }

  lines.push("", `## ${title}`, "", "```text", output.text, "```");
  if (output.truncated) {
    lines.push("", `Output truncated at ${output.maxBytes} bytes from ${output.byteLength} bytes.`);
  }
}

function formatCommand(values: string[]): string {
  return values.map(quoteCommandArg).join(" ");
}

function quoteCommandArg(value: string): string {
  return /^[A-Za-z0-9_./\\:-]+$/.test(value) ? value : JSON.stringify(value);
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function assertMaximumInteger(value: number, max: number, label: string): void {
  if (value > max) {
    throw new Error(`${label} must be less than or equal to ${max}.`);
  }
}

function requireText(value: string | undefined, message: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function titleFromPurpose(purpose: string): string {
  return purpose.length <= 72 ? purpose : `${purpose.slice(0, 69)}...`;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value)))];
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

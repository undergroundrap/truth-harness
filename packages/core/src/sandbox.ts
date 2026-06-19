import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { platform } from "node:os";
import { join, relative, resolve } from "node:path";
import {
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
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";

export type CodeRunSandboxProvider = "none" | "bubblewrap" | "container" | "windows-job" | "custom";
export type CodeRunSandboxProcessIsolation = "none" | "enforced";
export type CodeRunSandboxNetworkIsolation = "not-enforced" | "enforced";
export type CodeRunSandboxFilesystemIsolation = "working-directory-only" | "workspace-scoped";

export interface CodeRunSandboxMeasurement {
  available: boolean;
  provider: CodeRunSandboxProvider;
  processSandbox: CodeRunSandboxProcessIsolation;
  networkIsolation: CodeRunSandboxNetworkIsolation;
  filesystemIsolation: CodeRunSandboxFilesystemIsolation;
  canAttestNetworkNone: boolean;
  notes: string[];
}

export interface CodeRunSandboxStatus extends CodeRunSandboxMeasurement {
  schemaVersion: "truth-harness.code-run-sandbox-status.v0";
  platform: NodeJS.Platform;
  reason: string;
}

export type CodeRunSandboxRunStatus = "passed" | "failed";

export interface CodeRunSandboxRunRecord {
  schemaVersion: "truth-harness.sandbox-run.v0";
  runId: string;
  title: string;
  summary: string;
  createdAt: string;
  status: CodeRunSandboxRunStatus;
  localOnly: true;
  networkAccess: "none";
  replay: string;
  measurement: CodeRunSandboxStatus;
  artifacts: {
    json: string;
    markdown: string;
  };
  tags: string[];
  limitations: string[];
  warnings: string[];
}

export interface CodeRunSandboxRunSummary {
  runId: string;
  title: string;
  summary: string;
  createdAt: string;
  status: CodeRunSandboxRunStatus;
  provider: CodeRunSandboxProvider;
  canAttestNetworkNone: boolean;
  path: string;
  tags: string[];
  warnings: string[];
}

export interface CreateCodeRunSandboxRunInput {
  now?: Date;
  replayCommand?: string;
  status?: CodeRunSandboxStatus;
}

export interface WriteCodeRunSandboxRunInput extends CreateCodeRunSandboxRunInput {
  rootPath: string;
}

export interface CodeRunSandboxRunWriteResult {
  record: CodeRunSandboxRunRecord;
  jsonPath: string;
  markdownPath: string;
  markdown: string;
}

export interface CodeRunSandboxProbe {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  fileExists(path: string): boolean;
  readFile(path: string): string | undefined;
  readDir(path: string): string[] | undefined;
}

export function getCodeRunSandboxStatus(): CodeRunSandboxStatus {
  return detectCodeRunSandboxStatus({
    platform: platform(),
    env: process.env,
    fileExists: existsSync,
    readFile: readFileUtf8,
    readDir: readDir
  });
}

export function detectCodeRunSandboxStatus(probe: CodeRunSandboxProbe): CodeRunSandboxStatus {
  if (probe.platform !== "linux") {
    return unavailableStatus({
      platform: probe.platform,
      reason: `No measured container sandbox provider is available on ${probe.platform}.`,
      notes: defaultUnavailableNotes()
    });
  }

  const hasWorkbenchContainerMarker = isTruthyEnv(probe.env.TRUTH_HARNESS_CONTAINER);
  const hasRuntimeMarker = hasContainerRuntimeMarker(probe);
  const network = measureLinuxNetworkNamespace(probe);

  if (!hasWorkbenchContainerMarker) {
    return unavailableStatus({
      platform: probe.platform,
      reason: "The Truth Harness container marker is not present.",
      notes: [
        ...defaultUnavailableNotes(),
        "Set TRUTH_HARNESS_CONTAINER=1 only inside the Truth Harness container image; the marker is not trusted by itself."
      ]
    });
  }

  if (!hasRuntimeMarker) {
    return unavailableStatus({
      platform: probe.platform,
      reason: "No Docker/container runtime marker was measured for this process.",
      notes: [
        ...defaultUnavailableNotes(),
        "The Truth Harness container marker was present, but no runtime marker such as /.dockerenv or a container cgroup was measured."
      ]
    });
  }

  if (!network.loopbackOnly || network.hasDefaultRoute || network.hasIpv6DefaultRoute) {
    return unavailableStatus({
      platform: probe.platform,
      reason: "A container runtime was measured, but its network namespace is not loopback-only.",
      notes: [
        ...defaultUnavailableNotes(),
        `Measured network interfaces: ${network.interfaces.length > 0 ? network.interfaces.join(", ") : "unknown"}.`,
        `Measured default routes: IPv4=${String(network.hasDefaultRoute)}, IPv6=${String(network.hasIpv6DefaultRoute)}.`
      ]
    });
  }

  return {
    schemaVersion: "truth-harness.code-run-sandbox-status.v0",
    platform: probe.platform,
    available: true,
    provider: "container",
    processSandbox: "enforced",
    networkIsolation: "enforced",
    filesystemIsolation: "working-directory-only",
    canAttestNetworkNone: true,
    reason: "Measured Truth Harness container runtime with a loopback-only network namespace and no default route.",
    notes: [
      "The code-run process is executing inside the Truth Harness container image.",
      "The measured Linux network namespace exposes only loopback and no IPv4 or IPv6 default route, matching Docker network_mode none.",
      "Loopback inside the container can still be used by processes in that container; this measurement attests no non-loopback network interface/default route, not scientific correctness.",
      "The repository is still bind-mounted at /workspace, so commands can read and write workspace files."
    ]
  };
}

export function sandboxMeasurementForStatus(status: CodeRunSandboxStatus): CodeRunSandboxMeasurement {
  return {
    available: status.available,
    provider: status.provider,
    processSandbox: status.processSandbox,
    networkIsolation: status.networkIsolation,
    filesystemIsolation: status.filesystemIsolation,
    canAttestNetworkNone: status.canAttestNetworkNone,
    notes: status.notes
  };
}

export function createCodeRunSandboxRunRecord(input: CreateCodeRunSandboxRunInput = {}): CodeRunSandboxRunRecord {
  const status = input.status ?? getCodeRunSandboxStatus();
  const createdAt = (input.now ?? new Date()).toISOString();
  const passed = status.available && status.canAttestNetworkNone && status.networkIsolation === "enforced";
  const runId = `sandbox_run_${stableHash({
    createdAt,
    available: status.available,
    provider: status.provider,
    processSandbox: status.processSandbox,
    networkIsolation: status.networkIsolation,
    filesystemIsolation: status.filesystemIsolation,
    canAttestNetworkNone: status.canAttestNetworkNone,
    reason: status.reason
  }).slice(0, 16)}`;
  const summary = passed
    ? `Code-run sandbox measured ${status.provider} with ${status.networkIsolation} network isolation and can attest networkAccess none.`
    : `Code-run sandbox unavailable: ${status.reason}`;

  return {
    schemaVersion: "truth-harness.sandbox-run.v0",
    runId,
    title: "Code-Run Sandbox Measurement",
    summary,
    createdAt,
    status: passed ? "passed" : "failed",
    localOnly: true,
    networkAccess: "none",
    replay: input.replayCommand ?? "truth-harness code sandbox-status --write --json",
    measurement: status,
    artifacts: {
      json: "",
      markdown: ""
    },
    tags: sandboxRunTags(status, passed),
    limitations: [
      "This record measures the code-run execution boundary only; it does not prove command safety or correctness.",
      "A passing Docker no-network measurement attests no non-loopback interface/default route inside that container, not host isolation outside Docker.",
      "The repository may still be bind-mounted, so commands can read and write workspace files unless a stricter filesystem sandbox is added."
    ],
    warnings: passed ? [] : ["No measured code-run sandbox provider was available for this run."]
  };
}

export async function writeCodeRunSandboxRun(
  input: WriteCodeRunSandboxRunInput
): Promise<CodeRunSandboxRunWriteResult> {
  const workspace = await requireLocalWorkspace(input.rootPath);
  const record = createCodeRunSandboxRunRecord(input);
  record.replay = input.replayCommand ?? record.replay;

  const findingsDir = resolve(workspace.root, workspace.manifest.directories.findings);
  const baseName = `${record.createdAt.slice(0, 10)}-${record.runId}-sandbox-run`;
  const jsonPath = join(findingsDir, `${baseName}.json`);
  const markdownPath = join(findingsDir, `${baseName}.md`);
  record.artifacts = {
    json: toPortablePath(relative(workspace.root, jsonPath)),
    markdown: toPortablePath(relative(workspace.root, markdownPath))
  };
  const markdown = renderCodeRunSandboxRunMarkdown(record);

  await assertCodeRunSandboxRunSchema(record);
  await mkdir(findingsDir, { recursive: true });
  await writeJsonFileAtomic(jsonPath, record);
  await writeFileAtomic(markdownPath, markdown, "utf8");
  await refreshWorkspaceCatalogArtifact({
    rootPath: workspace.root,
    path: relative(workspace.root, jsonPath),
    kind: "findings",
    now: record.createdAt,
    staleReason: "Code-run sandbox measurement written"
  });

  return {
    record,
    jsonPath,
    markdownPath,
    markdown
  };
}

export async function listCodeRunSandboxRuns(rootPath: string): Promise<CodeRunSandboxRunSummary[]> {
  const workspace = await requireLocalWorkspace(rootPath);
  const findingsDir = resolve(workspace.root, workspace.manifest.directories.findings);

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
        return summarizeCodeRunSandboxRun(workspace.root, path, await readFile(path, "utf8"));
      })
  );

  return summaries
    .filter((summary): summary is CodeRunSandboxRunSummary => summary !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function parseCodeRunSandboxRunJson(raw: string, sourcePath = "code-run sandbox run"): CodeRunSandboxRunRecord {
  const parsed = parseJsonObject(raw, sourcePath, "code-run sandbox run");
  const issues: string[] = [];

  expectConst(parsed, "schemaVersion", "truth-harness.sandbox-run.v0", "$.schemaVersion", issues);
  expectPattern(parsed, "runId", /^sandbox_run_[a-f0-9]{16}$/u, "$.runId", issues);
  expectNonEmptyString(parsed, "title", "$.title", issues);
  expectNonEmptyString(parsed, "summary", "$.summary", issues);
  expectDateTime(parsed, "createdAt", "$.createdAt", issues);
  expectOneOf(parsed, "status", ["passed", "failed"], "$.status", issues);
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

  const measurement = expectRecord(parsed, "measurement", "$.measurement", issues);
  if (measurement) {
    expectConst(
      measurement,
      "schemaVersion",
      "truth-harness.code-run-sandbox-status.v0",
      "$.measurement.schemaVersion",
      issues
    );
    expectOneOf(measurement, "provider", ["none", "bubblewrap", "container", "windows-job", "custom"], "$.measurement.provider", issues);
    expectOneOf(measurement, "networkIsolation", ["not-enforced", "enforced"], "$.measurement.networkIsolation", issues);
    expectOneOf(measurement, "processSandbox", ["none", "enforced"], "$.measurement.processSandbox", issues);
    expectOneOf(measurement, "filesystemIsolation", ["working-directory-only", "workspace-scoped"], "$.measurement.filesystemIsolation", issues);
    expectNonEmptyString(measurement, "reason", "$.measurement.reason", issues);
    expectStringArray(measurement, "notes", "$.measurement.notes", issues);
  }

  if (issues.length > 0) {
    throw formatValidationError("code-run sandbox run", sourcePath, issues);
  }

  return parsed as unknown as CodeRunSandboxRunRecord;
}

export function renderCodeRunSandboxRunMarkdown(record: CodeRunSandboxRunRecord): string {
  const measurement = record.measurement;
  const lines = [
    "# Code-Run Sandbox Measurement",
    "",
    `Run: \`${record.runId}\``,
    `Status: \`${record.status}\``,
    `Created: ${record.createdAt}`,
    `Replay: \`${record.replay}\``,
    "",
    "## Summary",
    "",
    record.summary,
    "",
    "## Measurement",
    "",
    `- Platform: \`${measurement.platform}\``,
    `- Provider: \`${measurement.provider}\``,
    `- Process sandbox: \`${measurement.processSandbox}\``,
    `- Network isolation: \`${measurement.networkIsolation}\``,
    `- Filesystem isolation: \`${measurement.filesystemIsolation}\``,
    `- Can attest networkAccess none: \`${String(measurement.canAttestNetworkNone)}\``,
    `- Reason: ${measurement.reason}`,
    "",
    "## Notes",
    ""
  ];

  for (const note of measurement.notes) {
    lines.push(`- ${note}`);
  }

  lines.push("", "## Trust Boundary", "");
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

async function assertCodeRunSandboxRunSchema(record: CodeRunSandboxRunRecord): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: record,
    schemaFile: "sandbox-run.schema.json",
    artifactName: "Code-run sandbox measurement"
  });
}

function unavailableStatus(input: {
  platform: NodeJS.Platform;
  reason: string;
  notes: string[];
}): CodeRunSandboxStatus {
  return {
    schemaVersion: "truth-harness.code-run-sandbox-status.v0",
    platform: input.platform,
    available: false,
    provider: "none",
    processSandbox: "none",
    networkIsolation: "not-enforced",
    filesystemIsolation: "working-directory-only",
    canAttestNetworkNone: false,
    reason: input.reason,
    notes: input.notes
  };
}

function defaultUnavailableNotes(): string[] {
  return [
    "The built-in code-run executor can launch direct local processes with policy gates, timeouts, output caps, and concurrency limits.",
    "It cannot claim networkAccess none unless a measured sandbox provider can attest a network-denied execution boundary.",
    "Use requireSandbox when a workflow needs enforced isolation; the run will fail closed until a provider is available."
  ];
}

function hasContainerRuntimeMarker(probe: CodeRunSandboxProbe): boolean {
  if (probe.fileExists("/.dockerenv")) {
    return true;
  }

  return ["/proc/1/cgroup", "/proc/self/cgroup"].some((path) => /docker|containerd|kubepods|libpod|podman/i.test(probe.readFile(path) ?? ""));
}

function measureLinuxNetworkNamespace(probe: CodeRunSandboxProbe): {
  interfaces: string[];
  loopbackOnly: boolean;
  hasDefaultRoute: boolean;
  hasIpv6DefaultRoute: boolean;
} {
  const interfaces = (probe.readDir("/sys/class/net") ?? []).filter(Boolean).sort();
  const nonLoopbackInterfaces = interfaces.filter((name) => name !== "lo");

  return {
    interfaces,
    loopbackOnly: interfaces.includes("lo") && nonLoopbackInterfaces.length === 0,
    hasDefaultRoute: hasIpv4DefaultRoute(probe.readFile("/proc/net/route") ?? ""),
    hasIpv6DefaultRoute: hasIpv6DefaultRoute(probe.readFile("/proc/net/ipv6_route") ?? "")
  };
}

function hasIpv4DefaultRoute(routeTable: string): boolean {
  return routeTable
    .split(/\r?\n/)
    .slice(1)
    .some((line) => {
      const columns = line.trim().split(/\s+/);
      return columns.length > 2 && columns[0] !== "lo" && columns[1] === "00000000";
    });
}

function hasIpv6DefaultRoute(routeTable: string): boolean {
  return routeTable.split(/\r?\n/).some((line) => {
    const columns = line.trim().split(/\s+/);
    const interfaceName = columns[9];
    return columns.length > 9 && interfaceName !== "lo" && /^0{32}$/i.test(columns[0]) && columns[1] === "00";
  });
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

function readFileUtf8(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function readDir(path: string): string[] | undefined {
  try {
    return readdirSync(path);
  } catch {
    return undefined;
  }
}

function sandboxRunTags(status: CodeRunSandboxStatus, passed: boolean): string[] {
  return [
    "code-run-sandbox",
    "sandbox-evidence",
    passed ? "passed" : "failed",
    status.provider,
    status.networkIsolation,
    status.canAttestNetworkNone ? "network-none-attested" : "network-unknown"
  ].sort();
}

function summarizeCodeRunSandboxRun(
  rootPath: string,
  path: string,
  raw: string
): CodeRunSandboxRunSummary | undefined {
  try {
    const record = parseCodeRunSandboxRunJson(raw, path);
    return {
      runId: record.runId,
      title: record.title,
      summary: record.summary,
      createdAt: record.createdAt,
      status: record.status,
      provider: record.measurement.provider,
      canAttestNetworkNone: record.measurement.canAttestNetworkNone,
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
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before writing sandbox measurements.");
  }
  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}. Run \`truth-harness workspace repair\`.`);
  }
  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function toPortablePath(path: string): string {
  return path.split("\\").join("/");
}

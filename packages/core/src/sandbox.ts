import { existsSync, readFileSync, readdirSync } from "node:fs";
import { platform } from "node:os";

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
  schemaVersion: "theorem.code-run-sandbox-status.v0";
  platform: NodeJS.Platform;
  reason: string;
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

  const hasWorkbenchContainerMarker = isTruthyEnv(probe.env.THEOREM_WORKBENCH_CONTAINER);
  const hasRuntimeMarker = hasContainerRuntimeMarker(probe);
  const network = measureLinuxNetworkNamespace(probe);

  if (!hasWorkbenchContainerMarker) {
    return unavailableStatus({
      platform: probe.platform,
      reason: "The Theorem Workbench container marker is not present.",
      notes: [
        ...defaultUnavailableNotes(),
        "Set THEOREM_WORKBENCH_CONTAINER=1 only inside the Theorem Workbench container image; the marker is not trusted by itself."
      ]
    });
  }

  if (!hasRuntimeMarker) {
    return unavailableStatus({
      platform: probe.platform,
      reason: "No Docker/container runtime marker was measured for this process.",
      notes: [
        ...defaultUnavailableNotes(),
        "The Theorem Workbench container marker was present, but no runtime marker such as /.dockerenv or a container cgroup was measured."
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
    schemaVersion: "theorem.code-run-sandbox-status.v0",
    platform: probe.platform,
    available: true,
    provider: "container",
    processSandbox: "enforced",
    networkIsolation: "enforced",
    filesystemIsolation: "working-directory-only",
    canAttestNetworkNone: true,
    reason: "Measured Theorem Workbench container runtime with a loopback-only network namespace and no default route.",
    notes: [
      "The code-run process is executing inside the Theorem Workbench container image.",
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

function unavailableStatus(input: {
  platform: NodeJS.Platform;
  reason: string;
  notes: string[];
}): CodeRunSandboxStatus {
  return {
    schemaVersion: "theorem.code-run-sandbox-status.v0",
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

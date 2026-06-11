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

export function getCodeRunSandboxStatus(): CodeRunSandboxStatus {
  return {
    schemaVersion: "theorem.code-run-sandbox-status.v0",
    platform: platform(),
    available: false,
    provider: "none",
    processSandbox: "none",
    networkIsolation: "not-enforced",
    filesystemIsolation: "working-directory-only",
    canAttestNetworkNone: false,
    reason: "No OS-enforced code-run sandbox provider is configured in this build.",
    notes: [
      "The built-in code-run executor can launch direct local processes with policy gates, timeouts, output caps, and concurrency limits.",
      "It cannot yet enforce a network-denied namespace or filesystem sandbox, so code-run records must not claim networkAccess none.",
      "Use requireSandbox when a workflow needs enforced isolation; the run will fail closed until a provider is available."
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

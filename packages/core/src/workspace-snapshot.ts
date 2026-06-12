import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import {
  getLocalWorkspaceStatus,
  initLocalWorkspace,
  LOCAL_WORKSPACE_DIR,
  type LocalWorkspaceDirectory,
  type LocalWorkspaceStatus
} from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";

export type WorkspaceSnapshotEntryKind = LocalWorkspaceDirectory | "manifest" | "unknown";

export interface WorkspaceSnapshotEntry {
  path: string;
  kind: WorkspaceSnapshotEntryKind;
  bytes: number;
  sha256: string;
  schemaVersion?: string;
  artifactId?: string;
}

export interface WorkspaceSnapshot {
  schemaVersion: "theorem.workspace-snapshot.v0";
  snapshotId: string;
  projectId: string;
  createdAt: string;
  workspaceDir: typeof LOCAL_WORKSPACE_DIR;
  entries: WorkspaceSnapshotEntry[];
  summary: {
    totalFiles: number;
    totalBytes: number;
    byKind: Record<string, number>;
    bySchema: Record<string, number>;
  };
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface WorkspaceSnapshotWriteResult {
  snapshot: WorkspaceSnapshot;
  path: string;
}

export interface WorkspaceSnapshotSummary {
  schemaVersion: "theorem.workspace-snapshot.v0";
  snapshotId: string;
  projectId: string;
  createdAt: string;
  path: string;
  totalFiles: number;
  totalBytes: number;
  byKind: Record<string, number>;
  bySchema: Record<string, number>;
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface WorkspaceSnapshotVerificationEntry {
  path: string;
  kind: WorkspaceSnapshotEntryKind;
  expectedBytes?: number;
  actualBytes?: number;
  expectedSha256?: string;
  actualSha256?: string;
  schemaVersion?: string;
  artifactId?: string;
}

export interface WorkspaceSnapshotVerification {
  schemaVersion: "theorem.workspace-snapshot-verification.v0";
  snapshotId: string;
  projectId: string;
  verifiedAt: string;
  passed: boolean;
  checked: number;
  missing: WorkspaceSnapshotVerificationEntry[];
  changed: WorkspaceSnapshotVerificationEntry[];
  addedSinceSnapshot: WorkspaceSnapshotVerificationEntry[];
  warnings: string[];
}

export interface CreateWorkspaceSnapshotInput {
  rootPath: string;
  now?: string;
}

export interface VerifyWorkspaceSnapshotInput {
  rootPath: string;
  snapshotRef: string;
  now?: string;
}

const SNAPSHOT_SCHEMA_VERSION = "theorem.workspace-snapshot.v0" as const;
const SNAPSHOT_VERIFY_SCHEMA_VERSION = "theorem.workspace-snapshot-verification.v0" as const;
const JSON_ID_KEYS = [
  "runId",
  "auditId",
  "vaultId",
  "simulationId",
  "experimentId",
  "disclosureId",
  "entryId",
  "chartId",
  "packageId",
  "sessionId",
  "checkpointId",
  "reviewId",
  "planId",
  "recordId",
  "runRecordId",
  "benchmarkRunId",
  "comparisonId",
  "packetId",
  "projectId",
  "documentId"
] as const;

export async function createWorkspaceSnapshot(input: CreateWorkspaceSnapshotInput): Promise<WorkspaceSnapshot> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const entries = await collectWorkspaceEntries(status.root);
  const snapshotWithoutId = {
    projectId: status.manifest.projectId,
    createdAt,
    workspaceDir: LOCAL_WORKSPACE_DIR as typeof LOCAL_WORKSPACE_DIR,
    entries,
    summary: summarizeEntries(entries),
    privacy: status.manifest.privacy,
    warnings: snapshotWarnings()
  };
  const snapshotId = `snap_${stableHash(snapshotWithoutId).slice(0, 16)}`;

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    snapshotId,
    ...snapshotWithoutId
  };
}

export async function writeWorkspaceSnapshot(input: CreateWorkspaceSnapshotInput): Promise<WorkspaceSnapshotWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const snapshot = await createWorkspaceSnapshot(input);
  const snapshotsDir = resolve(status.root, status.manifest.directories.snapshots);
  await mkdir(snapshotsDir, { recursive: true });
  const path = join(snapshotsDir, `${snapshot.createdAt.slice(0, 10)}-${snapshot.snapshotId}.json`);
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  return { snapshot, path };
}

export async function listWorkspaceSnapshots(rootPath: string): Promise<WorkspaceSnapshotSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const snapshotsDir = resolve(status.root, status.manifest.directories.snapshots);

  let files: string[];
  try {
    files = await readdir(snapshotsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const snapshots = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const path = join(snapshotsDir, file);
        const snapshot = parseWorkspaceSnapshot(await readFile(path, "utf8"));
        return summarizeSnapshot(snapshot, toPortablePath(relative(status.root, path)));
      })
  );

  return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function verifyWorkspaceSnapshot(input: VerifyWorkspaceSnapshotInput): Promise<WorkspaceSnapshotVerification> {
  const status = await requireLocalWorkspace(input.rootPath);
  const snapshot = await readWorkspaceSnapshotRef(status, input.snapshotRef);
  const current = await createWorkspaceSnapshot({
    rootPath: status.root,
    now: input.now
  });
  const snapshotEntries = new Map(snapshot.entries.map((entry) => [entry.path, entry]));
  const currentEntries = new Map(current.entries.map((entry) => [entry.path, entry]));
  const missing: WorkspaceSnapshotVerificationEntry[] = [];
  const changed: WorkspaceSnapshotVerificationEntry[] = [];
  const addedSinceSnapshot: WorkspaceSnapshotVerificationEntry[] = [];

  for (const entry of snapshot.entries) {
    const currentEntry = currentEntries.get(entry.path);
    if (!currentEntry) {
      missing.push(toExpectedVerificationEntry(entry));
      continue;
    }

    if (entry.bytes !== currentEntry.bytes || entry.sha256 !== currentEntry.sha256) {
      changed.push({
        path: entry.path,
        kind: entry.kind,
        expectedBytes: entry.bytes,
        actualBytes: currentEntry.bytes,
        expectedSha256: entry.sha256,
        actualSha256: currentEntry.sha256,
        schemaVersion: entry.schemaVersion ?? currentEntry.schemaVersion,
        artifactId: entry.artifactId ?? currentEntry.artifactId
      });
    }
  }

  for (const entry of current.entries) {
    if (!snapshotEntries.has(entry.path)) {
      addedSinceSnapshot.push(toActualVerificationEntry(entry));
    }
  }

  return {
    schemaVersion: SNAPSHOT_VERIFY_SCHEMA_VERSION,
    snapshotId: snapshot.snapshotId,
    projectId: snapshot.projectId,
    verifiedAt: input.now ?? new Date().toISOString(),
    passed: missing.length === 0 && changed.length === 0 && addedSinceSnapshot.length === 0,
    checked: snapshot.entries.length,
    missing,
    changed,
    addedSinceSnapshot,
    warnings: [
      "Snapshot verification checks local file identity and drift; it does not prove the scientific, mathematical, medical, or legal truth of any artifact.",
      "Encrypted vault entries are verified as encrypted envelopes only; plaintext remains private unless explicitly opened with a local vault command."
    ]
  };
}

async function collectWorkspaceEntries(root: string): Promise<WorkspaceSnapshotEntry[]> {
  const workspaceRoot = resolve(root, LOCAL_WORKSPACE_DIR);
  const snapshotsRoot = resolve(workspaceRoot, "snapshots");
  const entries: WorkspaceSnapshotEntry[] = [];

  async function walk(directory: string): Promise<void> {
    let dirents;
    try {
      dirents = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return;
      }

      throw error;
    }

    for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, dirent.name);

      if (dirent.isDirectory()) {
        if (resolve(path) === snapshotsRoot) {
          continue;
        }

        await walk(path);
        continue;
      }

      if (!dirent.isFile()) {
        continue;
      }

      entries.push(await createSnapshotEntry(root, path));
    }
  }

  await walk(workspaceRoot);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function createSnapshotEntry(root: string, path: string): Promise<WorkspaceSnapshotEntry> {
  const bytes = await readFile(path);
  const portablePath = toPortablePath(relative(root, path));
  const metadata = parseJsonMetadata(portablePath, bytes);

  return {
    path: portablePath,
    kind: kindForPortablePath(portablePath),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    schemaVersion: metadata.schemaVersion,
    artifactId: metadata.artifactId
  };
}

function summarizeEntries(entries: WorkspaceSnapshotEntry[]): WorkspaceSnapshot["summary"] {
  const byKind: Record<string, number> = {};
  const bySchema: Record<string, number> = {};
  let totalBytes = 0;

  for (const entry of entries) {
    byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
    totalBytes += entry.bytes;
    if (entry.schemaVersion) {
      bySchema[entry.schemaVersion] = (bySchema[entry.schemaVersion] ?? 0) + 1;
    }
  }

  return {
    totalFiles: entries.length,
    totalBytes,
    byKind,
    bySchema
  };
}

function parseJsonMetadata(path: string, bytes: Buffer): { schemaVersion?: string; artifactId?: string } {
  if (!path.endsWith(".json")) {
    return {};
  }

  try {
    const parsed = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    const schemaVersion = typeof parsed.schemaVersion === "string" ? parsed.schemaVersion : undefined;
    const artifactId = JSON_ID_KEYS.map((key) => parsed[key]).find((value): value is string => typeof value === "string");

    return {
      schemaVersion,
      artifactId
    };
  } catch {
    return {};
  }
}

function kindForPortablePath(path: string): WorkspaceSnapshotEntryKind {
  const parts = path.split("/");
  if (parts[0] !== LOCAL_WORKSPACE_DIR) {
    return "unknown";
  }

  if (parts[1] === "project.json") {
    return "manifest";
  }

  if (isWorkspaceDirectory(parts[1])) {
    return parts[1];
  }

  return "unknown";
}

function isWorkspaceDirectory(value: string | undefined): value is LocalWorkspaceDirectory {
  return (
    value === "receipts" ||
    value === "artifacts" ||
    value === "indexes" ||
    value === "findings" ||
    value === "inventions" ||
    value === "cas" ||
    value === "proofs" ||
    value === "smt" ||
    value === "benchmarks" ||
    value === "disclosures" ||
    value === "simulations" ||
    value === "patents" ||
    value === "experiments" ||
    value === "vault" ||
    value === "audits" ||
    value === "snapshots" ||
    value === "sessions" ||
    value === "reviews" ||
    value === "validation" ||
    value === "literature" ||
    value === "notebook-runs" ||
    value === "code-runs" ||
    value === "model-contexts" ||
    value === "routes"
  );
}

async function readWorkspaceSnapshotRef(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  snapshotRef: string
): Promise<WorkspaceSnapshot> {
  const ref = requireText(snapshotRef, "Workspace snapshot ref is required.");

  if (isSnapshotId(ref)) {
    const snapshotsDir = resolve(status.root, status.manifest.directories.snapshots);
    const files = await readdir(snapshotsDir);
    for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
      const path = join(snapshotsDir, file);
      const snapshot = parseWorkspaceSnapshot(await readFile(path, "utf8"));
      if (snapshot.snapshotId === ref) {
        return snapshot;
      }
    }

    throw new Error(`Workspace snapshot not found: ${ref}`);
  }

  return parseWorkspaceSnapshot(await readFile(resolveUnderRoot(status.root, ref), "utf8"));
}

function parseWorkspaceSnapshot(raw: string): WorkspaceSnapshot {
  const snapshot = JSON.parse(raw) as WorkspaceSnapshot;
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`Unsupported workspace snapshot schema: ${JSON.stringify(snapshot.schemaVersion)}`);
  }

  return snapshot;
}

function summarizeSnapshot(snapshot: WorkspaceSnapshot, path: string): WorkspaceSnapshotSummary {
  return {
    schemaVersion: snapshot.schemaVersion,
    snapshotId: snapshot.snapshotId,
    projectId: snapshot.projectId,
    createdAt: snapshot.createdAt,
    path,
    totalFiles: snapshot.summary.totalFiles,
    totalBytes: snapshot.summary.totalBytes,
    byKind: snapshot.summary.byKind,
    bySchema: snapshot.summary.bySchema,
    privacy: snapshot.privacy,
    warnings: snapshot.warnings
  };
}

function toExpectedVerificationEntry(entry: WorkspaceSnapshotEntry): WorkspaceSnapshotVerificationEntry {
  return {
    path: entry.path,
    kind: entry.kind,
    expectedBytes: entry.bytes,
    expectedSha256: entry.sha256,
    schemaVersion: entry.schemaVersion,
    artifactId: entry.artifactId
  };
}

function toActualVerificationEntry(entry: WorkspaceSnapshotEntry): WorkspaceSnapshotVerificationEntry {
  return {
    path: entry.path,
    kind: entry.kind,
    actualBytes: entry.bytes,
    actualSha256: entry.sha256,
    schemaVersion: entry.schemaVersion,
    artifactId: entry.artifactId
  };
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Theorem workspace found. Run `theorem workspace init` before creating workspace snapshots.");
  }

  if (status.missingDirectories.length > 0) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Workspace snapshot path escapes workspace root: ${JSON.stringify(path)}`);
  }

  return target;
}

function snapshotWarnings(): string[] {
  return [
    "Workspace snapshots hash local artifacts to detect drift; hashes prove file identity, not scientific, mathematical, medical, or legal truth.",
    "Snapshot files are excluded from snapshot entries so each snapshot remains portable and does not hash itself.",
    "Vault entries are hashed as encrypted envelopes only; plaintext stays private unless explicitly opened with a local vault command."
  ];
}

function requireText(value: string | undefined, message: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function isSnapshotId(value: string): boolean {
  return /^snap_[a-f0-9]{16}$/.test(value);
}

function toPortablePath(value: string): string {
  return value.split(sep).join("/");
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

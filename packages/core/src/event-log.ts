import { createHash } from "node:crypto";
import { mkdir, open, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { withWorkspaceLock } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";

export const WORKSPACE_EVENT_SCHEMA_VERSION = "truth-harness.event.v0";

export type WorkspaceEventAction = "artifact-written" | "catalog-stale" | "workspace-initialized";
export type WorkspaceEventActorKind = "truth-harness-core" | "cli" | "mcp" | "web-ui" | "agent" | "human";

export interface WorkspaceEventActor {
  kind: WorkspaceEventActorKind;
  name?: string;
}

export interface WorkspaceEventInput {
  rootPath: string;
  action: WorkspaceEventAction;
  path?: string;
  kind?: string;
  artifactId?: string;
  summary?: string;
  actor?: WorkspaceEventActor;
  now?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

export interface WorkspaceArtifactWriteEventInput {
  rootPath: string;
  path: string;
  kind?: string;
  artifactId?: string;
  summary?: string;
  actor?: WorkspaceEventActor;
  now?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

export interface WorkspaceEventRecord {
  schemaVersion: typeof WORKSPACE_EVENT_SCHEMA_VERSION;
  eventId: string;
  projectId: string;
  createdAt: string;
  action: WorkspaceEventAction;
  actor: WorkspaceEventActor;
  path?: string;
  kind?: string;
  artifactId?: string;
  artifact?: {
    sha256: string;
    byteLength: number;
  };
  summary?: string;
  metadata: Record<string, string | number | boolean>;
  localOnly: true;
  networkAccess: "none";
}

export interface WorkspaceEventAppendResult {
  event: WorkspaceEventRecord;
  logPath: string;
}

export interface WorkspaceEventListResult {
  schemaVersion: "truth-harness.event-list.v0";
  rootPath: string;
  localOnly: true;
  networkAccess: "none";
  total: number;
  events: WorkspaceEventRecord[];
  warnings: string[];
}

export async function appendWorkspaceEvent(input: WorkspaceEventInput): Promise<WorkspaceEventAppendResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const event = await createWorkspaceEvent(status, {
    ...input,
    now: createdAt,
    path: input.path ? workspaceRelativePath(status.root, input.path) : undefined
  });

  return appendEventRecord(status, event);
}

export async function appendArtifactWriteEvent(
  input: WorkspaceArtifactWriteEventInput
): Promise<WorkspaceEventAppendResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const path = workspaceRelativePath(status.root, input.path);
  const artifactPath = resolveUnderRoot(status.root, path);
  const artifact = await fileIdentity(artifactPath);
  const artifactId = input.artifactId ?? (await inferArtifactId(artifactPath));
  const createdAt = input.now ?? new Date().toISOString();
  const event = await createWorkspaceEvent(status, {
    ...input,
    now: createdAt,
    action: "artifact-written",
    path,
    artifactId,
    metadata: {
      ...input.metadata,
      artifactSha256: artifact.sha256,
      artifactByteLength: artifact.byteLength
    }
  });

  return appendEventRecord(status, {
    ...event,
    artifact
  });
}

export async function listWorkspaceEvents(rootPath: string, limit = 100): Promise<WorkspaceEventListResult> {
  const status = await requireLocalWorkspace(rootPath);
  const eventsDir = resolve(status.root, status.manifest.directories.events);
  const warnings: string[] = [];
  let files: string[];
  try {
    files = await readdir(eventsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {
        schemaVersion: "truth-harness.event-list.v0",
        rootPath: status.root,
        localOnly: true,
        networkAccess: "none",
        total: 0,
        events: [],
        warnings
      };
    }

    throw error;
  }

  const events: WorkspaceEventRecord[] = [];
  for (const file of files.filter((candidate) => candidate.endsWith(".jsonl")).sort()) {
    const path = join(eventsDir, file);
    const lines = (await readFile(path, "utf8")).split(/\r?\n/u).filter((line) => line.trim().length > 0);
    for (const [index, line] of lines.entries()) {
      try {
        const parsed = JSON.parse(line) as WorkspaceEventRecord;
        if (parsed.schemaVersion === WORKSPACE_EVENT_SCHEMA_VERSION) {
          events.push(parsed);
        } else {
          warnings.push(`${file}:${index + 1} has unsupported event schema.`);
        }
      } catch {
        warnings.push(`${file}:${index + 1} is not valid JSON.`);
      }
    }
  }

  events.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.eventId.localeCompare(right.eventId));
  return {
    schemaVersion: "truth-harness.event-list.v0",
    rootPath: status.root,
    localOnly: true,
    networkAccess: "none",
    total: events.length,
    events: events.slice(-Math.max(1, Math.min(limit, 1_000))),
    warnings
  };
}

async function createWorkspaceEvent(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  input: Omit<WorkspaceEventInput, "rootPath">
): Promise<WorkspaceEventRecord> {
  const createdAt = input.now ?? new Date().toISOString();
  const actor = normalizeActor(input.actor);
  const metadata = normalizeMetadata(input.metadata ?? {});
  const eventWithoutId = {
    projectId: status.manifest.projectId,
    createdAt,
    action: input.action,
    actor,
    path: input.path,
    kind: input.kind,
    artifactId: input.artifactId,
    summary: input.summary,
    metadata
  };

  return {
    schemaVersion: WORKSPACE_EVENT_SCHEMA_VERSION,
    eventId: `evt_${stableHash(eventWithoutId).slice(0, 16)}`,
    ...eventWithoutId,
    localOnly: true,
    networkAccess: "none"
  };
}

async function appendEventRecord(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  event: WorkspaceEventRecord
): Promise<WorkspaceEventAppendResult> {
  const logPath = eventLogPath(status, event.createdAt);
  await withWorkspaceLock(status.root, "event-log", async () => {
    await mkdir(resolve(status.root, status.manifest.directories.events), { recursive: true });
    const handle = await open(logPath, "a");
    try {
      await handle.writeFile(`${JSON.stringify(event)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  });

  return { event, logPath };
}

function eventLogPath(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  createdAt: string
): string {
  const eventsDir = resolve(status.root, status.manifest.directories.events);
  return join(eventsDir, `${createdAt.slice(0, 10)}.jsonl`);
}

async function fileIdentity(path: string): Promise<{ sha256: string; byteLength: number }> {
  const bytes = await readFile(path);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.byteLength
  };
}

async function inferArtifactId(path: string): Promise<string | undefined> {
  if (!path.endsWith(".json")) {
    return undefined;
  }

  try {
    const parsed = parseJsonWithOptionalBom(await readFile(path, "utf8"));
    if (!isRecord(parsed)) {
      return undefined;
    }

    for (const key of ARTIFACT_ID_KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before using the event log.");
  }

  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}`);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function workspaceRelativePath(root: string, path: string): string {
  const resolved = resolveUnderRoot(root, path);
  return toPortablePath(relative(root, resolved));
}

function resolveUnderRoot(root: string, path: string): string {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(resolvedRoot, path);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`Event log path escapes workspace root: ${JSON.stringify(path)}`);
  }
  return resolvedPath;
}

function normalizeActor(actor: WorkspaceEventActor | undefined): WorkspaceEventActor {
  return actor?.kind
    ? {
        kind: actor.kind,
        name: normalizeOptionalText(actor.name)
      }
    : { kind: "truth-harness-core" };
}

function normalizeMetadata(metadata: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(metadata).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined));
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPortablePath(path: string): string {
  return path.replace(/\\/g, "/");
}

const ARTIFACT_ID_KEYS = [
  "runId",
  "claimId",
  "routeId",
  "checkId",
  "benchmarkRunId",
  "comparisonId",
  "disclosureId",
  "simulationId",
  "chartId",
  "experimentId",
  "vaultId",
  "auditId",
  "snapshotId",
  "sessionId",
  "mapId",
  "planId",
  "loopId",
  "reviewId",
  "recordId",
  "runRecordId",
  "packetId",
  "visualId",
  "entryId",
  "packageId"
] as const;

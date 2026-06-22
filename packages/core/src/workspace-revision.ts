import { createHash } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { writeJsonFileAtomic } from "./fs-util.js";
import {
  getLocalWorkspaceStatus,
  initLocalWorkspace,
  type LocalWorkspaceStatus
} from "./local-workspace.js";
import {
  enrichLocalArtifactRefs,
  normalizeLocalArtifactPath,
  uniqueLocalArtifactRefs,
  type LocalArtifactRef
} from "./local-artifact-ref.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";
import {
  verifyWorkspaceSnapshot,
  writeWorkspaceSnapshot,
  type WorkspaceSnapshotVerification
} from "./workspace-snapshot.js";

export interface WorkspaceRevisionSourceSnapshot {
  snapshotId: string;
  path: string;
  sha256: string;
  totalFiles: number;
  totalBytes: number;
}

export interface WorkspaceRevision {
  schemaVersion: "truth-harness.workspace-revision.v0";
  revisionId: string;
  projectId: string;
  createdAt: string;
  title: string;
  reason: string;
  sourceSnapshot: WorkspaceRevisionSourceSnapshot;
  snapshotRefs: string[];
  parentRevisionRefs: string[];
  sessionRefs: string[];
  validationPlanRefs: string[];
  claimRefs: string[];
  artifactRefs: LocalArtifactRef[];
  summary: {
    totalFiles: number;
    totalBytes: number;
    byKind: Record<string, number>;
    bySchema: Record<string, number>;
    linkedRefs: number;
  };
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface WorkspaceRevisionWriteInput {
  rootPath: string;
  title?: string;
  reason?: string;
  parentRevisionRefs?: string[];
  sessionRefs?: string[];
  validationPlanRefs?: string[];
  claimRefs?: string[];
  artifactRefs?: LocalArtifactRef[];
  now?: string;
}

export interface WorkspaceRevisionWriteResult {
  revision: WorkspaceRevision;
  path: string;
  snapshotPath: string;
}

export interface WorkspaceRevisionSummary {
  schemaVersion: "truth-harness.workspace-revision.v0";
  revisionId: string;
  projectId: string;
  createdAt: string;
  title: string;
  reason: string;
  path: string;
  sourceSnapshot: WorkspaceRevisionSourceSnapshot;
  parentRevisionRefs: string[];
  sessionRefs: string[];
  validationPlanRefs: string[];
  claimRefs: string[];
  linkedRefs: number;
  privacy: PrivacyMetadata;
  warnings: string[];
}

export interface WorkspaceRevisionVerification {
  schemaVersion: "truth-harness.workspace-revision-verification.v0";
  revisionId: string;
  projectId: string;
  verifiedAt: string;
  passed: boolean;
  sourceSnapshotFile: {
    path: string;
    status: "verified" | "changed" | "missing";
    expectedSha256: string;
    actualSha256?: string;
  };
  snapshotVerification?: WorkspaceSnapshotVerification;
  warnings: string[];
}

const WORKSPACE_REVISION_SCHEMA_VERSION = "truth-harness.workspace-revision.v0" as const;
const WORKSPACE_REVISION_VERIFY_SCHEMA_VERSION = "truth-harness.workspace-revision-verification.v0" as const;

export async function writeWorkspaceRevision(input: WorkspaceRevisionWriteInput): Promise<WorkspaceRevisionWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const createdAt = input.now ?? new Date().toISOString();
  const snapshotWrite = await writeWorkspaceSnapshot({ rootPath: status.root, now: createdAt });
  const snapshotPath = toPortablePath(relative(status.root, snapshotWrite.path));
  const snapshotBytes = await readFile(snapshotWrite.path);
  const snapshotSha256 = sha256(snapshotBytes);
  const title = normalizeText(input.title) ?? "Workspace revision";
  const reason = normalizeText(input.reason) ?? "Research checkpoint";
  const artifactRefs = await enrichLocalArtifactRefs(
    status.root,
    uniqueLocalArtifactRefs([
      {
        path: snapshotPath,
        role: "source-snapshot",
        source: "workspace-revision"
      },
      ...(input.artifactRefs ?? []).map((ref) => ({
        ...ref,
        path: normalizeLocalArtifactPath(ref.path) ?? ref.path
      }))
    ])
  );
  const parentRevisionRefs = uniqueStrings(input.parentRevisionRefs);
  const sessionRefs = uniqueStrings(input.sessionRefs);
  const validationPlanRefs = uniqueStrings(input.validationPlanRefs);
  const claimRefs = uniqueStrings(input.claimRefs);
  const revisionWithoutId = {
    projectId: status.manifest.projectId,
    createdAt,
    title,
    reason,
    sourceSnapshot: {
      snapshotId: snapshotWrite.snapshot.snapshotId,
      path: snapshotPath,
      sha256: snapshotSha256,
      totalFiles: snapshotWrite.snapshot.summary.totalFiles,
      totalBytes: snapshotWrite.snapshot.summary.totalBytes
    },
    snapshotRefs: [snapshotWrite.snapshot.snapshotId],
    parentRevisionRefs,
    sessionRefs,
    validationPlanRefs,
    claimRefs,
    artifactRefs,
    summary: {
      totalFiles: snapshotWrite.snapshot.summary.totalFiles,
      totalBytes: snapshotWrite.snapshot.summary.totalBytes,
      byKind: snapshotWrite.snapshot.summary.byKind,
      bySchema: snapshotWrite.snapshot.summary.bySchema,
      linkedRefs: parentRevisionRefs.length + sessionRefs.length + validationPlanRefs.length + claimRefs.length + artifactRefs.length
    },
    privacy: status.manifest.privacy,
    warnings: revisionWarnings()
  };
  const revision: WorkspaceRevision = {
    schemaVersion: WORKSPACE_REVISION_SCHEMA_VERSION,
    revisionId: `rev_${stableHash(revisionWithoutId).slice(0, 16)}`,
    ...revisionWithoutId
  };
  const revisionsDir = resolve(status.root, status.manifest.directories.revisions);
  await mkdir(revisionsDir, { recursive: true });
  const path = join(revisionsDir, `${createdAt.slice(0, 10)}-${revision.revisionId}.json`);
  await assertJsonSchemaBeforeWrite({
    value: revision,
    schemaFile: "workspace-revision.schema.json",
    artifactName: "Workspace revision"
  });
  await writeJsonFileAtomic(path, revision);
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, path),
    kind: "revisions",
    now: createdAt,
    staleReason: "workspace revision written"
  });

  return {
    revision,
    path,
    snapshotPath: snapshotWrite.path
  };
}

export async function listWorkspaceRevisions(rootPath: string): Promise<WorkspaceRevisionSummary[]> {
  const status = await requireLocalWorkspace(rootPath);
  const revisionsDir = resolve(status.root, status.manifest.directories.revisions);

  let files: string[];
  try {
    files = await readdir(revisionsDir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const revisions = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const path = join(revisionsDir, file);
        const revision = parseWorkspaceRevision(await readFile(path, "utf8"));
        return summarizeWorkspaceRevision(revision, toPortablePath(relative(status.root, path)));
      })
  );

  return revisions.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function readWorkspaceRevision(rootPath: string, revisionRef: string): Promise<WorkspaceRevision> {
  const status = await requireLocalWorkspace(rootPath);
  return (await readWorkspaceRevisionRef(status, revisionRef)).revision;
}

export async function verifyWorkspaceRevision(input: {
  rootPath: string;
  revisionRef: string;
  ignoreAddedPaths?: string[];
  now?: string;
}): Promise<WorkspaceRevisionVerification> {
  const status = await requireLocalWorkspace(input.rootPath);
  const { revision } = await readWorkspaceRevisionRef(status, input.revisionRef);
  const snapshotFile = await verifySourceSnapshotFile(status.root, revision.sourceSnapshot);
  let snapshotVerification: WorkspaceSnapshotVerification | undefined;
  const warnings = revisionVerificationWarnings();
  const ignoredAddedPathSet = new Set((input.ignoreAddedPaths ?? []).map((path) => path.replace(/\\/gu, "/")));

  if (snapshotFile.status === "verified") {
    try {
      snapshotVerification = await verifyWorkspaceSnapshot({
        rootPath: status.root,
        snapshotRef: revision.sourceSnapshot.snapshotId,
        now: input.now
      });
      const ignoredRevisionAdded = snapshotVerification.addedSinceSnapshot.filter((entry) => isRevisionManifestPath(entry.path));
      const ignoredCallerAdded = snapshotVerification.addedSinceSnapshot.filter((entry) => ignoredAddedPathSet.has(entry.path));
      if (ignoredRevisionAdded.length > 0 || ignoredCallerAdded.length > 0) {
        const addedSinceSnapshot = snapshotVerification.addedSinceSnapshot.filter(
          (entry) => !isRevisionManifestPath(entry.path) && !ignoredAddedPathSet.has(entry.path)
        );
        snapshotVerification = {
          ...snapshotVerification,
          passed: snapshotVerification.missing.length === 0 && snapshotVerification.changed.length === 0 && addedSinceSnapshot.length === 0,
          addedSinceSnapshot
        };
        if (ignoredRevisionAdded.length > 0) {
          warnings.push(
            `Ignored ${ignoredRevisionAdded.length} added workspace revision manifest(s); revision history growth does not invalidate older evidence checkpoints.`
          );
        }
        if (ignoredCallerAdded.length > 0) {
          warnings.push(
            `Ignored ${ignoredCallerAdded.length} caller-declared added artifact(s); these were expected side effects of the verified handoff boundary.`
          );
        }
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Source snapshot could not be verified.");
    }
  }

  return {
    schemaVersion: WORKSPACE_REVISION_VERIFY_SCHEMA_VERSION,
    revisionId: revision.revisionId,
    projectId: revision.projectId,
    verifiedAt: input.now ?? new Date().toISOString(),
    passed: snapshotFile.status === "verified" && snapshotVerification?.passed === true,
    sourceSnapshotFile: snapshotFile,
    snapshotVerification,
    warnings
  };
}

export function parseWorkspaceRevision(raw: string): WorkspaceRevision {
  const revision = JSON.parse(raw) as WorkspaceRevision;
  if (revision.schemaVersion !== WORKSPACE_REVISION_SCHEMA_VERSION) {
    throw new Error(`Unsupported workspace revision schema: ${JSON.stringify(revision.schemaVersion)}`);
  }
  return revision;
}

async function readWorkspaceRevisionRef(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  revisionRef: string
): Promise<{ revision: WorkspaceRevision; path: string }> {
  const ref = requireText(revisionRef, "Workspace revision ref is required.");

  if (/^rev_[a-f0-9]{16}$/u.test(ref)) {
    const revisionsDir = resolve(status.root, status.manifest.directories.revisions);
    const files = await readdir(revisionsDir);
    for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
      const path = join(revisionsDir, file);
      const revision = parseWorkspaceRevision(await readFile(path, "utf8"));
      if (revision.revisionId === ref) {
        return {
          revision,
          path: toPortablePath(relative(status.root, path))
        };
      }
    }

    throw new Error(`Workspace revision not found: ${ref}`);
  }

  const path = resolveUnderRoot(status.root, ref);
  return {
    revision: parseWorkspaceRevision(await readFile(path, "utf8")),
    path: toPortablePath(relative(status.root, path))
  };
}

function summarizeWorkspaceRevision(revision: WorkspaceRevision, path: string): WorkspaceRevisionSummary {
  return {
    schemaVersion: revision.schemaVersion,
    revisionId: revision.revisionId,
    projectId: revision.projectId,
    createdAt: revision.createdAt,
    title: revision.title,
    reason: revision.reason,
    path,
    sourceSnapshot: revision.sourceSnapshot,
    parentRevisionRefs: revision.parentRevisionRefs,
    sessionRefs: revision.sessionRefs,
    validationPlanRefs: revision.validationPlanRefs,
    claimRefs: revision.claimRefs,
    linkedRefs: revision.summary.linkedRefs,
    privacy: revision.privacy,
    warnings: revision.warnings
  };
}

async function verifySourceSnapshotFile(
  root: string,
  sourceSnapshot: WorkspaceRevisionSourceSnapshot
): Promise<WorkspaceRevisionVerification["sourceSnapshotFile"]> {
  try {
    const bytes = await readFile(resolveUnderRoot(root, sourceSnapshot.path));
    const actualSha256 = sha256(bytes);
    return {
      path: sourceSnapshot.path,
      status: actualSha256 === sourceSnapshot.sha256 ? "verified" : "changed",
      expectedSha256: sourceSnapshot.sha256,
      actualSha256
    };
  } catch {
    return {
      path: sourceSnapshot.path,
      status: "missing",
      expectedSha256: sourceSnapshot.sha256
    };
  }
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before creating workspace revisions.");
  }

  if (status.missingDirectories.length > 0 || status.manifestRepair?.addedDirectories.length) {
    await initLocalWorkspace(rootPath);
    return requireLocalWorkspace(rootPath);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function revisionWarnings(): string[] {
  return [
    "Workspace revisions commit to a source snapshot and local artifact identity; they do not prove mathematical, scientific, medical, regulatory, or legal truth.",
    "Revision refs are resume/review anchors for humans and agents; trust still comes only from concrete receipts, proof checks, SMT checks, CAS checks, citations, simulations, experiments, or expert review.",
    "A changed or missing source snapshot means the revision should not be used as a safe autonomous-agent resume point until the workspace is re-reviewed."
  ];
}

function revisionVerificationWarnings(): string[] {
  return [
    "Revision verification checks snapshot-file identity and workspace drift only; it does not validate the truth of any claim in the revision.",
    "If verification fails, create a fresh workspace revision before handing the workspace to an autonomous agent."
  ];
}

function isRevisionManifestPath(path: string): boolean {
  return path.startsWith(".truth-harness/revisions/") && path.endsWith(".json");
}

function uniqueStrings(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
}

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function requireText(value: string | undefined, message: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Workspace revision path escapes workspace root: ${JSON.stringify(path)}`);
  }
  return target;
}

function toPortablePath(value: string): string {
  return value.split(sep).join("/");
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

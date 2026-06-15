import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { getEngineManifest } from "./engine-manifest.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import {
  getLocalWorkspaceStatus,
  LOCAL_WORKSPACE_DIR,
  type LocalWorkspaceDirectory,
  type LocalWorkspaceManifest
} from "./local-workspace.js";
import { renderVisualArtifactMarkdown, type VisualArtifact } from "./visual-artifact.js";

export type WorkspaceCleanGroup = "scratch" | "generated" | "evidence" | "all";
export type WorkspaceCleanTarget = WorkspaceCleanGroup | LocalWorkspaceDirectory;

export interface WorkspaceArtifactRepairAction {
  path: string;
  kind: "route-manifest" | "visual-source-ref";
  applied: boolean;
  changes: string[];
}

export interface WorkspaceArtifactRepairResult {
  schemaVersion: "truth-harness.workspace-artifact-repair.v0";
  root: string;
  workspaceDir: string;
  dryRun: boolean;
  repaired: boolean;
  actions: WorkspaceArtifactRepairAction[];
  warnings: string[];
}

export interface WorkspaceCleanEntry {
  directory: LocalWorkspaceDirectory;
  path: string;
  exists: boolean;
  files: number;
  bytes: number;
  deleted: boolean;
  preserved: string[];
}

export interface WorkspaceCleanResult {
  schemaVersion: "truth-harness.workspace-clean.v0";
  root: string;
  workspaceDir: string;
  dryRun: boolean;
  targets: WorkspaceCleanTarget[];
  resolvedDirectories: LocalWorkspaceDirectory[];
  entries: WorkspaceCleanEntry[];
  deletedFiles: number;
  deletedBytes: number;
  warnings: string[];
}

export interface WorkspaceArchiveEntry {
  directory: LocalWorkspaceDirectory;
  sourcePath: string;
  archivePath: string;
  exists: boolean;
  files: number;
  bytes: number;
  copied: boolean;
}

export interface WorkspaceArchiveFileEntry {
  directory: LocalWorkspaceDirectory;
  sourcePath: string;
  archivePath: string;
  bytes: number;
  sha256: string;
}

export interface WorkspaceArchiveResult {
  schemaVersion: "truth-harness.workspace-archive.v0";
  archiveId: string;
  root: string;
  workspaceDir: string;
  archiveDir: string;
  manifestPath: string;
  targets: WorkspaceCleanTarget[];
  resolvedDirectories: LocalWorkspaceDirectory[];
  entries: WorkspaceArchiveEntry[];
  files: WorkspaceArchiveFileEntry[];
  archivedFiles: number;
  archivedBytes: number;
  warnings: string[];
}

export interface WorkspaceArchiveSummary {
  archiveId: string;
  createdAt: string;
  reason: string;
  archiveDir: string;
  manifestPath: string;
  targets: WorkspaceCleanTarget[];
  resolvedDirectories: LocalWorkspaceDirectory[];
  totalFiles: number;
  totalBytes: number;
  damaged: boolean;
  damageReason?: string;
}

export interface WorkspaceArchiveListResult {
  schemaVersion: "truth-harness.workspace-archive-list.v0";
  root: string;
  workspaceDir: string;
  total: number;
  damaged: number;
  archives: WorkspaceArchiveSummary[];
  warnings: string[];
}

export interface WorkspaceArchiveRestoreConflict {
  path: string;
  reason: "target-exists" | "hash-mismatch";
  archiveBytes: number;
  archiveSha256: string;
  liveBytes?: number;
  liveSha256?: string;
}

export interface WorkspaceArchiveRestoreEntry {
  directory: LocalWorkspaceDirectory;
  archivePath: string;
  targetPath: string;
  exists: boolean;
  files: number;
  bytes: number;
  conflicts: number;
  restored: boolean;
}

export interface WorkspaceArchiveRestoreResult {
  schemaVersion: "truth-harness.workspace-archive-restore.v0";
  archiveId: string;
  root: string;
  workspaceDir: string;
  archiveDir: string;
  dryRun: boolean;
  targets: WorkspaceCleanTarget[];
  resolvedDirectories: LocalWorkspaceDirectory[];
  entries: WorkspaceArchiveRestoreEntry[];
  conflicts: WorkspaceArchiveRestoreConflict[];
  verifiedFiles: number;
  restoredFiles: number;
  restoredBytes: number;
  overwrite: boolean;
  warnings: string[];
}

const WORKSPACE_DIRECTORY_NAMES: LocalWorkspaceDirectory[] = [
  "receipts",
  "claims",
  "artifacts",
  "events",
  "indexes",
  "findings",
  "inventions",
  "cas",
  "proofs",
  "smt",
  "benchmarks",
  "disclosures",
  "simulations",
  "patents",
  "experiments",
  "vault",
  "audits",
  "snapshots",
  "sessions",
  "reviews",
  "validation",
  "literature",
  "notebook-runs",
  "code-runs",
  "model-contexts",
  "visuals",
  "routes"
];

const CLEAN_GROUPS: Record<WorkspaceCleanGroup, LocalWorkspaceDirectory[]> = {
  scratch: ["indexes", "validation", "snapshots"],
  generated: ["indexes", "validation", "snapshots", "events", "findings", "artifacts", "visuals", "benchmarks"],
  evidence: [
    "receipts",
    "claims",
    "routes",
    "cas",
    "proofs",
    "smt",
    "model-contexts",
    "notebook-runs",
    "code-runs",
    "sessions",
    "reviews",
    "literature",
    "disclosures",
    "simulations",
    "experiments",
    "inventions",
    "patents",
    "vault",
    "audits"
  ],
  all: WORKSPACE_DIRECTORY_NAMES
};

export async function repairWorkspaceArtifacts(input: {
  rootPath: string;
  dryRun?: boolean;
  now?: string;
}): Promise<WorkspaceArtifactRepairResult> {
  const status = await requireWorkspace(input.rootPath);
  const now = input.now ?? new Date().toISOString();
  const dryRun = input.dryRun ?? false;
  const actions: WorkspaceArtifactRepairAction[] = [];
  const warnings: string[] = [];

  await repairLegacyRouteManifests(status.root, status.manifest, now, dryRun, actions, warnings);
  await repairPromptVisualSourceRefs(status.root, status.manifest, now, dryRun, actions, warnings);

  return {
    schemaVersion: "truth-harness.workspace-artifact-repair.v0",
    root: status.root,
    workspaceDir: status.workspaceDir,
    dryRun,
    repaired: actions.some((action) => action.applied),
    actions,
    warnings
  };
}

export async function cleanLocalWorkspace(input: {
  rootPath: string;
  targets?: WorkspaceCleanTarget[];
  dryRun?: boolean;
}): Promise<WorkspaceCleanResult> {
  const status = await requireWorkspace(input.rootPath);
  const dryRun = input.dryRun ?? true;
  const targets: WorkspaceCleanTarget[] = input.targets && input.targets.length > 0 ? input.targets : ["scratch"];
  const directories = resolveCleanTargets(targets);
  const warnings = cleanWarnings(targets, directories, dryRun);
  const entries: WorkspaceCleanEntry[] = [];

  for (const directory of directories) {
    const directoryPath = resolveWorkspaceDirectory(status.root, status.manifest.directories[directory]);
    const preserved = directory === "indexes" ? ["locks"] : [];
    const exists = await pathExists(directoryPath);
    const before = exists ? await collectDirectoryStats(directoryPath, new Set(preserved)) : { files: 0, bytes: 0 };
    let deleted = false;

    if (exists && !dryRun) {
      await emptyDirectory(directoryPath, new Set(preserved));
      deleted = true;
      await mkdir(directoryPath, { recursive: true });
    }

    entries.push({
      directory,
      path: relativeWorkspacePath(status.root, directoryPath),
      exists,
      files: before.files,
      bytes: before.bytes,
      deleted,
      preserved
    });
  }

  return {
    schemaVersion: "truth-harness.workspace-clean.v0",
    root: status.root,
    workspaceDir: status.workspaceDir,
    dryRun,
    targets,
    resolvedDirectories: directories,
    entries,
    deletedFiles: dryRun ? 0 : entries.reduce((sum, entry) => sum + (entry.deleted ? entry.files : 0), 0),
    deletedBytes: dryRun ? 0 : entries.reduce((sum, entry) => sum + (entry.deleted ? entry.bytes : 0), 0),
    warnings
  };
}

export async function archiveLocalWorkspace(input: {
  rootPath: string;
  targets?: WorkspaceCleanTarget[];
  now?: string;
  reason?: string;
}): Promise<WorkspaceArchiveResult> {
  const status = await requireWorkspace(input.rootPath);
  const now = input.now ?? new Date().toISOString();
  const targets: WorkspaceCleanTarget[] = input.targets && input.targets.length > 0 ? input.targets : ["all"];
  const directories = resolveCleanTargets(targets);
  const archiveId = await nextArchiveId(status.root, now);
  const archiveDir = resolveWorkspaceDirectory(status.root, `${LOCAL_WORKSPACE_DIR}/archives/${archiveId}`);
  const entries: WorkspaceArchiveEntry[] = [];
  const files: WorkspaceArchiveFileEntry[] = [];
  const warnings = [
    "Archive copies selected workspace data into .truth-harness/archives; it is local evidence backup, not off-machine backup.",
    "Archive manifests include per-file SHA-256 hashes for restore verification; hashes prove file identity, not claim truth."
  ];

  await mkdir(archiveDir, { recursive: true });

  for (const directory of directories) {
    const sourcePath = resolveWorkspaceDirectory(status.root, status.manifest.directories[directory]);
    const targetPath = resolveWorkspaceDirectory(status.root, `${LOCAL_WORKSPACE_DIR}/archives/${archiveId}/${directory}`);
    const exists = await pathExists(sourcePath);
    const stats = exists ? await collectDirectoryStats(sourcePath, new Set(["archives"])) : { files: 0, bytes: 0 };
    let copied = false;

    if (exists) {
      await copyDirectory(sourcePath, targetPath, new Set(["archives"]));
      files.push(...(await collectArchiveFileEntries(status.root, directory, sourcePath, targetPath)));
      copied = stats.files > 0;
    }

    entries.push({
      directory,
      sourcePath: relativeWorkspacePath(status.root, sourcePath),
      archivePath: relativeWorkspacePath(status.root, targetPath),
      exists,
      files: stats.files,
      bytes: stats.bytes,
      copied
    });
  }

  const manifest = {
    schemaVersion: "truth-harness.workspace-archive-manifest.v0",
    archiveId,
    createdAt: now,
    root: status.root,
    workspaceDir: status.workspaceDir,
    targets,
    resolvedDirectories: directories,
    reason: input.reason ?? "local workspace maintenance archive",
    entries,
    files
  };
  const manifestPath = join(archiveDir, "archive-manifest.json");
  await writeJsonFileAtomic(manifestPath, manifest);

  return {
    schemaVersion: "truth-harness.workspace-archive.v0",
    archiveId,
    root: status.root,
    workspaceDir: status.workspaceDir,
    archiveDir: relativeWorkspacePath(status.root, archiveDir),
    manifestPath: relativeWorkspacePath(status.root, manifestPath),
    targets,
    resolvedDirectories: directories,
    entries,
    files,
    archivedFiles: entries.reduce((sum, entry) => sum + (entry.copied ? entry.files : 0), 0),
    archivedBytes: entries.reduce((sum, entry) => sum + (entry.copied ? entry.bytes : 0), 0),
    warnings
  };
}

export async function listLocalWorkspaceArchives(input: { rootPath: string }): Promise<WorkspaceArchiveListResult> {
  const status = await requireWorkspace(input.rootPath);
  const archivesRoot = resolveWorkspaceDirectory(status.root, `${LOCAL_WORKSPACE_DIR}/archives`);
  const archives: WorkspaceArchiveSummary[] = [];

  if (await pathExists(archivesRoot)) {
    const entries = await readdir(archivesRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = join(archivesRoot, entry.name, "archive-manifest.json");
      archives.push(await readArchiveSummary(status.root, manifestPath, entry.name));
    }
  }

  archives.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.archiveId.localeCompare(left.archiveId));

  return {
    schemaVersion: "truth-harness.workspace-archive-list.v0",
    root: status.root,
    workspaceDir: status.workspaceDir,
    total: archives.length,
    damaged: archives.filter((archive) => archive.damaged).length,
    archives,
    warnings: [
      "Archives are local copies under .truth-harness/archives; they are not off-machine backups.",
      ...archives.filter((archive) => archive.damaged).map((archive) => `Damaged archive listed for review: ${archive.archiveId}.`)
    ]
  };
}

export async function restoreLocalWorkspaceArchive(input: {
  rootPath: string;
  archiveRef: string;
  targets?: WorkspaceCleanTarget[];
  dryRun?: boolean;
  overwrite?: boolean;
}): Promise<WorkspaceArchiveRestoreResult> {
  const status = await requireWorkspace(input.rootPath);
  const dryRun = input.dryRun ?? true;
  const overwrite = input.overwrite ?? false;
  const archiveDir = resolveArchiveDirectory(status.root, input.archiveRef);
  const manifestPath = join(archiveDir, "archive-manifest.json");
  const manifest = await readArchiveManifest(status.root, manifestPath);
  const manifestDirectories = manifest.resolvedDirectories;
  const targets: WorkspaceCleanTarget[] =
    input.targets && input.targets.length > 0 ? input.targets : manifestDirectories.length > 0 ? manifestDirectories : ["scratch"];
  const directories = resolveCleanTargets(targets).filter((directory) => manifestDirectories.includes(directory));
  const entries: WorkspaceArchiveRestoreEntry[] = [];
  const conflicts: WorkspaceArchiveRestoreConflict[] = [];
  let verifiedFiles = 0;

  for (const directory of directories) {
    const archivePath = resolveWorkspaceDirectory(status.root, `${LOCAL_WORKSPACE_DIR}/archives/${manifest.archiveId}/${directory}`);
    const targetPath = resolveWorkspaceDirectory(status.root, status.manifest.directories[directory]);
    const exists = await pathExists(archivePath);
    const stats = exists ? await collectDirectoryStats(archivePath, new Set()) : { files: 0, bytes: 0 };
    const fileEntries = manifest.files.filter((file) => file.directory === directory);
    const directoryConflicts: WorkspaceArchiveRestoreConflict[] = [];
    let restored = false;

    if (exists) {
      if (stats.files > 0 && fileEntries.length === 0) {
        directoryConflicts.push({
          path: relativeWorkspacePath(status.root, archivePath),
          reason: "hash-mismatch",
          archiveBytes: stats.bytes,
          archiveSha256: "",
          liveBytes: stats.bytes
        });
      }

      for (const file of fileEntries) {
        const archiveFilePath = resolveWorkspaceDirectory(status.root, file.archivePath);
        const targetFilePath = resolveWorkspaceDirectory(
          status.root,
          `${status.manifest.directories[directory]}/${relativePathWithinDirectory(file.archivePath, directory)}`
        );
        const archiveFile = await fileIdentity(archiveFilePath);
        if (!archiveFile || archiveFile.bytes !== file.bytes || archiveFile.sha256 !== file.sha256) {
          directoryConflicts.push({
            path: relativeWorkspacePath(status.root, archiveFilePath),
            reason: "hash-mismatch",
            archiveBytes: file.bytes,
            archiveSha256: file.sha256,
            liveBytes: archiveFile?.bytes,
            liveSha256: archiveFile?.sha256
          });
          continue;
        }

        verifiedFiles += 1;
        const liveFile = await fileIdentity(targetFilePath);
        if (liveFile && (liveFile.bytes !== file.bytes || liveFile.sha256 !== file.sha256) && !overwrite) {
          directoryConflicts.push({
            path: relativeWorkspacePath(status.root, targetFilePath),
            reason: "target-exists",
            archiveBytes: file.bytes,
            archiveSha256: file.sha256,
            liveBytes: liveFile.bytes,
            liveSha256: liveFile.sha256
          });
        }
      }
    }

    conflicts.push(...directoryConflicts);

    if (exists && !dryRun) {
      if (directoryConflicts.length > 0) {
        throw new Error(
          `Archive restore has ${directoryConflicts.length} conflict${directoryConflicts.length === 1 ? "" : "s"} in ${directory}. Preview first, or pass --overwrite to replace changed live files.`
        );
      }

      await copyDirectory(archivePath, targetPath, new Set());
      restored = stats.files > 0;
    }

    entries.push({
      directory,
      archivePath: relativeWorkspacePath(status.root, archivePath),
      targetPath: relativeWorkspacePath(status.root, targetPath),
      exists,
      files: stats.files,
      bytes: stats.bytes,
      conflicts: directoryConflicts.length,
      restored
    });
  }

  const warnings = [
    dryRun
      ? "Dry run only. Pass --confirm-restore to copy files from the archive into live workspace directories."
      : "Confirmed restore copied archive files into live workspace directories. Files not present in the archive were not deleted.",
    overwrite
      ? "Overwrite was allowed; changed live files can be replaced by archive copies."
      : "Restore refuses to overwrite changed live files unless overwrite is explicitly allowed.",
    "Restore verifies archive file hashes before copying. Hashes prove file identity, not claim truth.",
    "Restore is local-only and does not upgrade, prove, or validate any claim by itself."
  ];

  return {
    schemaVersion: "truth-harness.workspace-archive-restore.v0",
    archiveId: manifest.archiveId,
    root: status.root,
    workspaceDir: status.workspaceDir,
    archiveDir: relativeWorkspacePath(status.root, archiveDir),
    dryRun,
    targets,
    resolvedDirectories: directories,
    entries,
    conflicts,
    verifiedFiles,
    restoredFiles: dryRun ? 0 : entries.reduce((sum, entry) => sum + (entry.restored ? entry.files : 0), 0),
    restoredBytes: dryRun ? 0 : entries.reduce((sum, entry) => sum + (entry.restored ? entry.bytes : 0), 0),
    overwrite,
    warnings
  };
}

export function isWorkspaceCleanTarget(value: string): value is WorkspaceCleanTarget {
  return value in CLEAN_GROUPS || (WORKSPACE_DIRECTORY_NAMES as string[]).includes(value);
}

async function repairLegacyRouteManifests(
  root: string,
  manifest: LocalWorkspaceManifest,
  now: string,
  dryRun: boolean,
  actions: WorkspaceArtifactRepairAction[],
  warnings: string[]
): Promise<void> {
  const routesDir = resolveWorkspaceDirectory(root, manifest.directories.routes);
  const files = await listJsonFiles(routesDir);
  const engineManifest = getEngineManifest({ now: new Date(now), timeoutMs: 250 });

  for (const filePath of files) {
    const parsed = await readJsonRecord(filePath);
    if (parsed.schemaVersion !== "truth-harness.verifier-route.v0" || !isRecord(parsed.manifest)) {
      continue;
    }

    const routeManifest = parsed.manifest as Record<string, unknown>;
    const changes: string[] = [];
    if (typeof routeManifest.deterministicCount !== "number" || !Number.isFinite(routeManifest.deterministicCount)) {
      routeManifest.deterministicCount = engineManifest.deterministicCount;
      changes.push("manifest.deterministicCount");
    }
    if (
      typeof routeManifest.replayDeterministicCount !== "number" ||
      !Number.isFinite(routeManifest.replayDeterministicCount)
    ) {
      routeManifest.replayDeterministicCount = engineManifest.replayDeterministicCount;
      changes.push("manifest.replayDeterministicCount");
    }
    if (!isRecord(routeManifest.machineContract)) {
      routeManifest.machineContract = engineManifest.machineContract;
      changes.push("manifest.machineContract");
    }

    if (changes.length === 0) {
      continue;
    }

    parsed.manifest = routeManifest;
    parsed.warnings = addUniqueWarning(
      parsed.warnings,
      `Legacy route manifest repaired at ${now}; determinism contract metadata was backfilled from the current Truth Harness engine manifest without rerunning verification.`
    );

    if (!dryRun) {
      await writeJsonFileAtomic(filePath, parsed);
    }

    actions.push({
      path: relativeWorkspacePath(root, filePath),
      kind: "route-manifest",
      applied: !dryRun,
      changes
    });
  }

  if (actions.some((action) => action.kind === "route-manifest")) {
    warnings.push("Legacy route manifest repair updates metadata only; it does not upgrade any trust label.");
  }
}

async function repairPromptVisualSourceRefs(
  root: string,
  manifest: LocalWorkspaceManifest,
  now: string,
  dryRun: boolean,
  actions: WorkspaceArtifactRepairAction[],
  warnings: string[]
): Promise<void> {
  const visualsDir = resolveWorkspaceDirectory(root, manifest.directories.visuals);
  const files = await listJsonFiles(visualsDir);

  for (const filePath of files) {
    const parsed = await readJsonRecord(filePath);
    if (parsed.schemaVersion !== "truth-harness.visual-artifact.v0" || !Array.isArray(parsed.sourceRefs)) {
      continue;
    }

    let changed = false;
    parsed.sourceRefs = parsed.sourceRefs.map((entry) => {
      if (!isRecord(entry) || entry.kind !== "receipt" || typeof entry.ref !== "string" || !entry.ref.startsWith("prompt:")) {
        return entry;
      }

      changed = true;
      return {
        ...entry,
        kind: "manual",
        label: typeof entry.label === "string" && entry.label.trim() ? entry.label : "Prompt input"
      };
    });

    if (!changed) {
      continue;
    }

    parsed.warnings = addUniqueWarning(
      parsed.warnings,
      `Legacy visual source ref repaired at ${now}; prompt-derived visuals are manual context and do not resolve as receipt evidence.`
    );
    parsed.updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : now;

    if (!dryRun) {
      const visual = parsed as unknown as VisualArtifact;
      parsed.markdown = renderVisualArtifactMarkdown(visual);
      await writeJsonFileAtomic(filePath, parsed);
      const markdownPath = replaceExtension(filePath, ".md");
      if (await pathExists(markdownPath)) {
        await writeFileAtomic(markdownPath, parsed.markdown as string, "utf8");
      }
    }

    actions.push({
      path: relativeWorkspacePath(root, filePath),
      kind: "visual-source-ref",
      applied: !dryRun,
      changes: ["sourceRefs[].kind"]
    });
  }

  if (actions.some((action) => action.kind === "visual-source-ref")) {
    warnings.push("Prompt visual ref repair prevents unresolved receipt refs; visuals still cannot upgrade source trust labels.");
  }
}

async function requireWorkspace(rootPath: string): Promise<{
  root: string;
  workspaceDir: string;
  manifest: LocalWorkspaceManifest;
}> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` first.");
  }

  return {
    root: status.root,
    workspaceDir: status.workspaceDir,
    manifest: status.manifest
  };
}

function resolveCleanTargets(targets: WorkspaceCleanTarget[]): LocalWorkspaceDirectory[] {
  const resolved: LocalWorkspaceDirectory[] = [];

  for (const target of targets) {
    if (!isWorkspaceCleanTarget(target)) {
      throw new Error(`Unknown workspace clean target: ${JSON.stringify(target)}`);
    }

    const directories = target in CLEAN_GROUPS ? CLEAN_GROUPS[target as WorkspaceCleanGroup] : [target as LocalWorkspaceDirectory];
    for (const directory of directories) {
      if (!resolved.includes(directory)) {
        resolved.push(directory);
      }
    }
  }

  return resolved;
}

function cleanWarnings(
  targets: WorkspaceCleanTarget[],
  directories: LocalWorkspaceDirectory[],
  dryRun: boolean
): string[] {
  const warnings = [
    dryRun
      ? "Dry run only. Pass --confirm-delete to actually remove files."
      : "Confirmed cleanup removed only contents of resolved .truth-harness directories; project.json was preserved."
  ];
  const evidenceDirectories = new Set(CLEAN_GROUPS.evidence);

  if (targets.includes("all") || directories.some((directory) => evidenceDirectories.has(directory))) {
    warnings.push("This target includes durable evidence artifacts. Export, commit, or snapshot important work before confirming deletion.");
  }

  if (directories.includes("indexes")) {
    warnings.push("Index lock files are preserved so cleanup does not disturb active workspace operations.");
  }

  return warnings;
}

async function listJsonFiles(directoryPath: string): Promise<string[]> {
  if (!(await pathExists(directoryPath))) {
    return [];
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(child)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".json") {
      files.push(child);
    }
  }
  return files.sort();
}

async function readJsonRecord(filePath: string): Promise<Record<string, unknown>> {
  const parsed = parseJsonWithOptionalBom(await readFile(filePath, "utf8"));
  return isRecord(parsed) ? parsed : {};
}

async function readArchiveSummary(root: string, manifestPath: string, fallbackArchiveId: string): Promise<WorkspaceArchiveSummary> {
  try {
    const manifest = await readArchiveManifest(root, manifestPath);
    return {
      archiveId: manifest.archiveId,
      createdAt: manifest.createdAt,
      reason: manifest.reason,
      archiveDir: relativeWorkspacePath(root, dirname(manifestPath)),
      manifestPath: relativeWorkspacePath(root, manifestPath),
      targets: manifest.targets,
      resolvedDirectories: manifest.resolvedDirectories,
      totalFiles: manifest.entries.reduce((sum, entry) => sum + entry.files, 0),
      totalBytes: manifest.entries.reduce((sum, entry) => sum + entry.bytes, 0),
      damaged: false
    };
  } catch (error) {
    return {
      archiveId: fallbackArchiveId,
      createdAt: "",
      reason: "damaged archive manifest",
      archiveDir: relativeWorkspacePath(root, dirname(manifestPath)),
      manifestPath: relativeWorkspacePath(root, manifestPath),
      targets: [],
      resolvedDirectories: [],
      totalFiles: 0,
      totalBytes: 0,
      damaged: true,
      damageReason: error instanceof Error ? error.message : "Archive manifest could not be read."
    };
  }
}

async function readArchiveManifest(
  root: string,
  manifestPath: string
): Promise<{
  archiveId: string;
  createdAt: string;
  reason: string;
  targets: WorkspaceCleanTarget[];
  resolvedDirectories: LocalWorkspaceDirectory[];
  entries: Array<{ directory: LocalWorkspaceDirectory; files: number; bytes: number }>;
  files: WorkspaceArchiveFileEntry[];
}> {
  const parsed = await readJsonRecord(manifestPath);
  if (parsed.schemaVersion !== "truth-harness.workspace-archive-manifest.v0") {
    throw new Error(`Unsupported workspace archive manifest schema: ${JSON.stringify(parsed.schemaVersion)}.`);
  }

  const archiveId = typeof parsed.archiveId === "string" && parsed.archiveId.trim() ? parsed.archiveId : basename(dirname(manifestPath));
  const archiveDir = resolveArchiveDirectory(root, archiveId);
  const manifestDir = resolve(dirname(manifestPath));
  if (manifestDir !== archiveDir) {
    throw new Error("Workspace archive manifest path does not match its archive id.");
  }

  const targets = normalizeCleanTargetArray(parsed.targets);
  const resolvedDirectories = normalizeWorkspaceDirectoryArray(parsed.resolvedDirectories);
  const entries = Array.isArray(parsed.entries)
    ? parsed.entries
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .map((entry) => ({
          directory: normalizeWorkspaceDirectory(entry.directory),
          files: normalizeNonNegativeNumber(entry.files),
          bytes: normalizeNonNegativeNumber(entry.bytes)
        }))
        .filter((entry): entry is { directory: LocalWorkspaceDirectory; files: number; bytes: number } => Boolean(entry.directory))
    : [];
  const files = Array.isArray(parsed.files)
    ? parsed.files
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .map((entry) => ({
          directory: normalizeWorkspaceDirectory(entry.directory),
          sourcePath: typeof entry.sourcePath === "string" ? entry.sourcePath : "",
          archivePath: typeof entry.archivePath === "string" ? entry.archivePath : "",
          bytes: normalizeNonNegativeNumber(entry.bytes),
          sha256: typeof entry.sha256 === "string" && /^[a-f0-9]{64}$/u.test(entry.sha256) ? entry.sha256 : ""
        }))
        .filter(
          (entry): entry is WorkspaceArchiveFileEntry =>
            Boolean(entry.directory && entry.sourcePath && entry.archivePath && entry.sha256)
        )
    : [];

  return {
    archiveId,
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
    reason: typeof parsed.reason === "string" ? parsed.reason : "local workspace maintenance archive",
    targets,
    resolvedDirectories,
    entries,
    files
  };
}

async function nextArchiveId(root: string, now: string): Promise<string> {
  const baseId = `archive_${compactTimestamp(now)}`;
  let candidate = baseId;
  let suffix = 2;
  while (await pathExists(resolveWorkspaceDirectory(root, `${LOCAL_WORKSPACE_DIR}/archives/${candidate}`))) {
    candidate = `${baseId}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function collectArchiveFileEntries(
  root: string,
  directory: LocalWorkspaceDirectory,
  sourceRoot: string,
  archiveRoot: string
): Promise<WorkspaceArchiveFileEntry[]> {
  const entries: WorkspaceArchiveFileEntry[] = [];

  async function walk(sourceDirectory: string, archiveDirectory: string): Promise<void> {
    let dirents;
    try {
      dirents = await readdir(archiveDirectory, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
      const archivePath = join(archiveDirectory, dirent.name);
      const sourcePath = join(sourceDirectory, dirent.name);
      if (dirent.isDirectory()) {
        await walk(sourcePath, archivePath);
      } else if (dirent.isFile()) {
        const identity = await requireFileIdentity(archivePath);
        entries.push({
          directory,
          sourcePath: relativeWorkspacePath(root, sourcePath),
          archivePath: relativeWorkspacePath(root, archivePath),
          bytes: identity.bytes,
          sha256: identity.sha256
        });
      }
    }
  }

  await walk(sourceRoot, archiveRoot);
  return entries.sort((left, right) => left.archivePath.localeCompare(right.archivePath));
}

async function collectDirectoryStats(
  directoryPath: string,
  preservedBaseNames: Set<string>
): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (preservedBaseNames.has(entry.name)) {
      continue;
    }

    const child = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectDirectoryStats(child, new Set());
      files += nested.files;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      const info = await stat(child);
      files += 1;
      bytes += info.size;
    }
  }

  return { files, bytes };
}

async function emptyDirectory(directoryPath: string, preservedBaseNames: Set<string>): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (preservedBaseNames.has(entry.name)) {
      continue;
    }

    await rm(join(directoryPath, entry.name), { recursive: true, force: true });
  }
}

async function copyDirectory(sourcePath: string, targetPath: string, ignoredBaseNames: Set<string>): Promise<void> {
  await mkdir(targetPath, { recursive: true });
  const entries = await readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoredBaseNames.has(entry.name)) {
      continue;
    }

    const sourceChild = join(sourcePath, entry.name);
    const targetChild = join(targetPath, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourceChild, targetChild, new Set());
    } else if (entry.isFile()) {
      await mkdir(dirname(targetChild), { recursive: true });
      await copyFile(sourceChild, targetChild);
    }
  }
}

async function requireFileIdentity(filePath: string): Promise<{ bytes: number; sha256: string }> {
  const identity = await fileIdentity(filePath);
  if (!identity) {
    throw new Error(`Expected file is missing: ${filePath}`);
  }
  return identity;
}

async function fileIdentity(filePath: string): Promise<{ bytes: number; sha256: string } | undefined> {
  try {
    const bytes = await readFile(filePath);
    return {
      bytes: bytes.byteLength,
      sha256: sha256(bytes)
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT" || nodeError.code === "EISDIR") {
      return undefined;
    }
    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function relativePathWithinDirectory(archivePath: string, directory: LocalWorkspaceDirectory): string {
  const marker = `/${directory}/`;
  const index = archivePath.indexOf(marker);
  if (index === -1) {
    throw new Error(`Archive file path does not contain expected directory ${directory}: ${archivePath}`);
  }
  return archivePath.slice(index + marker.length);
}

function resolveArchiveDirectory(root: string, archiveRef: string): string {
  const archivesRoot = resolveWorkspaceDirectory(root, `${LOCAL_WORKSPACE_DIR}/archives`);
  const ref = archiveRef.trim();
  if (!ref) {
    throw new Error("Workspace archive id or path is required.");
  }

  const candidatePath = extname(ref).toLowerCase() === ".json" ? dirname(ref) : ref;
  const target = candidatePath.includes("/") || candidatePath.includes("\\")
    ? resolve(root, candidatePath)
    : resolve(archivesRoot, candidatePath);
  const archivesRootWithSep = archivesRoot.endsWith(sep) ? archivesRoot : `${archivesRoot}${sep}`;

  if (target === archivesRoot || !target.startsWith(archivesRootWithSep)) {
    throw new Error(`Workspace archive ref escapes ${LOCAL_WORKSPACE_DIR}/archives: ${JSON.stringify(archiveRef)}.`);
  }

  return target;
}

function resolveWorkspaceDirectory(root: string, directory: string): string {
  const workspaceRoot = resolve(root, LOCAL_WORKSPACE_DIR);
  const target = resolve(root, directory);
  const workspaceRootWithSep = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`;

  if (target !== workspaceRoot && !target.startsWith(workspaceRootWithSep)) {
    throw new Error(`Workspace directory escapes ${LOCAL_WORKSPACE_DIR}: ${JSON.stringify(directory)}`);
  }

  return target;
}

function normalizeCleanTargetArray(value: unknown): WorkspaceCleanTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is WorkspaceCleanTarget => typeof entry === "string" && isWorkspaceCleanTarget(entry));
}

function normalizeWorkspaceDirectoryArray(value: unknown): LocalWorkspaceDirectory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeWorkspaceDirectory(entry))
    .filter((entry): entry is LocalWorkspaceDirectory => Boolean(entry));
}

function normalizeWorkspaceDirectory(value: unknown): LocalWorkspaceDirectory | undefined {
  return typeof value === "string" && (WORKSPACE_DIRECTORY_NAMES as string[]).includes(value)
    ? (value as LocalWorkspaceDirectory)
    : undefined;
}

function normalizeNonNegativeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function relativeWorkspacePath(root: string, filePath: string): string {
  const rootPath = resolve(root);
  const absolutePath = resolve(filePath);
  if (absolutePath === rootPath) {
    return ".";
  }

  const rootWithSep = rootPath.endsWith(sep) ? rootPath : `${rootPath}${sep}`;
  return absolutePath.startsWith(rootWithSep) ? absolutePath.slice(rootWithSep.length).split(sep).join("/") : absolutePath;
}

function compactTimestamp(value: string): string {
  return value.replace(/[^0-9A-Za-z]/gu, "").slice(0, 24);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function replaceExtension(filePath: string, nextExtension: string): string {
  const base = basename(filePath, extname(filePath));
  return join(dirname(filePath), `${base}${nextExtension}`);
}

function addUniqueWarning(existing: unknown, warning: string): string[] {
  const warnings = Array.isArray(existing) ? existing.filter((value): value is string => typeof value === "string") : [];
  return warnings.includes(warning) ? warnings : [...warnings, warning];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
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

function resolveWorkspaceDirectory(root: string, directory: string): string {
  const workspaceRoot = resolve(root, LOCAL_WORKSPACE_DIR);
  const target = resolve(root, directory);
  const workspaceRootWithSep = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`;

  if (target !== workspaceRoot && !target.startsWith(workspaceRootWithSep)) {
    throw new Error(`Workspace directory escapes ${LOCAL_WORKSPACE_DIR}: ${JSON.stringify(directory)}`);
  }

  return target;
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

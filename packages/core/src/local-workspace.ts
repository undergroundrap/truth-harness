import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { writeJsonFileAtomic } from "./fs-util.js";
import { assertJsonSchemaBeforeWrite } from "./schema-write-validation.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";

export const LOCAL_WORKSPACE_DIR = ".truth-harness";
export const LOCAL_WORKSPACE_MANIFEST = "project.json";

export type LocalWorkspaceDirectory =
  | "receipts"
  | "claims"
  | "artifacts"
  | "events"
  | "indexes"
  | "findings"
  | "inventions"
  | "cas"
  | "proofs"
  | "smt"
  | "engine-runs"
  | "benchmarks"
  | "disclosures"
  | "simulations"
  | "patents"
  | "experiments"
  | "vault"
  | "audits"
  | "snapshots"
  | "revisions"
  | "sessions"
  | "reviews"
  | "validation"
  | "literature"
  | "notebook-runs"
  | "code-runs"
  | "model-contexts"
  | "visuals"
  | "routes";

export interface LocalWorkspaceManifest {
  schemaVersion: "truth-harness.workspace.v0";
  projectId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  privacy: PrivacyMetadata;
  directories: Record<LocalWorkspaceDirectory, string>;
  policies: {
    externalCalls: "disabled-by-default";
    disclosure: "required-for-external-calls";
    secrets: "environment-only";
    portability: "relative-paths";
  };
}

const DEFAULT_WORKSPACE_DIRECTORIES: Record<LocalWorkspaceDirectory, string> = {
  receipts: ".truth-harness/receipts",
  claims: ".truth-harness/claims",
  artifacts: ".truth-harness/artifacts",
  events: ".truth-harness/events",
  indexes: ".truth-harness/indexes",
  findings: ".truth-harness/findings",
  inventions: ".truth-harness/inventions",
  cas: ".truth-harness/cas",
  proofs: ".truth-harness/proofs",
  smt: ".truth-harness/smt",
  "engine-runs": ".truth-harness/engine-runs",
  benchmarks: ".truth-harness/benchmarks",
  disclosures: ".truth-harness/disclosures",
  simulations: ".truth-harness/simulations",
  patents: ".truth-harness/patents",
  experiments: ".truth-harness/experiments",
  vault: ".truth-harness/vault",
  audits: ".truth-harness/audits",
  snapshots: ".truth-harness/snapshots",
  revisions: ".truth-harness/revisions",
  sessions: ".truth-harness/sessions",
  reviews: ".truth-harness/reviews",
  validation: ".truth-harness/validation",
  literature: ".truth-harness/literature",
  "notebook-runs": ".truth-harness/notebook-runs",
  "code-runs": ".truth-harness/code-runs",
  "model-contexts": ".truth-harness/model-contexts",
  visuals: ".truth-harness/visuals",
  routes: ".truth-harness/routes"
};

export interface LocalWorkspaceInitResult {
  created: boolean;
  root: string;
  workspaceDir: string;
  manifestPath: string;
  manifest: LocalWorkspaceManifest;
  manifestRepair?: LocalWorkspaceManifestRepair;
}

export interface LocalWorkspaceStatus {
  exists: boolean;
  root: string;
  workspaceDir: string;
  manifestPath: string;
  manifest?: LocalWorkspaceManifest;
  missingDirectories: string[];
  manifestRepair?: LocalWorkspaceManifestRepair;
}

export interface LocalWorkspaceManifestRepair {
  applied: boolean;
  addedDirectories: LocalWorkspaceDirectory[];
}

export interface LocalWorkspaceRepairResult {
  repaired: boolean;
  root: string;
  workspaceDir: string;
  manifestPath: string;
  manifest: LocalWorkspaceManifest;
  manifestRepair?: LocalWorkspaceManifestRepair;
  missingDirectoriesBefore: string[];
  missingDirectoriesAfter: string[];
  createdDirectories: string[];
}

export async function initLocalWorkspace(
  rootPath: string,
  options: { displayName?: string; now?: string } = {}
): Promise<LocalWorkspaceInitResult> {
  const root = resolve(rootPath);
  const workspaceDir = join(root, LOCAL_WORKSPACE_DIR);
  const manifestPath = join(workspaceDir, LOCAL_WORKSPACE_MANIFEST);
  const existing = await tryReadManifest(manifestPath);

  if (existing) {
    const manifest = await repairManifestIfNeeded(manifestPath, existing, options.now);
    await ensureWorkspaceDirectories(root, manifest);
    return {
      created: false,
      root,
      workspaceDir,
      manifestPath,
      manifest,
      manifestRepair: createManifestRepair(existing.addedDirectories, true)
    };
  }

  const now = options.now ?? new Date().toISOString();
  const manifest = createLocalWorkspaceManifest(root, now, options.displayName);

  await mkdir(workspaceDir, { recursive: true });
  await ensureWorkspaceDirectories(root, manifest);
  await writeManifest(manifestPath, manifest);

  return {
    created: true,
    root,
    workspaceDir,
    manifestPath,
    manifest
  };
}

export async function getLocalWorkspaceStatus(rootPath: string): Promise<LocalWorkspaceStatus> {
  const root = resolve(rootPath);
  const workspaceDir = join(root, LOCAL_WORKSPACE_DIR);
  const manifestPath = join(workspaceDir, LOCAL_WORKSPACE_MANIFEST);
  const manifest = await tryReadManifest(manifestPath);

  if (!manifest) {
    return {
      exists: false,
      root,
      workspaceDir,
      manifestPath,
      missingDirectories: []
    };
  }

  return {
    exists: true,
    root,
    workspaceDir,
    manifestPath,
    manifest: manifest.manifest,
    missingDirectories: await missingWorkspaceDirectories(root, manifest.manifest),
    manifestRepair: createManifestRepair(manifest.addedDirectories, false)
  };
}

export async function repairLocalWorkspace(
  rootPath: string,
  options: { now?: string } = {}
): Promise<LocalWorkspaceRepairResult> {
  const root = resolve(rootPath);
  const workspaceDir = join(root, LOCAL_WORKSPACE_DIR);
  const manifestPath = join(workspaceDir, LOCAL_WORKSPACE_MANIFEST);
  const existing = await tryReadManifest(manifestPath);

  if (!existing) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before repairing workspace storage.");
  }

  const missingDirectoriesBefore = await missingWorkspaceDirectories(root, existing.manifest);
  const manifest = await repairManifestIfNeeded(manifestPath, existing, options.now);
  await ensureWorkspaceDirectories(root, manifest);
  const missingDirectoriesAfter = await missingWorkspaceDirectories(root, manifest);
  const remainingMissing = new Set(missingDirectoriesAfter);
  const createdDirectories = missingDirectoriesBefore.filter((directory) => !remainingMissing.has(directory));
  const manifestRepair = createManifestRepair(existing.addedDirectories, existing.addedDirectories.length > 0);

  return {
    repaired: createdDirectories.length > 0 || Boolean(manifestRepair?.applied),
    root,
    workspaceDir,
    manifestPath,
    manifest,
    manifestRepair,
    missingDirectoriesBefore,
    missingDirectoriesAfter,
    createdDirectories
  };
}

export function createLocalWorkspaceManifest(
  rootPath: string,
  createdAt: string,
  displayName = "Truth Harness Project"
): LocalWorkspaceManifest {
  const root = resolve(rootPath);
  const directories = { ...DEFAULT_WORKSPACE_DIRECTORIES };

  return {
    schemaVersion: "truth-harness.workspace.v0",
    projectId: `th_${stableHash({ root, createdAt }).slice(0, 16)}`,
    displayName,
    createdAt,
    updatedAt: createdAt,
    privacy: {
      mode: "local-only",
      localFirst: true,
      networkAccess: "none",
      dataResidency: "local-workspace",
      externalDisclosures: []
    },
    directories,
    policies: {
      externalCalls: "disabled-by-default",
      disclosure: "required-for-external-calls",
      secrets: "environment-only",
      portability: "relative-paths"
    }
  };
}

async function ensureWorkspaceDirectories(root: string, manifest: LocalWorkspaceManifest): Promise<void> {
  await Promise.all(
    Object.values(manifest.directories).map(async (directory) => {
      await mkdir(resolveWorkspaceDirectory(root, directory), { recursive: true });
    })
  );
}

async function missingWorkspaceDirectories(root: string, manifest: LocalWorkspaceManifest): Promise<string[]> {
  const missing: string[] = [];

  await Promise.all(
    Object.values(manifest.directories).map(async (directory) => {
      try {
        const stats = await stat(resolveWorkspaceDirectory(root, directory));
        if (!stats.isDirectory()) {
          missing.push(directory);
        }
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT") {
          missing.push(directory);
          return;
        }

        throw error;
      }
    })
  );

  return missing.sort();
}

interface LocalWorkspaceManifestReadResult {
  manifest: LocalWorkspaceManifest;
  addedDirectories: LocalWorkspaceDirectory[];
}

async function tryReadManifest(path: string): Promise<LocalWorkspaceManifestReadResult | undefined> {
  try {
    const parsed = normalizeWorkspaceManifest(parseJsonWithOptionalBom(await readFile(path, "utf8")) as LocalWorkspaceManifest);
    validateWorkspaceManifest(parsed.manifest, dirname(dirname(path)));
    return parsed;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function repairManifestIfNeeded(
  manifestPath: string,
  readResult: LocalWorkspaceManifestReadResult,
  now: string | undefined
): Promise<LocalWorkspaceManifest> {
  if (readResult.addedDirectories.length === 0) {
    return readResult.manifest;
  }

  const manifest = {
    ...readResult.manifest,
    updatedAt: now ?? new Date().toISOString()
  };
  await writeManifest(manifestPath, manifest);
  return manifest;
}

async function writeManifest(path: string, manifest: LocalWorkspaceManifest): Promise<void> {
  await assertJsonSchemaBeforeWrite({
    value: manifest,
    schemaFile: "workspace-manifest.schema.json",
    artifactName: "Workspace manifest"
  });
  await writeJsonFileAtomic(path, manifest);
}

function normalizeWorkspaceManifest(manifest: LocalWorkspaceManifest): LocalWorkspaceManifestReadResult {
  const sourceDirectories = manifest.directories ?? {};
  const addedDirectories = workspaceDirectoryNames().filter(
    (directory) => !Object.prototype.hasOwnProperty.call(sourceDirectories, directory)
  );

  return {
    manifest: {
      ...manifest,
      directories: {
        ...DEFAULT_WORKSPACE_DIRECTORIES,
        ...sourceDirectories
      }
    },
    addedDirectories
  };
}

function createManifestRepair(
  addedDirectories: LocalWorkspaceDirectory[],
  applied: boolean
): LocalWorkspaceManifestRepair | undefined {
  return addedDirectories.length > 0
    ? {
        applied,
        addedDirectories
      }
    : undefined;
}

function workspaceDirectoryNames(): LocalWorkspaceDirectory[] {
  return Object.keys(DEFAULT_WORKSPACE_DIRECTORIES) as LocalWorkspaceDirectory[];
}

function validateWorkspaceManifest(manifest: LocalWorkspaceManifest, root: string): void {
  if (manifest.schemaVersion !== "truth-harness.workspace.v0") {
    throw new Error(`Unsupported workspace manifest schema: ${JSON.stringify(manifest.schemaVersion)}`);
  }

  for (const directory of Object.values(manifest.directories)) {
    resolveWorkspaceDirectory(root, directory);
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

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

export const LEAN_PROJECT_INSPECTION_SCHEMA_VERSION = "truth-harness.lean-project-inspection.v0";

export type LeanProjectReadiness = "ready" | "partial" | "missing";

export interface LeanProjectInspectionInput {
  rootPath: string;
  projectPath?: string;
  maxLeanFiles?: number;
}

export interface LeanProjectInspection {
  schemaVersion: typeof LEAN_PROJECT_INSPECTION_SCHEMA_VERSION;
  inspectedAt: string;
  localOnly: true;
  networkAccess: "none";
  projectPath: string;
  readiness: LeanProjectReadiness;
  files: {
    leanToolchain?: LeanProjectFileSummary;
    lakefileLean?: LeanProjectFileSummary;
    lakefileToml?: LeanProjectFileSummary;
    lakeManifest?: LeanProjectFileSummary;
    leanFiles: {
      total: number;
      sample: LeanProjectFileSummary[];
      truncated: boolean;
    };
  };
  toolchain?: {
    source: string;
    channel: string;
    pinned: boolean;
  };
  mathlib: {
    likelyUsesMathlib: boolean;
    evidence: string[];
  };
  trustBoundary: {
    inspectionIsNotProof: true;
    noLeanExecution: true;
    noNetworkAccess: true;
    provedRequiresProofCheckRecord: true;
  };
  warnings: string[];
  nextActions: string[];
}

export interface LeanProjectFileSummary {
  path: string;
  byteLength: number;
}

const DEFAULT_MAX_LEAN_FILES = 40;

export async function inspectLeanProject(input: LeanProjectInspectionInput): Promise<LeanProjectInspection> {
  const root = resolve(input.rootPath);
  const projectRoot = resolveUnderRoot(root, input.projectPath ?? ".");
  const projectStat = await stat(projectRoot);
  if (!projectStat.isDirectory()) {
    throw new Error(`Lean project path is not a directory: ${input.projectPath ?? "."}`);
  }

  const maxLeanFiles = Math.max(1, Math.floor(input.maxLeanFiles ?? DEFAULT_MAX_LEAN_FILES));
  const [leanToolchain, lakefileLean, lakefileToml, lakeManifest, leanFiles] = await Promise.all([
    summarizeFileIfPresent(root, join(projectRoot, "lean-toolchain")),
    summarizeFileIfPresent(root, join(projectRoot, "lakefile.lean")),
    summarizeFileIfPresent(root, join(projectRoot, "lakefile.toml")),
    summarizeFileIfPresent(root, join(projectRoot, "lake-manifest.json")),
    collectLeanFiles(root, projectRoot, maxLeanFiles)
  ]);
  const toolchain = leanToolchain ? await readLeanToolchain(projectRoot) : undefined;
  const mathlib = await detectMathlib(projectRoot, {
    lakefileLean: Boolean(lakefileLean),
    lakefileToml: Boolean(lakefileToml),
    lakeManifest: Boolean(lakeManifest)
  });
  const hasLakefile = Boolean(lakefileLean || lakefileToml);
  const hasLeanFiles = leanFiles.total > 0;
  const readiness = leanToolchain && hasLakefile && hasLeanFiles ? "ready" : hasLeanFiles || hasLakefile || leanToolchain ? "partial" : "missing";

  return {
    schemaVersion: LEAN_PROJECT_INSPECTION_SCHEMA_VERSION,
    inspectedAt: new Date().toISOString(),
    localOnly: true,
    networkAccess: "none",
    projectPath: toPortablePath(relative(root, projectRoot)) || ".",
    readiness,
    files: {
      ...(leanToolchain ? { leanToolchain } : {}),
      ...(lakefileLean ? { lakefileLean } : {}),
      ...(lakefileToml ? { lakefileToml } : {}),
      ...(lakeManifest ? { lakeManifest } : {}),
      leanFiles
    },
    ...(toolchain ? { toolchain } : {}),
    mathlib,
    trustBoundary: {
      inspectionIsNotProof: true,
      noLeanExecution: true,
      noNetworkAccess: true,
      provedRequiresProofCheckRecord: true
    },
    warnings: buildWarnings({ readiness, leanToolchain: Boolean(leanToolchain), hasLakefile, hasLeanFiles, lakeManifest: Boolean(lakeManifest) }),
    nextActions: buildNextActions({ readiness, leanToolchain: Boolean(leanToolchain), hasLakefile, hasLeanFiles, lakeManifest: Boolean(lakeManifest) })
  };
}

async function summarizeFileIfPresent(root: string, path: string): Promise<LeanProjectFileSummary | undefined> {
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile()) {
      return undefined;
    }

    return {
      path: toPortablePath(relative(root, path)),
      byteLength: fileStat.size
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function collectLeanFiles(
  root: string,
  projectRoot: string,
  maxLeanFiles: number
): Promise<LeanProjectInspection["files"]["leanFiles"]> {
  const sample: LeanProjectFileSummary[] = [];
  let total = 0;

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > 5) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === ".lake" || entry.name === "node_modules" || entry.name === ".truth-harness") {
        continue;
      }

      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path, depth + 1);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".lean") || entry.name === "lakefile.lean") {
        continue;
      }

      total += 1;
      if (sample.length < maxLeanFiles) {
        const fileStat = await stat(path);
        sample.push({
          path: toPortablePath(relative(root, path)),
          byteLength: fileStat.size
        });
      }
    }
  }

  await walk(projectRoot, 0);

  return {
    total,
    sample: sample.sort((left, right) => left.path.localeCompare(right.path)),
    truncated: total > sample.length
  };
}

async function readLeanToolchain(projectRoot: string): Promise<LeanProjectInspection["toolchain"] | undefined> {
  const raw = (await readFile(join(projectRoot, "lean-toolchain"), "utf8")).trim();
  if (!raw) {
    return undefined;
  }

  return {
    source: "lean-toolchain",
    channel: raw,
    pinned: !/^(?:stable|nightly)$/u.test(raw)
  };
}

async function detectMathlib(
  projectRoot: string,
  files: { lakefileLean: boolean; lakefileToml: boolean; lakeManifest: boolean }
): Promise<LeanProjectInspection["mathlib"]> {
  const evidence: string[] = [];
  for (const file of ["lakefile.lean", "lakefile.toml", "lake-manifest.json"]) {
    if ((file === "lakefile.lean" && !files.lakefileLean) || (file === "lakefile.toml" && !files.lakefileToml) || (file === "lake-manifest.json" && !files.lakeManifest)) {
      continue;
    }

    const text = await readFile(join(projectRoot, file), "utf8");
    if (/\bmathlib\b/iu.test(text)) {
      evidence.push(file);
    }
  }

  return {
    likelyUsesMathlib: evidence.length > 0,
    evidence
  };
}

function buildWarnings(input: {
  readiness: LeanProjectReadiness;
  leanToolchain: boolean;
  hasLakefile: boolean;
  hasLeanFiles: boolean;
  lakeManifest: boolean;
}): string[] {
  const warnings = [
    "Lean project inspection reads local files only; it does not run Lean, Lake, or network commands.",
    "This inspection cannot support a `proved` label. Only a proof-check record accepted by Lean can do that."
  ];

  if (!input.leanToolchain) {
    warnings.push("No lean-toolchain file found. Reproducible proof work should pin the Lean toolchain.");
  }
  if (!input.hasLakefile) {
    warnings.push("No lakefile.lean or lakefile.toml found. Multi-file Lean/mathlib work should use Lake project metadata.");
  }
  if (!input.hasLeanFiles) {
    warnings.push("No .lean files were found in the inspected project path.");
  }
  if (input.hasLakefile && !input.lakeManifest) {
    warnings.push("No lake-manifest.json found. Dependency revisions may be unresolved until Lake writes a manifest.");
  }

  return warnings;
}

function buildNextActions(input: {
  readiness: LeanProjectReadiness;
  leanToolchain: boolean;
  hasLakefile: boolean;
  hasLeanFiles: boolean;
  lakeManifest: boolean;
}): string[] {
  const actions: string[] = [];
  if (!input.leanToolchain) {
    actions.push("Add a lean-toolchain file pinned to the intended Lean release before claiming reproducible proof environment readiness.");
  }
  if (!input.hasLakefile) {
    actions.push("Add lakefile.lean or lakefile.toml when the proof lane moves beyond single-file Lean checks.");
  }
  if (!input.hasLeanFiles) {
    actions.push("Add at least one workspace-local .lean proof artifact, then run `truth-harness proof check <file> --write`.");
  }
  if (input.hasLakefile && !input.lakeManifest) {
    actions.push("Generate and review lake-manifest.json in a controlled environment before relying on dependency revisions.");
  }
  if (input.readiness === "ready") {
    actions.push("Run `truth-harness proof check <workspace-local.lean> --write` for the concrete statement that should support `proved`.");
  }

  return actions;
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace root: ${path}`);
  }

  return target;
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

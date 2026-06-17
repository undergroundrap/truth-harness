import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  createCredibilityPack,
  type CreateCredibilityPackInput,
  type CredibilityPack,
  type CredibilityPackStatus
} from "./credibility-pack.js";
import { writeFileAtomic, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata } from "./types.js";
import { refreshWorkspaceCatalogArtifact } from "./workspace-catalog.js";
import type { WorkspaceSnapshotEntry, WorkspaceSnapshotEntryKind } from "./workspace-snapshot.js";

export interface CredibilityBundleFile {
  sourcePath: string;
  bundledPath: string;
  kind: WorkspaceSnapshotEntryKind;
  bytes: number;
  sha256: string;
  schemaVersion?: string;
  artifactId?: string;
}

export interface CredibilityBundleGeneratedFile {
  role: "credibility-pack-json" | "credibility-pack-markdown" | "readme";
  bundledPath: string;
  bytes: number;
  sha256: string;
}

export interface CredibilityBundleManifest {
  schemaVersion: "truth-harness.credibility-bundle.v0";
  bundleId: string;
  title: string;
  createdAt: string;
  projectId: string;
  workspacePath: string;
  bundlePath: string;
  localOnly: true;
  networkAccess: "none";
  privacy: PrivacyMetadata;
  packId: string;
  packStatus: CredibilityPackStatus;
  packSummary: CredibilityPack["summary"];
  embeddedSnapshotId: string;
  files: CredibilityBundleFile[];
  generatedFiles: CredibilityBundleGeneratedFile[];
  summary: {
    artifactFiles: number;
    generatedFiles: number;
    totalFiles: number;
    artifactBytes: number;
    generatedBytes: number;
    totalBytes: number;
    copiedSnapshotFiles: number;
    skippedBundleFiles: number;
  };
  reviewerCommands: {
    verifyBundle: string;
    validateWorkspace: string;
    verifyEngines: string;
    runAdversarialBenchmark: string;
    reviewWorkspace: string;
    reproducePack: string;
  };
  limitations: string[];
  warnings: string[];
}

export interface CredibilityBundleWriteResult {
  manifest: CredibilityBundleManifest;
  pack: CredibilityPack;
  bundleDir: string;
  manifestPath: string;
  packJsonPath: string;
  packMarkdownPath: string;
  readmePath: string;
}

export interface WriteCredibilityBundleInput extends CreateCredibilityPackInput {}

export interface VerifyCredibilityBundleInput {
  rootPath: string;
  bundleRef: string;
  now?: string;
}

export interface CredibilityBundleVerificationEntry {
  path: string;
  expectedBytes?: number;
  actualBytes?: number;
  expectedSha256?: string;
  actualSha256?: string;
  kind?: WorkspaceSnapshotEntryKind | "generated";
  sourcePath?: string;
  bundledPath?: string;
  artifactId?: string;
  schemaVersion?: string;
}

export interface CredibilityBundleVerification {
  schemaVersion: "truth-harness.credibility-bundle-verification.v0";
  bundleId: string;
  packId: string;
  verifiedAt: string;
  bundlePath: string;
  passed: boolean;
  sourceMatchesWorkspace: boolean;
  checkedBundleFiles: number;
  checkedSourceFiles: number;
  missingBundleFiles: CredibilityBundleVerificationEntry[];
  changedBundleFiles: CredibilityBundleVerificationEntry[];
  missingSourceFiles: CredibilityBundleVerificationEntry[];
  changedSourceFiles: CredibilityBundleVerificationEntry[];
  warnings: string[];
}

const CREDIBILITY_BUNDLE_SCHEMA_VERSION = "truth-harness.credibility-bundle.v0" as const;
const CREDIBILITY_BUNDLE_VERIFY_SCHEMA_VERSION = "truth-harness.credibility-bundle-verification.v0" as const;

export async function writeCredibilityBundle(input: WriteCredibilityBundleInput): Promise<CredibilityBundleWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const pack = await createCredibilityPack({
    ...input,
    rootPath: status.root
  });
  const eligibleEntries = pack.embeddedSnapshot.entries.filter((entry) => !isCredibilityBundlePath(entry.path));
  const skippedBundleFiles = pack.embeddedSnapshot.entries.length - eligibleEntries.length;
  const bundleSeed = {
    packId: pack.packId,
    snapshotId: pack.embeddedSnapshot.snapshotId,
    entries: eligibleEntries.map((entry) => ({
      path: entry.path,
      bytes: entry.bytes,
      sha256: entry.sha256
    }))
  };
  const bundleId = `cbun_${stableHash(bundleSeed).slice(0, 16)}`;
  const findingsDir = resolve(status.root, status.manifest.directories.findings);
  const baseName = `${pack.createdAt.slice(0, 10)}-${bundleId}-credibility-bundle`;
  const bundleDir = join(findingsDir, baseName);
  const artifactsDir = join(bundleDir, "artifacts");
  await mkdir(artifactsDir, { recursive: true });

  const files: CredibilityBundleFile[] = [];
  for (const entry of eligibleEntries) {
    files.push(await copySnapshotEntry(status.root, artifactsDir, entry));
  }

  const packJsonPath = join(bundleDir, "credibility-pack.json");
  const packMarkdownPath = join(bundleDir, "credibility-pack.md");
  const readmePath = join(bundleDir, "README.md");
  const readme = renderCredibilityBundleReadme({
    bundleId,
    bundleDir,
    pack,
    files
  });
  await writeJsonFileAtomic(packJsonPath, pack);
  await writeFileAtomic(packMarkdownPath, pack.markdown, "utf8");
  await writeFileAtomic(readmePath, readme, "utf8");

  const generatedFiles = await Promise.all([
    generatedFileIdentity(bundleDir, packJsonPath, "credibility-pack-json"),
    generatedFileIdentity(bundleDir, packMarkdownPath, "credibility-pack-markdown"),
    generatedFileIdentity(bundleDir, readmePath, "readme")
  ]);
  const artifactBytes = files.reduce((total, file) => total + file.bytes, 0);
  const generatedBytes = generatedFiles.reduce((total, file) => total + file.bytes, 0);
  const manifest: CredibilityBundleManifest = {
    schemaVersion: CREDIBILITY_BUNDLE_SCHEMA_VERSION,
    bundleId,
    title: "Truth Harness Portable Reviewer Bundle",
    createdAt: pack.createdAt,
    projectId: pack.projectId,
    workspacePath: status.root,
    bundlePath: bundleDir,
    localOnly: true,
    networkAccess: "none",
    privacy: pack.privacy,
    packId: pack.packId,
    packStatus: pack.status,
    packSummary: pack.summary,
    embeddedSnapshotId: pack.embeddedSnapshot.snapshotId,
    files,
    generatedFiles,
    summary: {
      artifactFiles: files.length,
      generatedFiles: generatedFiles.length,
      totalFiles: files.length + generatedFiles.length,
      artifactBytes,
      generatedBytes,
      totalBytes: artifactBytes + generatedBytes,
      copiedSnapshotFiles: files.length,
      skippedBundleFiles
    },
    reviewerCommands: {
      verifyBundle: `truth-harness workspace verify-credibility-bundle . ${toPortablePath(relative(status.root, bundleDir))}`,
      validateWorkspace: pack.reviewerCommands.validateWorkspace,
      verifyEngines: pack.reviewerCommands.verifyEngines,
      runAdversarialBenchmark: pack.reviewerCommands.runAdversarialBenchmark,
      reviewWorkspace: pack.reviewerCommands.reviewWorkspace,
      reproducePack: pack.reviewerCommands.reproducePack
    },
    limitations: [
      "This bundle verifies file identity and reviewer reproducibility boundaries; it does not prove every artifact is true.",
      "Copied artifacts are canonical local Truth Harness files from the embedded snapshot, excluding prior credibility-bundle directories to avoid recursive bundle growth.",
      "A passing bundle verification means the bundle contents still match its manifest. Source workspace drift is reported separately.",
      "`proved` remains reserved for accepted proof-checker output over a concrete formal artifact."
    ],
    warnings: pack.warnings
  };
  const manifestPath = join(bundleDir, "manifest.json");
  await writeJsonFileAtomic(manifestPath, manifest);
  await refreshWorkspaceCatalogArtifact({
    rootPath: status.root,
    path: relative(status.root, manifestPath),
    kind: "findings",
    now: pack.createdAt,
    staleReason: "credibility bundle written"
  });

  return {
    manifest,
    pack,
    bundleDir,
    manifestPath,
    packJsonPath,
    packMarkdownPath,
    readmePath
  };
}

export async function verifyCredibilityBundle(input: VerifyCredibilityBundleInput): Promise<CredibilityBundleVerification> {
  const status = await requireLocalWorkspace(input.rootPath);
  const { manifest, bundleDir } = await readCredibilityBundleManifest(status, input.bundleRef);
  const missingBundleFiles: CredibilityBundleVerificationEntry[] = [];
  const changedBundleFiles: CredibilityBundleVerificationEntry[] = [];
  const missingSourceFiles: CredibilityBundleVerificationEntry[] = [];
  const changedSourceFiles: CredibilityBundleVerificationEntry[] = [];

  for (const file of manifest.files) {
    const bundlePath = resolveUnderRoot(bundleDir, file.bundledPath, "Credibility bundle file path escapes bundle root");
    const bundleIdentity = await fileIdentity(bundlePath);
    if (!bundleIdentity) {
      missingBundleFiles.push(toBundleExpectedEntry(file));
    } else if (bundleIdentity.bytes !== file.bytes || bundleIdentity.sha256 !== file.sha256) {
      changedBundleFiles.push({
        ...toBundleExpectedEntry(file),
        actualBytes: bundleIdentity.bytes,
        actualSha256: bundleIdentity.sha256
      });
    }

    const sourcePath = resolveUnderRoot(status.root, file.sourcePath, "Credibility bundle source path escapes workspace root");
    const sourceIdentity = await fileIdentity(sourcePath);
    if (!sourceIdentity) {
      missingSourceFiles.push(toSourceExpectedEntry(file));
    } else if (sourceIdentity.bytes !== file.bytes || sourceIdentity.sha256 !== file.sha256) {
      changedSourceFiles.push({
        ...toSourceExpectedEntry(file),
        actualBytes: sourceIdentity.bytes,
        actualSha256: sourceIdentity.sha256
      });
    }
  }

  for (const file of manifest.generatedFiles) {
    const bundlePath = resolveUnderRoot(bundleDir, file.bundledPath, "Credibility bundle generated path escapes bundle root");
    const bundleIdentity = await fileIdentity(bundlePath);
    if (!bundleIdentity) {
      missingBundleFiles.push({
        path: file.bundledPath,
        bundledPath: file.bundledPath,
        kind: "generated",
        expectedBytes: file.bytes,
        expectedSha256: file.sha256
      });
    } else if (bundleIdentity.bytes !== file.bytes || bundleIdentity.sha256 !== file.sha256) {
      changedBundleFiles.push({
        path: file.bundledPath,
        bundledPath: file.bundledPath,
        kind: "generated",
        expectedBytes: file.bytes,
        actualBytes: bundleIdentity.bytes,
        expectedSha256: file.sha256,
        actualSha256: bundleIdentity.sha256
      });
    }
  }

  return {
    schemaVersion: CREDIBILITY_BUNDLE_VERIFY_SCHEMA_VERSION,
    bundleId: manifest.bundleId,
    packId: manifest.packId,
    verifiedAt: input.now ?? new Date().toISOString(),
    bundlePath: bundleDir,
    passed: missingBundleFiles.length === 0 && changedBundleFiles.length === 0,
    sourceMatchesWorkspace: missingSourceFiles.length === 0 && changedSourceFiles.length === 0,
    checkedBundleFiles: manifest.files.length + manifest.generatedFiles.length,
    checkedSourceFiles: manifest.files.length,
    missingBundleFiles,
    changedBundleFiles,
    missingSourceFiles,
    changedSourceFiles,
    warnings: [
      "Bundle verification checks copied file identity, not mathematical, scientific, medical, legal, or patent truth.",
      "Source workspace drift is reported separately from bundle integrity because a valid exported bundle can outlive later local edits."
    ]
  };
}

function renderCredibilityBundleReadme(input: {
  bundleId: string;
  bundleDir: string;
  pack: CredibilityPack;
  files: CredibilityBundleFile[];
}): string {
  const bundleRef = toPortablePath(relative(input.pack.workspacePath, input.bundleDir));
  const lines = [
    "# Truth Harness Portable Reviewer Bundle",
    "",
    `Bundle: \`${input.bundleId}\``,
    `Pack: \`${input.pack.packId}\``,
    `Status: \`${input.pack.status}\``,
    `Created: ${input.pack.createdAt}`,
    `Project: \`${input.pack.projectId}\``,
    "",
    "## Verify",
    "",
    "```bash",
    `truth-harness workspace verify-credibility-bundle . ${bundleRef}`,
    "```",
    "",
    "## Contents",
    "",
    "- `manifest.json`: bundle manifest, hashes, source paths, and reviewer commands.",
    "- `credibility-pack.json`: professor credibility pack generated from the same local workspace state.",
    "- `credibility-pack.md`: human-readable credibility pack.",
    "- `artifacts/`: copied canonical Truth Harness workspace artifacts from the embedded snapshot.",
    "",
    "## Boundary",
    "",
    "This bundle is local-only and replay-oriented. It proves file identity against recorded hashes, not the truth of every claim.",
    "Trust labels still come only from their original receipts, proof checks, SMT/CAS records, simulations, source records, or expert reviews.",
    "",
    "## Summary",
    "",
    `- Copied artifacts: ${input.files.length}`,
    `- Snapshot: \`${input.pack.embeddedSnapshot.snapshotId}\``,
    `- Engine gates: ${input.pack.summary.concreteEngineGates} concrete, ${input.pack.summary.requiredEngineGates} required`,
    `- Review queue: ${input.pack.summary.reviewItems} items (${input.pack.summary.criticalReviewItems} critical)`,
    ""
  ];

  return `${lines.join("\n")}\n`;
}

async function copySnapshotEntry(root: string, artifactsDir: string, entry: WorkspaceSnapshotEntry): Promise<CredibilityBundleFile> {
  const sourcePath = resolveUnderRoot(root, entry.path, "Credibility bundle source path escapes workspace root");
  const bundledPath = toPortablePath(join("artifacts", entry.path));
  const targetPath = resolveUnderRoot(dirname(artifactsDir), bundledPath, "Credibility bundle target path escapes bundle root");
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  const copied = await requireFileIdentity(targetPath);

  if (copied.bytes !== entry.bytes || copied.sha256 !== entry.sha256) {
    throw new Error(`Copied credibility bundle file does not match snapshot hash: ${entry.path}`);
  }

  return {
    sourcePath: entry.path,
    bundledPath,
    kind: entry.kind,
    bytes: copied.bytes,
    sha256: copied.sha256,
    schemaVersion: entry.schemaVersion,
    artifactId: entry.artifactId
  };
}

async function generatedFileIdentity(
  bundleDir: string,
  path: string,
  role: CredibilityBundleGeneratedFile["role"]
): Promise<CredibilityBundleGeneratedFile> {
  const identity = await requireFileIdentity(path);
  return {
    role,
    bundledPath: toPortablePath(relative(bundleDir, path)),
    bytes: identity.bytes,
    sha256: identity.sha256
  };
}

async function readCredibilityBundleManifest(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  bundleRef: string
): Promise<{ manifest: CredibilityBundleManifest; bundleDir: string; manifestPath: string }> {
  const ref = requireText(bundleRef, "Credibility bundle ref is required.");

  if (isBundleId(ref)) {
    const findingsDir = resolve(status.root, status.manifest.directories.findings);
    const manifestPath = await findBundleManifestById(findingsDir, ref);
    const manifest = parseCredibilityBundleManifest(await readFile(manifestPath, "utf8"));
    return {
      manifest,
      bundleDir: dirname(manifestPath),
      manifestPath
    };
  }

  const bundleDir = isAbsolute(ref) ? resolve(ref) : resolveUnderRoot(status.root, ref, "Credibility bundle path escapes workspace root");
  const manifestPath = join(bundleDir, "manifest.json");
  const manifest = parseCredibilityBundleManifest(await readFile(manifestPath, "utf8"));
  return {
    manifest,
    bundleDir,
    manifestPath
  };
}

async function findBundleManifestById(findingsDir: string, bundleId: string): Promise<string> {
  const candidates: string[] = [];

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

    for (const dirent of dirents) {
      const path = join(directory, dirent.name);
      if (dirent.isDirectory()) {
        await walk(path);
      } else if (dirent.isFile() && dirent.name === "manifest.json") {
        candidates.push(path);
      }
    }
  }

  await walk(findingsDir);
  for (const path of candidates) {
    const manifest = parseCredibilityBundleManifest(await readFile(path, "utf8"));
    if (manifest.bundleId === bundleId) {
      return path;
    }
  }

  throw new Error(`Credibility bundle not found: ${bundleId}`);
}

function parseCredibilityBundleManifest(raw: string): CredibilityBundleManifest {
  const parsed = JSON.parse(raw) as CredibilityBundleManifest;
  if (parsed.schemaVersion !== CREDIBILITY_BUNDLE_SCHEMA_VERSION) {
    throw new Error(`Unsupported credibility bundle schema: ${JSON.stringify(parsed.schemaVersion)}`);
  }
  if (!isBundleId(parsed.bundleId)) {
    throw new Error(`Invalid credibility bundle id: ${JSON.stringify(parsed.bundleId)}`);
  }
  return parsed;
}

function toBundleExpectedEntry(file: CredibilityBundleFile): CredibilityBundleVerificationEntry {
  return {
    path: file.bundledPath,
    bundledPath: file.bundledPath,
    sourcePath: file.sourcePath,
    kind: file.kind,
    expectedBytes: file.bytes,
    expectedSha256: file.sha256,
    artifactId: file.artifactId,
    schemaVersion: file.schemaVersion
  };
}

function toSourceExpectedEntry(file: CredibilityBundleFile): CredibilityBundleVerificationEntry {
  return {
    path: file.sourcePath,
    bundledPath: file.bundledPath,
    sourcePath: file.sourcePath,
    kind: file.kind,
    expectedBytes: file.bytes,
    expectedSha256: file.sha256,
    artifactId: file.artifactId,
    schemaVersion: file.schemaVersion
  };
}

async function requireFileIdentity(path: string): Promise<{ bytes: number; sha256: string }> {
  const identity = await fileIdentity(path);
  if (!identity) {
    throw new Error(`Expected file is missing: ${path}`);
  }
  return identity;
}

async function fileIdentity(path: string): Promise<{ bytes: number; sha256: string } | undefined> {
  try {
    const bytes = await readFile(path);
    const stats = await stat(path);
    return {
      bytes: stats.size,
      sha256: sha256(bytes)
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before creating a credibility bundle.");
  }
  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}. Run \`truth-harness workspace repair\`.`);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function resolveUnderRoot(root: string, path: string, message: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`${message}: ${JSON.stringify(path)}`);
  }

  return target;
}

function isCredibilityBundlePath(path: string): boolean {
  return /^\.truth-harness\/findings\/[^/]+-credibility-bundle\//u.test(path);
}

function isBundleId(value: string): boolean {
  return /^cbun_[a-f0-9]{16}$/u.test(value);
}

function requireText(value: string | undefined, message: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
}

function toPortablePath(value: string): string {
  return value.split(sep).join("/");
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

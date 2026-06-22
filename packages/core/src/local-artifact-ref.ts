import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

export interface LocalArtifactRef {
  path: string;
  role: string;
  source: string;
  sizeBytes?: number;
  sha256?: string;
  sha256Scope?: "file";
  citation?: string;
}

export function localArtifactPathsFromString(value: string): string[] {
  const paths = new Set<string>();
  const pattern = /(?:[A-Za-z]:[\\/][^\s"'`<>|]*?\.truth-harness[^\s"'`<>|]*|\.truth-harness[\\/][^\s"'`<>|]+)/gu;
  for (const match of value.matchAll(pattern)) {
    const normalized = normalizeLocalArtifactPath(match[0]);
    if (normalized) {
      paths.add(normalized);
    }
  }
  return [...paths];
}

export function normalizeLocalArtifactPath(value: string): string | undefined {
  let normalized = value.trim().replace(/\\/gu, "/");
  normalized = normalized.replace(/[),.;:\]]+$/gu, "");
  const marker = ".truth-harness/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) {
    return undefined;
  }
  return normalized.slice(markerIndex);
}

export function uniqueLocalArtifactRefs<T extends LocalArtifactRef>(refs: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const ref of refs) {
    const normalized = normalizeLocalArtifactPath(ref.path);
    if (!normalized) {
      continue;
    }
    const key = `${ref.role}:${normalized}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push({ ...ref, path: normalized });
  }
  return unique;
}

export async function enrichLocalArtifactRefs<T extends LocalArtifactRef>(
  rootPath: string,
  refs: T[]
): Promise<T[]> {
  return Promise.all(refs.map((ref) => enrichLocalArtifactRef(rootPath, ref)));
}

export async function enrichLocalArtifactRef<T extends LocalArtifactRef>(
  rootPath: string,
  ref: T
): Promise<T> {
  const artifactPath = normalizeLocalArtifactPath(ref.path);
  if (!artifactPath) {
    return ref;
  }

  try {
    const absolutePath = resolveLocalArtifactPath(rootPath, artifactPath);
    const artifactStat = await stat(absolutePath);
    if (!artifactStat.isFile()) {
      return { ...ref, path: artifactPath };
    }
    const sha256 = await sha256FileHex(absolutePath);
    return {
      ...ref,
      path: artifactPath,
      sizeBytes: artifactStat.size,
      sha256,
      sha256Scope: "file",
      citation: `${artifactPath} sha256:${sha256}`
    };
  } catch {
    return { ...ref, path: artifactPath };
  }
}

export function workspaceRelativeArtifactPath(rootPath: string, path: string): string {
  return relative(resolve(rootPath), resolve(path)).replace(/\\/gu, "/");
}

function resolveLocalArtifactPath(rootPath: string, artifactPath: string): string {
  const root = resolve(rootPath);
  const target = resolve(root, artifactPath);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error("Local artifact path escapes the project root.");
  }
  return target;
}

function sha256FileHex(path: string): Promise<string> {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

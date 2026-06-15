import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { withWorkspaceLock, writeJsonFileAtomic } from "./fs-util.js";
import { getLocalWorkspaceStatus, LOCAL_WORKSPACE_DIR, type LocalWorkspaceStatus } from "./local-workspace.js";
import { stableHash } from "./stable-hash.js";
import type { PrivacyMetadata, TrustLabel } from "./types.js";

export const LOCAL_CORPUS_INDEX = "local-corpus.json";
export const SUPPORTED_CORPUS_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".text"]);

export interface LocalCorpusDocument {
  documentId: string;
  path: string;
  title: string;
  mimeType: "text/markdown" | "text/plain";
  contentHash: string;
  ingestedAt: string;
  chunkIds: string[];
}

export interface LocalCorpusChunk {
  chunkId: string;
  documentId: string;
  ordinal: number;
  text: string;
  tokenCounts: Record<string, number>;
}

export interface LocalCorpusIndex {
  schemaVersion: "truth-harness.corpus.v0";
  projectId: string;
  createdAt: string;
  updatedAt: string;
  privacy: PrivacyMetadata;
  documents: LocalCorpusDocument[];
  chunks: LocalCorpusChunk[];
}

export interface LocalCorpusIngestInput {
  rootPath: string;
  paths: string[];
  now?: string;
  maxChunkChars?: number;
}

export interface LocalCorpusIngestResult {
  indexPath: string;
  ingestedDocuments: LocalCorpusDocument[];
  totalDocuments: number;
  totalChunks: number;
}

export interface LocalCorpusSearchInput {
  rootPath: string;
  query: string;
  limit?: number;
}

export interface LocalCorpusSearchHit {
  trust: Extract<TrustLabel, "source-cited">;
  score: number;
  documentId: string;
  chunkId: string;
  title: string;
  path: string;
  ordinal: number;
  text: string;
  matchedTerms: string[];
  citation: {
    documentId: string;
    chunkId: string;
    path: string;
  };
}

export interface LocalCorpusSearchResult {
  indexPath: string;
  query: string;
  totalChunks: number;
  hits: LocalCorpusSearchHit[];
}

export async function ingestLocalCorpus(input: LocalCorpusIngestInput): Promise<LocalCorpusIngestResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const now = input.now ?? new Date().toISOString();
  const indexPath = localCorpusIndexPath(status);
  return withWorkspaceLock(status.root, "local-corpus-index", async () => {
    const existing = await readLocalCorpusIndex(status, now);
    const files = await resolveCorpusFiles(status.root, input.paths);
    const ingestedDocuments: LocalCorpusDocument[] = [];
    let documents = existing.documents;
    let chunks = existing.chunks;

    for (const file of files) {
      const relativePath = toPortablePath(relative(status.root, file));
      const content = await readFile(file, "utf8");
      const documentId = `doc_${stableHash({ path: relativePath }).slice(0, 16)}`;
      const contentHash = stableHash(content);
      const chunkTexts = chunkContent(content, input.maxChunkChars ?? 1400);
      const documentChunks = chunkTexts.map((text, ordinal) => {
        const chunkId = `chunk_${stableHash({ documentId, ordinal, text }).slice(0, 16)}`;
        return {
          chunkId,
          documentId,
          ordinal,
          text,
          tokenCounts: countTokens(text)
        };
      });
      const document: LocalCorpusDocument = {
        documentId,
        path: relativePath,
        title: titleFromContent(content, file),
        mimeType: mimeTypeFor(file),
        contentHash,
        ingestedAt: now,
        chunkIds: documentChunks.map((chunk) => chunk.chunkId)
      };

      documents = documents.filter((candidate) => candidate.documentId !== documentId);
      chunks = chunks.filter((candidate) => candidate.documentId !== documentId);
      documents.push(document);
      chunks.push(...documentChunks);
      ingestedDocuments.push(document);
    }

    const nextIndex: LocalCorpusIndex = {
      ...existing,
      updatedAt: now,
      documents: documents.sort((left, right) => left.path.localeCompare(right.path)),
      chunks: chunks.sort((left, right) => left.documentId.localeCompare(right.documentId) || left.ordinal - right.ordinal)
    };

    await mkdir(resolve(status.root, status.manifest.directories.indexes), { recursive: true });
    await writeJsonFileAtomic(indexPath, nextIndex);

    return {
      indexPath,
      ingestedDocuments,
      totalDocuments: nextIndex.documents.length,
      totalChunks: nextIndex.chunks.length
    };
  });
}

export async function searchLocalCorpus(input: LocalCorpusSearchInput): Promise<LocalCorpusSearchResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const indexPath = localCorpusIndexPath(status);
  const index = await readLocalCorpusIndex(status, new Date().toISOString());
  const queryTerms = tokenize(input.query);

  if (queryTerms.length === 0) {
    throw new Error("Local corpus search query must contain at least one searchable term.");
  }

  const documentById = new Map(index.documents.map((document) => [document.documentId, document]));
  const documentFrequency = new Map<string, number>();

  for (const chunk of index.chunks) {
    for (const term of new Set(Object.keys(chunk.tokenCounts))) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const hits = index.chunks
    .map((chunk) => scoreChunk(chunk, queryTerms, documentFrequency, index.chunks.length))
    .filter((scored) => scored.score > 0)
    .sort((left, right) => right.score - left.score || left.chunk.ordinal - right.chunk.ordinal)
    .slice(0, input.limit ?? 5)
    .map(({ chunk, score, matchedTerms }) => {
      const document = documentById.get(chunk.documentId);
      if (!document) {
        throw new Error(`Corpus index chunk references missing document: ${chunk.documentId}`);
      }

      return {
        trust: "source-cited" as const,
        score,
        documentId: document.documentId,
        chunkId: chunk.chunkId,
        title: document.title,
        path: document.path,
        ordinal: chunk.ordinal,
        text: chunk.text,
        matchedTerms,
        citation: {
          documentId: document.documentId,
          chunkId: chunk.chunkId,
          path: document.path
        }
      };
    });

  return {
    indexPath,
    query: input.query,
    totalChunks: index.chunks.length,
    hits
  };
}

async function requireLocalWorkspace(rootPath: string): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before using the local corpus.");
  }

  if (status.missingDirectories.length > 0) {
    throw new Error(`Truth Harness workspace is missing directories: ${status.missingDirectories.join(", ")}`);
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

async function readLocalCorpusIndex(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  now: string
): Promise<LocalCorpusIndex> {
  const indexPath = localCorpusIndexPath(status);
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as LocalCorpusIndex;
    if (parsed.schemaVersion !== "truth-harness.corpus.v0") {
      throw new Error(`Unsupported local corpus schema: ${JSON.stringify(parsed.schemaVersion)}`);
    }

    return parsed;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }

    return {
      schemaVersion: "truth-harness.corpus.v0",
      projectId: status.manifest.projectId,
      createdAt: now,
      updatedAt: now,
      privacy: status.manifest.privacy,
      documents: [],
      chunks: []
    };
  }
}

async function resolveCorpusFiles(root: string, paths: string[]): Promise<string[]> {
  if (paths.length === 0) {
    throw new Error("Provide at least one local file or directory to ingest.");
  }

  const files = new Set<string>();
  for (const path of paths) {
    const target = resolveUnderRoot(root, path);
    await collectCorpusFiles(target, files);
  }

  return [...files].sort();
}

async function collectCorpusFiles(target: string, files: Set<string>): Promise<void> {
  const stats = await stat(target);
  if (stats.isDirectory()) {
    if (basename(target) === LOCAL_WORKSPACE_DIR) {
      return;
    }

    const entries = await readdir(target);
    await Promise.all(entries.map(async (entry) => collectCorpusFiles(join(target, entry), files)));
    return;
  }

  if (!stats.isFile()) {
    return;
  }

  if (!SUPPORTED_CORPUS_EXTENSIONS.has(extname(target).toLowerCase())) {
    return;
  }

  files.add(target);
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Corpus path escapes workspace root: ${JSON.stringify(path)}`);
  }

  return target;
}

function localCorpusIndexPath(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }
): string {
  return resolve(status.root, status.manifest.directories.indexes, LOCAL_CORPUS_INDEX);
}

function chunkContent(content: string, maxChunkChars: number): string[] {
  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs.length > 0 ? paragraphs : [content.trim()]) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if (current.length + paragraph.length + 2 <= maxChunkChars) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }

    chunks.push(current);
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.flatMap((chunk) => splitLongChunk(chunk, maxChunkChars));
}

function splitLongChunk(chunk: string, maxChunkChars: number): string[] {
  if (chunk.length <= maxChunkChars) {
    return [chunk];
  }

  const parts: string[] = [];
  for (let index = 0; index < chunk.length; index += maxChunkChars) {
    parts.push(chunk.slice(index, index + maxChunkChars).trim());
  }

  return parts.filter(Boolean);
}

function scoreChunk(
  chunk: LocalCorpusChunk,
  queryTerms: string[],
  documentFrequency: Map<string, number>,
  totalChunks: number
): { chunk: LocalCorpusChunk; score: number; matchedTerms: string[] } {
  let score = 0;
  const matchedTerms: string[] = [];

  for (const term of queryTerms) {
    const termFrequency = chunk.tokenCounts[term] ?? 0;
    if (termFrequency === 0) {
      continue;
    }

    const idf = Math.log((1 + totalChunks) / (1 + (documentFrequency.get(term) ?? 0))) + 1;
    score += termFrequency * idf;
    matchedTerms.push(term);
  }

  return {
    chunk,
    score: Number(score.toFixed(6)),
    matchedTerms
  };
}

function countTokens(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of tokenize(text)) {
    counts[token] = (counts[token] ?? 0) + 1;
  }

  return counts;
}

function tokenize(text: string): string[] {
  return [...text.toLowerCase().matchAll(/[a-z0-9][a-z0-9_-]*/g)]
    .map((match) => match[0])
    .filter((token) => token.length > 1);
}

function titleFromContent(content: string, path: string): string {
  const heading = /^#\s+(.+)$/m.exec(content);
  return heading?.[1].trim() || basename(path);
}

function mimeTypeFor(path: string): LocalCorpusDocument["mimeType"] {
  const extension = extname(path).toLowerCase();
  return extension === ".md" || extension === ".markdown" ? "text/markdown" : "text/plain";
}

function toPortablePath(path: string): string {
  return path.replace(/\\/g, "/");
}

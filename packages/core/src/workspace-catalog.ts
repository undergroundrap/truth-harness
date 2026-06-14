import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import Database from "better-sqlite3";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import { validateWorkspaceArtifacts, type WorkspaceValidation, type WorkspaceValidationArtifact } from "./workspace-validation.js";
import type { TrustLabel } from "./types.js";

export const WORKSPACE_CATALOG_SCHEMA_VERSION = "truth-harness.catalog.v0";
export const WORKSPACE_CATALOG_FILE = "catalog.db";

export interface WorkspaceCatalogRebuildInput {
  rootPath: string;
  now?: string;
}

export interface WorkspaceCatalogRebuildResult {
  schemaVersion: "truth-harness.catalog-rebuild.v0";
  catalogSchemaVersion: typeof WORKSPACE_CATALOG_SCHEMA_VERSION;
  rebuiltAt: string;
  workspacePath: string;
  catalogPath: string;
  localOnly: true;
  networkAccess: "none";
  sourceOfTruth: "workspace-json";
  artifactCount: number;
  validArtifacts: number;
  invalidArtifacts: number;
  claimCount: number;
  routeCount: number;
  tagCount: number;
  refCount: number;
  ftsRows: number;
  validation: {
    passed: boolean;
    errors: number;
    warnings: number;
  };
  warnings: string[];
}

export interface WorkspaceCatalogStatus {
  schemaVersion: "truth-harness.catalog-status.v0";
  catalogSchemaVersion?: string;
  workspacePath: string;
  catalogPath: string;
  localOnly: true;
  networkAccess: "none";
  exists: boolean;
  readable: boolean;
  stale: boolean;
  artifactCount: number;
  claimCount: number;
  routeCount: number;
  lastRebuiltAt?: string;
  sourceOfTruth: "workspace-json";
  warnings: string[];
}

export interface WorkspaceCatalogSearchInput {
  rootPath: string;
  query?: string;
  kind?: string;
  trust?: TrustLabel;
  domain?: string;
  tag?: string;
  limit?: number;
}

export interface WorkspaceCatalogSearchResult {
  schemaVersion: "truth-harness.catalog-search.v0";
  catalogSchemaVersion?: string;
  workspacePath: string;
  catalogPath: string;
  localOnly: true;
  networkAccess: "none";
  source: "catalog";
  query?: string;
  filters: {
    kind?: string;
    trust?: TrustLabel;
    domain?: string;
    tag?: string;
    limit: number;
  };
  total: number;
  results: WorkspaceCatalogSearchRow[];
  warnings: string[];
}

export interface WorkspaceCatalogSearchRow {
  path: string;
  kind: string;
  artifactId?: string;
  schemaVersion?: string;
  trust?: TrustLabel;
  title?: string;
  summary?: string;
  domain?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  valid: boolean;
  issueCount: number;
  tags: string[];
}

interface CatalogArtifactRow {
  path: string;
  kind: string;
  artifact_id?: string;
  schema_version?: string;
  trust?: TrustLabel;
  title?: string;
  summary?: string;
  domain?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  valid: 0 | 1;
  issue_count: number;
  sha256: string;
  byte_length: number;
  mtime_ms: number;
}

interface CatalogReference {
  fromPath: string;
  toRef: string;
  refKind?: string;
  edgeKind: string;
  fieldPath: string;
  resolved: boolean;
}

interface CatalogRecordMetadata {
  title?: string;
  summary?: string;
  domain?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  tags: string[];
  body: string;
}

interface CatalogStatusRow {
  schema_version?: string;
  last_rebuilt_at?: string;
  artifact_count?: number;
  claim_count?: number;
  route_count?: number;
}

interface CatalogSearchSqlRow {
  path: string;
  kind: string;
  artifact_id: string | null;
  schema_version: string | null;
  trust: TrustLabel | null;
  title: string | null;
  summary: string | null;
  domain: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  valid: 0 | 1;
  issue_count: number;
  tags: string | null;
}

export async function rebuildWorkspaceCatalog(input: WorkspaceCatalogRebuildInput): Promise<WorkspaceCatalogRebuildResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const rebuiltAt = input.now ?? new Date().toISOString();
  const validation = await validateWorkspaceArtifacts({
    rootPath: status.root,
    now: rebuiltAt
  });
  const catalogPath = workspaceCatalogPath(status);
  await mkdir(dirname(catalogPath), { recursive: true });

  const db = openCatalogDatabase(catalogPath);
  try {
    const artifacts = await Promise.all(
      validation.artifacts.map(async (artifact) => catalogArtifactFromValidation(status.root, validation, artifact))
    );
    const refs = artifacts.flatMap((artifact) => artifact.refs);
    const tagRows = artifacts.flatMap((artifact) => artifact.tags.map((tag) => ({ path: artifact.row.path, tag })));
    const ftsRows = artifacts.map((artifact) => ({
      path: artifact.row.path,
      title: artifact.row.title ?? "",
      body: artifact.body,
      tags: artifact.tags.join(" ")
    }));

    const rebuild = db.transaction(() => {
      createCatalogSchema(db);
      db.prepare("DELETE FROM artifact_fts").run();
      db.prepare("DELETE FROM artifact_refs").run();
      db.prepare("DELETE FROM artifact_tags").run();
      db.prepare("DELETE FROM routes").run();
      db.prepare("DELETE FROM claims").run();
      db.prepare("DELETE FROM artifacts").run();
      db.prepare("DELETE FROM catalog_meta").run();

      const insertArtifact = db.prepare(
        `INSERT INTO artifacts (
          path, kind, artifact_id, schema_version, trust, title, summary, domain, status,
          created_at, updated_at, valid, issue_count, sha256, byte_length, mtime_ms
        ) VALUES (
          @path, @kind, @artifact_id, @schema_version, @trust, @title, @summary, @domain, @status,
          @created_at, @updated_at, @valid, @issue_count, @sha256, @byte_length, @mtime_ms
        )`
      );
      const insertClaim = db.prepare(
        `INSERT INTO claims (
          claim_id, path, statement, domain, trust, status, ready_for_narrow_claim,
          blocking_obligations, created_at, updated_at
        ) VALUES (
          @claim_id, @path, @statement, @domain, @trust, @status, @ready_for_narrow_claim,
          @blocking_obligations, @created_at, @updated_at
        )`
      );
      const insertRoute = db.prepare(
        `INSERT INTO routes (
          route_id, path, problem, final_trust, status, evidence_kind, open_obligations,
          critical_open_obligations, ready_for_narrow_claim, created_at
        ) VALUES (
          @route_id, @path, @problem, @final_trust, @status, @evidence_kind, @open_obligations,
          @critical_open_obligations, @ready_for_narrow_claim, @created_at
        )`
      );
      const insertTag = db.prepare("INSERT OR IGNORE INTO artifact_tags (path, tag) VALUES (@path, @tag)");
      const insertRef = db.prepare(
        `INSERT INTO artifact_refs (
          from_path, to_ref, ref_kind, edge_kind, field_path, resolved
        ) VALUES (
          @from_path, @to_ref, @ref_kind, @edge_kind, @field_path, @resolved
        )`
      );
      const insertFts = db.prepare("INSERT INTO artifact_fts (path, title, body, tags) VALUES (@path, @title, @body, @tags)");
      const insertMeta = db.prepare("INSERT INTO catalog_meta (key, value) VALUES (?, ?)");

      for (const artifact of artifacts) {
        insertArtifact.run(artifact.row);
        if (artifact.claim) {
          insertClaim.run(artifact.claim);
        }
        if (artifact.route) {
          insertRoute.run(artifact.route);
        }
      }
      for (const tag of tagRows) {
        insertTag.run(tag);
      }
      for (const ref of refs) {
        insertRef.run({
          from_path: ref.fromPath,
          to_ref: ref.toRef,
          ref_kind: ref.refKind,
          edge_kind: ref.edgeKind,
          field_path: ref.fieldPath,
          resolved: ref.resolved ? 1 : 0
        });
      }
      for (const row of ftsRows) {
        insertFts.run(row);
      }

      insertMeta.run("schemaVersion", WORKSPACE_CATALOG_SCHEMA_VERSION);
      insertMeta.run("projectId", status.manifest.projectId);
      insertMeta.run("rebuiltAt", rebuiltAt);
      insertMeta.run("artifactCount", String(artifacts.length));
      insertMeta.run("claimCount", String(artifacts.filter((artifact) => artifact.claim).length));
      insertMeta.run("routeCount", String(artifacts.filter((artifact) => artifact.route).length));
      insertMeta.run("rootHash", sha256Text(status.root));
    });

    rebuild();

    return {
      schemaVersion: "truth-harness.catalog-rebuild.v0",
      catalogSchemaVersion: WORKSPACE_CATALOG_SCHEMA_VERSION,
      rebuiltAt,
      workspacePath: status.root,
      catalogPath,
      localOnly: true,
      networkAccess: "none",
      sourceOfTruth: "workspace-json",
      artifactCount: artifacts.length,
      validArtifacts: validation.summary.validFiles,
      invalidArtifacts: validation.summary.invalidFiles,
      claimCount: artifacts.filter((artifact) => artifact.claim).length,
      routeCount: artifacts.filter((artifact) => artifact.route).length,
      tagCount: tagRows.length,
      refCount: refs.length,
      ftsRows: ftsRows.length,
      validation: {
        passed: validation.passed,
        errors: validation.summary.errors,
        warnings: validation.summary.warnings
      },
      warnings: catalogWarnings()
    };
  } finally {
    db.close();
  }
}

export async function getWorkspaceCatalogStatus(rootPath: string): Promise<WorkspaceCatalogStatus> {
  const status = await requireLocalWorkspace(rootPath);
  const catalogPath = workspaceCatalogPath(status);

  let exists = false;
  try {
    await stat(catalogPath);
    exists = true;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }

  if (!exists) {
    return {
      schemaVersion: "truth-harness.catalog-status.v0",
      workspacePath: status.root,
      catalogPath,
      localOnly: true,
      networkAccess: "none",
      exists: false,
      readable: false,
      stale: true,
      artifactCount: 0,
      claimCount: 0,
      routeCount: 0,
      sourceOfTruth: "workspace-json",
      warnings: ["Catalog is missing. Run `truth-harness catalog rebuild` to create the local query index."]
    };
  }

  try {
    const db = openCatalogDatabase(catalogPath, { createSchema: false });
    try {
      const row = readCatalogStatusRow(db);
      return {
        schemaVersion: "truth-harness.catalog-status.v0",
        catalogSchemaVersion: row.schema_version,
        workspacePath: status.root,
        catalogPath,
        localOnly: true,
        networkAccess: "none",
        exists: true,
        readable: row.schema_version === WORKSPACE_CATALOG_SCHEMA_VERSION,
        stale: row.schema_version !== WORKSPACE_CATALOG_SCHEMA_VERSION,
        artifactCount: row.artifact_count ?? 0,
        claimCount: row.claim_count ?? 0,
        routeCount: row.route_count ?? 0,
        lastRebuiltAt: row.last_rebuilt_at,
        sourceOfTruth: "workspace-json",
        warnings:
          row.schema_version === WORKSPACE_CATALOG_SCHEMA_VERSION
            ? catalogWarnings()
            : [`Catalog schema is ${row.schema_version ?? "unknown"}; expected ${WORKSPACE_CATALOG_SCHEMA_VERSION}. Rebuild required.`]
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return {
      schemaVersion: "truth-harness.catalog-status.v0",
      workspacePath: status.root,
      catalogPath,
      localOnly: true,
      networkAccess: "none",
      exists: true,
      readable: false,
      stale: true,
      artifactCount: 0,
      claimCount: 0,
      routeCount: 0,
      sourceOfTruth: "workspace-json",
      warnings: [`Catalog could not be opened: ${error instanceof Error ? error.message : String(error)}. Rebuild required.`]
    };
  }
}

export async function searchWorkspaceCatalog(input: WorkspaceCatalogSearchInput): Promise<WorkspaceCatalogSearchResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const catalogPath = workspaceCatalogPath(status);
  const catalogStatus = await getWorkspaceCatalogStatus(status.root);
  if (!catalogStatus.readable || catalogStatus.catalogSchemaVersion !== WORKSPACE_CATALOG_SCHEMA_VERSION) {
    throw new Error("Workspace catalog is missing, stale, or unreadable. Run `truth-harness catalog rebuild` before searching.");
  }

  const db = openCatalogDatabase(catalogPath, { createSchema: false });
  try {
    const limit = clampLimit(input.limit);
    const conditions: string[] = [];
    const params: Record<string, string | number> = { limit };
    if (input.query?.trim()) {
      conditions.push("a.path IN (SELECT path FROM artifact_fts WHERE artifact_fts MATCH @match)");
      params.match = toFtsQuery(input.query);
    }
    if (input.kind?.trim()) {
      conditions.push("a.kind = @kind");
      params.kind = input.kind.trim();
    }
    if (input.trust?.trim()) {
      conditions.push("a.trust = @trust");
      params.trust = input.trust.trim();
    }
    if (input.domain?.trim()) {
      conditions.push("a.domain = @domain");
      params.domain = input.domain.trim();
    }
    if (input.tag?.trim()) {
      conditions.push("a.path IN (SELECT path FROM artifact_tags WHERE tag = @tag)");
      params.tag = normalizeTag(input.tag);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db
      .prepare(
        `SELECT
          a.path,
          a.kind,
          a.artifact_id,
          a.schema_version,
          a.trust,
          a.title,
          a.summary,
          a.domain,
          a.status,
          a.created_at,
          a.updated_at,
          a.valid,
          a.issue_count,
          COALESCE(group_concat(t.tag, ' '), '') AS tags
        FROM artifacts a
        LEFT JOIN artifact_tags t ON t.path = a.path
        ${where}
        GROUP BY a.path
        ORDER BY COALESCE(a.updated_at, a.created_at, '') DESC, a.path ASC
        LIMIT @limit`
      )
      .all(params) as CatalogSearchSqlRow[];

    return {
      schemaVersion: "truth-harness.catalog-search.v0",
      catalogSchemaVersion: WORKSPACE_CATALOG_SCHEMA_VERSION,
      workspacePath: status.root,
      catalogPath,
      localOnly: true,
      networkAccess: "none",
      source: "catalog",
      query: input.query,
      filters: {
        kind: input.kind,
        trust: input.trust,
        domain: input.domain,
        tag: input.tag ? normalizeTag(input.tag) : undefined,
        limit
      },
      total: rows.length,
      results: rows.map(searchRowFromSql),
      warnings: catalogWarnings()
    };
  } finally {
    db.close();
  }
}

function openCatalogDatabase(path: string, options: { createSchema?: boolean } = {}): Database.Database {
  const db = new Database(path);
  try {
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    if (options.createSchema !== false) {
      createCatalogSchema(db);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function createCatalogSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS artifacts (
      path TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      artifact_id TEXT,
      schema_version TEXT,
      trust TEXT,
      title TEXT,
      summary TEXT,
      domain TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT,
      valid INTEGER NOT NULL,
      issue_count INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      byte_length INTEGER NOT NULL,
      mtime_ms INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS claims (
      claim_id TEXT PRIMARY KEY,
      path TEXT NOT NULL REFERENCES artifacts(path) ON DELETE CASCADE,
      statement TEXT NOT NULL,
      domain TEXT NOT NULL,
      trust TEXT NOT NULL,
      status TEXT NOT NULL,
      ready_for_narrow_claim INTEGER NOT NULL,
      blocking_obligations INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS routes (
      route_id TEXT PRIMARY KEY,
      path TEXT NOT NULL REFERENCES artifacts(path) ON DELETE CASCADE,
      problem TEXT NOT NULL,
      final_trust TEXT NOT NULL,
      status TEXT NOT NULL,
      evidence_kind TEXT NOT NULL,
      open_obligations INTEGER NOT NULL,
      critical_open_obligations INTEGER NOT NULL,
      ready_for_narrow_claim INTEGER NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS artifact_tags (
      path TEXT NOT NULL REFERENCES artifacts(path) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (path, tag)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS artifact_refs (
      from_path TEXT NOT NULL REFERENCES artifacts(path) ON DELETE CASCADE,
      to_ref TEXT NOT NULL,
      ref_kind TEXT,
      edge_kind TEXT NOT NULL,
      field_path TEXT NOT NULL,
      resolved INTEGER NOT NULL
    ) STRICT;

    CREATE VIRTUAL TABLE IF NOT EXISTS artifact_fts USING fts5(
      path UNINDEXED,
      title,
      body,
      tags,
      tokenize = 'unicode61'
    );

    CREATE INDEX IF NOT EXISTS artifacts_kind_idx ON artifacts(kind);
    CREATE INDEX IF NOT EXISTS artifacts_trust_idx ON artifacts(trust);
    CREATE INDEX IF NOT EXISTS artifacts_updated_idx ON artifacts(updated_at);
    CREATE INDEX IF NOT EXISTS claims_domain_trust_idx ON claims(domain, trust);
    CREATE INDEX IF NOT EXISTS routes_final_trust_idx ON routes(final_trust);
    CREATE INDEX IF NOT EXISTS refs_to_ref_idx ON artifact_refs(to_ref);
  `);
}

async function catalogArtifactFromValidation(
  root: string,
  validation: WorkspaceValidation,
  artifact: WorkspaceValidationArtifact
): Promise<{
  row: CatalogArtifactRow;
  tags: string[];
  refs: CatalogReference[];
  body: string;
  claim?: Record<string, string | number>;
  route?: Record<string, string | number>;
}> {
  const fullPath = resolveUnderRoot(root, artifact.path);
  let raw = "";
  let parsed: unknown;
  let stats = { size: 0, mtimeMs: 0 };
  try {
    raw = await readFile(fullPath, "utf8");
    parsed = parseJsonWithOptionalBom(raw);
    const statResult = await stat(fullPath);
    stats = {
      size: statResult.size,
      mtimeMs: statResult.mtimeMs
    };
  } catch {
    parsed = undefined;
  }

  const record = isRecord(parsed) ? parsed : {};
  const metadata = metadataForRecord(artifact, record);
  const refs = collectCatalogReferences(record, artifact.path, validation);
  const row: CatalogArtifactRow = {
    path: artifact.path,
    kind: artifact.kind,
    artifact_id: artifact.artifactId,
    schema_version: artifact.schemaVersion,
    trust: artifact.trust ?? trustForRecord(record),
    title: metadata.title,
    summary: metadata.summary,
    domain: metadata.domain,
    status: metadata.status,
    created_at: metadata.createdAt,
    updated_at: metadata.updatedAt ?? metadata.createdAt,
    valid: artifact.valid ? 1 : 0,
    issue_count: artifact.issueCodes.length,
    sha256: sha256Text(raw),
    byte_length: stats.size,
    mtime_ms: Math.round(stats.mtimeMs)
  };

  return {
    row,
    tags: metadata.tags,
    refs,
    body: metadata.body,
    claim: claimRowForRecord(artifact, record),
    route: routeRowForRecord(artifact, record)
  };
}

function metadataForRecord(artifact: WorkspaceValidationArtifact, record: Record<string, unknown>): CatalogRecordMetadata {
  const title = firstString(record, ["title", "statement", "objective", "problem", "summary", "displayName", "name"]) ?? artifact.artifactId ?? artifact.path;
  const summary = firstString(record, ["summary", "normalizedStatement", "normalizedProblem", "hypothesis", "purpose"]);
  const domain = firstString(record, ["domain", "lane"]);
  const status = firstString(record, ["status", "reviewStatus"]);
  const createdAt = firstString(record, ["createdAt", "checkedAt", "startedAt"]);
  const updatedAt = firstString(record, ["updatedAt", "completedAt", "createdAt", "checkedAt"]);
  const tags = collectTags(record);
  const body = artifact.kind === "vault" ? "" : safeText([title, summary, domain, status, tags.join(" "), bodyFragments(record)].join(" "));
  return {
    title: safeText(title),
    summary: summary ? safeText(summary) : undefined,
    domain,
    status,
    createdAt,
    updatedAt,
    tags,
    body
  };
}

function claimRowForRecord(artifact: WorkspaceValidationArtifact, record: Record<string, unknown>): Record<string, string | number> | undefined {
  if (artifact.kind !== "claims" || typeof record.claimId !== "string") {
    return undefined;
  }

  const finalization = isRecord(record.finalization) ? record.finalization : {};
  return {
    claim_id: record.claimId,
    path: artifact.path,
    statement: typeof record.statement === "string" ? record.statement : "",
    domain: typeof record.domain === "string" ? record.domain : "general",
    trust: typeof record.trust === "string" ? record.trust : "unverified",
    status: typeof record.status === "string" ? record.status : "active",
    ready_for_narrow_claim: finalization.readyForNarrowClaim === true ? 1 : 0,
    blocking_obligations: Array.isArray(finalization.openChecks) ? finalization.openChecks.length : 0,
    created_at: typeof record.createdAt === "string" ? record.createdAt : "",
    updated_at: typeof record.updatedAt === "string" ? record.updatedAt : typeof record.createdAt === "string" ? record.createdAt : ""
  };
}

function routeRowForRecord(artifact: WorkspaceValidationArtifact, record: Record<string, unknown>): Record<string, string | number> | undefined {
  if (artifact.kind !== "routes" || typeof record.routeId !== "string") {
    return undefined;
  }

  const proofObligations = Array.isArray(record.proofObligations) ? record.proofObligations : [];
  const openObligations = proofObligations.filter((entry) => isRecord(entry) && entry.status === "open");
  const criticalOpenObligations = openObligations.filter((entry) => isRecord(entry) && entry.severity === "critical");
  return {
    route_id: record.routeId,
    path: artifact.path,
    problem: typeof record.problem === "string" ? record.problem : "",
    final_trust: typeof record.finalTrust === "string" ? record.finalTrust : "unverified",
    status: typeof record.status === "string" ? record.status : "unverified",
    evidence_kind: typeof record.evidenceKind === "string" ? record.evidenceKind : "unknown",
    open_obligations: openObligations.length,
    critical_open_obligations: criticalOpenObligations.length,
    ready_for_narrow_claim: record.finalTrust !== "unverified" && criticalOpenObligations.length === 0 ? 1 : 0,
    created_at: typeof record.createdAt === "string" ? record.createdAt : ""
  };
}

function collectCatalogReferences(
  record: Record<string, unknown>,
  sourcePath: string,
  validation: WorkspaceValidation
): CatalogReference[] {
  const refs: CatalogReference[] = [];
  const pathSet = new Set(validation.artifacts.map((artifact) => artifact.path));
  const idSet = new Set(
    validation.artifacts.flatMap((artifact) => (artifact.artifactId ? [`${artifact.kind}:${artifact.artifactId}`] : []))
  );

  function pushRef(value: string, fieldPath: string, edgeKind: string, refKind?: string): void {
    const parsed = parseReference(value, refKind);
    refs.push({
      fromPath: sourcePath,
      toRef: parsed.ref,
      refKind: parsed.kind,
      edgeKind,
      fieldPath,
      resolved: referenceResolved(parsed.kind, parsed.ref, pathSet, idSet)
    });
  }

  function walk(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (!isRecord(value)) {
      return;
    }

    for (const [key, entry] of Object.entries(value)) {
      const entryPath = `${path}.${key}`;
      if (key === "evidenceRefs" && Array.isArray(entry)) {
        entry.forEach((ref, index) => collectReferenceEntry(ref, `${entryPath}[${index}]`, "evidence-ref", pushRef));
        continue;
      }
      if (key === "sourceRefs" && Array.isArray(entry)) {
        entry.forEach((ref, index) => collectReferenceEntry(ref, `${entryPath}[${index}]`, "source-ref", pushRef));
        continue;
      }
      if (key === "dependsOn" && Array.isArray(entry)) {
        entry.forEach((ref, index) => {
          if (typeof ref === "string") pushRef(ref, `${entryPath}[${index}]`, "depends-on", "claim");
        });
        continue;
      }
      if (key === "supersedes" && Array.isArray(entry)) {
        entry.forEach((ref, index) => {
          if (typeof ref === "string") pushRef(ref, `${entryPath}[${index}]`, "supersedes", "claim");
        });
        continue;
      }
      if (key === "snapshotRefs" && Array.isArray(entry)) {
        entry.forEach((ref, index) => {
          if (typeof ref === "string") pushRef(ref, `${entryPath}[${index}]`, "snapshot-ref", "snapshot");
        });
        continue;
      }
      if (key === "selectedContextRefs" && Array.isArray(entry)) {
        entry.forEach((ref, index) => {
          if (typeof ref === "string") pushRef(ref, `${entryPath}[${index}]`, "selected-context-ref");
        });
        continue;
      }

      walk(entry, entryPath);
    }
  }

  walk(record, "$");
  return refs.filter((ref) => ref.toRef.trim().length > 0);
}

function collectReferenceEntry(
  entry: unknown,
  path: string,
  edgeKind: string,
  pushRef: (value: string, fieldPath: string, edgeKind: string, refKind?: string) => void
): void {
  if (typeof entry === "string") {
    pushRef(entry, path, edgeKind);
    return;
  }

  if (isRecord(entry) && typeof entry.ref === "string") {
    pushRef(entry.ref, path, edgeKind, typeof entry.kind === "string" ? entry.kind : undefined);
  }
}

function parseReference(value: string, fallbackKind?: string): { kind?: string; ref: string } {
  const separator = value.indexOf(":");
  if (separator > 0 && !value.slice(0, separator).includes("/") && !value.slice(0, separator).includes("\\")) {
    return {
      kind: value.slice(0, separator),
      ref: value.slice(separator + 1)
    };
  }
  return { kind: fallbackKind, ref: value };
}

function referenceResolved(kind: string | undefined, ref: string, pathSet: Set<string>, idSet: Set<string>): boolean {
  const artifactKind = referenceKindToArtifactKind(kind);
  if (artifactKind && idSet.has(`${artifactKind}:${ref}`)) {
    return true;
  }
  return pathSet.has(normalizePortablePath(ref));
}

function referenceKindToArtifactKind(kind: string | undefined): string | undefined {
  switch (kind) {
    case "receipt":
      return "receipts";
    case "claim":
      return "claims";
    case "route":
    case "verifier-route":
      return "routes";
    case "visual":
    case "visual-artifact":
      return "visuals";
    case "cas":
    case "cas-check":
      return "cas";
    case "proof":
    case "proof-check":
      return "proofs";
    case "smt":
    case "smt-check":
      return "smt";
    case "snapshot":
      return "snapshots";
    case "literature":
      return "literature";
    case "review":
      return "reviews";
    case "validation":
      return "validation";
    case "notebook":
    case "notebook-run":
      return "notebook-runs";
    case "code-run":
      return "code-runs";
    case "simulation":
      return "simulations";
    case "experiment":
      return "experiments";
    case "vault":
      return "vault";
    default:
      return undefined;
  }
}

function readCatalogStatusRow(db: Database.Database): CatalogStatusRow {
  const meta = db.prepare("SELECT key, value FROM catalog_meta").all() as Array<{ key: string; value: string }>;
  const values = new Map(meta.map((row) => [row.key, row.value]));
  return {
    schema_version: values.get("schemaVersion"),
    last_rebuilt_at: values.get("rebuiltAt"),
    artifact_count: parseInteger(values.get("artifactCount")),
    claim_count: parseInteger(values.get("claimCount")),
    route_count: parseInteger(values.get("routeCount"))
  };
}

function searchRowFromSql(row: CatalogSearchSqlRow): WorkspaceCatalogSearchRow {
  return {
    path: row.path,
    kind: row.kind,
    artifactId: row.artifact_id ?? undefined,
    schemaVersion: row.schema_version ?? undefined,
    trust: row.trust ?? undefined,
    title: row.title ?? undefined,
    summary: row.summary ?? undefined,
    domain: row.domain ?? undefined,
    status: row.status ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    valid: row.valid === 1,
    issueCount: row.issue_count,
    tags: row.tags ? row.tags.split(" ").filter(Boolean).sort() : []
  };
}

function workspaceCatalogPath(status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }): string {
  return resolve(status.root, status.manifest.directories.indexes, WORKSPACE_CATALOG_FILE);
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before using the catalog.");
  }
  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function collectTags(record: Record<string, unknown>): string[] {
  const values = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      values.add(normalizeTag(value));
    }
  };
  if (Array.isArray(record.tags)) {
    record.tags.forEach(add);
  }
  if (Array.isArray(record.domains)) {
    record.domains.forEach(add);
  }
  const domain = record.domain;
  if (typeof domain === "string" && domain.trim()) {
    values.add(normalizeTag(domain));
  }
  return [...values].sort();
}

function bodyFragments(value: unknown): string {
  const fragments: string[] = [];
  function walk(current: unknown, depth: number): void {
    if (fragments.join(" ").length > 4000 || depth > 4) {
      return;
    }
    if (typeof current === "string") {
      fragments.push(current);
      return;
    }
    if (Array.isArray(current)) {
      current.slice(0, 20).forEach((entry) => walk(entry, depth + 1));
      return;
    }
    if (isRecord(current)) {
      for (const [key, entry] of Object.entries(current)) {
        if (key === "ciphertext" || key === "plaintext" || key === "stdout" || key === "stderr") {
          continue;
        }
        walk(entry, depth + 1);
      }
    }
  }
  walk(value, 0);
  return fragments.join(" ").slice(0, 4000);
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/\s+/gu, " ");
    }
  }
  return undefined;
}

function trustForRecord(record: Record<string, unknown>): TrustLabel | undefined {
  for (const key of ["trust", "finalTrust", "strongestTrust"]) {
    const value = record[key];
    if (typeof value === "string" && isTrustLabel(value)) {
      return value;
    }
  }

  const finalization = record.finalization;
  if (isRecord(finalization) && typeof finalization.strongestTrust === "string" && isTrustLabel(finalization.strongestTrust)) {
    return finalization.strongestTrust;
  }

  return undefined;
}

function isTrustLabel(value: string): value is TrustLabel {
  return (
    value === "proved" ||
    value === "exact-computed" ||
    value === "bounded-numeric" ||
    value === "smt-checked" ||
    value === "dimension-checked" ||
    value === "source-cited" ||
    value === "cross-checked" ||
    value === "unverified" ||
    value === "refuted"
  );
}

function safeText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, 4000);
}

function normalizeTag(value: string): string {
  const trimmed = value.trim().replace(/^#/u, "").toLowerCase();
  return trimmed.length > 0 ? `#${trimmed}` : "";
}

function toFtsQuery(query: string): string {
  return query
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => `"${token.replaceAll('"', '""')}"`)
    .join(" ");
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return 25;
  }
  return Math.min(100, Math.max(1, Math.trunc(limit ?? 25)));
}

function catalogWarnings(): string[] {
  return [
    "Catalog rows are a local query index over canonical workspace JSON artifacts; they do not upgrade trust labels or satisfy proof obligations.",
    "Delete catalog.db at any time and rebuild from .truth-harness JSON artifacts."
  ];
}

function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function resolveUnderRoot(root: string, path: string): string {
  const target = resolve(root, path);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Catalog path escapes workspace root: ${JSON.stringify(path)}`);
  }
  return target;
}

function normalizePortablePath(value: string): string {
  return relative("", value).split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

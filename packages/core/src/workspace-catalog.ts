import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import Database from "better-sqlite3";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { appendArtifactWriteEvent } from "./event-log.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import {
  validateWorkspaceArtifacts,
  type WorkspaceValidation,
  type WorkspaceValidationArtifact,
  type WorkspaceValidationArtifactKind
} from "./workspace-validation.js";
import type { TrustLabel } from "./types.js";

export const WORKSPACE_CATALOG_SCHEMA_VERSION = "truth-harness.catalog.v0";
export const WORKSPACE_CATALOG_FILE = "catalog.db";

export interface WorkspaceCatalogRebuildInput {
  rootPath: string;
  now?: string;
}

export interface WorkspaceCatalogStatusInput {
  checkFiles?: boolean;
}

export interface WorkspaceCatalogStaleInput {
  rootPath: string;
  reason: string;
  path?: string;
  kind?: string;
  now?: string;
}

export interface WorkspaceCatalogStaleResult {
  schemaVersion: "truth-harness.catalog-stale.v0";
  workspacePath: string;
  catalogPath: string;
  localOnly: true;
  networkAccess: "none";
  sourceOfTruth: "workspace-json";
  exists: boolean;
  marked: boolean;
  staleAt?: string;
  reason: string;
  path?: string;
  kind?: string;
  warnings: string[];
}

export interface WorkspaceCatalogUpsertInput {
  rootPath: string;
  path: string;
  kind?: string;
  now?: string;
  staleReason?: string;
}

export interface WorkspaceCatalogUpsertResult {
  schemaVersion: "truth-harness.catalog-upsert.v0";
  workspacePath: string;
  catalogPath: string;
  localOnly: true;
  networkAccess: "none";
  sourceOfTruth: "workspace-json";
  exists: boolean;
  updated: boolean;
  stale: boolean;
  path: string;
  kind?: string;
  artifactId?: string;
  updatedAt?: string;
  warnings: string[];
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
  invalidatedAt?: string;
  invalidation?: {
    reason: string;
    path?: string;
    kind?: string;
  };
  sourceOfTruth: "workspace-json";
  freshness: WorkspaceCatalogFreshness;
  warnings: string[];
}

export interface WorkspaceCatalogFreshness {
  checked: boolean;
  stale: boolean;
  indexedArtifacts: number;
  workspaceArtifacts?: number;
  changedArtifacts: number;
  missingArtifacts: number;
  newArtifacts: number;
  examples: string[];
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
  stale_at?: string;
  stale_reason?: string;
  stale_path?: string;
  stale_kind?: string;
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

interface CatalogIndexedSnapshotRow {
  path: string;
  byte_length: number;
  mtime_ms: number;
}

interface CatalogSourceSnapshotRow {
  path: string;
  byteLength: number;
  mtimeMs: number;
}

interface CatalogArtifactBundle {
  row: CatalogArtifactRow;
  tags: string[];
  refs: CatalogReference[];
  body: string;
  claim?: Record<string, string | number>;
  route?: Record<string, string | number>;
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

export async function markWorkspaceCatalogStale(input: WorkspaceCatalogStaleInput): Promise<WorkspaceCatalogStaleResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const catalogPath = workspaceCatalogPath(status);
  const staleAt = input.now ?? new Date().toISOString();
  const reason = safeText(input.reason || "workspace artifact changed");
  const path = input.path ? normalizePortablePath(input.path) : undefined;
  const kind = input.kind ? safeText(input.kind) : undefined;

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
      schemaVersion: "truth-harness.catalog-stale.v0",
      workspacePath: status.root,
      catalogPath,
      localOnly: true,
      networkAccess: "none",
      sourceOfTruth: "workspace-json",
      exists: false,
      marked: false,
      reason,
      path,
      kind,
      warnings: ["Catalog is missing; no cache invalidation marker was needed."]
    };
  }

  try {
    const db = openCatalogDatabase(catalogPath, { createSchema: false });
    try {
      const row = readCatalogStatusRow(db);
      if (row.schema_version !== WORKSPACE_CATALOG_SCHEMA_VERSION) {
        return {
          schemaVersion: "truth-harness.catalog-stale.v0",
          workspacePath: status.root,
          catalogPath,
          localOnly: true,
          networkAccess: "none",
          sourceOfTruth: "workspace-json",
          exists: true,
          marked: false,
          reason,
          path,
          kind,
          warnings: [`Catalog schema is ${row.schema_version ?? "unknown"}; expected ${WORKSPACE_CATALOG_SCHEMA_VERSION}. Rebuild required.`]
        };
      }

      writeCatalogMeta(db, "staleAt", staleAt);
      writeCatalogMeta(db, "staleReason", reason);
      writeCatalogMeta(db, "stalePath", path ?? "");
      writeCatalogMeta(db, "staleKind", kind ?? "");
      return {
        schemaVersion: "truth-harness.catalog-stale.v0",
        workspacePath: status.root,
        catalogPath,
        localOnly: true,
        networkAccess: "none",
        sourceOfTruth: "workspace-json",
        exists: true,
        marked: true,
        staleAt,
        reason,
        path,
        kind,
        warnings: ["Catalog was marked stale; rebuild before relying on search completeness."]
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return {
      schemaVersion: "truth-harness.catalog-stale.v0",
      workspacePath: status.root,
      catalogPath,
      localOnly: true,
      networkAccess: "none",
      sourceOfTruth: "workspace-json",
      exists: true,
      marked: false,
      reason,
      path,
      kind,
      warnings: [`Catalog could not be marked stale: ${error instanceof Error ? error.message : String(error)}. Rebuild required.`]
    };
  }
}

export async function upsertWorkspaceCatalogArtifact(input: WorkspaceCatalogUpsertInput): Promise<WorkspaceCatalogUpsertResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const catalogPath = workspaceCatalogPath(status);
  const artifactPath = workspaceRelativePath(status.root, input.path);

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
      schemaVersion: "truth-harness.catalog-upsert.v0",
      workspacePath: status.root,
      catalogPath,
      localOnly: true,
      networkAccess: "none",
      sourceOfTruth: "workspace-json",
      exists: false,
      updated: false,
      stale: false,
      path: artifactPath,
      kind: input.kind,
      warnings: ["Catalog is missing; no incremental cache update was needed."]
    };
  }

  try {
    const db = openCatalogDatabase(catalogPath, { createSchema: false });
    try {
      const row = readCatalogStatusRow(db);
      if (row.schema_version !== WORKSPACE_CATALOG_SCHEMA_VERSION) {
        return {
          schemaVersion: "truth-harness.catalog-upsert.v0",
          workspacePath: status.root,
          catalogPath,
          localOnly: true,
          networkAccess: "none",
          sourceOfTruth: "workspace-json",
          exists: true,
          updated: false,
          stale: true,
          path: artifactPath,
          kind: input.kind,
          warnings: [`Catalog schema is ${row.schema_version ?? "unknown"}; expected ${WORKSPACE_CATALOG_SCHEMA_VERSION}. Rebuild required.`]
        };
      }

      const artifact = await catalogArtifactFromPath(status, db, artifactPath, input.kind);
      upsertCatalogArtifact(db, artifact);
      refreshCatalogCounts(db);
      clearMatchingCatalogStaleMarker(db, artifactPath);
      return {
        schemaVersion: "truth-harness.catalog-upsert.v0",
        workspacePath: status.root,
        catalogPath,
        localOnly: true,
        networkAccess: "none",
        sourceOfTruth: "workspace-json",
        exists: true,
        updated: true,
        stale: Boolean(readCatalogStatusRow(db).stale_at),
        path: artifact.row.path,
        kind: artifact.row.kind,
        artifactId: artifact.row.artifact_id,
        updatedAt: input.now,
        warnings: ["Catalog row updated from one canonical workspace JSON artifact; full rebuild remains the authoritative cache reset."]
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return {
      schemaVersion: "truth-harness.catalog-upsert.v0",
      workspacePath: status.root,
      catalogPath,
      localOnly: true,
      networkAccess: "none",
      sourceOfTruth: "workspace-json",
      exists: true,
      updated: false,
      stale: true,
      path: artifactPath,
      kind: input.kind,
      warnings: [`Catalog row could not be updated: ${error instanceof Error ? error.message : String(error)}. Rebuild required.`]
    };
  }
}

export async function refreshWorkspaceCatalogArtifact(input: WorkspaceCatalogUpsertInput): Promise<WorkspaceCatalogUpsertResult | WorkspaceCatalogStaleResult> {
  const catalogUpdate = await upsertWorkspaceCatalogArtifact(input);
  let result: WorkspaceCatalogUpsertResult | WorkspaceCatalogStaleResult = catalogUpdate;
  if (!catalogUpdate.updated && catalogUpdate.exists) {
    result = await markWorkspaceCatalogStale({
      rootPath: input.rootPath,
      reason: input.staleReason ?? "workspace artifact written",
      path: catalogUpdate.path,
      kind: input.kind,
      now: input.now
    });
  }
  return appendWorkspaceCatalogEvent(input, result);
}

export async function getWorkspaceCatalogStatus(rootPath: string, input: WorkspaceCatalogStatusInput = {}): Promise<WorkspaceCatalogStatus> {
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
      freshness: uncheckedCatalogFreshness(0, true),
      warnings: ["Catalog is missing. Run `truth-harness catalog rebuild` to create the local query index."]
    };
  }

  try {
    const db = openCatalogDatabase(catalogPath, { createSchema: false });
    try {
      const row = readCatalogStatusRow(db);
      const schemaStale = row.schema_version !== WORKSPACE_CATALOG_SCHEMA_VERSION;
      const markerStale = Boolean(row.stale_at);
      const freshness =
        input.checkFiles && !schemaStale
          ? markCatalogFreshness(await compareCatalogFreshness(status, db), row)
          : uncheckedCatalogFreshness(row.artifact_count ?? 0, schemaStale || markerStale, row);
      const stale = schemaStale || markerStale || freshness.stale;
      return {
        schemaVersion: "truth-harness.catalog-status.v0",
        catalogSchemaVersion: row.schema_version,
        workspacePath: status.root,
        catalogPath,
        localOnly: true,
        networkAccess: "none",
        exists: true,
        readable: row.schema_version === WORKSPACE_CATALOG_SCHEMA_VERSION,
        stale,
        artifactCount: row.artifact_count ?? 0,
        claimCount: row.claim_count ?? 0,
        routeCount: row.route_count ?? 0,
        lastRebuiltAt: row.last_rebuilt_at,
        invalidatedAt: row.stale_at,
        invalidation: row.stale_reason
          ? {
              reason: row.stale_reason,
              path: row.stale_path,
              kind: row.stale_kind
            }
          : undefined,
        sourceOfTruth: "workspace-json",
        freshness,
        warnings:
          row.schema_version === WORKSPACE_CATALOG_SCHEMA_VERSION
            ? catalogFreshnessWarnings(freshness)
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
      freshness: uncheckedCatalogFreshness(0, true),
      warnings: [`Catalog could not be opened: ${error instanceof Error ? error.message : String(error)}. Rebuild required.`]
    };
  }
}

export async function searchWorkspaceCatalog(input: WorkspaceCatalogSearchInput): Promise<WorkspaceCatalogSearchResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const catalogPath = workspaceCatalogPath(status);
  const catalogStatus = await getWorkspaceCatalogStatus(status.root);
  if (!catalogStatus.readable || catalogStatus.stale || catalogStatus.catalogSchemaVersion !== WORKSPACE_CATALOG_SCHEMA_VERSION) {
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

function upsertCatalogArtifact(db: Database.Database, artifact: CatalogArtifactBundle): void {
  const upsert = db.transaction(() => {
    const path = artifact.row.path;
    db.prepare("DELETE FROM artifact_fts WHERE path = ?").run(path);
    db.prepare("DELETE FROM artifact_refs WHERE from_path = ?").run(path);
    db.prepare("DELETE FROM artifact_tags WHERE path = ?").run(path);
    db.prepare("DELETE FROM claims WHERE path = ?").run(path);
    db.prepare("DELETE FROM routes WHERE path = ?").run(path);
    db.prepare(
      `INSERT INTO artifacts (
        path, kind, artifact_id, schema_version, trust, title, summary, domain, status,
        created_at, updated_at, valid, issue_count, sha256, byte_length, mtime_ms
      ) VALUES (
        @path, @kind, @artifact_id, @schema_version, @trust, @title, @summary, @domain, @status,
        @created_at, @updated_at, @valid, @issue_count, @sha256, @byte_length, @mtime_ms
      )
      ON CONFLICT(path) DO UPDATE SET
        kind = excluded.kind,
        artifact_id = excluded.artifact_id,
        schema_version = excluded.schema_version,
        trust = excluded.trust,
        title = excluded.title,
        summary = excluded.summary,
        domain = excluded.domain,
        status = excluded.status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        valid = excluded.valid,
        issue_count = excluded.issue_count,
        sha256 = excluded.sha256,
        byte_length = excluded.byte_length,
        mtime_ms = excluded.mtime_ms`
    ).run(artifact.row);

    if (artifact.claim) {
      db.prepare(
        `INSERT INTO claims (
          claim_id, path, statement, domain, trust, status, ready_for_narrow_claim,
          blocking_obligations, created_at, updated_at
        ) VALUES (
          @claim_id, @path, @statement, @domain, @trust, @status, @ready_for_narrow_claim,
          @blocking_obligations, @created_at, @updated_at
        )`
      ).run(artifact.claim);
    }

    if (artifact.route) {
      db.prepare(
        `INSERT INTO routes (
          route_id, path, problem, final_trust, status, evidence_kind, open_obligations,
          critical_open_obligations, ready_for_narrow_claim, created_at
        ) VALUES (
          @route_id, @path, @problem, @final_trust, @status, @evidence_kind, @open_obligations,
          @critical_open_obligations, @ready_for_narrow_claim, @created_at
        )`
      ).run(artifact.route);
    }

    const insertTag = db.prepare("INSERT OR IGNORE INTO artifact_tags (path, tag) VALUES (?, ?)");
    for (const tag of artifact.tags) {
      insertTag.run(path, tag);
    }

    const insertRef = db.prepare(
      `INSERT INTO artifact_refs (
        from_path, to_ref, ref_kind, edge_kind, field_path, resolved
      ) VALUES (
        @from_path, @to_ref, @ref_kind, @edge_kind, @field_path, @resolved
      )`
    );
    for (const ref of artifact.refs) {
      insertRef.run({
        from_path: ref.fromPath,
        to_ref: ref.toRef,
        ref_kind: ref.refKind,
        edge_kind: ref.edgeKind,
        field_path: ref.fieldPath,
        resolved: ref.resolved ? 1 : 0
      });
    }

    db.prepare("INSERT INTO artifact_fts (path, title, body, tags) VALUES (?, ?, ?, ?)").run(
      path,
      artifact.row.title ?? "",
      artifact.body,
      artifact.tags.join(" ")
    );
  });
  upsert();
}

function refreshCatalogCounts(db: Database.Database): void {
  writeCatalogMeta(db, "artifactCount", String(scalarCount(db, "artifacts")));
  writeCatalogMeta(db, "claimCount", String(scalarCount(db, "claims")));
  writeCatalogMeta(db, "routeCount", String(scalarCount(db, "routes")));
}

function clearMatchingCatalogStaleMarker(db: Database.Database, path: string): void {
  const row = readCatalogStatusRow(db);
  if (!row.stale_at || row.stale_path !== path) {
    return;
  }

  writeCatalogMeta(db, "staleAt", "");
  writeCatalogMeta(db, "staleReason", "");
  writeCatalogMeta(db, "stalePath", "");
  writeCatalogMeta(db, "staleKind", "");
}

function scalarCount(db: Database.Database, tableName: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count?: number };
  return row.count ?? 0;
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

async function catalogArtifactFromPath(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  db: Database.Database,
  path: string,
  kindHint?: string
): Promise<CatalogArtifactBundle> {
  const fullPath = resolveUnderRoot(status.root, path);
  const raw = await readFile(fullPath, "utf8");
  const parsed = parseJsonWithOptionalBom(raw);
  const statResult = await stat(fullPath);
  const record = isRecord(parsed) ? parsed : {};
  const kind = inferArtifactKind(status, path, kindHint);
  const artifact: WorkspaceValidationArtifact = {
    path,
    kind,
    valid: isRecord(parsed),
    schemaVersion: typeof record.schemaVersion === "string" ? record.schemaVersion : undefined,
    artifactId: artifactIdForRecord(kind, record),
    trust: trustForRecord(record),
    issueCodes: []
  };
  const metadata = metadataForRecord(artifact, record);
  const refs = collectCatalogReferencesFromCatalog(db, artifact, record);
  const row: CatalogArtifactRow = {
    path,
    kind,
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
    byte_length: statResult.size,
    mtime_ms: Math.round(statResult.mtimeMs)
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

async function catalogArtifactFromValidation(
  root: string,
  validation: WorkspaceValidation,
  artifact: WorkspaceValidationArtifact
): Promise<CatalogArtifactBundle> {
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

function inferArtifactKind(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  path: string,
  kindHint?: string
): WorkspaceValidationArtifactKind {
  if (kindHint?.trim()) {
    return kindHint.trim() as WorkspaceValidationArtifactKind;
  }

  const portablePath = normalizePortablePath(path);
  const manifestPath = toPortableRelativePath(status.root, status.manifestPath);
  if (portablePath === manifestPath) {
    return "manifest";
  }

  for (const [kind, directory] of Object.entries(status.manifest.directories) as Array<[string, string]>) {
    const portableDirectory = normalizePortablePath(directory).replace(/\/+$/u, "");
    if (portablePath === portableDirectory || portablePath.startsWith(`${portableDirectory}/`)) {
      return kind as WorkspaceValidationArtifactKind;
    }
  }

  return "artifacts";
}

function artifactIdForRecord(kind: WorkspaceValidationArtifactKind, record: Record<string, unknown>): string | undefined {
  const idKeys: Partial<Record<WorkspaceValidationArtifactKind, string[]>> = {
    manifest: ["projectId"],
    receipts: ["runId"],
    claims: ["claimId"],
    routes: ["routeId"],
    visuals: ["visualId"],
    cas: ["checkId"],
    proofs: ["checkId"],
    smt: ["checkId"],
    "engine-runs": ["runId"],
    benchmarks: ["benchmarkRunId", "comparisonId"],
    disclosures: ["disclosureId"],
    simulations: ["simulationId"],
    patents: ["chartId"],
    experiments: ["experimentId"],
    vault: ["vaultId"],
    audits: ["auditId"],
    snapshots: ["snapshotId"],
    sessions: ["sessionId"],
    reviews: ["reviewId"],
    findings: ["planId", "reviewId", "packId", "bundleId", "verificationId"],
    validation: ["planId"],
    literature: ["recordId"],
    "notebook-runs": ["runRecordId"],
    "code-runs": ["runId"],
    "model-contexts": ["packetId"],
    inventions: ["entryId"],
    indexes: ["projectId"]
  };

  for (const key of idKeys[kind] ?? []) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function collectCatalogReferences(
  record: Record<string, unknown>,
  sourcePath: string,
  validation: WorkspaceValidation
): CatalogReference[] {
  const pathSet = new Set(validation.artifacts.map((artifact) => artifact.path));
  const idSet = new Set(
    validation.artifacts.flatMap((artifact) => (artifact.artifactId ? [`${artifact.kind}:${artifact.artifactId}`] : []))
  );
  return collectCatalogReferencesWithSets(record, sourcePath, pathSet, idSet);
}

function collectCatalogReferencesFromCatalog(
  db: Database.Database,
  artifact: WorkspaceValidationArtifact,
  record: Record<string, unknown>
): CatalogReference[] {
  const rows = db.prepare("SELECT path, kind, artifact_id FROM artifacts").all() as Array<{
    path: string;
    kind: string;
    artifact_id: string | null;
  }>;
  const pathSet = new Set(rows.map((row) => row.path));
  const idSet = new Set(rows.flatMap((row) => (row.artifact_id ? [`${row.kind}:${row.artifact_id}`] : [])));
  pathSet.add(artifact.path);
  if (artifact.artifactId) {
    idSet.add(`${artifact.kind}:${artifact.artifactId}`);
  }
  return collectCatalogReferencesWithSets(record, artifact.path, pathSet, idSet);
}

function collectCatalogReferencesWithSets(
  record: Record<string, unknown>,
  sourcePath: string,
  pathSet: Set<string>,
  idSet: Set<string>
): CatalogReference[] {
  const refs: CatalogReference[] = [];

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

async function compareCatalogFreshness(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> },
  db: Database.Database
): Promise<WorkspaceCatalogFreshness> {
  const indexedRows = db
    .prepare("SELECT path, byte_length, mtime_ms FROM artifacts ORDER BY path")
    .all() as CatalogIndexedSnapshotRow[];
  const sourceRows = await collectCatalogSourceSnapshot(status);
  const indexedByPath = new Map(indexedRows.map((row) => [row.path, row]));
  const sourceByPath = new Map(sourceRows.map((row) => [row.path, row]));
  const changed: string[] = [];
  const missing: string[] = [];
  const added: string[] = [];

  for (const source of sourceRows) {
    const indexed = indexedByPath.get(source.path);
    if (!indexed) {
      added.push(source.path);
      continue;
    }

    if (indexed.byte_length !== source.byteLength || indexed.mtime_ms !== source.mtimeMs) {
      changed.push(source.path);
    }
  }

  for (const indexed of indexedRows) {
    if (!sourceByPath.has(indexed.path)) {
      missing.push(indexed.path);
    }
  }

  const examples = [...changed.map((path) => `changed:${path}`), ...added.map((path) => `new:${path}`), ...missing.map((path) => `missing:${path}`)].slice(0, 8);
  return {
    checked: true,
    stale: changed.length > 0 || missing.length > 0 || added.length > 0,
    indexedArtifacts: indexedRows.length,
    workspaceArtifacts: sourceRows.length,
    changedArtifacts: changed.length,
    missingArtifacts: missing.length,
    newArtifacts: added.length,
    examples
  };
}

async function collectCatalogSourceSnapshot(
  status: LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }
): Promise<CatalogSourceSnapshotRow[]> {
  const paths = new Set<string>();
  paths.add(toPortableRelativePath(status.root, status.manifestPath));

  for (const directory of Object.values(status.manifest.directories)) {
    for (const file of await listWorkspaceJsonFiles(resolve(status.root, directory))) {
      paths.add(toPortableRelativePath(status.root, file));
    }
  }

  const rows: CatalogSourceSnapshotRow[] = [];
  for (const path of [...paths].sort()) {
    const fileStatus = await stat(resolveUnderRoot(status.root, path));
    rows.push({
      path,
      byteLength: fileStatus.size,
      mtimeMs: Math.round(fileStatus.mtimeMs)
    });
  }
  return rows;
}

async function listWorkspaceJsonFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(path);
      }
    }
  }

  await walk(root);
  return files.sort();
}

function markCatalogFreshness(freshness: WorkspaceCatalogFreshness, row: CatalogStatusRow): WorkspaceCatalogFreshness {
  if (!row.stale_at) {
    return freshness;
  }

  return {
    ...freshness,
    stale: true,
    examples: [`marked:${row.stale_reason ?? "workspace artifact changed"}${row.stale_path ? `:${row.stale_path}` : ""}`, ...freshness.examples].slice(0, 8)
  };
}

function uncheckedCatalogFreshness(indexedArtifacts: number, stale: boolean, row?: CatalogStatusRow): WorkspaceCatalogFreshness {
  return {
    checked: false,
    stale,
    indexedArtifacts,
    changedArtifacts: 0,
    missingArtifacts: 0,
    newArtifacts: 0,
    examples: row?.stale_at ? [`marked:${row.stale_reason ?? "workspace artifact changed"}${row.stale_path ? `:${row.stale_path}` : ""}`] : []
  };
}

async function appendWorkspaceCatalogEvent<T extends WorkspaceCatalogUpsertResult | WorkspaceCatalogStaleResult>(
  input: WorkspaceCatalogUpsertInput,
  result: T
): Promise<T> {
  try {
    await appendArtifactWriteEvent({
      rootPath: input.rootPath,
      path: result.path ?? input.path,
      kind: result.kind ?? input.kind,
      artifactId: "artifactId" in result ? result.artifactId : undefined,
      summary: input.staleReason ?? "workspace artifact written",
      now: input.now
    });
    return result;
  } catch (error) {
    return {
      ...result,
      warnings: [
        ...result.warnings,
        `Event log could not be appended: ${error instanceof Error ? error.message : String(error)}. Artifact write remains canonical.`
      ]
    };
  }
}

function catalogFreshnessWarnings(freshness: WorkspaceCatalogFreshness): string[] {
  const warnings = [...catalogWarnings()];
  if (freshness.stale) {
    warnings.unshift(
      freshness.checked
        ? `Catalog is stale: ${freshness.changedArtifacts} changed, ${freshness.newArtifacts} new, ${freshness.missingArtifacts} missing workspace artifacts. Rebuild required before relying on search completeness.`
        : "Catalog is stale because a workspace artifact write invalidated the cache. Rebuild required before relying on search completeness."
    );
    if (freshness.examples.length > 0) {
      warnings.unshift(`Catalog freshness examples: ${freshness.examples.join(", ")}.`);
    }
  }
  return warnings;
}

function readCatalogStatusRow(db: Database.Database): CatalogStatusRow {
  const meta = db.prepare("SELECT key, value FROM catalog_meta").all() as Array<{ key: string; value: string }>;
  const values = new Map(meta.map((row) => [row.key, row.value]));
  return {
    schema_version: values.get("schemaVersion"),
    last_rebuilt_at: values.get("rebuiltAt"),
    stale_at: optionalMetaValue(values.get("staleAt")),
    stale_reason: optionalMetaValue(values.get("staleReason")),
    stale_path: optionalMetaValue(values.get("stalePath")),
    stale_kind: optionalMetaValue(values.get("staleKind")),
    artifact_count: parseInteger(values.get("artifactCount")),
    claim_count: parseInteger(values.get("claimCount")),
    route_count: parseInteger(values.get("routeCount"))
  };
}

function writeCatalogMeta(db: Database.Database, key: string, value: string): void {
  db.prepare("INSERT INTO catalog_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
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

function optionalMetaValue(value: string | undefined): string | undefined {
  return value && value.trim() ? value : undefined;
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

function workspaceRelativePath(root: string, path: string): string {
  return toPortableRelativePath(root, resolveUnderRoot(root, path));
}

function normalizePortablePath(value: string): string {
  return relative("", value).split(sep).join("/");
}

function toPortableRelativePath(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

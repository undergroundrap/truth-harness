# Truth Harness Catalog Index Design

Date: 2026-06-14

## Goal

Add a rebuildable SQLite catalog under `.truth-harness/indexes/catalog.db` so large workspaces can search, filter, graph, and hand off work quickly without weakening the core evidence model.

The catalog is not the source of truth. Canonical JSON artifacts remain authoritative:

```text
.truth-harness/**/*.json -> validation/parsers -> catalog rows -> UI/CLI/MCP queries
```

If the catalog is deleted, corrupt, stale, or produced by an old schema, Truth Harness should rebuild it from local JSON artifacts.

## Research Findings

SQLite is a good fit for this layer because it is local, portable, transactional, and already designed for embedded application data. WAL mode is attractive for a long-running local web UI because readers do not block writers and writers do not block readers, but WAL also creates `-wal` and `-shm` sidecar files and assumes processes are on the same host, which is fine for `.truth-harness/indexes/` but should be documented. See SQLite's WAL docs: https://www.sqlite.org/wal.html

FTS5 is the right first search engine for local titles, statements, tags, paths, and evidence summaries. It is built into SQLite builds commonly used by Node drivers and is intended for efficient full-text search over large document collections. See SQLite FTS5: https://www.sqlite.org/fts5.html

SQLite JSON1 is useful for selected metadata extraction and future ad hoc queries, but the hot path should use typed columns populated by Truth Harness parsers. Querying raw JSON everywhere would recreate the current parse-everything problem in SQL clothing. See SQLite JSON functions: https://www.sqlite.org/json1.html

Node 22.17 has a built-in `node:sqlite` module, but it is still marked Stability 1.1 / active development and emits an experimental warning in this environment. It is useful as a future no-extra-dependency option, but the production path should hide the driver behind a small catalog adapter. See Node's SQLite docs: https://nodejs.org/download/release/v22.17.0/docs/api/sqlite.html

`better-sqlite3` is the practical first driver if we want clean CLI output today. It is synchronous, has explicit transaction helpers, supports PRAGMA calls, and documents WAL mode for concurrent read/write workloads. It is a native dependency, so the install and Docker story must stay explicit. See better-sqlite3 docs: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md and https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md

## Driver Recommendation

Use a driver boundary:

```ts
interface CatalogDatabase {
  exec(sql: string): void;
  prepare<TParams, TResult>(sql: string): CatalogStatement<TParams, TResult>;
  transaction<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult): (...args: TArgs) => TResult;
  close(): void;
}
```

First implementation:

- Use `better-sqlite3` behind the boundary for clean CLI output and mature transaction ergonomics.
- Do not expose arbitrary SQL to users or agents.
- Do not load SQLite extensions.
- Keep existing JSON-scan commands (`workspace validate`, `workspace graph`, `claim list`, `route list`) independent from the catalog so missing or stale indexes never hide evidence.
- Keep the catalog rebuildable so switching to stable `node:sqlite` later is a local driver change, not an architecture change.

This is a better fit than making `node:sqlite` the public dependency today because the current runtime prints an experimental warning as soon as the module is imported. `npm audit --json` reported 0 vulnerabilities after adding `better-sqlite3`; the driver remains isolated so dependency policy can change later without rewriting catalog callers.

## Catalog File

Default path:

```text
.truth-harness/indexes/catalog.db
```

Possible sidecars:

```text
.truth-harness/indexes/catalog.db-wal
.truth-harness/indexes/catalog.db-shm
```

These are local cache files. They should be git-ignored, safe to delete, and rebuildable.

## Schema Sketch

Use typed tables for common routes, and FTS for search.

```sql
CREATE TABLE catalog_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE artifacts (
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

CREATE TABLE claims (
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

CREATE TABLE routes (
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

CREATE TABLE artifact_tags (
  path TEXT NOT NULL REFERENCES artifacts(path) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (path, tag)
) STRICT;

CREATE TABLE artifact_refs (
  from_path TEXT NOT NULL REFERENCES artifacts(path) ON DELETE CASCADE,
  to_ref TEXT NOT NULL,
  ref_kind TEXT,
  edge_kind TEXT NOT NULL,
  field_path TEXT NOT NULL,
  resolved INTEGER NOT NULL
) STRICT;

CREATE VIRTUAL TABLE artifact_fts USING fts5(
  path UNINDEXED,
  title,
  body,
  tags,
  tokenize = 'unicode61'
);
```

Add indexes:

```sql
CREATE INDEX artifacts_kind_idx ON artifacts(kind);
CREATE INDEX artifacts_trust_idx ON artifacts(trust);
CREATE INDEX artifacts_updated_idx ON artifacts(updated_at);
CREATE INDEX claims_domain_trust_idx ON claims(domain, trust);
CREATE INDEX routes_final_trust_idx ON routes(final_trust);
CREATE INDEX refs_to_ref_idx ON artifact_refs(to_ref);
```

## Privacy And Safety Rules

1. Canonical JSON stays authoritative.
2. The catalog may duplicate private metadata, so it must stay under `.truth-harness/indexes/`.
3. Never index vault plaintext.
4. Do not index full stdout/stderr or large notebook outputs by default; store capped summaries and hashes.
5. Use prepared statements only.
6. Escape or parameterize FTS queries; never concatenate raw user input into `MATCH`.
7. Catalog rebuilds must not contact the network.
8. Catalog rows do not upgrade trust labels.
9. A missing or stale catalog must never make evidence disappear; catalog-specific search can require rebuild, while canonical JSON-scan commands remain available.

## Rebuild Algorithm

Phase 1 should be rebuild-only:

1. Require workspace.
2. Run the existing workspace validation scan.
3. For each known JSON artifact, read with strict parsers where available.
4. Extract common metadata: path, kind, artifact id, schema version, trust, title, timestamps, tags, refs, validity, issue count, hash, byte length, mtime.
5. Write all catalog changes inside one transaction.
6. Update `catalog_meta` with schema version, project id, rebuild time, artifact count, and root path hash.
7. Return a rebuild report with artifact count, invalid count, elapsed time, and warnings.

Use transactions so failed rebuilds do not leave half-indexed data. Because the catalog is a cache, an old but valid catalog is better than a corrupt partial one.

## Incremental Refresh

Phase 2 can add:

- `catalog refresh`: compare `mtime_ms`, byte length, and sha256 for known JSON files.
- Delete rows for missing files.
- Reparse only changed files.
- Rebuild FTS rows for changed files.
- Keep `catalog_meta.last_refresh_at`.

Do not hook every artifact writer on day one. Keep artifact writers simple until the catalog API is stable.

## CLI And MCP Surface

Initial CLI:

```bash
truth-harness catalog rebuild [workspace] --json
truth-harness catalog status [workspace] --json
truth-harness catalog search [workspace] "fractions exact-computed" --kind claims --trust exact-computed --json
truth-harness catalog query [workspace] --kind route --open-obligations --json
```

Initial MCP:

- `truth_harness_catalog_status`
- `truth_harness_catalog_rebuild`
- `truth_harness_catalog_search`

All outputs should be structured JSON-first and include whether the response came from the catalog, a rebuild requirement, or a catalog error. Canonical JSON-scan commands remain separate fallback workflows.

## Integration Order

1. Add `packages/core/src/workspace-catalog.ts` with schema, rebuild, status, and search. Done.
2. Add CLI `catalog` commands. Done.
3. Add tests proving rebuild determinism, search behavior, corrupt status, FTS escaping, and vault plaintext exclusion. Done.
4. Route web search through catalog if available, fallback to existing APIs.
5. Route `claim list`, `route list`, and visual/artifact search through catalog for large workspaces.
6. Add MCP catalog tools for agents. Done.
7. Add incremental refresh and stale detection.

## Tests

Required tests:

- Rebuild from a temp workspace with receipts, claims, routes, visuals, CAS, SMT, proof, and invalid JSON.
- Delete `catalog.db`, rebuild, and get the same search/query results.
- Corrupt `catalog.db`, status reports degraded and suggests rebuild.
- Search by claim text, tag, trust, domain, route obligation state, artifact kind, and evidence ref.
- FTS query escaping test with quotes, colon, slash, parentheses, and operator-like terms.
- Vault plaintext is not indexed.
- Large stdout/stderr is summarized/capped.
- Workspace validation and graph still pass with or without catalog.
- CLI commands return JSON-first output and exit non-zero only for real catalog failures, not missing optional catalog driver when fallback is allowed.

## Open Decisions

- Whether the web server should auto-refresh the catalog on startup or only show "catalog stale" until the user/agent runs rebuild.
- Whether route/claim writer APIs should eventually update the catalog synchronously or enqueue a refresh marker.
- Whether FTS should include Markdown reports or only canonical JSON summaries.

## Recommendation

Implement the catalog as a rebuildable read/index layer first. Do not mutate existing artifact writers yet. Do not make SQLite canonical. Do not let catalog rows satisfy proof obligations or claim finalization.

The first useful slice should be:

```text
workspace-catalog core module
  -> catalog rebuild/status/search CLI
  -> tests for determinism, stale/corrupt fallback, FTS escaping, and no vault plaintext
```

Once that is solid, the web UI and MCP agent tools can use it for fast search, filters, lineage navigation, and work queues.

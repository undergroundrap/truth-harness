import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createReceipt } from "./receipt.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { markWorkspaceCatalogStale, rebuildWorkspaceCatalog, getWorkspaceCatalogStatus, searchWorkspaceCatalog } from "./workspace-catalog.js";
import { sealVaultFile } from "./vault.js";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { writeVerifierRoute } from "./verifier-route.js";

const roots: string[] = [];
const originalVaultKey = process.env.TRUTH_HARNESS_CATALOG_TEST_KEY;

afterEach(async () => {
  if (originalVaultKey === undefined) {
    delete process.env.TRUTH_HARNESS_CATALOG_TEST_KEY;
  } else {
    process.env.TRUTH_HARNESS_CATALOG_TEST_KEY = originalVaultKey;
  }
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace catalog", () => {
  it("rebuilds a local SQLite index from canonical JSON and searches claims and routes", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Catalog Lab", now: "2026-06-14T00:00:00.000Z" });
    await writeReceipt(root, "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      title: "Reusable fraction sum",
      statement: "3 / 4 + 5 / 8 equals 11 / 8.",
      domain: "math",
      tags: ["fractions", "exact-arithmetic"],
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/fraction.json" }],
      now: "2026-06-14T00:00:02.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      timeoutMs: 50,
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      now: new Date("2026-06-14T00:00:03.000Z")
    });

    const rebuild = await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:04.000Z" });
    const status = await getWorkspaceCatalogStatus(root);
    const claimSearch = await searchWorkspaceCatalog({
      rootPath: root,
      query: "fractions",
      kind: "claims",
      trust: "exact-computed",
      tag: "fractions"
    });
    const routeSearch = await searchWorkspaceCatalog({
      rootPath: root,
      kind: "routes",
      limit: 5
    });

    expect(rebuild.schemaVersion).toBe("truth-harness.catalog-rebuild.v0");
    expect(rebuild.validation.passed).toBe(true);
    expect(rebuild.artifactCount).toBeGreaterThanOrEqual(4);
    expect(rebuild.claimCount).toBe(1);
    expect(rebuild.routeCount).toBe(1);
    expect(status).toMatchObject({
      exists: true,
      readable: true,
      stale: false,
      artifactCount: rebuild.artifactCount,
      claimCount: 1,
      routeCount: 1
    });
    const checkedStatus = await getWorkspaceCatalogStatus(root, { checkFiles: true });
    expect(checkedStatus).toMatchObject({
      exists: true,
      readable: true,
      stale: false,
      freshness: {
        checked: true,
        stale: false,
        indexedArtifacts: rebuild.artifactCount,
        workspaceArtifacts: rebuild.artifactCount,
        changedArtifacts: 0,
        missingArtifacts: 0,
        newArtifacts: 0
      }
    });
    expect(claimSearch.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(claim.jsonPath, root),
        kind: "claims",
        artifactId: claim.claim.claimId,
        trust: "exact-computed",
        domain: "math",
        tags: expect.arrayContaining(["#fractions"])
      })
    );
    expect(routeSearch.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(route.jsonPath, root),
        kind: "routes",
        artifactId: route.route.routeId,
        trust: "exact-computed"
      })
    );
    expect(claimSearch.warnings.join("\n")).toContain("do not upgrade trust labels");
  });

  it("reports missing and corrupt catalogs as rebuildable cache failures", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const missing = await getWorkspaceCatalogStatus(root);

    expect(missing.exists).toBe(false);
    expect(missing.readable).toBe(false);
    expect(missing.stale).toBe(true);

    await mkdir(join(root, ".truth-harness", "indexes"), { recursive: true });
    await writeFile(join(root, ".truth-harness", "indexes", "catalog.db"), "not a sqlite database", "utf8");
    const corrupt = await getWorkspaceCatalogStatus(root);

    expect(corrupt.exists).toBe(true);
    expect(corrupt.readable).toBe(false);
    expect(corrupt.stale).toBe(true);
    expect(corrupt.warnings.join("\n")).toContain("Rebuild required");
  });

  it("marks readable catalogs stale when canonical workspace JSON changes after rebuild", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await writeReceipt(root, "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });

    const fastStatus = await getWorkspaceCatalogStatus(root);
    const freshStatus = await getWorkspaceCatalogStatus(root, { checkFiles: true });

    await writeClaimLedgerRecord({
      rootPath: root,
      statement: "A new claim should make the cache incomplete until rebuild.",
      domain: "math",
      tags: ["freshness"],
      now: "2026-06-14T00:00:02.000Z"
    });

    const markedStatus = await getWorkspaceCatalogStatus(root);
    const staleStatus = await getWorkspaceCatalogStatus(root, { checkFiles: true });

    expect(fastStatus.freshness.checked).toBe(false);
    expect(freshStatus.stale).toBe(false);
    expect(markedStatus.stale).toBe(true);
    expect(markedStatus.invalidation).toMatchObject({
      reason: "claim ledger record written",
      kind: "claims"
    });
    expect(staleStatus.readable).toBe(true);
    expect(staleStatus.stale).toBe(true);
    expect(staleStatus.freshness).toMatchObject({
      checked: true,
      changedArtifacts: 0,
      missingArtifacts: 0,
      newArtifacts: 1
    });
    expect(staleStatus.freshness.examples.join("\n")).toContain("new:.truth-harness/claims/");
    expect(staleStatus.warnings.join("\n")).toContain("Catalog is stale");
    await expect(searchWorkspaceCatalog({ rootPath: root, query: "freshness" })).rejects.toThrow("stale");

    const rebuilt = await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:03.000Z" });
    const rebuiltStatus = await getWorkspaceCatalogStatus(root, { checkFiles: true });
    const searchAfterRebuild = await searchWorkspaceCatalog({ rootPath: root, query: "freshness" });

    expect(rebuilt.artifactCount).toBe(rebuiltStatus.artifactCount);
    expect(rebuiltStatus.stale).toBe(false);
    expect(rebuiltStatus.invalidatedAt).toBeUndefined();
    expect(searchAfterRebuild.results).toContainEqual(expect.objectContaining({ kind: "claims" }));
  });

  it("marks an existing catalog stale without creating a canonical artifact", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await writeReceipt(root, "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });

    const mark = await markWorkspaceCatalogStale({
      rootPath: root,
      reason: "external agent wrote a receipt",
      path: ".truth-harness/receipts/fraction.json",
      kind: "receipts",
      now: "2026-06-14T00:00:02.000Z"
    });
    const status = await getWorkspaceCatalogStatus(root);

    expect(mark).toMatchObject({
      schemaVersion: "truth-harness.catalog-stale.v0",
      exists: true,
      marked: true,
      staleAt: "2026-06-14T00:00:02.000Z"
    });
    expect(status).toMatchObject({
      readable: true,
      stale: true,
      invalidatedAt: "2026-06-14T00:00:02.000Z",
      invalidation: {
        reason: "external agent wrote a receipt",
        path: ".truth-harness/receipts/fraction.json",
        kind: "receipts"
      }
    });
    await expect(searchWorkspaceCatalog({ rootPath: root, query: "fraction" })).rejects.toThrow("stale");
  });

  it("does not index vault plaintext and escapes hostile-looking FTS queries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const secretPath = join(root, "private-source.json");
    await writeFile(secretPath, "{\"private\":\"secret-molecule-candidate\"}\n", "utf8");
    process.env.TRUTH_HARNESS_CATALOG_TEST_KEY = "catalog-test-passphrase";
    await sealVaultFile({
      rootPath: root,
      sourcePath: "private-source.json",
      label: "Private sealed research note",
      keyEnv: "TRUTH_HARNESS_CATALOG_TEST_KEY",
      now: "2026-06-14T00:00:01.000Z"
    });
    await writeClaimLedgerRecord({
      rootPath: root,
      statement: "Catalog FTS escaping should not execute user syntax.",
      domain: "security",
      tags: ["fts-safety"],
      now: "2026-06-14T00:00:02.000Z"
    });

    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:03.000Z" });
    const secretSearch = await searchWorkspaceCatalog({ rootPath: root, query: "secret-molecule-candidate" });
    const escapedSearch = await searchWorkspaceCatalog({
      rootPath: root,
      query: "\"fts-safety\" claim:route (x/y)",
      tag: "#fts-safety"
    });

    expect(secretSearch.results).toHaveLength(0);
    expect(escapedSearch.results).toHaveLength(0);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-catalog-"));
  roots.push(root);
  return root;
}

async function writeReceipt(root: string, name: string, receipt: unknown): Promise<void> {
  const receiptsDir = join(root, ".truth-harness", "receipts");
  await mkdir(receiptsDir, { recursive: true });
  await writeFile(join(receiptsDir, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

function normalizePath(path: string, root: string): string {
  return path.slice(root.length + 1).replace(/\\/g, "/");
}

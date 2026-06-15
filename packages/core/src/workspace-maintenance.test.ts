import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeJsonFileAtomic } from "./fs-util.js";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  archiveLocalWorkspace,
  cleanLocalWorkspace,
  listLocalWorkspaceArchives,
  repairWorkspaceArtifacts,
  restoreLocalWorkspaceArchive
} from "./workspace-maintenance.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { writeVerifierRoute } from "./verifier-route.js";
import { writeVisualArtifact } from "./visual-artifact.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace maintenance", () => {
  it("repairs legacy route manifest metadata and prompt-derived visual refs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-15T00:01:00.000Z")
    });
    const legacyRoute = JSON.parse(await readFile(route.jsonPath, "utf8")) as Record<string, unknown>;
    const legacyManifest = legacyRoute.manifest as Record<string, unknown>;
    delete legacyManifest.deterministicCount;
    delete legacyManifest.replayDeterministicCount;
    delete legacyManifest.machineContract;
    await writeJsonFileAtomic(route.jsonPath, legacyRoute);

    const visual = await writeVisualArtifact({
      rootPath: root,
      title: "Prompt plot",
      kind: "plot",
      renderer: { engine: "plotly", adapter: "test" },
      sourceRefs: [{ kind: "receipt", ref: "prompt:compute 3 / 4 + 5 / 8", label: "Prompt input" }],
      payload: {
        format: "plotly-json",
        content: { data: [], layout: {} }
      },
      tags: ["test"],
      now: "2026-06-15T00:02:00.000Z"
    });

    const before = await validateWorkspaceArtifacts({ rootPath: root });
    expect(before.passed).toBe(false);
    expect(before.issues.some((issue) => issue.path.endsWith(route.jsonPath.split(/[\\/]/u).pop() ?? ""))).toBe(true);
    expect(before.issues.some((issue) => issue.message.includes("receipt:prompt:compute"))).toBe(true);

    const dryRun = await repairWorkspaceArtifacts({
      rootPath: root,
      dryRun: true,
      now: "2026-06-15T00:03:00.000Z"
    });
    expect(dryRun.actions).toHaveLength(2);
    expect(dryRun.repaired).toBe(false);
    expect((JSON.parse(await readFile(visual.jsonPath, "utf8")) as { sourceRefs: Array<{ kind: string }> }).sourceRefs[0]?.kind).toBe(
      "receipt"
    );

    const repaired = await repairWorkspaceArtifacts({
      rootPath: root,
      now: "2026-06-15T00:04:00.000Z"
    });
    expect(repaired.repaired).toBe(true);
    expect(repaired.actions.map((action) => action.kind).sort()).toEqual(["route-manifest", "visual-source-ref"]);

    const repairedRoute = JSON.parse(await readFile(route.jsonPath, "utf8")) as { manifest: Record<string, unknown> };
    expect(typeof repairedRoute.manifest.deterministicCount).toBe("number");
    expect(typeof repairedRoute.manifest.replayDeterministicCount).toBe("number");
    expect(repairedRoute.manifest.machineContract).toMatchObject({
      jsonFirst: true,
      diagnosticsAreStructured: true
    });
    const repairedVisual = JSON.parse(await readFile(visual.jsonPath, "utf8")) as { sourceRefs: Array<{ kind: string }> };
    expect(repairedVisual.sourceRefs[0]?.kind).toBe("manual");

    const after = await validateWorkspaceArtifacts({ rootPath: root });
    expect(after.passed).toBe(true);
  });

  it("cleans scratch data only after explicit confirmation and preserves evidence by default", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });
    const indexFile = join(root, ".truth-harness", "indexes", "catalog.db");
    const validationFile = join(root, ".truth-harness", "validation", "workspace.json");
    const receiptFile = join(root, ".truth-harness", "receipts", "keep.json");
    await mkdir(join(root, ".truth-harness", "indexes"), { recursive: true });
    await mkdir(join(root, ".truth-harness", "validation"), { recursive: true });
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    await writeFile(indexFile, "cache", "utf8");
    await writeFile(validationFile, "validation", "utf8");
    await writeFile(receiptFile, "receipt", "utf8");

    const dryRun = await cleanLocalWorkspace({ rootPath: root });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.deletedFiles).toBe(0);
    expect(await pathExists(indexFile)).toBe(true);
    expect(await pathExists(validationFile)).toBe(true);
    expect(await pathExists(receiptFile)).toBe(true);

    const cleaned = await cleanLocalWorkspace({ rootPath: root, dryRun: false });
    expect(cleaned.resolvedDirectories).toEqual(["indexes", "validation", "snapshots"]);
    expect(cleaned.deletedFiles).toBe(2);
    expect(await pathExists(indexFile)).toBe(false);
    expect(await pathExists(validationFile)).toBe(false);
    expect(await pathExists(receiptFile)).toBe(true);
  });

  it("archives selected evidence locally before destructive cleanup", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });
    const receiptFile = join(root, ".truth-harness", "receipts", "keep.json");
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    await writeFile(receiptFile, JSON.stringify({ schemaVersion: "test.receipt.v0", id: "keep" }), "utf8");

    const archive = await archiveLocalWorkspace({
      rootPath: root,
      targets: ["evidence"],
      now: "2026-06-15T00:05:00.000Z",
      reason: "fresh start test"
    });
    const archivedReceiptFile = join(root, ".truth-harness", "archives", archive.archiveId, "receipts", "keep.json");
    const archiveManifest = join(root, ".truth-harness", "archives", archive.archiveId, "archive-manifest.json");
    expect(archive.schemaVersion).toBe("truth-harness.workspace-archive.v0");
    expect(archive.archiveId).toBe("archive_20260615T000500000Z");
    expect(archive.archivedFiles).toBe(1);
    expect(archive.files).toHaveLength(1);
    expect(archive.files[0]?.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(await pathExists(archivedReceiptFile)).toBe(true);
    expect(await pathExists(archiveManifest)).toBe(true);
    const archives = await listLocalWorkspaceArchives({ rootPath: root });
    expect(archives.total).toBe(1);
    expect(archives.damaged).toBe(0);
    expect(archives.archives[0]).toMatchObject({
      archiveId: archive.archiveId,
      damaged: false,
      totalFiles: 1,
      totalBytes: expect.any(Number)
    });

    const cleaned = await cleanLocalWorkspace({ rootPath: root, targets: ["evidence"], dryRun: false });
    expect(cleaned.deletedFiles).toBe(1);
    expect(await pathExists(receiptFile)).toBe(false);
    expect(await pathExists(archivedReceiptFile)).toBe(true);

    const restorePreview = await restoreLocalWorkspaceArchive({
      rootPath: root,
      archiveRef: archive.archiveId,
      targets: ["receipts"],
      dryRun: true
    });
    expect(restorePreview.dryRun).toBe(true);
    expect(restorePreview.restoredFiles).toBe(0);
    expect(restorePreview.conflicts).toEqual([]);
    expect(restorePreview.verifiedFiles).toBe(1);
    expect(restorePreview.entries).toContainEqual(
      expect.objectContaining({
        directory: "receipts",
        files: 1,
        conflicts: 0,
        restored: false
      })
    );
    expect(await pathExists(receiptFile)).toBe(false);
    await writeFile(receiptFile, JSON.stringify({ schemaVersion: "test.receipt.v0", id: "newer-live-file" }), "utf8");

    const conflictPreview = await restoreLocalWorkspaceArchive({
      rootPath: root,
      archiveRef: archive.manifestPath,
      targets: ["receipts"],
      dryRun: true
    });
    expect(conflictPreview.conflicts).toContainEqual(
      expect.objectContaining({
        path: ".truth-harness/receipts/keep.json",
        reason: "target-exists"
      })
    );
    await expect(
      restoreLocalWorkspaceArchive({
        rootPath: root,
        archiveRef: archive.manifestPath,
        targets: ["receipts"],
        dryRun: false
      })
    ).rejects.toThrow("Archive restore has 1 conflict");

    const restored = await restoreLocalWorkspaceArchive({
      rootPath: root,
      archiveRef: archive.manifestPath,
      targets: ["receipts"],
      dryRun: false,
      overwrite: true
    });
    expect(restored.restoredFiles).toBe(1);
    expect(restored.overwrite).toBe(true);
    expect(await pathExists(receiptFile)).toBe(true);
    expect(await readFile(receiptFile, "utf8")).toContain("\"keep\"");
  });

  it("lists damaged archives and blocks tampered archive restore", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });
    const receiptFile = join(root, ".truth-harness", "receipts", "keep.json");
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    await writeFile(receiptFile, JSON.stringify({ schemaVersion: "test.receipt.v0", id: "keep" }), "utf8");

    const archive = await archiveLocalWorkspace({
      rootPath: root,
      targets: ["receipts"],
      now: "2026-06-15T00:05:00.000Z"
    });
    const damagedDir = join(root, ".truth-harness", "archives", "archive_damaged");
    await mkdir(damagedDir, { recursive: true });
    await writeFile(join(damagedDir, "archive-manifest.json"), "{not-json", "utf8");

    const archives = await listLocalWorkspaceArchives({ rootPath: root });
    expect(archives.total).toBe(2);
    expect(archives.damaged).toBe(1);
    expect(archives.archives).toContainEqual(
      expect.objectContaining({
        archiveId: "archive_damaged",
        damaged: true
      })
    );

    await cleanLocalWorkspace({ rootPath: root, targets: ["receipts"], dryRun: false });
    const archivedReceiptFile = join(root, ".truth-harness", "archives", archive.archiveId, "receipts", "keep.json");
    await writeFile(archivedReceiptFile, JSON.stringify({ schemaVersion: "test.receipt.v0", id: "tampered" }), "utf8");
    const restorePreview = await restoreLocalWorkspaceArchive({
      rootPath: root,
      archiveRef: archive.archiveId,
      targets: ["receipts"],
      dryRun: true
    });
    expect(restorePreview.conflicts).toContainEqual(
      expect.objectContaining({
        path: `.truth-harness/archives/${archive.archiveId}/receipts/keep.json`,
        reason: "hash-mismatch"
      })
    );
    await expect(
      restoreLocalWorkspaceArchive({
        rootPath: root,
        archiveRef: archive.archiveId,
        targets: ["receipts"],
        dryRun: false,
        overwrite: true
      })
    ).rejects.toThrow("Archive restore has 1 conflict");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-maintenance-"));
  roots.push(root);
  return root;
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

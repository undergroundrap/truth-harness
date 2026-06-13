import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  createWorkspaceSnapshot,
  listWorkspaceSnapshots,
  verifyWorkspaceSnapshot,
  writeWorkspaceSnapshot
} from "./workspace-snapshot.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace snapshots", () => {
  it("creates a portable hash manifest for local workspace artifacts", async () => {
    const root = await tempRoot();
    const initialized = await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await writeJson(join(root, initialized.manifest.directories.receipts, "demo-receipt.json"), {
      schemaVersion: "truth-harness.receipt.v0",
      runId: "run_demo",
      trust: "exact-computed"
    });

    const snapshot = await createWorkspaceSnapshot({
      rootPath: root,
      now: "2026-06-08T01:00:00.000Z"
    });

    expect(snapshot.schemaVersion).toBe("truth-harness.workspace-snapshot.v0");
    expect(snapshot.snapshotId).toMatch(/^snap_[a-f0-9]{16}$/);
    expect(snapshot.workspaceDir).toBe(".truth-harness");
    expect(snapshot.privacy.mode).toBe("local-only");
    expect(snapshot.summary.byKind.manifest).toBe(1);
    expect(snapshot.summary.byKind.receipts).toBe(1);
    expect(snapshot.summary.bySchema["truth-harness.receipt.v0"]).toBe(1);
    expect(snapshot.entries.map((entry) => entry.path)).toContain(".truth-harness/receipts/demo-receipt.json");
    expect(snapshot.entries.every((entry) => !entry.path.startsWith(".truth-harness/snapshots/"))).toBe(true);
  });

  it("writes, lists, and verifies snapshots without self-referencing snapshot files", async () => {
    const root = await tempRoot();
    const initialized = await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await writeJson(join(root, initialized.manifest.directories.audits, "demo-audit.json"), {
      schemaVersion: "truth-harness.evidence-audit.v0",
      auditId: "audit_demo"
    });

    const write = await writeWorkspaceSnapshot({
      rootPath: root,
      now: "2026-06-08T01:00:00.000Z"
    });
    const list = await listWorkspaceSnapshots(root);
    const verification = await verifyWorkspaceSnapshot({
      rootPath: root,
      snapshotRef: write.snapshot.snapshotId,
      now: "2026-06-08T01:30:00.000Z"
    });

    expect(write.path).toContain(".truth-harness");
    expect(JSON.parse(await readFile(write.path, "utf8")).snapshotId).toBe(write.snapshot.snapshotId);
    expect(list).toHaveLength(1);
    expect(list[0]?.snapshotId).toBe(write.snapshot.snapshotId);
    expect(list[0]?.path).toContain(".truth-harness/snapshots/");
    expect(verification.passed).toBe(true);
    expect(verification.checked).toBe(write.snapshot.entries.length);
    expect(verification.changed).toEqual([]);
    expect(verification.missing).toEqual([]);
    expect(verification.addedSinceSnapshot).toEqual([]);
  });

  it("detects changed, missing, and added local artifacts", async () => {
    const root = await tempRoot();
    const initialized = await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const artifactDir = join(root, initialized.manifest.directories.artifacts);
    const changedPath = join(artifactDir, "changed.json");
    const missingPath = join(artifactDir, "missing.json");
    const addedPath = join(artifactDir, "added.json");
    await mkdir(artifactDir, { recursive: true });
    await writeJson(changedPath, { schemaVersion: "truth-harness.artifact.v0", documentId: "doc_changed", value: 1 });
    await writeJson(missingPath, { schemaVersion: "truth-harness.artifact.v0", documentId: "doc_missing", value: 1 });
    const snapshot = await writeWorkspaceSnapshot({
      rootPath: root,
      now: "2026-06-08T01:00:00.000Z"
    });

    await writeJson(changedPath, { schemaVersion: "truth-harness.artifact.v0", documentId: "doc_changed", value: 2 });
    await rm(missingPath);
    await writeJson(addedPath, { schemaVersion: "truth-harness.artifact.v0", documentId: "doc_added", value: 1 });

    const verification = await verifyWorkspaceSnapshot({
      rootPath: root,
      snapshotRef: snapshot.snapshot.snapshotId,
      now: "2026-06-08T01:30:00.000Z"
    });

    expect(verification.passed).toBe(false);
    expect(verification.changed.map((entry) => entry.path)).toEqual([".truth-harness/artifacts/changed.json"]);
    expect(verification.changed[0]?.expectedSha256).not.toBe(verification.changed[0]?.actualSha256);
    expect(verification.missing.map((entry) => entry.path)).toEqual([".truth-harness/artifacts/missing.json"]);
    expect(verification.addedSinceSnapshot.map((entry) => entry.path)).toEqual([".truth-harness/artifacts/added.json"]);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-snapshot-"));
  roots.push(root);
  return root;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

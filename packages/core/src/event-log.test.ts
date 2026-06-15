import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendArtifactWriteEvent, appendWorkspaceEvent, listWorkspaceEvents } from "./event-log.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { verifyWorkspaceSnapshot, writeWorkspaceSnapshot } from "./workspace-snapshot.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace event log", () => {
  it("appends local artifact-write events with artifact identity", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });
    await mkdir(join(root, ".truth-harness", "claims"), { recursive: true });
    const claimPath = join(root, ".truth-harness", "claims", "claim.json");
    await writeFile(claimPath, "{\"schemaVersion\":\"truth-harness.claim.v0\",\"claimId\":\"claim_demo\"}\n", "utf8");

    const append = await appendArtifactWriteEvent({
      rootPath: root,
      path: ".truth-harness/claims/claim.json",
      kind: "claims",
      artifactId: "claim_demo",
      summary: "claim written",
      now: "2026-06-15T01:00:00.000Z"
    });
    const list = await listWorkspaceEvents(root);
    const raw = await readFile(append.logPath, "utf8");

    expect(append.event).toMatchObject({
      schemaVersion: "truth-harness.event.v0",
      action: "artifact-written",
      path: ".truth-harness/claims/claim.json",
      kind: "claims",
      artifactId: "claim_demo",
      localOnly: true,
      networkAccess: "none"
    });
    expect(append.event.artifact?.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(append.event.artifact?.byteLength).toBeGreaterThan(0);
    expect(raw.trim().split(/\r?\n/u)).toHaveLength(1);
    expect(list.total).toBe(1);
    expect(list.events[0]?.eventId).toBe(append.event.eventId);
  });

  it("serializes concurrent appends into valid JSON lines", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        appendWorkspaceEvent({
          rootPath: root,
          action: "workspace-initialized",
          summary: `event ${index}`,
          now: `2026-06-15T01:00:0${index}.000Z`,
          actor: { kind: "agent", name: `agent-${index}` }
        })
      )
    );
    const list = await listWorkspaceEvents(root);

    expect(list.total).toBe(8);
    expect(list.warnings).toEqual([]);
    expect(new Set(list.events.map((event) => event.eventId)).size).toBe(8);
  });

  it("rejects artifact event paths outside the workspace root", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });

    await expect(
      appendArtifactWriteEvent({
        rootPath: root,
        path: "../outside.json",
        now: "2026-06-15T01:00:00.000Z"
      })
    ).rejects.toThrow("escapes workspace root");
  });

  it("keeps mutable event logs out of snapshot verification for now", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-15T00:00:00.000Z" });
    const snapshot = await writeWorkspaceSnapshot({ rootPath: root, now: "2026-06-15T01:00:00.000Z" });

    await appendWorkspaceEvent({
      rootPath: root,
      action: "workspace-initialized",
      summary: "Event tail changed after snapshot.",
      now: "2026-06-15T01:30:00.000Z"
    });
    const verification = await verifyWorkspaceSnapshot({
      rootPath: root,
      snapshotRef: snapshot.snapshot.snapshotId,
      now: "2026-06-15T02:00:00.000Z"
    });

    expect(snapshot.snapshot.entries.every((entry) => !entry.path.startsWith(".truth-harness/events/"))).toBe(true);
    expect(verification.passed).toBe(true);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-events-"));
  roots.push(root);
  return root;
}

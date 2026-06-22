import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rebuildWorkspaceCatalog, searchWorkspaceCatalog } from "./workspace-catalog.js";
import { createReceipt } from "./receipt.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import {
  listWorkspaceRevisions,
  readWorkspaceRevision,
  verifyWorkspaceRevision,
  writeWorkspaceRevision
} from "./workspace-revision.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace revisions", () => {
  it("writes a hash-backed revision manifest that validation and catalog search can reopen", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Revision Lab", now: "2026-06-21T00:00:00.000Z" });
    await writeWorkspaceJson(root, "receipts", "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));

    const parent = await writeWorkspaceRevision({
      rootPath: root,
      title: "Parent evidence checkpoint",
      reason: "Stable proof state before a follow-up branch.",
      artifactRefs: [
        {
          path: ".truth-harness/receipts/fraction.json",
          role: "checked-receipt",
          source: "workspace-revision-test"
        }
      ],
      now: "2026-06-21T00:05:00.000Z"
    });
    const child = await writeWorkspaceRevision({
      rootPath: root,
      title: "Agent handoff checkpoint",
      reason: "Resume the next proof blocker from a fixed local evidence state.",
      parentRevisionRefs: [parent.revision.revisionId],
      sessionRefs: ["rs_revision_demo"],
      validationPlanRefs: ["vp_revision_demo"],
      claimRefs: ["claim_revision_demo"],
      artifactRefs: [
        {
          path: ".truth-harness/receipts/fraction.json",
          role: "checked-receipt",
          source: "workspace-revision-test"
        }
      ],
      now: "2026-06-21T00:06:00.000Z"
    });

    const list = await listWorkspaceRevisions(root);
    const readBack = await readWorkspaceRevision(root, child.revision.revisionId);
    const verification = await verifyWorkspaceRevision({
      rootPath: root,
      revisionRef: child.revision.revisionId,
      now: "2026-06-21T00:07:00.000Z"
    });
    const validation = await validateWorkspaceArtifacts({ rootPath: root, now: "2026-06-21T00:08:00.000Z" });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-21T00:09:00.000Z" });
    const titleSearch = await searchWorkspaceCatalog({
      rootPath: root,
      kind: "revisions",
      query: "Agent handoff checkpoint"
    });
    const parentRefSearch = await searchWorkspaceCatalog({
      rootPath: root,
      kind: "revisions",
      ref: parent.revision.revisionId
    });

    expect(parent.revision.revisionId).toMatch(/^rev_[a-f0-9]{16}$/u);
    expect(child.revision).toMatchObject({
      schemaVersion: "truth-harness.workspace-revision.v0",
      title: "Agent handoff checkpoint",
      reason: "Resume the next proof blocker from a fixed local evidence state.",
      parentRevisionRefs: [parent.revision.revisionId],
      snapshotRefs: [expect.stringMatching(/^snap_[a-f0-9]{16}$/u)]
    });
    expect(child.revision.sourceSnapshot).toMatchObject({
      path: expect.stringContaining(".truth-harness/snapshots/"),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    expect(child.revision.artifactRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".truth-harness/receipts/fraction.json",
          role: "checked-receipt",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          citation: expect.stringContaining(".truth-harness/receipts/fraction.json sha256:")
        }),
        expect.objectContaining({
          path: child.revision.sourceSnapshot.path,
          role: "source-snapshot",
          sha256: child.revision.sourceSnapshot.sha256
        })
      ])
    );
    expect(JSON.parse(await readFile(child.path, "utf8")).revisionId).toBe(child.revision.revisionId);
    expect(list.map((revision) => revision.revisionId)).toEqual([child.revision.revisionId, parent.revision.revisionId]);
    expect(readBack.revisionId).toBe(child.revision.revisionId);
    expect(verification).toMatchObject({
      revisionId: child.revision.revisionId,
      passed: true,
      sourceSnapshotFile: {
        path: child.revision.sourceSnapshot.path,
        status: "verified"
      },
      snapshotVerification: {
        passed: true,
        addedSinceSnapshot: []
      }
    });
    expect(verification.warnings.join("\n")).toContain("revision history growth does not invalidate older evidence checkpoints");
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.revisions).toBe(2);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "revisions",
        artifactId: child.revision.revisionId,
        valid: true
      })
    );
    expect(titleSearch.results).toContainEqual(
      expect.objectContaining({
        kind: "revisions",
        artifactId: child.revision.revisionId
      })
    );
    expect(parentRefSearch.results).toContainEqual(
      expect.objectContaining({
        kind: "revisions",
        artifactId: child.revision.revisionId
      })
    );
  });

  it("fails revision verification when a source evidence artifact drifts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Revision Drift Lab", now: "2026-06-21T01:00:00.000Z" });
    const receiptPath = join(root, ".truth-harness", "receipts", "fraction.json");
    await writeWorkspaceJson(root, "receipts", "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    const revision = await writeWorkspaceRevision({
      rootPath: root,
      title: "Drift checkpoint",
      reason: "Detect changed evidence before agent resume.",
      artifactRefs: [
        {
          path: ".truth-harness/receipts/fraction.json",
          role: "checked-receipt",
          source: "workspace-revision-test"
        }
      ],
      now: "2026-06-21T01:05:00.000Z"
    });

    await writeFile(receiptPath, `${JSON.stringify(createReceipt("compute 2 + 2"), null, 2)}\n`, "utf8");

    const verification = await verifyWorkspaceRevision({
      rootPath: root,
      revisionRef: revision.revision.revisionId,
      now: "2026-06-21T01:10:00.000Z"
    });

    expect(verification.passed).toBe(false);
    expect(verification.snapshotVerification?.changed).toContainEqual(
      expect.objectContaining({
        path: ".truth-harness/receipts/fraction.json"
      })
    );
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-revision-"));
  roots.push(root);
  return root;
}

async function writeWorkspaceJson(root: string, directory: string, fileName: string, value: unknown): Promise<void> {
  await writeFile(join(root, ".truth-harness", directory, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

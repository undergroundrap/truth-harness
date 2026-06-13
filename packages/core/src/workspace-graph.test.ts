import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeResearchSession } from "./research-session.js";
import { createWorkspaceGraph } from "./workspace-graph.js";
import { writeWorkspaceSnapshot } from "./workspace-snapshot.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace graph", () => {
  it("maps resolved and missing local evidence refs across workspace artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-13T00:00:00.000Z" });
    const snapshot = await writeWorkspaceSnapshot({
      rootPath: root,
      now: "2026-06-13T00:01:00.000Z"
    });
    const base = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "3 / 4 + 5 / 8 = 11 / 8.",
      domain: "math",
      evidenceRefs: [{ kind: "snapshot", ref: snapshot.snapshot.snapshotId }],
      now: "2026-06-13T00:02:00.000Z"
    });
    const derived = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "The fraction result can be reused as a local lemma.",
      domain: "math",
      dependsOn: [base.claim.claimId],
      evidenceRefs: [{ kind: "snapshot", ref: "snap_missing000000" }],
      now: "2026-06-13T00:03:00.000Z"
    });
    const session = await writeResearchSession({
      rootPath: root,
      objective: "Continue exact arithmetic work from local artifacts.",
      domains: ["math"],
      evidenceRefs: [{ kind: "claim", ref: derived.claim.claimId }],
      snapshotRefs: [snapshot.snapshot.snapshotId],
      tasks: ["Attach a formal proof if the claim is promoted."],
      now: "2026-06-13T00:04:00.000Z"
    });

    const graph = await createWorkspaceGraph({
      rootPath: root,
      now: "2026-06-13T00:05:00.000Z"
    });

    expect(graph.schemaVersion).toBe("truth-harness.workspace-graph.v0");
    expect(graph.localOnly).toBe(true);
    expect(graph.networkAccess).toBe("none");
    expect(graph.validation.passed).toBe(false);
    expect(graph.summary.missingRefs).toBeGreaterThanOrEqual(1);
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        kind: "missing-ref",
        label: "snapshot:snap_missing000000",
        missing: true
      })
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        kind: "depends-on",
        ref: base.claim.claimId,
        resolved: true
      })
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        kind: "evidence-ref",
        refKind: "claim",
        ref: derived.claim.claimId,
        sourcePath: expect.stringContaining(session.session.sessionId),
        resolved: true
      })
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        kind: "snapshot-ref",
        ref: snapshot.snapshot.snapshotId,
        resolved: true
      })
    );
    expect(graph.warnings).toContain("Workspace graph is a local provenance map. It does not upgrade trust or prove claims by itself.");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-workspace-graph-"));
  roots.push(root);
  return root;
}

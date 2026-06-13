import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  addResearchSessionCheckpoint,
  createResearchSession,
  listResearchSessions,
  writeResearchSession
} from "./research-session.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { writeWorkspaceReview } from "./workspace-review.js";
import { writeWorkspaceSnapshot } from "./workspace-snapshot.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("research sessions", () => {
  it("creates a local-first research runbook with safety and patent boundaries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const snapshot = await writeWorkspaceSnapshot({
      rootPath: root,
      now: "2026-06-08T00:10:00.000Z"
    });

    const session = await createResearchSession({
      rootPath: root,
      title: "Cancer pathway hypothesis",
      objective: "Investigate whether a simulated cancer pathway perturbation is worth expert review and prior-art search.",
      domains: ["biomedical", "patent"],
      hypotheses: ["A simulated perturbation may lower a toy pathway score."],
      claims: ["The toy simulation produced computational evidence only."],
      evidenceRefs: [{ kind: "snapshot", ref: snapshot.snapshot.snapshotId, summary: "Initial private workspace state." }],
      snapshotRefs: [snapshot.snapshot.snapshotId],
      tasks: ["Create a local evidence audit", "Search prior art before drafting any claim language"],
      maxDepth: 3,
      maxToolCalls: 25,
      now: "2026-06-08T00:20:00.000Z"
    });

    expect(session.schemaVersion).toBe("truth-harness.research-session.v0");
    expect(session.sessionId).toMatch(/^session_[a-f0-9]{16}$/);
    expect(session.privacy.mode).toBe("local-only");
    expect(session.modelPolicy.hostedModels).toBe("optional-with-disclosure");
    expect(session.reviewBoundary.wetLabValidationRequired).toBe(true);
    expect(session.reviewBoundary.patentAttorneyReviewRequired).toBe(true);
    expect(session.budgets.maxUnverifiedFinalClaims).toBe(0);
    expect(session.tasks).toHaveLength(2);
    expect(session.markdown).toContain("# Research Session: Cancer pathway hypothesis");
    expect(session.markdown).toContain("Do not describe biomedical hypotheses as cures");
  });

  it("writes, lists, and checkpoints sessions with merged evidence refs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    const write = await writeResearchSession({
      rootPath: root,
      objective: "Build a proof plan for a parity truth-harness.",
      domains: ["math"],
      evidenceRefs: [{ kind: "receipt", ref: "receipts/seed.json", trust: "unverified" }],
      tasks: ["Formalize the claim", "Run the local parity checker"],
      now: "2026-06-08T00:10:00.000Z"
    });

    const checkpoint = await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: write.session.sessionId,
      summary: "The local parity checker produced an exact modular certificate for the normalized polynomial claim.",
      evidenceRefs: [{ kind: "receipt", ref: "receipts/parity-check.json", trust: "exact-computed" }],
      snapshotRefs: ["snap_0123456789abcdef"],
      decisions: ["Use the exact-check receipt as narrow local evidence while reserving `proved` for Lean."],
      nextChecks: ["Render the receipt into the final report."],
      now: "2026-06-08T00:20:00.000Z"
    });
    const list = await listResearchSessions(root);

    expect(write.jsonPath).toContain(".truth-harness");
    expect(write.markdownPath).toContain(".truth-harness");
    expect(JSON.parse(await readFile(write.jsonPath, "utf8")).sessionId).toBe(write.session.sessionId);
    expect(checkpoint.checkpoint.checkpointId).toMatch(/^chk_[a-f0-9]{16}$/);
    expect(checkpoint.session.evidenceRefs.map((ref) => `${ref.kind}:${ref.ref}`)).toEqual([
      "receipt:receipts/seed.json",
      "receipt:receipts/parity-check.json"
    ]);
    expect(checkpoint.session.snapshotRefs).toEqual(["snap_0123456789abcdef"]);
    expect(checkpoint.markdown).toContain("exact modular certificate");
    expect(list).toHaveLength(1);
    expect(list[0]?.checkpoints).toHaveLength(1);
  });

  it("cites persisted workspace review handoffs from long-running sessions", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-13T00:00:00.000Z" });
    const review = await writeWorkspaceReview({
      rootPath: root,
      now: "2026-06-13T00:05:00.000Z"
    });
    const write = await writeResearchSession({
      rootPath: root,
      objective: "Continue from a persisted agent handoff queue without relying on chat memory.",
      domains: ["math"],
      evidenceRefs: [
        {
          kind: "workspace-review",
          ref: review.review.reviewId,
          summary: "Initial local handoff queue."
        }
      ],
      now: "2026-06-13T00:10:00.000Z"
    });

    const checkpoint = await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: write.session.sessionId,
      summary: "Agent resumed from the persisted workspace review queue.",
      evidenceRefs: [
        {
          kind: "workspace-review",
          ref: review.review.reviewId,
          summary: "Queue used for this continuation."
        }
      ],
      now: "2026-06-13T00:20:00.000Z"
    });
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(checkpoint.session.evidenceRefs).toContainEqual(
      expect.objectContaining({
        kind: "workspace-review",
        ref: review.review.reviewId
      })
    );
    expect(checkpoint.markdown).toContain("workspace-review");
    expect(validation.passed).toBe(true);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-research-session-"));
  roots.push(root);
  return root;
}

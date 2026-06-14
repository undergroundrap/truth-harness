import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { createWorkspaceRunNextPlan } from "./workspace-run-next.js";
import type { WorkspaceReview } from "./workspace-review.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace run-next", () => {
  it("executes bounded local actions without honoring command workspace overrides", async () => {
    const root = await tempRoot();
    const outsideRoot = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "A finance claim needs audited source data before it can be relied on.",
      domain: "finance",
      nextChecks: ["Attach audited source data before using this claim."],
      now: "2026-06-14T00:01:00.000Z"
    });
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness claim review ${claim.claim.claimId} --workspace ${outsideRoot} --json`,
      claimId: claim.claim.claimId
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(plan.localOnly).toBe(true);
    expect(plan.networkAccess).toBe("none");
    expect(plan.status).toBe("executed");
    expect(plan.execution.kind).toBe("claim-review");
    expect(plan.execution.result).toMatchObject({
      claimId: claim.claim.claimId,
      workspacePath: root
    });
  });

  it("blocks queued commands that require shell interpretation", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness claim review claim_fake ; echo unsafe",
      claimId: "claim_fake"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(plan.status).toBe("blocked");
    expect(plan.execution.kind).toBe("unsupported-command");
    expect(plan.execution.summary).toContain("Unsupported shell metacharacter");
  });
});

function minimalReview(input: {
  rootPath: string;
  command: string;
  claimId: string;
}): WorkspaceReview {
  return {
    schemaVersion: "truth-harness.workspace-review.v0",
    reviewId: "wrev_run_next_test",
    projectId: "proj_run_next_test",
    createdAt: "2026-06-14T00:01:00.000Z",
    workspacePath: input.rootPath,
    localOnly: true,
    networkAccess: "none",
    privacy: {
      mode: "local-only",
      localFirst: true,
      networkAccess: "none",
      dataResidency: "local-workspace",
      externalDisclosures: []
    },
    summary: {
      routes: 0,
      claims: 1,
      sessions: 0,
      totalItems: 1,
      routeObligations: 0,
      readyRoutesWithoutClaims: 0,
      blockedClaims: 1,
      sessionTasks: 0,
      sessionNextChecks: 0,
      criticalItems: 0,
      highItems: 1,
      mediumItems: 0,
      lowItems: 0
    },
    autonomy: {
      mode: "human-review-gated",
      canRunUnattended: true,
      suggestedBatchSize: 3,
      nextItemId: "work_run_next_test",
      nextCommand: input.command,
      allowedActions: ["Run only supported local Truth Harness commands."],
      blockedActions: ["Do not use network access."],
      stopConditions: ["Stop when the verifier boundary is reached."],
      requiredArtifacts: [],
      humanReviewRequiredFor: [`claim-blocker:${input.claimId}`],
      agentPacket: "# Test autonomy contract"
    },
    items: [
      {
        itemId: "work_run_next_test",
        kind: "claim-blocker",
        priority: "high",
        title: "Review blocked claim",
        summary: "Test claim review.",
        command: input.command,
        claimId: input.claimId,
        domain: "finance",
        trust: "unverified",
        source: {
          label: "claim ledger",
          ref: input.claimId
        }
      }
    ],
    warnings: [],
    markdown: "# Test review"
  };
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-run-next-"));
  roots.push(root);
  return root;
}

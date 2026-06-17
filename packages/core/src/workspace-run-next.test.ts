import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { createCredibilityPack } from "./credibility-pack.js";
import { listWorkspaceEvents } from "./event-log.js";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  createWorkspaceReviewFromCredibilityPack,
  createWorkspaceRunNextPlan,
  listWorkspaceRunNextPlans,
  readWorkspaceRunNextPlan,
  writeWorkspaceRunNextPlan
} from "./workspace-run-next.js";
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

  it("executes engine verification actions without shell execution", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness engines verify --write --require-maxima --maxima-command truth-harness-missing-maxima-command --timeout-ms 50",
      claimId: "claim_fake"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(plan.status).toBe("executed");
    expect(plan.execution.kind).toBe("engine-verify");
    expect(plan.execution.evidenceRef).toContain("engine-run:.truth-harness/engine-runs/");
    expect(plan.execution.summary).toContain("Wrote engine verification run");
    expect(plan.execution.result).toMatchObject({
      schemaVersion: "truth-harness.engine-run.v0",
      status: "failed",
      report: {
        requiredTotal: 1,
        requiredPassed: 0
      }
    });
  });

  it("adapts credibility action queues into run-next plans", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-14T00:01:00.000Z",
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      timeoutMs: 50,
      engineRequirements: { maxima: true },
      maximaCommand: "truth-harness-missing-maxima-command"
    });
    const review = createWorkspaceReviewFromCredibilityPack({ rootPath: root, pack });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(review.autonomy.nextCommand).toBe("truth-harness engines verify --write --require-maxima");
    expect(review.items[0]).toMatchObject({
      kind: "credibility-action",
      title: "Close required Maxima symbolic cross-check gate"
    });
    expect(plan.item).toMatchObject({
      kind: "credibility-action",
      command: "truth-harness engines verify --write --require-maxima"
    });
    expect(plan.execution.kind).toBe("dry-run");
    expect(plan.warnings.join(" ")).toContain("never executes shell strings");
  });

  it("writes dry-run plans into findings with a local artifact event", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness proof check docs/examples/trivial.lean --write",
      claimId: "claim_fake"
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:02:00.000Z"
    });

    const result = await writeWorkspaceRunNextPlan({ rootPath: root, plan });

    expect(result.plan.planId).toMatch(/^wrn_[a-f0-9]{8}$/u);
    expect(result.jsonPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(result.markdownPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(result.markdown).toContain("# Truth Harness Run-Next Plan");
    expect(result.markdown).toContain("It is not proof, not a trust-label upgrade");
    const parsed = JSON.parse(await readFile(result.jsonPath, "utf8")) as { schemaVersion?: string; planId?: string; dryRun?: boolean };
    expect(parsed).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      planId: result.plan.planId,
      dryRun: true
    });
    const list = await listWorkspaceRunNextPlans(root);
    expect(list).toContainEqual(
      expect.objectContaining({
        planId: result.plan.planId,
        path: expect.stringContaining(`${result.plan.planId}-workspace-run-next.json`),
        dryRun: true,
        executionKind: "dry-run"
      })
    );
    expect(await readWorkspaceRunNextPlan(root, result.plan.planId)).toMatchObject({
      planId: result.plan.planId,
      reviewId: review.reviewId
    });
    expect(await readWorkspaceRunNextPlan(root, list[0]?.path ?? "")).toMatchObject({
      planId: result.plan.planId
    });
    const events = await listWorkspaceEvents(root, 10);
    expect(events.events).toContainEqual(
      expect.objectContaining({
        action: "artifact-written",
        kind: "findings",
        artifactId: result.plan.planId,
        localOnly: true,
        networkAccess: "none"
      })
    );
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

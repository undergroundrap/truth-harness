import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { createWorkspaceResumeIndex } from "./workspace-resume-index.js";
import { createWorkspaceReview } from "./workspace-review.js";
import { createWorkspaceRunNextPlan, writeWorkspaceRunNextPlan } from "./workspace-run-next.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace resume index", () => {
  it("ranks verified saved run-next handoffs before open review and pilot-loop context", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-21T00:00:00.000Z" });
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\n", "utf8");
    await writeFile(
      join(root, "Proofs", "Gap.lean"),
      ["theorem gap : True := by", "  sorry"].join("\n"),
      "utf8"
    );

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-21T00:01:00.000Z"
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-21T00:02:00.000Z"
    });
    const written = await writeWorkspaceRunNextPlan({ rootPath: root, plan });
    const runNextPlanPath = toPortable(root, written.jsonPath);
    const runNextMarkdownPath = toPortable(root, written.markdownPath);
    await writePilotLoopTranscript(root, {
      planId: plan.planId,
      reviewId: plan.reviewId,
      runNextPlanPath,
      runNextMarkdownPath,
      item: plan.item,
      command: plan.item?.command ?? plan.execution.command
    });
    const refreshedPlan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-21T00:02:45.000Z"
    });
    const refreshedWritten = await writeWorkspaceRunNextPlan({ rootPath: root, plan: refreshedPlan });
    const refreshedRunNextPlanPath = toPortable(root, refreshedWritten.jsonPath);

    const index = await createWorkspaceResumeIndex({
      rootPath: root,
      now: "2026-06-21T00:03:00.000Z",
      limit: 8
    });

    expect(index).toMatchObject({
      schemaVersion: "truth-harness.workspace-resume-index.v0",
      localOnly: true,
      networkAccess: "none",
      summary: {
        safeSavedRunNextHandoffs: 1,
        savedRunNextHandoffs: 2,
        pilotLoopTranscripts: 1,
        openReviewItems: expect.any(Number)
      }
    });
    expect(index.summary.openReviewItems).toBeGreaterThan(0);
    expect(index.items[0]).toMatchObject({
      kind: "saved-run-next",
      safeToResume: true,
      command: refreshedPlan.item?.command,
      source: {
        ref: refreshedRunNextPlanPath
      }
    });
    expect(index.items).toContainEqual(
      expect.objectContaining({
        kind: "workspace-review-item",
        title: expect.stringContaining("Lean proof marker")
      })
    );
    expect(index.items).toContainEqual(
      expect.objectContaining({
        kind: "pilot-loop-transcript",
        command: expect.stringContaining("continue-pilot-loop wpl_22222222")
      })
    );
    expect(index.warnings).toContainEqual(expect.stringContaining("navigation only"));
  });

  it("fails closed before workspace initialization", async () => {
    const root = await tempRoot();

    await expect(createWorkspaceResumeIndex({ rootPath: root })).rejects.toThrow("workspace init");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-resume-index-"));
  roots.push(root);
  return root;
}

function toPortable(root: string, path: string): string {
  return relative(root, path).replace(/\\/gu, "/");
}

async function writePilotLoopTranscript(
  root: string,
  input: {
    planId: string;
    reviewId: string;
    runNextPlanPath: string;
    runNextMarkdownPath: string;
    item?: unknown;
    command?: string;
  }
): Promise<void> {
  const findingsDir = join(root, ".truth-harness", "findings");
  await mkdir(findingsDir, { recursive: true });
  const transcript = {
    schemaVersion: "truth-harness.workspace-pilot-loop.v0",
    loopId: "wpl_22222222",
    createdAt: "2026-06-21T00:02:30.000Z",
    completedAt: "2026-06-21T00:02:31.000Z",
    workspacePath: root,
    localOnly: true,
    networkAccess: "none",
    dryRun: true,
    source: "workspace-review",
    maxSteps: 1,
    status: "stopped",
    stopReason: "dry-run",
    summary: {
      plannedSteps: 1,
      executedSteps: 1,
      blockedSteps: 0,
      attachedEvidenceSteps: 0,
      evidenceRefs: []
    },
    stopConditions: ["dry-run"],
    steps: [
      {
        index: 1,
        createdAt: "2026-06-21T00:02:31.000Z",
        reviewId: input.reviewId,
        planId: input.planId,
        runNextPlanPath: input.runNextPlanPath,
        runNextMarkdownPath: input.runNextMarkdownPath,
        ...(input.item ? { item: input.item } : {}),
        execution: {
          status: "planned",
          kind: "dry-run",
          command: input.command,
          summary: "Saved handoff for resume-index test."
        }
      }
    ],
    warnings: ["fixture transcript"]
  };
  await writeFile(join(findingsDir, "2026-06-21-wpl_22222222-workspace-pilot-loop.json"), `${JSON.stringify(transcript, null, 2)}\n`, "utf8");
}

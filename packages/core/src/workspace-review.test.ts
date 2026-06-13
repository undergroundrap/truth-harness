import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { addResearchSessionCheckpoint, writeResearchSession } from "./research-session.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { createWorkspaceReview, listWorkspaceReviews, readWorkspaceReview, writeWorkspaceReview } from "./workspace-review.js";
import { writeVerifierRoute } from "./verifier-route.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace review", () => {
  it("requires a local workspace", async () => {
    const root = await tempRoot();

    await expect(createWorkspaceReview({ rootPath: root })).rejects.toThrow("No Truth Harness workspace found");
  });

  it("orders route obligations and blocked claims into a local work queue", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const blockedRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const readyRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-13T00:02:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    await writeClaimLedgerRecord({
      rootPath: root,
      title: "Unverified biology mechanism",
      statement: "A hypothetical biology mechanism cures hair loss.",
      domain: "biology",
      nextChecks: ["Attach source citations and qualified expert review."],
      now: "2026-06-13T00:03:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-13T00:04:00.000Z"
    });

    expect(review.schemaVersion).toBe("truth-harness.workspace-review.v0");
    expect(review.localOnly).toBe(true);
    expect(review.networkAccess).toBe("none");
    expect(review.summary.routes).toBe(2);
    expect(review.summary.claims).toBe(1);
    expect(review.summary.routeObligations).toBeGreaterThanOrEqual(3);
    expect(review.summary.readyRoutesWithoutClaims).toBe(1);
    expect(review.summary.blockedClaims).toBe(1);
    expect(review.items[0]).toMatchObject({
      kind: "route-obligation",
      priority: "critical",
      routeId: blockedRoute.route.routeId
    });
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "route-ready-claim",
        routeId: readyRoute.route.routeId,
        command: expect.stringContaining("truth-harness claim add")
      })
    );
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "claim-blocker",
        domain: "biology",
        priority: "high",
        command: expect.stringContaining("truth-harness claim review")
      })
    );
    expect(review.markdown).toContain("## Ordered Work Queue");
    expect(review.markdown).toContain("Workspace review is a local planning queue");
  });

  it("does not ask for a ready-route claim after a claim cites that route", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 1 / 2 + 1 / 4",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    await writeClaimLedgerRecord({
      rootPath: root,
      title: "Exact fraction sum",
      statement: "1 / 2 + 1 / 4 = 3/4",
      domain: "math",
      evidenceRefs: [{ kind: "route", ref: route.route.routeId }],
      now: "2026-06-13T00:02:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-13T00:03:00.000Z"
    });

    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        kind: "route-ready-claim",
        routeId: route.route.routeId
      })
    );
    expect(review.summary.readyRoutesWithoutClaims).toBe(0);
  });

  it("honors route and claim limits for bounded agent handoffs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    await writeVerifierRoute({
      rootPath: root,
      problem: "compute 1 / 2 + 1 / 4",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    await writeVerifierRoute({
      rootPath: root,
      problem: "compute 2 / 3 + 1 / 6",
      now: new Date("2026-06-13T00:02:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    await writeClaimLedgerRecord({
      rootPath: root,
      title: "Blocked local claim",
      statement: "A narrow claim still needs review.",
      nextChecks: ["Attach supporting evidence before final use."],
      now: "2026-06-13T00:03:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      now: "2026-06-13T00:04:00.000Z"
    });

    expect(review.summary.routes).toBe(1);
    expect(review.summary.claims).toBe(0);
    expect(review.items.every((item) => item.kind !== "claim-blocker")).toBe(true);
    expect(review.markdown).toContain("## Ordered Work Queue");
  });

  it("includes active research sessions in bounded agent handoffs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const start = await writeResearchSession({
      rootPath: root,
      title: "Exact arithmetic proof route",
      objective: "Turn a reusable fraction computation into auditable proof work.",
      domains: ["math"],
      tasks: ["Attach a Lean proof attempt", "Run a second symbolic checker"],
      now: "2026-06-13T00:01:00.000Z"
    });
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: start.session.sessionId,
      summary: "Initial route exists but the proof gate is still open.",
      nextChecks: ["Attach an accepted Lean or SMT artifact to the route."],
      now: "2026-06-13T00:02:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 1,
      now: "2026-06-13T00:03:00.000Z"
    });
    const skipped = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-13T00:03:00.000Z"
    });

    expect(review.summary.sessions).toBe(1);
    expect(review.summary.sessionTasks).toBe(2);
    expect(review.summary.sessionNextChecks).toBe(1);
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "session-task",
        sessionId: start.session.sessionId,
        title: "Research task: Attach a Lean proof attempt",
        command: expect.stringContaining("truth-harness research show")
      })
    );
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "session-next-check",
        sessionId: start.session.sessionId,
        summary: expect.stringContaining("checkpoint"),
        command: expect.stringContaining(start.session.sessionId)
      })
    );
    expect(review.markdown).toContain("| Sessions | `1` |");
    expect(skipped.summary.sessions).toBe(0);
    expect(skipped.summary.totalItems).toBe(0);
  });

  it("writes review handoff packets into findings without breaking validation", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const result = await writeWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      now: "2026-06-13T00:02:00.000Z"
    });
    const reviews = await listWorkspaceReviews(root);
    const shownById = await readWorkspaceReview(root, result.review.reviewId);
    const shownByPath = await readWorkspaceReview(root, result.jsonPath);
    const stored = JSON.parse(await readFile(result.jsonPath, "utf8")) as { schemaVersion: string; reviewId: string };
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(result.review.reviewId).toMatch(/^wrev_[a-f0-9]{16}$/u);
    expect(result.jsonPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(result.markdownPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(stored.schemaVersion).toBe("truth-harness.workspace-review.v0");
    expect(stored.reviewId).toBe(result.review.reviewId);
    expect(reviews).toContainEqual(
      expect.objectContaining({
        reviewId: result.review.reviewId,
        path: expect.stringContaining(`${result.review.reviewId}-workspace-review.json`),
        totalItems: result.review.summary.totalItems
      })
    );
    expect(shownById.reviewId).toBe(result.review.reviewId);
    expect(shownByPath.reviewId).toBe(result.review.reviewId);
    expect(result.markdown).toContain(`| Review | \`${result.review.reviewId}\` |`);
    expect(validation.passed).toBe(true);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-review-"));
  roots.push(root);
  return root;
}

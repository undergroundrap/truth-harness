import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { createWorkspaceReview } from "./workspace-review.js";
import { writeVerifierRoute } from "./verifier-route.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace review", () => {
  it("requires a local workspace", async () => {
    const root = await tempRoot();

    await expect(createWorkspaceReview({ rootPath: root })).rejects.toThrow("No Theorem workspace found");
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
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
      timeoutMs: 50
    });
    const readyRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-13T00:02:00.000Z"),
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
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

    expect(review.schemaVersion).toBe("theorem.workspace-review.v0");
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
        command: expect.stringContaining("theorem claim add")
      })
    );
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "claim-blocker",
        domain: "biology",
        priority: "high",
        command: expect.stringContaining("theorem claim review")
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
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command",
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
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-review-"));
  roots.push(root);
  return root;
}

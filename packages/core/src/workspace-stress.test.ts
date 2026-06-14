import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runWorkspaceStress } from "./workspace-stress.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace stress", () => {
  it("generates a linked local workspace and measures validation, review, and graph health", async () => {
    const root = await tempRoot();
    const result = await runWorkspaceStress({
      rootPath: root,
      receipts: 12,
      claims: 6,
      routes: 3,
      now: "2026-06-14T00:00:00.000Z"
    });

    expect(result.schemaVersion).toBe("truth-harness.workspace-stress.v0");
    expect(result.localOnly).toBe(true);
    expect(result.networkAccess).toBe("none");
    expect(result.requested).toEqual({ receipts: 12, claims: 6, routes: 3 });
    expect(result.written.receipts).toBe(12);
    expect(result.written.claims).toBe(6);
    expect(result.written.routes).toBe(3);
    expect(result.validation.passed).toBe(true);
    expect(result.validation.checkedFiles).toBeGreaterThanOrEqual(21);
    expect(result.validation.errors).toBe(0);
    expect(result.graph.missingRefs).toBe(0);
    expect(result.graph.nodes).toBeGreaterThanOrEqual(21);
    expect(result.claimGraph.nodes).toBe(6);
    expect(result.claimGraph.edges).toBe(5);
    expect(result.sampleRefs.receipts[0]).toContain(".truth-harness/receipts/");
    expect(result.sampleCommands.validate).toContain("truth-harness workspace validate");
    expect(result.warnings[0]).toContain("synthetic scale probes");
  });

  it("enforces safety caps before generating large local workspaces", async () => {
    const root = await tempRoot();

    await expect(
      runWorkspaceStress({
        rootPath: root,
        receipts: 5001,
        claims: 0,
        routes: 0
      })
    ).rejects.toThrow("exceeds the safety cap");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-stress-"));
  roots.push(root);
  return root;
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENGINE_2D_COLLISION_CAPABILITY_ID,
  ENGINE_2D_COLLISION_VERIFIER_PACK_ID,
  ENGINE_MATH_SEED_SUITE_PATH,
  getEngineVerifierPacks
} from "./engine-verifier-pack.js";

describe("engine verifier packs", () => {
  it("keeps the 2D collision verifier pack aligned with the engine benchmark suite", () => {
    const [pack] = getEngineVerifierPacks();
    const suite = JSON.parse(readFileSync(resolve(process.cwd(), ENGINE_MATH_SEED_SUITE_PATH), "utf8")) as {
      id: string;
      tasks: Array<{ id: string; expectTrust: string }>;
    };

    expect(pack).toMatchObject({
      schemaVersion: "truth-harness.engine-verifier-pack.v0",
      id: ENGINE_2D_COLLISION_VERIFIER_PACK_ID,
      capabilityId: ENGINE_2D_COLLISION_CAPABILITY_ID,
      lane: "engine-math",
      localOnly: true,
      networkAccess: "none",
      status: "ready"
    });
    expect(pack.benchmarkSuite).toMatchObject({
      id: suite.id,
      path: ENGINE_MATH_SEED_SUITE_PATH,
      totalTasks: suite.tasks.length,
      expectedTrustCounts: {
        "exact-computed": 18,
        refuted: 9
      }
    });
    expect(pack.capabilities.map((capability) => capability.backendId)).toEqual([
      "local-aabb2-overlap",
      "local-swept-aabb2-intersection",
      "local-circle2-intersection",
      "local-capsule2-circle-intersection",
      "local-circle2-aabb-intersection",
      "local-segment2-intersection",
      "local-ray2-circle-intersection",
      "local-ray2-aabb-intersection",
      "local-point-in-triangle2"
    ]);

    const suiteTaskIds = new Set(suite.tasks.map((task) => task.id));
    const packTaskIds = pack.capabilities.flatMap((capability) => capability.benchmarkTaskIds);
    expect(new Set(packTaskIds)).toEqual(suiteTaskIds);
    expect(packTaskIds).toHaveLength(suite.tasks.length);
    expect(pack.capabilities.every((capability) => capability.promptForms.length >= 2)).toBe(true);
    expect(pack.capabilities.every((capability) => capability.boundary.length > 30)).toBe(true);
    expect(pack.agentContract).toMatchObject({
      routeBeforeGenericMath: true,
      attachConcreteReceiptBeforeClaim: true,
      benchmarkReplayRequiredForPackChanges: true
    });
  });
});

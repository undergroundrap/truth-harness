import { describe, expect, it } from "vitest";
import { getEngineManifest } from "./engine-manifest.js";

describe("engine manifest", () => {
  it("reports native kernels, adapters, planned engines, and trust boundaries", () => {
    const manifest = getEngineManifest({
      now: new Date("2026-06-12T00:00:00.000Z"),
      timeoutMs: 50,
      maximaCommand: "truth-harness-missing-maxima-command",
      sageCommand: "truth-harness-missing-sage-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command"
    });

    expect(manifest.schemaVersion).toBe("truth-harness.engine-manifest.v0");
    expect(manifest.localOnly).toBe(true);
    expect(manifest.networkAccess).toBe("none");
    expect(manifest.nativeCount).toBeGreaterThan(0);
    expect(manifest.adapterCount).toBeGreaterThan(0);
    expect(manifest.plannedCount).toBeGreaterThan(0);
    expect(manifest.deterministicCount).toBeGreaterThan(0);
    expect(manifest.replayDeterministicCount).toBeGreaterThan(0);
    expect(manifest.machineContract).toMatchObject({
      jsonFirst: true,
      diagnosticsAreStructured: true,
      stableCapabilityIds: true,
      deterministicTrustRequiresReplayableArtifact: true,
      primitivesRemainComposable: true
    });
    expect(manifest.verifierPacks).toHaveLength(1);
    expect(manifest.verifierPacks[0]).toMatchObject({
      id: "engine-2d-collision-verifier-pack",
      capabilityId: "local-engine-geometry-2d",
      lane: "engine-math",
      benchmarkSuite: {
        id: "engine-math-seed",
        totalTasks: 31
      }
    });
    expect(manifest.trustBoundary.statusProbeIsNotEvidence).toBe(true);
    expect(manifest.trustBoundary.claimTrustRequiresResolvableEvidence).toBe(true);
    expect(manifest.capabilities.every((capability) => capability.determinism.aiParserFriendly)).toBe(true);

    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "local-rational-arithmetic",
        kind: "native-kernel",
        status: "ready",
        strongestTrust: "exact-computed",
        canMintTrust: true,
        determinism: expect.objectContaining({
          determinismClass: "strict-deterministic",
          deterministic: true,
          replayable: true,
          primitiveSemantics: "exact-rational"
        })
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "lean-proof-checker",
        kind: "adapter",
        status: "missing",
        strongestTrust: "proved",
        canMintTrust: false,
        statusProbeMintedEvidence: false,
        determinism: expect.objectContaining({
          determinismClass: "replay-deterministic",
          primitiveSemantics: "formal-proof"
        })
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "z3-smt-solver",
        determinism: expect.objectContaining({
          determinismClass: "replay-deterministic",
          primitiveSemantics: "smt-lib"
        })
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "sage-cas",
        kind: "adapter",
        status: "missing",
        strongestTrust: "cross-checked",
        canMintTrust: false,
        determinism: expect.objectContaining({
          determinismClass: "replay-deterministic",
          primitiveSemantics: "symbolic-expression"
        })
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "code-run-sandbox",
        determinism: expect.objectContaining({
          determinismClass: "environment-measured",
          deterministic: false,
          primitiveSemantics: "sandbox-measurement"
        })
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "local-engine-geometry-2d",
        lane: "engine-math",
        strongestTrust: "exact-computed",
        canMintTrust: true,
        determinism: expect.objectContaining({
          determinismClass: "strict-deterministic",
          primitiveSemantics: "engine-geometry-predicate"
        })
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "domain-simulation-adapters",
        determinism: expect.objectContaining({
          determinismClass: "planned",
          primitiveSemantics: "simulation-provenance"
        })
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "concurrent-systems-verifier",
        lane: "code/systems",
        strongestTrust: "none",
        canMintTrust: false,
        determinism: expect.objectContaining({
          determinismClass: "planned",
          primitiveSemantics: "concurrency-model"
        })
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "hardware-eda-verifier",
        lane: "hardware/eda",
        strongestTrust: "none",
        canMintTrust: false,
        determinism: expect.objectContaining({
          determinismClass: "planned",
          primitiveSemantics: "hardware-description"
        })
      })
    );
  });
});

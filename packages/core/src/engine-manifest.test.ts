import { describe, expect, it } from "vitest";
import { getEngineManifest } from "./engine-manifest.js";

describe("engine manifest", () => {
  it("reports native kernels, adapters, planned engines, and trust boundaries", () => {
    const manifest = getEngineManifest({
      now: new Date("2026-06-12T00:00:00.000Z"),
      timeoutMs: 50,
      maximaCommand: "theorem-workbench-missing-maxima-command",
      leanCommand: "theorem-workbench-missing-lean-command",
      z3Command: "theorem-workbench-missing-z3-command"
    });

    expect(manifest.schemaVersion).toBe("theorem.engine-manifest.v0");
    expect(manifest.localOnly).toBe(true);
    expect(manifest.networkAccess).toBe("none");
    expect(manifest.nativeCount).toBeGreaterThan(0);
    expect(manifest.adapterCount).toBeGreaterThan(0);
    expect(manifest.plannedCount).toBeGreaterThan(0);
    expect(manifest.trustBoundary.statusProbeIsNotEvidence).toBe(true);
    expect(manifest.trustBoundary.claimTrustRequiresResolvableEvidence).toBe(true);

    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "local-rational-arithmetic",
        kind: "native-kernel",
        status: "ready",
        strongestTrust: "exact-computed",
        canMintTrust: true
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "lean-proof-checker",
        kind: "adapter",
        status: "missing",
        strongestTrust: "proved",
        canMintTrust: false,
        statusProbeMintedEvidence: false
      })
    );
    expect(manifest.capabilities).toContainEqual(
      expect.objectContaining({
        id: "sage-cas",
        kind: "planned-adapter",
        status: "planned",
        canMintTrust: false
      })
    );
  });
});

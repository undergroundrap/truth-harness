import { describe, expect, it } from "vitest";
import { createEngineReadinessReportFromManifest } from "./engine-readiness.js";
import type { EngineManifest } from "./engine-manifest.js";

describe("engine readiness", () => {
  it("separates built-in research core readiness from missing reviewer engines", () => {
    const report = createEngineReadinessReportFromManifest(minimalManifest());

    expect(report.schemaVersion).toBe("truth-harness.engine-readiness.v0");
    expect(report.status).toBe("research-core-ready");
    expect(report.summary.readyTrustLabels).toEqual(
      expect.arrayContaining(["exact-computed", "refuted", "dimension-checked", "bounded-numeric", "source-cited"])
    );
    expect(report.gates).toContainEqual(
      expect.objectContaining({
        id: "math-core",
        status: "ready"
      })
    );
    expect(report.gates).toContainEqual(
      expect.objectContaining({
        id: "professor-review",
        status: "blocked",
        missingClaimClasses: ["independent-cas-cross-check", "smt-constraint-check", "accepted-proof-checking"],
        nextActions: expect.arrayContaining(["npm run docker:professor", "npm run docker:engines"])
      })
    );
    expect(report.gates.find((gate) => gate.id === "professor-review")?.nextActions[0]).toBe("npm run docker:professor");
    expect(report.gates).toContainEqual(
      expect.objectContaining({
        id: "strict-professor-review",
        status: "blocked",
        missingClaimClasses: ["dual-cas-reviewer-cross-check", "dual-smt-reviewer-check", "accepted-proof-checking"],
        nextActions: expect.arrayContaining(["npm run docker:professor:all", "npm run docker:all-engines:write"])
      })
    );
    expect(report.gates.find((gate) => gate.id === "strict-professor-review")?.nextActions[0]).toBe("npm run docker:professor:all");
    expect(report.gates.find((gate) => gate.id === "agent-autonomy")?.nextActions[0]).toBe("npm run docker:sandbox:write");
    expect(report.claimClasses).toContainEqual(
      expect.objectContaining({
        id: "accepted-proof-checking",
        status: "blocked",
        targetTrust: "proved",
        missingCapabilityIds: ["lean-proof-checker"]
      })
    );
    expect(report.trustBoundary.readinessDoesNotMintEvidence).toBe(true);
    expect(report.trustBoundary.provedRequiresAcceptedProofCheckerRun).toBe(true);
  });

  it("marks professor review ready only when CAS, SMT, and Lean paths are available", () => {
    const report = createEngineReadinessReportFromManifest({
      ...minimalManifest(),
      readyCount: 14,
      status: "ready",
      capabilities: minimalManifest().capabilities.map((capability) => {
        if (["maxima-cas", "z3-smt-solver", "lean-proof-checker", "code-run-sandbox"].includes(capability.id)) {
          return {
            ...capability,
            status: "available" as const,
            canMintTrust: capability.id !== "code-run-sandbox"
          };
        }
        return capability;
      })
    });

    expect(report.status).toBe("professor-ready");
    expect(report.gates).toContainEqual(
      expect.objectContaining({
        id: "professor-review",
        status: "ready"
      })
    );
    expect(report.gates).toContainEqual(
      expect.objectContaining({
        id: "strict-professor-review",
        status: "blocked",
        missingClaimClasses: ["dual-cas-reviewer-cross-check", "dual-smt-reviewer-check"]
      })
    );
    expect(report.summary.readyTrustLabels).toEqual(expect.arrayContaining(["cross-checked", "smt-checked", "proved"]));
  });

  it("separates strict all-engine reviewer readiness from the practical professor gate", () => {
    const report = createEngineReadinessReportFromManifest({
      ...minimalManifest(),
      readyCount: 16,
      status: "ready",
      capabilities: minimalManifest().capabilities.map((capability) => {
        if (
          [
            "maxima-cas",
            "sage-cas",
            "z3-smt-solver",
            "cvc5-smt-solver",
            "lean-proof-checker",
            "code-run-sandbox"
          ].includes(capability.id)
        ) {
          return {
            ...capability,
            status: "available" as const,
            canMintTrust: capability.id !== "code-run-sandbox"
          };
        }
        return capability;
      })
    });

    expect(report.status).toBe("professor-ready");
    expect(report.gates).toContainEqual(
      expect.objectContaining({
        id: "strict-professor-review",
        status: "ready",
        missingClaimClasses: []
      })
    );
  });

  it("can use a saved passing Docker sandbox run for agent-autonomy readiness without changing host manifest status", () => {
    const report = createEngineReadinessReportFromManifest(minimalManifest(), {
      savedSandboxRun: {
        runId: "sandbox_run_0123456789abcdef",
        title: "Code-Run Sandbox Measurement",
        summary: "Measured Docker no-network sandbox boundary.",
        createdAt: "2026-06-18T01:02:03.000Z",
        status: "passed",
        provider: "container",
        canAttestNetworkNone: true,
        path: ".truth-harness/findings/2026-06-18-sandbox_run_0123456789abcdef-sandbox-run.json",
        tags: ["sandbox", "network-none"],
        warnings: []
      }
    });

    expect(report.manifestStatus).toBe("partial");
    expect(report.savedEvidence.sandboxRun).toEqual(
      expect.objectContaining({
        runId: "sandbox_run_0123456789abcdef",
        provider: "container"
      })
    );
    expect(report.claimClasses).toContainEqual(
      expect.objectContaining({
        id: "code-execution-safety",
        status: "ready",
        readyCapabilityIds: ["code-run-sandbox"]
      })
    );
    expect(report.gates).toContainEqual(
      expect.objectContaining({
        id: "agent-autonomy",
        status: "ready"
      })
    );
  });
});

function minimalManifest(): EngineManifest {
  const capabilities: EngineManifest["capabilities"] = [
    capability("local-rational-arithmetic", "native-kernel", "ready", "exact-computed", true),
    capability("finite-counterexample-search", "native-kernel", "ready", "refuted", true),
    capability("local-mod2-parity-kernel", "native-kernel", "ready", "exact-computed", true),
    capability("local-dimensional-analysis", "native-kernel", "ready", "dimension-checked", true),
    capability("rational-interval-bounds", "native-kernel", "ready", "bounded-numeric", true),
    capability("sympy-symbolic-adapter", "adapter", "available", "exact-computed", true),
    capability("local-corpus-lexical-search", "native-kernel", "ready", "source-cited", true),
    capability("claim-ledger", "workspace-service", "ready", "none", false),
    capability("workspace-validation", "workspace-service", "ready", "none", false),
    capability("model-context-disclosure", "workspace-service", "ready", "provenance-only", false),
    capability("code-run-sandbox", "safety-boundary", "missing", "provenance-only", false),
    capability("maxima-cas", "adapter", "missing", "cross-checked", false),
    capability("sage-cas", "adapter", "missing", "cross-checked", false),
    capability("lean-proof-checker", "adapter", "missing", "proved", false),
    capability("z3-smt-solver", "adapter", "missing", "smt-checked", false),
    capability("cvc5-smt-solver", "adapter", "missing", "smt-checked", false),
    capability("rigorous-numerics", "planned-adapter", "planned", "none", false),
    capability("domain-simulation-adapters", "planned-adapter", "planned", "none", false)
  ];

  return {
    schemaVersion: "truth-harness.engine-manifest.v0",
    createdAt: "2026-06-18T00:00:00.000Z",
    localOnly: true,
    networkAccess: "none",
    status: "partial",
    readyCount: 10,
    totalCount: 16,
    nativeCount: 6,
    adapterCount: 6,
    plannedCount: 2,
    deterministicCount: 6,
    replayDeterministicCount: 6,
    capabilities,
    machineContract: {
      jsonFirst: true,
      diagnosticsAreStructured: true,
      stableCapabilityIds: true,
      replayCommandsRequiredForEvidence: true,
      deterministicTrustRequiresReplayableArtifact: true,
      primitivesRemainComposable: true
    },
    trustBoundary: {
      aiOutputIsNotEvidence: true,
      statusProbeIsNotEvidence: true,
      claimTrustRequiresResolvableEvidence: true,
      provedRequiresAcceptedProofCheckerRun: true,
      smtCheckedRequiresConcreteSolverRun: true,
      crossCheckedRequiresIndependentAgreementRun: true
    },
    warnings: []
  };
}

function capability(
  id: string,
  kind: EngineManifest["capabilities"][number]["kind"],
  status: EngineManifest["capabilities"][number]["status"],
  strongestTrust: EngineManifest["capabilities"][number]["strongestTrust"],
  canMintTrust: boolean
): EngineManifest["capabilities"][number] {
  return {
    id,
    displayName: id,
    kind,
    lane: "math",
    status,
    role: "test",
    localOnly: true,
    networkAccess: "none",
    strongestTrust,
    canMintTrust,
    statusProbeMintedEvidence: false,
    trustBoundary: `${id} boundary`,
    limitations: [`${id} limitation`],
    determinism: {
      determinismClass: kind === "native-kernel" ? "strict-deterministic" : kind === "planned-adapter" ? "planned" : "replay-deterministic",
      deterministic: kind !== "planned-adapter",
      replayable: kind !== "planned-adapter",
      primitiveSemantics: "workspace-artifact",
      aiParserFriendly: true,
      replayRequirements: ["test replay"],
      driftRisks: ["test drift"]
    },
    nextStep: `Configure ${id}.`
  };
}

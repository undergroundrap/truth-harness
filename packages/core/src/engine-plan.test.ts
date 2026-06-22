import { describe, expect, it } from "vitest";
import { classifyProblem, createEnginePlan } from "./engine-plan.js";
import type { EngineCapability, EngineManifest } from "./engine-manifest.js";

describe("engine plan", () => {
  it("routes exact arithmetic to the native kernel without inventing extra engine requirements", () => {
    const plan = createEnginePlan("compute 3 / 4 + 5 / 8", {
      manifest: manifestWith()
    });

    expect(plan.schemaVersion).toBe("truth-harness.engine-plan.v0");
    expect(plan.classifications).toContain("exact-arithmetic");
    expect(plan.status).toBe("ready-to-route");
    expect(plan.targetTrustCeiling).toBe("exact-computed");
    expect(plan.steps[0]).toMatchObject({
      capabilityId: "local-rational-arithmetic",
      role: "primary-check",
      canRunNow: true,
      trustIfSuccessful: "exact-computed"
    });
    expect(plan.recommendedFirstCommand).toBe('truth-harness verify "compute 3 / 4 + 5 / 8" --write');
    expect(plan.trustBoundary.planDoesNotMintEvidence).toBe(true);
  });

  it("plans symbolic algebra as SymPy plus independent CAS and proof upgrades", () => {
    const plan = createEnginePlan("symbolic simplify sin(x)^2 + cos(x)^2", {
      manifest: manifestWith({
        "maxima-cas": { status: "missing", canMintTrust: false },
        "sage-cas": { status: "missing", canMintTrust: false },
        "lean-proof-checker": { status: "missing", canMintTrust: false }
      })
    });

    expect(plan.classifications).toContain("symbolic-algebra");
    expect(plan.status).toBe("route-with-open-gates");
    expect(plan.steps.map((step) => step.capabilityId)).toEqual([
      "sympy-symbolic-adapter",
      "maxima-cas",
      "sage-cas",
      "lean-proof-checker",
      "claim-ledger"
    ]);
    expect(plan.blockedCapabilityIds).toEqual(["maxima-cas", "sage-cas", "lean-proof-checker"]);
    expect(plan.comparisonMatrix).toContainEqual(
      expect.objectContaining({
        capabilityId: "maxima-cas",
        agreementValue: "independent",
        trustIfSuccessful: "cross-checked"
      })
    );
    expect(plan.nextActions.join("\n")).toContain("docker:engines");
    expect(plan.nextActions.join("\n")).toContain("Lean");
  });

  it("uses saved reviewer Docker evidence as guidance without making host-missing engines runnable", () => {
    const plan = createEnginePlan("prove a theorem with Lean and no sorry", {
      manifest: manifestWith({
        "lean-proof-checker": { status: "missing", canMintTrust: false }
      }),
      savedEngineRuns: [
        {
          runId: "engine_run_1111111111111111",
          title: "Strict all-engine reviewer evidence",
          summary: "passed",
          createdAt: "2026-06-20T00:00:00.000Z",
          status: "passed",
          concretePassed: 5,
          concreteTotal: 5,
          requiredPassed: 5,
          requiredTotal: 5,
          evidenceMinted: 5,
          path: ".truth-harness/engine-runs/2026-06-20-engine_run_1111111111111111.json",
          tags: ["lean-proof-checker", "maxima-cas", "sage-cas", "z3-smt-solver", "cvc5-smt-solver"],
          warnings: []
        }
      ]
    });

    const leanStep = plan.steps.find((step) => step.capabilityId === "lean-proof-checker");

    expect(plan.savedReviewerEvidence).toMatchObject({
      status: "available",
      runId: "engine_run_1111111111111111",
      requiredPassed: 5,
      requiredTotal: 5,
      coveredCapabilityIds: expect.arrayContaining(["lean-proof-checker", "sage-cas"])
    });
    expect(leanStep).toMatchObject({
      canRunNow: false,
      status: "missing",
      trustIfSuccessful: "proved"
    });
    expect(leanStep?.limitation).toContain("Saved reviewer Docker evidence engine_run_1111111111111111 covers this capability");
    expect(plan.nextActions.join("\n")).toContain("Saved reviewer Docker evidence engine_run_1111111111111111 previously covered");
    expect(plan.trustBoundary.planDoesNotMintEvidence).toBe(true);
  });

  it("pushes universal claims toward refutation, SMT, and formal proof checks", () => {
    const plan = createEnginePlan("for all integers n, n^2+n+1 is even", {
      manifest: manifestWith({
        "z3-smt-solver": { status: "available", canMintTrust: true },
        "cvc5-smt-solver": { status: "available", canMintTrust: true },
        "lean-proof-checker": { status: "missing", canMintTrust: false }
      })
    });

    expect(plan.classifications).toContain("universal-claim");
    expect(plan.steps.map((step) => step.capabilityId)).toEqual([
      "finite-counterexample-search",
      "local-mod2-parity-kernel",
      "z3-smt-solver",
      "cvc5-smt-solver",
      "lean-proof-checker",
      "claim-ledger"
    ]);
    expect(plan.readyCapabilityIds).toEqual([
      "finite-counterexample-search",
      "local-mod2-parity-kernel",
      "z3-smt-solver",
      "cvc5-smt-solver",
      "claim-ledger"
    ]);
    expect(plan.blockedCapabilityIds).toEqual(["lean-proof-checker"]);
    expect(plan.comparisonMatrix.find((row) => row.capabilityId === "z3-smt-solver")).toMatchObject({
      role: "solver-check",
      trustIfSuccessful: "smt-checked"
    });
  });

  it("keeps simulation and engine-grade numerical work honest about planned adapters", () => {
    const plan = createEnginePlan("simulate robotics geometry with deterministic floating point bounds", {
      manifest: manifestWith()
    });

    expect(plan.classifications).toEqual(expect.arrayContaining(["interval-bound", "simulation-or-engineering"]));
    expect(plan.steps.map((step) => step.capabilityId)).toEqual(
      expect.arrayContaining(["rational-interval-bounds", "sympy-symbolic-adapter", "rigorous-numerics", "domain-simulation-adapters"])
    );
    expect(plan.comparisonMatrix).toContainEqual(
      expect.objectContaining({
        capabilityId: "domain-simulation-adapters",
        agreementValue: "planned",
        honestBoundary: expect.stringContaining("Planned adapters mint no trust")
      })
    );
    expect(plan.warnings.join("\n")).toContain("does not run engines");
  });

  it("routes concurrent Rust systems to sandbox, SMT, proof, and planned model-check evidence without claiming readiness", () => {
    const plan = createEnginePlan("prove a Rust ECS scheduler is deadlock-free and has no data races", {
      manifest: manifestWith({
        "z3-smt-solver": { status: "missing", canMintTrust: false },
        "cvc5-smt-solver": { status: "missing", canMintTrust: false },
        "lean-proof-checker": { status: "missing", canMintTrust: false },
        "code-run-sandbox": { status: "missing", canMintTrust: false }
      })
    });

    expect(plan.classifications).toEqual(expect.arrayContaining(["concurrent-systems", "formal-proof"]));
    expect(plan.status).toBe("route-with-open-gates");
    expect(plan.targetTrustCeiling).toBe("none");
    expect(plan.recommendedFirstCommand).toBe(
      'truth-harness validation plan "prove a Rust ECS scheduler is deadlock-free and has no data races" --domain software --domain engineering'
    );
    expect(plan.steps.map((step) => step.capabilityId)).toEqual(
      expect.arrayContaining([
        "code-run-sandbox",
        "z3-smt-solver",
        "cvc5-smt-solver",
        "lean-proof-checker",
        "concurrent-systems-verifier",
        "claim-ledger"
      ])
    );
    expect(plan.comparisonMatrix).toContainEqual(
      expect.objectContaining({
        capabilityId: "concurrent-systems-verifier",
        role: "planned-upgrade",
        trustIfSuccessful: "none",
        honestBoundary: expect.stringContaining("Planned adapters mint no trust")
      })
    );
    expect(plan.nextActions.join("\n")).toContain("narrow the property into a scheduler");
  });

  it("routes hardware and EDA claims to scoped SMT/proof evidence plus a planned formal adapter", () => {
    const plan = createEnginePlan("verify a SystemVerilog RTL multiplier circuit before FPGA tape-out", {
      manifest: manifestWith({
        "z3-smt-solver": { status: "available", canMintTrust: true },
        "cvc5-smt-solver": { status: "missing", canMintTrust: false },
        "lean-proof-checker": { status: "missing", canMintTrust: false }
      })
    });

    expect(plan.classifications).toContain("hardware-eda");
    expect(plan.status).toBe("route-with-open-gates");
    expect(plan.recommendedFirstCommand).toBe(
      'truth-harness validation plan "verify a SystemVerilog RTL multiplier circuit before FPGA tape-out" --domain engineering'
    );
    expect(plan.readyCapabilityIds).toContain("z3-smt-solver");
    expect(plan.blockedCapabilityIds).toEqual(expect.arrayContaining(["cvc5-smt-solver", "lean-proof-checker"]));
    expect(plan.steps.map((step) => step.capabilityId)).toEqual(
      expect.arrayContaining(["z3-smt-solver", "cvc5-smt-solver", "lean-proof-checker", "hardware-eda-verifier", "claim-ledger"])
    );
    expect(plan.comparisonMatrix).toContainEqual(
      expect.objectContaining({
        capabilityId: "hardware-eda-verifier",
        agreementValue: "planned",
        trustIfSuccessful: "none"
      })
    );
    expect(plan.nextActions.join("\n")).toContain("narrow the HDL/RTL property");
  });

  it("classifies common problem shapes for agents before routing", () => {
    expect(classifyProblem("dimension check force = mass * acceleration")).toContain("dimension-check");
    expect(classifyProblem("solve integer constraints x > 0 and x < 3")).toContain("smt-constraint");
    expect(classifyProblem("prove a Rust lock-free queue cannot deadlock")).toContain("concurrent-systems");
    expect(classifyProblem("verify a Verilog ALU equivalence property")).toContain("hardware-eda");
    expect(classifyProblem("cite the paper that supports this theorem")).toEqual(
      expect.arrayContaining(["formal-proof", "source-grounded"])
    );
  });
});

function manifestWith(overrides: Record<string, Partial<EngineCapability>> = {}): EngineManifest {
  const ids: Array<[string, EngineCapability["kind"], EngineCapability["status"], EngineCapability["strongestTrust"], boolean]> = [
    ["local-rational-arithmetic", "native-kernel", "ready", "exact-computed", true],
    ["finite-counterexample-search", "native-kernel", "ready", "refuted", true],
    ["local-mod2-parity-kernel", "native-kernel", "ready", "exact-computed", true],
    ["local-dimensional-analysis", "native-kernel", "ready", "dimension-checked", true],
    ["rational-interval-bounds", "native-kernel", "ready", "bounded-numeric", true],
    ["sympy-symbolic-adapter", "adapter", "available", "exact-computed", true],
    ["local-corpus-lexical-search", "native-kernel", "ready", "source-cited", true],
    ["claim-ledger", "workspace-service", "ready", "none", false],
    ["workspace-validation", "workspace-service", "ready", "none", false],
    ["model-context-disclosure", "workspace-service", "ready", "provenance-only", false],
    ["code-run-sandbox", "safety-boundary", "available", "provenance-only", false],
    ["maxima-cas", "adapter", "available", "cross-checked", true],
    ["sage-cas", "adapter", "available", "cross-checked", true],
    ["lean-proof-checker", "adapter", "available", "proved", true],
    ["z3-smt-solver", "adapter", "missing", "smt-checked", false],
    ["cvc5-smt-solver", "adapter", "missing", "smt-checked", false],
    ["rigorous-numerics", "planned-adapter", "planned", "none", false],
    ["domain-simulation-adapters", "planned-adapter", "planned", "none", false],
    ["concurrent-systems-verifier", "planned-adapter", "planned", "none", false],
    ["hardware-eda-verifier", "planned-adapter", "planned", "none", false]
  ];

  const capabilities = ids.map(([id, kind, status, strongestTrust, canMintTrust]) =>
    capability({
      id,
      kind,
      status,
      strongestTrust,
      canMintTrust,
      ...overrides[id]
    })
  );

  return {
    schemaVersion: "truth-harness.engine-manifest.v0",
    createdAt: "2026-06-20T00:00:00.000Z",
    localOnly: true,
    networkAccess: "none",
    status: "partial",
    readyCount: capabilities.filter((entry) => entry.status === "ready" || entry.status === "available").length,
    totalCount: capabilities.filter((entry) => entry.kind !== "planned-adapter").length,
    nativeCount: capabilities.filter((entry) => entry.kind === "native-kernel").length,
    adapterCount: capabilities.filter((entry) => entry.kind === "adapter").length,
    plannedCount: capabilities.filter((entry) => entry.kind === "planned-adapter").length,
    deterministicCount: capabilities.filter((entry) => entry.kind === "native-kernel").length,
    replayDeterministicCount: capabilities.filter((entry) => entry.kind === "adapter").length,
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

function capability(input: {
  id: string;
  kind: EngineCapability["kind"];
  status: EngineCapability["status"];
  strongestTrust: EngineCapability["strongestTrust"];
  canMintTrust: boolean;
}): EngineCapability {
  return {
    id: input.id,
    displayName: input.id,
    kind: input.kind,
    lane: "math",
    status: input.status,
    role: "test",
    command: `truth-harness ${input.id}`,
    localOnly: true,
    networkAccess: "none",
    strongestTrust: input.strongestTrust,
    canMintTrust: input.canMintTrust,
    statusProbeMintedEvidence: false,
    trustBoundary: `${input.id} boundary`,
    limitations: [`${input.id} limitation`],
    determinism: {
      determinismClass: input.kind === "native-kernel" ? "strict-deterministic" : input.kind === "planned-adapter" ? "planned" : "replay-deterministic",
      deterministic: input.kind !== "planned-adapter",
      replayable: input.kind !== "planned-adapter",
      primitiveSemantics: "workspace-artifact",
      aiParserFriendly: true,
      replayRequirements: ["test replay"],
      driftRisks: ["test drift"]
    }
  };
}

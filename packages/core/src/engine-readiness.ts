import { getEngineManifest, type EngineCapability, type EngineManifest, type EngineManifestOptions } from "./engine-manifest.js";
import type { TrustLabel } from "./types.js";

export type EngineReadinessStatus = "ready" | "degraded" | "blocked" | "planned";
export type EngineReadinessGateStatus = "ready" | "blocked";

export interface EngineReadinessClaimClass {
  id: string;
  displayName: string;
  lane: string;
  status: EngineReadinessStatus;
  targetTrust: TrustLabel | "provenance-only" | "none";
  supportKind: "native" | "external-adapter" | "workspace-service" | "safety-boundary" | "planned";
  requiredCapabilityIds: string[];
  readyCapabilityIds: string[];
  missingCapabilityIds: string[];
  evidenceRule: string;
  reviewerMeaning: string;
  recommendedCommand?: string;
  limitations: string[];
  nextActions: string[];
}

export interface EngineReadinessGate {
  id: string;
  title: string;
  status: EngineReadinessGateStatus;
  summary: string;
  requiredClaimClasses: string[];
  missingClaimClasses: string[];
  nextActions: string[];
}

export interface EngineReadinessReport {
  schemaVersion: "truth-harness.engine-readiness.v0";
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  status: "research-core-ready" | "professor-ready" | "partial" | "blocked";
  manifestStatus: EngineManifest["status"];
  summary: {
    readyClaimClasses: number;
    totalClaimClasses: number;
    blockedClaimClasses: number;
    plannedClaimClasses: number;
    readyCapabilities: number;
    totalCapabilities: number;
    readyTrustLabels: Array<TrustLabel | "provenance-only">;
    missingExternalEngines: string[];
  };
  gates: EngineReadinessGate[];
  claimClasses: EngineReadinessClaimClass[];
  trustBoundary: {
    aiOutputIsNotEvidence: true;
    statusProbeIsNotEvidence: true;
    readinessDoesNotMintEvidence: true;
    professorReadyRequiresConcreteEngineRuns: true;
    provedRequiresAcceptedProofCheckerRun: true;
    hardProblemsRequireDomainValidation: true;
  };
  recommendedNextActions: string[];
  warnings: string[];
}

interface ClaimClassDefinition {
  id: string;
  displayName: string;
  lane: string;
  targetTrust: EngineReadinessClaimClass["targetTrust"];
  supportKind: EngineReadinessClaimClass["supportKind"];
  requiredCapabilityIds: string[];
  match: "all" | "any";
  evidenceRule: string;
  reviewerMeaning: string;
  recommendedCommand?: string;
  limitations: string[];
  planned?: boolean;
}

const CLAIM_CLASS_DEFINITIONS: ClaimClassDefinition[] = [
  {
    id: "exact-rational-computation",
    displayName: "Exact rational computation",
    lane: "math",
    targetTrust: "exact-computed",
    supportKind: "native",
    requiredCapabilityIds: ["local-rational-arithmetic"],
    match: "all",
    evidenceRule: "A parsed exact expression must produce a replayable receipt with exact inputs, output, and step trace.",
    reviewerMeaning: "Safe for arithmetic subclaims inside larger work, but not a proof of surrounding natural-language claims.",
    recommendedCommand: "truth-harness ask \"compute 3 / 4 + 5 / 8\" --json",
    limitations: ["Only the parsed exact expression is covered."]
  },
  {
    id: "counterexample-refutation",
    displayName: "Counterexample refutation",
    lane: "math",
    targetTrust: "refuted",
    supportKind: "native",
    requiredCapabilityIds: ["finite-counterexample-search"],
    match: "all",
    evidenceRule: "A universal claim can be refuted only by a concrete exact counterexample receipt.",
    reviewerMeaning: "Strong for disproving false universals; absence of a found counterexample is not proof.",
    recommendedCommand: "truth-harness ask \"for all integers n, n^2+n+1 is even\" --json",
    limitations: ["Finite search windows cannot prove universal truth."]
  },
  {
    id: "dimension-consistency",
    displayName: "Dimensional consistency",
    lane: "physics",
    targetTrust: "dimension-checked",
    supportKind: "native",
    requiredCapabilityIds: ["local-dimensional-analysis"],
    match: "all",
    evidenceRule: "A units claim must reduce to matching dimension vectors over known symbols.",
    reviewerMeaning: "Catches units mistakes before physics or engineering claims are taken seriously.",
    recommendedCommand: "truth-harness ask \"dimension check force = mass * acceleration\" --json",
    limitations: ["Dimensional consistency is necessary but not sufficient for physical truth."]
  },
  {
    id: "interval-bounds",
    displayName: "Rational interval bounds",
    lane: "math",
    targetTrust: "bounded-numeric",
    supportKind: "native",
    requiredCapabilityIds: ["rational-interval-bounds"],
    match: "all",
    evidenceRule: "A numeric range claim must record the bounded expression, interval, and conservative output interval.",
    reviewerMeaning: "Useful for guardrails and sanity checks; tighter rigorous numerics are still planned.",
    recommendedCommand: "truth-harness ask \"bound x^2 + 2*x + 1 for x in [0, 2]\" --json",
    limitations: ["Dependency loss can widen intervals."]
  },
  {
    id: "same-engine-symbolic-check",
    displayName: "Same-engine symbolic check",
    lane: "math",
    targetTrust: "exact-computed",
    supportKind: "external-adapter",
    requiredCapabilityIds: ["sympy-symbolic-adapter"],
    match: "all",
    evidenceRule: "A local SymPy run may support exact-computed for the encoded symbolic equality only.",
    reviewerMeaning: "Good for first-pass symbolic checks; independent agreement is still required for cross-checked.",
    recommendedCommand: "truth-harness ask \"symbolic simplify sin(x)^2 + cos(x)^2\" --json",
    limitations: ["A single CAS is not a formal proof and cannot mint cross-checked."]
  },
  {
    id: "independent-cas-cross-check",
    displayName: "Independent CAS cross-check",
    lane: "math",
    targetTrust: "cross-checked",
    supportKind: "external-adapter",
    requiredCapabilityIds: ["maxima-cas", "sage-cas"],
    match: "any",
    evidenceRule: "A cross-checked label requires a concrete Maxima or SageMath agreement run on the scoped expression.",
    reviewerMeaning: "The first serious anti-hallucination gate for symbolic algebra.",
    recommendedCommand: "truth-harness engines verify --write --require-maxima",
    limitations: ["Agreement between CAS engines is strong evidence, not formal proof."]
  },
  {
    id: "smt-constraint-check",
    displayName: "SMT constraint check",
    lane: "math",
    targetTrust: "smt-checked",
    supportKind: "external-adapter",
    requiredCapabilityIds: ["z3-smt-solver", "cvc5-smt-solver"],
    match: "any",
    evidenceRule: "An SMT label requires a concrete Z3 or cvc5 sat/unsat result for a recorded SMT-LIB artifact.",
    reviewerMeaning: "Useful for bounded logic, constraints, and countermodel-style checks.",
    recommendedCommand: "truth-harness engines verify --write --require-z3",
    limitations: ["The solver result covers the encoded constraints, not the informal problem statement."]
  },
  {
    id: "accepted-proof-checking",
    displayName: "Accepted proof checking",
    lane: "math",
    targetTrust: "proved",
    supportKind: "external-adapter",
    requiredCapabilityIds: ["lean-proof-checker"],
    match: "all",
    evidenceRule: "`proved` requires an accepted Lean proof-checker run for a concrete proof artifact.",
    reviewerMeaning: "This is the trust boundary mathematicians will care about most.",
    recommendedCommand: "truth-harness engines verify --write --require-lean",
    limitations: ["Lean acceptance proves the formalized statement, not every informal interpretation."]
  },
  {
    id: "source-cited-local-rag",
    displayName: "Local source-cited retrieval",
    lane: "sources",
    targetTrust: "source-cited",
    supportKind: "native",
    requiredCapabilityIds: ["local-corpus-lexical-search"],
    match: "all",
    evidenceRule: "A source-cited label requires local retrieved chunks with resolvable source metadata.",
    reviewerMeaning: "Good for paper and literature workflows when citation entailment remains explicit.",
    recommendedCommand: "truth-harness source ingest docs && truth-harness source search \"verified math agents\"",
    limitations: ["Retrieval is not entailment and does not validate scientific claims by itself."]
  },
  {
    id: "workspace-provenance",
    displayName: "Workspace provenance and disclosure",
    lane: "all",
    targetTrust: "provenance-only",
    supportKind: "workspace-service",
    requiredCapabilityIds: ["claim-ledger", "workspace-validation", "model-context-disclosure"],
    match: "all",
    evidenceRule: "Research artifacts must stay schema-valid, locally indexed, and disclosure-logged before model use.",
    reviewerMeaning: "Makes long-running agent work inspectable instead of just another chat transcript.",
    recommendedCommand: "truth-harness workspace validate",
    limitations: ["Provenance and disclosure do not prove claims."]
  },
  {
    id: "code-execution-safety",
    displayName: "Code execution safety boundary",
    lane: "code",
    targetTrust: "provenance-only",
    supportKind: "safety-boundary",
    requiredCapabilityIds: ["code-run-sandbox"],
    match: "all",
    evidenceRule: "Agent-triggered code runs should require an attested no-network sandbox before claiming networkAccess none.",
    reviewerMeaning: "Separates safe autonomous agent loops from unsafe host execution.",
    recommendedCommand: "truth-harness code sandbox-status --json",
    limitations: ["Sandbox readiness is an environment measurement, not a code correctness proof."]
  },
  {
    id: "rigorous-numerics",
    displayName: "Rigorous numerics",
    lane: "math",
    targetTrust: "bounded-numeric",
    supportKind: "planned",
    requiredCapabilityIds: ["rigorous-numerics"],
    match: "all",
    evidenceRule: "Future rigorous numerics must record precision budgets, error bounds, and replayable backend versions.",
    reviewerMeaning: "Needed for serious numerical analysis and simulation credibility beyond simple rational intervals.",
    limitations: ["Not implemented in the current local runtime."],
    planned: true
  },
  {
    id: "simulation-provenance",
    displayName: "Simulation provenance",
    lane: "physics/bio/engineering",
    targetTrust: "provenance-only",
    supportKind: "planned",
    requiredCapabilityIds: ["domain-simulation-adapters"],
    match: "all",
    evidenceRule: "Future simulation claims must record model assumptions, parameters, seeds, uncertainty, and validation gates.",
    reviewerMeaning: "Required before Truth Harness can honestly support hard physics, robotics, biology, or engineering claims.",
    limitations: ["Not implemented in the current local runtime."],
    planned: true
  }
];

const GATE_DEFINITIONS = [
  {
    id: "math-core",
    title: "Math core",
    requiredClaimClasses: [
      "exact-rational-computation",
      "counterexample-refutation",
      "dimension-consistency",
      "interval-bounds",
      "same-engine-symbolic-check",
      "workspace-provenance"
    ],
    readySummary: "Local deterministic math core is ready for replayable receipts and teaching-grade checks.",
    blockedSummary: "The local math core is missing a built-in capability that should always be present."
  },
  {
    id: "professor-review",
    title: "Professor review",
    requiredClaimClasses: ["independent-cas-cross-check", "smt-constraint-check", "accepted-proof-checking"],
    readySummary: "Independent CAS, SMT, and proof-checker paths are available for reviewer-facing math work.",
    blockedSummary: "Reviewer-facing math is blocked until independent CAS, SMT, and Lean proof gates are available or run through Docker."
  },
  {
    id: "agent-autonomy",
    title: "Agent autonomy",
    requiredClaimClasses: ["workspace-provenance", "code-execution-safety"],
    readySummary: "Agents can route work through local provenance and an attested execution boundary.",
    blockedSummary: "Autonomous agent loops should stay limited until the code execution boundary is attested."
  }
] as const;

export function createEngineReadinessReport(options: EngineManifestOptions = {}): EngineReadinessReport {
  const manifest = getEngineManifest(options);
  return createEngineReadinessReportFromManifest(manifest);
}

export function createEngineReadinessReportFromManifest(manifest: EngineManifest): EngineReadinessReport {
  const capabilityById = new Map(manifest.capabilities.map((capability) => [capability.id, capability]));
  const claimClasses = CLAIM_CLASS_DEFINITIONS.map((definition) => claimClassReadiness(definition, capabilityById));
  const gates = GATE_DEFINITIONS.map((gate) => readinessGate(gate, claimClasses));
  const readyClaimClasses = claimClasses.filter((entry) => entry.status === "ready").length;
  const blockedClaimClasses = claimClasses.filter((entry) => entry.status === "blocked").length;
  const plannedClaimClasses = claimClasses.filter((entry) => entry.status === "planned").length;
  const readyTrustLabels = readyTrustLabelsFor(claimClasses);
  const missingExternalEngines = manifest.capabilities
    .filter((capability) => capability.kind === "adapter" && capability.status !== "available")
    .map((capability) => capability.displayName);
  const recommendedNextActions = recommendedActionsFor(claimClasses, gates, manifest);

  return {
    schemaVersion: "truth-harness.engine-readiness.v0",
    createdAt: manifest.createdAt,
    localOnly: true,
    networkAccess: "none",
    status: reportStatus(gates),
    manifestStatus: manifest.status,
    summary: {
      readyClaimClasses,
      totalClaimClasses: claimClasses.length,
      blockedClaimClasses,
      plannedClaimClasses,
      readyCapabilities: manifest.readyCount,
      totalCapabilities: manifest.totalCount,
      readyTrustLabels,
      missingExternalEngines
    },
    gates,
    claimClasses,
    trustBoundary: {
      aiOutputIsNotEvidence: true,
      statusProbeIsNotEvidence: true,
      readinessDoesNotMintEvidence: true,
      professorReadyRequiresConcreteEngineRuns: true,
      provedRequiresAcceptedProofCheckerRun: true,
      hardProblemsRequireDomainValidation: true
    },
    recommendedNextActions,
    warnings: [
      ...manifest.warnings,
      "Readiness reports do not mint evidence; each claim still needs its own receipt, proof check, SMT run, CAS check, source citation, or validation artifact."
    ]
  };
}

function claimClassReadiness(
  definition: ClaimClassDefinition,
  capabilityById: Map<string, EngineCapability>
): EngineReadinessClaimClass {
  const capabilities = definition.requiredCapabilityIds.map((id) => capabilityById.get(id));
  const readyCapabilityIds = capabilities
    .filter((capability): capability is EngineCapability => capability !== undefined && capabilityReady(capability))
    .map((capability) => capability.id);
  const missingCapabilityIds = definition.requiredCapabilityIds.filter((id) => !readyCapabilityIds.includes(id));
  const status = claimClassStatus(definition, readyCapabilityIds.length, missingCapabilityIds.length);
  const nextActions = nextActionsFor(definition, capabilities, status);

  return {
    id: definition.id,
    displayName: definition.displayName,
    lane: definition.lane,
    status,
    targetTrust: definition.targetTrust,
    supportKind: definition.supportKind,
    requiredCapabilityIds: definition.requiredCapabilityIds,
    readyCapabilityIds,
    missingCapabilityIds,
    evidenceRule: definition.evidenceRule,
    reviewerMeaning: definition.reviewerMeaning,
    recommendedCommand: definition.recommendedCommand,
    limitations: definition.limitations,
    nextActions
  };
}

function claimClassStatus(
  definition: ClaimClassDefinition,
  readyCount: number,
  missingCount: number
): EngineReadinessStatus {
  if (definition.planned) return "planned";
  if (definition.match === "all") return missingCount === 0 ? "ready" : "blocked";
  if (readyCount > 0) return "ready";
  return "blocked";
}

function capabilityReady(capability: EngineCapability): boolean {
  return capability.status === "ready" || capability.status === "available";
}

function nextActionsFor(
  definition: ClaimClassDefinition,
  capabilities: Array<EngineCapability | undefined>,
  status: EngineReadinessStatus
): string[] {
  if (status === "ready") {
    return definition.recommendedCommand ? [`Run claim-specific receipts with \`${definition.recommendedCommand}\`.`] : [];
  }
  if (status === "degraded") {
    return [
      ...capabilities.flatMap((capability) => capability?.nextStep ? [capability.nextStep] : []),
      "Add the second independent engine before treating this as a robust reviewer gate."
    ];
  }
  if (status === "planned") {
    return ["Keep this out of trust labels until the adapter has fixtures, schemas, replay tests, and Docker coverage."];
  }
  return capabilities.flatMap((capability) => capability?.nextStep ? [capability.nextStep] : []);
}

function readinessGate(
  gate: (typeof GATE_DEFINITIONS)[number],
  claimClasses: EngineReadinessClaimClass[]
): EngineReadinessGate {
  const missingClaimClasses = gate.requiredClaimClasses.filter((id) => {
    const claimClass = claimClasses.find((entry) => entry.id === id);
    return claimClass?.status !== "ready";
  });
  const status = missingClaimClasses.length === 0 ? "ready" : "blocked";
  const nextActions = missingClaimClasses.flatMap((id) => {
    const claimClass = claimClasses.find((entry) => entry.id === id);
    return claimClass?.nextActions ?? [];
  });

  return {
    id: gate.id,
    title: gate.title,
    status,
    summary: status === "ready" ? gate.readySummary : gate.blockedSummary,
    requiredClaimClasses: [...gate.requiredClaimClasses],
    missingClaimClasses,
    nextActions: dedupeStrings(nextActions).slice(0, 8)
  };
}

function reportStatus(gates: EngineReadinessGate[]): EngineReadinessReport["status"] {
  const mathCoreReady = gateReady(gates, "math-core");
  const professorReady = gateReady(gates, "professor-review");
  const agentReady = gateReady(gates, "agent-autonomy");
  if (mathCoreReady && professorReady && agentReady) return "professor-ready";
  if (mathCoreReady) return "research-core-ready";
  if (gates.some((gate) => gate.status === "ready")) return "partial";
  return "blocked";
}

function gateReady(gates: EngineReadinessGate[], id: string): boolean {
  return gates.find((gate) => gate.id === id)?.status === "ready";
}

function readyTrustLabelsFor(claimClasses: EngineReadinessClaimClass[]): Array<TrustLabel | "provenance-only"> {
  return dedupeStrings(
    claimClasses
      .filter((entry) => entry.status === "ready" && entry.targetTrust !== "none")
      .map((entry) => entry.targetTrust)
  ) as Array<TrustLabel | "provenance-only">;
}

function recommendedActionsFor(
  claimClasses: EngineReadinessClaimClass[],
  gates: EngineReadinessGate[],
  manifest: EngineManifest
): string[] {
  const actions: string[] = [];
  const professorGate = gates.find((gate) => gate.id === "professor-review");
  const agentGate = gates.find((gate) => gate.id === "agent-autonomy");

  if (professorGate?.status !== "ready") {
    actions.push("Run `npm run docker:engines` or configure Maxima/Z3/cvc5/Lean locally before professor-facing math claims.");
  }
  if (agentGate?.status !== "ready") {
    actions.push("Keep agent-triggered code execution gated until `truth-harness code sandbox-status --json` can attest the sandbox boundary.");
  }
  actions.push(
    ...claimClasses
      .filter((entry) => entry.status === "blocked" && entry.supportKind === "external-adapter")
      .flatMap((entry) => entry.nextActions)
  );
  if (manifest.warnings.length > 0) {
    actions.push("Resolve engine warnings before public demos or reviewer packets.");
  }
  actions.push("Use `truth-harness engines verify --write --require-all-engines` when you need durable reviewer evidence.");

  return dedupeStrings(actions).slice(0, 10);
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

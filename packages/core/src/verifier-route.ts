import { getEngineManifest, type EngineCapability, type EngineManifest, type EngineManifestOptions } from "./engine-manifest.js";
import { createReceipt, type CreateReceiptOptions } from "./receipt.js";
import { stableHash } from "./stable-hash.js";
import type { Receipt, ReceiptEvidenceProfile, TrustLabel } from "./types.js";

export type VerifierRouteStatus = "verified" | "refuted" | "unverified";
export type VerifierRouteStepStatus = "used" | "blocked" | "planned";
export type VerifierRouteGapSeverity = "info" | "warning" | "critical";

export interface CreateVerifierRouteOptions extends CreateReceiptOptions, EngineManifestOptions {}

export interface VerifierRouteStep {
  capabilityId: string;
  displayName: string;
  status: VerifierRouteStepStatus;
  capabilityStatus: EngineCapability["status"];
  strongestTrust: EngineCapability["strongestTrust"];
  canMintTrust: boolean;
  reason: string;
  command?: string;
  nextStep?: string;
}

export interface VerifierRouteGap {
  capabilityId: string;
  displayName: string;
  severity: VerifierRouteGapSeverity;
  reason: string;
  command?: string;
  nextStep?: string;
}

export interface VerifierRoute {
  schemaVersion: "theorem.verifier-route.v0";
  routeId: string;
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  problem: string;
  normalizedProblem: string;
  status: VerifierRouteStatus;
  finalTrust: TrustLabel;
  evidenceKind: ReceiptEvidenceProfile["kind"];
  receipt: Receipt;
  manifest: {
    schemaVersion: EngineManifest["schemaVersion"];
    status: EngineManifest["status"];
    readyCount: number;
    totalCount: number;
    nativeCount: number;
    adapterCount: number;
    plannedCount: number;
  };
  usedCapabilities: VerifierRouteStep[];
  blockedCapabilities: VerifierRouteStep[];
  plannedCapabilities: VerifierRouteStep[];
  gaps: VerifierRouteGap[];
  nextActions: string[];
  trustBoundary: EngineManifest["trustBoundary"] & {
    routeIsNotProof: true;
    receiptTrustIsUpperBound: true;
  };
  warnings: string[];
}

export function createVerifierRoute(problem: string, options: CreateVerifierRouteOptions = {}): VerifierRoute {
  const createdAt = (options.now ?? new Date()).toISOString();
  const manifest = getEngineManifest(options);
  const receipt = createReceipt(problem, options);
  const capabilityById = new Map(manifest.capabilities.map((capability) => [capability.id, capability]));
  const usedCapabilityIds = capabilityIdsForReceipt(receipt);
  const usedCapabilities = usedCapabilityIds.map((capabilityId) =>
    routeStep(capabilityById, capabilityId, "used", usedReason(receipt, capabilityId))
  );
  const blockedCapabilities = blockedCapabilityIdsForReceipt(receipt)
    .filter((capabilityId) => !usedCapabilityIds.includes(capabilityId))
    .map((capabilityId) => routeStep(capabilityById, capabilityId, "blocked", blockedReason(receipt, capabilityId)))
    .filter((step) => step.capabilityStatus !== "available" && step.capabilityStatus !== "ready");
  const plannedCapabilities = manifest.capabilities
    .filter((capability) => capability.kind === "planned-adapter" && plannedCapabilityApplies(receipt, capability))
    .map((capability) => routeStep(capabilityById, capability.id, "planned", "Planned adapter is relevant but cannot support this route yet."));
  const gaps = routeGaps(receipt, [...blockedCapabilities, ...plannedCapabilities]);
  const nextActions = nextRouteActions(receipt, gaps);

  return {
    schemaVersion: "theorem.verifier-route.v0",
    routeId: `route_${stableHash({
      problem,
      receipt: receipt.runId,
      finalTrust: receipt.trust,
      evidenceKind: receipt.evidenceProfile.kind,
      createdAt
    }).slice(0, 16)}`,
    createdAt,
    localOnly: true,
    networkAccess: "none",
    problem,
    normalizedProblem: receipt.normalizedProblem,
    status: receipt.trust === "refuted" ? "refuted" : receipt.trust === "unverified" ? "unverified" : "verified",
    finalTrust: receipt.trust,
    evidenceKind: receipt.evidenceProfile.kind,
    receipt,
    manifest: {
      schemaVersion: manifest.schemaVersion,
      status: manifest.status,
      readyCount: manifest.readyCount,
      totalCount: manifest.totalCount,
      nativeCount: manifest.nativeCount,
      adapterCount: manifest.adapterCount,
      plannedCount: manifest.plannedCount
    },
    usedCapabilities,
    blockedCapabilities,
    plannedCapabilities,
    gaps,
    nextActions,
    trustBoundary: {
      ...manifest.trustBoundary,
      routeIsNotProof: true,
      receiptTrustIsUpperBound: true
    },
    warnings: [...manifest.warnings, ...receipt.findings.filter((finding) => finding.level !== "info").map((finding) => finding.message)]
  };
}

function capabilityIdsForReceipt(receipt: Receipt): string[] {
  const mapped = receipt.evidenceProfile.backends
    .map((backend) => backendToCapabilityId(backend.id))
    .filter((capabilityId): capabilityId is string => Boolean(capabilityId));

  if (receipt.evidenceProfile.kind === "universal-parity" && receipt.trust !== "refuted") {
    mapped.push("finite-counterexample-search");
  }

  return unique(mapped);
}

function blockedCapabilityIdsForReceipt(receipt: Receipt): string[] {
  switch (receipt.evidenceProfile.kind) {
    case "symbolic-cas":
      return receipt.trust === "cross-checked"
        ? ["lean-proof-checker"]
        : ["maxima-cas", "lean-proof-checker"];
    case "universal-parity":
      return receipt.trust === "refuted" ? [] : ["lean-proof-checker", "z3-smt-solver"];
    case "unsupported":
      return ["lean-proof-checker", "z3-smt-solver", "maxima-cas"];
    case "interval-bound":
      return ["lean-proof-checker"];
    case "dimension-analysis":
      return [];
    case "exact-arithmetic":
      return [];
    case "source-citation":
      return ["local-vector-rag"];
  }
}

function routeStep(
  capabilityById: Map<string, EngineCapability>,
  capabilityId: string,
  status: VerifierRouteStepStatus,
  reason: string
): VerifierRouteStep {
  const capability = capabilityById.get(capabilityId) ?? missingCapability(capabilityId);
  return {
    capabilityId,
    displayName: capability.displayName,
    status,
    capabilityStatus: capability.status,
    strongestTrust: capability.strongestTrust,
    canMintTrust: capability.canMintTrust,
    reason,
    command: capability.command,
    nextStep: capability.nextStep
  };
}

function routeGaps(receipt: Receipt, steps: VerifierRouteStep[]): VerifierRouteGap[] {
  const gaps = steps.map((step): VerifierRouteGap => ({
    capabilityId: step.capabilityId,
    displayName: step.displayName,
    severity: gapSeverity(receipt, step),
    reason: step.reason,
    command: step.command,
    nextStep: step.nextStep
  }));

  if (receipt.trust !== "unverified" && !receipt.evidenceProfile.proofCheckerBacked && receipt.trust !== "refuted") {
    gaps.push({
      capabilityId: "accepted-proof-checker",
      displayName: "Accepted proof checker",
      severity: receipt.evidenceProfile.kind === "exact-arithmetic" ? "info" : "warning",
      reason: "The current receipt is replayable evidence, but not accepted proof-checker output.",
      command: "theorem proof check <workspace-local.lean> --write",
      nextStep: "Use Lean or another accepted proof checker before saying `proved`."
    });
  }

  return gaps;
}

function nextRouteActions(receipt: Receipt, gaps: VerifierRouteGap[]): string[] {
  if (receipt.trust === "refuted") {
    return [
      "Record the counterexample as the final narrow claim.",
      "Use the claim ledger if a downstream result depended on the refuted statement."
    ];
  }

  const actions = gaps
    .filter((gap) => gap.severity !== "info")
    .map((gap) => gap.nextStep ?? gap.command ?? `Resolve ${gap.displayName}.`);

  if (actions.length > 0) {
    return unique(actions).slice(0, 5);
  }

  if (receipt.trust === "unverified") {
    return [
      "Keep the claim unverified.",
      "Narrow the prompt or add a concrete proof, SMT, CAS, source, or simulation artifact."
    ];
  }

  return [
    "Record this as a narrow evidence-backed claim.",
    "Do not generalize beyond the receipt inputs, outputs, and limitations."
  ];
}

function usedReason(receipt: Receipt, capabilityId: string): string {
  if (capabilityId === "finite-counterexample-search" && receipt.trust === "refuted") {
    return "Found a concrete exact counterexample.";
  }

  if (capabilityId === "maxima-cas" && receipt.trust === "cross-checked") {
    return "Independent Maxima run agreed with the local symbolic result.";
  }

  return `Supported the ${receipt.evidenceProfile.kind} receipt with trust ${receipt.trust}.`;
}

function blockedReason(receipt: Receipt, capabilityId: string): string {
  if (capabilityId === "maxima-cas") {
    return "Independent CAS agreement is required before symbolic results become cross-checked.";
  }

  if (capabilityId === "lean-proof-checker") {
    return receipt.trust === "unverified"
      ? "A formal proof checker is the next credible route for this unresolved claim."
      : "The current result is not an accepted proof-checker run, so it must not be labeled proved.";
  }

  if (capabilityId === "z3-smt-solver") {
    return "A concrete SMT-LIB run could support bounded logic or satisfiability claims, but no solver-backed record exists yet.";
  }

  if (capabilityId === "local-vector-rag") {
    return "Lexical source search exists, but vector/PDF citation and contradiction checks are not implemented yet.";
  }

  return `Capability ${capabilityId} was not available for this route.`;
}

function gapSeverity(receipt: Receipt, step: VerifierRouteStep): VerifierRouteGapSeverity {
  if (receipt.trust === "unverified") {
    return "critical";
  }

  if (step.status === "planned") {
    return "info";
  }

  return "warning";
}

function plannedCapabilityApplies(receipt: Receipt, capability: EngineCapability): boolean {
  if (receipt.evidenceProfile.kind === "unsupported") {
    return ["math", "sources", "physics/bio/engineering"].includes(capability.lane);
  }

  if (receipt.evidenceProfile.kind === "symbolic-cas" || receipt.evidenceProfile.kind === "universal-parity") {
    return capability.lane === "math";
  }

  if (receipt.evidenceProfile.kind === "source-citation") {
    return capability.lane === "sources";
  }

  return capability.id === "rigorous-numerics" && receipt.evidenceProfile.kind === "interval-bound";
}

function backendToCapabilityId(backendId: string): string | undefined {
  const mapped = new Map<string, string>([
    ["finite-counterexample-search", "finite-counterexample-search"],
    ["local-rational-arithmetic", "local-rational-arithmetic"],
    ["local-modular-parity-checker", "local-mod2-parity-kernel"],
    ["local-dimensional-analysis", "local-dimensional-analysis"],
    ["local-rational-interval-arithmetic", "rational-interval-bounds"],
    ["local-sympy-subprocess", "sympy-symbolic-adapter"],
    ["local-maxima-symbolic-subprocess", "maxima-cas"]
  ]);

  return mapped.get(backendId);
}

function missingCapability(capabilityId: string): EngineCapability {
  return {
    id: capabilityId,
    displayName: capabilityId,
    kind: "planned-adapter",
    lane: "unknown",
    status: "missing",
    role: "unknown",
    localOnly: true,
    networkAccess: "unknown",
    strongestTrust: "none",
    canMintTrust: false,
    statusProbeMintedEvidence: false,
    trustBoundary: "Capability was referenced by a route but is not present in the manifest.",
    limitations: ["Missing from engine manifest."]
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

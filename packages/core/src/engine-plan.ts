import { createEngineReadinessReportFromManifest } from "./engine-readiness.js";
import { getEngineManifest, type EngineCapability, type EngineManifest, type EngineManifestOptions } from "./engine-manifest.js";
import type { TrustLabel } from "./types.js";

export type EnginePlanProblemKind =
  | "exact-arithmetic"
  | "symbolic-algebra"
  | "universal-claim"
  | "smt-constraint"
  | "formal-proof"
  | "dimension-check"
  | "interval-bound"
  | "source-grounded"
  | "simulation-or-engineering"
  | "unknown";

export type EnginePlanStatus = "ready-to-route" | "route-with-open-gates" | "insufficient-engines";
export type EnginePlanStepRole =
  | "primary-check"
  | "refutation-check"
  | "independent-cross-check"
  | "solver-check"
  | "proof-check"
  | "source-check"
  | "provenance-check"
  | "planned-upgrade";

export interface EnginePlanStep {
  rank: number;
  capabilityId: string;
  displayName: string;
  role: EnginePlanStepRole;
  status: EngineCapability["status"];
  canRunNow: boolean;
  trustIfSuccessful: TrustLabel | "provenance-only" | "validation-plan" | "none";
  command?: string;
  evidenceRequired: string;
  limitation: string;
}

export interface EnginePlanComparisonRow {
  capabilityId: string;
  displayName: string;
  role: EnginePlanStepRole;
  status: EngineCapability["status"];
  trustIfSuccessful: TrustLabel | "provenance-only" | "validation-plan" | "none";
  agreementValue: "primary" | "independent" | "stronger-formalization" | "context" | "planned";
  honestBoundary: string;
}

export interface EnginePlan {
  schemaVersion: "truth-harness.engine-plan.v0";
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  problem: string;
  normalizedProblem: string;
  classifications: EnginePlanProblemKind[];
  status: EnginePlanStatus;
  targetTrustCeiling: TrustLabel | "provenance-only" | "none";
  recommendedFirstCommand: string;
  steps: EnginePlanStep[];
  comparisonMatrix: EnginePlanComparisonRow[];
  blockedCapabilityIds: string[];
  readyCapabilityIds: string[];
  nextActions: string[];
  trustBoundary: {
    planDoesNotMintEvidence: true;
    statusProbeIsNotEvidence: true;
    strongestLabelRequiresConcreteArtifact: true;
    proofRequiresAcceptedProofChecker: true;
    crossCheckRequiresIndependentAgreement: true;
    smtRequiresEncodedSolverRun: true;
  };
  warnings: string[];
}

export interface CreateEnginePlanOptions extends EngineManifestOptions {
  now?: Date;
  manifest?: EngineManifest;
}

interface StepTemplate {
  capabilityId: string;
  role: EnginePlanStepRole;
  evidenceRequired: string;
  agreementValue: EnginePlanComparisonRow["agreementValue"];
}

export function createEnginePlan(problem: string, options: CreateEnginePlanOptions = {}): EnginePlan {
  const normalizedProblem = normalizeProblem(problem);
  const manifest = options.manifest ?? getEngineManifest(options);
  const readiness = createEngineReadinessReportFromManifest(manifest);
  const classifications = classifyProblem(normalizedProblem);
  const templates = routeTemplatesFor(classifications);
  const steps = buildPlanSteps(templates, manifest.capabilities);
  const readyCapabilityIds = steps.filter((step) => step.canRunNow).map((step) => step.capabilityId);
  const blockedCapabilityIds = steps.filter((step) => !step.canRunNow).map((step) => step.capabilityId);
  const targetTrustCeiling = strongestTrustFor(steps);
  const status = planStatus(steps, classifications);

  return {
    schemaVersion: "truth-harness.engine-plan.v0",
    createdAt: (options.now ?? new Date()).toISOString(),
    localOnly: true,
    networkAccess: "none",
    problem,
    normalizedProblem,
    classifications,
    status,
    targetTrustCeiling,
    recommendedFirstCommand: recommendedFirstCommand(problem, steps),
    steps,
    comparisonMatrix: steps.map((step, index) => comparisonRow(step, templates[index])),
    blockedCapabilityIds,
    readyCapabilityIds,
    nextActions: nextActionsFor(problem, steps, readiness.summary.missingExternalEngines),
    trustBoundary: {
      planDoesNotMintEvidence: true,
      statusProbeIsNotEvidence: true,
      strongestLabelRequiresConcreteArtifact: true,
      proofRequiresAcceptedProofChecker: true,
      crossCheckRequiresIndependentAgreement: true,
      smtRequiresEncodedSolverRun: true
    },
    warnings: [
      ...manifest.warnings,
      "This engine plan is a routing contract only. It does not run engines, create receipts, or prove the problem."
    ]
  };
}

export function classifyProblem(problem: string): EnginePlanProblemKind[] {
  const kinds: EnginePlanProblemKind[] = [];
  const text = normalizeProblem(problem);

  if (/\b(dimension|unit|units|force|mass|acceleration|velocity|energy|power)\b/u.test(text)) {
    kinds.push("dimension-check");
  }
  if (/\b(bound|bounds|interval|range|minimum|maximum|min|max)\b/u.test(text)) {
    kinds.push("interval-bound");
  }
  if (/\b(for all|forall|∀|every integer|all integers|universal)\b/u.test(text)) {
    kinds.push("universal-claim");
  }
  if (/\b(smt|constraint|constraints|sat|unsat|integer solution|integer constraints)\b/u.test(text) || /[a-z]\s*[<>]=?\s*-?\d/u.test(text)) {
    kinds.push("smt-constraint");
  }
  if (/\b(prove|proof|theorem|lemma|lean|mathlib|formalize|formal proof)\b/u.test(text)) {
    kinds.push("formal-proof");
  }
  if (/\b(symbolic|simplify|factor|expand|differentiate|integrate|derive|solve|sin|cos|tan|log|polynomial|matrix|eigen)\b/u.test(text)) {
    kinds.push("symbolic-algebra");
  }
  if (/\b(source|citation|cite|paper|literature|doi|arxiv|study|dataset)\b/u.test(text)) {
    kinds.push("source-grounded");
  }
  if (/\b(simulate|simulation|physics engine|graphics engine|robotics|geometry|numerical|floating|float|ode|pde|finite element)\b/u.test(text)) {
    kinds.push("simulation-or-engineering");
  }
  if (looksLikeExactArithmetic(text)) {
    kinds.push("exact-arithmetic");
  }

  return dedupe(kinds.length > 0 ? kinds : ["unknown"]);
}

function routeTemplatesFor(kinds: EnginePlanProblemKind[]): StepTemplate[] {
  const templates: StepTemplate[] = [];

  if (kinds.includes("exact-arithmetic")) {
    templates.push({
      capabilityId: "local-rational-arithmetic",
      role: "primary-check",
      evidenceRequired: "Replayable exact arithmetic receipt with normalized expression, exact output, and step trace.",
      agreementValue: "primary"
    });
  }
  if (kinds.includes("universal-claim")) {
    templates.push({
      capabilityId: "finite-counterexample-search",
      role: "refutation-check",
      evidenceRequired: "Concrete counterexample receipt if the universal claim is false within the supported search boundary.",
      agreementValue: "primary"
    });
    templates.push({
      capabilityId: "local-mod2-parity-kernel",
      role: "primary-check",
      evidenceRequired: "Narrow modular certificate when the claim fits the supported parity grammar.",
      agreementValue: "primary"
    });
  }
  if (kinds.includes("dimension-check")) {
    templates.push({
      capabilityId: "local-dimensional-analysis",
      role: "primary-check",
      evidenceRequired: "Dimension-vector receipt for both sides of the equation.",
      agreementValue: "primary"
    });
  }
  if (kinds.includes("interval-bound") || kinds.includes("simulation-or-engineering")) {
    templates.push({
      capabilityId: "rational-interval-bounds",
      role: "primary-check",
      evidenceRequired: "Conservative interval receipt with expression, domain, and output interval.",
      agreementValue: "primary"
    });
  }
  if (kinds.includes("symbolic-algebra") || kinds.includes("simulation-or-engineering")) {
    templates.push({
      capabilityId: "sympy-symbolic-adapter",
      role: "primary-check",
      evidenceRequired: "Concrete SymPy receipt for the encoded symbolic expression and operation.",
      agreementValue: "primary"
    });
    templates.push({
      capabilityId: "maxima-cas",
      role: "independent-cross-check",
      evidenceRequired: "Independent Maxima agreement record over the same scoped expression and expected result.",
      agreementValue: "independent"
    });
    templates.push({
      capabilityId: "sage-cas",
      role: "independent-cross-check",
      evidenceRequired: "Constrained SageMath agreement record over the same scoped expression and expected result.",
      agreementValue: "independent"
    });
  }
  if (kinds.includes("smt-constraint") || kinds.includes("universal-claim") || kinds.includes("simulation-or-engineering")) {
    templates.push({
      capabilityId: "z3-smt-solver",
      role: "solver-check",
      evidenceRequired: "Concrete SMT-LIB artifact checked by Z3 with sat/unsat result and replay command.",
      agreementValue: "independent"
    });
    templates.push({
      capabilityId: "cvc5-smt-solver",
      role: "solver-check",
      evidenceRequired: "Second-solver SMT-LIB check for reviewer-grade solver diversity when needed.",
      agreementValue: "independent"
    });
  }
  if (kinds.includes("formal-proof") || kinds.includes("universal-claim") || kinds.includes("symbolic-algebra")) {
    templates.push({
      capabilityId: "lean-proof-checker",
      role: "proof-check",
      evidenceRequired: "Accepted Lean proof-check record scoped to the exact formal statement.",
      agreementValue: "stronger-formalization"
    });
  }
  if (kinds.includes("source-grounded")) {
    templates.push({
      capabilityId: "local-corpus-lexical-search",
      role: "source-check",
      evidenceRequired: "Local source citation receipt with resolvable chunk metadata.",
      agreementValue: "context"
    });
  }
  templates.push({
    capabilityId: "claim-ledger",
    role: "provenance-check",
    evidenceRequired: "Claim ledger record that cites only resolvable local evidence refs and leaves open gates visible.",
    agreementValue: "context"
  });
  if (kinds.includes("simulation-or-engineering")) {
    templates.push({
      capabilityId: "rigorous-numerics",
      role: "planned-upgrade",
      evidenceRequired: "Future rigorous numerics record with precision budget, backend version, and error bounds.",
      agreementValue: "planned"
    });
    templates.push({
      capabilityId: "domain-simulation-adapters",
      role: "planned-upgrade",
      evidenceRequired: "Future simulation provenance record with assumptions, parameters, seeds, uncertainty, and validation gates.",
      agreementValue: "planned"
    });
  }

  if (templates.length === 1) {
    templates.unshift({
      capabilityId: "workspace-validation",
      role: "provenance-check",
      evidenceRequired: "Valid local workspace schemas and resolvable artifact references.",
      agreementValue: "context"
    });
  }

  return dedupeTemplates(templates);
}

function buildPlanSteps(templates: StepTemplate[], capabilities: EngineCapability[]): EnginePlanStep[] {
  return templates.map((template, index) => {
    const capability = capabilities.find((entry) => entry.id === template.capabilityId) ?? missingCapability(template.capabilityId);
    return {
      rank: index + 1,
      capabilityId: capability.id,
      displayName: capability.displayName,
      role: template.role,
      status: capability.status,
      canRunNow: capability.status === "ready" || capability.status === "available",
      trustIfSuccessful: capability.strongestTrust,
      command: capability.command,
      evidenceRequired: template.evidenceRequired,
      limitation: capability.limitations[0] ?? capability.trustBoundary
    };
  });
}

function comparisonRow(step: EnginePlanStep, template: StepTemplate | undefined): EnginePlanComparisonRow {
  return {
    capabilityId: step.capabilityId,
    displayName: step.displayName,
    role: step.role,
    status: step.status,
    trustIfSuccessful: step.trustIfSuccessful,
    agreementValue: template?.agreementValue ?? "context",
    honestBoundary: boundaryForStep(step)
  };
}

function strongestTrustFor(steps: EnginePlanStep[]): EnginePlan["targetTrustCeiling"] {
  const readyTrusts = steps.filter((step) => step.canRunNow).map((step) => step.trustIfSuccessful);
  const order: Array<EnginePlan["targetTrustCeiling"]> = [
    "proved",
    "smt-checked",
    "cross-checked",
    "bounded-numeric",
    "dimension-checked",
    "exact-computed",
    "source-cited",
    "refuted",
    "provenance-only",
    "none"
  ];
  return order.find((trust) => readyTrusts.includes(trust)) ?? "none";
}

function planStatus(steps: EnginePlanStep[], kinds: EnginePlanProblemKind[]): EnginePlanStatus {
  const nonPlanned = steps.filter((step) => step.status !== "planned");
  const runnable = nonPlanned.filter((step) => step.canRunNow);
  if (runnable.length === 0) return "insufficient-engines";
  const needsExternalReviewerEngine = kinds.some((kind) =>
    ["symbolic-algebra", "smt-constraint", "formal-proof", "simulation-or-engineering"].includes(kind)
  );
  if (needsExternalReviewerEngine && nonPlanned.some((step) => !step.canRunNow && step.role !== "provenance-check")) {
    return "route-with-open-gates";
  }
  return "ready-to-route";
}

function recommendedFirstCommand(problem: string, steps: EnginePlanStep[]): string {
  const firstRunnable = steps.find((step) => step.canRunNow && step.command);
  if (!firstRunnable) {
    return `truth-harness verify ${JSON.stringify(problem)} --write`;
  }
  if (firstRunnable.capabilityId === "claim-ledger" || firstRunnable.capabilityId === "workspace-validation") {
    return firstRunnable.command ?? `truth-harness verify ${JSON.stringify(problem)} --write`;
  }
  return `truth-harness verify ${JSON.stringify(problem)} --write`;
}

function nextActionsFor(problem: string, steps: EnginePlanStep[], missingExternalEngines: string[]): string[] {
  const actions = [`Run \`${recommendedFirstCommand(problem, steps)}\` to create a verifier route and durable obligation ledger.`];
  const missing = steps.filter((step) => !step.canRunNow && step.status !== "planned");
  if (missing.some((step) => step.capabilityId === "maxima-cas" || step.capabilityId === "z3-smt-solver" || step.capabilityId === "cvc5-smt-solver")) {
    actions.push("Use `npm run docker:engines` or `npm run docker:professor` for no-network CAS/SMT reviewer evidence.");
  }
  if (missing.some((step) => step.capabilityId === "lean-proof-checker")) {
    actions.push("Use `docker compose run --rm lean-proof` or configure Lean before claiming `proved`.");
  }
  if (missing.some((step) => step.capabilityId === "sage-cas")) {
    actions.push("Use `npm run docker:sage` or the all-engine reviewer image when SageMath breadth is required.");
  }
  if (missingExternalEngines.length > 0) {
    actions.push(`Missing external engines in this runtime: ${missingExternalEngines.join(", ")}.`);
  }
  actions.push("Attach only concrete receipt/proof/SMT/CAS/source evidence to claims; keep unsupported steps as open gates.");
  return dedupe(actions).slice(0, 8);
}

function boundaryForStep(step: EnginePlanStep): string {
  if (step.role === "proof-check") {
    return "`proved` is allowed only after an accepted proof-check artifact for the exact formal statement.";
  }
  if (step.role === "solver-check") {
    return "`smt-checked` covers the encoded SMT-LIB constraints, not the full informal prompt.";
  }
  if (step.role === "independent-cross-check") {
    return "`cross-checked` means independent CAS agreement for a scoped expression, not formal proof.";
  }
  if (step.role === "planned-upgrade") {
    return "Planned adapters mint no trust until implemented with fixtures, schemas, replay, and Docker coverage.";
  }
  if (step.role === "source-check") {
    return "`source-cited` means local citation support, not entailment or scientific truth.";
  }
  return "This step supports only the narrow encoded artifact and must be recorded before a claim can cite it.";
}

function looksLikeExactArithmetic(text: string): boolean {
  if (/\b(compute|calculate|evaluate|exact)\b/u.test(text) && /[-+*/^]/u.test(text) && /\d/u.test(text)) {
    return true;
  }
  return /^[\s\d().,+\-*/^/]+$/u.test(text) && /\d/u.test(text) && /[-+*/]/u.test(text);
}

function normalizeProblem(problem: string): string {
  return problem.trim().replace(/\s+/gu, " ").toLowerCase();
}

function missingCapability(id: string): EngineCapability {
  return {
    id,
    displayName: id,
    kind: "planned-adapter",
    lane: "unknown",
    status: "missing",
    role: "unknown",
    localOnly: true,
    networkAccess: "unknown",
    strongestTrust: "none",
    canMintTrust: false,
    statusProbeMintedEvidence: false,
    trustBoundary: "Capability was not found in the local engine manifest.",
    limitations: ["No local capability manifest entry exists for this planned route."],
    determinism: {
      determinismClass: "planned",
      deterministic: false,
      replayable: false,
      primitiveSemantics: "not-implemented",
      aiParserFriendly: true,
      replayRequirements: ["No replay contract exists."],
      driftRisks: ["Unknown capability cannot support trust."]
    }
  };
}

function dedupe<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function dedupeTemplates(templates: StepTemplate[]): StepTemplate[] {
  const seen = new Set<string>();
  return templates.filter((template) => {
    const key = `${template.capabilityId}:${template.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

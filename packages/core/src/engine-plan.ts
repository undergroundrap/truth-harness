import { createEngineReadinessReportFromManifest } from "./engine-readiness.js";
import { ENGINE_2D_COLLISION_CAPABILITY_ID, type EngineVerifierPack } from "./engine-verifier-pack.js";
import { getEngineManifest, type EngineCapability, type EngineManifest, type EngineManifestOptions } from "./engine-manifest.js";
import type { EngineVerificationRunSummary } from "./engine-verification.js";
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
  | "engine-geometry"
  | "concurrent-systems"
  | "hardware-eda"
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
  verifierPacks: EnginePlanVerifierPackSummary[];
  blockedCapabilityIds: string[];
  readyCapabilityIds: string[];
  savedReviewerEvidence: EnginePlanSavedReviewerEvidence;
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
  savedEngineRuns?: EngineVerificationRunSummary[];
}

export interface EnginePlanVerifierPackSummary {
  id: string;
  capabilityId: string;
  displayName: string;
  lane: string;
  status: EngineVerifierPack["status"];
  benchmarkTasks: number;
  nativeReplayCommand: string;
  dockerReplayCommand: string;
  supportedBackendIds: string[];
  agentContract: EngineVerifierPack["agentContract"];
  limitations: string[];
}

export interface EnginePlanSavedReviewerEvidence {
  status: "available" | "none";
  runId?: string;
  path?: string;
  requiredPassed?: number;
  requiredTotal?: number;
  coveredCapabilityIds: string[];
  summary: string;
  trustBoundary: string;
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
  const savedReviewerEvidence = savedReviewerEvidenceFor(options.savedEngineRuns ?? []);
  const steps = buildPlanSteps(templates, manifest.capabilities, savedReviewerEvidence);
  const verifierPacks = verifierPackSummariesFor(steps, manifest.verifierPacks);
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
    verifierPacks,
    blockedCapabilityIds,
    readyCapabilityIds,
    savedReviewerEvidence,
    nextActions: nextActionsFor(problem, steps, readiness.summary.missingExternalEngines, savedReviewerEvidence),
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
  if (/\b(aabb|axis[-\s]?aligned|circle|capsule|segment|ray|raycast|triangle|barycentric|interpolation|collision|collide|overlap|intersect|intersection|hit[-\s]?test|point[-\s]?in[-\s]?triangle|swept)\b/u.test(text)) {
    kinds.push("engine-geometry");
  }
  if (/\b(simulate|simulation|physics engine|graphics engine|robotics|geometry|numerical|floating|float|ode|pde|finite element)\b/u.test(text)) {
    kinds.push("simulation-or-engineering");
  }
  if (
    /\b(rust|concurrent|concurrency|parallel|thread|threads|mutex|lock[-\s]?free|deadlock|data[-\s]?race|scheduler|ecs|game loop|resource access|borrow checker)\b/u.test(
      text
    )
  ) {
    kinds.push("concurrent-systems");
  }
  if (/\b(verilog|systemverilog|vhdl|hdl|rtl|eda|fpga|asic|chip|circuit|circuits|sva|formal equivalence|tape[-\s]?out|hardware)\b/u.test(text)) {
    kinds.push("hardware-eda");
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
  if (kinds.includes("engine-geometry")) {
    templates.push({
      capabilityId: ENGINE_2D_COLLISION_CAPABILITY_ID,
      role: "primary-check",
      evidenceRequired:
        "Concrete engine-math receipt from the 2D verifier pack, including integer inputs, boundary convention, exact predicate trace, backend id, and replay command.",
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
  if (kinds.includes("concurrent-systems")) {
    templates.push({
      capabilityId: "code-run-sandbox",
      role: "provenance-check",
      evidenceRequired: "Measured no-network sandbox boundary before any generated Rust, fuzz, or model-check harness is executed.",
      agreementValue: "context"
    });
    templates.push({
      capabilityId: "z3-smt-solver",
      role: "solver-check",
      evidenceRequired: "Scoped SMT/model-check encoding of the scheduler, lock protocol, or resource-access property with a replayable solver result.",
      agreementValue: "independent"
    });
    templates.push({
      capabilityId: "cvc5-smt-solver",
      role: "solver-check",
      evidenceRequired: "Second-solver check for the same concurrency property when reviewer-grade assurance is required.",
      agreementValue: "independent"
    });
    templates.push({
      capabilityId: "lean-proof-checker",
      role: "proof-check",
      evidenceRequired: "Accepted proof artifact for the exact concurrency invariant when the claim outruns bounded/model-check evidence.",
      agreementValue: "stronger-formalization"
    });
    templates.push({
      capabilityId: "concurrent-systems-verifier",
      role: "planned-upgrade",
      evidenceRequired: "Future typed concurrency verifier record linking Rust code, model, schedules explored, fuzz seeds, solver encodings, and replay command.",
      agreementValue: "planned"
    });
  }
  if (kinds.includes("hardware-eda")) {
    templates.push({
      capabilityId: "z3-smt-solver",
      role: "solver-check",
      evidenceRequired: "Scoped SMT/model-check artifact for the RTL/HDL property or formal-equivalence claim.",
      agreementValue: "independent"
    });
    templates.push({
      capabilityId: "cvc5-smt-solver",
      role: "solver-check",
      evidenceRequired: "Second-solver check for the same hardware property when solver diversity is required.",
      agreementValue: "independent"
    });
    templates.push({
      capabilityId: "lean-proof-checker",
      role: "proof-check",
      evidenceRequired: "Accepted formal proof artifact for hardware semantics or equivalence claims that need theorem-level assurance.",
      agreementValue: "stronger-formalization"
    });
    templates.push({
      capabilityId: "hardware-eda-verifier",
      role: "planned-upgrade",
      evidenceRequired: "Future EDA verifier record linking HDL/RTL artifact, property spec, formal tool result, assumptions, and replay command.",
      agreementValue: "planned"
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

function buildPlanSteps(
  templates: StepTemplate[],
  capabilities: EngineCapability[],
  savedReviewerEvidence: EnginePlanSavedReviewerEvidence
): EnginePlanStep[] {
  return templates.map((template, index) => {
    const capability = capabilities.find((entry) => entry.id === template.capabilityId) ?? missingCapability(template.capabilityId);
    const baseLimitation = capability.limitations[0] ?? capability.trustBoundary;
    const limitation =
      savedReviewerEvidence.status === "available" &&
      capability.status !== "ready" &&
      capability.status !== "available" &&
      savedReviewerEvidence.coveredCapabilityIds.includes(capability.id)
        ? `${baseLimitation} Saved reviewer Docker evidence ${savedReviewerEvidence.runId} covers this capability for prior strict review, but this host plan cannot mint trust from that memory; rerun the engine or attach a concrete proof/SMT/CAS artifact for the current claim.`
        : baseLimitation;
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
      limitation
    };
  });
}

function verifierPackSummariesFor(steps: EnginePlanStep[], packs: EngineVerifierPack[]): EnginePlanVerifierPackSummary[] {
  const stepCapabilityIds = new Set(steps.map((step) => step.capabilityId));
  return packs
    .filter((pack) => stepCapabilityIds.has(pack.capabilityId))
    .map((pack) => ({
      id: pack.id,
      capabilityId: pack.capabilityId,
      displayName: pack.displayName,
      lane: pack.lane,
      status: pack.status,
      benchmarkTasks: pack.benchmarkSuite.totalTasks,
      nativeReplayCommand: pack.benchmarkSuite.nativeCommand,
      dockerReplayCommand: pack.benchmarkSuite.dockerCommand,
      supportedBackendIds: pack.capabilities.map((capability) => capability.backendId),
      agentContract: pack.agentContract,
      limitations: pack.limitations
    }));
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
    ["symbolic-algebra", "smt-constraint", "formal-proof", "simulation-or-engineering", "concurrent-systems", "hardware-eda"].includes(kind)
  );
  if (needsExternalReviewerEngine && nonPlanned.some((step) => !step.canRunNow && step.role !== "provenance-check")) {
    return "route-with-open-gates";
  }
  return "ready-to-route";
}

function recommendedFirstCommand(problem: string, steps: EnginePlanStep[]): string {
  if (steps.some((step) => step.capabilityId === "concurrent-systems-verifier")) {
    return `truth-harness validation plan ${JSON.stringify(problem)} --domain software --domain engineering`;
  }
  if (steps.some((step) => step.capabilityId === "hardware-eda-verifier")) {
    return `truth-harness validation plan ${JSON.stringify(problem)} --domain engineering`;
  }
  const firstRunnable = steps.find((step) => step.canRunNow && step.command);
  if (!firstRunnable) {
    return `truth-harness verify ${JSON.stringify(problem)} --write`;
  }
  if (firstRunnable.capabilityId === "claim-ledger" || firstRunnable.capabilityId === "workspace-validation") {
    return firstRunnable.command ?? `truth-harness verify ${JSON.stringify(problem)} --write`;
  }
  return `truth-harness verify ${JSON.stringify(problem)} --write`;
}

function nextActionsFor(
  problem: string,
  steps: EnginePlanStep[],
  missingExternalEngines: string[],
  savedReviewerEvidence: EnginePlanSavedReviewerEvidence
): string[] {
  const firstCommand = recommendedFirstCommand(problem, steps);
  const firstCommandPurpose = firstCommand.startsWith("truth-harness validation plan")
    ? "create validation gates before any agent records or strengthens a claim"
    : "create a verifier route and durable obligation ledger";
  const actions = [`Run \`${firstCommand}\` to ${firstCommandPurpose}.`];
  const missing = steps.filter((step) => !step.canRunNow && step.status !== "planned");
  const savedCoveredMissing = missing.filter((step) => savedReviewerEvidence.coveredCapabilityIds.includes(step.capabilityId));
  if (savedReviewerEvidence.status === "available" && savedCoveredMissing.length > 0) {
    actions.push(
      `Saved reviewer Docker evidence ${savedReviewerEvidence.runId} previously covered ${savedCoveredMissing.map((step) => step.displayName).join(", ")}; rerun the matching Docker gate when this claim needs fresh reviewer evidence.`
    );
  }
  if (missing.some((step) => step.capabilityId === "maxima-cas" || step.capabilityId === "z3-smt-solver" || step.capabilityId === "cvc5-smt-solver")) {
    actions.push("Use `npm run docker:engines` or `npm run docker:professor` for no-network CAS/SMT reviewer evidence.");
  }
  if (missing.some((step) => step.capabilityId === "lean-proof-checker")) {
    actions.push("Use `docker compose run --rm lean-proof` or configure Lean before claiming `proved`.");
  }
  if (missing.some((step) => step.capabilityId === "sage-cas")) {
    actions.push("Use `npm run docker:sage` or the all-engine reviewer image when SageMath breadth is required.");
  }
  if (steps.some((step) => step.capabilityId === ENGINE_2D_COLLISION_CAPABILITY_ID)) {
    actions.push("Use `npm run demo:engine-math` or `npm run docker:engine-math` when changing or reviewer-checking the 2D collision verifier pack.");
  }
  if (steps.some((step) => step.capabilityId === "concurrent-systems-verifier")) {
    actions.push(
      "For Rust/concurrency work, first narrow the property into a scheduler, lock, resource-access, or deadlock claim; do not claim code correctness from tests alone."
    );
  }
  if (steps.some((step) => step.capabilityId === "hardware-eda-verifier")) {
    actions.push(
      "For hardware/EDA work, first narrow the HDL/RTL property and preserve the formal tool assumptions; do not claim tape-out safety from AI-generated prose."
    );
  }
  if (missingExternalEngines.length > 0) {
    actions.push(`Missing external engines in this runtime: ${missingExternalEngines.join(", ")}.`);
  }
  actions.push("Attach only concrete receipt/proof/SMT/CAS/source evidence to claims; keep unsupported steps as open gates.");
  return dedupe(actions).slice(0, 8);
}

function savedReviewerEvidenceFor(runs: EngineVerificationRunSummary[]): EnginePlanSavedReviewerEvidence {
  const passedRuns = runs.filter((run) => run.status === "passed" && run.requiredTotal > 0 && run.requiredPassed === run.requiredTotal);
  const strict = passedRuns.find((run) => run.requiredTotal >= 5);
  const professor = passedRuns.find((run) => run.requiredTotal >= 4);
  const selected = strict ?? professor;
  if (!selected) {
    return {
      status: "none",
      coveredCapabilityIds: [],
      summary: "No saved passing Docker reviewer engine run was supplied to this plan.",
      trustBoundary: "Engine plans never mint trust from saved readiness or reviewer evidence."
    };
  }

  const coveredCapabilityIds = strict
    ? ["maxima-cas", "sage-cas", "lean-proof-checker", "z3-smt-solver", "cvc5-smt-solver"]
    : ["maxima-cas", "lean-proof-checker", "z3-smt-solver", "cvc5-smt-solver"];

  return {
    status: "available",
    runId: selected.runId,
    path: selected.path,
    requiredPassed: selected.requiredPassed,
    requiredTotal: selected.requiredTotal,
    coveredCapabilityIds,
    summary: `Saved ${strict ? "strict all-engine" : "professor"} Docker reviewer run ${selected.runId} passed ${selected.requiredPassed}/${selected.requiredTotal} required gates.`,
    trustBoundary: "Saved reviewer evidence can guide routing and reviewer fallback commands, but each new claim still needs its own concrete receipt, proof-check, SMT, CAS, source, or validation artifact."
  };
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

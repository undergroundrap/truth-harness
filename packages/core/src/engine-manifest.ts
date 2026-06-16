import { getCasBackendStatus, type CasBackendStatusOptions } from "./cas-backend.js";
import { getCodeRunSandboxStatus, type CodeRunSandboxStatus } from "./sandbox.js";
import { getProofBackendStatus, type ProofBackendStatusOptions } from "./proof-backend.js";
import { getSmtBackendStatus, type SmtBackendStatusOptions } from "./smt-backend.js";
import type { TrustLabel } from "./types.js";

export type EngineCapabilityKind = "native-kernel" | "adapter" | "workspace-service" | "safety-boundary" | "planned-adapter";
export type EngineCapabilityStatus = "ready" | "available" | "missing" | "error" | "planned";
export type EngineDeterminismClass =
  | "strict-deterministic"
  | "replay-deterministic"
  | "environment-measured"
  | "provenance-only"
  | "planned";
export type EnginePrimitiveSemantics =
  | "exact-rational"
  | "bounded-integer-search"
  | "modular-integer"
  | "dimension-vector"
  | "rational-interval"
  | "symbolic-expression"
  | "formal-proof"
  | "smt-lib"
  | "local-source-index"
  | "workspace-artifact"
  | "privacy-disclosure"
  | "sandbox-measurement"
  | "rigorous-numeric"
  | "simulation-provenance"
  | "not-implemented";

export interface EngineDeterminismProfile {
  determinismClass: EngineDeterminismClass;
  deterministic: boolean;
  replayable: boolean;
  primitiveSemantics: EnginePrimitiveSemantics;
  aiParserFriendly: true;
  replayRequirements: string[];
  driftRisks: string[];
}

export interface EngineCapability {
  id: string;
  displayName: string;
  kind: EngineCapabilityKind;
  lane: string;
  status: EngineCapabilityStatus;
  role: string;
  command?: string;
  executable?: string;
  version?: string;
  localOnly: boolean;
  networkAccess: "none" | "optional" | "required" | "unknown";
  strongestTrust: TrustLabel | "provenance-only" | "validation-plan" | "none";
  canMintTrust: boolean;
  statusProbeMintedEvidence: false;
  trustBoundary: string;
  limitations: string[];
  determinism: EngineDeterminismProfile;
  nextStep?: string;
}

type RawEngineCapability = Omit<EngineCapability, "determinism">;

export interface EngineManifestOptions {
  timeoutMs?: number;
  maximaCommand?: string;
  sageCommand?: string;
  leanCommand?: string;
  z3Command?: string;
  now?: Date;
}

export interface EngineManifest {
  schemaVersion: "truth-harness.engine-manifest.v0";
  createdAt: string;
  localOnly: true;
  networkAccess: "none";
  status: "ready" | "partial" | "missing";
  readyCount: number;
  totalCount: number;
  nativeCount: number;
  adapterCount: number;
  plannedCount: number;
  deterministicCount: number;
  replayDeterministicCount: number;
  capabilities: EngineCapability[];
  machineContract: {
    jsonFirst: true;
    diagnosticsAreStructured: true;
    stableCapabilityIds: true;
    replayCommandsRequiredForEvidence: true;
    deterministicTrustRequiresReplayableArtifact: true;
    primitivesRemainComposable: true;
  };
  trustBoundary: {
    aiOutputIsNotEvidence: true;
    statusProbeIsNotEvidence: true;
    claimTrustRequiresResolvableEvidence: true;
    provedRequiresAcceptedProofCheckerRun: true;
    smtCheckedRequiresConcreteSolverRun: true;
    crossCheckedRequiresIndependentAgreementRun: true;
  };
  warnings: string[];
}

export function getEngineManifest(options: EngineManifestOptions = {}): EngineManifest {
  const createdAt = (options.now ?? new Date()).toISOString();
  const timeoutMs = options.timeoutMs ?? 1500;
  const cas = getCasBackendStatus({
    timeoutMs,
    maximaCommand: options.maximaCommand,
    sageCommand: options.sageCommand,
    now: options.now
  } satisfies CasBackendStatusOptions);
  const proof = getProofBackendStatus({
    timeoutMs,
    leanCommand: options.leanCommand,
    now: options.now
  } satisfies ProofBackendStatusOptions);
  const smt = getSmtBackendStatus({
    timeoutMs,
    z3Command: options.z3Command,
    now: options.now
  } satisfies SmtBackendStatusOptions);
  const sandbox = getCodeRunSandboxStatus();
  const capabilities = [
    ...nativeCapabilities(),
    ...workspaceCapabilities(),
    codeRunSandboxCapability(sandbox),
    maximaCapability(cas.backends.find((backend) => backend.backendId === "maxima")),
    sageCapability(cas.backends.find((backend) => backend.backendId === "sage")),
    proofCapability(proof.backends[0]),
    smtCapability(smt.backends[0]),
    ...plannedCapabilities()
  ].map(withDeterminism);
  const countedCapabilities = capabilities.filter((capability) => capability.kind !== "planned-adapter");
  const readyCount = countedCapabilities.filter((capability) => capability.status === "ready" || capability.status === "available").length;
  const totalCount = countedCapabilities.length;

  return {
    schemaVersion: "truth-harness.engine-manifest.v0",
    createdAt,
    localOnly: true,
    networkAccess: "none",
    status: readyCount === totalCount ? "ready" : readyCount > 0 ? "partial" : "missing",
    readyCount,
    totalCount,
    nativeCount: capabilities.filter((capability) => capability.kind === "native-kernel").length,
    adapterCount: capabilities.filter((capability) => capability.kind === "adapter").length,
    plannedCount: capabilities.filter((capability) => capability.kind === "planned-adapter").length,
    deterministicCount: capabilities.filter((capability) => capability.determinism.determinismClass === "strict-deterministic").length,
    replayDeterministicCount: capabilities.filter((capability) => capability.determinism.determinismClass === "replay-deterministic").length,
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
    warnings: [
      ...cas.warnings,
      ...proof.warnings,
      ...smt.warnings,
      ...sandbox.notes.filter((note) => !sandbox.available).slice(0, 2)
    ]
  };
}

function nativeCapabilities(): RawEngineCapability[] {
  return [
    {
      id: "local-rational-arithmetic",
      displayName: "Exact rational arithmetic",
      kind: "native-kernel",
      lane: "math",
      status: "ready",
      role: "arithmetic",
      command: "truth-harness ask \"compute 3 / 4 + 5 / 8\" --json",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "exact-computed",
      canMintTrust: true,
      statusProbeMintedEvidence: false,
      trustBoundary: "Can support exact-computed only for parsed exact arithmetic expressions.",
      limitations: ["Covers the supported expression grammar, not arbitrary surrounding claims."]
    },
    {
      id: "finite-counterexample-search",
      displayName: "Finite counterexample search",
      kind: "native-kernel",
      lane: "math",
      status: "ready",
      role: "refutation",
      command: "truth-harness ask \"for all integers n, n^2+n+1 is even\" --json",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "refuted",
      canMintTrust: true,
      statusProbeMintedEvidence: false,
      trustBoundary: "Can refute universal claims when a concrete exact counterexample is found.",
      limitations: ["No counterexample inside a finite search window is not proof of a universal claim."]
    },
    {
      id: "local-mod2-parity-kernel",
      displayName: "Mod-2 parity kernel",
      kind: "native-kernel",
      lane: "math",
      status: "ready",
      role: "checker",
      command: "truth-harness ask \"for all integers n, n^2+n is even\" --json",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "exact-computed",
      canMintTrust: true,
      statusProbeMintedEvidence: false,
      trustBoundary: "Emits exact-computed for a narrow modular certificate; never emits proved.",
      limitations: ["Restricted to supported integer polynomial parity claims."]
    },
    {
      id: "local-dimensional-analysis",
      displayName: "Dimensional analysis",
      kind: "native-kernel",
      lane: "physics",
      status: "ready",
      role: "units",
      command: "truth-harness ask \"dimension check force = mass * acceleration\" --json",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "dimension-checked",
      canMintTrust: true,
      statusProbeMintedEvidence: false,
      trustBoundary: "Checks dimensional consistency only; does not prove a physical model is true.",
      limitations: ["Covers known unit/dimension symbols and algebraic combinations."]
    },
    {
      id: "rational-interval-bounds",
      displayName: "Rational interval bounds",
      kind: "native-kernel",
      lane: "math",
      status: "ready",
      role: "numeric-bound",
      command: "truth-harness ask \"bound x^2 + 2*x + 1 for x in [0, 2]\" --json",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "bounded-numeric",
      canMintTrust: true,
      statusProbeMintedEvidence: false,
      trustBoundary: "Produces conservative interval bounds for supported expressions and ranges.",
      limitations: ["Dependency loss can make bounds wider than the true range."]
    },
    {
      id: "sympy-symbolic-adapter",
      displayName: "SymPy symbolic adapter",
      kind: "adapter",
      lane: "math",
      status: "available",
      role: "cas",
      command: "truth-harness ask \"symbolic simplify sin(x)^2 + cos(x)^2\" --json",
      executable: "python",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "exact-computed",
      canMintTrust: true,
      statusProbeMintedEvidence: false,
      trustBoundary: "Can support exact-computed for a concrete local SymPy run with recorded checks; independent CAS agreement is required for cross-checked.",
      limitations: ["SymPy output is CAS evidence, not accepted proof-checker output."]
    },
    {
      id: "local-corpus-lexical-search",
      displayName: "Local corpus search",
      kind: "native-kernel",
      lane: "sources",
      status: "ready",
      role: "retrieval",
      command: "truth-harness source ingest docs && truth-harness source search \"verified math agents\"",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "source-cited",
      canMintTrust: true,
      statusProbeMintedEvidence: false,
      trustBoundary: "Can support source-cited receipts when local chunks are retrieved; retrieval is not proof of entailment.",
      limitations: ["Lexical search is local and simple; citation entailment still needs review."]
    }
  ];
}

function workspaceCapabilities(): RawEngineCapability[] {
  return [
    {
      id: "claim-ledger",
      displayName: "Claim ledger",
      kind: "workspace-service",
      lane: "all",
      status: "ready",
      role: "evidence-ledger",
      command: "truth-harness claim add ... --evidence receipt:.truth-harness/receipts/run.json",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "none",
      canMintTrust: false,
      statusProbeMintedEvidence: false,
      trustBoundary: "Records claim trust only from resolvable local evidence; requested labels cannot finalize claims.",
      limitations: ["A claim record is provenance and review state, not proof by itself."]
    },
    {
      id: "workspace-validation",
      displayName: "Workspace validation",
      kind: "workspace-service",
      lane: "all",
      status: "ready",
      role: "schema-and-boundary-checker",
      command: "truth-harness workspace validate",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "none",
      canMintTrust: false,
      statusProbeMintedEvidence: false,
      trustBoundary: "Checks artifact shape, references, and trust-boundary policy before agents rely on a workspace.",
      limitations: ["Validation proves artifact consistency, not mathematical or scientific truth."]
    },
    {
      id: "model-context-disclosure",
      displayName: "Model-context disclosure",
      kind: "workspace-service",
      lane: "all",
      status: "ready",
      role: "privacy-audit",
      command: "truth-harness model-context prepare ... && truth-harness disclosure log ...",
      localOnly: true,
      networkAccess: "none",
      strongestTrust: "provenance-only",
      canMintTrust: false,
      statusProbeMintedEvidence: false,
      trustBoundary: "Prepares and records selected context before hosted model collaboration; it does not call external services.",
      limitations: ["Disclosure records audit what was shared; they do not verify the model response."]
    }
  ];
}

function codeRunSandboxCapability(status: CodeRunSandboxStatus): RawEngineCapability {
  return {
    id: "code-run-sandbox",
    displayName: "Code-run sandbox boundary",
    kind: "safety-boundary",
    lane: "code",
    status: status.canAttestNetworkNone ? "available" : "missing",
    role: "sandbox-measurement",
    command: "truth-harness code sandbox-status --json",
    localOnly: true,
    networkAccess: status.canAttestNetworkNone ? "none" : "unknown",
    strongestTrust: "provenance-only",
    canMintTrust: false,
    statusProbeMintedEvidence: false,
    trustBoundary: "Attests whether code-run records may honestly claim networkAccess none; it does not prove code correctness.",
    limitations: [status.reason, ...status.notes].filter(Boolean),
    nextStep: status.canAttestNetworkNone ? "Use --require-sandbox for agent-triggered code runs." : "Run code workflows inside the Docker no-network service before claiming networkAccess none."
  };
}

function maximaCapability(probe: ReturnType<typeof getCasBackendStatus>["backends"][number] | undefined): RawEngineCapability {
  return {
    id: "maxima-cas",
    displayName: "Maxima independent CAS",
    kind: "adapter",
    lane: "math",
    status: adapterStatus(probe?.status),
    role: "independent-cas",
    command: "truth-harness cas backends",
    executable: probe?.command,
    version: probe?.version,
    localOnly: true,
    networkAccess: "none",
    strongestTrust: "cross-checked",
    canMintTrust: probe?.status === "available",
    statusProbeMintedEvidence: false,
    trustBoundary: "Can support cross-checked only after a concrete independent Maxima agreement run.",
    limitations: probe?.limitations ?? ["Maxima has not been probed."],
    nextStep: probe?.status === "available" ? "Run a concrete symbolic agreement check." : "Install/configure Maxima or use Docker-derived CAS image when ready."
  };
}

function sageCapability(probe: ReturnType<typeof getCasBackendStatus>["backends"][number] | undefined): RawEngineCapability {
  return {
    id: "sage-cas",
    displayName: "SageMath CAS breadth adapter",
    kind: "adapter",
    lane: "math",
    status: adapterStatus(probe?.status),
    role: "cas-breadth",
    command: "truth-harness cas backends",
    executable: probe?.command,
    version: probe?.version,
    localOnly: true,
    networkAccess: "none",
    strongestTrust: "cross-checked",
    canMintTrust: probe?.status === "available",
    statusProbeMintedEvidence: false,
    trustBoundary: "Can support cross-checked only after a concrete generated constrained SageMath equality check record; it never mints proved.",
    limitations: probe?.limitations ?? ["SageMath has not been probed."],
    nextStep:
      probe?.status === "available"
        ? "Run `truth-harness cas check --backend sage` for a scoped symbolic equality, or `truth-harness engines verify --require-sage` for the reviewer gate."
        : "Install/configure SageMath or use a pinned Docker image before enabling Sage-backed checks."
  };
}

function proofCapability(probe: ReturnType<typeof getProofBackendStatus>["backends"][number] | undefined): RawEngineCapability {
  return {
    id: "lean-proof-checker",
    displayName: "Lean proof checker",
    kind: "adapter",
    lane: "math",
    status: adapterStatus(probe?.status),
    role: "proof-checker",
    command: "truth-harness proof check <workspace-local.lean> --write",
    executable: probe?.command,
    version: probe?.version,
    localOnly: true,
    networkAccess: "none",
    strongestTrust: "proved",
    canMintTrust: probe?.status === "available",
    statusProbeMintedEvidence: false,
    trustBoundary: "Can support proved only after Lean accepts a concrete local proof artifact.",
    limitations: probe?.limitations ?? ["Lean has not been probed."],
    nextStep:
      probe?.status === "available"
        ? "Check a concrete Lean proof artifact scoped to the route obligation it is meant to close."
        : "Install/configure Lean and a pinned proof project."
  };
}

function smtCapability(probe: ReturnType<typeof getSmtBackendStatus>["backends"][number] | undefined): RawEngineCapability {
  return {
    id: "z3-smt-solver",
    displayName: "Z3 SMT solver",
    kind: "adapter",
    lane: "math",
    status: adapterStatus(probe?.status),
    role: "smt-solver",
    command: "truth-harness smt check docs/examples/constraints.smt2 --write",
    executable: probe?.command,
    version: probe?.version,
    localOnly: true,
    networkAccess: "none",
    strongestTrust: "smt-checked",
    canMintTrust: probe?.status === "available",
    statusProbeMintedEvidence: false,
    trustBoundary: "Can support smt-checked only after Z3 returns sat or unsat for a concrete SMT-LIB artifact.",
    limitations: probe?.limitations ?? ["Z3 has not been probed."],
    nextStep: probe?.status === "available" ? "Run a concrete SMT-LIB check." : "Use Docker or install/configure Z3."
  };
}

function plannedCapabilities(): RawEngineCapability[] {
  return [
    plannedCapability("cvc5-smt-solver", "cvc5 SMT solver", "math", "Second SMT solver for cross-solver confidence and regressions."),
    plannedCapability("lean-lsp-router", "Lean LSP proof workflow", "math", "Goals, diagnostics, formal library search, and interactive proof repair."),
    plannedCapability("local-vector-rag", "Local vector/PDF RAG", "sources", "Source ingestion, citation spans, contradiction checks, and reusable indexes."),
    plannedCapability("rigorous-numerics", "Rigorous numerics", "math", "Ball arithmetic, precision budgets, and reproducible error bounds."),
    plannedCapability("domain-simulation-adapters", "Domain simulation adapters", "physics/bio/engineering", "Simulation provenance with assumptions, parameters, uncertainty, and validation gates.")
  ];
}

function plannedCapability(id: string, displayName: string, lane: string, nextStep: string): RawEngineCapability {
  return {
    id,
    displayName,
    kind: "planned-adapter",
    lane,
    status: "planned",
    role: "adapter",
    localOnly: true,
    networkAccess: "unknown",
    strongestTrust: "none",
    canMintTrust: false,
    statusProbeMintedEvidence: false,
    trustBoundary: "Planned adapters mint no trust until implemented, tested, and wired into receipts.",
    limitations: ["Not implemented in the current local runtime."],
    nextStep
  };
}

function adapterStatus(status: "available" | "missing" | "error" | undefined): EngineCapabilityStatus {
  if (status === "available") return "available";
  if (status === "error") return "error";
  return "missing";
}

function withDeterminism(capability: RawEngineCapability): EngineCapability {
  return {
    ...capability,
    determinism: determinismForCapability(capability)
  };
}

function determinismForCapability(capability: RawEngineCapability): EngineDeterminismProfile {
  if (capability.kind === "planned-adapter") {
    return determinismProfile({
      determinismClass: "planned",
      deterministic: false,
      replayable: false,
      primitiveSemantics: plannedPrimitiveSemantics(capability.id),
      replayRequirements: ["No replay contract exists until this adapter is implemented."],
      driftRisks: ["Planned capability; trust labels must not depend on it."]
    });
  }

  if (capability.kind === "native-kernel") {
    return determinismProfile({
      determinismClass: "strict-deterministic",
      deterministic: true,
      replayable: true,
      primitiveSemantics: nativePrimitiveSemantics(capability.id),
      replayRequirements: ["Use the recorded Truth Harness command and receipt JSON."],
      driftRisks: ["Parser or native-kernel implementation changes can intentionally change outputs across versions."]
    });
  }

  if (capability.kind === "adapter") {
    return determinismProfile({
      determinismClass: "replay-deterministic",
      deterministic: true,
      replayable: true,
      primitiveSemantics: adapterPrimitiveSemantics(capability.id),
      replayRequirements: [
        "Record the concrete command, input artifact, backend id, backend version when available, stdout/stderr or accepted output, and replay command.",
        "Treat backend availability probes as readiness only; require a concrete check artifact before trust changes."
      ],
      driftRisks: [
        "Backend version, library path, solver settings, timeout, platform, or translation adapter changes can alter results.",
        "Adapters cannot upgrade informal surrounding claims beyond the encoded or checked artifact."
      ]
    });
  }

  if (capability.kind === "safety-boundary") {
    return determinismProfile({
      determinismClass: "environment-measured",
      deterministic: false,
      replayable: true,
      primitiveSemantics: "sandbox-measurement",
      replayRequirements: ["Re-run the sandbox status command inside the same execution environment."],
      driftRisks: ["Host/container networking, process isolation, filesystem mounts, or runtime policy can change between runs."]
    });
  }

  return determinismProfile({
    determinismClass: "provenance-only",
    deterministic: true,
    replayable: true,
    primitiveSemantics: workspacePrimitiveSemantics(capability.id),
    replayRequirements: ["Read the recorded local workspace artifacts and validate their schemas before relying on them."],
    driftRisks: ["Workspace files can change; use snapshots and validation to detect drift."]
  });
}

function determinismProfile(input: Omit<EngineDeterminismProfile, "aiParserFriendly">): EngineDeterminismProfile {
  return {
    ...input,
    aiParserFriendly: true
  };
}

function nativePrimitiveSemantics(id: string): EnginePrimitiveSemantics {
  switch (id) {
    case "local-rational-arithmetic":
      return "exact-rational";
    case "finite-counterexample-search":
      return "bounded-integer-search";
    case "local-mod2-parity-kernel":
      return "modular-integer";
    case "local-dimensional-analysis":
      return "dimension-vector";
    case "rational-interval-bounds":
      return "rational-interval";
    case "sympy-symbolic-adapter":
      return "symbolic-expression";
    case "local-corpus-lexical-search":
      return "local-source-index";
    default:
      return "workspace-artifact";
  }
}

function adapterPrimitiveSemantics(id: string): EnginePrimitiveSemantics {
  switch (id) {
    case "lean-proof-checker":
      return "formal-proof";
    case "z3-smt-solver":
      return "smt-lib";
    case "maxima-cas":
    case "sage-cas":
      return "symbolic-expression";
    default:
      return "workspace-artifact";
  }
}

function workspacePrimitiveSemantics(id: string): EnginePrimitiveSemantics {
  switch (id) {
    case "model-context-disclosure":
      return "privacy-disclosure";
    default:
      return "workspace-artifact";
  }
}

function plannedPrimitiveSemantics(id: string): EnginePrimitiveSemantics {
  if (id.includes("smt")) return "smt-lib";
  if (id.includes("numerics")) return "rigorous-numeric";
  if (id.includes("simulation")) return "simulation-provenance";
  return "not-implemented";
}

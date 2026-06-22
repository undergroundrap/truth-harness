import { initLocalWorkspace } from "./local-workspace.js";
import { writeResearchHarness, type ResearchHarnessWriteResult } from "./research-session.js";
import { stableHash } from "./stable-hash.js";
import { createWorkspaceRunNextPlan, writeWorkspaceRunNextPlan, type WorkspaceRunNextWriteResult } from "./workspace-run-next.js";
import { createWorkspaceReview } from "./workspace-review.js";

export const HARD_MATH_SEED_SCHEMA_VERSION = "truth-harness.hard-math-seed.v0" as const;

export interface HardMathSeedCase {
  caseId: string;
  title: string;
  objective: string;
  validationClaim: string;
  hypotheses: string[];
  tasks: string[];
}

export const HARD_MATH_SEED_PRESETS = ["all", "professor-challenge"] as const;
export type HardMathSeedPreset = (typeof HARD_MATH_SEED_PRESETS)[number];

export interface HardMathSeedInput {
  rootPath: string;
  now?: string;
  caseIds?: string[];
  preset?: HardMathSeedPreset;
  writeRunNextPlan?: boolean;
}

export interface HardMathSeedResult {
  schemaVersion: typeof HARD_MATH_SEED_SCHEMA_VERSION;
  seedId: string;
  createdAt: string;
  preset: HardMathSeedPreset;
  localOnly: true;
  networkAccess: "none";
  workspacePath: string;
  cases: Array<{
    caseId: string;
    title: string;
    sessionId: string;
    validationPlanId?: string;
    validationReadiness?: string;
    openBlockingGates?: number;
  }>;
  runNext?: WorkspaceRunNextWriteResult | { plan: WorkspaceRunNextWriteResult["plan"] };
  warnings: string[];
}

export const HARD_MATH_SEED_CASES: HardMathSeedCase[] = [
  {
    caseId: "exact-fraction-lemma",
    title: "Exact fraction closure fixture",
    objective:
      "Verify the scoped arithmetic lemma 3 / 4 + 5 / 8 with exact rational arithmetic, record the replayable route evidence, and close the linked validation gate without upgrading it to a formal proof.",
    validationClaim: "3 / 4 + 5 / 8",
    hypotheses: [
      "A bounded local verifier route can compute the exact rational result 11/8.",
      "A validation gate can be closed by replayable exact-computed evidence while still preserving the stronger proof/CAS escalation boundary."
    ],
    tasks: [
      "Parse the expression as exact rational arithmetic rather than floating-point arithmetic.",
      "Run the smallest supported local verifier route and attach its receipt-backed route evidence to the validation gate.",
      "Keep the trust label at exact-computed unless an accepted proof checker or independent symbolic backend is attached."
    ]
  },
  {
    caseId: "false-parity-trap",
    title: "False universal parity trap",
    objective:
      "Refute the fluent-but-wrong universal claim that n^2 + n + 1 is even for every integer n, then record the counterexample as replayable evidence instead of letting an AI prose proof stand.",
    validationClaim: "For every integer n, n^2 + n + 1 is even.",
    hypotheses: [
      "A single exact integer counterexample is enough to refute the universal claim.",
      "A route that returns refuted evidence must block any attempt to file a proved or exact-computed positive claim."
    ],
    tasks: [
      "Preserve the universal quantifier and integer domain before checking.",
      "Run counterexample search or an SMT route that can expose a concrete violating integer.",
      "Attach the refutation evidence to the validation gate and mark the positive claim as refuted, not merely unverified."
    ]
  },
  {
    caseId: "symbolic-cas-closure-fixture",
    title: "Symbolic CAS closure fixture",
    objective:
      "Verify the machine-checkable symbolic prompt `symbolic simplify sin(x)^2 + cos(x)^2` with a replayable route, then preserve the stronger boundary that CAS agreement is not proof-checker-backed proof.",
    validationClaim: "symbolic simplify sin(x)^2 + cos(x)^2",
    hypotheses: [
      "A scoped symbolic prompt can produce exact-computed or cross-checked evidence without relying on natural-language interpretation.",
      "If Maxima is available, independent CAS agreement may strengthen the route to cross-checked while still not minting proved."
    ],
    tasks: [
      "Keep the validation claim as a machine prompt rather than an informal theorem statement.",
      "Run the local symbolic verifier route and attach its scoped route evidence to the validation gate.",
      "Escalate to Lean only if the workspace needs proof-checker-backed `proved` trust."
    ]
  },
  {
    caseId: "smt-bounded-closure-fixture",
    title: "Bounded SMT closure fixture",
    objective:
      "Verify the machine-checkable SMT query `bounded_integer_sat` by attaching a solver-backed SMT record with the exact query boundary, not by asking an AI to translate the surrounding prose.",
    validationClaim: "SMT query bounded_integer_sat",
    hypotheses: [
      "An SMT record with query name bounded_integer_sat can satisfy this narrow validation gate when the solver returns sat or unsat.",
      "The same SMT record must not satisfy a broader informal claim unless a matching route or formalization explains the translation."
    ],
    tasks: [
      "Generate the SMT-LIB source from explicit integer constraints x > 0 and x < 3.",
      "Run a local SMT solver and record the replayable check artifact with queryName bounded_integer_sat.",
      "Attach the SMT artifact to the validation gate only when the query boundary matches exactly."
    ]
  },
  {
    caseId: "symbolic-trig-identity",
    title: "Symbolic trigonometric identity verifier",
    objective:
      "Verify the scoped identity sin(x)^2 + cos(x)^2 = 1 over real x using replayable symbolic evidence, independent CAS cross-checks, and a formal-proof escalation path.",
    validationClaim: "For real x, sin(x)^2 + cos(x)^2 = 1.",
    hypotheses: [
      "A symbolic verifier route can produce replayable evidence for the trigonometric identity.",
      "A stronger public claim should remain blocked until independent CAS or formal proof evidence is attached."
    ],
    tasks: [
      "Classify the statement as a symbolic identity with an explicit real-domain scope.",
      "Create a verifier route that records SymPy output and blocked Maxima/Sage/Lean upgrades.",
      "Attach accepted independent CAS or formal proof evidence before calling the identity proved."
    ]
  },
  {
    caseId: "integer-parity-invariant",
    title: "Integer parity invariant verifier",
    objective:
      "Prove or refute the scoped invariant that n^2 + n is even for every integer n, while keeping computed checks separate from accepted formal proof evidence.",
    validationClaim: "For every integer n, n^2 + n is even.",
    hypotheses: [
      "Finite examples support the invariant but do not prove the universal claim.",
      "A Lean proof or accepted route evidence is required before the workspace may label the invariant proved."
    ],
    tasks: [
      "Record the quantifier and integer domain before running any checker.",
      "Run the smallest local verifier route and preserve any proof, SMT, or refutation boundary.",
      "Escalate to a formal proof artifact if the route cannot earn a proof-grade label."
    ]
  },
  {
    caseId: "bounded-integer-smt",
    title: "Bounded integer SMT verifier",
    objective:
      "Solve the integer constraint system x > 0 and x < 3 with a replayable SMT/CAS route, then record the exact model boundary before using it downstream.",
    validationClaim: "The integer constraints x > 0 and x < 3 have exactly the solutions x = 1 and x = 2.",
    hypotheses: [
      "A solver-backed route should expose the model or bounded solution set without widening the claim.",
      "Any final statement must cite the solver/backend boundary and replay command."
    ],
    tasks: [
      "Encode the integer constraints as a scoped solver problem.",
      "Attach an SMT solver artifact or route evidence that records the exact bounds and backend.",
      "Keep the claim blocked if the solver is unavailable or the encoding is not replayable."
    ]
  },
  {
    caseId: "lean-trivial-proof-boundary",
    title: "Lean proof boundary fixture",
    objective:
      "Demonstrate that the workbench only earns `proved` from an accepted Lean proof artifact by routing a tiny theorem through the formal-proof gate and refusing proof-grade trust from prose or CAS output.",
    validationClaim: "The Lean fixture theorem `smoke : True` is accepted by the configured proof checker.",
    hypotheses: [
      "A proof gate is satisfied only by an accepted proof-check record scoped to the exact theorem artifact.",
      "If Lean is unavailable, the correct output is an open proof obligation with a reproducible Docker command, not a downgraded fake proof."
    ],
    tasks: [
      "Use the pinned Lean fixture project or Docker proof-repair gate as the source of formal evidence.",
      "Attach only accepted proof-check evidence to the validation plan proof gate.",
      "Keep `proved` unavailable when Lean is missing, rejected, or replaced by natural-language explanation."
    ]
  }
];

export const PROFESSOR_CHALLENGE_CASE_IDS = [
  "false-parity-trap",
  "exact-fraction-lemma",
  "symbolic-cas-closure-fixture",
  "smt-bounded-closure-fixture",
  "lean-trivial-proof-boundary"
] as const;

const DEFAULT_SEED_CREATED_AT = "2026-06-20T12:00:00.000Z";

export async function writeHardMathSeedWorkspace(input: HardMathSeedInput): Promise<HardMathSeedResult> {
  const createdAt = input.now ?? DEFAULT_SEED_CREATED_AT;
  const workspace = await initLocalWorkspace(input.rootPath, {
    displayName: "Truth Harness",
    now: createdAt
  });
  const preset = normalizeHardMathSeedPreset(input.preset);
  const selectedCases = selectSeedCases(input.caseIds, preset);
  const harnesses: Array<{ seedCase: HardMathSeedCase; result: ResearchHarnessWriteResult }> = [];

  for (const [index, seedCase] of selectedCases.entries()) {
    const result = await writeResearchHarness({
      rootPath: workspace.root,
      title: seedCase.title,
      objective: seedCase.objective,
      domains: ["math"],
      hypotheses: seedCase.hypotheses,
      claims: [seedCase.validationClaim],
      tasks: seedCase.tasks,
      createValidationPlan: true,
      validationTitle: `${seedCase.title} validation gates`,
      validationClaim: seedCase.validationClaim,
      now: timestampOffset(createdAt, index + 1)
    });
    harnesses.push({ seedCase, result });
  }

  const review = await createWorkspaceReview({
    rootPath: workspace.root,
    now: timestampOffset(createdAt, selectedCases.length + 1)
  });
  const plan = await createWorkspaceRunNextPlan({
    rootPath: workspace.root,
    review,
    executeLocal: false,
    now: timestampOffset(createdAt, selectedCases.length + 2)
  });
  const runNext = input.writeRunNextPlan === false
    ? { plan }
    : await writeWorkspaceRunNextPlan({
        rootPath: workspace.root,
        plan
      });

  return {
    schemaVersion: HARD_MATH_SEED_SCHEMA_VERSION,
    seedId: `hmseed_${stableHash({ createdAt, preset, caseIds: selectedCases.map((seedCase) => seedCase.caseId), workspace: workspace.manifest.projectId }).slice(0, 16)}`,
    createdAt,
    preset,
    localOnly: true,
    networkAccess: "none",
    workspacePath: workspace.root,
    cases: harnesses.map(({ seedCase, result }) => ({
      caseId: seedCase.caseId,
      title: seedCase.title,
      sessionId: result.session.sessionId,
      validationPlanId: result.validationPlan?.plan.planId,
      validationReadiness: result.validationPlan?.plan.readiness.status,
      openBlockingGates: result.validationPlan?.plan.readiness.blockingGateCount
    })),
    runNext,
    warnings: [
      "Hard-math seeds create validation queues; they do not prove any seeded claim.",
      ...(preset === "professor-challenge"
        ? [
            "Professor challenge seeds are a credibility workout: false claims, exact computation, CAS, SMT, and Lean boundaries must each earn their evidence."
          ]
        : []),
      "The saved run-next handoff is dry-run intent. Use workspace pilot-loop or run-next execution gates explicitly.",
      "Re-running the seed refreshes deterministic local artifacts instead of minting stronger trust labels."
    ]
  };
}

function selectSeedCases(caseIds: string[] | undefined, preset: HardMathSeedPreset): HardMathSeedCase[] {
  const requested = new Set((caseIds ?? []).map((caseId) => caseId.trim()).filter(Boolean));
  if (requested.size === 0) {
    if (preset === "professor-challenge") {
      const challengeIds = new Set<string>(PROFESSOR_CHALLENGE_CASE_IDS);
      return HARD_MATH_SEED_CASES.filter((seedCase) => challengeIds.has(seedCase.caseId));
    }
    return HARD_MATH_SEED_CASES;
  }

  const selected = HARD_MATH_SEED_CASES.filter((seedCase) => requested.has(seedCase.caseId));
  const missing = [...requested].filter((caseId) => !HARD_MATH_SEED_CASES.some((seedCase) => seedCase.caseId === caseId));
  if (missing.length > 0) {
    throw new Error(`Unknown hard-math seed case(s): ${missing.join(", ")}`);
  }
  return selected;
}

function normalizeHardMathSeedPreset(value: HardMathSeedPreset | undefined): HardMathSeedPreset {
  return HARD_MATH_SEED_PRESETS.includes(value ?? "all") ? value ?? "all" : "all";
}

function timestampOffset(createdAt: string, seconds: number): string {
  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) {
    return createdAt;
  }
  return new Date(base.getTime() + seconds * 1000).toISOString();
}

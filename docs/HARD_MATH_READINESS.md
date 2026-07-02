# Hard Math Readiness

Truth Harness should earn mathematician trust by moving through explicit gates, not by claiming frontier capability early.

## Current Position

The project is currently credible as a local verification harness for narrow, replayable claims:

- exact rational arithmetic and equality checks
- concrete counterexamples for supported universal parity claims
- dimensional sanity checks
- conservative interval bounds
- Docker-provisioned Maxima/Z3/cvc5 engine smoke checks
- Lean/Sage reviewer paths behind heavier Docker gates
- claim ledgers, validation plans, run-next packets, and replayable receipts
- Docker hard-math closure reports for seeded exact, symbolic CAS, and SMT blockers
- a native-safe professor math challenge covering exact algebra slips, finite integer claims, units, intervals, and honest refusals
- a frontier-honesty challenge that refuses famous open/theorem-scale prompts unless concrete local proof evidence exists

It is not yet an autonomous solver for open problems, a replacement for Lean/mathlib, a replacement for SageMath, or a proof-search system that can be trusted on frontier claims without human experts.

Run the release audit when you need the current honest answer in JSON:

```bash
npm run audit:release
npm run audit:release:gate
```

The release audit includes a `frontierReadiness` object. The strongest current positions are:

- `credible-verification-harness`: the local evidence floor is present for narrow supported claims.
- `bounded-hard-math-harness`: the professor/reviewer evidence floor, engine evidence, and saved hard-math closure reports are present for scoped blockers.

Even at the stronger stage, `frontierDiscoveryReadiness` remains `not-ready` and `canClaimWorldHardestProblems` remains `false`. That is intentional. A serious researcher should see the harness as the evidence layer that makes hard-problem work safer to resume, replay, criticize, and extend, not as proof that an autonomous agent can solve frontier problems today.

## New Ladder

Run the native-safe ladder:

```bash
npm run demo:math-ladder
```

Run it through Docker:

```bash
npm run docker:math-ladder
```

Save it as reviewer evidence before running a credibility pack or release audit:

```bash
truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures
```

The suite lives at:

```text
packages/benchmarks/suites/math-credibility-ladder.json
```

The ladder checks that Truth Harness can:

- pass a 30-case native-safe hard-math floor
- report named capability levels so humans and agents can see which layer passed instead of relying on one aggregate score
- verify exact arithmetic equalities, including powers and signed rational arithmetic
- refute false exact arithmetic equalities with exact left/right traces
- check common-denominator lemmas, including signed rewrites, without calling them formal proofs
- distinguish narrow universal parity certificates from proof-checker-backed theorems
- catch dimensional mistakes, including powered unit expressions
- return conservative interval bounds, including reciprocal and interior-minimum cases
- refuse theorem-level or unsupported-parser prompts outside the current checker boundary

Passing this ladder does not prove Truth Harness can solve hard math. A saved passing `truth-harness.benchmark-run.v0` record proves the current workspace has replayable regression evidence for the foundations that hard-math workflows will depend on.

## Professor Math Challenge

Run the compact reviewer exam when you want a professor-facing native-safe check that is harder than the basic ladder but still avoids optional external engines:

```bash
npm run demo:professor-math
npm run docker:professor-math
```

The suite lives at:

```text
packages/benchmarks/suites/professor-math-challenge.json
```

It currently passes 26 cases across exact algebra arithmetic, finite discrete claims, units and bounds, and honest frontier boundaries. It is designed to catch plausible algebra slips, missing counterexamples, dimensional overclaims, interval singularities, and theorem-level prompts that must stay `unverified`. Passing it is evidence of disciplined trust labeling, not evidence of autonomous frontier discovery.

Run the closure smokes when you need evidence that an autonomous hard-math blocker can be routed to the right verifier stack and saved as a reviewer artifact:

```bash
npm run docker:hard-math-closure
npm run docker:symbolic-closure
npm run docker:smt-closure
```

These commands write `truth-harness.hard-math-closure.v0` reports under `.truth-harness/findings/`. They are deliberately narrower than a general solver: exact closure must earn `exact-computed`, symbolic closure must earn `cross-checked`, and SMT closure must earn `smt-checked` for their seeded fixtures. A passing closure report proves the harness closed that scoped validation gate; it does not prove unrelated math claims.

## Public Problem Probes

Use public probes when you want to test Truth Harness against recognizable external problems before claiming broader math capability:

```bash
npm run demo:public-probes
npm run docker:public-probes
truth-harness bench run packages/benchmarks/suites/public-problem-probes.json --write --fail-on-failures
```

The suite now starts a dated public-problem ladder from Project Euler 1, 2, and 6. Truth Harness earns `exact-computed` only by writing narrow certificates: inclusion-exclusion for finite multiple sums, exact recurrence for bounded even Fibonacci sums, and exact closed-form arithmetic for finite sum-square differences. Each problem also includes a near-miss stated answer that must be `refuted`, not accepted from memory.

The progress ledger lives in [PUBLIC_MATH_PROBLEM_CATALOG.md](PUBLIC_MATH_PROBLEM_CATALOG.md), with machine-readable metadata at `packages/benchmarks/catalog/public-math-problem-catalog.json`. This is the pattern for growth: import a public bounded problem, record its source and date, see whether the harness can produce a receipt, and if it cannot, add a narrow verifier adapter or honestly mark the gap.

Passing this suite does not show competition-math breadth. It shows the harness can convert a small set of externally recognizable prompts into replayable local arithmetic evidence instead of answer-memory.

## Frontier Honesty Challenge

Run this suite when you want a reviewer-facing check that Truth Harness refuses to fake solutions to famous hard problems while still handling nearby supported claims:

```bash
npm run demo:frontier-honesty
npm run docker:frontier-honesty
truth-harness bench run packages/benchmarks/suites/frontier-honesty-challenge.json --write --fail-on-failures
```

The suite lives at:

```text
packages/benchmarks/suites/frontier-honesty-challenge.json
```

It currently covers famous open or theorem-scale prompts such as Riemann, P vs NP, Collatz, Goldbach, twin primes, Navier-Stokes, Birch and Swinnerton-Dyer, Hodge, Fermat Last Theorem, and infinitude of primes. Those prompts must stay `unverified` until a concrete accepted proof artifact exists. The same suite also includes nearby exact, parity, interval, and dimensional checks so the harness still has to verify and refute claims it actually supports.

Every famous open-problem or known-theorem refusal in this suite now carries a reviewer contract: `reviewStatus`, `requiredEvidence`, and `checkerBoundary` describe the accepted proof artifact, formalization review, regression evidence, and external review required before anyone treats the prompt as credible discovery work.

The release audit exposes these contracts at `frontierReadiness.benchmarkReviewContracts`, including separate counts for agent pre-review rehearsals and external-review requests. In compact JSON, `npm run audit:release -- --summary-json` gives agents the same `firstRecommendedAction`, so a resumed hard-problem workspace starts by preparing a bounded local model-context review packet before asking a qualified human reviewer to evaluate the benchmark contract.

Passing this suite does not prove frontier capability. It proves an important precondition for frontier work: the local evidence layer can resist glamorous overclaims.

## Professor Challenge Preset

Use the professor challenge when a human reviewer or autonomous agent needs a compact hard-math workout before trusting the workspace loop:

```bash
truth-harness workspace seed-professor-challenge .
truth-harness workspace seed-hard-math . --preset professor-challenge
truth-harness workspace hard-math-seeds . --preset professor-challenge --latest
truth-harness workspace hard-math-seeds . --preset professor-challenge --latest --handoff
```

The preset writes five local research sessions and linked validation plans:

- a false parity trap that should be refuted with a counterexample
- an exact fraction lemma that should close through exact arithmetic
- a symbolic identity that needs independent CAS evidence
- a bounded integer constraint that needs SMT evidence
- a Lean fixture boundary that reinforces that `proved` requires an accepted proof checker

This preset is not a benchmark score and does not prove that Truth Harness can solve frontier math. It is a reusable professor/reviewer rehearsal: agents should reopen the latest persisted seed packet before reseeding, print the `--handoff` packet or call MCP `truth_harness_workspace_hard_math_seed_list` with `handoff: true` when handing work to another agent or reviewer, then run `workspace run-next` on the seeded workspace and close the highest-value open gate with concrete local evidence before making stronger claims.

## Readiness Stages

1. **Foundational correctness:** native-safe receipt ladder passes with exact/refuted/unverified labels where expected.
2. **Docker core engines:** Maxima, Z3, and cvc5 earn concrete no-network evidence with `npm run docker:engines`.
3. **Strict all-engine reviewer path:** Lean and SageMath also earn scoped fixture evidence with `npm run docker:all-engines`.
4. **Hard-math closure:** exact, symbolic CAS, and SMT seeded blockers produce saved Docker closure reports.
5. **Formal proof workflows:** theorem statements become Lean/mathlib projects, and `proved` is reserved for accepted proof-check records.
6. **Research harness loops:** agents resume from validation-plan gates and attack the highest-value blocker instead of inventing generic progress.
7. **Human review:** professor/reviewer bundles cite receipts, proof records, SMT/CAS evidence, closure reports, limitations, and replay commands.

## Current Named Levels

Saved benchmark-run records now preserve these levels in JSON and Markdown:

- `level-1-exact-arithmetic`: exact rational arithmetic, power precedence, signed fractions, and common-denominator rewrites.
- `level-2-universal-refutation`: narrow parity certificates and counterexample search without calling them formal proofs.
- `level-3-physics-units`: dimensional-analysis checks and unit-mismatch refutations.
- `level-4-bounded-numerics`: conservative interval bounds and singularity boundaries.
- `level-5-honest-boundaries`: unsupported theorem, calculus, number-theory, and frontier prompts that must stay unverified.
- `level-6-professor-exact-algebra`: exact algebra arithmetic and refutations for nested rationals, exponent precedence, signed rewrites, and lcm claims.
- `level-7-professor-finite-discrete`: finite integer solution sets, parity certificates/refutations, and supported-pattern boundaries.
- `level-8-professor-units-bounds`: dimensional consistency, unit mistakes, conservative interval bounds, and singularity refusals.
- `level-9-professor-honest-boundaries`: theorem/frontier prompts that must remain unsupported until stronger engines or human proof work exist.
- `level-10-frontier-refusal`: famous open/millennium-style prompts that must remain unsupported without accepted proof evidence.
- `level-11-known-theorem-refusal`: known theorem prompts that still require a local proof artifact before the harness can say `proved`.
- `level-12-nearby-bounded-truth`: nearby supported exact, parity, interval, and dimensional claims that must still earn concrete evidence.

These levels are not a public math-achievement ladder yet. They are the current native-safe regression floor that future Lean, SageMath, SMT, and proof-search levels should extend.

## Engine-Backed Levels

`truth-harness engines verify` now reports a second ladder for concrete external-engine evidence:

- `engine-level-1-core-cas-smt`: Maxima earns a constrained symbolic `cross-checked` result and Z3 earns a concrete `smt-checked` result.
- `engine-level-2-smt-diversity`: cvc5 independently earns a concrete `smt-checked` result in addition to the core CAS/SMT gate.
- `engine-level-3-formal-proof-fixture`: Lean accepts the pinned proof fixture in addition to the core CAS/SMT gate.
- `engine-level-4-sage-breadth`: SageMath earns a constrained symbolic `cross-checked` result in addition to the core CAS/SMT gate.
- `engine-level-5-strict-all-engines`: Maxima, Z3, cvc5, Lean, and SageMath all mint concrete scoped evidence.

These levels are stricter than readiness probes. A level passes only when the relevant case records mint evidence; merely finding an executable is not enough. Saved engine-run summaries now record the strongest passed engine level, and credibility packs plus release audits cite that level when durable Docker evidence covers missing host probes.

Run the practical Docker core gate:

```bash
npm run docker:engines
```

Run the heavier strict all-engine gate when Docker storage/time is acceptable:

```bash
npm run docker:all-engines
```

## Next Serious Math Work

- Extend the named ladder with high-school algebra, olympiad-style refutations, undergraduate algebra/analysis, SMT encodings, Lean fixtures, and SageMath checks.
- Add a Lean/mathlib template that turns an informal theorem statement into a formalization workspace with explicit unresolved holes.
- Add SageMath fixtures that produce constrained records for algebra, number theory, combinatorics, and exact linear algebra without exposing arbitrary Sage execution.
- Add false-claim corpora where AI models are likely to overclaim, then require Truth Harness to refute, verify, or honestly decline.
- Add regression budgets for proof/search loops: wall-clock time, number of generated artifacts, replay success, and trust-label accuracy.

The moat is not instant genius. The moat is that every step toward genius leaves a local, replayable, inspectable trail.

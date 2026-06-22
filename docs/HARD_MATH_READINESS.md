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
- verify exact arithmetic equalities, including powers and signed rational arithmetic
- refute false exact arithmetic equalities with exact left/right traces
- check common-denominator lemmas, including signed rewrites, without calling them formal proofs
- distinguish narrow universal parity certificates from proof-checker-backed theorems
- catch dimensional mistakes, including powered unit expressions
- return conservative interval bounds, including reciprocal and interior-minimum cases
- refuse theorem-level or unsupported-parser prompts outside the current checker boundary

Passing this ladder does not prove Truth Harness can solve hard math. A saved passing `truth-harness.benchmark-run.v0` record proves the current workspace has replayable regression evidence for the foundations that hard-math workflows will depend on.

Run the closure smokes when you need evidence that an autonomous hard-math blocker can be routed to the right verifier stack and saved as a reviewer artifact:

```bash
npm run docker:hard-math-closure
npm run docker:symbolic-closure
npm run docker:smt-closure
```

These commands write `truth-harness.hard-math-closure.v0` reports under `.truth-harness/findings/`. They are deliberately narrower than a general solver: exact closure must earn `exact-computed`, symbolic closure must earn `cross-checked`, and SMT closure must earn `smt-checked` for their seeded fixtures. A passing closure report proves the harness closed that scoped validation gate; it does not prove unrelated math claims.

## Readiness Stages

1. **Foundational correctness:** native-safe receipt ladder passes with exact/refuted/unverified labels where expected.
2. **Docker core engines:** Maxima, Z3, and cvc5 earn concrete no-network evidence with `npm run docker:engines`.
3. **Strict all-engine reviewer path:** Lean and SageMath also earn scoped fixture evidence with `npm run docker:all-engines`.
4. **Hard-math closure:** exact, symbolic CAS, and SMT seeded blockers produce saved Docker closure reports.
5. **Formal proof workflows:** theorem statements become Lean/mathlib projects, and `proved` is reserved for accepted proof-check records.
6. **Research harness loops:** agents resume from validation-plan gates and attack the highest-value blocker instead of inventing generic progress.
7. **Human review:** professor/reviewer bundles cite receipts, proof records, SMT/CAS evidence, closure reports, limitations, and replay commands.

## Next Serious Math Work

- Expand the ladder into named levels: high-school algebra, olympiad-style refutations, undergraduate algebra/analysis, SMT encodings, Lean fixtures, and SageMath checks.
- Add a Lean/mathlib template that turns an informal theorem statement into a formalization workspace with explicit unresolved holes.
- Add SageMath fixtures that produce constrained records for algebra, number theory, combinatorics, and exact linear algebra without exposing arbitrary Sage execution.
- Add false-claim corpora where AI models are likely to overclaim, then require Truth Harness to refute, verify, or honestly decline.
- Add regression budgets for proof/search loops: wall-clock time, number of generated artifacts, replay success, and trust-label accuracy.

The moat is not instant genius. The moat is that every step toward genius leaves a local, replayable, inspectable trail.

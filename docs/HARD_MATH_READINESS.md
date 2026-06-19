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

It is not yet an autonomous solver for open problems, a replacement for Lean/mathlib, a replacement for SageMath, or a proof-search system that can be trusted on frontier claims without human experts.

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

- verify exact arithmetic equalities
- refute false exact arithmetic equalities
- check common-denominator lemmas without calling them formal proofs
- distinguish narrow universal parity certificates from proof-checker-backed theorems
- catch dimensional mistakes
- return conservative interval bounds
- refuse theorem-level prompts outside the current checker boundary

Passing this ladder does not prove Truth Harness can solve hard math. A saved passing `truth-harness.benchmark-run.v0` record proves the current workspace has replayable regression evidence for the foundations that hard-math workflows will depend on.

## Readiness Stages

1. **Foundational correctness:** native-safe receipt ladder passes with exact/refuted/unverified labels where expected.
2. **Docker core engines:** Maxima, Z3, and cvc5 earn concrete no-network evidence with `npm run docker:engines`.
3. **Strict all-engine reviewer path:** Lean and SageMath also earn scoped fixture evidence with `npm run docker:all-engines`.
4. **Formal proof workflows:** theorem statements become Lean/mathlib projects, and `proved` is reserved for accepted proof-check records.
5. **Research harness loops:** agents resume from validation-plan gates and attack the highest-value blocker instead of inventing generic progress.
6. **Human review:** professor/reviewer bundles cite receipts, proof records, SMT/CAS evidence, limitations, and replay commands.

## Next Serious Math Work

- Expand the ladder into named levels: high-school algebra, olympiad-style refutations, undergraduate algebra/analysis, SMT encodings, Lean fixtures, and SageMath checks.
- Add a Lean/mathlib template that turns an informal theorem statement into a formalization workspace with explicit unresolved holes.
- Add SageMath fixtures that produce constrained records for algebra, number theory, combinatorics, and exact linear algebra without exposing arbitrary Sage execution.
- Add false-claim corpora where AI models are likely to overclaim, then require Truth Harness to refute, verify, or honestly decline.
- Add regression budgets for proof/search loops: wall-clock time, number of generated artifacts, replay success, and trust-label accuracy.

The moat is not instant genius. The moat is that every step toward genius leaves a local, replayable, inspectable trail.

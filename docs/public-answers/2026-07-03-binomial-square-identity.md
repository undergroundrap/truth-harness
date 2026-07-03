# Public Answer: Binomial Square Identity

Date: 2026-07-03
Status: self-reviewed
Posting status: not-posted
Review status: self-reviewed

## Source

- URL: https://en.wikipedia.org/wiki/Binomial_theorem
- Title: Wikipedia: Binomial theorem
- Accessed: 2026-07-03

## Question

Verify the `n=2`, `y=1` specialization of the binomial theorem:

`(x + 1)^2 = x^2 + 2*x + 1`

and check a nearby wrong claim:

`(x + 1)^2 = x^2 + 2*x + 2`

## Normalized Claim

For all real `x`, `(x + 1)^2 = x^2 + 2*x + 1`.

## Answer

Inside the current Truth Harness symbolic polynomial compiler boundary, the identity is accepted as `cross-checked`: SymPy simplifies the residual `((x + 1)^2) - (x^2 + 2*x + 1)` to `0`, and Maxima independently agrees with the same residual check.

The near-miss claim `(x + 1)^2 = x^2 + 2*x + 2` is `refuted` because its residual is not zero.

## Evidence

- Trust label for the identity: `cross-checked`
- Trust label for the near-miss: `refuted`
- Benchmark suite: `packages/benchmarks/suites/public-symbolic-probes.json`
- Catalog entry: `wikipedia-binomial-square-identity`
- Backends: `local-sympy-subprocess`, `local-maxima-symbolic-subprocess`, `docker-truth-harness`
- Required evidence: compiled polynomial identity contract, SymPy residual simplification to zero, independent Maxima agreement, near-miss refutation, and replay command

## Replay

Preferred Docker replay:

```bash
npm run docker:public-symbolic
```

Focused CAS receipt:

```bash
npm run docker:cli -- cas check -- --operation simplify --expression "((x + 1)^2) - (x^2 + 2*x + 1)" --result 0 --write
```

Catalog handoff:

```bash
truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json --handoff
```

## Boundary

This packet does not claim a formal proof of the binomial theorem. It records a Docker-backed, replayable symbolic CAS cross-check for one single-variable polynomial specialization and a near-miss residual refutation.

The trust label should remain `cross-checked`, not `proved`, unless a proof-checking backend such as Lean accepts a concrete proof artifact.

## Public Reply Draft

For the scoped identity, the answer is correct:

`(x + 1)^2 = x^2 + 2*x + 1`.

I checked the claim through a replayable symbolic route: Truth Harness compiles it to a residual check, SymPy simplifies the residual to `0`, and Maxima independently agrees. A nearby false version with constant term `2` is refuted. The honest trust label is `cross-checked`, not `proved`, because this packet uses CAS agreement rather than a formal proof checker.

Replay command:

```bash
npm run docker:public-symbolic
```
# Public Answer: Pythagorean Trig Identity

Date: 2026-07-03
Status: self-reviewed
Posting status: not-posted
Review status: self-reviewed

## Source

- URL: https://en.wikipedia.org/wiki/Pythagorean_trigonometric_identity
- Title: Wikipedia: Pythagorean trigonometric identity
- Accessed: 2026-07-03

## Question

Verify the standard identity:

`sin(x)^2 + cos(x)^2 = 1`

and check a nearby wrong claim:

`sin(x)^2 + cos(x)^2 = 2`

## Normalized Claim

For real `x`, `sin(x)^2 + cos(x)^2 = 1`.

## Answer

Inside the current Truth Harness symbolic compiler boundary, the identity is accepted as `cross-checked`: SymPy simplifies the left-hand side to `1`, and Maxima independently agrees with the same result.

The near-miss claim `sin(x)^2 + cos(x)^2 = 2` is `refuted` because the computed left-hand side is `1`, not `2`.

## Evidence

- Trust label for the identity: `cross-checked`
- Trust label for the near-miss: `refuted`
- Benchmark suite: `packages/benchmarks/suites/public-symbolic-probes.json`
- Catalog entry: `wikipedia-pythagorean-trig-identity`
- Backends: `local-sympy-subprocess`, `local-maxima-symbolic-subprocess`, `docker-truth-harness`
- Required evidence: compiled symbolic claim contract, SymPy simplification receipt, independent Maxima agreement, near-miss refutation, and replay command

## Replay

Preferred Docker replay:

```bash
npm run docker:public-symbolic
```

Focused CAS receipt:

```bash
npm run docker:cli -- cas check -- --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write
```

Catalog handoff:

```bash
truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json --handoff
```

## Boundary

This packet does not claim a formal theorem proof. It records a Docker-backed, replayable symbolic CAS cross-check for this specific single-variable identity and a near-miss right-hand-side refutation.

The trust label should remain `cross-checked`, not `proved`, unless a proof-checking backend such as Lean accepts a concrete proof artifact.

## Public Reply Draft

The identity is correct: `sin(x)^2 + cos(x)^2 = 1`.

I checked it through a local replayable verifier route rather than relying on an AI explanation. In this Truth Harness packet, SymPy simplifies the expression to `1`, Maxima independently agrees, and the nearby false claim `sin(x)^2 + cos(x)^2 = 2` is refuted. The honest trust label is `cross-checked`, not `proved`, because this packet uses CAS agreement rather than a formal proof checker.

Replay command:

```bash
npm run docker:public-symbolic
```

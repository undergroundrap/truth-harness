# Public Math Journey

Generated: 2026-07-03T07:15:31.916Z
Catalog: `packages/benchmarks/catalog/public-math-problem-catalog.json`
Catalog updated: 2026-07-03

This is the public, wiki-style progress ledger for Truth Harness math work. The machine-readable catalog is the source of truth; this page is the human-readable story of what has been solved, refuted, or left as an honest gap.

## Top Stats

| Metric | Count |
| --- | ---: |
| Problems tracked | 7 |
| Solved by local receipt | 7 |
| Open verifier gaps | 0 |
| Queued catalog problems | 0 |
| Source-needed targets | 1 |

## Trust Outcomes

| Trust label | Count |
| --- | --- |
| `refuted` | 7 |
| `exact-computed` | 5 |
| `cross-checked` | 2 |

## Domains

| Domain | Tracked | Solved |
| --- | --- | --- |
| `bounded-inequality` | 1 | 1 |
| `finite-combinatorics` | 1 | 1 |
| `finite-recurrence` | 1 | 1 |
| `finite-summation` | 1 | 1 |
| `modular-arithmetic` | 1 | 1 |
| `symbolic-polynomial` | 1 | 1 |
| `symbolic-trigonometry` | 1 | 1 |

## Sources

| Source | Tracked | Solved |
| --- | --- | --- |
| Project Euler | 5 | 5 |
| Wikipedia | 2 | 2 |

## Verifier Backends

| Backend | Problems |
| --- | --- |
| `docker-truth-harness` | 2 |
| `local-maxima-symbolic-subprocess` | 2 |
| `local-sympy-subprocess` | 2 |
| `local-binomial-threshold-counter` | 1 |
| `local-fibonacci-even-sum` | 1 |
| `local-finite-sum-inclusion-exclusion` | 1 |
| `local-self-power-modular-sum` | 1 |
| `local-sum-square-difference` | 1 |

## Timeline

| Date | Added | Solved | Problems |
| --- | --- | --- | --- |
| 2026-07-01 | 3 | 3 | `project-euler-001`, `project-euler-002`, `project-euler-006` |
| 2026-07-02 | 2 | 2 | `project-euler-048`, `project-euler-053` |
| 2026-07-03 | 2 | 2 | `wikipedia-binomial-square-identity`, `wikipedia-pythagorean-trig-identity` |

## Problem Wiki Index

| Logged | Problem | Source | Domain | Status | Trust | Replay |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-07-01 | `project-euler-001` | [Problem 1: Multiples of 3 or 5](https://projecteuler.net/problem=1) | `finite-combinatorics` | `solved-by-local-receipt` | `exact-computed`, `refuted` | `truth-harness bench run packages/benchmarks/suites/public-problem-probes.json --write --fail-on-failures` |
| 2026-07-01 | `project-euler-002` | [Problem 2: Even Fibonacci Numbers](https://projecteuler.net/problem=2) | `finite-recurrence` | `solved-by-local-receipt` | `exact-computed`, `refuted` | `truth-harness bench run packages/benchmarks/suites/public-problem-probes.json --write --fail-on-failures` |
| 2026-07-01 | `project-euler-006` | [Problem 6: Sum Square Difference](https://projecteuler.net/problem=6) | `finite-summation` | `solved-by-local-receipt` | `exact-computed`, `refuted` | `truth-harness bench run packages/benchmarks/suites/public-problem-probes.json --write --fail-on-failures` |
| 2026-07-02 | `project-euler-048` | [Problem 48: Self Powers](https://projecteuler.net/problem=48) | `modular-arithmetic` | `solved-by-local-receipt` | `exact-computed`, `refuted` | `truth-harness bench run packages/benchmarks/suites/public-problem-probes.json --write --fail-on-failures` |
| 2026-07-02 | `project-euler-053` | [Problem 53: Combinatoric Selections](https://projecteuler.net/problem=53) | `bounded-inequality` | `solved-by-local-receipt` | `exact-computed`, `refuted` | `truth-harness bench run packages/benchmarks/suites/public-problem-probes.json --write --fail-on-failures` |
| 2026-07-03 | `wikipedia-binomial-square-identity` | [Binomial theorem](https://en.wikipedia.org/wiki/Binomial_theorem) | `symbolic-polynomial` | `solved-by-local-receipt` | `cross-checked`, `refuted` | `npm run docker:public-symbolic` |
| 2026-07-03 | `wikipedia-pythagorean-trig-identity` | [Pythagorean trigonometric identity](https://en.wikipedia.org/wiki/Pythagorean_trigonometric_identity) | `symbolic-trigonometry` | `solved-by-local-receipt` | `cross-checked`, `refuted` | `npm run docker:public-symbolic` |

## Next Catalog Action

- Kind: `catalog-target-search`
- Target: `public-symbolic-identity-queue`
- Goal: Find the next stable public symbolic, forum, or applied math problem with a narrow verifier boundary and a near-miss refutation path.
- Command: `truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json --json`

## Honesty Boundary

This catalog records Truth Harness behavior on public problems. It is not a claim that the project can solve arbitrary contest, forum, research, or theorem problems. Unsupported public problems become explicit verifier backlog.

This page is a tracker, not a proof certificate. Every public result still needs its cited replay command, receipt, benchmark record, and trust boundary before anyone should rely on it.

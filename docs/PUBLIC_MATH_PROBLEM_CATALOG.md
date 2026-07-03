# Public Math Problem Catalog

Updated: 2026-07-03

This is the working ledger for public math problems that Truth Harness can solve, refute, or honestly reject with local evidence. The point is not to memorize public answers. The point is to turn public prompts into replayable receipts, source-linked metadata, reviewer evidence, and explicit checker boundaries.

Machine-readable metadata: [public-math-problem-catalog.json](../packages/benchmarks/catalog/public-math-problem-catalog.json)

Benchmark suite: [public-problem-probes.json](../packages/benchmarks/suites/public-problem-probes.json)

## Workflow

1. Find a public bounded math problem with a stable source URL.
2. Normalize it into the narrowest local verifier boundary.
3. Add one correct task and one near-miss refutation task when possible.
4. Run the public probe suite locally and in Docker.
5. Generate a handoff packet with `truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json --handoff` before assigning the problem to an agent or reviewer.
6. Record the source, date, receipt backend, trust label, required evidence, and checker boundary.
7. If Truth Harness cannot solve it, add an explicit adapter or proof backlog item instead of overclaiming.

## Commands

```bash
npm run demo:public-catalog
npm run demo:public-probes
npm run docker:public-catalog
npm run docker:public-probes
truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json
truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json --json
truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json --handoff
truth-harness bench run packages/benchmarks/suites/public-problem-probes.json --write --fail-on-failures
```

## 2026-07-01 Public Probe Ledger

| Problem | Source | Status | Trust outcomes | Local backend | Evidence metadata |
| --- | --- | --- | --- | --- | --- |
| Project Euler 1: multiples below a bound | [Project Euler Problem 1](https://projecteuler.net/problem=1) | solved by local receipt | `exact-computed`, `refuted` | `local-finite-sum-inclusion-exclusion` | [suite tasks](../packages/benchmarks/suites/public-problem-probes.json) |
| Project Euler 2: bounded even Fibonacci sum | [Project Euler Problem 2](https://projecteuler.net/problem=2) | solved by local receipt | `exact-computed`, `refuted` | `local-fibonacci-even-sum` | [suite tasks](../packages/benchmarks/suites/public-problem-probes.json) |
| Project Euler 6: finite sum-square difference | [Project Euler Problem 6](https://projecteuler.net/problem=6) | solved by local receipt | `exact-computed`, `refuted` | `local-sum-square-difference` | [suite tasks](../packages/benchmarks/suites/public-problem-probes.json) |
| Project Euler 48: self-power last digits | [Project Euler Problem 48](https://projecteuler.net/problem=48) | solved by local receipt | `exact-computed`, `refuted` | `local-self-power-modular-sum` | [suite tasks](../packages/benchmarks/suites/public-problem-probes.json) |
| Project Euler 53: binomial threshold count | [Project Euler Problem 53](https://projecteuler.net/problem=53) | solved by local receipt | `exact-computed`, `refuted` | `local-binomial-threshold-counter` | [suite tasks](../packages/benchmarks/suites/public-problem-probes.json) |
| Pythagorean trig identity | [Wikipedia: Pythagorean trigonometric identity](https://en.wikipedia.org/wiki/Pythagorean_trigonometric_identity) | open adapter gap | needs SymPy plus Maxima/Sage cross-check | symbolic CAS | `truth-harness cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write` |

## Publication Rule

If this repo is linked in a forum or classroom answer, cite the source problem, the benchmark suite path, the generated benchmark-run record if one exists, and the receipt replay command. `truth-harness bench catalog packages/benchmarks/catalog/public-math-problem-catalog.json` is the quick human/agent entry point for finding the source URL, solved status, local backend, suite task ids, and next target queues. `--json` includes `summary.nextAction`, which tells an autonomous agent which catalog gap or public-problem search target to attack first, what evidence is required, and when to stop. `--handoff` renders the same next action as a Markdown packet with the source, required evidence, replay commands, and honesty boundary for agent handoffs or professor review. Do not claim a result is `proved` unless an accepted proof-checking backend produced that label. Exact finite computation is valuable, but it is not the same thing as a formal proof of a general theorem.

## Next Catalog Targets

- Close the sourced Pythagorean trigonometric identity gap with `truth-harness cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write`, the Docker CAS route, and a near-miss refutation probe before marking the public problem solved.
- Forum-style problems where the answer is less important than the transparent route: prompt, source, assumptions, receipt, replay, and limitation.

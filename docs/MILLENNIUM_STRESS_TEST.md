# Millennium Stress Test

Truth Harness should be allowed to work near the Millennium Prize Problems, but it must never pretend proximity is proof. This pack turns the seven Clay Mathematics Institute problems into a conservative system test for frontier research workflows.

## What This Is

- A source-linked catalog of all seven Millennium Prize Problems.
- A benchmark-backed refusal suite for final-solution prompts.
- A handoff surface for agents to build subclaim maps, literature queues, formalization plans, and verifier routes.
- A regression test that Truth Harness stays honest when asked to solve famous open problems.

## What This Is Not

- It is not a claim that Truth Harness can solve a Millennium problem today.
- It is not a proof certificate for any final Clay statement.
- It is not evidence for the prize until an exact official statement has accepted proof evidence and independent expert review.

## Current Posture

The catalog lives at:

```bash
packages/benchmarks/catalog/millennium-stress-test-catalog.json
```

The seven entries are:

| Problem | Truth Harness posture |
| --- | --- |
| Riemann Hypothesis | `unverified`; final theorem unsupported without accepted proof evidence |
| P vs NP | `unverified`; final theorem unsupported without accepted proof evidence |
| Navier-Stokes existence and smoothness | `unverified`; final theorem unsupported without accepted proof evidence |
| Birch and Swinnerton-Dyer | `unverified`; final theorem unsupported without accepted proof evidence |
| Hodge Conjecture | `unverified`; final theorem unsupported without accepted proof evidence |
| Yang-Mills existence and mass gap | `unverified`; final theorem unsupported without accepted proof evidence |
| Poincare Conjecture | externally solved by Perelman, but still `unverified` locally unless Truth Harness imports accepted proof evidence |

## Commands

Run the native-safe honesty suite:

```bash
npm run demo:millennium-stress
```

Run it in Docker:

```bash
npm run docker:millennium-stress
```

Render the agent handoff from the catalog:

```bash
npm run demo:millennium-catalog
```

Or call the CLI directly:

```bash
truth-harness bench catalog packages/benchmarks/catalog/millennium-stress-test-catalog.json --handoff
```

## Why This Helps

These problems are useful precisely because Truth Harness cannot solve them yet. They pressure-test the system's hardest promises:

- Does it separate official statements from informal summaries?
- Does it distinguish bounded experiments from universal proof?
- Does it preserve source, replay, and proof obligations for multi-month work?
- Does it stop AI agents from laundering prose into `proved`?
- Does it make the next research step concrete enough for another agent or human to resume?

## Next Real Slice

The next useful build step is a Millennium subclaim map writer. For each problem, it should create a local workspace with:

- official Clay statement and source refs
- definitions and assumptions
- known partial results
- bounded experiment lanes
- formalization targets
- expert-review gates
- overclaim blockers

The goal is not to solve the final theorem immediately. The goal is to make every failed attempt produce reusable evidence and expose the next missing verifier capability.
# OpenAI Build Week Submission Packet

## Project

Truth Harness: local-first evidence receipts for AI agents.

## One-line pitch

Truth Harness turns AI math and research claims into replayable local evidence: exact computations, refutations, proof checks, solver artifacts, citations, benchmarks, and honest `unknown` labels instead of fluent hallucinated certainty.

## Why it fits Build Week

Truth Harness was built with Codex as an agent-facing verification layer. The core idea is simple: let AI propose, but make local deterministic tools decide what can be trusted. The project exposes CLI, MCP, Docker, and a local web workbench so Codex-like agents can route claims through verifiers, record receipts, and resume from evidence-backed next steps.

## Best demo story

1. Start with a plausible false math claim that an AI might explain confidently.
2. Run the same claim through Truth Harness and show `refuted` with a counterexample and replayable receipt.
3. Run a true arithmetic/symbolic claim and show `exact-computed` or `cross-checked`, not `proved`, because the trust label stays within the evidence boundary.
4. Show the web workbench displaying the receipt, lineage, checks, replay command, and report export.
5. End with `npm run audit:release` showing the local readiness audit and its honest frontier-discovery boundary.

## Demo commands

```bash
npm install
npm run build
npm run demo:ai-failures
npm run demo:math-ladder
npm run audit:release
npm run docker:web
```

For the short recorded submission demo, use the applied collision-math runbook in [BUILD_WEEK_DEMO_RUNBOOK.md](BUILD_WEEK_DEMO_RUNBOOK.md) and run:

```bash
npm run docker:build-week
```

Docker-first commands are preferred for public demos because they keep the verification stack isolated from the host and make engine availability easier to reproduce.

## Technical highlights

- Local-first workspace storage; generated evidence lives under `.truth-harness/` and is ignored by git.
- Conservative trust labels: `proved` requires accepted proof-checker evidence; CAS, SMT, benchmarks, and sources do not become proof by themselves.
- Replayable receipts for arithmetic, symbolic checks, SMT checks, Lean proof checks, benchmark runs, visuals, source citations, and review handoffs.
- MCP server for Codex/Claude-style agents plus a CLI that shares the same backend.
- Docker profiles for no-network verification, all-engine review, SageMath, Lean proof checks, and web UI isolation.
- Release audit that composes workspace validation, catalog freshness, engine evidence, benchmark posture, sandbox posture, UI review, and proof-lane readiness.

## Public claims to make

Truth Harness is a bounded, local-first hard-math verification harness for scoped claims with replayable evidence.

Truth Harness helps agents avoid hallucinated math and research claims by forcing outputs through local verifiers and evidence receipts.

Truth Harness is not a magic proof engine, medical discovery system, patent validator, or autonomous solver of frontier open problems.

## Current readiness snapshot

As of 2026-07-18:

- `npm run check`: passed, 86 test files and 753 tests.
- `npm run audit:release`: ready, 21 pass / 0 warn / 0 fail.
- Public hygiene scan: no committed local workspace artifacts, no obvious API keys, old pre-rename product naming removed from public config/templates.
- Remaining launch work: record a concise demo video, verify Docker demo on the target machine, and decide whether the repository should be public before submission or shared privately if the challenge allows private repositories.

## Submission caution

Do not claim Truth Harness solves unsolved math, proves scientific discoveries, or replaces expert review. The strongest honest submission angle is narrower and better: it is infrastructure that makes AI-assisted math and research work auditable, replayable, local-first, and less prone to hallucinated certainty.

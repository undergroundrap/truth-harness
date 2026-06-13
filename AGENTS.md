# Agent Instructions

Truth Harness is a local-first, verification-first math and science workbench. The core rule is simple:

> AI can plan and explain. Verification engines, local evidence, replay, and human review decide what is trusted.

When working in this repo:

- Keep project data, source material, literature records, notebook-run records, intermediate calculations, simulations, experiments, invention notes, vault envelopes, snapshots, and reports inside the local `.truth-harness/` store unless the user explicitly approves selected context for an external model or service.
- Use the best available local tools first. Use the latest capable hosted models only as opt-in reasoning collaborators after preparing a selected-context packet with `truth_harness_model_context_prepare`; send only what the user approved, and log any external context with `truth_harness_disclosure_log`.
- Prefer Docker-first verification for agent-facing work: `docker build --target verify -t truth-harness:verify .` for the no-bind-mount proof gate, or `docker compose run --rm truth-harness npm run check` and `docker compose run --rm truth-harness npm run proof:launch` for day-to-day checks.
- Run `npm run check` before claiming code is verified.
- Run `npm run proof:launch` before claiming the public demo path works.
- Use `truth_harness_ask`, `truth_harness_benchmark_run`, and `truth_harness_replay` through MCP when available.
- Treat `unverified` receipts as unresolved, not true.
- Never label a result `proved` unless a proof-checker adapter accepts it.
- Treat biomedical, clinical, regulatory, safety, and patent/legal claims as review-boundary claims. Create literature records for key papers, patents, datasets, or database exports; create notebook-run records for local notebooks, scripts, and pipelines; then create validation plans when stronger claims need proof, wet-lab, clinical, regulatory, safety, prior-art, reduction-to-practice, or patent/legal gates. Hair-loss, cancer, rare-disease, materials, climate, physics, and pure-math hypotheses may be explored, but weak evidence must stay labeled as a hypothesis until it is proved, reproduced, experimentally validated, or reviewed by the right humans.
- Add benchmark tasks for every new adapter behavior.
- Prefer small, inspectable adapters over broad rewrites.
- Keep receipt schema compatibility in mind when changing core graph or trust-label behavior.

For math, physics, simulation, or code-verification claims in docs, add fenced blocks and run:

```bash
npm run cli -- check docs/examples/strict-claims.md
```

Fenced claim format:

````markdown
```truth-harness
expect: exact-computed
compute 3 / 4 + 5 / 8
```
````

If `expect:` is omitted, strict checking only passes trusted non-refutation labels such as `proved`, `exact-computed`, `bounded-numeric`, `smt-checked`, `dimension-checked`, `source-cited`, or `cross-checked`.

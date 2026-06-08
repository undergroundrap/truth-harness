# Agent Instructions

Theorem Workbench is a verification-first math workbench. The core rule is simple:

> AI can plan and explain. Verification engines decide what is trusted.

When working in this repo:

- Run `npm run check` before claiming code is verified.
- Run `npm run proof:launch` before claiming the public demo path works.
- Use `theorem_ask`, `theorem_benchmark_run`, and `theorem_replay` through MCP when available.
- Treat `unverified` receipts as unresolved, not true.
- Never label a result `proved` unless a proof-checker adapter accepts it.
- Add benchmark tasks for every new adapter behavior.
- Prefer small, inspectable adapters over broad rewrites.
- Keep receipt schema compatibility in mind when changing core graph or trust-label behavior.

For math, physics, simulation, or code-verification claims in docs, add fenced blocks and run:

```bash
npm run cli -- check docs/examples/strict-claims.md
```

Fenced claim format:

````markdown
```theorem-workbench
expect: exact-computed
compute 3 / 4 + 5 / 8
```
````

If `expect:` is omitted, strict checking only passes trusted non-refutation labels such as `proved`, `exact-computed`, `bounded-numeric`, `smt-checked`, `source-cited`, or `cross-checked`.

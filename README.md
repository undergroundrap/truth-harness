# Theorem Workbench

**Verified Math for AI Agents.**

Theorem Workbench is a verification-first mathematical workbench for humans, Claude, Codex, and other agentic tools.

The project goal is not to replace WolframAlpha by rebuilding every math engine. The goal is to make AI-assisted math auditable: every answer should be backed by a replayable tool run, proof check, cited source, counterexample search, or an explicit uncertainty label.

The name is intentional: it is both a workbench for doing verified math and a benchmark harness for measuring agents, tools, prompts, and solver portfolios against reproducible math tasks.

## Why It Exists

AI is already good at writing plausible math. The hard part is knowing when the math is true.

Theorem Workbench turns math answers into receipts:

- exact computations use exact rational arithmetic or CAS adapters,
- false universal claims get counterexample search before explanation,
- formal proofs will only be labeled `proved` when a proof checker accepts them,
- every result carries a trust label and replay command.

## Quickstart

```bash
npm install
npm run build
python -m pip install sympy==1.14.0
npm run cli -- ask "compute 3 / 4 + 5 / 8"
npm run cli -- ask "for all integers n, n^2+n+1 is even"
npm run cli -- ask "for all integers n, n^2+n+1 is even" -- --out receipts/false-parity.json
npm run cli -- replay receipts/false-parity.json
npm run cli -- bench run packages/benchmarks/suites/foundations-seed.json
npm run cli -- bench run packages/benchmarks/suites/physics-seed.json
npm run cli -- bench run packages/benchmarks/suites/symbolic-seed.json
npm run cli -- ask "dimension check force = mass * acceleration"
npm run cli -- ask "dimension check force = mass * velocity"
npm run cli -- ask "symbolic simplify sin(x)^2 + cos(x)^2"
npm run cli -- check docs/examples/strict-claims.md
```

The current MVP is intentionally small and honest. It supports exact rational arithmetic, finite counterexample search, dimensional analysis, a local SymPy symbolic adapter, receipt replay, benchmark runs, and a local MCP server. Lean, Sage, SMT, and RAG adapters are planned as modular packages.

Symbolic prompts use a local Python subprocess and require SymPy:

```bash
python -m pip install sympy==1.14.0
```

On Windows, `py -m pip install sympy==1.14.0` works too.

Receipt JSON is shaped by [schemas/receipt.schema.json](schemas/receipt.schema.json), so future CLI, MCP, CI, and web surfaces can share the same artifact contract.

The MCP server exposes the same receipt engine to agents:

```bash
npm run mcp
```

The launch proof script runs the public demo gates:

```bash
npm run proof:launch
```

See [docs/RESEARCH_AND_ARCHITECTURE.md](docs/RESEARCH_AND_ARCHITECTURE.md) for the current naming check, open-source landscape, architecture, data structures, CLI/MCP surface, benchmarking surface, and test strategy.

See [docs/CREDIBILITY_AND_GROWTH_STRATEGY.md](docs/CREDIBILITY_AND_GROWTH_STRATEGY.md) for the public positioning, expert credibility rules, viral wedges, launch demos, and community strategy.

See [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) for the first Hacker News-ready demo path.

See [docs/OPEN_SOURCE_AND_COMMERCIAL_STRATEGY.md](docs/OPEN_SOURCE_AND_COMMERCIAL_STRATEGY.md) for the open-source, company-building, and acquisition-path strategy.

See [docs/AGENT_SETUP.md](docs/AGENT_SETUP.md) for Claude Code and Codex MCP setup.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before opening benchmark, adapter, or agent-workflow changes.

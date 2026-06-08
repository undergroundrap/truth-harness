# Theorem Workbench Launch Plan

Date: 2026-06-08

## Launch Thesis

The first public artifact should be narrow, real, and easy to argue about:

> I built a proof-receipt machine for AI math answers.

The Hacker News audience will punish hype and reward a working demo with crisp limits. The launch should not claim "AI discovers math." It should show a small tool that catches bad AI math, produces exact receipts, and refuses to claim proof when it only ran finite checks.

## Launch Demo

The first demo should fit in one terminal screenshot:

```bash
npm run cli -- ask "for all integers n, n^2+n+1 is even"
```

Expected story:

- The system normalizes the claim.
- It runs exact finite counterexample search.
- It returns `refuted`.
- It shows the counterexample.
- It emits a replay command and evidence graph nodes.

Second screenshot:

```bash
npm run cli -- ask "for all integers n, n^2+n is even"
```

Expected story:

- The system finds no counterexample in the local range.
- It still returns `unverified`.
- It explicitly says finite search is not a formal proof.

That contrast is the product. It shows Theorem Workbench is designed to be more truthful than a chatbot.

## HN Post Draft

Title options:

- Show HN: Theorem Workbench, proof receipts for AI-generated math
- Show HN: I built a proof-receipt CLI for AI math answers
- Show HN: A tiny workbench that makes AI math answers replayable

Body draft:

> Theorem Workbench is an open-source CLI/workbench for turning AI-generated math into auditable receipts.
>
> The current MVP is tiny: exact rational arithmetic, finite counterexample search, dimensional analysis, SymPy-backed symbolic computation, evidence graphs, trust labels, replay commands, and seed benchmark suites. The important part is the trust policy: it will not label something `proved` unless a proof checker accepts it. If finite search finds no counterexample, the output remains `unverified`.
>
> The next adapters are Lean/Mathlib, Sage, Z3/cvc5, RAG citations, and richer MCP artifacts so Claude/Codex can verify subclaims recursively.
>
> I am looking for people to break the trust model, suggest benchmark tasks, and point out which proof/CAS integrations should come first.

## Acquisition-Grade Shape

Do not optimize for looking like a small WolframAlpha clone. Optimize for becoming infrastructure:

- Evidence graph format.
- Benchmark suite format.
- CLI-first workflow.
- Agent-native integration.
- Proof/CAS/SMT/RAG adapters.
- Replayable artifacts for CI, docs, notebooks, papers, and chats.

The version that a serious AI lab notices is not a slick chat UI. It is a trust layer that agents can call recursively and benchmark against.

## Milestones Before Public Launch

1. `npm install && npm run check` passes on a clean clone. Status: done locally.
2. `theorem ask` can write a JSON receipt with `--out`. Status: done.
3. `theorem replay` can replay a saved receipt. Status: done.
4. `theorem bench run` produces readable math, physics, and symbolic score reports. Status: done.
5. README explains the trust labels in plain language. Status: done.
6. One GIF or terminal recording shows refutation and honest uncertainty. Status: pending.
7. At least 25 seed benchmark tasks exist. Status: done.
8. GitHub repo has issues labeled `good first proof`, `adapter`, `benchmark`, and `trust-model`. Status: pending.

## What To Build Next

Priority 1: make the demo undeniable.

- Add 25 benchmark tasks.
- Add receipt JSON schema.
- Add HTML receipt renderer or Markdown export.
- Add `theorem replay`.

Priority 2: become useful to real math users.

- Add SymPy adapter for symbolic exact computation. Status: done for local subprocess MVP.
- Add Lean smoke adapter.
- Add Z3 adapter for constraints and counterexamples.
- Add unit/dimensional analysis for physics claims.

Priority 3: become native to agents.

- Add MCP server exposing `theorem_ask`, `theorem_benchmark_run`, and `theorem_get_artifact`.
- Add Claude/Codex setup docs.
- Add strict mode where final answers fail if any final claim is `unverified`.

# Theorem Workbench Moat

Date: 2026-06-12

## The Moat

Theorem Workbench should win by becoming the local verification layer for serious agentic work.

The moat is not a prettier chat interface. It is the combination of:

1. **Claim ledger**: claims become durable local records with ids, tags, dependencies, supersession links, evidence refs, trust labels, open checks, and Markdown exports.
2. **Verifier ladder**: every claim shows how far it has actually gone: stated, computed, cited, independently checked, formally proved, human reviewed.
3. **Agent-native routes**: the same artifact contracts are reachable through CLI, MCP, web, and later API/desktop surfaces, so Claude, Codex, local models, and humans can work from one shared evidence layer.
4. **Local-first provenance**: project data, evidence, receipts, disclosures, model-context packets, snapshots, and reports live in the local workspace by default.
5. **Refutation-first trust policy**: `unverified` and `refuted` are first-class outcomes. The system is allowed to stop the user from saying something too strong.
6. **Replayable reports**: exported reports should cite the exact claims, receipts, commands, limitations, open checks, and activity that produced the conclusion.

The short version:

> Git + CI + receipts + proof engines for reasoning.

## Engine Positioning

Theorem Workbench is building its own engine, but the engine is the verification layer around research work, not a from-scratch replacement for every specialized solver.

Theorem owns:

- the trust policy,
- verifier routing,
- evidence graph,
- claim ledger,
- receipt runtime,
- workspace validation,
- model-context disclosure,
- replay/report contracts,
- agent-facing CLI/MCP/web surfaces.

Theorem adapts mature engines such as SymPy, Z3, Lean, SageMath, Maxima, notebooks, local search, and later domain simulators. That is a strength, not a weakness. The core product decides what each engine output can and cannot prove, records the exact artifact, and blocks claims from outrunning the evidence.

Native kernels should stay small and auditable: exact rational arithmetic, expression normalization, counterexample search, dimensions, intervals, evidence-reference resolution, and trust-label gates. Large domain engines should be adapters until there is a clear reason to own a narrow kernel ourselves.

See [ENGINE_STRATEGY.md](ENGINE_STRATEGY.md) for the full boundary.

## Why This Is Different

Existing tools are excellent at parts of the workflow:

- CAS systems compute.
- Proof assistants verify formal proofs.
- Notebooks execute and explain.
- RAG tools retrieve sources.
- Agent tools plan, write code, and summarize.
- Lab notebooks record work.
- Benchmark suites measure systems.

Theorem Workbench is different because it treats **the claim itself** as the core object.

A serious research result is rarely one answer. It is a chain:

1. A hypothesis.
2. Definitions and assumptions.
3. Subclaims.
4. Failed attempts.
5. Counterexamples.
6. Exact computations.
7. Solver checks.
8. Proof attempts.
9. Sources and citations.
10. Human review.
11. A final, scoped claim.

Most AI interfaces lose that chain inside chat history. Theorem Workbench records it as local artifacts agents can query, replay, inspect, and improve.

## Claim Ledger Contract

Every claim ledger record has:

- `claimId`: stable local id.
- `statement`: exact human-readable claim.
- `domain`: math, physics, sources, code, data, biology, finance, patent, and other lanes.
- `trust`: strongest current local trust label.
- `dependsOn`: upstream claims this claim relies on.
- `supersedes`: old claims corrected or replaced by this one.
- `tags`: searchable topic labels.
- `evidenceRefs`: receipts, proof checks, SMT checks, sources, reviews, validation plans, snapshots, or other artifacts.
- `verification`: ladder showing which gates are satisfied, waiting, blocked, or not applicable.
- `finalization`: whether the claim is ready only as a narrow claim, and what checks remain open.
- `markdown`: portable review output.

This is the primitive that lets math become modular like code. A long proof, paper, simulation study, or business audit can be decomposed into linked claims with visible review state instead of one giant unverifiable answer.

## Why Agents Need It

Claude and Codex are powerful, but by default their reasoning state is trapped in a conversation. They can forget, summarize too aggressively, or sound confident after a bad assumption.

Theorem Workbench gives agents a harder substrate:

- Ask the model to propose a subclaim.
- Record that subclaim in the claim ledger.
- Attach the smallest relevant verifier output.
- Link dependencies and superseded mistakes.
- Snapshot the workspace.
- Continue only from the current ledger state.

This turns long agent sessions into auditable research runs.

## What We Should Say Publicly

Strong claims:

- "Local verification layer for AI-assisted math and research."
- "Claim ledger and proof receipts for agentic work."
- "Replayable evidence trails for Claude, Codex, and humans."
- "A workbench that records what was checked, what failed, and what remains unverified."

Claims to avoid until earned:

- "Solves any problem."
- "Replaces WolframAlpha, Lean, Jupyter, or lab notebooks."
- "Discovers new math automatically."
- "Cures diseases."
- "Truth oracle."

The credible line:

> Theorem Workbench does not make AI true. It makes AI-assisted work inspectable, replayable, and harder to overclaim.

## Near-Term Product Wedge

The next moat-building sequence should be:

1. Make the math lane brutally good at exact arithmetic, false theorem refutation, symbolic checks, SMT checks, proof-check records, and benchmark reports.
2. Make every result promotable into a claim ledger record.
3. Make the web UI show a claim graph that can be searched, filtered, copied, downloaded, and exported into a report.
4. Make agent sessions recursively update the ledger rather than leaving important state in chat.
5. Publish benchmark demos where Theorem catches fluent AI mistakes and exports replayable receipts.

## Product Rule

If a feature does not strengthen the local evidence loop, it is secondary.

The core loop is:

```text
claim -> verifier -> receipt -> ledger -> snapshot -> report -> next claim
```

That loop is the moat.

## Current Web Loop

The web app now participates in the same local evidence loop as the CLI and MCP server:

- `/api/receipt` creates local receipt view models without hosted model calls.
- `/api/claims` writes selected receipts into `.theorem-workbench/claims` through the core claim-ledger module.
- The browser shows persisted claim IDs in the sidebar, inspector, and report export.
- Claim records keep tags, trust labels, dependencies, evidence refs, open checks, authors, and Markdown output as project-local artifacts.
- `Record chain` recursively records upstream subclaims first, then records or revises the selected claim with ledger dependency links and `supersedes` history.
- The claim ledger can be filtered by claim id, tags, domain, trust state, evidence refs, authors, open checks, and dependency ids.

This is the wedge: researchers and agents should not have to choose between a usable front end and verifiable local provenance.

The long-term export direction should stay compatible with established provenance and research packaging ideas: claims and receipts as entities, verifier/model/tool runs as activities, humans/agents as attributed actors, and reports/snapshots as portable research objects.

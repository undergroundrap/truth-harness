# Truth Harness Product Readiness Map

Date: 2026-06-15

This document is the sober counterweight to launch planning. Truth Harness has a credible core, but it is not ready to be presented as a universal research workbench yet. The correct next phase is product hardening: understand what is real, stress it, improve the human interface, and refuse to overclaim.

## Current Verdict

Truth Harness is currently a strong local-first verification prototype with a real trust model, a working CLI/MCP/core, a first web workbench shell, Dockerized engine checks, and replayable evidence artifacts.

It is not yet a polished research IDE, a WolframAlpha replacement, a SageMath replacement, a scientific discovery engine, a medicine engine, a patent engine, or a tool that should be trusted by nontechnical users without guardrails.

The product should stay private-prototype until the readiness gates below move from yellow/red to green.

## What Is Real Today

| Area | Status | What is actually working |
|---|---:|---|
| Exact arithmetic | Green | Exact rational arithmetic receipts with deterministic traces and replay commands. |
| Refutation | Green | Narrow universal parity claims can be refuted with concrete counterexamples. |
| Trust labels | Green | Conservative labels exist and are validated; `proved` is reserved for accepted proof checkers. |
| Receipt validation | Green | Receipt JSON is schema/runtime validated and fails toward missing/unsupported evidence. |
| Docker engine path | Green | Docker image includes SymPy, Maxima, and Z3; `engines verify --require-maxima --require-z3` reports earned `cross-checked` and `smt-checked` gates in the no-network compose service. |
| CLI coverage | Green/yellow | Broad CLI exists across receipts, claims, routes, CAS, SMT, proof records, benchmarks, sources, notebooks, sessions, audits, and snapshots. Needs usability pass. |
| MCP/agent layer | Green/yellow | Agents can call many local tools. Workspace run-next planning is available through CLI/MCP and the local web API as a dry-run plan; CLI `--write` and MCP `write: true` record run-next intent packets into local findings before handoff, and CLI/MCP list/show commands reopen those packets for later audit or resume. Bounded execution remains behind CLI/MCP gates. Code-run is gated and safer than before, but agent flows need end-to-end stress tests. |
| Claim ledger | Yellow/green | Linked claims, evidence refs, tags, supersession, and readiness gates exist. Needs multi-day workspace testing. |
| Web UI | Yellow/red | The workbench shell exists and is improving. It is not yet polished enough to be the product's first impression. |
| Visuals | Yellow/red | Number line, maps, lineage, and visual tabs exist. Needs interaction polish, layout QA, editability, and large-canvas testing. |
| Teaching/reporting | Yellow | Teaching packets and HTML reports exist. Needs professor/student workflow testing. |
| Storage scale | Yellow | Local workspace artifacts work; catalog indexing, same-directory atomic writes, append-only artifact-write event logs, local web `/api/events`, and locks for session/corpus read-modify-write paths are in place. Large-workspace performance, timeline UX polish, and longer multi-agent stress tests still need proof. |
| Formal proof | Yellow | Lean proof-check records exist when Lean is installed. A separate Docker `lean-proof` target pins Lean and checks a small fixture; broad Mathlib/project automation is still future work. |
| Sage/Wolfram-like breadth | Yellow | Constrained SageMath CAS check records exist for scoped symbolic equality via `cas check --backend sage`, and a separate no-network `sage-math` Docker target can run the `--require-sage` engine gate. Sage is still not a general Sage execution surface. |
| Biology/medicine/patents | Red | Evidence organization patterns exist. No automated medical, patent, or discovery claims should be made. |

## What The Demo Proves

The Docker demo proves a narrow but important claim:

1. Local exact engines can produce receipts.
2. False claims can be refuted with evidence.
3. SymPy and Maxima can independently agree on scoped symbolic cases.
4. Z3 can check a concrete SMT-LIB artifact.
5. The engine evidence report can separate availability probes from concrete earned labels.
6. The system can mark unsupported problems as `unverified`.
7. Every displayed result has a replay command and report artifact.

The demo does not prove:

1. The web UI is ready.
2. The app scales to huge workspaces.
3. The system can solve open math problems.
4. The system can do biomedical discovery.
5. The system is safe for arbitrary code or arbitrary Sage execution.
6. The product is ready for public launch.

## Launch Hold Criteria

Do not publicly launch or record the main hype demo until these are true:

1. `npm run check` passes locally.
2. `docker compose build` passes.
3. `npm run docker:engines` passes.
4. `npm run docker:demo` passes.
5. The web app has no obvious clipping, overlap, broken scroll, broken focus, or confusing navigation in desktop view.
6. A new user can understand the difference between Math, Visuals, Lineage, Protocol, Notes, Replay, and Report without reading source code.
7. The project can run a 100+ receipt local workspace without slow scans becoming painful.
8. Claim ledger search/tag/filter/dependency flows are usable from both CLI and UI.
9. At least one professor-style teaching workflow can be completed end to end: ask -> receipt -> trace -> notes -> report -> replay.
10. Agent workflows can work for at least one hour against local artifacts without losing provenance.
11. Security docs clearly explain what Docker protects, what it does not protect, and what code-run can and cannot attest.

## Stress Tests We Need

### Engine Stress

- Run 100 arithmetic prompts with fractions, parentheses, negative values, and invalid inputs.
- Run 100 false/true parity claims and assert refuted/exact/unverified behavior.
- Run symbolic CAS checks where SymPy and Maxima agree, disagree, and fail to parse.
- Run SMT checks for sat, unsat, unknown/error, missing solver, and malformed SMT-LIB.
- Run replay on generated receipts and compare trust, summary, and evidence boundaries.

### Workspace Stress

- Generate a workspace with 1,000 receipts, 500 claims, 100 routes, and 100 mixed artifacts.
- Measure list/search/review latency for CLI and web API.
- Validate the workspace and record wall-clock time.
- Simulate duplicate ids, missing refs, stale routes, superseded claims, and forged trust labels.
- Confirm atomic writes and read-modify-write locks under concurrent agent loops, including interrupted-run recovery.

First harness: `truth-harness workspace stress <path> --receipts 100 --claims 50 --routes 20 --fail-on-validation` now generates a synthetic linked workspace with the real writer APIs, then records validation, review, graph, missing-ref, and timing summaries. Use throwaway paths until the UI and storage scale work are ready.

### UI Stress

- Desktop widths: 1280, 1440, 1920, ultrawide.
- Side nav expanded/collapsed.
- Long claims, long tags, long run ids, long evidence refs.
- Visual canvas: zoom, pan, fit, focus, no text clipping, no node overlap.
- Report tab: readable, printable, no overflow.
- Activity/log/notes: unified timeline, search, export, copy-all.
- Input bar: always reachable, no bottom clipping.

### Agent Stress

- Claude/Codex-style agent loop creates a route, attaches evidence, writes notes, updates claims, runs replay, and exports a report.
- Agent receives a model-context packet and the system records what context would leave the machine.
- Agent attempts unsupported or unsafe code-run and the system fails closed.
- Agent works against a local Docker no-network runtime and receipts correctly attest network boundary.

### Human Trust Stress

- A high-school learner can tell what was computed and what was not.
- A professor can inspect replay, backend, limitations, and exact evidence without trusting a chat answer.
- A researcher can link claims like a codebase and revise without erasing history.
- A skeptical Hacker News reader can find the receipts, commands, and source code path quickly.

## Next Best Work Slices

1. **UI usability pass:** make the app feel like a serious desktop research IDE, not a demo dashboard.
2. **Readiness dashboard:** surface `engines verify`, workspace health, and launch-recording gates as separate evidence panels.
3. **Workspace scale fixtures:** expand `workspace stress` beyond the first receipts/claims/routes harness into large mixed-artifact runs, performance budgets, and web API latency checks.
4. **Claim search and dependency UX:** make tags, lineage, supersession, and linked claims obvious in UI and CLI.
5. **Professor credibility packets:** `workspace credibility-pack` now writes a local reviewer packet with validation status, embedded artifact hashes, engine evidence, open obligations, an actionable reviewer plan, and rerun commands. `workspace credibility-actions --json` exposes the same unresolved closure queue directly for agents and CI without executing anything. `workspace run-next --source credibility-actions` can now plan or execute one supported reviewer action through core APIs, including writable engine verification runs, without shell execution. `workspace credibility-bundle` now copies the cited canonical artifacts into a portable directory and `workspace verify-credibility-bundle` checks bundle hashes separately from source workspace drift. Next harden it with optional signing and compressed export.
6. **Report hardening:** make reports printable, cite run ids, show author identity, and export a complete session packet.
7. **Agent session log:** unified timeline for human actions, agent actions, CLI commands, API calls, receipts, notes, and reports.
8. **Sage credibility gate hardening:** direct constrained Sage check records and the separate `sage-math` Docker gate exist; next is build-time performance testing, a smaller image strategy if possible, and a reviewer fixture beyond the trigonometric identity smoke.
9. **Lean runtime design:** expand the pinned Lean fixture toward real project templates, Mathlib-aware diagnostics, and proof records that support meaningful `proved` claims.
10. **Adversarial benchmark suite:** a public false-claims and hallucination-catcher suite before public launch.
11. **Security rehearsal:** re-run threat model around code-run, MCP, Docker, filesystem writes, and local reports.

## Product Principle

The moat is not that Truth Harness answers everything. The moat is that it makes every answer accountable.

The product should feel powerful because it is honest: it shows what ran, what was checked, what failed, what remains open, and how a human or agent can continue without losing the trail.

# Truth Harness Grand Vision Roadmap

Date: 2026-06-22

This is the sober map from the current Truth Harness prototype to the larger vision: a local-first verification layer where humans and AI agents can attack hard math, science, software, simulation, and engineering problems without confusing fluent model output for truth.

## Honest Current Position

Truth Harness is not 15-25% because the work so far is small. It is 15-25% because the final vision is enormous.

The current system already has a serious trust substrate:

- replayable receipts
- conservative trust labels
- claim ledgers with dependencies and supersession
- validation plans and evidence gates
- run-next handoffs for agents
- local workspace snapshots and artifact hashes
- CAS, SMT, Lean, Sage, and Docker reviewer pathways
- MCP/CLI/API/web surfaces
- release audits, credibility packs, and benchmark ledgers

That is more than a demo. It is the skeleton of the product.

But the final vision is not "a verification skeleton." The final vision is an engine-grade research IDE that can coordinate formal proof, symbolic computation, numerical bounds, simulation, literature evidence, agent loops, visual reasoning, reviewer packets, and domain-specific workflows across multi-day or multi-month projects. That still needs real breadth, polish, stress, and external validation.

## Why 15-25%

| Layer | Current maturity | Why it is not done |
| --- | ---: | --- |
| Trust model and receipts | 70% | The core policy is strong, but more artifact kinds and external-review flows need hardening. |
| Native math kernels | 45% | Exact arithmetic, refutation, intervals, and dimensions work; broader algebra, linear algebra, combinatorics, and theorem workflows are not mature. |
| Engine adapters | 35% | SymPy/Maxima/Z3/cvc5/Lean/Sage paths exist, but they are mostly scoped fixtures and constrained checks, not deep interactive workflows. |
| Formal proof lane | 25% | Lean proof checks and safety inspection exist; Mathlib-scale templates, proof search, hole repair, and theorem corpora remain early. |
| Agent autonomy | 30% | Run-next, validation gates, MCP, and bounded execution exist; long-running self-correcting research loops need stress tests and better policy. |
| Research UI | 20% | The workbench shell exists, but it is not yet a polished IDE that professors and students would trust as the main interface. |
| Visual reasoning | 20% | Visual artifacts, plots, maps, and renderer records exist; large editable canvases and professional proof/math visuals need depth. |
| Storage and scale | 35% | Canonical JSON, catalog indexing, events, locks, snapshots, and cleanup exist; million-artifact and multi-agent workloads are not proven. |
| Security and sandboxing | 35% | Docker/no-network reviewer paths and code-run gates exist; arbitrary execution and local host boundaries still require conservative defaults and repeated review. |
| Domain lanes | 10% | Physics, biology, sources, writing, concurrent systems, and EDA are planned or partially structured; domain-grade adapters are not built. |
| External credibility | 10% | Internal tests and release audits are strong; outside mathematicians, professors, and security reviewers have not certified the system. |

Weighted together, the current project is best described as a credible bounded verification harness with a strong architecture, not yet a mature autonomous discovery engine.

## The North Star

Truth Harness should become the local operating system for trustworthy agentic research:

```text
human objective
  -> narrow claim graph
  -> validation plan
  -> engine planner
  -> receipt/proof/SMT/CAS/source/simulation artifacts
  -> claim ledger
  -> run-next agent loop
  -> reviewer packet
  -> report, paper, or implementation decision
```

The core promise is not "AI solves everything." The promise is:

> Every serious claim is either verified, refuted, replayable, sourced, bounded, simulated with limits, reviewed, or explicitly left unverified.

## Phase 1: Private Credibility Core

Goal: make the current foundation boringly reliable.

Status: mostly underway.

Required gates:

- `npm run check` passes.
- Docker core engines pass: Maxima, Z3, cvc5.
- Strict all-engine path passes: Maxima, Z3, cvc5, Lean, Sage.
- Math credibility ladder stays green, with named capability levels in saved records.
- Engine verification ladder reports the strongest concrete external-engine level earned by Maxima, Z3, cvc5, Lean, and SageMath evidence.
- Exact, symbolic, and SMT closure reports stay green.
- Release audit can explain exactly why the project is or is not ready.
- Code-run and MCP stay fail-closed unless policy explicitly allows them.
- Workspace cleanup, archive, restore, and catalog rebuild paths are dependable.

Why it matters: this is the floor that keeps Hacker News, professors, and security-minded developers from dismissing the project as an AI wrapper.

## Phase 2: Professor-Grade Math Workbench

Goal: make mathematicians respect the tool.

Required product capabilities:

- named math benchmark levels: native exact arithmetic/refutation/unit/boundary levels now exist; next add high-school algebra, undergraduate algebra, discrete math, SMT encodings, Lean fixtures, and Sage fixtures
- engine-backed math levels: Maxima/Z3 core evidence, cvc5 diversity, Lean proof fixture, Sage breadth, and strict all-engine evidence are explicit reviewer stages, and saved engine-run records now expose the strongest passed level to credibility packs and release audits
- larger false-claim corpus where frontier models commonly overclaim
- Lean/mathlib workspace templates with explicit holes, theorem statements, dependencies, and repair targets
- SageMath adapter records for constrained number theory, algebra, combinatorics, exact linear algebra, and graph theory
- proof attempt history that helps agents continue without repeating failed work
- claim graph UI that feels like math as a codebase
- reports that make proof boundaries obvious to a skeptical professor

Readiness claim after this phase:

Truth Harness is a serious local workbench for scoped math verification, teaching, and agent-assisted formalization. It still does not claim frontier theorem discovery.

## Phase 3: Autonomous Research Harness

Goal: agents can work for hours without losing the thread or inventing fake progress.

Required capabilities:

- run-next reliably prioritizes the highest-value open validation gate
- agent loops can execute bounded local actions without shell delegation
- every action writes replayable artifacts or explicit notes
- source snapshots and workspace revisions prevent drift blindness
- model-context packets record exactly what leaves the machine
- activity logs show human, CLI, MCP, API, and agent actions in one timeline
- recovery commands are generated when a handoff drifts
- one-hour and multi-hour stress runs can be replayed and audited

Readiness claim after this phase:

Truth Harness can be used as a serious local harness for supervised autonomous research on bounded problems. It still requires human review and domain experts.

## Phase 4: Deep Engine Breadth

Goal: stop being a narrow math harness and become the router for many proof and compute engines.

Priority adapters:

1. Lean/mathlib proof workflows
2. SageMath constrained records
3. cvc5 and Z3 independent SMT routes
4. rigorous numerics with error bounds
5. local RAG/source citation with entailment warnings
6. notebook and simulation provenance
7. Graphviz/Plotly/Matplotlib/Sage visual artifacts
8. optional Coq/Isabelle, Arb/FLINT, and domain solvers when justified

Readiness claim after this phase:

Truth Harness becomes a real Wolfram/Sage/Lean/Z3 coordination layer, not because it replaces those engines, but because it records what each engine actually proved or failed to prove.

## Phase 5: Research IDE And Teaching Layer

Goal: make the human experience good enough that professors, students, researchers, and builders want to live inside it.

Required capabilities:

- polished desktop-first UI
- fast search across claims, tags, receipts, notes, and routes
- claim graphs, branch maps, and lineage views that scale
- editable research canvases linked to evidence
- visual math modes that teach without hiding rigor
- notes and reports attached to claims and sessions
- print/export packets for professors, peer review, and papers
- no clipping, nested-scroll traps, or broken focus states in core views

Readiness claim after this phase:

Truth Harness is not just an engine. It is a humane research IDE.

## Phase 6: Concurrent Rust Systems Showcase

Goal: use verified systems work as the viral developer proof.

Do not start by building a whole game engine. Start by verifying small systems properties:

- scheduler invariants
- lock/resource ordering
- ECS access conflicts
- bounded deadlock models
- deterministic replay constraints
- differential fuzzing against simple reference models

Truth Harness should route these through:

- sandbox boundary checks
- SMT/model-check artifacts
- optional cvc5/Z3 diversity
- Lean proofs for exact invariants
- benchmark records for performance claims

Launch-quality demo:

> "I built a tiny concurrent Rust engine core and Truth Harness caught a deadlock/data-race model before the AI agent shipped it."

Readiness claim after this phase:

Truth Harness can supervise agentic systems engineering on scoped concurrency claims. It is still not a full graphics engine.

## Phase 7: Hardware And EDA Lane

Goal: aim at venture-scale formal verification without fake chip-design claims.

Start with scoped artifacts:

- Verilog/SystemVerilog/RTL files
- property specs
- formal-equivalence records
- SMT/model-check outputs
- bounded counterexample traces
- assumptions and tool versions
- replay commands

Truth Harness should never claim tape-out safety. It should say:

> This HDL/RTL property was checked under these assumptions by this formal tool, with this result, and this replay command.

Readiness claim after this phase:

Truth Harness becomes a credible local evidence layer for AI-assisted hardware verification. Enterprise value starts here, but only after real formal-tool adapters and expert review.

## Phase 8: Science Domains

Goal: support physics, biology, materials, energy, climate, and medicine without overclaiming.

Required guardrails:

- simulations are computational evidence, not reality
- literature hits are citations, not truth
- biological hypotheses are not wet-lab findings
- medical workflows require expert, preclinical, clinical, and regulatory review
- patent workflows produce provenance and drafts, not legal certainty

Readiness claim after this phase:

Truth Harness can organize evidence for scientific research and help agents avoid hallucinated certainty. It cannot replace experiments, reviewers, clinicians, regulators, or patent attorneys.

## Phase 9: Public Launch

Do not launch on hype. Launch on a crisp, reproducible story.

Launch gates:

- strict Docker reviewer flow passes
- public demo catches real AI mistakes
- README quickstart works in under a minute for the basic path
- release audit is understandable
- UI has a saved clean browser review
- professor credibility packet is exportable
- false-claims benchmark is public and replayable
- security boundaries are plain and conservative

The viral story should be:

```text
AI confidently says a false math claim.
Truth Harness refutes it with a replayable receipt.
AI asks for a stronger claim.
Truth Harness routes it to SMT/CAS/Lean or honestly says unverified.
Every step is local, inspectable, and reproducible.
```

## What Not To Do Yet

- Do not build a full game engine before the verifier loop is strong.
- Do not build EDA as a product before scoped RTL/property records exist.
- Do not claim biomedical discovery.
- Do not expose arbitrary Sage, Python, or shell execution as a trusted path.
- Do not let planned adapters influence trust labels.
- Do not launch publicly before the UI and reviewer packets are hard to embarrass.

## The Moat

The moat is not one math engine.

The moat is the combination of:

- local-first privacy
- conservative trust labels
- replayable artifacts
- engine-aware routing
- claim graphs and supersession
- validation-gated autonomy
- Docker reviewer evidence
- professor-readable reports
- refusal to overclaim

Most AI tools optimize for fluent answers. Truth Harness should optimize for claims that survive inspection.

## Near-Term Recommended Work

1. Add harder exact/Sage/Lean fixtures on top of the named math credibility ladder levels.
2. Build a small Lean/mathlib template workflow with hole tracking and proof repair packets.
3. Add constrained SageMath fixtures beyond one symbolic identity.
4. Stress test one-hour agent loops using run-next, validation plans, and workspace revisions.
5. Continue UI hardening around claim graphs, search, notes, reports, and visual artifacts.
6. Build a public false-claims corpus that catches fluent AI math failures.
7. Keep release audit and professor credibility packets as the source of truth for readiness.

## Bottom Line

Truth Harness is close to proving that the architecture is right.

It is not close to proving that it can solve the world's hardest problems.

That gap is not discouraging. It is the actual work. The correct path is to keep turning ambitious claims into smaller gates, then make agents close those gates with evidence instead of vibes.

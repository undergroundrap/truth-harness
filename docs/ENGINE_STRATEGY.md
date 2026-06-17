# Truth Harness Engine Strategy

Date: 2026-06-12

## Short Answer

Truth Harness is building its own engine, but the engine is not a monolithic replacement for Lean, Z3, SymPy, SageMath, Jupyter, or every simulator.

The engine Truth Harness owns is the local verification operating system:

- problem normalization
- verifier routing
- trust-label policy
- receipt generation
- evidence graph construction
- claim-ledger finalization gates
- workspace validation
- model-context disclosure
- replay, benchmark, snapshot, and report contracts
- agent-facing CLI/MCP/API/web surfaces

Specialized solvers remain specialized solvers. Truth Harness decides when to call them, what their output means, how much trust that output earns, where the artifact is stored, how it can be replayed, and whether an agent is allowed to build a stronger claim from it.

## What We Own

Truth Harness should own the parts that make the product unique and defensible:

1. **Truth policy**
   The rules that decide when a claim is `unverified`, `refuted`, `exact-computed`, `smt-checked`, `cross-checked`, or `proved`.

2. **Claim ledger**
   The git-like structure for claims, dependencies, supersession, tags, evidence refs, open checks, and final report boundaries.

3. **Receipt runtime**
   The deterministic artifact format for every computation, proof check, solver run, citation, simulation, notebook run, code run, benchmark, and expert review.

4. **Verifier router**
   The planner that chooses the smallest suitable verifier first, escalates to stronger engines only when needed, and refuses stronger trust when the evidence is weak.

5. **Local-first workspace**
   The private project store, schemas, validation, snapshots, disclosures, vaults, and replay commands.

6. **Agent harness**
   The CLI/MCP/API contract that lets Claude, Codex, local models, and humans work against the same evidence layer.

7. **Teaching and explanation layer**
   Audience-level explanations generated only from verified traces, with middle-school through expert modes grounded in the receipt graph.

8. **Benchmark harness**
   Reproducible suites that measure answer correctness, trust-label correctness, routing choices, replay stability, and overclaim behavior.

These pieces are the product. They are not available by simply installing a CAS or proof assistant.

## What We Should Adapt

Truth Harness should adapt mature engines when they are already world-class:

| Need | Preferred strategy |
| --- | --- |
| Formal proof checking | Lean first; later Coq/Isabelle adapters if justified. |
| SMT/constraint solving | Z3 by default; optional cvc5 for second-solver checks and independent-SMT route obligations. |
| Symbolic CAS | SymPy now; SageMath/Maxima as independent cross-checks; WolframAlpha only as explicit external disclosure. |
| Numeric computing | Conservative interval/rational kernels now; Arb/MPFI or similar later for rigorous numerics. |
| Notebooks/scripts | Record provenance and replay commands; do not pretend notebook output is proof. |
| Literature/RAG | Local lexical/vector adapters that create citation receipts; external APIs only through disclosure records. |
| Simulation | Record model, parameters, assumptions, uncertainty, validation boundary, and replay; domain engines remain adapters. |

Adapters must be boring, typed, replayable, and replaceable. Truth Harness should never depend on one external engine as an oracle.

Reviewer gates should make that independence explicit. Daily local checks can use the faster Docker-core route of Maxima plus Z3, while `--require-all-engines` is the stricter professor/auditor mode: Maxima, Z3, cvc5, Lean, and SageMath must each earn their own scoped fixture evidence before the engine packet is marked ready under that standard. Passing this gate proves engine evidence for representative fixtures only; individual claims still need their own receipts, routes, and satisfied obligations.

For Lean specifically, the adapter path is staged: inspect the local Lean/Lake project layout without execution, run concrete proof checks only on workspace-local source artifacts, write proof-check records, and generate proof visuals from those records. A Lean project inspection or visual artifact is useful evidence context, but only an accepted proof-check record can support `proved`.

For visual systems, the adapter path is also staged. Truth Harness should not keep hand-drawing fake canvases as the source of truth. Engine-backed visuals should be written as `truth-harness.visual-artifact.v0` records: Mermaid/Graphviz specs from workspace lineage, Plotly/Matplotlib/Sage-ready plot specs from receipts, tldraw-style canvas JSON from workspace graphs, and later renderer output from real theorem prover, notebook, simulation, or plotting engines. The artifact records carry the renderer, payload, renderer source with a hash, source refs, exact data table where available, replay command, and trust boundary. Renderer output is a second artifact, not a mutation of the source: `truth-harness visual render <visual_id> --engine graphviz` currently accepts only saved DOT source, rejects external refs, runs local `dot -Tsvg` without a shell, sanitizes SVG output, and writes a linked SVG artifact. The UI may render a native preview, but the reusable renderer source, renderer output, and source refs are the professional handoff for papers, reports, agents, and future renderer containers.

## Future Simulation And Rust Bridge

Truth Harness is not a graphics engine, robotics engine, or physics simulator today. The credible long-term path is to make the current verification layer strict enough that future Rust simulation kernels, robotics math, neural-rendering pipelines, and AI-generated optimization code can plug into it without weakening the trust model.

The engine manifest is the first machine-readable contract for that path. Every capability now reports:

- a determinism class: strict deterministic, replay deterministic, environment measured, provenance only, or planned,
- primitive semantics: exact rational, bounded search, dimension vector, SMT-LIB, formal proof, symbolic expression, sandbox measurement, simulation provenance, and similar narrow meanings,
- replay requirements,
- drift risks,
- an agent-friendly JSON contract with stable ids and structured diagnostics.

This keeps three future guardrails visible in the current product:

1. **Strict determinism first.** Exact local primitives and proof/smt/cas records must be replayable before an agent is allowed to build on them. Floating-point, simulation, notebook, or neural output must record version, seed, environment, parameters, precision, and uncertainty before it becomes evidence.
2. **AI-parser-friendly failures.** A code-generation model should be able to read the JSON route, understand which primitive failed, generate a narrower fix, and rerun the verifier without relying on prose chat memory.
3. **Primitive modularity.** The same contract that handles exact fractions should later handle vectors, matrices, geometry, units, intervals, solver encodings, proof artifacts, and simulation states as composable evidence nodes.

Future Rust work should follow the same ladder: prove or specify critical math where possible, generate or hand-write Rust kernels, run differential fuzzing against trusted engines, record replayable benchmark artifacts, and refuse to label stochastic or simulation output as truth. A differential fuzzing oracle is evidence of agreement over a domain, not formal proof. A Lean proof artifact can support `proved` only for the encoded theorem. A Rust benchmark can support performance and replay claims, not scientific validity by itself.

## Native Kernels We Should Build

We should build small native kernels when they are:

- simple enough to audit,
- central to trust policy,
- useful offline,
- easy to test exhaustively or with property tests,
- good as teaching traces,
- hard to obtain cleanly from a subprocess without losing provenance.

Good native kernels:

- exact rational arithmetic
- expression parser and normalizer for the supported grammar
- arithmetic step traces
- finite counterexample search for narrow quantified forms
- dimensional analysis and unit algebra
- conservative interval arithmetic
- bounded integer/domain enumerators
- trust-label ranking and finalization gates
- evidence-reference resolution
- replay hash and provenance validation

Bad native-kernel candidates right now:

- full CAS
- full proof assistant
- full SMT solver
- full notebook engine
- full vector database
- full molecular simulation stack
- full patent search engine
- full scientific database crawler

Those would bury the project before the product loop is proven.

## The Verifier Ladder

The engine should escalate through verifiers like this:

```text
normalize problem
  -> exact local kernel if supported
  -> finite refutation / counterexample search
  -> symbolic CAS
  -> independent CAS cross-check
  -> SMT encoding and solver check
  -> formal proof-check artifact
  -> source/literature citation receipt
  -> simulation / experiment / notebook provenance
  -> expert review / validation plan
  -> claim ledger finalization
```

Not every problem uses every rung. The router should choose the smallest verifier that can honestly answer the narrow claim.

## Trust Rules

Truth Harness must keep these rules stable:

1. **AI output never creates truth by itself.**
2. **A backend availability probe never creates evidence.**
3. **A notebook/code run proves only that the run happened under the recorded policy.**
4. **A source hit means `source-cited`, not proved.**
5. **An SMT result means `smt-checked` for the encoded constraints, not formal proof of surrounding informal claims.**
   Normal verifier routes can require one concrete SMT artifact; reviewer routes can require separate Z3 and cvc5 obligations so solver-diverse evidence is visible without pretending either solver proves the informal statement.
6. **Only accepted proof-checker output can mint `proved`.**
7. **A refuting artifact dominates stronger positive labels until the claim is narrowed or superseded.**
8. **Claim trust must be derived from resolvable local evidence, not a requested label.**

## Why This Is Better Than Just Connecting Engines

A raw engine gives an answer.

Truth Harness gives:

- the normalized claim,
- which engine ran,
- exact inputs and outputs,
- replay command,
- trust boundary,
- limitations,
- evidence graph,
- claim ledger placement,
- dependency links,
- supersession history,
- validation gaps,
- exportable report,
- agent-readable local artifacts.

That is the missing layer between Claude/Codex, WolframAlpha-style answer engines, proof assistants, notebooks, lab notebooks, and human researchers.

## Why This Is Better Than Building Everything From Scratch

Rebuilding all engines would be slower, weaker, and less credible.

Serious researchers will trust a system faster when it can say:

> This claim is not trusted because our AI likes it. It is trusted because the local receipt links to a concrete Z3/Lean/SymPy/native-kernel run, records the exact artifact, and prevents the claim from outrunning that evidence.

Truth Harness should be judged by how well it coordinates, constrains, records, and audits engines, not by pretending it can replace decades of proof-assistant and CAS work in one repo.

## Roadmap

Phase 1: Native trust core

- exact rational arithmetic
- counterexample-first universal checks
- dimensional analysis
- bounded intervals
- receipt validation
- claim-ledger finalization gates
- workspace validation
- benchmark suites

Phase 2: Adapter portfolio

- SymPy symbolic adapter
- Z3 SMT adapter
- Lean proof-check adapter
- Maxima/Sage independent CAS cross-checks
- cvc5 SMT adapter
- local literature/RAG adapters

Phase 3: Agentic router

- typed problem classification
- engine capability manifests
- automatic verifier selection
- fail-closed trust upgrades
- recursive claim decomposition
- replay-based agent loops
- UI-visible activity and evidence graph

Phase 4: Research IDE

- lane-specific workflows for math, physics, biology, hardware, quantum, code, finance, writing, and sources
- report export with claim citations
- playback and session recording
- package export for peer review
- benchmark leaderboards
- plugin/adapter SDK

## Engineering Rule

Build native kernels for small, auditable truth-preserving primitives.

Use proven external engines for deep domain computation.

Make Truth Harness own the evidence loop that turns engine output into trustworthy, replayable, local research artifacts.

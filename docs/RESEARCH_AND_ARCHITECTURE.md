# Theorem Workbench Research And Architecture

Date: 2026-06-08

## Name Check

Theorem Workbench means two things:

1. A workbench for doing verified math with AI agents.
2. A benchmark harness for measuring whether agents, tools, prompts, and solver portfolios actually produce trustworthy math.

Working repo/package name: `theorem-workbench`.
Display brand: `Theorem Workbench`.
Suggested subtitle: `Verified Math for AI Agents`.

Direct checks performed on 2026-06-08:

| Surface | Query | Result |
| --- | --- | --- |
| GitHub exact repository search | `theorem-workbench` | 0 exact matches |
| npm registry | `https://registry.npmjs.org/theorem-workbench` | 404 |
| PyPI | `https://pypi.org/pypi/theorem-workbench/json` | 404 |
| crates.io | `https://crates.io/api/v1/crates/theorem-workbench` | 404 |
| Collapsed spelling checks | `theoremworkbench` | No exact GitHub user/org or package hits found |

Broader risk: `theorem workbench` has adjacent academic/theorem-prover phrase collisions, including older projects such as Tableau Workbench and SPASS Workbench. That is acceptable because there was no exact `theorem-workbench` or `theoremworkbench` product/package collision in the checks. Use the hyphenated package/repo name `theorem-workbench`, and use `Theorem Workbench` as the display brand.

Brand/subtitle options:

| Name | Why |
| --- | --- |
| Theorem Workbench: Verified Math for AI Agents | Best public positioning. |
| Theorem Workbench: Agentic Math Workbench | Strong fit for Claude/Codex usage. |
| Theorem Workbench: Proof And Computation Lab | Explains scope without narrowing to benchmarks only. |
| Theorem Workbench: Auditable Math For Agents | Sharp differentiator. |

Trademark note: this is a developer-name availability check, not legal clearance.

## Relevant Prior Art

Do not fork one large repo as the foundation. The better strategy is a small, stable orchestration core with adapters around proven tools.

| Project | Use |
| --- | --- |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | Primary MCP server/client implementation path. Official SDK docs list TypeScript as Tier 1, while Rust is Tier 2. |
| [MCP Rust SDK](https://github.com/modelcontextprotocol/rust-sdk) | Later candidate for a hardened local executor or high-throughput service. |
| [SecretiveShell/MCP-wolfram-alpha](https://github.com/SecretiveShell/MCP-wolfram-alpha) | Minimal WolframAlpha MCP bridge. Good inspiration, not enough as the core product. |
| [oOo0oOo/lean-lsp-mcp](https://github.com/oOo0oOo/lean-lsp-mcp) | Strong Lean MCP integration: diagnostics, goals, hover info, theorem search. Prefer integration or adapter over rebuilding Lean LSP. |
| [LeanDojo/ReProver](https://github.com/lean-dojo/ReProver) | Retrieval-augmented proof search pattern for Lean. Use as research inspiration for proof search loops. |
| [lean-dojo/LeanCopilot](https://github.com/lean-dojo/LeanCopilot) | Native Lean LLM proof automation ideas: tactic suggestions, premise search, local/cloud models. |
| [SageMath](https://github.com/sagemath/sage) | Main open-source CAS bundle. Use as a subprocess/container adapter, not an embedded dependency. |
| [SymPy](https://docs.sympy.org/) | Lightweight exact symbolic math adapter, especially for MVP. |
| [Z3](https://www.microsoft.com/en-us/research/project/z3-3/) and [cvc5](https://cvc5.github.io/docs/cvc5-1.1.2/) | SMT and counterexample engines for constraints, satisfiability, and finite model checks. |
| [shinpr/mcp-local-rag](https://github.com/shinpr/mcp-local-rag) | Local-first hybrid RAG MCP patterns. |
| [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | Self-hostable research assistant and second-brain UX inspiration. AGPL license means copy carefully. |
| [root-mcp](https://pypi.org/project/root-mcp/) | Good pattern: MCP server and human CLI share one backend. |
| [pytest-mcp-plugin](https://pypi.org/project/pytest-mcp-plugin/) | Strong MCP test harness inspiration: subprocess testing, conformance, security packs, wire traces. |

## Core Product Thesis

AI should plan and explain. Verification engines should decide what is trusted.

The system should never return a naked answer when it can return:

1. A normalized problem statement.
2. A claim graph.
3. Tool/proof/citation evidence for each claim.
4. Replay commands and artifacts.
5. A trust label for every result.

Trust labels:

| Label | Meaning |
| --- | --- |
| `proved` | Accepted by Lean or another proof checker. |
| `exact-computed` | Derived by exact arithmetic or symbolic CAS with replayable inputs. |
| `bounded-numeric` | Verified by intervals, error bounds, precision controls, or independent numeric checks. |
| `smt-checked` | Checked by an SMT solver, often with satisfiable/unsatisfiable/counterexample output. |
| `dimension-checked` | Physical dimensions/units are consistent; this is not a proof of the model or equation. |
| `source-cited` | Grounded in retrieved source material, with citation metadata. |
| `cross-checked` | Multiple independent tools agree on a normalized result. |
| `unverified` | Generated or inferred, but not yet backed by a trusted tool. |
| `refuted` | Counterexample or proof failure invalidates the claim. |

## Architecture

Use a TypeScript monorepo first. Add Rust only for isolated performance or sandbox-critical components.

Recommended layout:

```text
theorem-workbench/
  apps/
    cli/                  # Human CLI: ask, compute, prove, verify, replay, doctor
    web/                  # Optional Vite/React workbench
  packages/
    core/                 # Claim graph, trust model, scheduler, artifact store
    mcp-server/           # MCP tools/resources/prompts over the core
    adapters/             # Wolfram, SymPy, Sage, Lean, Z3, cvc5, RAG, units
    benchmarks/           # Benchmark definitions, scoring, datasets, reports
    rag/                  # Hybrid retrieval, chunking, citations, indexes
    lessons/              # Learning-mode explanations and exercise generation
    testkit/              # Fixtures, golden traces, fake adapters
  crates/
    executor/             # Optional later Rust process runner/sandbox/cache worker
  docs/
    research/
    architecture/
    findings/
```

Dependency posture:

| Layer | First choice |
| --- | --- |
| MCP | TypeScript SDK v1.x until v2 stabilizes. |
| CLI | TypeScript with `commander` or `clipanion`, `zod`, structured JSON output. |
| Tests | `vitest` for core, Playwright for web, protocol tests inspired by `pytest-mcp-plugin`. |
| Storage MVP | SQLite plus filesystem artifact store. |
| RAG MVP | Hybrid BM25 plus vector abstraction; pluggable Qdrant/LanceDB later. |
| CAS MVP | SymPy via subprocess adapter; optional WolframAlpha API adapter. |
| Proof MVP | Lean adapter through existing Lean MCP/LSP project or subprocess wrapper. |
| SMT MVP | Z3 adapter, then cvc5 adapter. |

## Benchmarking Capability

Build benchmarking in from the start, but keep it honest. The benchmark harness should evaluate the complete verification pipeline, not merely whether an LLM wrote a plausible answer.

Benchmark task types:

| Task | Measures |
| --- | --- |
| `answer` | Exact final-answer correctness for arithmetic, algebra, calculus, and discrete math. |
| `derivation` | Whether intermediate steps are valid and replayable. |
| `formal-proof` | Lean/proof-checker success, failed tactic recovery, and proof artifact quality. |
| `counterexample` | Ability to refute false claims quickly. |
| `constraint` | SMT satisfiable/unsatisfiable accuracy and model extraction. |
| `retrieval-grounded` | Whether cited sources support the claim under the stated assumptions. |
| `explanation` | Whether the generated lesson follows verified steps without adding unverified claims. |
| `tool-routing` | Whether the system chose the right engine for the problem class and trust target. |

Benchmark metrics:

| Metric | Why |
| --- | --- |
| Trust accuracy | Final trust label matches available evidence. |
| Proof success rate | Formal statements compile and proofs verify. |
| Refutation rate | False claims get counterexamples instead of polished nonsense. |
| Exactness rate | Symbolic/exact problems do not silently degrade into approximate answers. |
| Replay stability | Re-running the same graph reproduces the same trusted result. |
| Cross-check agreement | Independent tools agree after normalization. |
| Cost and latency | Agents need practical budgets, not only correctness. |
| Assumption hygiene | The system exposes hidden assumptions and variable domains. |
| Explanation faithfulness | Teaching output stays grounded in verified graph nodes. |

Initial benchmark suites:

| Suite | Scope |
| --- | --- |
| `foundations-100` | Arithmetic, algebra, fractions, units, simple proofs. |
| `calculus-100` | Limits, derivatives, integrals, series, differential equations. |
| `linear-algebra-75` | Matrices, eigenvalues, vector spaces, proofs and computations. |
| `number-theory-75` | Modular arithmetic, divisibility, primality, Diophantine examples. |
| `false-claims-100` | Plausible but false claims designed to force counterexamples. |
| `lean-smoke-50` | Small Lean theorems with expected proof outcomes. |
| `rag-citation-50` | Source-grounded theorem/history/formula questions. |

CLI shape:

```text
theorem bench run suites/foundations-100 --engine local --json
theorem bench compare runs/baseline.json runs/current.json
theorem bench report runs/current.json --format markdown
theorem bench add "prove n^2+n is even" --suite foundations-100 --expect proved
```

This makes Theorem Workbench useful for:

1. Regression testing the app itself.
2. Comparing Claude/Codex prompting strategies.
3. Comparing solver portfolios.
4. Building a public leaderboard later, if the project earns that shape.

## Data Structures

Everything should be modeled as a content-addressed run graph. The graph is the product.

Core node types:

```ts
type TrustLabel =
  | "proved"
  | "exact-computed"
  | "bounded-numeric"
  | "smt-checked"
  | "source-cited"
  | "cross-checked"
  | "unverified"
  | "refuted";

type NodeKind =
  | "problem"
  | "normalized_problem"
  | "claim"
  | "plan"
  | "tool_run"
  | "proof"
  | "computation"
  | "counterexample"
  | "source"
  | "explanation"
  | "lesson"
  | "artifact";

interface GraphNode<T = unknown> {
  id: string;              // content hash
  kind: NodeKind;
  createdAt: string;
  payload: T;
  trust: TrustLabel;
  summary: string;
  artifactRefs: string[];
}

interface GraphEdge {
  from: string;
  to: string;
  relation:
    | "depends_on"
    | "derives"
    | "supports"
    | "refutes"
    | "uses"
    | "explains"
    | "replays";
}
```

Important algorithms:

| Algorithm | Purpose |
| --- | --- |
| Canonicalization | Normalize expressions, units, assumptions, variable names, and tool inputs before hashing. |
| Merkle hashing | Make run artifacts reproducible and deduplicated. |
| Evidence join | Merge claims only when normalized expressions and assumptions match. |
| Counterexample search | Prefer falsification before expensive proof search. |
| Budgeted recursive search | Bound depth, wall time, token use, tool calls, and branching factor. |
| Solver portfolio routing | Choose CAS, SMT, Lean, numeric, RAG, or Wolfram based on problem class and required trust. |
| Deterministic replay | Re-run a graph from stored tool inputs, versions, and environment fingerprints. |
| Regression diffing | Compare new runs against golden graphs and flag changed trust labels or result values. |

## Tool Adapter Contract

Every adapter should be boring, typed, and replayable.

```ts
interface ToolAdapter<Input, Output> {
  id: string;
  version(): Promise<ToolVersion>;
  capabilities(): ToolCapability[];
  normalize(input: Input): Promise<NormalizedInput>;
  execute(input: NormalizedInput, ctx: ToolContext): Promise<ToolResult<Output>>;
  verify?(result: ToolResult<Output>, ctx: ToolContext): Promise<VerificationResult>;
}
```

Adapter rules:

1. No adapter writes outside its artifact directory.
2. All inputs and outputs are stored as JSON plus raw artifacts.
3. Environment fingerprints include tool version, OS, command path, package lock/hash, and relevant config.
4. Network adapters are disabled in offline mode.
5. Adapters return structured errors, never prose-only failures.

## MCP Surface

Initial MCP tools:

| Tool | Purpose |
| --- | --- |
| `theorem_ask` | Full plan, compute, verify, explain pipeline. |
| `theorem_verify_claim` | Verify one mathematical/factual claim. |
| `theorem_compute_exact` | CAS-backed symbolic/exact computation. |
| `theorem_smt_check` | Constraint satisfiability and counterexample search. |
| `theorem_prove_lean` | Compile/check Lean statements or proof attempts. |
| `theorem_rag_ingest` | Ingest PDFs, Markdown, notes, papers, or local docs. |
| `theorem_rag_search` | Retrieve relevant context with citations. |
| `theorem_replay` | Replay a previous graph/run. |
| `theorem_get_artifact` | Return stored proof, plot, notebook, trace, or source chunk. |
| `theorem_lesson` | Turn a verified solution into an adaptive lesson. |
| `theorem_benchmark_run` | Run benchmark suites against a configured engine/profile. |
| `theorem_benchmark_compare` | Compare benchmark runs and flag trust/correctness regressions. |

Initial MCP resources:

| Resource | Purpose |
| --- | --- |
| `theorem://runs/{runId}` | Run graph and trust summary. |
| `theorem://benchmarks/{benchmarkRunId}` | Benchmark summary, scores, regressions, and artifacts. |
| `theorem://artifacts/{artifactId}` | Tool output, proof file, trace, plot, or citation bundle. |
| `theorem://corpus/{docId}` | Ingested document metadata and chunks. |
| `theorem://lessons/{lessonId}` | Learning-mode material generated from verified steps. |

Initial MCP prompts:

| Prompt | Purpose |
| --- | --- |
| `verify-before-answering` | Forces Claude/Codex to call tools before final math claims. |
| `formalize-problem` | Converts natural language into assumptions, variables, and claims. |
| `explain-verified-solution` | Generates student-facing explanations from graph nodes. |
| `research-loop` | Bounded recursive investigation with document updates. |

## CLI Surface

CLI must cover the whole backend without the UI.

```text
theorem ask "integrate x^2 sin x from 0 to pi" --trust exact --explain
theorem verify "for all n, n^2+n is even" --lean
theorem compute "factor x^4 - 1" --engine sympy --json
theorem smt examples/constraints.smt2 --counterexample
theorem rag ingest ./papers --collection math
theorem rag search "Fourier transform convolution theorem" --collection math
theorem replay runs/2026-06-08/example.truthrun.json
theorem lesson runs/example --level algebra-1
theorem bench run suites/foundations-100 --profile local
theorem mcp --transport stdio
theorem doctor
```

CLI output modes:

| Mode | Use |
| --- | --- |
| Human | Pretty terminal with concise trust labels and next actions. |
| JSON | Agent and test consumption. |
| JSONL trace | Long-running recursive jobs. |
| Markdown | Findings reports and learning notes. |

## Human Interface

The UI should be an actual workbench, not a landing page.

Primary panes:

1. Problem input and assumptions.
2. Claim graph with trust labels.
3. Step inspector showing exact tool input/output.
4. Source/citation panel.
5. Learning panel with prerequisites, explanations, and generated exercises.
6. Replay and diff panel for regression-style math work.

Key interaction rule: the user can click any answer and see why the system believes it.

## Recursive Claude/Codex Workflow

Recursive work must be bounded and document-producing.

Loop:

1. Formalize the user goal into claims and assumptions.
2. Search local corpus and known theorem/library indexes.
3. Try cheap refutation first.
4. Route subclaims to CAS, SMT, Lean, RAG, or Wolfram.
5. Store every result in the graph.
6. Summarize findings into `docs/findings/YYYY-MM-DD-topic.md`.
7. Propose next subclaims only when new evidence changed the graph.
8. Stop on budget, proof, refutation, or no-progress threshold.

Budgets:

| Budget | Default |
| --- | --- |
| Max recursion depth | 4 |
| Max branches per node | 5 |
| Max wall time | 10 minutes local MVP |
| Max tool calls | 100 per run |
| Max proof attempts per theorem | 32 MVP, configurable |
| Max unverified final claims | 0 for strict mode |

## Test Strategy

The test suite should be part of the core identity, not an afterthought.

Unit tests:

- Expression canonicalization.
- Claim graph hashing.
- Trust label transitions.
- Adapter input schema validation.
- Budgeting and scheduler behavior.
- Citation span accounting.

Property tests:

- Algebraic identities over random small polynomials.
- Unit conversions round-trip.
- Rational arithmetic exactness.
- Graph replay idempotence.

Golden regression tests:

- A small corpus of solved problems from arithmetic through calculus, linear algebra, number theory, and logic.
- Store expected graph shape, trust labels, normalized result, and key artifacts.
- Fail on trust downgrades unless explicitly approved.

Headless MCP tests:

- List tools/resources/prompts.
- Call every tool with valid and invalid inputs.
- Verify JSON schema stability.
- Exercise stdio and HTTP transports.
- Save JSONL wire traces on failure.

CLI tests:

- `--help` for every command.
- Human output snapshot.
- JSON output schema.
- Non-zero exits on unverified strict-mode answers.
- Offline mode blocks network adapters.

Security tests:

- Path traversal.
- Symlink escape.
- Command injection in tool adapters.
- Environment variable leakage.
- Network disabled mode.
- Artifact root enforcement.
- Long-running process timeout and cancellation.

UI tests once `apps/web` exists:

- Playwright smoke for desktop and mobile.
- Rendered math is visible.
- Claim graph loads from a fixture run.
- Clicking a claim opens its evidence.
- No overlapping text in core panes.

## Build Roadmap

Phase 0: Research and skeleton

- Keep this document current.
- Create pnpm workspace.
- Add TypeScript core package.
- Define graph, trust labels, adapter interface, and artifact store.

Phase 1: Local MVP

- CLI plus MCP stdio server.
- SymPy subprocess adapter plus JS exact arithmetic evaluator.
- Simple local RAG index.
- Deterministic graph replay.
- Golden tests for 25 basic-to-intermediate problems.
- Benchmark harness with `foundations-100` seed format and scoring.

Phase 2: Verification depth

- Z3 adapter.
- Lean adapter through `lean-lsp-mcp` or a subprocess wrapper.
- WolframAlpha optional adapter.
- Cross-checking and counterexample-first routing.

Phase 3: Learning workbench

- Vite/React UI.
- Claim graph visualization.
- Step inspector.
- Lesson mode from verified graph nodes.

Phase 4: Research mode

- Bounded recursive Claude/Codex workflows.
- Findings docs auto-updated from run graphs.
- Long calculations with checkpoint/resume.
- Corpus-aware theorem search and proof attempt loops.

## Decision

Build the repo as TypeScript-first with modular adapters. Use Rust later for isolated executor pieces if benchmarks or sandboxing demand it. Do not implement a CAS, theorem prover, vector database, or notebook engine from scratch. The differentiator is the evidence graph and the agent-native verification workflow.

# Truth Harness Research And Architecture

Date: 2026-06-08

## Name Check

Truth Harness means one product idea:

1. A local harness for routing claims through evidence, replay, and verification.
2. A workbench for humans and agents to organize long mathematical, scientific, code, source, and simulation investigations.

Working repo/package name: `truth-harness`.
Display brand: `Truth Harness`.
Suggested subtitle: `Verified Math for AI Agents`.
Current namespace: the CLI command, package scope, schemas, MCP tool names, Docker service, and local store use `truth-harness` / `.truth-harness`. The pre-public prototype does not preserve the old naming namespace.

Legacy direct checks performed for the prior `truth-harness` name on 2026-06-08:

| Surface | Query | Result |
| --- | --- | --- |
| GitHub exact repository search | `truth-harness` | 0 exact matches |
| npm registry | `https://registry.npmjs.org/truth-harness` | 404 |
| PyPI | `https://pypi.org/pypi/truth-harness/json` | 404 |
| crates.io | `https://crates.io/api/v1/crates/truth-harness` | 404 |
| Collapsed spelling checks | `theoremworkbench` | No exact GitHub user/org or package hits found |

Broader risk: generic workbench language has adjacent academic and proof-assistant phrase collisions, including older projects such as Tableau Workbench and SPASS Workbench. The move to `truth-harness` should get fresh GitHub, npm, PyPI, crates.io, domain, and trademark-adjacent checks before public launch.

Brand/subtitle options:

| Name | Why |
| --- | --- |
| Truth Harness: Verified Math for AI Agents | Best public positioning. |
| Truth Harness: Agentic Math Workbench | Strong fit for Claude/Codex usage. |
| Truth Harness: Proof And Computation Lab | Explains scope without narrowing to benchmarks only. |
| Truth Harness: Auditable Math For Agents | Sharp differentiator. |

Trademark note: this is a developer-name availability check, not legal clearance.

## Relevant Prior Art

Do not fork one large repo as the foundation. The better strategy is a small, stable orchestration core with adapters around proven tools.

| Project | Use |
| --- | --- |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | Primary MCP server/client implementation path. Official SDK docs list TypeScript as Tier 1, while Rust is Tier 2. |
| [MCP Rust SDK](https://github.com/modelcontextprotocol/rust-sdk) | Later candidate for a hardened local executor or high-throughput service. |
| [SecretiveShell/MCP-wolfram-alpha](https://github.com/SecretiveShell/MCP-wolfram-alpha) | Minimal WolframAlpha MCP bridge. Good inspiration, not enough as the core product. |
| [oOo0oOo/lean-lsp-mcp](https://github.com/oOo0oOo/lean-lsp-mcp) | Strong Lean MCP integration: diagnostics, goals, hover info, formal library search. Prefer integration or adapter over rebuilding Lean LSP. |
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

Truth Harness is not only a bundle of third-party solvers, and it is not a plan to rewrite every solver from scratch. The native engine is the verification operating system: problem normalization, verifier routing, trust-label policy, receipt generation, evidence graphs, claim-ledger gates, workspace validation, model disclosure, replay, benchmarks, and reports. Specialized tools such as SymPy, Z3, Lean, SageMath, Maxima, notebooks, RAG indexes, and simulators should plug into that engine as adapters with explicit trust boundaries. See [ENGINE_STRATEGY.md](ENGINE_STRATEGY.md) for the detailed boundary between native kernels and external engines.

The system should never return a naked answer when it can return:

1. A normalized problem statement.
2. A claim graph.
3. Tool/proof/citation evidence for each claim.
4. Replay commands and artifacts.
5. A trust label for every result.
6. Privacy metadata that states whether the run stayed local or disclosed data to an external service.

The moat is the claim ledger: Truth Harness treats claims as first-class local artifacts, not as loose chat messages. A claim can depend on earlier claims, supersede a mistaken claim, carry tags, attach evidence refs, expose a verifier ladder, and export a Markdown review packet. This gives long mathematical and scientific work a codebase-like structure: small claims, explicit dependencies, inspectable diffs later, and no hidden final answer detached from its evidence chain.

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

Local-first rule: the default engine must be useful without network access. Hosted model calls, hosted CAS calls, WolframAlpha, cloud vector stores, cloud simulation, or external APIs must be explicit opt-in adapters. Before anything leaves the machine, the agent should prepare a local selected-context packet, minimize/redact/exclude workspace data, record user approval, and then write local disclosure records for what was actually sent.

## Architecture

Use a TypeScript monorepo first. Add Rust only for isolated performance or sandbox-critical components.

Recommended layout:

```text
truth-harness/
  .truth-harness/      # Git-ignored local project store
    project.json           # Local-first manifest and privacy policies
    receipts/              # Receipt JSON and rendered reports
    claims/                # Claim ledger records with dependencies, supersession, tags, trust, and review gates
    artifacts/             # Tool outputs, plots, notebooks, traces
    indexes/               # Local RAG/search indexes
    literature/            # Structured local paper, patent, dataset, and database-export records
    notebook-runs/         # Local notebook/script/pipeline provenance records
    code-runs/             # Policy-gated local process execution records
    findings/              # Agent-produced research notes
    sessions/              # Research runbooks and checkpoints for long investigations
    reviews/               # Human expert, safety, regulatory, and legal review records
    inventions/            # Invention logs and discovery hypotheses
    benchmarks/            # Local benchmark run outputs
    model-contexts/         # Selected-context packets prepared before model/API collaboration
    disclosures/           # External model/API disclosure audit records
    simulations/           # Local simulation evidence records
    patents/               # Claim charts and patent-review drafting aids
    experiments/           # Protocol/data/observation experiment records
    vault/                 # Encrypted local envelopes for sensitive files
    audits/                # Claim evidence posture and overclaim audits
    validation/            # Validation-gate plans before stronger claims
    snapshots/             # Provenance hash manifests and drift verification checkpoints
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
    workspace/            # Optional later package for encrypted/project storage
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
| Proof MVP | Local modular parity checker first, labeled as `exact-computed`; Lean adapter through existing Lean MCP/LSP project or subprocess wrapper next for `proved`. |
| Numeric MVP | Conservative rational interval arithmetic first; Arb-backed rigorous ball arithmetic later. |
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
| `code-execution` | Whether a local command actually ran, what it output, and how replayable the process evidence is. |
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
| `rag-citation-50` | Source-grounded proof, history, and formula questions. |

CLI shape:

```text
truth-harness bench run suites/foundations-100 --engine local --json
truth-harness bench run suites/foundations-100 --write
truth-harness bench run suites/foundations-100 --fail-on-failures
truth-harness bench list
truth-harness bench compare runs/baseline.json runs/current.json --write
truth-harness bench compare runs/baseline.json runs/current.json --fail-on-regression
truth-harness bench report runs/current.json --format markdown
truth-harness bench add "check n^2+n is even" --suite foundations-100 --expect exact-computed
truth-harness proof backends --json
truth-harness proof check docs/examples/trivial.lean --fail-on-unproved --json
truth-harness proof check docs/examples/trivial.lean --write
truth-harness proof list
truth-harness smt backends --json
truth-harness smt check docs/examples/constraints.smt2 --write --json
truth-harness smt solve --int x --constraint "x > 0" --constraint "x < 3" --json
truth-harness smt list
truth-harness code sandbox-status --json
truth-harness code run "Run a tiny local code check" --command node --allow-executable node --arg -e --arg "console.log(6 * 7)" --json
truth-harness code list
```

Current benchmark-run records use `truth-harness.benchmark-run.v0` and live under `.truth-harness/benchmarks/`. They store suite metadata, runner metadata, replay command, per-case receipt ids/hashes/trust labels/backend ids, aggregate trust accuracy, failures, and warnings that benchmarks measure system behavior rather than proving the underlying tasks or downstream claims. Benchmark comparisons use `truth-harness.benchmark-comparison.v0` in the same directory and flag regressions, improvements, trust-label changes, changed receipt hashes, added/removed cases, and suite drift between recorded runs.

Current verifier-route records use `truth-harness.verifier-route.v0` and live under `.truth-harness/routes/` when `truth-harness verify <claim> --write` or MCP `truth_harness_verify` with `write: true` is used. They store the prompt, conservative final trust label, nested receipt, engine-manifest summary, used capabilities, blocked/planned verifier gaps, next actions, replay command, JSON path, and Markdown report path. `truth-harness route list/show` and MCP `truth_harness_route_list`/`truth_harness_route_show` expose those records for claim ledger refs, audits, validation plans, snapshots, research sessions, and reports. A route explains verifier selection and missing gates; it is not a proof by itself.

Current proof-check records use `truth-harness.proof-check.v0` and live under `.truth-harness/proofs/` when `truth-harness proof check <file> --write` or MCP `truth_harness_proof_check` with `write: true` is used. They store the Lean command, source path, source hash, optional declaration name, stdout/stderr, replay command, proof boundary, JSON path, and Markdown report path. `truth-harness proof list` and `truth_harness_proof_list` expose those records for audits, snapshots, research-session evidence refs, and agent follow-up.

Current SMT-check records use `truth-harness.smt-check.v0` and live under `.truth-harness/smt/` when `truth-harness smt check <file> --write`, `truth-harness smt solve`, MCP `truth_harness_smt_check` with `write: true`, or MCP `truth_harness_smt_solve` is used. They store the Z3 command, source path, source hash, optional query name, stdout/stderr, replay command, solver boundary, JSON path, and Markdown report path. `truth-harness smt solve` and `truth_harness_smt_solve` generate `.smt2` sources under `.truth-harness/smt/sources/` from explicit integer variables and constraints before checking them. When `get-model` is present and Z3 returns `sat`, records also extract simple `define-fun` model bindings into structured JSON while preserving raw stdout. `sat` and `unsat` map to `smt-checked`; missing Z3, execution errors, `unknown`, or unrecognized output stay `unverified`. `truth-harness smt list` and `truth_harness_smt_list` expose those records for audits, snapshots, research-session evidence refs, and agent follow-up.

This makes Truth Harness useful for:

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

interface PrivacyMetadata {
  mode: "local-only" | "external-calls";
  localFirst: boolean;
  networkAccess: "none" | "optional" | "required";
  dataResidency: "local-workspace";
  externalDisclosures: {
    service: string;
    purpose: string;
    dataClasses: string[];
    userInitiated: boolean;
  }[];
}

interface Receipt {
  schemaVersion: "truth-harness.receipt.v0";
  runId: string;
  problem: string;
  trust: TrustLabel;
  privacy: PrivacyMetadata;
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

## Invention And Discovery Logs

The local invention log is provenance infrastructure, not an automated patent office or a medical-claims engine.

Each `truth-harness.invention.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Title, problem, hypothesis | Human-readable invention or discovery candidate. |
| Validation stage | `idea`, `computational-hypothesis`, `simulated`, `bench-tested`, `experimentally-observed`, `preclinical`, `clinical`, or `regulatory-reviewed`. |
| Evidence refs | Links to local receipts, artifacts, notebooks, code runs, sources, simulation logs, experiment logs, benchmark runs, disclosure logs, or other supporting files. |
| Novelty and prior-art notes | Human research notes before any patent drafting. |
| Risks and next checks | Known limitations and concrete validation work. |
| Patent posture | Always marks human legal review required and `not-a-legal-opinion`. |
| Safety posture | Warns against claiming proof, medical efficacy, safety, or regulatory validity from weak evidence. |

This gives agents a disciplined place to accumulate discovery candidates for hair loss, cancer, rare disease, materials, climate, or physics work without turning computational hypotheses into fake certainty.

Discovery packages render invention logs into local Markdown reports. They review evidence refs, resolve receipt files when possible, flag missing or weak evidence, repeat validation requirements, and preserve patent/legal disclaimers. A discovery package is a review artifact, not proof of experimental validity, clinical efficacy, legal novelty, or patentability.

## Research Sessions

Research sessions are local runbooks for long agentic investigations. They are broader than invention logs: a session can track learning, pure math, code verification, physics modeling, biomedical literature review, simulation pipelines, patent exploration, or any combination of those.

Each `truth-harness.research-session.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Objective and domains | The user-approved research goal and its math/science/code/patent scope. |
| Hypotheses and claims | Candidate ideas and explicit claims that must be proved, refuted, sourced, simulated, experimented on, or labeled unverified. |
| Evidence refs and snapshot refs | Local receipts, sources, audits, simulations, experiments, vault envelopes, snapshots, invention records, claim charts, notebooks, code runs, benchmarks, or artifacts. |
| Tasks | Concrete subclaims or evidence tasks agents can work through without relying on chat history. |
| Checkpoints | Timestamped summaries of decisions, new evidence refs, snapshot refs, and next validation checks. |
| Budgets | Max depth, branches, tool calls, wall minutes, and zero allowed unverified final claims. |
| Model policy | Local-first, hosted models optional, selected context only, disclosure required. |
| Review boundary | Expert, wet-lab, clinical/preclinical, regulatory, or patent-attorney review requirements inferred from scope. |

Research sessions create Markdown alongside JSON so humans can review the current state. Task updates are intentionally evidence-gated: a task cannot be marked `done` without at least one local evidence ref, and a `blocked` task must name the next check. They do not prove claims by themselves. They are the durable coordination layer that tells Claude/Codex what has been checked, what remains uncertain, and what local evidence changed since the last checkpoint.

## Expert Reviews

Expert reviews are local human-review records. They convert "needs expert review" from a vague warning into a portable artifact with scope, reviewer role, evidence refs, findings, limitations, outcome, and next checks.

Each `truth-harness.expert-review.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Subject and question | What is being reviewed and the exact scope of review. |
| Kind and status | Math, physics, software, biomedical, clinical, safety, ethics, regulatory, patent/legal, domain expert, or other; plus needed/requested/in-review/completed/rejected/superseded. |
| Reviewer metadata | Role, optional name/org, credentials, and conflict disclosure. |
| Evidence refs | Local receipts, sources, simulations, experiments, audits, sessions, snapshots, vault records, claim charts, discovery packages, or other artifacts. |
| Findings and limitations | What the reviewer concluded and the boundaries of that conclusion. |
| Recommendations and next checks | Concrete validation, replication, prior-art, regulatory, clinical, or proof work still needed. |
| Outcome | `not-reviewed`, `needs-more-evidence`, `supported-with-limitations`, `not-supported`, `inconclusive`, `requires-validation`, or `legal-review-only`. |
| Boundary | Always marks the record as not proof, not medical advice, not regulatory approval, not legal advice, and requiring independent verification. |

Expert reviews can be cited from evidence audits as `review:<reviewId>`. A completed review may strengthen the evidence posture, but it never removes the need to respect the review scope, limitations, and domain-specific validation requirements.

## Patent Claim Charts

Claim charts are local patent-review aids, not patentability decisions or legal advice.

Each `truth-harness.claim-chart.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Invention ref | Links to a local `truth-harness.invention.v0` entry. |
| Claim elements | User-provided candidate claim elements; agents should not invent these silently. |
| Support refs | Local receipt, source, simulation, disclosure, notebook, code-run, benchmark, or artifact refs. |
| Prior-art refs and notes | Human-review notes about closest known work. |
| Novelty questions | Open questions before any legal drafting. |
| Reduction-to-practice refs | Experiment, simulation, receipt, notebook, code-run, or constructive example refs. |
| Legal posture | Always `not-a-legal-opinion`, `not-determined`, and human review required. |

The claim chart exists to organize evidence for a patent attorney or expert reviewer. It must not claim novelty, non-obviousness, freedom to operate, inventorship, enablement, written-description sufficiency, filing readiness, or patentability.

## Simulation Evidence Logs

Simulation logs are local computational evidence records, not experimental validation.

Each `truth-harness.simulation.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Question, kind, stage | What was simulated and whether it is planned, computed, reproduced, benchmarked, or experimentally compared. |
| Engine and model | Local script, notebook, solver, simulator, or model identity. |
| Input, output, and code refs | Portable local references to data, notebooks, artifacts, and implementation. |
| Parameters and metrics | Structured `name`, `value`, optional `unit`, and optional note fields. |
| Assumptions, uncertainty, limitations | Review metadata required before treating outputs as evidence. |
| Validation boundary | Explicit flags that simulation is not reality and still needs expert/real-world validation unless experimentally compared. |
| Warnings | Overclaim guards for clinical, safety, regulatory, patent, and real-world claims. |

Simulation logs can be cited from invention logs as `simulation:<ref>`. Discovery packages display them as referenced computational evidence and warn that they do not establish real-world validity.

## Experiment Evidence Logs

Experiment logs are local protocol/data/observation records, not broad proof of safety, efficacy, regulatory approval, or clinical truth.

Each `truth-harness.experiment.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Question, kind, stage | What was tested and whether it is planned, running, completed, replicated, failed, or inconclusive. |
| Protocol, data, and analysis refs | Portable local references to the evidence needed for review. |
| Observations and measurements | Structured observation notes and `name`, `value`, optional `unit`, optional note measurements. |
| Outcome | Local outcome status and summary without overclaiming general validity. |
| Ethics, safety, and regulatory review refs | Records whether review appears required and what refs support it. |
| Validation boundary | Explicit flags for replication, expert review, clinical-proof limits, and regulatory approval limits. |
| Warnings | Overclaim guards for safety, efficacy, clinical, regulatory, patent, and real-world claims. |

Experiment logs can be cited from invention logs as `experiment:<ref>`. Discovery packages display them as protocol-scoped evidence and warn that replication, expert review, and required ethics/regulatory checks still matter.

## Encrypted Vault

Vault envelopes are local encrypted-at-rest artifacts for sensitive notes, datasets, intermediate research files, or invention records that should not be kept as plaintext inside the project store.

Each `truth-harness.vault.v0` envelope stores:

| Field | Purpose |
| --- | --- |
| Vault id, label, timestamps | Safe public metadata for listing and citation. |
| Ciphertext metadata | Ciphertext bytes, SHA-256 digest, and base64 ciphertext for portable local storage. |
| Encryption metadata | AES-256-GCM, scrypt parameters, IV, auth tag, and an environment-only key reference. |
| Privacy | Local-only workspace privacy metadata. |
| Warnings | Reminders that keys must stay out of prompts, manifests, receipts, and source control. |

The encrypted payload stores the original relative source ref, filename, plaintext byte count, plaintext SHA-256, and file bytes. MCP exposes seal/list/verify tools, but `truth_harness_vault_verify` returns only integrity metadata and not plaintext bytes. CLI `truth-harness vault open --out <path>` is the explicit local escape hatch for writing decrypted bytes back to disk.

Vault records help protect private project files at rest. They do not replace OS disk encryption, consent, access control, backups, IRB/regulatory review, or legal confidentiality review.

## Evidence Audits

Evidence audits are local claim-posture records. They answer: what kind of claim is this, what evidence refs are attached, what is resolved locally, what remains missing, and whether the wording overclaims the evidence.

Each `truth-harness.evidence-audit.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Claim and claim types | Classifies math, source-grounded, simulation, experiment, biomedical, patent, engineering, or general claims. |
| Evidence refs | Local receipt, source, simulation, experiment, disclosure, vault, benchmark, notebook, code-run, artifact, or other refs. |
| Reviews | Per-ref status, strength, trust label where available, summary, and warnings. |
| Evidence summary | Counts by status, kind, strength, and trust label. |
| Verdict | `refuted`, `verified-narrow`, `source-grounded`, `protocol-evidence`, `computational-evidence`, `hypothesis`, `unsupported`, or `overclaimed`. |
| Required next checks | Concrete missing validation steps before stronger claims are allowed. |
| Overclaim warnings | Biomedical, patent, simulation, missing-ref, and scope warnings. |

Audits are deliberately conservative. A `verified-narrow` math receipt does not prove adjacent scientific conclusions. A simulation can produce `computational-evidence`, not reality. A completed protocol can produce `protocol-evidence`, not clinical proof. Biomedical or patent language with strong wording is flagged as `overclaimed` unless the evidence scope justifies it.

Audit reports render the same record as Markdown for human review packets. They include verdict, claim text, evidence summary, per-ref review, overclaim warnings, evidence warnings, required next checks, and a boundary statement.

## Validation Plans

Validation plans turn an evidence audit into an explicit gate checklist before stronger claims are allowed. They are the local artifact an agent should create when a claim touches discovery, biomedical work, simulations, patents, engineering performance, safety, clinical language, or regulatory posture.

Each `truth-harness.validation-plan.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Claim, objective, and domains | The exact claim being validated and inferred or user-selected domains such as math, simulation, biomedical, clinical, safety, regulatory, patent, engineering, or physics. |
| Evidence refs | Local receipts, sources, simulations, experiments, reviews, audits, snapshots, claim charts, or other artifacts considered by the plan. |
| Embedded audit summary | The conservative evidence-audit verdict, claim types, required next checks, and overclaim warnings used to derive gates. |
| Gates | Required or optional gates such as proof, source citation, code run, simulation log, simulation review, experiment record, replication, wet-lab validation, preclinical/clinical work, safety, ethics, regulatory review, prior art, claim charts, reduction to practice, patent legal review, snapshots, replay, and benchmarks. |
| Readiness | `blocked-refuted`, `not-ready`, `ready-for-review`, or `ready-for-narrow-claim`, with counts of missing, in-progress, satisfied, and blocking gates. |
| Recommended claim language | A conservative phrasing hint that keeps simulations, biomedical hypotheses, and source retrieval from becoming fake certainty. |
| Boundary | Always marks the plan as not proof, not medical advice, not regulatory approval, not legal advice, not proof that simulation equals reality, and not proof that AI output is truth. |

Validation plans are designed for Claude/Codex recursion: before an agent writes "this could cure cancer" or "this is patent-ready", it should create a plan, cite the open gates, and keep the output in hypothesis or review language until local evidence satisfies the blocking gates.

## Workspace Provenance Snapshots

Workspace snapshots are local hash manifests for research checkpoints. They answer: which local artifacts existed, what schema/id metadata did they expose, what were their byte counts and SHA-256 hashes, and did any artifacts change, disappear, or appear after the checkpoint.

Each `truth-harness.workspace-snapshot.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Snapshot id, project id, timestamp | Stable reference for a local evidence checkpoint. |
| Workspace dir | Always `.truth-harness` for portability. |
| Entries | Relative paths, artifact kind, byte count, SHA-256 digest, optional schema version, and optional artifact id. |
| Summary | Counts by artifact kind and schema version. |
| Privacy | Local-only workspace privacy metadata. |
| Warnings | Boundary text explaining that hashes prove file identity, not truth. |

Snapshot verification returns `truth-harness.workspace-snapshot-verification.v0` with `passed`, `changed`, `missing`, and `addedSinceSnapshot` fields. Snapshot files themselves are excluded from snapshots to avoid self-reference. Vault entries are hashed as encrypted envelopes only; plaintext remains private unless the user explicitly opens a vault entry locally.

This gives agents a concrete provenance gate before relying on previous findings. For example, before saying a cancer-pathway or hair-loss simulation package still supports a claim, an agent can verify that the exact local simulation logs, audit reports, source indexes, and vault envelopes have not drifted since the review packet was created.

## Local Corpus

The local corpus is the first RAG substrate. It is intentionally lexical before vector search: simple, inspectable, portable, and local-only.

`truth-harness.corpus.v0` stores:

| Field | Purpose |
| --- | --- |
| Documents | Relative local paths, titles, MIME type, content hash, ingest time, and chunk refs. |
| Chunks | Text chunks, deterministic chunk IDs, document IDs, ordinals, and token counts. |
| Privacy | Local-only workspace privacy metadata. |

Rules:

1. Ingest only Markdown/text files under the project root.
2. Never ingest `.truth-harness/` when indexing a project directory.
3. Search returns `source-cited` chunk hits with citation refs, not proof that a claim is true.
4. Future vector, PDF, PubMed, arXiv, patent, or scientific database adapters must write compatible local artifacts and disclose any external calls.

## Literature Records

Literature records are structured local evidence metadata for papers, preprints, patents, datasets, database exports, standards, protocols, web pages, books, and notes. They are the bridge between simple local corpus chunks and future scientific database adapters.

Each `truth-harness.literature.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Source identity | Title, kind, review status, authors, venue, year, and DOI/PMID/PMCID/arXiv/ISBN/patent/URL/local-path identifiers. |
| Local provenance | Workspace-local files, local corpus refs, and related evidence refs. |
| Extracted review notes | Key claims, method/data notes, limitations, relevance, quality flags, and next checks. |
| Review boundary | Explicit flags that source retrieval is not entailment, plus domain expert, replication, and patent/legal review requirements when relevant. |
| Privacy | Local-only workspace metadata and no network calls. |
| Warnings | Citation is not truth; metadata without local source refs is weak; biomedical and patent conclusions require the right review gates. |

This gives agents a local artifact to cite before they make biomedical, physics, materials, climate, patent, or engineering claims from literature. Future PubMed, arXiv, Crossref, Semantic Scholar, Google Patents, Lens, or USPTO adapters should populate these records and write disclosure logs for any external calls.

## Notebook Run Records

Notebook run records are local provenance records for notebooks, scripts, tests, analyses, simulations, and pipelines. They are record-only artifacts: Truth Harness does not execute the command or verify outputs at this layer.

Each `truth-harness.notebook-run.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Run identity | Title, purpose, kind, status, runner, runner version, command, and working directory. |
| Local refs | Notebook refs, code refs, input refs, and output artifact refs. |
| Environment | Runtime, runtime version, operating system, dependencies, and non-secret environment-variable metadata. |
| Run data | Parameters, metrics, observations, limitations, and next checks. |
| Replay boundary | Manual replay requirement, determinism note, and the fact that the workbench did not execute or verify the run. |
| Reproducibility boundary | Snapshot, independent replay, and expert-review requirements before strong scientific or engineering claims. |

This gives agents a disciplined place to point when a simulation, analysis, benchmark, or discovery package depends on local code.

Code-run records are the actual local execution layer. They are direct process records: Truth Harness launches an executable plus explicit args without shell interpolation, under a workspace-confined cwd and a default-local execution policy. `truth-harness code sandbox-status` and MCP `truth_harness_code_sandbox_status` report whether a measured sandbox provider is available. The policy is default-deny for executables: a non-empty explicit allowlist is required before anything runs, and `requireSandbox`/`--require-sandbox` fails closed unless the sandbox status can attest enforced isolation. It also blocks shell launchers, obvious network clients, destructive commands, package mutations, and git mutations unless explicitly overridden. Execution uses async child processes, streamed capture, timeout kill, output-budget kill, and a per-workspace concurrency queue so one long run does not freeze the MCP server event loop.

The implementation is intentionally honest about its limits. Native host execution does not enforce an OS sandbox, network namespace, or filesystem boundary beyond the workspace cwd, so host code-run records store `privacy.mode: "unsandboxed-local-execution"`, `networkAccess: "unknown"`, and `replay.localOnly: false`. The Docker no-network profile can produce `privacy.mode: "sandboxed-local-execution"` and `networkAccess: "none"` only when the runtime measures the Truth Harness container marker, a Docker/container runtime marker, loopback-only networking, and no IPv4/IPv6 default route. The record captures stdout, stderr, exit code, duration, output hashes, timeout, policy decision, sandbox measurement notes, and replay notes, then writes `truth-harness.code-run.v0` JSON plus Markdown under `.truth-harness/code-runs/`. Timeouts are capped at 120000 ms and each output stream is capped at 1048576 bytes.

Agent-facing MCP code execution has an additional gate. `truth_harness_code_run` is not reachable unless the server process has `TRUTH_HARNESS_ALLOW_CODE_RUN=1`. Even then, unsandboxed direct execution is blocked unless either the caller sets `policy.requireSandbox: true` or the server process also has `TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN=1`. `policy.requireSandbox: true` fails closed on native hosts and can pass inside the measured Docker no-network provider.

Each `truth-harness.code-run.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Command | Executable, explicit args, workspace-relative cwd, timeout, output limit, and `shell: false`. |
| Execution | Status, exit code, signal, duration, timeout flag, and process error if any. |
| Outputs | Captured stdout/stderr text, byte counts, hashes, truncation flags, and limits. |
| Refs | Code refs, input refs, output refs, and related evidence refs. |
| Environment boundary | Platform, arch, Node version, inherited-env flag, and explicit note that env variable values are not captured. |
| Privacy measurement | Whether a process sandbox, network isolation, and filesystem isolation were actually enforced. Native host execution records `none` / `not-enforced` / `working-directory-only`; measured Docker no-network execution records `container` / `enforced` / `working-directory-only`. |
| Reproducibility boundary | Flags that the command ran locally, output was captured, and command execution is not proof of correctness or scientific validity. |

Use code-run records when an agent says it ran a script, test, simulation helper, parser, benchmark utility, or data transform. Use notebook-run records when documenting a notebook/pipeline run performed elsewhere or planned for manual replay. A passing code run can be computational evidence, but it is not proof, not a privacy proof, not a validated scientific result, not safety evidence, not regulatory approval, and not patentability.

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
6. External adapters must start from a `truth-harness.model-context.v0` packet, write a `truth-harness.disclosure.v0` record, and append receipt disclosure metadata describing what was sent, why, and whether the user explicitly requested it.

The first formal-backend probe is `truth-harness.proof-backends.v0`. It checks local Lean availability with a version command only, records `localOnly: true` and `networkAccess: none`, and sets `statusProbeMintedProof: false`. This report helps agents decide whether a proof-checking workflow is possible on the current machine, but a `proved` receipt still requires a later successful proof-checking run over a concrete proof artifact.

The first formal proof-check artifact is `truth-harness.proof-check.v0`. It records the local Lean command, source path, source SHA-256, optional declaration name, stdout/stderr, replay command, and the proof boundary. `status: accepted` maps to `trust: proved` with `proofCheckerBacked: true`; rejected or unavailable checks stay `unverified` because a failed proof attempt is not a mathematical refutation. Written records live under `.truth-harness/proofs/` with paired Markdown reports so agents can cite, snapshot, audit, and revisit concrete proof-check attempts without relying on chat memory.

The first SMT artifact is `truth-harness.smt-check.v0`. It records the local Z3 command, source path, source SHA-256, optional query name, stdout/stderr, replay command, and the solver boundary. `status: sat` or `status: unsat` maps to `trust: smt-checked` with `proofCheckerBacked: false`; `unknown`, unavailable, or failed checks stay `unverified`. Written records live under `.truth-harness/smt/` with paired Markdown reports so agents can cite, snapshot, audit, and revisit concrete constraint checks without treating SMT output as Lean-style proof.

## Model Context Packets

Model-context packets are the local-first bridge to latest-model collaboration. They let Claude, Codex, humans, or other agents prepare exactly what a hosted model, local model, or external service may see before any call is made.

Each `truth-harness.model-context.v0` entry stores:

| Field | Purpose |
| --- | --- |
| Purpose and target | Why the packet exists, plus hosted model, local model, or external service target. |
| Service/model metadata | The intended provider, endpoint, or model label without requiring a network call. |
| Selected data classes | A short list of what data types are included, such as formal statement, proof sketch, benchmark summary, or source excerpt. |
| Source refs and sections | Local artifact refs plus human-readable included sections. |
| Redactions and exclusions | What was removed or deliberately kept out, including vault plaintext and unrelated workspace history. |
| Approval and disclosure status | Who approved the selected context and whether a disclosure record still needs to be written. |
| Privacy boundary | Local-only packet metadata, `externalCallNotPerformed`, selected-context-only flags, and warnings. |

This is intentionally a pre-flight artifact. It does not call OpenAI, Anthropic, WolframAlpha, cloud CAS, a lab service, or any other non-local system. Its job is to make private-by-default frontier-model use boring, reviewable, and testable.

## MCP Surface

Current MCP tools:

| Tool | Purpose |
| --- | --- |
| `truth_harness_ask` | Create proof receipts for supported math prompts. |
| `truth_harness_verify` | Create a manifest-aware verifier route plus receipt; optionally write local `truth-harness.verifier-route.v0` JSON and Markdown records. |
| `truth_harness_route_list` | List local verifier-route records and reusable route ids/paths. |
| `truth_harness_route_show` | Read one verifier route by id or workspace-local JSON path. |
| `truth_harness_benchmark_run` | Run benchmark suites against the local receipt engine; optionally write local `truth-harness.benchmark-run.v0` records. |
| `truth_harness_benchmark_compare` | Compare two benchmark-run records; optionally write local `truth-harness.benchmark-comparison.v0` records. |
| `truth_harness_benchmark_list` | List benchmark run/comparison artifacts and reusable local paths. |
| `truth_harness_proof_backends` | Probe accepted local proof-checker availability without network access; the status report is not a proof. |
| `truth_harness_proof_check` | Check a workspace-local Lean proof artifact, optionally write a local proof-check record, and return `proved` only when Lean accepts it. |
| `truth_harness_proof_list` | List local proof-check records and reusable JSON/Markdown paths. |
| `truth_harness_smt_backends` | Probe local Z3 availability without network access; the status report is not a solver check. |
| `truth_harness_smt_check` | Check a workspace-local SMT-LIB artifact, optionally write a local SMT-check record, and return `smt-checked` only when Z3 returns `sat` or `unsat`. |
| `truth_harness_smt_list` | List local SMT-check records and reusable JSON/Markdown paths. |
| `truth_harness_smt_solve` | Build workspace-local SMT-LIB from explicit integer constraints, then run the local SMT-check workflow. |
| `truth_harness_workspace_init` | Initialize the private local workspace. |
| `truth_harness_workspace_status` | Check local workspace health. |
| `truth_harness_workspace_repair` | Create missing private directories and persist newly added manifest defaults. |
| `truth_harness_workspace_graph` | Return a read-only local evidence graph across artifacts, evidence refs, claim lineage, sessions, snapshots, selected context refs, and missing links. |
| `truth_harness_workspace_review` | Return or write a bounded local work queue across saved verifier routes, claim records, and active research sessions for agent handoff. |
| `truth_harness_workspace_review_list` / `truth_harness_workspace_review_show` | Reopen persisted review handoffs by id or path so agents can resume from exact local queues instead of chat memory. |
| `truth_harness_workspace_snapshot` | Write a local provenance hash snapshot for workspace artifacts. |
| `truth_harness_workspace_snapshot_list` | List local workspace snapshots. |
| `truth_harness_workspace_snapshot_verify` | Verify changed, missing, or added artifacts against a snapshot. |
| `truth_harness_claim_add` | Write a local claim ledger record with dependencies, supersession, evidence refs, trust label, tags, and finalization gates. |
| `truth_harness_claim_list` | List/filter local claim records and return the dependency/supersession graph. |
| `truth_harness_claim_show` | Read one local claim record by id or workspace-local JSON path. |
| `truth_harness_research_session_start` | Start a local research runbook with budgets, evidence refs, snapshot refs, and review boundaries. |
| `truth_harness_research_session_checkpoint` | Append decisions, evidence refs, snapshot refs, and next checks to a research runbook. |
| `truth_harness_research_session_task_update` | Update one runbook task status with evidence refs and next checks; `done` requires evidence and `blocked` requires a next check. |
| `truth_harness_research_session_show` | Read one local research runbook by id or path before continuing a long investigation. |
| `truth_harness_research_session_list` | List local research sessions and checkpoints. |
| `truth_harness_expert_review_log` | Write a local human expert-review record with scope, outcome, limitations, and next checks. |
| `truth_harness_expert_review_list` | List local expert-review records. |
| `truth_harness_source_ingest` | Ingest Markdown/text files into the local corpus index. |
| `truth_harness_source_search` | Retrieve `source-cited` local corpus chunks. |
| `truth_harness_source_cite` | Create `source-cited` receipts for claims using local corpus hits. |
| `truth_harness_literature_log` | Create or write local literature, prior-art, dataset, and database-export evidence records. |
| `truth_harness_literature_list` | List local literature records. |
| `truth_harness_notebook_run_log` | Create or write local notebook/script/pipeline provenance records without executing code. |
| `truth_harness_notebook_run_list` | List local notebook-run records. |
| `truth_harness_code_sandbox_status` | Report whether a measured code-run sandbox is available before requesting execution. |
| `truth_harness_code_run` | Execute a local direct command under the default local execution policy and write a code-run evidence record. Disabled unless the MCP server process has `TRUTH_HARNESS_ALLOW_CODE_RUN=1`; unsandboxed MCP execution also requires `TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN=1`, and each call still requires an explicit executable allowlist. |
| `truth_harness_code_list` | List local code-run records. |
| `truth_harness_vault_seal` | Encrypt a workspace-local file into the private vault using an environment key. |
| `truth_harness_vault_list` | List encrypted local vault envelopes without decrypting plaintext. |
| `truth_harness_vault_verify` | Decrypt locally and return integrity metadata only, not plaintext bytes. |
| `truth_harness_evidence_audit` | Audit local evidence posture, overclaim risk, and required next checks for a claim; optionally write Markdown reports. |
| `truth_harness_evidence_audit_list` | List local evidence audits. |
| `truth_harness_validation_plan` | Create or write local validation-gate plans before stronger discovery, biomedical, patent, simulation, or engineering claims. |
| `truth_harness_validation_plan_list` | List local validation plans. |
| `truth_harness_model_context_prepare` | Prepare a local selected-context packet before hosted model, local model, or external service collaboration. |
| `truth_harness_model_context_list` | List local model-context packets. |
| `truth_harness_disclosure_log` | Write local audit records for selected context sent to external models/services. |
| `truth_harness_disclosure_list` | List local external model/service disclosure records. |
| `truth_harness_simulation_log` | Write local simulation evidence records with assumptions, metrics, uncertainty, and caveats. |
| `truth_harness_simulation_list` | List local simulation evidence records. |
| `truth_harness_experiment_log` | Write local experiment evidence records with protocol/data/analysis refs and review caveats. |
| `truth_harness_experiment_list` | List local experiment evidence records. |
| `truth_harness_invention_log` | Write local invention/discovery hypothesis logs. |
| `truth_harness_invention_list` | List local invention/discovery logs. |
| `truth_harness_claim_chart` | Render or write local patent claim charts with evidence refs and legal-review caveats. |
| `truth_harness_claim_chart_list` | List local patent claim charts. |
| `truth_harness_discovery_package` | Render or write local discovery packages with evidence review and validation caveats. |
| `truth_harness_replay` | Replay a previous receipt. |
| `truth_harness_render_receipt` | Render receipts as Markdown or HTML. |

Planned MCP tools:

| Tool | Purpose |
| --- | --- |
| `truth_harness_verify_claim` | Verify one mathematical/factual claim. |
| `truth_harness_compute_exact` | CAS-backed symbolic/exact computation. |
| `truth_harness_smt_translate` | Higher-level natural-language or domain-structured claim translation into reviewable SMT artifacts. |
| `truth_harness_prove_lean` | Compile/check Lean statements or proof attempts. |
| `truth_harness_rag_ingest` | Ingest PDFs, papers, patents, scientific databases, or local docs through richer adapters. |
| `truth_harness_rag_search` | Retrieve hybrid lexical/vector context with citations. |
| `truth_harness_get_artifact` | Return stored proof, plot, notebook, trace, or source chunk. |
| `truth_harness_lesson` | Turn a verified solution into an adaptive lesson. |

Initial MCP resources:

| Resource | Purpose |
| --- | --- |
| `truth-harness://runs/{runId}` | Run graph and trust summary. |
| `truth-harness://benchmarks/{benchmarkRunId}` | Benchmark summary, scores, regressions, and artifacts. |
| `truth-harness://artifacts/{artifactId}` | Tool output, proof file, trace, plot, or citation bundle. |
| `truth-harness://corpus/{docId}` | Ingested document metadata and chunks. |
| `truth-harness://lessons/{lessonId}` | Learning-mode material generated from verified steps. |

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
truth-harness ask "integrate x^2 sin x from 0 to pi" --trust exact --explain
truth-harness proof backends
truth-harness proof check docs/examples/trivial.lean --fail-on-unproved
truth-harness proof check docs/examples/trivial.lean --write
truth-harness proof list
truth-harness smt backends
truth-harness smt check docs/examples/constraints.smt2 --write
truth-harness smt solve --int x --constraint "x > 0" --constraint "x < 3"
truth-harness smt list
truth-harness verify "for all n, n^2+n is even" --lean
truth-harness compute "factor x^4 - 1" --engine sympy --json
truth-harness smt translate "find an integer x with 0 < x < 3" --review
truth-harness rag ingest ./papers --collection math
truth-harness rag search "Fourier transform convolution identity" --collection math
truth-harness source ingest ./papers
truth-harness source search "Fourier transform convolution identity"
truth-harness source cite "The Fourier convolution identity is discussed in the local notes" --query "Fourier transform convolution identity"
truth-harness literature log "Local pathway paper" --kind paper --status annotated --identifier doi:10.0000/example --local-ref papers/pathway.md --claim "Reports a toy pathway marker change" --method "Toy model only" --limitation "No clinical endpoint"
truth-harness literature list
truth-harness notebook log "Run a local notebook that computes a toy pathway score" --kind notebook --runner jupyter --command "jupyter nbconvert --execute notebooks/pathway.ipynb" --notebook notebooks/pathway.ipynb --code src/pathway.py --input data/pathway.csv --output artifacts/pathway-output.json --runtime python --dependency sympy==1.14.0 --limitation "Toy model only"
truth-harness notebook list
truth-harness code sandbox-status --json
truth-harness code run "Run a tiny local script check" --command node --allow-executable node --arg -e --arg "console.log(6 * 7)" --code inline:node-eval --input prompt:6x7 --output stdout
truth-harness code list
truth-harness vault seal private/notes.md --label "Private research notes"
truth-harness vault list
truth-harness vault verify vault_<id>
truth-harness vault open vault_<id> --out private/restored-notes.md
truth-harness audit claim "This simulated candidate cures cancer safely" --evidence simulation:sim_<id> --evidence vault:vault_<id> --report
truth-harness audit list
truth-harness validation plan "This simulated candidate cures cancer safely" --evidence simulation:sim_<id> --domain biomedical
truth-harness validation list
truth-harness workspace snapshot
truth-harness workspace verify-snapshot snap_0123456789abcdef
truth-harness model-context prepare "Ask a frontier model to critique a selected proof plan" --service OpenAI --model frontier-reasoning-model --data "selected proof sketch" --section "Selected proof plan=Only this proof sketch is included; local corpus stays local." --approval "prompt:explicit-user-request"
truth-harness model-context list
truth-harness disclosure log "Ask a frontier model to critique a selected proof plan" --service OpenAI --data "selected proof sketch" --context "Only the proof sketch is sent; local corpus stays local."
truth-harness disclosure list
truth-harness simulation log "Could a toy pathway simulation lower a follicle signaling score?" --kind molecular --engine "local python" --model "toy pathway ODE" --metric "pathway_score_delta=-0.18;note=toy-model-only" --assumption "Toy mechanism only" --uncertainty "No calibrated uncertainty model" --limitation "No wet-lab validation"
truth-harness simulation list
truth-harness experiment log "Did a toy assay observe a pathway marker change?" --kind wet-lab --stage completed --protocol protocols/toy-assay.md --data data/toy-assay.csv --analysis notebooks/toy-assay.ipynb --observation "Marker changed under toy conditions" --measurement "marker_delta=-0.12;unit=a.u.;note=toy-assay-only" --limitation "No clinical endpoint"
truth-harness experiment list
truth-harness workspace init --name "Local Discovery Lab"
truth-harness workspace status
truth-harness workspace repair
truth-harness workspace snapshot
truth-harness workspace snapshots
truth-harness workspace verify-snapshot snap_0123456789abcdef
truth-harness research start "Investigate a cancer pathway hypothesis without claiming a cure" --domain biomedical --snapshot snap_0123456789abcdef --task "Attach local source evidence" --task "Run evidence audit before any claim"
truth-harness research checkpoint session_0123456789abcdef "Initial runbook created; claim remains a computational hypothesis" --snapshot snap_0123456789abcdef --next-check "Attach simulation, source, and expert-review refs"
truth-harness research list
truth-harness review log "Cancer pathway evidence packet" --kind biomedical --status requested --reviewer-role "oncology domain expert" --evidence snapshot:snap_0123456789abcdef --next-check "Attach wet-lab validation plan before stronger claims"
truth-harness review list
truth-harness invention log "Candidate mechanism ..." --stage computational-hypothesis --evidence receipt:.truth-harness/receipts/run.json
truth-harness invention list
truth-harness invention claim-chart --element "Candidate mechanism with local evidence support" --evidence receipt:.truth-harness/receipts/run.json --prior-art "Search closest patents and papers" --write
truth-harness invention claim-charts
truth-harness invention package --write
truth-harness replay runs/2026-06-08/example.truthrun.json
truth-harness lesson runs/example --level algebra-1
truth-harness bench run suites/foundations-100 --profile local
truth-harness mcp --transport stdio
truth-harness doctor
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
2. Start or reuse a local research session with budgets, claims, tasks, evidence refs, and snapshot refs.
3. Search local corpus and known formal-library indexes.
4. Create literature records for key papers, patents, datasets, database exports, or prior-art notes before relying on source-derived claims.
5. Create notebook-run records for local notebooks, scripts, or pipelines that produce evidence artifacts, and code-run records for commands actually executed by the workbench.
6. Try cheap refutation first.
7. For any non-local model/API call, prepare a local model-context packet with selected context, redactions, exclusions, purpose, data classes, and approval; then log disclosure before sending.
8. Route subclaims to CAS, SMT, Lean, RAG, or Wolfram.
9. Store every result in the graph.
10. Write or verify a workspace snapshot before relying on older local evidence.
11. Record validation plans and required expert, safety, regulatory, clinical, or patent/legal review artifacts when a claim crosses those boundaries.
12. Append a research session checkpoint with decisions and next checks.
13. Summarize findings into `docs/findings/YYYY-MM-DD-topic.md`.
14. Propose next subclaims only when new evidence changed the graph.
15. Stop on budget, proof, refutation, or no-progress threshold.

Budgets:

| Budget | Default |
| --- | --- |
| Max recursion depth | 4 |
| Max branches per node | 5 |
| Max wall time | 10 minutes local MVP |
| Max tool calls | 100 per run |
| Max proof attempts per formal claim | 32 MVP, configurable |
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

- Higher-level Z3 claim translation and cvc5 adapter.
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
- Corpus-aware formal statement search and proof attempt loops.

## Decision

Build the repo as TypeScript-first with modular adapters. Use Rust later for isolated executor pieces if benchmarks or sandboxing demand it. Do not implement a CAS, proof assistant, vector database, or notebook engine from scratch. The differentiator is the evidence graph and the agent-native verification workflow.

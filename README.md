# Truth Harness

**Local-First Verified Math for AI Agents.**

Truth Harness is a verification-first mathematical workbench for humans, Claude, Codex, and other agentic tools.

The project goal is not to replace WolframAlpha by rebuilding every math engine. The goal is to build the missing verification engine around AI-assisted work: problem normalization, verifier routing, receipts, trust labels, claim ledgers, replay, disclosures, benchmarks, and reports. Every answer should be backed by a replayable local tool run, proof check, cited source, counterexample search, workspace snapshot, or an explicit uncertainty label. Claude, Codex, and other frontier models can still help reason, plan, and critique, but the app is local-first: project data and artifacts stay in the local workspace unless the user explicitly sends selected context to a hosted model or network service, and that selected context plus disclosure is recorded locally.

The long-term mission is open-source discovery infrastructure: help humans and agents investigate hard math, physics, materials, climate, biomedical, and engineering problems without turning model output into fake certainty. The workbench should make it easy to use the best available local solvers and, when the user chooses, the latest capable frontier models as outside critics while keeping the private workspace private.

The name is intentional: it describes the product as a local harness for routing claims through evidence, replay, and verification instead of letting AI output float around as vibes.

The public name is **Truth Harness**. The current CLI command, package scope, schemas, and local store still use the legacy `theorem`/`.theorem-workbench` namespace for compatibility until a deliberate migration lands. See [docs/PARITY_LEDGER.md](docs/PARITY_LEDGER.md) for the naming decision and parity gates against WolframAlpha, SageMath, Lean, JupyterLab, provenance tools, and scientific RAG.

## Why It Exists

AI is already good at writing plausible math. The hard part is knowing when the math is true.

Truth Harness turns math answers into receipts:

- Truth Harness owns the trust policy, verifier router, evidence graph, claim ledger, replay contracts, and agent-facing local workspace,
- exact computations use exact rational arithmetic or CAS adapters,
- exact arithmetic receipts include machine-readable step traces and deterministic audience-level explanations,
- false universal claims get counterexample search before explanation,
- formal proofs will only be labeled `proved` when a proof checker accepts them,
- every result carries a trust label, replay command, and privacy metadata.

The current MVP is local-first by default. Receipt metadata records `local-only` mode, `networkAccess: none`, local workspace data residency, external disclosure metadata when relevant, and an `evidenceProfile` summarizing backend ids, versions, inputs, outputs, replayability, proof-checker status, and limitations. Live code-run records are stricter about honesty: native host execution records `networkAccess: unknown`, while the Docker no-network profile can attest `networkAccess: none` only when the runtime measures the legacy Theorem container marker, a container runtime marker, loopback-only networking, and no default route.

## Docker-First Quickstart (Recommended)

For agent-facing work, demos, and anything that may execute code, prefer Docker first. The image keeps Node, Python, SymPy, Maxima, Z3, and npm dependencies out of your host environment. The CLI and MCP compose runtimes disable network access; the web runtime publishes only to `127.0.0.1` so your browser can reach the local workbench.

Highest-safety verification, with no repo bind mount during the checks:

```bash
docker --version
docker build --target verify -t truth-harness:verify .
```

This verification image runs the TypeScript build, test suite, launch demos, a concrete Maxima CAS agreement check, and a concrete Z3 SMT-LIB check inside the container image.

Day-to-day container workflow:

```bash
docker compose build
docker compose run --rm theorem npm run check
docker compose run --rm theorem npm run proof:launch:engines
docker compose run --rm theorem npm run cli -- workspace init --name "Local Math Lab"
docker compose run --rm theorem npm run cli -- ask "symbolic simplify sin(x)^2 + cos(x)^2"
docker compose run --rm theorem npm run cli -- cas backends
docker compose run --rm theorem npm run cli -- cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write
docker compose run --rm theorem npm run cli -- smt backends
docker compose run --rm theorem npm run cli -- proof backends
docker compose run --rm theorem npm run cli -- code sandbox-status --json
docker compose up web
docker compose run --rm -i mcp
```

The web workbench uses one canonical local URL: `http://127.0.0.1:4180/`.

See [SECURITY.md](SECURITY.md) and [docs/DOCKER.md](docs/DOCKER.md) for the safety boundaries. Docker is the recommended baseline, but a compose dev container bind-mounts this repo and can still change files inside it. Code-run receipts report `networkAccess: none` only when the measured Docker no-network provider is active; otherwise they correctly stay at `unknown`.

## Native Quickstart

```bash
npm install
npm run build
python -m pip install sympy==1.14.0
npm run cli -- workspace init --name "Local Math Lab"
npm run cli -- workspace status
npm run cli -- workspace repair
npm run cli -- workspace validate
npm run cli -- ask "compute 3 / 4 + 5 / 8" -- --out .theorem-workbench/receipts/fraction-sum.json
npm run cli -- ask "for all integers n, n^2+n+1 is even"
npm run cli -- ask "for all integers n, n^2+n is even"
npm run cli -- ask "for all integers n, n^2+n+1 is even" -- --out receipts/false-parity.json
npm run cli -- replay receipts/false-parity.json
npm run cli -- render receipts/false-parity.json markdown receipts/false-parity.md
npm run cli -- render receipts/false-parity.json html receipts/false-parity.html
npm run cli -- bench run packages/benchmarks/suites/foundations-seed.json
npm run cli -- bench run packages/benchmarks/suites/foundations-seed.json --write
npm run cli -- bench run packages/benchmarks/suites/physics-seed.json
npm run cli -- bench run packages/benchmarks/suites/numeric-seed.json
npm run cli -- bench run packages/benchmarks/suites/symbolic-seed.json
npm run cli -- ask "dimension check force = mass * acceleration"
npm run cli -- ask "dimension check force = mass * velocity"
npm run cli -- ask "bound x^2 + 2*x + 1 for x in [0, 2]"
npm run cli -- ask "symbolic simplify sin(x)^2 + cos(x)^2"
npm run cli -- cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write
npm run cli -- cas list
npm run cli -- claim add "3 / 4 + 5 / 8 equals 11 / 8" --trust exact-computed --tag fractions --evidence receipt:.theorem-workbench/receipts/fraction-sum.json
npm run cli -- claim list --tag fractions
npm run cli -- claim show <claim_id>
npm run cli -- claim review <claim_id>
npm run cli -- proof backends
npm run cli -- proof check docs/examples/trivial.lean
npm run cli -- proof check docs/examples/trivial.lean --write
npm run cli -- proof list
npm run cli -- smt backends
npm run cli -- smt check docs/examples/constraints.smt2
npm run cli -- smt check docs/examples/constraints.smt2 --fail-on-unverified
npm run cli -- smt check docs/examples/constraints.smt2 --write
npm run cli -- smt solve --int x --constraint "x > 0" --constraint "x < 3"
npm run cli -- smt list
npm run cli -- check docs/examples/strict-claims.md
npm run cli -- source ingest docs
npm run cli -- source search "verified math agents"
npm run cli -- source cite "Truth Harness is built for verified math agents" --query "verified math agents"
npm run cli -- notebook log "Run a local notebook that checks a parity conjecture" --kind notebook --runner jupyter --command "jupyter nbconvert --execute notebooks/parity.ipynb" --notebook notebooks/parity.ipynb --code src/parity.py --output artifacts/parity-output.json --runtime python --runtime-version 3.12 --dependency sympy==1.14.0 --metric checked_cases=2 --limitation "Notebook output is provenance, not a proof-checker-backed result"
npm run cli -- notebook list
npm run cli -- code run "Run a tiny local code check" --command node --allow-executable node --arg -e --arg "console.log(6 * 7)" --code inline:node-eval --input prompt:6x7 --output stdout
npm run cli -- code list
npm run cli -- model-context prepare "Ask a frontier model to critique a selected proof plan" --service OpenAI --model frontier-reasoning-model --data "selected theorem statement" --data "selected proof sketch" --section "Selected proof plan=Only critique this selected proof plan; local notes stay local." --approval "prompt:explicit-user-request"
npm run cli -- disclosure log "Ask a frontier model to critique a selected proof plan" --service OpenAI --model frontier-reasoning-model --data "selected theorem statement" --data "selected proof sketch" --context "Only the theorem statement and proof sketch are sent; local notes stay local." --approval "prompt:explicit-user-request"
npm run cli -- workspace validate
npm run cli -- workspace snapshot
```

The current MVP is intentionally small and honest. It supports exact rational arithmetic, finite counterexample search, a narrow local modular parity checker, conservative rational interval bounds, dimensional analysis, a local SymPy symbolic adapter, policy-gated direct local code-run records, local proof-backend readiness probes, local Lean proof artifact checks when Lean is installed, local Z3 SMT-LIB checks when Z3 is installed, first-class claim-ledger records with dependencies/supersession/tags/finalization gates, first-class proof-check and SMT-check records, receipt replay, Markdown/HTML receipt export, benchmark runs, first-class benchmark-run and benchmark-comparison records, and a local MCP server. The parity checker can emit an exact local certificate, but it is not labeled `proved` until an accepted proof-checking backend verifies the result. Sage, cvc5, and richer RAG adapters are planned as modular packages.

The first web surface lives at [apps/web](apps/web). It is a local workbench shell, designed like a dense desktop research tool: sessions and claims on the left, receipt-first verification in the center, and trust labels, replay commands, math visuals, evidence lineage, activity logs, and limitations in the inspector. The browser calls localhost `/api/receipt` and `/api/claims` endpoints backed by `@theorem-workbench/core`; it does not call a hosted model or external service. Verified receipts can be recorded into the local claim ledger so exported reports cite stable claim IDs, activity events, and local API request ids. In the UI, `Visuals` means number lines, concept maps, bubble maps, and future domain visualizers; `Lineage` means the receipt/claim dependency graph. Run it with `npm run web:serve` or `docker compose up web`, then open `http://127.0.0.1:4180`.

The web inspector also calls localhost `/api/status` to show safety and verification-engine readiness. It reports the measured code-run sandbox boundary plus local Maxima, Lean, and Z3 availability probes. These probes are readiness checks only: they never mint `cross-checked`, `smt-checked`, or `proved` by themselves. Those labels still require a concrete replayable Maxima agreement run, Z3 solver run, or accepted Lean proof-check artifact.

The Docker image installs Maxima through Debian's ECL-backed `maxima-sage` package and Z3 so the containerized web UI and CLI can show real CAS/SMT readiness without changing the host machine. `npm run docker:proof` uses `proof:launch:engines`, which runs the standard launch proof suite, requires a concrete Maxima CAS agreement for `sin(x)^2 + cos(x)^2 = 1`, and then requires `docs/examples/constraints.smt2` to return a concrete `smt-checked` result through Z3. Lean is intentionally not bundled yet; configure `THEOREM_LEAN`, or extend the image with a validated/pinned Lean/Mathlib project, when the proof lane needs a reproducible environment.

On Windows during UI iteration, prefer `npm run web:restart`. It stops the Node listener on port `4180`, starts the web server again in the background, and keeps the browser URL stable. Static web edits usually need only a browser reload; server/API edits need `npm run web:restart`.

Local workspace commands create a private `.theorem-workbench/` project store for receipts, claim ledger records, artifacts, indexes, findings, research sessions, expert reviews, validation plans, literature records, notebook-run records, code-run records, invention logs, simulation logs, experiment logs, evidence audits, model-context packets, disclosure logs, encrypted vault envelopes, provenance snapshots, patent claim charts, CAS-check records, proof-check records, SMT-check records, and benchmark run/comparison records. The directory is git-ignored by default. `workspace status` reports missing private directories and manifest defaults added by newer releases; `workspace repair` creates missing directories and persists newly added defaults without leaving the local project.

Workspace validation commands write no files; they scan local evidence artifacts and return `theorem.workspace-validation.v0` reports. Validation checks the root `project.json` manifest against a private-by-default schema, then checks receipt JSON deeply, including local-first privacy metadata, backend-aware trust boundaries, and forged `proved` labels. Other known workspace JSON records are checked against their checked-in JSON Schema contracts, artifact ids, local evidence refs, and trust-boundary policies before humans or agents rely on the workspace.

The test suite includes a golden workspace regression that generates representative artifacts through the writer APIs, then requires `workspace validate` to pass over the whole local project store. This keeps schemas, writers, and agent-facing validation policies moving together.

The local JSON Schema validator intentionally supports a documented subset used by the checked-in schemas. Unsupported schema keywords fail validation instead of being silently ignored, and tests scan every schema file to keep the validator vocabulary honest.

Verifier route commands write `theorem.verifier-route.v0` records into `.theorem-workbench/routes/`. A route is a local, replayable work order for a claim: it stores the receipt, engine readiness, used capabilities, missing verifier gaps, proof obligations, next actions, readiness, and trust boundary. `theorem route list` and MCP `theorem_route_list` expose obligation counts, including open, critical-open, satisfied, and not-required gates, so humans and agents can sort work by what still blocks credibility. `theorem route satisfy <route> <obligation> --evidence kind:ref` attaches accepted local evidence, rewrites the route JSON/Markdown, prints the remaining obligation summary, and gives a claim-ledger follow-up command. A route explains the verification path; it is not itself a proof.

Claim commands write `theorem.claim.v0` records into `.theorem-workbench/claims/`. A claim record stores the exact statement, domain, tags, strongest evidence-backed trust label, upstream claim ids, superseded claim ids, evidence refs, a verifier ladder, open checks, and a Markdown review packet. Requested trust labels and manually typed evidence labels are not enough to finalize a claim; the claim trust is derived from resolvable local receipts, CAS checks, proof checks, SMT checks, ready verifier routes, or existing claim records. A `route:` evidence ref only supports finalization when the route readiness says it is ready for a narrow claim; not-ready routes stay attached as unverified evidence and add their open route blockers to the claim finalization boundary. `theorem claim review <claim_id>` and MCP `theorem_claim_review` turn that state into an actionable gate: review status, blockers, verification ladder, evidence refs, next actions, and local commands. This is the "math as a codebase" layer: long work can be broken into linked claims, corrected without erasing history, filtered by tag/domain/trust, and handed to agents through CLI/MCP without hiding state inside chat.

Source commands ingest local Markdown/text files into `.theorem-workbench/indexes/local-corpus.json`, search those chunks without network access, and create `source-cited` receipts for claims grounded in local source hits. This is the first local RAG substrate: lexical and simple on purpose, with citation refs agents can attach to later claims.

Literature commands write `theorem.literature.v0` records into `.theorem-workbench/literature/` for papers, preprints, patents, datasets, database exports, standards, protocols, web pages, books, or notes. They store identifiers, local refs, corpus refs, key claims, methods, limitations, quality flags, relevance, and next checks without calling PubMed, arXiv, patent databases, or any network service. A literature record is source organization, not proof of entailment, clinical validity, regulatory approval, or patentability.

Notebook commands write `theorem.notebook-run.v0` records into `.theorem-workbench/notebook-runs/` for local notebooks, scripts, tests, analyses, simulations, and pipelines. They capture runner, replay command, notebook/code/input/output refs, runtime, dependencies, parameters, metrics, observations, limitations, and next checks. They do not execute code; they record provenance so humans and agents can replay, snapshot, audit, and review outputs without pretending notebook output is truth.

Code commands write `theorem.code-run.v0` records into `.theorem-workbench/code-runs/`. `theorem code sandbox-status` reports whether a measured code-run sandbox is available. Native host execution reports unavailable; the Docker no-network profile reports available only when the process is inside the Truth Harness container image, the legacy Theorem container marker is present, `/sys/class/net` is loopback-only, and IPv4/IPv6 default routes are absent. `theorem code run` launches a local command directly without shell interpolation only when a non-empty `--allow-executable` policy is supplied. Add `--require-sandbox` when a workflow needs enforceable isolation; outside a measured provider that fails closed instead of writing a misleading receipt. The default-local policy is default-deny for executables and also blocks shell launchers, obvious network clients, destructive commands, package mutations, and git mutations unless explicitly overridden. Execution uses async process capture, per-workspace concurrency limiting, a 120s timeout cap, and a 1 MiB per-stream output cap. This proves a bounded local process execution happened under the recorded policy; it does not prove the code is correct, deterministic, scientifically valid, safe, regulatory-approved, or patentable.

Benchmark commands can write `theorem.benchmark-run.v0` records into `.theorem-workbench/benchmarks/` with `theorem bench run <suite> --write`. Records capture suite metadata, runner metadata, replay command, per-case receipt hashes, receipt trust labels, backend ids, failures, aggregate trust accuracy, and explicit warnings that benchmarks measure system behavior rather than proving mathematical or scientific truth. Add `--fail-on-failures` when a CLI or CI workflow should exit non-zero if any benchmark case fails. Once two benchmark-run files exist, `theorem bench compare <baseline.json> <current.json> --write` writes a `theorem.benchmark-comparison.v0` record that flags regressions, improvements, trust-label changes, changed receipt hashes, added/removed cases, and suite drift. Add `--fail-on-regression` when comparison regressions or incomparable suites should fail the workflow.
Use `theorem bench list` to find local benchmark run and comparison paths for follow-up comparisons, audits, research-session evidence refs, or agent reports.

Proof commands can probe accepted proof-checker availability with `theorem proof backends` and can check local Lean proof artifacts with `theorem proof check <file>`. Add `--write` to store a `theorem.proof-check.v0` JSON record plus Markdown report under `.theorem-workbench/proofs/`, then use `theorem proof list` to find proof-check artifacts for audits, snapshots, research sessions, or agent follow-up. A proof-check record is labeled `proved` only when Lean accepts the concrete source file; missing Lean, execution errors, syntax errors, incomplete proofs, or rejected proof attempts remain `unverified`. Route obligations and claim records parse proof-check artifacts strictly, so malformed JSON that merely claims `trust: proved` cannot satisfy a proof gate. Add `--fail-on-unproved` when CI or an agent workflow must stop unless the proof artifact is accepted.

CAS commands can probe local Maxima availability with `theorem cas backends` and can check scoped symbolic expression/result pairs with `theorem cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1`. Add `--write` to store a `theorem.cas-check.v0` JSON record plus Markdown report under `.theorem-workbench/cas/`, then use `theorem cas list` to find CAS-check artifacts for claims, route obligations, audits, snapshots, research sessions, or agent follow-up. A passing Maxima agreement can support `cross-checked`, never `proved`; missing Maxima, translation failures, execution errors, disagreements, or unparseable output remain `unverified`. Route obligations and claim records parse CAS-check artifacts strictly, so malformed JSON that merely claims `trust: cross-checked` cannot satisfy an independent-check gate. Add `--fail-on-unverified` when CI or an agent workflow must stop unless the independent CAS check agrees.

SMT commands can probe local Z3 availability with `theorem smt backends` and can check local SMT-LIB artifacts with `theorem smt check <file>`. `theorem smt solve --int x --constraint "x > 0"` builds a workspace-local SMT-LIB source from explicit integer constraints, stores it under `.theorem-workbench/smt/sources/`, then writes a paired `theorem.smt-check.v0` JSON record plus Markdown report under `.theorem-workbench/smt/`. When `--model` is used and Z3 returns `sat`, the record keeps raw stdout and also extracts simple `define-fun` bindings into structured JSON for agent follow-up. Use `theorem smt list` to find solver artifacts for audits, snapshots, research sessions, or agent follow-up. A check is labeled `smt-checked` only when Z3 returns `sat` or `unsat` for the concrete SMT-LIB file; missing Z3, execution errors, `unknown`, or unrecognized output remain `unverified`. Route obligations and claim records parse SMT-check artifacts strictly, so malformed JSON that merely claims `trust: smt-checked` cannot satisfy a solver-encoding gate. SMT evidence is not a `proved` label and is not proof of surrounding informal, scientific, medical, safety, regulatory, or patent claims.

Vault commands encrypt workspace-local files into `.theorem-workbench/vault/` with AES-256-GCM and a scrypt-derived key from an environment variable. Vault envelopes are local artifacts with safe public labels and ciphertext metadata; original filenames, plaintext hashes, and bytes stay inside the encrypted payload until a local verify/open operation. Do not put vault keys in prompts, manifests, receipts, or source control.

Audit commands classify a claim against local evidence refs and write `theorem.evidence-audit.v0` records plus optional Markdown reports. They flag missing evidence, biomedical/patent/simulation overclaims, narrow proof scope, and required next checks before an agent or human presents a claim as true.

Validation plan commands write `theorem.validation-plan.v0` records into `.theorem-workbench/validation/`. They turn an audited claim into explicit gates such as proof, source citation, simulation review, wet-lab work, replication, preclinical/clinical validation, safety, ethics, regulatory review, prior art, claim charts, reduction to practice, and patent legal review. They are local checklists, not proof that those gates are satisfied.

Workspace snapshot commands write `theorem.workspace-snapshot.v0` records into `.theorem-workbench/snapshots/`. They hash local artifacts, extract schema/id metadata, and let humans or agents verify whether evidence changed, disappeared, or was added since a prior research checkpoint. Snapshots verify provenance and drift; they do not prove scientific, mathematical, medical, regulatory, or legal truth.

Research session commands write `theorem.research-session.v0` runbooks into `.theorem-workbench/sessions/`. They give Claude, Codex, and humans a local anchor for long investigations: objective, domains, hypotheses, claims to verify, evidence refs, snapshot refs, bounded budgets, decisions, checkpoints, and next validation checks. Sessions preserve the rule that hosted models are optional collaborators with disclosure, not authorities.

Expert review commands write `theorem.expert-review.v0` records into `.theorem-workbench/reviews/`. They capture reviewer role, scope, evidence refs, findings, limitations, recommendations, outcome, and required next checks. They make human review visible without pretending the software itself provides proof, medical advice, regulatory approval, or legal advice.

Model-context commands write `theorem.model-context.v0` packets into `.theorem-workbench/model-contexts/`. They prepare a minimal selected-context packet for a hosted model, local model, or external service, but they do not call that service. Their job is to keep frontier-model collaboration explicit: purpose, service/model, selected data classes, included sections, exclusions, redactions, approval, and disclosure status are visible before anything leaves the machine.

Disclosure commands write local audit records for any selected context sent to hosted models, external CAS services, scientific APIs, lab services, or other non-local systems. They do not make the call; they record service, model, purpose, data classes, context summary, approval ref, status, and warnings so frontier-model workflows remain explicit and reviewable.

Workspace validation allows preflight model-context packets before anything is sent, but fails records marked `sent` or `received` unless they preserve the local audit trail: approved model context, disclosure linkage, human approval ref, and selected-context refs.

Simulation commands write local computational evidence records with model assumptions, parameters, metrics, uncertainty, limitations, and next validation checks. They intentionally mark simulation output as computational evidence, not real-world, clinical, safety, regulatory, or patent validation.

Experiment commands write local protocol/data/analysis/observation records with ethics, safety, replication, and regulatory review metadata. They intentionally mark observations as protocol-scoped evidence, not broad proof of safety, efficacy, clinical validity, regulatory approval, or patentability.

Invention log commands write local provenance records for hypotheses, evidence references, novelty notes, prior-art notes, risks, and next checks. Claim-chart commands turn invention logs into local patent-review aids with explicit claim elements, evidence refs, prior-art notes, reduction-to-practice refs, and legal disclaimers. They intentionally mark patent conclusions as requiring human legal review and warn when computational hypotheses are not experimentally, clinically, or regulatorily validated.

Discovery package reports render invention logs into local Markdown summaries with evidence review, validation requirements, overclaim warnings, patent posture, and next checks. They are designed for review packages, not for claiming a validated breakthrough.

Symbolic prompts use a local Python subprocess and require SymPy:

```bash
python -m pip install sympy==1.14.0
```

On Windows, `py -m pip install sympy==1.14.0` works too.

Receipt JSON is shaped by [schemas/receipt.schema.json](schemas/receipt.schema.json), claim ledger records are shaped by [schemas/claim-ledger.schema.json](schemas/claim-ledger.schema.json), CAS-check records are shaped by [schemas/cas-check.schema.json](schemas/cas-check.schema.json), proof-check records are shaped by [schemas/proof-check.schema.json](schemas/proof-check.schema.json), SMT-check records are shaped by [schemas/smt-check.schema.json](schemas/smt-check.schema.json), code-run records are shaped by [schemas/code-run.schema.json](schemas/code-run.schema.json), benchmark records are shaped by [schemas/benchmark-run.schema.json](schemas/benchmark-run.schema.json), benchmark comparisons are shaped by [schemas/benchmark-comparison.schema.json](schemas/benchmark-comparison.schema.json), and workspace validation reports are shaped by [schemas/workspace-validation.schema.json](schemas/workspace-validation.schema.json), so future CLI, MCP, CI, and web surfaces can share the same artifact contracts.

The MCP server exposes the same receipt engine to agents:

```bash
npm run mcp
```

MCP also exposes local workspace init/status/repair, workspace validation, workspace snapshot/list/verify, claim-ledger add/list/show/review, CAS-backend readiness probes, CAS checks/write/list, proof-backend readiness probes, Lean proof artifact checks/write/list, SMT-backend readiness probes, SMT-LIB checks/write/list, benchmark-run record writing and benchmark comparison, research-session start/checkpoint/list, expert-review log/list, validation-plan create/list, source ingest/search, literature log/list, notebook-run log/list, code sandbox-status/run/list tools, vault seal/list/verify, evidence-audit, model-context prepare/list, disclosure-log, simulation-log, experiment-log, invention-log, and claim-chart tools so agents can work against private local evidence instead of relying on memory or unsupported claims. MCP code execution is disabled unless the server process is launched with `THEOREM_ALLOW_CODE_RUN=1` and each call supplies an explicit executable allowlist. Unsandboxed MCP code execution also requires `THEOREM_ALLOW_UNSANDBOXED_CODE_RUN=1`; otherwise agents must set `policy.requireSandbox: true`, which fails closed until a measured sandbox provider is available.

The launch proof script runs the public demo gates:

```bash
npm run proof:launch
```

The stricter engine-backed launch gate adds real Maxima CAS and Z3 SMT runs. Use Docker for this path unless the host already has Maxima and Z3 installed:

```bash
npm run proof:launch:engines
npm run docker:proof
```

See [docs/TRUST_LABELS.md](docs/TRUST_LABELS.md) for the conservative meaning of each trust label and the current rule that local parity certificates are `exact-computed`, not `proved`.

See [docs/ENGINE_STRATEGY.md](docs/ENGINE_STRATEGY.md) for the boundary between Truth Harness's native verification engine and the external solvers/adapters it uses.

See [docs/RESEARCH_AND_ARCHITECTURE.md](docs/RESEARCH_AND_ARCHITECTURE.md) for the current naming check, open-source landscape, architecture, data structures, CLI/MCP surface, benchmarking surface, and test strategy.

See [docs/CREDIBILITY_AND_GROWTH_STRATEGY.md](docs/CREDIBILITY_AND_GROWTH_STRATEGY.md) for the public positioning, expert credibility rules, viral wedges, launch demos, and community strategy.

See [docs/MOAT.md](docs/MOAT.md) for the product moat: claim ledger plus verifier ladder plus local agent harness.

See [docs/OPEN_SOURCE_AND_COMMERCIAL_STRATEGY.md](docs/OPEN_SOURCE_AND_COMMERCIAL_STRATEGY.md) for the recommended private-prototype -> closed-alpha -> open-source technical-preview path and AGPL-3.0 visible-attribution posture. The short version: keep the trust-critical core open-source long term, keep the rough prototype private until credibility gates pass, and preserve visible credit to Truth Harness by Ocean Bennett.

See [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) for the first Hacker News-ready demo path.

See [docs/AGENT_SETUP.md](docs/AGENT_SETUP.md) for Claude Code and Codex MCP setup.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before opening benchmark, adapter, or agent-workflow changes.

# Agent Setup

Date: 2026-06-08

Truth Harness exposes a local stdio MCP server so Claude, Codex, and other MCP clients can ask for proof receipts, persisted verifier routes, benchmark runs and comparisons, local source search, structured local literature records, notebook-run provenance records, policy-gated direct code-run records, encrypted vault metadata, evidence audits, workspace validation and repair, workspace provenance snapshots, local model-context packets, external-call disclosure records, local simulation and experiment evidence, and private discovery logs.

## Build First

```bash
npm install
npm run build
```

The server entrypoint is:

```bash
node packages/mcp-server/dist/index.js
```

## Tools

Agents should call `truth_harness_engine_manifest` before routing serious work through proof, SMT, CAS, code, simulation, or source workflows. The manifest is a local readiness and trust-boundary map: it can say which capabilities are ready, missing, planned, or safety-gated, but the manifest itself is not evidence for a claim. Use `truth_harness_verify` when an agent needs both a receipt and a verifier route/gap ledger; set `write: true` when the route should become a durable local artifact under `.truth-harness/routes/`. Then use `truth_harness_route_list`, `truth_harness_route_show`, and `truth_harness_route_satisfy` as the local work loop: find open or critical-open obligations, attach accepted local evidence, and only promote the claim after the route readiness says it is ready for a narrow claim. A not-ready `route:` ref stays attached to claim records as unverified evidence and becomes a finalization blocker. Use `truth_harness_ask` when a receipt alone is enough.

Before an agent presents a ledger claim as usable, call `truth_harness_claim_review`. It returns a read-only review packet with `reviewStatus`, conservative decision text, blocking checks, evidence refs, next actions, and local CLI commands. Treat any status except `ready` as a stop sign for final claims; continue gathering evidence, narrow the wording, or label the result unverified/refuted.

| Tool | Purpose |
| --- | --- |
| `truth_harness_ask` | Create a receipt for a math prompt, with optional strict mode. |
| `truth_harness_verify` | Create a manifest-aware verifier route plus receipt, including used capabilities, missing verifier gaps, next actions, and conservative final trust; can write JSON plus Markdown under `.truth-harness/routes/`. |
| `truth_harness_route_list` | List private local verifier-route records with reusable ids, paths, and proof-obligation counts for open, critical-open, satisfied, and not-required gates. |
| `truth_harness_route_show` | Read one persisted verifier route by route id or workspace-local JSON path, including proof obligations, next actions, and evidence already attached. |
| `truth_harness_route_satisfy` | Attach accepted local evidence to a route proof obligation and rewrite the route with updated satisfied/open obligation state. |
| `truth_harness_benchmark_run` | Run the seed benchmark suite or a workspace-local suite path. |
| `truth_harness_benchmark_compare` | Compare two benchmark-run records and optionally write a local benchmark-comparison artifact. |
| `truth_harness_benchmark_list` | List local benchmark run/comparison artifacts with reusable paths. |
| `truth_harness_engine_manifest` | Inspect native kernels, external adapters, safety boundaries, planned engines, and the trust labels each can mint only after concrete evidence runs. |
| `truth_harness_proof_backends` | Probe accepted local proof-checker backend readiness without network access; a status probe is not proof. |
| `truth_harness_proof_check` | Check a workspace-local Lean proof artifact and optionally write a local proof-check record; only accepted Lean runs can return `proved`. |
| `truth_harness_proof_list` | List private local proof-check records with reusable JSON and Markdown paths. |
| `truth_harness_smt_backends` | Probe local SMT solver readiness without network access; a status probe is not a solver check. |
| `truth_harness_smt_check` | Check a workspace-local SMT-LIB artifact with Z3 and optionally write a local SMT-check record. |
| `truth_harness_smt_list` | List private local SMT-check records with reusable JSON and Markdown paths. |
| `truth_harness_smt_solve` | Build workspace-local SMT-LIB from explicit integer constraints and run the SMT-check workflow. |
| `truth_harness_workspace_init` | Initialize the private `.truth-harness/` local project store. |
| `truth_harness_workspace_status` | Check local workspace status and missing directories. |
| `truth_harness_workspace_repair` | Create missing private workspace directories and persist newly added manifest defaults. |
| `truth_harness_workspace_validate` | Validate local evidence artifacts before agents rely on them; receipts get deep trust-boundary checks and known workspace records get JSON Schema, id, reference, and trust-boundary checks. |
| `truth_harness_workspace_graph` | Build a read-only local evidence graph with artifact nodes, evidence edges, claim lineage, task/checkpoint refs, snapshots, and missing links. |
| `truth_harness_workspace_review` | Return or write a bounded local work queue across saved verifier routes, claim records, and active research sessions for agent handoff. |
| `truth_harness_workspace_review_list` / `truth_harness_workspace_review_show` | Reopen persisted review handoffs by id or path so agents can resume from exact local queues instead of chat memory. |
| `truth_harness_workspace_snapshot` | Write a portable local provenance snapshot with hashes for workspace artifacts. |
| `truth_harness_workspace_snapshot_list` | List private local workspace snapshots. |
| `truth_harness_workspace_snapshot_verify` | Verify a snapshot and report changed, missing, or added artifacts. |
| `truth_harness_research_session_start` | Start a private local research runbook with objective, budgets, evidence refs, snapshot refs, and review boundaries. |
| `truth_harness_research_session_checkpoint` | Append a checkpoint with decisions, evidence refs, snapshot refs, and next validation checks. |
| `truth_harness_research_session_task_update` | Update one task status with evidence refs and next checks; `done` requires evidence and `blocked` requires a next check. |
| `truth_harness_research_session_show` | Reopen one private local research session by id or path before adding more checkpoints. |
| `truth_harness_research_session_list` | List private local research sessions. |
| `truth_harness_expert_review_log` | Write a private local human expert-review record with scope, evidence refs, limitations, outcome, and next checks. |
| `truth_harness_expert_review_list` | List private local expert-review records. |
| `truth_harness_source_ingest` | Ingest workspace-local Markdown/text files into the private local corpus index. |
| `truth_harness_source_search` | Search local source chunks and return `source-cited` retrieval hits. |
| `truth_harness_source_cite` | Create a receipt for a claim using local source hits. |
| `truth_harness_literature_log` | Create or write a private local paper, patent, dataset, database-export, or prior-art evidence record. |
| `truth_harness_literature_list` | List private local literature evidence records. |
| `truth_harness_notebook_run_log` | Create or write a private local notebook, script, or pipeline run provenance record without executing code. |
| `truth_harness_notebook_run_list` | List private local notebook-run records. |
| `truth_harness_code_sandbox_status` | Report whether a measured code-run sandbox is available before requesting code execution. |
| `truth_harness_code_run` | Execute a local command without shell interpolation under the default local execution policy and write a private local code-run record. Disabled unless the MCP process has `TRUTH_HARNESS_ALLOW_CODE_RUN=1`; unsandboxed MCP execution also requires `TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN=1`, and every call requires an explicit executable allowlist. |
| `truth_harness_code_list` | List private local code-run records. |
| `truth_harness_vault_seal` | Encrypt a workspace-local file into the private local vault using an environment-provided key. |
| `truth_harness_vault_list` | List encrypted local vault envelopes without decrypting plaintext. |
| `truth_harness_vault_verify` | Decrypt locally and return integrity metadata only, not plaintext bytes. |
| `truth_harness_evidence_audit` | Audit a claim against local evidence refs and flag overclaim risk plus required next checks; can write JSON plus Markdown reports. |
| `truth_harness_evidence_audit_list` | List private local evidence audits. |
| `truth_harness_claim_add` | Write a private local claim ledger record with dependencies, supersession links, tags, evidence refs, trust label, and finalization gates. |
| `truth_harness_claim_list` | List and filter local claim ledger records with the dependency/supersession graph. |
| `truth_harness_claim_show` | Read one local claim record by id or workspace-local JSON path. |
| `truth_harness_claim_review` | Return a read-only claim review packet with readiness, blockers, verification ladder, evidence refs, next actions, and local commands for agents. |
| `truth_harness_validation_plan` | Create or write private local validation-gate plans before stronger discovery, biomedical, patent, simulation, or engineering claims. |
| `truth_harness_validation_plan_list` | List private local validation plans. |
| `truth_harness_model_context_prepare` | Prepare a private local selected-context packet before any hosted model, local model, or external service collaboration. |
| `truth_harness_model_context_list` | List private local model-context packets. |
| `truth_harness_disclosure_log` | Write a private audit record for selected context sent to an external model or service. |
| `truth_harness_disclosure_list` | List private external model/service disclosure records. |
| `truth_harness_simulation_log` | Write a private simulation evidence record with assumptions, metrics, uncertainty, and caveats. |
| `truth_harness_simulation_list` | List private simulation evidence records. |
| `truth_harness_experiment_log` | Write a private experiment evidence record with protocol/data/analysis refs and review caveats. |
| `truth_harness_experiment_list` | List private experiment evidence records. |
| `truth_harness_invention_log` | Write a private discovery/invention hypothesis log with evidence refs and overclaim warnings. |
| `truth_harness_invention_list` | List private invention/discovery logs. |
| `truth_harness_claim_chart` | Render or write a local patent claim chart for an invention log with legal-review caveats. |
| `truth_harness_claim_chart_list` | List private patent claim charts. |
| `truth_harness_discovery_package` | Render or write a local Markdown discovery package for an invention log. |
| `truth_harness_replay` | Replay a receipt from JSON or a workspace-local receipt path. |
| `truth_harness_render_receipt` | Render a receipt as Markdown or HTML for reports and documents. |

Strict mode is useful when an agent must not proceed from unverified claims. If `truth_harness_ask` returns `unverified` and `strict` is true, the MCP tool response is marked as an error. For serious multi-step work, prefer `truth_harness_verify` with `write: true`, then cite the persisted route id in claim ledger records, audits, validation plans, research-session checkpoints, or reports.

## Claude Code

This repo includes a project-scoped [.mcp.json](../.mcp.json). Claude Code supports project-scoped MCP configurations and asks for approval before using them.

From the repo root:

```bash
claude
/mcp
```

Approve `truth-harness`, then ask:

> Use truth_harness_workspace_init, truth_harness_source_ingest on docs, truth_harness_source_cite for "Truth Harness is built for verified math agents", and truth_harness_ask to check whether "for all integers n, n^2+n+1 is even" is true.

You can also add it manually:

```bash
claude mcp add --transport stdio truth-harness -- node packages/mcp-server/dist/index.js
claude mcp list
```

## Codex

OpenAI's Codex MCP docs say Codex supports stdio MCP servers in the CLI and IDE extension, with configuration stored in `config.toml`.

Using the CLI from the repo root:

```bash
codex mcp add truth-harness -- node packages/mcp-server/dist/index.js
codex mcp list
```

Or add a project-scoped `.codex/config.toml` in trusted projects:

```toml
[mcp_servers.truth-harness]
command = "node"
args = ["packages/mcp-server/dist/index.js"]
cwd = "."
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "prompt"
```

Suggested `AGENTS.md` instruction:

```text
Truth Harness is local-first. Keep project data, verifier routes, claim ledger records, source material, literature records, notebook-run records, code-run records, proof-check records, SMT-check records, benchmark-run records, intermediate calculations, simulations, experiments, invention notes, vault envelopes, snapshots, and reports inside the local `.truth-harness/` store unless the user explicitly approves selected context for an external model or service. Use the best available local tools first. Use the latest capable hosted models only as opt-in reasoning collaborators: prepare a minimal selected-context packet with `truth_harness_model_context_prepare`, send only the approved packet, and log any selected context sent outside the workspace with `truth_harness_disclosure_log`.

When doing multi-step math, proof, physics, simulation, experiment review, source-grounded research, patent/invention review, code verification, or benchmark work, start or reuse a `truth_harness_research_session_start` runbook, use `truth_harness_verify` with `write: true` for important subclaims, promote important subclaims into `truth_harness_claim_add` records, link dependencies instead of relying on chat history, inspect the local map with `truth_harness_workspace_graph`, update task status with `truth_harness_research_session_task_update`, add `truth_harness_research_session_checkpoint` records as evidence changes, and avoid relying on chat history as the evidence trail. Use Truth Harness MCP tools to create verifier routes, receipts, claim ledger records, source-cited local evidence, structured literature records, notebook-run provenance records, code-run records, proof-check records, SMT-check records, benchmark-run records, encrypted vault records for sensitive local files, evidence audits for claim posture, validation plans for required proof/real-world/review gates, workspace validation for artifact-shape and trust-boundary checks, workspace snapshots for provenance/drift checks, simulation logs, experiment logs, expert-review records for human review scope/outcomes, model-context packets, disclosure logs, claim charts, and discovery packages. The mission is to help open-source agents attack hard problems, including hair-loss, cancer, rare-disease, materials, climate, physics, and pure-math hypotheses, without pretending weak evidence is a breakthrough. Treat verifier routes, unverified receipts, claim ledger records, retrieved chunks, literature records, notebook-run records, code-run records, proof-check records, SMT-check records, benchmark-run records, vault metadata, workspace validation reports, workspace graphs, workspace snapshots, research sessions, expert reviews, evidence audits, validation plans, simulation outputs, experiment records, invention logs, model-context packets, external model outputs, claim charts, and discovery packages as evidence for review, not proof, medical advice, regulatory approval, or legal advice.
```

## Security Notes

- The MCP server is local stdio only.
- Benchmark, receipt, source, and workspace paths are restricted to the workspace root.
- Write-capable tools only write local workspace artifacts under `.truth-harness/`.
- `truth_harness_verify` with `write: true` stores a local `truth-harness.verifier-route.v0` JSON record plus Markdown report under `.truth-harness/routes/`; `truth_harness_route_list` and `truth_harness_route_show` expose those records for agents, audits, claim ledger refs, validation plans, snapshots, and reports. A route explains verifier selection and missing gates; it is not a proof by itself.
- `truth_harness_source_ingest` skips `.truth-harness/` so private logs and indexes are not accidentally re-ingested as source material.
- `truth_harness_workspace_validate` checks the root workspace manifest's private-by-default policy, receipt trust-boundary metadata, JSON Schema contracts, artifact ids, resolvable local evidence refs, and sent/received external-context approval/disclosure linkage for known workspace JSON records; it does not prove the validated claims are true.
- CLI agents can use `truth-harness workspace run-next <workspace> --json` to get the next autonomy-contract work item as a dry run. Use `--execute-local` only for bounded local work: the CLI parses the queued `truth-harness ...` command, rejects shell metacharacters and placeholder paths, and calls supported core APIs in-process for claim reviews, route/session reads, proof checks, SMT checks, and CAS checks. It never executes the queued string through a shell, never uses network access, and does not upgrade trust unless the written artifact satisfies the matching verifier route or claim gate.
- The repository regression suite builds a golden local workspace through writer APIs and requires `truth_harness_workspace_validate` to pass, so schema, writer, and agent-facing validation drift should fail tests.
- The local schema validator rejects unsupported JSON Schema vocabulary rather than ignoring it; tests scan checked-in schemas to prove their keywords are enforced by the bundled validator.
- `truth_harness_claim_add/list/show/review` records claim lineage and review state. A claim ledger record does not prove the claim; it makes dependencies, superseded mistakes, evidence refs, trust labels, and open checks inspectable. `truth_harness_claim_review` is the agent gate before relying on a claim; non-ready packets should block final wording.
- `truth_harness_literature_log` records local literature/source metadata and review caveats only; it does not call external databases or prove entailment, safety, efficacy, novelty, or patentability.
- `truth_harness_notebook_run_log` records provenance and replay metadata only; it does not execute code, verify outputs, or prove scientific, safety, regulatory, or patent claims.
- `truth_harness_code_sandbox_status` reports whether a measured code-run sandbox is available. `truth_harness_code_run` executes a local command directly without shell interpolation and writes stdout/stderr/exit/policy metadata locally. It is disabled unless the MCP process has `TRUTH_HARNESS_ALLOW_CODE_RUN=1`. Unsandboxed MCP execution is separately disabled unless the process also has `TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN=1`; otherwise the agent must set `policy.requireSandbox: true`, which fails closed on native hosts and can pass inside the measured Docker no-network provider. Each call must provide an explicit executable allowlist. The default local policy blocks shell launchers, obvious network clients, destructive commands, package mutations, and git mutations unless explicitly overridden. Execution is async with per-workspace concurrency limits, a 120s timeout cap, and 1 MiB per-stream output caps. Native host code-run records say `networkAccess: unknown`; measured Docker no-network records can say `networkAccess: none`. Both prove only bounded local process execution under the recorded policy, not code correctness, scientific validity, safety, regulatory approval, or patentability.
- `truth_harness_benchmark_run` can write `truth-harness.benchmark-run.v0` records when `write` is true and can mark the MCP call as an error when `failOnFailures` is true; benchmark scores measure system behavior and regression posture, not mathematical, scientific, medical, regulatory, or legal truth by themselves.
- `truth_harness_benchmark_compare` can write `truth-harness.benchmark-comparison.v0` records when `write` is true and can mark the MCP call as an error when `failOnRegression` is true; comparison verdicts flag recorded-run regressions or improvements, not broad model quality or discovery validity.
- `truth_harness_proof_backends` only probes local proof-checker availability. It does not check a proof artifact, does not upload anything, and does not justify a `proved` label without a successful accepted proof-checking run.
- `truth_harness_proof_check` reads a workspace-local Lean file and runs the configured local Lean command. When `write` is true, it stores a local `truth-harness.proof-check.v0` JSON record plus Markdown report under `.truth-harness/proofs/`, and `truth_harness_proof_list` returns those reusable paths. Missing Lean, execution errors, syntax errors, incomplete proofs, and rejected proof attempts return `unverified`; use `failOnUnproved` when an agent must stop unless Lean accepts the artifact.
- `truth_harness_smt_backends` only probes local SMT solver availability. It does not check a constraint file, does not upload anything, and does not justify `smt-checked` without a concrete solver run.
- `truth_harness_smt_check` reads a workspace-local SMT-LIB file and runs the configured local Z3 command. When `write` is true, it stores a local `truth-harness.smt-check.v0` JSON record plus Markdown report under `.truth-harness/smt/`, and `truth_harness_smt_list` returns those reusable paths. `truth_harness_smt_solve` first generates a workspace-local `.smt2` source under `.truth-harness/smt/sources/` from explicit integer variables and constraints, then runs the same check workflow. If the SMT-LIB asks for a model and Z3 returns `sat`, use the structured `model.bindings` field for follow-up constraints instead of scraping stdout. `sat` and `unsat` can return `smt-checked`; missing Z3, execution errors, `unknown`, and unrecognized output remain `unverified`. SMT evidence is not a `proved` label.
- `truth_harness_workspace_snapshot` hashes local workspace artifacts but excludes snapshot files to avoid self-reference; `truth_harness_workspace_snapshot_verify` checks drift, not truth.
- `truth_harness_research_session_start`, `truth_harness_research_session_task_update`, and `truth_harness_research_session_checkpoint` write local runbooks; they organize investigations but do not prove any claim by themselves.
- `truth_harness_expert_review_log` records human review scope and outcomes; it is not proof, medical advice, regulatory approval, or legal advice from the software.
- `truth_harness_vault_seal` requires the vault key in an environment variable and stores encrypted envelopes locally; do not pass vault keys in prompts or tool arguments.
- `truth_harness_vault_verify` decrypts locally but returns only provenance/integrity metadata, not plaintext bytes.
- `truth_harness_evidence_audit` flags evidence posture and overclaim risk; use `writeReport` for human Markdown review packets. It is not proof, medical advice, regulatory approval, or legal advice.
- `truth_harness_validation_plan` turns an audited claim into local validation gates; it is not proof that the gates are satisfied.
- `truth_harness_model_context_prepare` writes a local pre-flight packet only; it does not call a model, upload data, or prove that the selected context is safe to disclose.
- `truth_harness_disclosure_log` records external context disclosures locally; it does not call the external service itself.
- `truth_harness_simulation_log` records computational evidence locally; it does not imply experimental, clinical, safety, regulatory, or patent validation.
- `truth_harness_experiment_log` records protocol-scoped observations locally; it does not imply safety, efficacy, clinical validity, regulatory approval, or broad real-world truth.
- `truth_harness_claim_chart` records local patent-review structure; it does not determine patentability, novelty, non-obviousness, freedom to operate, inventorship, or filing readiness.
- Do not expose this stdio command through an untrusted remote wrapper.

## Sources

- [Model Context Protocol TypeScript SDK](https://modelcontextprotocol.io/docs/develop/build-server)
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)
- [OpenAI Codex MCP docs](https://developers.openai.com/codex/mcp)

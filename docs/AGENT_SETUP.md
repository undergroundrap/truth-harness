# Agent Setup

Date: 2026-06-08

Theorem Workbench exposes a local stdio MCP server so Claude, Codex, and other MCP clients can ask for proof receipts, benchmark runs and comparisons, local source search, structured local literature records, notebook-run provenance records, policy-gated direct code-run records, encrypted vault metadata, evidence audits, workspace validation and repair, workspace provenance snapshots, local model-context packets, external-call disclosure records, local simulation and experiment evidence, and private discovery logs.

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

| Tool | Purpose |
| --- | --- |
| `theorem_ask` | Create a receipt for a math prompt, with optional strict mode. |
| `theorem_benchmark_run` | Run the seed benchmark suite or a workspace-local suite path. |
| `theorem_benchmark_compare` | Compare two benchmark-run records and optionally write a local benchmark-comparison artifact. |
| `theorem_benchmark_list` | List local benchmark run/comparison artifacts with reusable paths. |
| `theorem_proof_backends` | Probe accepted local proof-checker backend readiness without network access; a status probe is not proof. |
| `theorem_proof_check` | Check a workspace-local Lean proof artifact and optionally write a local proof-check record; only accepted Lean runs can return `proved`. |
| `theorem_proof_list` | List private local proof-check records with reusable JSON and Markdown paths. |
| `theorem_smt_backends` | Probe local SMT solver readiness without network access; a status probe is not a solver check. |
| `theorem_smt_check` | Check a workspace-local SMT-LIB artifact with Z3 and optionally write a local SMT-check record. |
| `theorem_smt_list` | List private local SMT-check records with reusable JSON and Markdown paths. |
| `theorem_smt_solve` | Build workspace-local SMT-LIB from explicit integer constraints and run the SMT-check workflow. |
| `theorem_workspace_init` | Initialize the private `.theorem-workbench/` local project store. |
| `theorem_workspace_status` | Check local workspace status and missing directories. |
| `theorem_workspace_repair` | Create missing private workspace directories and persist newly added manifest defaults. |
| `theorem_workspace_validate` | Validate local evidence artifacts before agents rely on them; receipts get deep trust-boundary checks and known workspace records get JSON Schema, id, reference, and trust-boundary checks. |
| `theorem_workspace_snapshot` | Write a portable local provenance snapshot with hashes for workspace artifacts. |
| `theorem_workspace_snapshot_list` | List private local workspace snapshots. |
| `theorem_workspace_snapshot_verify` | Verify a snapshot and report changed, missing, or added artifacts. |
| `theorem_research_session_start` | Start a private local research runbook with objective, budgets, evidence refs, snapshot refs, and review boundaries. |
| `theorem_research_session_checkpoint` | Append a checkpoint with decisions, evidence refs, snapshot refs, and next validation checks. |
| `theorem_research_session_list` | List private local research sessions. |
| `theorem_expert_review_log` | Write a private local human expert-review record with scope, evidence refs, limitations, outcome, and next checks. |
| `theorem_expert_review_list` | List private local expert-review records. |
| `theorem_source_ingest` | Ingest workspace-local Markdown/text files into the private local corpus index. |
| `theorem_source_search` | Search local source chunks and return `source-cited` retrieval hits. |
| `theorem_source_cite` | Create a receipt for a claim using local source hits. |
| `theorem_literature_log` | Create or write a private local paper, patent, dataset, database-export, or prior-art evidence record. |
| `theorem_literature_list` | List private local literature evidence records. |
| `theorem_notebook_run_log` | Create or write a private local notebook, script, or pipeline run provenance record without executing code. |
| `theorem_notebook_run_list` | List private local notebook-run records. |
| `theorem_code_run` | Execute a local command without shell interpolation under the default local execution policy and write a private local code-run record. Disabled unless the MCP process has `THEOREM_ALLOW_CODE_RUN=1`; each call requires an explicit executable allowlist. |
| `theorem_code_list` | List private local code-run records. |
| `theorem_vault_seal` | Encrypt a workspace-local file into the private local vault using an environment-provided key. |
| `theorem_vault_list` | List encrypted local vault envelopes without decrypting plaintext. |
| `theorem_vault_verify` | Decrypt locally and return integrity metadata only, not plaintext bytes. |
| `theorem_evidence_audit` | Audit a claim against local evidence refs and flag overclaim risk plus required next checks; can write JSON plus Markdown reports. |
| `theorem_evidence_audit_list` | List private local evidence audits. |
| `theorem_validation_plan` | Create or write private local validation-gate plans before stronger discovery, biomedical, patent, simulation, or engineering claims. |
| `theorem_validation_plan_list` | List private local validation plans. |
| `theorem_model_context_prepare` | Prepare a private local selected-context packet before any hosted model, local model, or external service collaboration. |
| `theorem_model_context_list` | List private local model-context packets. |
| `theorem_disclosure_log` | Write a private audit record for selected context sent to an external model or service. |
| `theorem_disclosure_list` | List private external model/service disclosure records. |
| `theorem_simulation_log` | Write a private simulation evidence record with assumptions, metrics, uncertainty, and caveats. |
| `theorem_simulation_list` | List private simulation evidence records. |
| `theorem_experiment_log` | Write a private experiment evidence record with protocol/data/analysis refs and review caveats. |
| `theorem_experiment_list` | List private experiment evidence records. |
| `theorem_invention_log` | Write a private discovery/invention hypothesis log with evidence refs and overclaim warnings. |
| `theorem_invention_list` | List private invention/discovery logs. |
| `theorem_claim_chart` | Render or write a local patent claim chart for an invention log with legal-review caveats. |
| `theorem_claim_chart_list` | List private patent claim charts. |
| `theorem_discovery_package` | Render or write a local Markdown discovery package for an invention log. |
| `theorem_replay` | Replay a receipt from JSON or a workspace-local receipt path. |
| `theorem_render_receipt` | Render a receipt as Markdown or HTML for reports and documents. |

Strict mode is useful when an agent must not proceed from unverified claims. If `theorem_ask` returns `unverified` and `strict` is true, the MCP tool response is marked as an error.

## Claude Code

This repo includes a project-scoped [.mcp.json](../.mcp.json). Claude Code supports project-scoped MCP configurations and asks for approval before using them.

From the repo root:

```bash
claude
/mcp
```

Approve `theorem-workbench`, then ask:

> Use theorem_workspace_init, theorem_source_ingest on docs, theorem_source_cite for "Theorem Workbench is built for verified math agents", and theorem_ask to check whether "for all integers n, n^2+n+1 is even" is true.

You can also add it manually:

```bash
claude mcp add --transport stdio theorem-workbench -- node packages/mcp-server/dist/index.js
claude mcp list
```

## Codex

OpenAI's Codex MCP docs say Codex supports stdio MCP servers in the CLI and IDE extension, with configuration stored in `config.toml`.

Using the CLI from the repo root:

```bash
codex mcp add theorem-workbench -- node packages/mcp-server/dist/index.js
codex mcp list
```

Or add a project-scoped `.codex/config.toml` in trusted projects:

```toml
[mcp_servers.theorem-workbench]
command = "node"
args = ["packages/mcp-server/dist/index.js"]
cwd = "."
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "prompt"
```

Suggested `AGENTS.md` instruction:

```text
Theorem Workbench is local-first. Keep project data, source material, literature records, notebook-run records, code-run records, proof-check records, SMT-check records, benchmark-run records, intermediate calculations, simulations, experiments, invention notes, vault envelopes, snapshots, and reports inside the local `.theorem-workbench/` store unless the user explicitly approves selected context for an external model or service. Use the best available local tools first. Use the latest capable hosted models only as opt-in reasoning collaborators: prepare a minimal selected-context packet with `theorem_model_context_prepare`, send only the approved packet, and log any selected context sent outside the workspace with `theorem_disclosure_log`.

When doing multi-step math, proof, physics, simulation, experiment review, source-grounded research, patent/invention review, code verification, or benchmark work, start or reuse a `theorem_research_session_start` runbook, add `theorem_research_session_checkpoint` records as evidence changes, and avoid relying on chat history as the evidence trail. Use Theorem Workbench MCP tools to create receipts, source-cited local evidence, structured literature records, notebook-run provenance records, code-run records, proof-check records, SMT-check records, benchmark-run records, encrypted vault records for sensitive local files, evidence audits for claim posture, validation plans for required proof/real-world/review gates, workspace validation for artifact-shape and trust-boundary checks, workspace snapshots for provenance/drift checks, simulation logs, experiment logs, expert-review records for human review scope/outcomes, model-context packets, disclosure logs, claim charts, and discovery packages. The mission is to help open-source agents attack hard problems, including hair-loss, cancer, rare-disease, materials, climate, physics, and pure-math hypotheses, without pretending weak evidence is a breakthrough. Treat unverified receipts, retrieved chunks, literature records, notebook-run records, code-run records, proof-check records, SMT-check records, benchmark-run records, vault metadata, workspace validation reports, workspace snapshots, research sessions, expert reviews, evidence audits, validation plans, simulation outputs, experiment records, invention logs, model-context packets, external model outputs, claim charts, and discovery packages as evidence for review, not proof, medical advice, regulatory approval, or legal advice.
```

## Security Notes

- The MCP server is local stdio only.
- Benchmark, receipt, source, and workspace paths are restricted to the workspace root.
- Write-capable tools only write local workspace artifacts under `.theorem-workbench/`.
- `theorem_source_ingest` skips `.theorem-workbench/` so private logs and indexes are not accidentally re-ingested as source material.
- `theorem_workspace_validate` checks the root workspace manifest's private-by-default policy, receipt trust-boundary metadata, JSON Schema contracts, artifact ids, resolvable local evidence refs, and sent/received external-context approval/disclosure linkage for known workspace JSON records; it does not prove the validated claims are true.
- The repository regression suite builds a golden local workspace through writer APIs and requires `theorem_workspace_validate` to pass, so schema, writer, and agent-facing validation drift should fail tests.
- The local schema validator rejects unsupported JSON Schema vocabulary rather than ignoring it; tests scan checked-in schemas to prove their keywords are enforced by the bundled validator.
- `theorem_literature_log` records local literature/source metadata and review caveats only; it does not call external databases or prove entailment, safety, efficacy, novelty, or patentability.
- `theorem_notebook_run_log` records provenance and replay metadata only; it does not execute code, verify outputs, or prove scientific, safety, regulatory, or patent claims.
- `theorem_code_run` executes a local command directly without shell interpolation and writes stdout/stderr/exit/policy metadata locally. It is disabled unless the MCP process has `THEOREM_ALLOW_CODE_RUN=1`, and each call must provide an explicit executable allowlist. The default local policy blocks shell launchers, obvious network clients, destructive commands, package mutations, and git mutations unless explicitly overridden. Current host execution is not OS-sandboxed, so code-run records say `networkAccess: unknown`; they prove only bounded local process execution, not absence of network access, code correctness, scientific validity, safety, regulatory approval, or patentability.
- `theorem_benchmark_run` can write `theorem.benchmark-run.v0` records when `write` is true and can mark the MCP call as an error when `failOnFailures` is true; benchmark scores measure system behavior and regression posture, not mathematical, scientific, medical, regulatory, or legal truth by themselves.
- `theorem_benchmark_compare` can write `theorem.benchmark-comparison.v0` records when `write` is true and can mark the MCP call as an error when `failOnRegression` is true; comparison verdicts flag recorded-run regressions or improvements, not broad model quality or discovery validity.
- `theorem_proof_backends` only probes local proof-checker availability. It does not check a theorem, does not upload anything, and does not justify a `proved` label without a successful accepted proof-checking run.
- `theorem_proof_check` reads a workspace-local Lean file and runs the configured local Lean command. When `write` is true, it stores a local `theorem.proof-check.v0` JSON record plus Markdown report under `.theorem-workbench/proofs/`, and `theorem_proof_list` returns those reusable paths. Missing Lean, execution errors, syntax errors, incomplete proofs, and rejected proof attempts return `unverified`; use `failOnUnproved` when an agent must stop unless Lean accepts the artifact.
- `theorem_smt_backends` only probes local SMT solver availability. It does not check a constraint file, does not upload anything, and does not justify `smt-checked` without a concrete solver run.
- `theorem_smt_check` reads a workspace-local SMT-LIB file and runs the configured local Z3 command. When `write` is true, it stores a local `theorem.smt-check.v0` JSON record plus Markdown report under `.theorem-workbench/smt/`, and `theorem_smt_list` returns those reusable paths. `theorem_smt_solve` first generates a workspace-local `.smt2` source under `.theorem-workbench/smt/sources/` from explicit integer variables and constraints, then runs the same check workflow. If the SMT-LIB asks for a model and Z3 returns `sat`, use the structured `model.bindings` field for follow-up constraints instead of scraping stdout. `sat` and `unsat` can return `smt-checked`; missing Z3, execution errors, `unknown`, and unrecognized output remain `unverified`. SMT evidence is not a `proved` label.
- `theorem_workspace_snapshot` hashes local workspace artifacts but excludes snapshot files to avoid self-reference; `theorem_workspace_snapshot_verify` checks drift, not truth.
- `theorem_research_session_start` and `theorem_research_session_checkpoint` write local runbooks; they organize investigations but do not prove any claim by themselves.
- `theorem_expert_review_log` records human review scope and outcomes; it is not proof, medical advice, regulatory approval, or legal advice from the software.
- `theorem_vault_seal` requires the vault key in an environment variable and stores encrypted envelopes locally; do not pass vault keys in prompts or tool arguments.
- `theorem_vault_verify` decrypts locally but returns only provenance/integrity metadata, not plaintext bytes.
- `theorem_evidence_audit` flags evidence posture and overclaim risk; use `writeReport` for human Markdown review packets. It is not proof, medical advice, regulatory approval, or legal advice.
- `theorem_validation_plan` turns an audited claim into local validation gates; it is not proof that the gates are satisfied.
- `theorem_model_context_prepare` writes a local pre-flight packet only; it does not call a model, upload data, or prove that the selected context is safe to disclose.
- `theorem_disclosure_log` records external context disclosures locally; it does not call the external service itself.
- `theorem_simulation_log` records computational evidence locally; it does not imply experimental, clinical, safety, regulatory, or patent validation.
- `theorem_experiment_log` records protocol-scoped observations locally; it does not imply safety, efficacy, clinical validity, regulatory approval, or broad real-world truth.
- `theorem_claim_chart` records local patent-review structure; it does not determine patentability, novelty, non-obviousness, freedom to operate, inventorship, or filing readiness.
- Do not expose this stdio command through an untrusted remote wrapper.

## Sources

- [Model Context Protocol TypeScript SDK](https://modelcontextprotocol.io/docs/develop/build-server)
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)
- [OpenAI Codex MCP docs](https://developers.openai.com/codex/mcp)

# Truth Harness — Architecture Audit (Claude)

Date: 2026-06-10
Auditor: Claude (deep repo inspection; every file reference below was verified against the working tree)
Audience: Codex, for review and implementation planning
Repo state audited: 9 commits, `main` tip `64b4668` ("feat: add bounded numeric interval receipts"), ~21k lines of first-party TypeScript across 4 workspaces, 30 test files, 18 JSON Schemas, 1 Python bridge.

> Codex follow-up note, 2026-06-10: the R1 trust-label issue identified below has been partially addressed after this audit. The local modular parity path now emits `exact-computed` with an explicit proof-checker boundary instead of minting `proved`; `proved` remains reserved for future accepted proof-checking backends such as Lean.

---

## 1. Executive Summary

### What the repo currently is

Truth Harness today is **two different systems sharing one monorepo**:

1. **A small, real, honest math verification kernel.** Exact rational arithmetic over bigints (`packages/core/src/rational.ts`), a recursive-descent expression parser (`packages/core/src/expression.ts`), finite counterexample search plus a Z/2Z modular parity proof kernel (`packages/core/src/parity-proof.ts`), conservative rational interval bounds (`packages/core/src/interval.ts`), SI dimensional analysis (`packages/core/src/dimension.ts`), and a sandbox-lite SymPy subprocess adapter (`packages/core/src/sympy.ts` + `tools/sympy_bridge.py`). All of it emits a `truth-harness.receipt.v0` evidence-graph receipt (`packages/core/src/receipt.ts`, `types.ts`) with deterministic content-addressed run IDs and a replay check (`replay.ts`).

2. **A large constellation of provenance record-writers.** Roughly 20 modules (`literature-record.ts`, `notebook-run.ts`, `simulation-log.ts`, `experiment-log.ts`, `invention-log.ts`, `claim-chart.ts`, `discovery-package.ts`, `disclosure-log.ts`, `model-context.ts`, `research-session.ts`, `expert-review.ts`, `validation-plan.ts`, `evidence-audit.ts`, `vault.ts`, `workspace-snapshot.ts`, `local-corpus.ts`, `local-workspace.ts`, …) that write JSON records into a git-ignored `.truth-harness/` store, exposed through a 3,087-line CLI (`apps/cli/src/index.ts`) and a ~40-tool MCP server (`packages/mcp-server/src/index.ts`, 1,479 lines).

System (1) computes things and can be wrong or right. System (2) **records what humans and agents claim happened** — it executes nothing, verifies almost nothing, and is honest about that in its docstrings, but the distinction is invisible at the artifact level: both produce similar-looking JSON with `privacy`, `warnings`, and schema-version fields.

### Does the architecture match the stated mission?

**Directionally yes; structurally not yet.** The mission is a "local-first evidence layer for agentic discovery." The repo gets the *values* right with unusual discipline: no network calls anywhere in first-party code, trust labels with explicit semantics, refutation-before-explanation, disclaimers on every biomedical/patent surface, an `AGENTS.md` contract that tells agents how to behave. That is rarer and more valuable than the code volume suggests.

But three structural gaps separate it from the mission:

- **The verification surface is a sliver.** The only things the system can actually verify are: integer-coefficient rational arithmetic, parity of univariate integer polynomials, interval bounds, SI dimensions, and five SymPy operations. No theorem prover, no SMT, no notebook execution, no simulation capture. Everything else is self-reported metadata.
- **The evidence layer is honor-system.** Schemas are not enforced (see §4 R2), evidence refs are strings that may or may not resolve, simulation/experiment "metrics" are typed by the person logging them, and the privacy/disclosure model records intent rather than constraining behavior.
- **The storage model will not scale past a single small project.** One JSON file per record, O(n) directory scans for every `list`/lookup, a single monolithic corpus index, no locking, no transactional writes, base64 ciphertext inlined in vault JSON.

### Strongest parts of the design

- **Trust-label taxonomy with refutation priority** (`types.ts`, `receipt.ts`): counterexample search runs *before* the proof kernel; `unverified` is the default, not a failure state. The benchmark suites even test "unsupported-task humility" (`packages/benchmarks/suites/foundations-seed.json`).
- **Deterministic content-addressed receipts**: `buildReceipt()` hashes problem + graph + artifacts (excluding timestamps) via `stable-hash.ts`, so `replay` can detect behavioral drift with a string compare. This is a genuinely good replay primitive.
- **The privacy posture is real, not marketed**: there is no `fetch`, no `http`, no telemetry in any first-party package. `model-context.ts` and `disclosure-log.ts` deliberately *do not* make external calls — they prepare and record.
- **Honest disclaimers are structural**: `evidence-audit.ts` verdicts (`overclaimed`, `computational-evidence`, `protocol-evidence`, `hypothesis`), `validation-plan.ts` gates, `claim-chart.ts` legal disclaimers. The README repeatedly states that records are "source organization, not proof of entailment."
- **MCP and CLI share one core** (`packages/core` consumed by both `apps/cli` and `packages/mcp-server`), with path-escape guards on both (`vault.ts:390`, `tools.ts` `resolveWorkspacePath`).

### Weakest / riskiest parts

- **The `proved` label is issued by a 162-line homemade kernel** (`parity-proof.ts`), while `AGENTS.md` says "Never label a result `proved` unless a proof-checker adapter accepts it." A mathematician will read this as label inflation (§4 R1).
- **18 JSON Schemas in `schemas/` that no code reads.** Zero references from TypeScript; validation is hand-rolled type guards. Schema/code drift is unmeasured and inevitable (§4 R2).
- **Overclaim prevention is keyword regex.** `evidence-audit.ts:705` and `:939` decide "biomedical" and "overclaimed" via word lists; "tumor" is not in the biomedical list, "shrinks tumors safely" sails past the cure-detector (§4 R5).
- **Replay covers only `ask` receipts** and silently conflates environment drift (SymPy version is hashed into the run ID) with claim validity (§4 R3).
- **3,087-line CLI monolith with no CLI-level tests** — the largest file in the repo is the least tested surface (§4 R7).
- **The README quickstart leads with cancer/hair-loss commands.** Even as carefully-disclaimed negative examples, a 90-line wall of `audit claim "This simulated candidate cures cancer safely"` is what screenshots will show (§4 R10).

---

## 2. Current Architecture Map

### 2.1 Packages and apps

| Unit | Path | Size | Role |
| --- | --- | --- | --- |
| Core library | `packages/core/src/` (30 modules + 28 test files) | ~9k LoC | Verification engines + record writers + workspace/vault/snapshot |
| CLI | `apps/cli/src/index.ts` | 3,087 LoC, single file | `truth-harness` command, 20 command groups, ~60 subcommands (commander) |
| MCP server | `packages/mcp-server/src/index.ts` (1,479) + `tools.ts` (1,232) | ~2.7k LoC | stdio MCP server, ~40 tools, zod v4 input schemas |
| Benchmarks | `packages/benchmarks/src/index.ts` (147) + 4 JSON suites | small | Runs `createReceipt` over prompt suites, compares expected trust labels |
| Schemas | `schemas/*.schema.json` (18 files) | — | JSON Schema definitions, **unreferenced by any code** |
| Python bridge | `tools/sympy_bridge.py` (122) | — | stdin-JSON → SymPy → stdout-JSON, charset-filtered `parse_expr` |
| Docs | `docs/` (5 md files, 1,469 lines) | — | Mostly strategy/launch docs; one architecture/research doc |
| CI | `.github/workflows/ci.yml` | — | Node 22 + Python 3.13 + `sympy==1.14.0`, `npm run check` + `proof:launch` |

Dependency hygiene is excellent: runtime deps are only `@modelcontextprotocol/sdk`, `zod`, `commander`. MIT license. `dist/` correctly git-ignored (stale `dist/` exists on disk but is untracked).

### 2.2 Data / artifact model

Everything lives under a git-ignored `.truth-harness/` per-project store with 19 directories defined in `local-workspace.ts` (`receipts`, `artifacts`, `indexes`, `inventions`, `simulations`, `experiments`, `vault`, `audits`, `snapshots`, `sessions`, `reviews`, `validation`, `literature`, `notebook-runs`, `model-contexts`, `disclosures`, `patents`, `benchmarks`, `findings`). A `project.json` manifest pins privacy metadata and policies (`externalCalls: "disabled-by-default"`, `secrets: "environment-only"`).

Artifact types (all `truth-harness.<kind>.v0`):

- **Receipt** (`receipt.ts`): problem → normalized problem → adapter dispatch (parity → dimension → symbolic → interval → arithmetic, first match wins) → evidence graph (`GraphNode`/`EvidenceEdge`), inline artifacts, findings, trust label, replay command, privacy block. Run ID = first 16 hex chars of a stable hash excluding timestamps.
- **Record artifacts** (literature, notebook-run, simulation, experiment, invention, review, session, validation plan, model-context, disclosure, claim chart): one JSON file per record, `create*` builds the object with normalization + warnings, `write*` persists, `list*` re-reads the whole directory.
- **Vault** (`vault.ts`): AES-256-GCM with scrypt-derived key from `TRUTH_HARNESS_VAULT_KEY`; envelope JSON embeds the base64 ciphertext; payload carries original filename + plaintext sha256, verified on open.
- **Snapshot** (`workspace-snapshot.ts`): sha256 of every file under `.truth-harness/`, with schema/id extraction, plus a `verify-snapshot` diff (changed/missing/added).
- **Corpus index** (`local-corpus.ts`): single `indexes/local-corpus.json` holding all documents and chunks (~1,400-char chunks with per-chunk token counts).

### 2.3 CLI surface

`apps/cli/src/index.ts` registers: `ask`, `bench run`, `replay`, `render`, `check` (Markdown claim blocks), `source ingest|search|cite`, `literature log|list`, `notebook log|list`, `simulation log|list`, `experiment log|list`, `vault seal|list|verify|open`, `audit claim|list`, `validation plan|list`, `research start|checkpoint|list`, `review log|list`, `invention log|list|package|claim-chart|claim-charts`, `model-context prepare|list`, `disclosure log|list`, `workspace init|status|snapshot|snapshots|verify-snapshot`, `doctor` (lines 152–1740). All options are flat `--flag` strings parsed inline; there is no shared option-parsing layer and no CLI-level test.

### 2.4 MCP / agent integration surface

`packages/mcp-server` registers ~40 tools (`truth_harness_ask`, `truth_harness_benchmark_run`, `truth_harness_workspace_*`, `truth_harness_source_*`, `truth_harness_literature_*`, `truth_harness_notebook_*`, `truth_harness_simulation_*`, `truth_harness_experiment_*`, `truth_harness_vault_*`, `truth_harness_evidence_audit*`, `truth_harness_validation_plan*`, `truth_harness_research_session_*`, `truth_harness_expert_review_*`, `truth_harness_invention_*`, `truth_harness_claim_chart*`, `truth_harness_model_context_*`, `truth_harness_disclosure_*`, `truth_harness_replay`, `truth_harness_render_receipt`, `truth_harness_discovery_package`). Inputs are zod v4 schemas with good descriptions and `readOnlyHint`/`openWorldHint` annotations. Server instructions explicitly warn agents not to treat unverified output as proved. Workspace root comes from `TRUTH_HARNESS_ROOT` / `CLAUDE_PROJECT_DIR` / cwd (`tools.ts:1231`) and all relative paths are guarded against root escape. `.mcp.json` wires the server for Claude. `AGENTS.md` + `docs/AGENT_SETUP.md` define agent behavior rules.

### 2.5 Schema strategy

Dual and disconnected. TypeScript interfaces + hand-written type-guard validators in core (e.g., `isExperimentKind`, `validateVaultEnvelope`); zod schemas in the MCP server for *inputs only*; 18 JSON Schemas in `schemas/` as aspirational documentation. **No runtime artifact validation against `schemas/` anywhere.** Nothing pins the three representations together.

### 2.6 Testing strategy

~160 vitest cases in 30 colocated `*.test.ts` files. Coverage is broad but shallow: every core module has create/list round-trip tests; `mcp-server/src/tools.test.ts` (44 cases) exercises handlers directly; `server.test.ts` is one large but real protocol test (in-memory transport, lists tools and calls many of them end-to-end) — substantive, yet a single monolithic case with no stdio wire test and no golden tool-schema snapshot. CI runs build + tests + the `proof:launch` demo suite (a real end-to-end smoke of CLI flows — good). Missing entirely: CLI argument-parsing tests, MCP wire-protocol tests, schema conformance tests, golden-artifact tests, cross-platform replay tests, property-based tests of the math kernels, privacy/egress tests.

### 2.7 Local-first / privacy model

- All computation local; SymPy via subprocess with a 5s timeout and 1MB output cap.
- Receipts hardcode `privacy: { mode: "local-only", networkAccess: "none", dataResidency: "local-workspace" }` (`receipt.ts` `createLocalOnlyPrivacyMetadata`).
- External model use is modeled as: `model-context prepare` (selected-context packet, redaction warnings) → human sends manually → `disclosure log` (record of what was sent). Neither performs nor intercepts any call.
- Vault for at-rest encryption of sensitive files, key via env only.
- Privacy enforcement is **by absence of code, plus convention** — there is no test or boundary that would catch a contributor (or a compromised dependency) adding egress.

### 2.8 Evidence / provenance model

Evidence is a graph inside each receipt plus loose string refs between record artifacts (`simulation:.truth-harness/simulations/x.json`, `snapshot:snap_…`). `evidence-audit.ts` is the only component that *resolves* refs: it loads the target (by path or by id-scan of the directory), grades strength (`none`→`refuting`), classifies the claim by keyword (`:705`), and issues a verdict (`verdictFor`, `:598`) with overclaim warnings (`:939` strong-language regex: `cures?|proves?|guaranteed|safe|effective|validated|solves?|breakthrough|clinically|approved|patentable|novel`). Snapshots provide tamper-evidence over the store. There is no global evidence graph, no cross-artifact integrity (a simulation log's `metrics` are not bound to any actual simulation output file hash), and no signature/identity layer.

---

## 3. Mission Alignment Audit

| Capability | Status | Evidence and gap |
| --- | --- | --- |
| Local-first private workflows | **Present** | No network code in any first-party package; `.truth-harness/` store (`local-workspace.ts`); privacy metadata on every artifact. Gap: enforced only by convention — no egress test, no boundary (§4 R4). |
| Optional / auditable hosted model usage | **Partially present** | `model-context.ts` (packets, redaction warnings), `disclosure-log.ts` (audit records), MCP tools `truth_harness_model_context_prepare` / `truth_harness_disclosure_log`. Gap: honor system — nothing makes the call, intercepts the call, or detects an unlogged call; the audit trail proves diligence, not behavior. |
| Math verification | **Partially present** | Real but narrow: `rational.ts`, `expression.ts`, `interval.ts`, `dimension.ts`, parity kernel, counterexample search (`receipt.ts:~470`, range hardcoded to [-20, 20]). Anything outside five prompt shapes → `unverified` plan node. |
| Theorem proving integration | **Missing** | Lean/Z3 appear only as `nextAdapters` strings in plan-node payloads (`receipt.ts`) and prior-art tables (`docs/RESEARCH_AND_ARCHITECTURE.md`). No adapter interface, no Lean/SMT code. Meanwhile `proved` is already issued by `parity-proof.ts` — see §4 R1 (**Risky/misleading** in combination). |
| CAS / symbolic computation | **Partially present** | SymPy subprocess adapter, 5 ops (simplify/factor/expand/diff/integrate), charset-sanitized `parse_expr` (`tools/sympy_bridge.py:24,93`), timeout, version pinned in CI. Gap: results labeled `exact-computed` with no cross-check against a second engine; no Sage/Maxima; no expression round-trip validation (srepr is captured but unused). |
| Simulation provenance | **Partially present / risky at edges** | `simulation-log.ts` records assumptions, parameters, metrics, uncertainty, limitations. Gap: metrics are self-reported strings; no hash binding to actual simulation inputs/outputs; no execution or capture. A fabricated metric is indistinguishable from a real one. |
| Notebook / replay workflows | **Partially present** | `notebook-run.ts` records runner/command/refs/deps — explicitly does not execute. `replay.ts` replays only `ask` receipts (runId/trust/summary compare). Gap: no notebook execution, no output-hash capture, no replay of any record artifact, env-sensitive run IDs (§4 R3). |
| Literature RAG | **Partially present** | `local-corpus.ts`: md/txt ingestion, chunking, lexical token-count scoring, citation refs; `source-receipt.ts` mints `source-cited` receipts from hits. Gap: lexical only (no embeddings/BM25 tuning), no PDF, single-JSON index, and `source-cited` means "a chunk lexically matched," not "the source supports the claim" — the README admits this but the trust label does not encode it. |
| Discovery packages | **Present (as designed, modest)** | `discovery-package.ts` renders invention logs + resolved evidence into Markdown review packages with overclaim warnings. Aligned with "review package, not breakthrough claim." |
| Invention / patent workbench | **Partially present** | `invention-log.ts`, `claim-chart.ts` (elements, evidence refs, prior-art notes, reduction-to-practice refs, legal disclaimers), `patents` dir. Gap: no prior-art search (by design, local-only), no docketing/timestamps beyond file dates, no signed/notarized provenance — fine for v0, must not be oversold. |
| Scientific/medical overclaim prevention | **Partially present / risky** | `evidence-audit.ts` + `validation-plan.ts` are real and thoughtful. Gap: keyword-regex classification is trivially bypassed and creates false assurance (§4 R5). |
| Benchmark suites | **Partially present** | 4 seed suites, runner, trust-accuracy metric, CI gate. Gap: benchmarks test the system's *own* adapters against expected labels — useful regression tests, not agent/model benchmarks. No harness for "measure Claude/Codex against tasks," which the README's "benchmark harness for measuring agents" promises. |
| Multi-agent workflows | **Partially present** | Research sessions with checkpoints/budgets, MCP tools, `AGENTS.md`. Gap: no concurrency control whatsoever — two agents writing the corpus index or session file concurrently will lose or corrupt data (read-modify-write of whole JSON files, no locks, no atomic rename). |
| Scalability toward many users | **Missing** | One JSON per record + full directory scan per `list` + by-id lookup via linear scan of parsed JSON (`evidence-audit.ts:560-596`); monolithic corpus index; vault ciphertext inlined in JSON. Fine to ~10³ artifacts; degrades quadratically in common agent loops (audit-after-each-log). |

---

## 4. Architecture Risks

Ordered by how badly each would damage trust with the target audience (mathematicians, physicists, doctors, OSS engineers).

### R1 — The `proved` label is issued by an unverified homemade kernel
**Why it matters:** The entire product promise is "labels you can trust." `AGENTS.md` states: "Never label a result `proved` unless a proof-checker adapter accepts it." But `receipt.ts` assigns `trust: "proved"` from `proveUniversalParity()` — a 162-line ad-hoc kernel whose soundness argument ("polynomial parity depends only on n mod 2") lives in a string constant, is not machine-checked, and has subtle edge surface (`powMod2`, constant-exponent extraction, division rejection). It is *probably correct* for its domain — that is exactly the standard the project says is insufficient.
**Where:** `packages/core/src/parity-proof.ts`; `receipt.ts` `completeUniversalParityReceipt`; `AGENTS.md` line ~17.
**Severity:** High (credibility-defining for mathematicians; one HN comment proving the kernel wrong ends the launch).
**Change:** (a) Add a `proofBackend` field to receipts (`kernel:modular-parity@v0` vs future `lean4@x`), and render it everywhere the label appears. (b) Either demote kernel output to a new label (`kernel-proved` or `proved-narrow`) or formally verify the kernel: port the parity argument to Lean 4 once, check it in CI, and ship the `.lean` file as the kernel's certificate. (c) Property-test the kernel against brute-force search over random polynomials (thousands of cases) in CI.

### R2 — 18 JSON Schemas with zero enforcement
**Why it matters:** "Schemas without enforcement" is precisely the anti-pattern serious engineers screen for. `schemas/*.schema.json` (receipt, evidence-audit, vault, all 18) are referenced by **no TypeScript file** (verified by grep: no `ajv`, no `schemas/` import anywhere in `packages/` or `apps/`). The real validators are hand-rolled guards that already encode different (looser) rules. Drift is undetectable; downstream consumers who code against the published schemas will break silently.
**Where:** `schemas/` vs `packages/core/src/*` validators; MCP zod schemas in `packages/mcp-server/src/index.ts` form a third, also-unsynced source of truth.
**Severity:** High (cheap to fix, embarrassing to be caught with).
**Change:** Make zod the single source of truth in a new `packages/schemas` workspace; generate `schemas/*.schema.json` from zod (`z.toJSONSchema` in zod v4 — already a dependency); add a CI test that regenerates and diffs; validate every artifact on write *and on read* (reads are the trust boundary — agents and humans edit JSON by hand).

### R3 — Incomplete and environment-entangled replay
**Why it matters:** Replay is the project's reproducibility claim. Today `replayReceipt()` (`replay.ts`, 47 lines) only re-runs `createReceipt(problem)` and string-compares runId/trust/summary. (a) Only `ask` receipts replay — none of the 15+ record artifact types have any replay or integrity re-check besides snapshots. (b) SymPy receipts embed `sympyVersion` and `pythonCommand` inside artifacts, which are hashed into `runId` — so a receipt created on Python 3.12/sympy 1.14 *fails replay* on any other machine even when the math is identical. Environment drift and claim drift are conflated into one boolean.
**Where:** `packages/core/src/replay.ts`; `receipt.ts` `buildReceipt` (hash includes artifacts); `sympy.ts` success payload.
**Severity:** High.
**Change:** Split receipt identity into `claimHash` (problem + adapter + mathematical result) and `envFingerprint` (versions, platform, commands). Replay compares claimHash and *reports* env drift separately. Extend replay to record artifacts: at minimum re-verify file hashes referenced by evidence refs (reuse snapshot machinery).

### R4 — Privacy boundary is a convention, not a boundary
**Why it matters:** "Private by default" is the headline feature. Today it is true because nobody wrote network code. Nothing prevents a dependency bump, a future adapter, or a contributor PR from adding silent egress; nothing detects an agent that calls a hosted model without logging a disclosure. The disclosure log can only prove diligence of honest users.
**Where:** absence across `packages/`; `disclosure-log.ts` and `model-context.ts` docstrings explicitly say "they do not make the call."
**Severity:** Medium-high (latent; becomes acute the day the first real model-call integration lands).
**Change:** (a) Add a CI privacy test: run the full proof:launch suite under a network-denying harness (e.g., Node `--experimental-network-inspection` alternative: spawn tests with no DNS via a resolver stub, or a socket-monkey-patch test asserting zero connection attempts) and fail on any socket open. (b) Dependency egress lint: forbid `node:http(s)`, `undici`, `net` imports outside a future `packages/gateway`. (c) When model calls are eventually implemented, route them exclusively through that gateway package which *atomically* writes the disclosure record and the request payload hash before sending.

### R5 — Overclaim prevention by keyword regex creates false assurance
**Why it matters:** A doctor or biologist probing the system will defeat it in one try. `classifyClaim` (`evidence-audit.ts:705`) tags "biomedical" via `\b(cancer|hair loss|disease|...|protein)\b` — **"tumor", "carcinoma", "remission", "metastasis" are absent**. `hasStrongClaimLanguage` (`:939`) misses "eliminates", "reverses", "heals", "eradicates". So `"This compound eradicates tumors in humans"` classifies as non-biomedical, non-overclaimed. A safety feature that fails open while advertising itself as an audit is worse than none, because users delegate vigilance to it.
**Where:** `packages/core/src/evidence-audit.ts:705`, `:939`, `verdictFor` `:598`.
**Severity:** High for the medical mission framing; medium for math.
**Change:** (a) Reframe honestly in output: verdicts should say "lexical heuristic screen, not a semantic audit" in the artifact itself, not only in docs. (b) Invert the default: any claim with *no* recognized claim-type and *no* strong evidence should fail closed toward `hypothesis`/`needs-classification` rather than relying on detection of bad words. (c) Make word lists data files with versioned IDs recorded in each audit (`heuristics: lexical-v1`), so audits are reproducible and improvable. (d) Long term: optional local-model classification behind the same audit machinery, clearly labeled.

### R6 — Self-reported evidence: records are not bound to artifacts
**Why it matters:** `simulation log --metric "pathway_score_delta=-0.18"` writes whatever the caller types. Nothing ties the record to the simulation code, inputs, or outputs. Snapshots hash files *inside* `.truth-harness/` only — the actual notebook, dataset, and outputs (`notebooks/pathway.ipynb`, `data/pathway.csv`) live outside the snapshot perimeter (`workspace-snapshot.ts` walks only `LOCAL_WORKSPACE_DIR`). The provenance chain has no anchor in the bytes that matter.
**Where:** `simulation-log.ts`, `experiment-log.ts`, `notebook-run.ts` (refs are plain strings); `workspace-snapshot.ts` scope.
**Severity:** High for the "evidence workbench" claim.
**Change:** When a record references a workspace-relative file, hash it at log time (`refs: [{path, sha256, bytes}]`) and verify on audit; extend snapshots with an opt-in "tracked externals" list; make `evidence-audit` downgrade strength when referenced files are missing or hash-mismatched (today missing refs reduce status, but content drift is invisible).

### R7 — 3,087-line untested CLI monolith
**Why it matters:** The CLI is the primary human interface and the demo path; it contains parsing logic (e.g., `--metric "k=v;unit=u;note=n"` mini-grammars duplicated per command) that exists nowhere else and is exercised only by `proof:launch` happy paths. Flag typos, parse edge cases, and error paths are untested. The monolith also blocks contributor onboarding.
**Where:** `apps/cli/src/index.ts` (lines 157–1740 command registry); no `apps/cli/**/*.test.ts` exists.
**Severity:** Medium-high.
**Change:** Split into `apps/cli/src/commands/*.ts` (one file per group) with pure `parseXOptions()` functions; add vitest coverage for parsers and an end-to-end runner that invokes the built CLI in a temp dir (golden stdout/JSON assertions). The shared `k=v;attr=...` mini-grammar should be one tested utility.

### R8 — No execution sandboxing story beyond SymPy
**Why it matters:** The roadmap (notebook execution, simulation capture, Lean/Z3 adapters, plugins) all imply running code. Today's only precedent is the SymPy bridge: subprocess + 5s timeout + charset regex + emptied `__builtins__` — reasonable for SymPy, but `SAFE_GLOBAL_DICT = dict(sp.__dict__)` hands the whole SymPy namespace to `parse_expr` (a known eval-adjacent surface; the charset filter and `__` ban are the real defense). There is no isolation policy, resource limits, or filesystem scoping for the adapters to come.
**Where:** `tools/sympy_bridge.py:24-31,93-100`; `sympy.ts` spawn options.
**Severity:** Medium now, high the moment notebook execution lands.
**Change:** Define an `ExecutionPolicy` (cwd jail, env allowlist, wall/cpu/mem caps, no-network) in core; run all adapters through one `runSandboxed()` utility; document the threat model in `SECURITY.md`; for notebook execution, require container or `bwrap`-style isolation and treat host execution as explicitly degraded mode recorded in the receipt.

### R9 — Storage model: O(n) scans, no locking, no atomicity
**Why it matters:** Agent loops are write-heavy (log → audit → plan → checkpoint). Every `list*` reads and parses every JSON in a directory; `evidence-audit` resolves ids by scanning directories; corpus search loads the entire index; record writes are non-atomic `writeFile` (a crash mid-write corrupts the store); concurrent agents race on `local-corpus.json` and session files.
**Where:** `evidence-audit.ts:560-596` (`readEntryByRef`), every `list*` in core; `local-corpus.ts` ingest read-modify-write.
**Severity:** Medium today (small stores), high for the mission's "many users / long investigations."
**Change:** Keep JSON files as the canonical, human-auditable artifacts (this is a feature), but add: write-to-temp + atomic rename everywhere; an optional SQLite index (`.truth-harness/indexes/catalog.db`) maintained on write and rebuildable from files; per-store advisory lockfile for multi-process safety. Do not move artifacts themselves into a database.

### R10 — Medical framing in the front door
**Why it matters:** The README quickstart's most prominent strings are "cures cancer safely," "hair regrowth," "follicle signaling." The disclaimers are diligent, but optics matter: screenshots, HN threads, and skimmers will see a cancer/hair-loss tool wrapped in math branding. The Quickstart is also ~90 sequential commands — unrunnable as a first experience.
**Where:** `README.md` Quickstart; mirrored in `docs/LAUNCH_PLAN.md` (which, to its credit, says to lead with math).
**Severity:** Medium (reputational; zero engineering cost to fix).
**Change:** Quickstart = 6 commands, all math (`workspace init`, `ask` refute, `ask` prove, `replay`, `render`, `bench run`). Move biomedical workflows to `docs/workflows/biomedical-hypothesis.md` framed as "how the guardrails behave on a deliberately overclaimed example."

### R11 — Unreachable trust labels and circular benchmarks
**Why it matters:** `smt-checked` and `cross-checked` (`types.ts:5,8`) are accepted by strict claim checking (`claim-file.ts:20,23`) but no code path can ever produce them — a strict checker that trusts labels the system cannot mint invites confusion the day someone hand-writes a receipt. Benchmarks measure the system against its own expected labels (`packages/benchmarks/src/index.ts` `runTask` calls `createReceipt`), which is regression testing, not the agent benchmarking the README advertises.
**Where:** `types.ts`, `claim-file.ts`, `benchmarks/src/index.ts`, README "benchmark harness" framing.
**Severity:** Low-medium (honesty in naming).
**Change:** Either implement a minimal Z3 adapter to make `smt-checked` real, or gate unreachable labels out of strict-pass until implemented. Rename current suites "system regression suites" and design the agent-benchmark harness (§5.8) as a distinct artifact.

### R12 — Minor but worth fixing
- Node IDs collide for identical content: `addNode` hashes the node payload only (`receipt.ts`), so two structurally identical nodes get one ID twice in `nodes[]` — graph consumers will misrender. Include an ordinal in the hash.
- `replayReceipt` trusts the receipt's own `problem` field; a tampered receipt replays "successfully" against its own tampered problem. Replay should be paired with snapshot/hash verification, and receipts should eventually carry an integrity self-hash.
- Counterexample search range `[-20, 20]` is hardcoded and unrecorded as a limitation finding when no counterexample is found (the summary says "finite search," good, but the range should be a structured field consumers can read).
- Vault envelopes inline base64 ciphertext in JSON → 33% bloat and full-file memory reads; fine for notes, wrong for datasets. Store ciphertext as sibling `.bin` for payloads over a threshold.
- `package.json` `description` ("Verified math for AI agents…") and README brand promise more than §3 supports; keep copy synchronized with the capability table.

---

## 5. Recommended Target Architecture

Principles: evolve, don't rewrite. Keep human-readable JSON artifacts as ground truth. Make every trust label carry its backend. Make every boundary (schema, privacy, execution) testable.

### 5.1 Core artifact / event model
- Keep `truth-harness.<kind>.v0` JSON artifacts as canonical records (auditable with `cat` — this is a differentiator).
- Add an **append-only event log** `.truth-harness/events.jsonl`: every write appends `{ts, actor, action, artifactRef, sha256}`. Snapshots become checkpoints over the log. This gives ordering, multi-agent attribution, and tamper-evidence between snapshots.
- Add `claimHash` / `envFingerprint` split to receipts (R3) and `proofBackend` to every trust label (R1).
- Introduce `EvidenceRef` as a structured type `{kind, ref, sha256?, bytes?}` shared by all record modules (today each module has its own near-identical ref type).

### 5.2 Local workspace layout
Keep `.truth-harness/` as-is, adding:
```
.truth-harness/
  events.jsonl              # append-only event log
  indexes/catalog.db        # rebuildable SQLite index (ids, kinds, timestamps, hashes)
  indexes/local-corpus/     # sharded corpus (per-document chunk files + manifest)
  cas/<sha256[0:2]>/<sha256> # content-addressed store for large artifacts & vault blobs
  locks/                    # advisory lockfiles
```
A `truth-harness workspace rebuild-index` command regenerates `catalog.db` from artifacts, so the database is never authoritative.

### 5.3 Receipt / provenance model
- Receipts gain `engine: {adapter, version, backend}`, `limits: {searchRange?, timeoutMs?}`, `integrity: {claimHash, envFingerprint, selfHash}`.
- All record artifacts gain hashed `EvidenceRef`s (R6) and a `heuristics`/`method` field identifying the rule version that produced any automated judgment (R5).
- Optional artifact signing (minisign/ed25519, key local) for discovery packages and claim charts where authorship attestation matters (patent posture).

### 5.4 Model-context packet system
- Keep packets as the unit of disclosure. Add: deterministic packet hash; `packet.txt` rendering (exact bytes intended for the model); and when the future gateway sends anything, it must reference a packet hash and write the disclosure atomically pre-send (R4).
- A `truth-harness gateway` package is the *only* network-capable package; CI lints that `net/http/undici` imports exist nowhere else.

### 5.5 RAG / index architecture
- Stage 1: keep lexical, but shard the index, add BM25 scoring, and record `retrievalMethod: lexical-bm25-v1` in every `source-cited` receipt.
- Stage 2: optional local embeddings (e.g., ONNX runtime, model file user-supplied) as a separate adapter with the same citation contract; PDF ingestion via local extraction; per-chunk page/offset anchors so citations are verifiable spans, not chunk blobs.
- Never let retrieval mint anything stronger than `source-cited`; consider renaming the label `source-matched` until an entailment check exists.

### 5.6 CAS / theorem prover adapter architecture
Define one interface in core:
```ts
interface VerifierAdapter {
  id: string; version(): Promise<string>;
  canHandle(problem: NormalizedProblem): boolean;
  run(problem, policy: ExecutionPolicy): Promise<AdapterResult>; // result carries proposed trust + certificate artifact
}
```
- Registry with deterministic dispatch order (today's if/else chain in `receipt.ts` becomes data).
- First two real adapters: **Z3** (SMT for bounded integer/real claims → makes `smt-checked` real, biggest capability-per-effort win) and **Lean 4** (check user/agent-supplied proof terms; `proved` reserved for this path plus the formally-verified parity kernel).
- SymPy results upgrade to `cross-checked` only when a second engine (e.g., random numeric sampling against the simplified form, or a second CAS) agrees; otherwise stay `exact-computed` with backend recorded.

### 5.7 Notebook / simulation execution architecture
- New `packages/runner`: executes a declared command in a sandbox (container if available; else rlimit'd subprocess with cwd jail and no network), captures stdout/stderr/exit code, hashes all declared inputs and produced outputs, and writes a `truth-harness.notebook-run.v1` that *was actually observed*, distinct from today's self-reported `v0` (keep v0 as "attestation", add v1 as "observed").
- Simulation logs reference an observed run or are flagged `attested-only` in audits.

### 5.8 Benchmark harness
- Split: `suites/regression/` (current — system must label correctly) vs `suites/agent/` (task + grading receipt: an external agent submits answers via MCP; the harness verifies submissions with the workbench and scores calibration: did the agent claim `proved` when only `unverified` was earned?).
- Agent benchmark output is itself a receipt with full replay metadata — this is the credible "benchmark harness for agents" the README promises and a natural viral artifact ("Claude vs Codex calibration on 200 verified math tasks").

### 5.9 Evidence audit engine
- Keep the verdict lattice (it's good). Replace monolithic heuristics with composable, versioned `AuditRule`s (lexical screens, ref-integrity checks, trust-propagation over the evidence graph, domain gates). Every audit lists the rules and versions applied; failing-open paths eliminated (R5).
- Add graph-level audit: walk evidence refs transitively, downgrade verdicts when any ancestor is missing/hash-drifted/`attested-only`.

### 5.10 Invention / patent workbench
- Claim charts gain hashed evidence refs, event-log anchoring (provable "logged no later than" via snapshot chain), optional signing. Explicitly document what this is *not* (not legal advice, not an inventorship record system of record) in the artifact itself, as it already does in warnings — keep that.

### 5.11 MCP server design
- Keep the flat tool list (agents handle it fine), but generate tool registrations from the shared zod schema package to kill triplication.
- Add MCP protocol tests over real stdio transport (spawn server, list tools, golden-check schemas, invoke happy/error paths).
- Add a `truth_harness_capabilities` tool returning the live adapter registry + trust-label semantics, so agents never assume capabilities that aren't installed.

### 5.12 CLI-first design
- Decompose into `apps/cli/src/commands/`; shared option grammars; `--json` everywhere for scripting; exit codes documented and tested; `truth-harness doctor` extended to verify schema conformance of an existing store.

### 5.13 Future UI / API
- Defer any server. The right v1 "UI" is `render` → static HTML evidence-graph viewer (single self-contained file, no network). A local read-only HTTP viewer can come later and must run through the same gateway/egress policy (localhost-only, opt-in).

### 5.14 Storage / encryption strategy
- CAS for large blobs; vault ciphertext to sibling files over threshold (R12); atomic writes + advisory locks (R9); optional whole-store encryption stays out of scope (defer to OS disk encryption, document that).

### 5.15 Plugin / kernel isolation strategy
- Adapters are out-of-process by default (the SymPy bridge pattern generalizes well): JSON-over-stdio, ExecutionPolicy enforced by the runner, no adapter ever touches `.truth-harness/` directly — they return artifacts; core writes them. This single rule gives plugin isolation almost for free.

---

## 6. Concrete Roadmap

### Stage 0 — Repo hardening (1–2 weeks)
**Must-have:** schema unification + enforcement (R2); `proofBackend` field + label honesty (R1 a/b minimum); CLI decomposition + tests (R7); atomic writes; README quickstart rewrite (R10); node-ID ordinal fix; privacy CI test (R4a); kernel property tests (R1c).
**Tests:** schema round-trip for all 18 artifact kinds; CLI golden tests; parity kernel vs brute force (10⁴ random polynomials); no-egress test.
**Docs:** `docs/TRUST_LABELS.md` (exact semantics, backend, what each label does NOT mean); rewritten README.
**Acceptance:** CI fails on schema drift; every artifact written is validated; `proved` never appears without a backend id; quickstart runs in <2 minutes.
**Risks reduced:** R1, R2, R7, R10, R12.

### Stage 1 — Credible local-first MVP (3–6 weeks)
**Must-have:** Z3 adapter (`smt-checked` becomes real); claimHash/envFingerprint replay split (R3); hashed EvidenceRefs (R6); audit-rule engine with versioned lexical rules failing closed (R5); event log; SQLite catalog + rebuild command.
**Tests:** Z3 adapter conformance suite; replay cross-env test (CI matrix: two Python/SymPy versions, claimHash stable); audit-rule unit tests incl. bypass corpus ("eradicates tumors", "reverses disease"); concurrent-write stress test.
**Docs:** `docs/ARCHITECTURE.md` (real one, replacing strategy-doc gravity); adapter authoring guide.
**Acceptance:** a false ∀-claim over integers refutable by Z3 gets `refuted` with a model as counterexample artifact; replay passes across CI matrix; audits cite rule versions.
**Risks reduced:** R3, R5, R6, R9, R11(partially).

### Stage 2 — Agentic math/science workbench (6–12 weeks)
**Must-have:** Lean 4 proof-checking adapter (check agent-supplied proofs; formally verify the parity kernel as dogfood); runner package with sandboxed observed notebook runs (v1 records); MCP protocol test suite; `truth_harness_capabilities`; multi-agent locking.
**Tests:** Lean adapter golden proofs (accept/reject); sandbox escape attempts (network, path traversal, resource bombs) as red-team tests; MCP wire tests.
**Docs:** `SECURITY.md` threat model; notebook-execution guide; agent calibration guide.
**Acceptance:** an agent can submit a Lean proof via MCP and earn `proved` with the Lean certificate attached; a notebook run produces hash-bound observed outputs; two agents can work one workspace without corruption.
**Risks reduced:** R1 (fully), R8, remainder of R9.

### Stage 3 — Benchmarked discovery workflows (3–6 months)
**Must-have:** agent benchmark harness (§5.8) with calibration scoring; embedding-based local RAG adapter + PDF ingestion with span citations; graph-level evidence audit; gateway package with atomic disclosure (first real hosted-model integration, opt-in).
**Tests:** benchmark determinism/replay; retrieval citation-span verification; gateway tests proving disclosure-before-send ordering; egress lint.
**Docs:** benchmark methodology (publish the grading rules); RAG honesty doc (`source-matched` semantics).
**Acceptance:** a published, reproducible calibration report of ≥2 frontier models on ≥100 tasks where every grade is itself a replayable receipt.
**Risks reduced:** R4 (fully), R11 (fully).

### Stage 4 — Serious research platform (6–12+ months)
**Must-have:** Sage/second-CAS cross-check (`cross-checked` real); static HTML evidence-graph viewer; artifact signing; plugin SDK with isolation contract; literature workflows hardened with domain reviewers; scaling validation (10⁵-artifact workspaces).
**Tests:** long-horizon soak (simulated 6-month investigation: 10⁴ events, snapshots, audits); cross-platform (Windows/macOS/Linux) replay matrix.
**Docs:** governance, reviewer guidelines, reproducibility policy for published discovery packages.
**Acceptance:** an external researcher can clone a discovery package, replay every receipt, re-verify every hash, and reach the same verdicts without contacting the author.

---

## 7. Testing and Verification Plan

| Layer | What to build | Notes |
| --- | --- | --- |
| Unit | Keep colocated vitest; add property-based tests (fast-check) for `rational.ts` (field axioms vs JS bigint oracle), `expression.ts` (parse∘print id), `interval.ts` (containment under random sampling), parity kernel vs brute force | Math kernels deserve property tests, not just examples |
| Schema | Generate JSON Schemas from zod; CI diff test; validate-on-read tests with corrupted fixtures for all 18 kinds; cross-version compat fixtures (`v0` artifacts must still load after `v1`) | Closes R2 permanently |
| CLI | Golden end-to-end: run built CLI in temp dirs, assert exit codes + `--json` output against snapshots; fuzz the `k=v;attr=...` mini-grammars | Today's biggest blind spot |
| MCP protocol | Spawn server over real stdio; `tools/list` golden snapshot; invoke each tool happy+error; assert `isError` semantics and strict-mode behavior | `server.test.ts` currently has 1 test |
| Golden artifacts | Commit canonical receipts/audits/snapshots under `fixtures/golden/`; CI regenerates and diffs (timestamps normalized) | Catches accidental semantic drift in summaries/labels that benchmarks miss |
| Snapshot/replay | CI matrix (OS × Python/SymPy versions): claimHash must be stable, envFingerprint must differ; tamper tests (bit-flip an artifact → snapshot verify and audit must catch it) | Closes R3 |
| Privacy boundary | Socket-deny harness around full suite; import lint forbidding net modules outside gateway; future gateway ordering test (disclosure record exists before request leaves) | Closes R4 |
| Overclaim/audit | Adversarial bypass corpus (synonym attacks, negation, multilingual) with expected fail-closed verdicts; rule-version pinning tests | Treat like a security test suite — red team it each release |
| Benchmark regression | Current suites stay as CI gates; add trust-accuracy trend tracking; agent-benchmark determinism tests | |
| Headless E2E | Scripted "investigation": init → ingest → log sim → audit → plan → snapshot → checkpoint → package, in CI, asserting the final discovery package contents | This is the product; test it as one story |

---

## 8. Viral / Open Source Strategy (brutally honest)

**What you have that HN will respect:** a tool that catches AI math lies with exact local computation, refuses to say `proved` when it only searched, and emits replayable receipts — with zero network calls. That story is crisp, demonstrable in one screenshot, and falsifiable (which builds trust).

**What will get you destroyed if shipped as-is:** (1) the word "Theorem" + a homemade proof kernel — the first commenter who finds *any* soundness gap ends the thread; ship the Lean-verified kernel or the humbler label first. (2) Cancer/hair-loss strings in the README — "AI math tool pivots to curing cancer" is the top comment within an hour. (3) The phrase "benchmark harness for measuring agents" with only self-regression suites behind it. (4) 18 unenforced schemas — one `grep -r ajv` by a commenter is all it takes.

**The right first demo** (technically impressive, reproducible, zero overclaim):

> "I asked three frontier models whether `n² + n + 1` is even for all integers. Two said yes with confident proofs. Here's a 5-second local tool that refutes it with a counterexample, proves the true variant by exhaustive residue check *formally verified in Lean*, and emits a receipt you can replay on your machine — no network, no account, MIT."

Pair it with the calibration benchmark (Stage 3): "We graded model calibration on 200 math tasks where every grade is a replayable receipt" is the follow-up post that earns the science audience. Mathematicians will care when Lean proofs flow through it; physicists when dimension+interval checks catch real paper errors; doctors should not be marketed to at all until Stage 4 review workflows exist — let the biomedical guardrails be discovered as "wow, it refuses to overclaim," never as a pitch.

Open-source mechanics: the adapter interface is the contribution magnet — "write a 100-line adapter, get a trust label" is a great first-issue shape (the `adapter_request.yml` issue template already exists and is the right instinct). Keep the core tiny and reviewable; that *is* the brand.

---

## 9. Top 20 Implementation Tasks for Codex

1. **Unify schemas: zod as single source of truth.**
   Goal: new `packages/schemas` exporting zod schemas for all 18 artifact kinds; generate `schemas/*.schema.json` via `z.toJSONSchema`; CI diff test. Files: new package; `packages/core/src/*` (replace hand guards); `packages/mcp-server/src/index.ts`; `.github/workflows/ci.yml`. Why: closes R2, kills triplication. Tests: round-trip validation for every kind; drift test. Accept: no hand-rolled validators remain; CI fails on drift.

2. **Validate artifacts on read and write.**
   Goal: every `write*` validates pre-write; every `list*`/`read*` validates and reports invalid files (skip + warning, `--strict` errors). Files: all `packages/core/src/*-log.ts`, `*-record.ts`, `evidence-audit.ts`, `vault.ts`. Why: hand-edited/agent-corrupted JSON is the trust boundary. Tests: corrupted fixtures per kind. Accept: corrupt file can't silently flow into an audit verdict.

3. **Add `proofBackend` to receipts and renderers.**
   Goal: `trust` always paired with backend id+version; renderers (`receipt-renderer.ts`) display it; `claim-file.ts` strict mode can require specific backends. Files: `types.ts`, `receipt.ts`, `receipt-renderer.ts`, `claim-file.ts`, schemas. Why: R1 honesty. Tests: golden receipts include backend. Accept: `proved` never renders without "by local-modular-parity-kernel v0 (not externally verified)".

4. **Property-test the parity kernel against brute force.**
   Goal: fast-check generator of random integer polynomials (degree ≤6, coeffs ≤10³); compare kernel verdict to exhaustive parity check over residues and sampling. Files: `packages/core/src/parity-proof.test.ts`. Why: R1c; cheap confidence. Tests: ≥10⁴ cases in CI. Accept: zero disagreements; division/exponent edge cases covered.

5. **Split CLI into command modules with tests.**
   Goal: `apps/cli/src/commands/{ask,bench,source,literature,...}.ts` + shared `parse-kv.ts` for `k=v;attr=v` grammars; behavior unchanged. Files: `apps/cli/src/index.ts` → ~20 modules. Why: R7. Tests: unit tests per parser; E2E golden runs of built CLI in temp dir. Accept: `index.ts` < 200 lines; CLI test coverage exists in CI.

6. **Atomic writes + advisory locking.**
   Goal: `writeFileAtomic` (temp + rename) utility used by every writer; per-workspace lockfile for read-modify-write paths (corpus ingest, session checkpoint). Files: new `packages/core/src/fs-util.ts`; all writers; `local-corpus.ts`; `research-session.ts`. Why: R9 crash/concurrency safety. Tests: concurrent ingest stress test. Accept: parallel writers never corrupt store.

7. **Split `claimHash` from `envFingerprint` in receipts; fix replay.**
   Goal: runId derives from claim-relevant content only; env data (sympyVersion, pythonCommand, platform) moves to `envFingerprint`; `replay.ts` compares claimHash and reports env drift separately; extend replay to verify evidence-ref hashes. Files: `receipt.ts`, `replay.ts`, `sympy.ts`, schemas, suite fixtures. Why: R3. Tests: CI matrix with two SymPy versions — claimHash stable. Accept: cross-machine replay of committed demo receipts passes.

8. **Hash-bound EvidenceRefs.**
   Goal: shared `EvidenceRef {kind, ref, sha256?, bytes?}`; log commands hash referenced workspace files at write time; `evidence-audit` verifies hashes and downgrades on drift/missing. Files: new `packages/core/src/evidence-ref.ts`; all record modules; `evidence-audit.ts`; CLI/MCP option plumbing. Why: R6 — turns self-reports into checkable claims. Tests: drift fixture → downgraded verdict. Accept: audit output distinguishes verified-hash refs from attested strings.

9. **Versioned, fail-closed audit rules.**
   Goal: refactor `evidence-audit.ts` heuristics into `AuditRule[]` with ids/versions recorded in output; expand lexical lists (tumor, carcinoma, eradicates, reverses, heals…); unclassifiable strong claims fail toward `hypothesis`. Files: `evidence-audit.ts` → `audit-rules/*.ts` + data files. Why: R5. Tests: adversarial bypass corpus. Accept: audit artifact lists rule versions; bypass corpus passes fail-closed.

10. **Privacy CI gate.**
    Goal: test harness monkey-patching `net.Socket.connect`/`dns.lookup` to throw, running full test + proof:launch; ESLint rule forbidding net imports outside (future) gateway. Files: `vitest.config.ts`, new `test/privacy/`, eslint config. Why: R4a — makes "local-only" falsifiable. Tests: itself. Accept: any added egress fails CI.

11. **Z3 SMT adapter.**
    Goal: `packages/adapters-z3` implementing `VerifierAdapter` via z3 subprocess (SMT-LIB over stdio, timeout policy); integer/real (in)equality + bounded quantifier claims; mints `smt-checked`/`refuted` with model artifacts. Files: new package; `receipt.ts` dispatch → registry; benchmarks suite `smt-seed.json`. Why: makes a dormant label real; biggest capability win per effort. Tests: adapter conformance + golden receipts; graceful no-z3 degradation. Accept: `ask "for all integers n, n^2 >= 0"` → `smt-checked` with certificate.

12. **Adapter registry + ExecutionPolicy.**
    Goal: replace `receipt.ts` if/else chain with ordered registry; define `ExecutionPolicy` (cwd, env allowlist, timeout, maxOutput, no-network) consumed by sympy + z3 runners. Files: `receipt.ts`, new `adapter.ts`, `sympy.ts`. Why: unblocks Lean/Sage; R8 foundation. Tests: dispatch-order tests; policy enforcement (timeout, output cap). Accept: adding an adapter touches zero lines of `receipt.ts`.

13. **MCP protocol test suite.**
    Goal: spawn built server over real stdio (the in-memory transport test exists but skips process/serialization boundaries); golden `tools/list` snapshot; invoke every tool happy+error; assert strict-mode `isError`. Files: `packages/mcp-server/src/protocol.test.ts`. Why: agents are the primary users; tool-schema drift is currently invisible in review. Tests: itself. Accept: tool schema changes show up as reviewable golden diffs.

14. **Event log (`events.jsonl`).**
    Goal: append-only event per artifact write `{ts, actor, action, ref, sha256}`; CLI `truth-harness events list`; snapshots record the event-log offset they cover. Files: new `packages/core/src/event-log.ts`; all writers; snapshot module. Why: ordering + multi-agent attribution + tamper-evidence between snapshots. Tests: append/replay/corruption-detection. Accept: every artifact's history reconstructible from log + snapshots.

15. **SQLite catalog index.**
    Goal: optional `indexes/catalog.db` (id, kind, path, createdAt, sha256) maintained on write, `rebuild-index` command; `list*` uses it when present, falls back to scans. Files: new `catalog.ts`; writers; CLI. Why: R9 performance without sacrificing file-canonical model. Tests: rebuild equivalence (db results ≡ scan results). Accept: `list` on 10⁴ artifacts < 100ms.

16. **Sandboxed notebook runner (observed runs v1).**
    Goal: `packages/runner` executes declared commands under policy (container if available, else rlimit+jail), hashes declared inputs/outputs, writes `truth-harness.notebook-run.v1` marked `observed`; v0 records remain, audits label them `attested-only`. Files: new package; `notebook-run.ts`; `evidence-audit.ts`; CLI `notebook run`. Why: converts the provenance story from honor system to observation. Tests: red-team (network attempt, path escape, fork bomb → killed and recorded). Accept: an observed run's outputs are hash-verifiable; sandbox escapes fail tests.

17. **README + quickstart rewrite, biomedical content relocation.**
    Goal: 6-command math quickstart; move biomedical walkthrough to `docs/workflows/biomedical-hypothesis.md` framed as guardrail demo; sync `package.json` description to actual capability. Files: `README.md`, `docs/`, `package.json`. Why: R10. Tests: `npm run cli -- check README.md` on any embedded claims. Accept: no medical strings above the fold; quickstart < 2 min.

18. **Golden artifact fixtures + drift CI.**
    Goal: `fixtures/golden/` canonical receipt/audit/snapshot per kind; CI regenerates (timestamps normalized) and diffs. Files: new fixtures dir; CI; small normalizer util. Why: catches semantic drift benchmarks miss (summaries, labels, graph shape). Tests: itself. Accept: changing a summary string requires a reviewed golden update.

19. **Trust-label documentation + strict-mode gating of unreachable labels.**
    Goal: `docs/TRUST_LABELS.md` (semantics, backend, anti-claims for each label); `claim-file.ts` strict pass excludes labels with no registered adapter (`cross-checked` until real). Files: docs; `claim-file.ts`; `types.ts` comments. Why: R11. Tests: strict-mode test for unmintable labels. Accept: docs and code agree on which labels are currently earnable.

20. **Agent calibration benchmark harness (design + skeleton).**
    Goal: `packages/benchmarks` gains `agent` mode: task suite + submission format (via MCP tool `truth_harness_benchmark_submit`) + grading via workbench verification + calibration scoring (claimed-trust vs earned-trust matrix); seed with 50 tasks. Files: benchmarks package; mcp-server; new suite. Why: makes the "benchmark harness for agents" claim true; the Stage-3 viral artifact. Tests: deterministic grading; self-play test (workbench grades its own `ask` as perfectly calibrated). Accept: a model can be scored end-to-end and the scorecard is a replayable receipt.

---

## 10. Final Verdict

**Is this repo on a credible path?** Yes — with the important caveat that its credibility currently rests on values and restraint rather than capability. The honest-labeling discipline, refutation-first design, deterministic receipts, genuine local-only posture, and pervasive anti-overclaim copy are exactly the right foundation, and they are the hard part to retrofit. The verification engine is tiny but real, and the monorepo/adapter shape can absorb Lean, Z3, and sandboxed execution without a rewrite. **No rewrite is warranted.** The risk is not the architecture's direction; it is the gap between the vocabulary (proved, evidence, audit, benchmark, vault, discovery) and what the code can currently enforce.

**What would make it embarrassing?** Launching with: a homemade kernel minting `proved` while AGENTS.md forbids exactly that; 18 JSON Schemas no code reads; "benchmark harness for agents" backed by self-regression tests; a keyword regex that misses "tumor" presented as a medical overclaim audit; cancer-cure strings as the README's first impression; and a 3,000-line untested CLI. Every one of these is checkable by a skeptical commenter in under ten minutes, and every one is cheap to fix now.

**What would make it impressive?** (1) The parity kernel formally verified in Lean, with the `.lean` certificate shipped inside the receipt — the project dogfooding its own standard. (2) A Z3 adapter making refutation general instead of bespoke. (3) Cross-machine replay that distinguishes claim drift from environment drift. (4) The calibration benchmark: frontier models graded on whether they *know what they know* about math, every grade a replayable local receipt. (5) A privacy boundary that CI can falsify. Each of these turns a current weakness into the demo.

**What should be built next?** In order: Stage 0 hardening (tasks 1–6, 17–19 — roughly two weeks, removes every "embarrassing" item), then task 7 (replay split) and task 11 (Z3) as the first capability expansion, then Lean checking. Do not start the UI, hosted-model gateway, or embedding RAG until the schema, replay, and label-honesty work is done — those features inherit whatever trust model exists when they land.

---

*Method note: all file paths, line numbers, sizes, and behavioral claims above were verified by direct inspection of the working tree on 2026-06-10 (git tip `64b4668`). Aspirational items in `docs/RESEARCH_AND_ARCHITECTURE.md` (Lean/Z3/Sage/RAG adapters, agent benchmarking, gateway) are treated throughout as plans, not capabilities.*

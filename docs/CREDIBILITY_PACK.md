# Professor Credibility Pack

The credibility pack is the first reviewer-facing artifact for serious mathematicians, professors, and technical auditors.

It does not claim the workspace is true. It creates a local packet that says what is currently checkable, what is blocked, which engines earned concrete evidence, which files were present, and which commands a reviewer should rerun.

## Command

```bash
truth-harness workspace credibility-pack .
truth-harness workspace credibility-pack . --require-docker-core
truth-harness workspace credibility-pack . --require-cvc5
truth-harness workspace credibility-pack . --require-all-concrete
truth-harness workspace credibility-pack . --require-all-engines
truth-harness workspace credibility-pack . --dry-run --json
truth-harness workspace credibility-actions . --require-all-engines --json
truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures
truth-harness bench run packages/benchmarks/suites/math-credibility-ladder.json --write --fail-on-failures
npm run docker:hard-math-closure
npm run docker:symbolic-closure
npm run docker:smt-closure
npm run docker:professor
truth-harness workspace credibility-bundle .
truth-harness workspace verify-credibility-bundle . .truth-harness/findings/<date>-<bundle-id>-credibility-bundle
truth-harness workspace ui-review . --pass "Browser reviewed for clipping, overflow, focus state, scroll behavior, and report readability" --write
```

The command writes paired JSON and Markdown into `.truth-harness/findings/` unless `--dry-run` is used.
The `credibility-actions` command computes the same pack but prints only the unresolved reviewer queue; it never executes the suggested commands.
The bundle command writes a plain directory under `.truth-harness/findings/` with a manifest, copied canonical artifacts, the generated credibility pack, and a README.
Claim records, verifier routes, proof-check records, CAS-check records, SMT-check records, research sessions, model-context packets, disclosure logs, code-run records, notebook-run records, validation plans, hard-math closure reports, workspace-review, run-next, credibility-pack, reviewer-bundle, bundle-verification, report-draft JSON, sandbox-run records, and web-ui-review records are validated by schemas during workspace validation, so reviewer packets, proof evidence, CAS cross-check evidence, SMT solver evidence, hard-math closure evidence, privacy receipts, execution receipts, notebook provenance, validation gates, UI launch-review evidence, and agent handoffs are checked as first-class local artifacts instead of loose notes. The claim-ledger, verifier-route, proof-check, CAS-check, SMT-check, research-session, model-context, disclosure-log, code-run, notebook-run, validation-plan, hard-math closure, workspace-review, run-next, sandbox-run, and web-ui-review writers also validate their JSON packets against `claim-ledger.schema.json`, `verifier-route.schema.json`, `proof-check.schema.json`, `cas-check.schema.json`, `smt-check.schema.json`, `research-session.schema.json`, `model-context.schema.json`, `disclosure-log.schema.json`, `code-run.schema.json`, `notebook-run.schema.json`, `validation-plan.schema.json`, `hard-math-closure.schema.json`, `workspace-review.schema.json`, `workspace-run-next.schema.json`, `sandbox-run.schema.json`, and `web-ui-review.schema.json` before writing artifacts, so malformed claims, route plans, proof checks, CAS checks, SMT checks, session histories, privacy packets, execution receipts, notebook provenance, validation gates, closure reports, agent plans, sandbox measurements, and UI reviews never become durable queue evidence. The report draft writer also validates the JSON sidecar against `report-draft.schema.json` before writing, so malformed saved reports fail at the write boundary. Saved report drafts also re-check their Markdown sidecar SHA-256 and byte length, so the human-facing review text cannot silently drift away from the JSON receipt.
The credibility-pack writer validates reviewer packets against `credibility-pack.schema.json` before saving them, so a corrupt manifest, malformed engine ladder, or broken reviewer action plan cannot become the packet a professor is asked to trust.
The evidence-audit writers validate against `evidence-audit.schema.json` before saving JSON or Markdown reports, so overclaim reviews and missing-evidence summaries cannot enter the reviewer ledger with malformed provenance.
The experiment-log writer validates against `experiment-log.schema.json` before saving experiment evidence, so wet-lab, field, preclinical, clinical, and bench provenance cannot enter the workspace with malformed identity or review boundaries.
The expert-review writer validates against `expert-review.schema.json` before saving human review records, so professor, domain expert, clinical, regulatory, safety, and patent/legal reviews cannot be persisted with malformed reviewer scope or project identity.
The literature-record writer validates against `literature-record.schema.json` before saving source metadata, so citations, prior art, papers, datasets, and local corpus notes cannot enter the evidence ledger with malformed project identity or review boundaries.
The simulation-log writer validates against `simulation-log.schema.json` before saving computational evidence, so physics, molecular, statistical, agentic, and numeric simulations cannot become durable evidence with malformed model scope, validation boundaries, or workspace identity.
The invention-log writer validates against `invention-log.schema.json` before saving invention provenance, so discovery notes, patent-adjacent claims, prior-art notes, and safety warnings cannot become durable records with malformed project identity or legal-review boundaries.

When using the npm wrapper, pass command flags after an extra separator so npm does not consume them:

```bash
npm run cli -- workspace credibility-pack . -- --require-docker-core
npm run cli -- workspace credibility-pack . -- --require-all-engines
npm run cli -- workspace credibility-pack . -- --dry-run --json
npm run cli -- workspace credibility-actions . -- --require-all-engines --priority critical --json
npm run cli -- workspace credibility-bundle . -- --require-docker-core
npm run cli -- workspace verify-credibility-bundle . -- .truth-harness/findings/<date>-<bundle-id>-credibility-bundle
```

## What The Pack Contains

- Workspace validation summary.
- Embedded local artifact snapshot with file hashes.
- Concrete engine evidence report from `engines verify`.
- Structured engine evidence ladder that separates required/optional gates, earned/missing/failed evidence, and the plain-English reviewer meaning for each engine row.
- Saved engine-run ledger summary from `.truth-harness/engine-runs`, including the strongest passed engine ladder level, the latest no-network Docker professor run, and the latest strict all-engines reviewer run when they exist.
- Engine-run records validate against `engine-run.schema.json` before they are saved, so reviewer packets cannot cite malformed or non-replayable engine evidence ledger entries.
- Saved benchmark ledger summary from `.truth-harness/benchmarks`, including the latest `ai-failure-seed` adversarial AI-failure run and latest `math-credibility-ladder` hard-math readiness run, artifact paths, trust accuracy, replay commands, and sample receipt replay commands.
- Benchmark run and comparison records validate against their schemas before saving, so adversarial demo scores and regression verdicts cannot become citable reviewer evidence if the local ledger shape is malformed.
- Saved hard-math closure ledger summary from `.truth-harness/findings`, including the latest Docker exact, symbolic CAS, and SMT closure reports. These reports prove only that a seeded validation blocker was routed to scoped evidence and recorded; they do not upgrade unrelated claims.
- Saved report draft summary from `.truth-harness/findings`, including how many human-facing Markdown drafts exist and whether any need integrity review before sharing.
- Workspace review queue with top actionable proof/check obligations. Passive route-only placeholders remain on their source verifier routes as overclaim boundaries and are summarized as omitted passive obligations instead of filling the next-action queue.
- Lean proof-safety blocker count from the workspace review. Any sampled `.lean` source containing `sorry`, `admit`, a Lean metavariable hole, local `axiom`, or local `constant` is surfaced as a named reviewer action before the affected source can support `proved`.
- Structured reviewer action plan with priorities, close targets, and commands for validation, engine, benchmark, hard-math closure, and workspace-review blockers.
- Exact reviewer commands for validation, writable engine checks, adversarial benchmarks, the math credibility ladder, exact/symbolic/SMT hard-math closure, review, Docker core engines, the Lean proof fixture, the heavier SageMath fixture, and the strict all-engine Docker gate.
- A one-command Docker professor evidence route: `npm run docker:professor` builds the pinned Lean proof image, then writes Maxima/Z3/cvc5/Lean engine evidence, adversarial benchmark evidence, math credibility ladder evidence, exact/symbolic/SMT hard-math closure evidence, a credibility pack, and a verified portable reviewer bundle from inside the no-network compose service.
- Blocking warnings when validation fails, required engines are missing, concrete engine smoke gates are incomplete, either required benchmark run is missing/failing, saved report drafts fail Markdown sidecar integrity, or critical review items remain open.

## Portable Reviewer Bundle

Use `truth-harness workspace credibility-bundle .` when you want to hand the evidence to someone else instead of asking them to trust your UI or your chat history.

The canonical bundle is intentionally a directory, not a black-box archive:

- `manifest.json` records `bundleId`, `packId`, source paths, copied paths, byte counts, SHA-256 hashes, reviewer commands, trust-boundary warnings, and a manifest digest over reviewer-critical metadata.
- `credibility-pack.json` and `credibility-pack.md` preserve the generated professor credibility pack.
- `artifacts/` contains copied canonical Truth Harness workspace files from the embedded snapshot.
- Prior `*-credibility-bundle/` folders are skipped so repeated exports do not recursively copy old bundles into new bundles.

The bundle writer validates `manifest.json` against `credibility-bundle.schema.json` before saving it, stamps new bundles with a manifest digest, and saved bundle-verification records validate against `credibility-bundle-verification.schema.json` before their JSON/Markdown sidecars are written. A malformed reviewer handoff fails before it becomes citable evidence. The manifest digest is tamper evidence for reviewer commands, limitations, summaries, and provenance; it is not a cryptographic signature or a truth upgrade.

The web Report tab can also rerun local bundle verification with **Verify now**, show a saved verification history, download a `.tar.gz` archive of the latest bundle, and download a `.sha256` sidecar. The web verifier uses the same core `verifyCredibilityBundle` path as the CLI, writes a `truth-harness.credibility-bundle-verification.v0` finding under `.truth-harness/findings`, and reports copied file integrity, manifest digest status, and source-workspace drift as separate facts. The archive is only a portable carrier for the same directory contents; it does not add trust by itself. The sidecar identifies the exact downloaded archive bytes. Extract it, then run the normal `verify-credibility-bundle` command against the extracted bundle directory when reviewing outside the original workspace.

Verify it with:

```bash
truth-harness workspace verify-credibility-bundle . .truth-harness/findings/<date>-<bundle-id>-credibility-bundle
truth-harness workspace verify-credibility-bundle <bundle-id>
truth-harness workspace verify-credibility-bundle <bundle-path> --fail-on-bundle-change --fail-on-source-drift
truth-harness workspace verify-credibility-bundle <bundle-id> --write
```

Bundle verification reports two separate facts:

- **Bundle integrity:** copied files still match the manifest hashes.
- **Source workspace drift:** the current workspace files still match the versions copied into the bundle.
- **Manifest digest:** reviewer-critical manifest metadata still matches the digest recorded at export time. Older bundles that predate this field report `not-recorded` instead of failing.

Each saved web or CLI `--write` verification gets a stable `cver_...` ID and appears in the Report tab verification history so reviewers can cite when the bundle was checked. The Report tab can download each saved verification as JSON or Markdown by that stable ID; the web API resolves those files from the local findings ledger instead of accepting arbitrary paths from the browser.
Release audit now treats the latest saved `cver_...` reviewer-bundle verification as its own readiness check. It passes only when copied-file integrity passes, the manifest digest is `verified`, and the current source workspace still matches the bundle snapshot. Missing or older no-digest verifications remain honest warnings; copied-file failures, manifest-digest mismatches, or source drift block public-review readiness until the bundle is reverified or regenerated.

A bundle can remain valid even after the live workspace changes. That is useful for peer review because the exported evidence can be frozen while active research continues.

Agents can use the same workflow through MCP:

- `truth_harness_workspace_credibility_actions`
- `truth_harness_workspace_credibility_bundle`
- `truth_harness_workspace_credibility_bundle_verify`

All MCP tools are local-only. The actions tool is read-only and returns the unresolved reviewer queue without executing commands. The create tool writes the bundle directory; the verify tool only reads the manifest, copied hashes, and current workspace source files.

## What Counts As Professor Ready

A pack is `ready-for-review` only when:

- workspace validation passes,
- all concrete engine smoke gates pass, or recoverable host probe gaps are covered by a saved passing no-network Docker professor/all-engine run for the same capabilities,
- every explicitly required engine gate passes, or recoverable host probe gaps are covered by a saved passing no-network Docker professor/all-engine run for the same required capabilities,
- the strongest saved engine ladder level is visible in the packet whenever saved engine evidence is used to cover host probe gaps,
- the latest saved `ai-failure-seed` adversarial benchmark exists and has no failing cases,
- the latest saved `math-credibility-ladder` benchmark exists and has no failing cases,
- Docker hard-math closure reports exist and pass for the exact arithmetic, symbolic CAS, and SMT seeded closure fixtures,
- saved report draft Markdown files match the SHA-256 recorded in their JSON sidecars,
- the Lean proof-safety scan has no open blocking markers in the inspected workspace review scope,
- the workspace review has no critical open items.

Critical review items are reserved for product, evidence, or current-claim blockers. Open research routes that honestly remain `unverified` should appear as high-priority work when there is an actionable local command, while route-only upgrade placeholders should stay on the verifier route as passive boundaries. The queue should make the next honest move obvious without making the whole workspace look broken.

This status is intentionally conservative. A ready pack does not prove every claim; it only says the workspace is coherent enough for external review.

When the pack is blocked, `reviewerActionPlan.actions` is the first queue a human reviewer or agent should inspect. Each action records:

- the priority (`critical`, `high`, `medium`, or `low`),
- the category (`validation`, `engine`, `benchmark`, `closure`, or `workspace-review`),
- the evidence status and reviewer meaning for blocked engine gates,
- benchmark actions mean the reviewer packet is missing or failing the saved adversarial AI-failure suite or the saved math credibility ladder,
- closure actions mean the reviewer packet is missing or failing a saved Docker hard-math closure report for exact arithmetic, symbolic CAS, or SMT blocker closure,
- the exact command to run,
- the gate or artifact it closes.

If a local host or agent sandbox reports `spawn EPERM` or `spawn ENOENT` while launching Maxima, Z3, cvc5, Lean, or SageMath, the action plan treats that as a host boundary problem rather than a mathematical result. Maxima/Z3/cvc5 actions point to `npm run docker:engines`, Lean actions point to the pinned `lean-proof` compose service, SageMath actions point to `npm run docker:sage`, and strict all-engine review points to `npm run docker:all-engines` or `npm run docker:all-engines:write`. If a saved no-network Docker professor run already proves Maxima/Z3/cvc5/Lean availability for the same scope, or a saved all-engine run proves Maxima/Z3/cvc5/Lean/SageMath availability, the pack and release audit cite that durable engine-run record instead of repeatedly blocking on missing Windows host binaries. The cited ledger now includes the strongest passed engine ladder level, so reviewers can distinguish a practical professor run from the strict `engine-level-5-strict-all-engines` standard. Release audit can likewise cite a saved `truth-harness.sandbox-run.v0` record from `npm run docker:sandbox:write` when the Windows host itself cannot measure the code-run sandbox boundary, and a saved `truth-harness.web-ui-review.v0` record when a human or browser automation has reviewed the launch surface. Those records are still evidence gates, not truth shortcuts: the engines, sandbox measurement, and UI review must earn their scoped evidence before any reviewer should trust the result.

For the cleanest reviewer rehearsal, run `npm run docker:professor`. That command does not ask the web UI or an agent to run arbitrary shell code. It starts from the pinned Lean Docker image, runs the professor evidence sequence in the no-network `professor-evidence` compose service, and stops before writing the portable reviewer bundle if any earlier engine, benchmark, closure, or pack-readiness gate fails. When it succeeds, it verifies the bundle hashes and source-workspace match immediately. When a stricter auditor wants SageMath included in the same packet, run `npm run docker:professor:all`. That heavier path starts from the all-engine image and writes engine evidence, benchmarks, exact/symbolic/SMT closure reports, a credibility pack, and a portable reviewer bundle while requiring Maxima, Z3, cvc5, Lean, and SageMath through `--require-all-engines`. If a reviewer only needs a saved strict engine-run record rather than a full bundle, run `npm run docker:all-engines:write` and rebuild the catalog so the saved strict all-engine record is citable. The generated credibility pack is still the authority on whether optional all-engine gates or unresolved review actions block stricter review.

The web Report tab renders the same action plan, exposes copy buttons for those commands, shows the latest reviewer-bundle checklist, displays the archive SHA-256, and can download the latest bundle README, manifest, credibility-pack Markdown, `.tar.gz` archive, or `.sha256` sidecar through local-only read endpoints. It also cites saved `cver_...` bundle verification artifacts inside the copied/downloaded report draft, including their local JSON/Markdown paths and download URLs. The Report tab **Save** action writes the current report draft as paired Markdown and `truth-harness.report-draft.v0` JSON under `.truth-harness/findings/`, including a `report_...` ID, Markdown SHA-256, source receipt/claim/trust, and cited bundle verification IDs. It can ask `/api/workspace-run-next?source=credibility-actions` for the next browser-safe reviewer plan. That web path is dry-run only; it shows and copies the same local command that CLI/MCP can execute through the shared gated planner. The Report tab can also save the dry-run plan as JSON/Markdown under `.truth-harness/findings/`, creating an auditable intent packet before any agent or human runs the command. Browser automation can call `window.truthHarnessUiAudit()` or open `http://127.0.0.1:4180/?uiAudit=1` to cycle the core surfaces and return a hidden `truth-harness.web-ui-layout-audit.v0` JSON payload covering visible overflow, clipping, nested-scroll traps, and branch-map overlap. Save that JSON under `.truth-harness/findings/` and attach it with `truth-harness workspace ui-review . --layout-audit .truth-harness/findings/<audit>.json --write`; the UI review will inherit warning/failure status from the audit instead of letting a failed layout pass be recorded as clean. MCP `truth_harness_workspace_ui_review` accepts the same `layoutAudit` path for agent-written reviews. That layout audit is UI evidence only; it is designed to catch launch-surface regressions before a saved `web-ui-review` record, not to prove any mathematical or scientific result.
Portable reviewer bundles now surface saved report drafts as first-class manifest entries under `reportDrafts`, cite them in the bundle README, and verify that each bundled Markdown draft matches the SHA-256 recorded by its JSON sidecar. That makes the exportable handoff include not just raw receipts, but the human-facing report draft that was created from them.
Headless reviewers and agents can inspect the same saved drafts with `truth-harness workspace reports .`, `truth-harness workspace report <report_...> . --markdown`, MCP `truth_harness_report_list`, and MCP `truth_harness_report_read`; all paths use the same core Markdown hash verification as the web Report tab and expose `artifactRefs` for the JSON/Markdown sidecars with file SHA-256, byte size, and copyable citations when present. Workspace review and run-next also surface report drafts as first-class local queue items: verified drafts are review artifacts, while missing or hash-mismatched Markdown blocks sharing until a human or agent reconciles the sidecar.
For automation or CI, use `truth-harness workspace credibility-actions . --json` to get a compact `truth-harness.credibility-actions.v0` payload. `--priority` and `--category` filter the queue without mutating workspace state.
For bounded agent work, use `truth-harness workspace run-next . --source credibility-actions --json` to plan the first reviewer action through the shared autonomy contract. Adding `--execute-local` only runs supported local Truth Harness core APIs, such as writable engine verification runs and `truth-harness bench run ... --write` benchmark runs; it does not execute shell strings. When the first action is the adversarial AI-failure benchmark or the math credibility ladder, run-next reads the workspace-local suite JSON, generates receipts in-process, writes a durable `truth-harness.benchmark-run.v0` artifact, and the next credibility pack/release audit cites that artifact path plus replay metadata. Docker hard-math closure actions stay explicit manual/container actions because they intentionally cross the Docker boundary; the saved closure reports they write are then cited by the next credibility pack and release audit.

Maxima and SageMath CAS check records can support the narrow `cross-checked` label only when a concrete recorded agreement exists. Z3 and cvc5 SMT records can support the narrow `smt-checked` label only when the selected solver returns `sat` or `unsat` for a concrete SMT-LIB artifact. The default Docker core credibility gate now requires Maxima, Z3, and cvc5 evidence. SageMath is available as a direct constrained CAS adapter and as the heavier no-network `sage-math` Docker gate through `--require-sage` or `npm run docker:sage`. Use `--require-all-engines` when a reviewer packet should fail unless Maxima, Z3, cvc5, Lean, and SageMath all earn their own scoped evidence. Use `npm run docker:all-engines` for the no-network strict gate and `npm run docker:all-engines:write` when the strict result should be saved for audit citation. Credibility-pack reviewer commands now use `truth-harness engines verify --write ...` so reruns create durable `.truth-harness/engine-runs` records instead of transient terminal output. That stronger mode is still a smoke gate over representative fixtures, not proof of every workspace claim.

## What It Does Not Prove

- It does not prove the mathematical truth of every claim.
- It does not prove scientific, medical, safety, legal, or patent conclusions.
- It does not upgrade trust labels.
- It does not replace Lean, Z3, cvc5, Maxima, SageMath, peer review, or human domain expertise.

The pack is a reviewer doorway: it gives serious people one local artifact to inspect before deciding whether the underlying receipts, proof-checks, SMT/CAS records, routes, and claims deserve deeper attention.
The reviewer bundle is the handoff container for that doorway: it makes the packet and its cited local artifacts portable, hash-checkable, and inspectable without relying on the browser.

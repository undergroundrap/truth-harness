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
truth-harness workspace credibility-bundle .
truth-harness workspace verify-credibility-bundle . .truth-harness/findings/<date>-<bundle-id>-credibility-bundle
```

The command writes paired JSON and Markdown into `.truth-harness/findings/` unless `--dry-run` is used.
The `credibility-actions` command computes the same pack but prints only the unresolved reviewer queue; it never executes the suggested commands.
The bundle command writes a plain directory under `.truth-harness/findings/` with a manifest, copied canonical artifacts, the generated credibility pack, and a README.

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
- Saved engine-run ledger summary from `.truth-harness/engine-runs`, including the latest strict all-engines reviewer run when one exists.
- Workspace review queue with top open proof/check obligations.
- Structured reviewer action plan with priorities, close targets, and commands for validation, engine, and workspace-review blockers.
- Exact reviewer commands for validation, writable engine checks, review, Docker core engines, and the Lean proof fixture.
- Blocking warnings when validation fails, required engines are missing, concrete engine smoke gates are incomplete, or critical review items remain open.

## Portable Reviewer Bundle

Use `truth-harness workspace credibility-bundle .` when you want to hand the evidence to someone else instead of asking them to trust your UI or your chat history.

The bundle is intentionally a directory, not a black-box archive:

- `manifest.json` records `bundleId`, `packId`, source paths, copied paths, byte counts, SHA-256 hashes, reviewer commands, and trust-boundary warnings.
- `credibility-pack.json` and `credibility-pack.md` preserve the generated professor credibility pack.
- `artifacts/` contains copied canonical Truth Harness workspace files from the embedded snapshot.
- Prior `*-credibility-bundle/` folders are skipped so repeated exports do not recursively copy old bundles into new bundles.

Verify it with:

```bash
truth-harness workspace verify-credibility-bundle . .truth-harness/findings/<date>-<bundle-id>-credibility-bundle
truth-harness workspace verify-credibility-bundle <bundle-id>
truth-harness workspace verify-credibility-bundle <bundle-path> --fail-on-bundle-change --fail-on-source-drift
```

Bundle verification reports two separate facts:

- **Bundle integrity:** copied files still match the manifest hashes.
- **Source workspace drift:** the current workspace files still match the versions copied into the bundle.

A bundle can remain valid even after the live workspace changes. That is useful for peer review because the exported evidence can be frozen while active research continues.

Agents can use the same workflow through MCP:

- `truth_harness_workspace_credibility_actions`
- `truth_harness_workspace_credibility_bundle`
- `truth_harness_workspace_credibility_bundle_verify`

All MCP tools are local-only. The actions tool is read-only and returns the unresolved reviewer queue without executing commands. The create tool writes the bundle directory; the verify tool only reads the manifest, copied hashes, and current workspace source files.

## What Counts As Professor Ready

A pack is `ready-for-review` only when:

- workspace validation passes,
- all concrete engine smoke gates pass,
- every explicitly required engine gate passes,
- the workspace review has no critical open items.

This status is intentionally conservative. A ready pack does not prove every claim; it only says the workspace is coherent enough for external review.

When the pack is blocked, `reviewerActionPlan.actions` is the first queue a human reviewer or agent should inspect. Each action records:

- the priority (`critical`, `high`, `medium`, or `low`),
- the category (`validation`, `engine`, or `workspace-review`),
- the exact command to run,
- the gate or artifact it closes.

The web Report tab renders the same action plan, exposes copy buttons for those commands, and can ask `/api/workspace-run-next?source=credibility-actions` for the next browser-safe reviewer plan. That web path is dry-run only; it shows and copies the same local command that CLI/MCP can execute through the shared gated planner. The Report tab can also save the dry-run plan as JSON/Markdown under `.truth-harness/findings/`, creating an auditable intent packet before any agent or human runs the command.
For automation or CI, use `truth-harness workspace credibility-actions . --json` to get a compact `truth-harness.credibility-actions.v0` payload. `--priority` and `--category` filter the queue without mutating workspace state.
For bounded agent work, use `truth-harness workspace run-next . --source credibility-actions --json` to plan the first reviewer action through the shared autonomy contract. Adding `--execute-local` only runs supported local Truth Harness core APIs, such as writable engine verification runs; it does not execute shell strings.

Maxima and SageMath CAS check records can support the narrow `cross-checked` label only when a concrete recorded agreement exists. Z3 and cvc5 SMT records can support the narrow `smt-checked` label only when the selected solver returns `sat` or `unsat` for a concrete SMT-LIB artifact. The default Docker core credibility gate currently requires Maxima and Z3 evidence. cvc5 is an optional second SMT solver gate through `--require-cvc5`; SageMath is available as a direct constrained CAS adapter and as the heavier no-network `sage-math` Docker gate through `--require-sage` or `npm run docker:sage`. Use `--require-all-engines` when a reviewer packet should fail unless Maxima, Z3, cvc5, Lean, and SageMath all earn their own scoped evidence. Credibility-pack reviewer commands now use `truth-harness engines verify --write ...` so reruns create durable `.truth-harness/engine-runs` records instead of transient terminal output. That stronger mode is still a smoke gate over representative fixtures, not proof of every workspace claim.

## What It Does Not Prove

- It does not prove the mathematical truth of every claim.
- It does not prove scientific, medical, safety, legal, or patent conclusions.
- It does not upgrade trust labels.
- It does not replace Lean, Z3, cvc5, Maxima, SageMath, peer review, or human domain expertise.

The pack is a reviewer doorway: it gives serious people one local artifact to inspect before deciding whether the underlying receipts, proof-checks, SMT/CAS records, routes, and claims deserve deeper attention.
The reviewer bundle is the handoff container for that doorway: it makes the packet and its cited local artifacts portable, hash-checkable, and inspectable without relying on the browser.

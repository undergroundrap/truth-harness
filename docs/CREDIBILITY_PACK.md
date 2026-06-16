# Professor Credibility Pack

The credibility pack is the first reviewer-facing artifact for serious mathematicians, professors, and technical auditors.

It does not claim the workspace is true. It creates a local packet that says what is currently checkable, what is blocked, which engines earned concrete evidence, which files were present, and which commands a reviewer should rerun.

## Command

```bash
truth-harness workspace credibility-pack .
truth-harness workspace credibility-pack . --require-docker-core
truth-harness workspace credibility-pack . --require-all-concrete
truth-harness workspace credibility-pack . --dry-run --json
```

The command writes paired JSON and Markdown into `.truth-harness/findings/` unless `--dry-run` is used.

When using the npm wrapper, pass command flags after an extra separator so npm does not consume them:

```bash
npm run cli -- workspace credibility-pack . -- --require-docker-core
npm run cli -- workspace credibility-pack . -- --dry-run --json
```

## What The Pack Contains

- Workspace validation summary.
- Embedded local artifact snapshot with file hashes.
- Concrete engine evidence report from `engines verify`.
- Workspace review queue with top open proof/check obligations.
- Exact reviewer commands for validation, engine checks, review, Docker core engines, and the Lean proof fixture.
- Blocking warnings when validation fails, required engines are missing, concrete engine smoke gates are incomplete, or critical review items remain open.

## What Counts As Professor Ready

A pack is `ready-for-review` only when:

- workspace validation passes,
- all concrete engine smoke gates pass,
- every explicitly required engine gate passes,
- the workspace review has no critical open items.

This status is intentionally conservative. A ready pack does not prove every claim; it only says the workspace is coherent enough for external review.

## What It Does Not Prove

- It does not prove the mathematical truth of every claim.
- It does not prove scientific, medical, safety, legal, or patent conclusions.
- It does not upgrade trust labels.
- It does not replace Lean, Z3, Maxima, SageMath, peer review, or human domain expertise.

The pack is a reviewer doorway: it gives serious people one local artifact to inspect before deciding whether the underlying receipts, proof-checks, SMT/CAS records, routes, and claims deserve deeper attention.

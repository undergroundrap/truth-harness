# Contributing

Truth Harness is early, but the contribution standard should already be serious.

## Principles

- Receipts over prose.
- Benchmarks over anecdotes.
- Counterexamples over confident wrong answers.
- Small adapters over hidden magic.
- Honest `unverified` states over fake certainty.

## Local Checks

```bash
npm install
npm run check
npm run proof:launch
```

`npm run proof:launch` runs the public proof path: write/replay a receipt, run the seed benchmark suite, and check the Markdown claim examples.

## Good First Contributions

- Add benchmark tasks to `packages/benchmarks/suites/foundations-seed.json`.
- Add Markdown claim examples under `docs/examples/`.
- Improve CLI output readability without changing receipt semantics.
- Add parser support for a narrow, well-tested problem shape.
- Start an adapter spike for SymPy, Lean, Z3, units, or dimensional analysis.

## Adapter Rules

New adapters should:

- Return structured tool inputs and outputs.
- Preserve replayable artifacts.
- Add benchmark coverage.
- Fail closed when the adapter cannot verify a claim.
- Avoid network access by default unless the adapter is explicitly configured for it.

## Trust Labels

Do not change trust-label semantics lightly. In particular:

- `proved` means a proof checker accepted it.
- `exact-computed` means exact arithmetic or symbolic computation produced a replayable result.
- `dimension-checked` means both sides of a formula have matching physical dimensions; it is not a proof of the physics.
- `refuted` means a counterexample or contradiction invalidated the claim.
- `unverified` is a valid and important outcome.

## Pull Request Checklist

- `npm run check` passes.
- `npm run proof:launch` passes.
- New behavior has tests or benchmark tasks.
- Docs mention limitations honestly.
- No generated receipts, logs, or `node_modules` are committed.

# Reusing Checked Recurrence Evidence

This scripted demonstration uses one checked result in a second matching model,
then rejects reuse when an initial condition changes. It does not run an LLM,
discover formulas, prove source-code behavior, or add a general dependency engine.

## Models And Assumptions

Consider a complete balanced binary recursion of height `h >= 0`. Every nonleaf
invocation makes exactly two recursive calls of height `h-1`. There is no pruning,
memoization, early exit, or additional recursion. Height zero is a single leaf.

Counting all invocations gives the same formal recurrence as perfect-tree nodes:

```text
C(0) = 1
C(h+1) = 2*C(h)+1
C(h) = 2*2^h-1
```

The workflow independently replays the saved tree receipt against a separately
serialized request for this call-count model. The receipt hash stays the same.
This reuses evidence for an identical formal request, not merely similar wording.
Mapping a real program to this recurrence remains a human-supplied modeling
argument. The checker does not establish that a program satisfies these assumptions.

Now count only nonleaf work, one unit per internal invocation and zero per leaf:

```text
W(0) = 0
W(h+1) = 2*W(h)+1
W(h) = 2^h-1
```

The old receipt must fail request binding because the initial value changed.
That rejection is not a mathematical refutation. A separate check of the old
formula under the new recurrence supplies the counterexample: at height zero,
the old formula gives 1, while the model requires 0. A new receipt checks the
corrected formula. Both accepted results remain `exact-computed`, never `proved`.

## Run

```sh
docker compose run --build --rm -T pit-experiment node tools/cs-recurrence-reuse.mjs
```

Each run writes a dated `PROGRESS.md`, model requests, and `report.json` under
`.truth-harness/experiments/`. The report links the source, refutation and corrected
receipt directories and hashes. Its `replay` fields give paths for:

```text
polynomial replay recurrence REQUEST RECEIPT --json
```

Exit 0 means the entire expected reuse/rejection/refutation/repair demonstration
succeeded, not that every tested formula was true. Exit 2 means workflow failure.
No saved report is used as proof: replay invokes the independent receipt checker.
Runtime requires the offline Docker service; image builds may fetch dependencies.

Tests cover the complete workflow, host refusal, and finite enumeration of both
mathematical recursion models at heights 0..16. Enumeration is supporting evidence,
not a universal proof or validation of arbitrary application code.

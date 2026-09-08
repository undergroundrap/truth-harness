# Divide-And-Conquer Operation Count

This is an exact count for a stated merge-style cost model, not a new research
result or verification of a sorting implementation. Inputs have size `n = 2^h`
for a nonnegative integer height `h`. Leaves cost zero; every internal call
splits into two equal subproblems and performs exactly `n-1` combine operations.
No pruning, early exit, memoization, allocation cost, or machine timing is modeled.

## Model And Reduction

```text
T(1) = 0
T(n) = 2*T(n/2) + n-1, n = 2^h, h >= 1
A(h) = T(2^h)
A(0) = 0; A(1) = 1
A(h+1) - 2*A(h) = 2^(h+1)-1
A(h+2) = 4*A(h+1) - 4*A(h) + 1
```

The last relation follows by subtracting twice the preceding first-order
equation from its one-step shift. Conversely, define the first-order defect
`D(h)=A(h+1)-2*A(h)-2^(h+1)+1`. The second-order relation implies
`D(h+1)=2*D(h)`, and the two initial values give `D(0)=0`. Thus the reduction
loses no condition under this model. This paragraph is an inspectable human
algebra argument, not a separately machine-checked certificate of the reduction.

## Candidates

```text
Correct: A(h) = (h-1)*2^h + 1
Therefore: T(n) = n*log2(n) - n + 1, only for n = 2^h
False exact candidate: A(h) = h*2^h
At h=1 (n=2): false candidate gives 2; the model requires 1.
```

The checker handles `h` and rational exponential-polynomial data, not a logarithm
parser. It checks all initial values and every recurrence-residual coefficient.
The accepted result is `identity-checked` / `exact-computed`, not `proved`.
Refuting `n*log2(n)` as an exact count does not refute it as an upper bound or
asymptotic description. This experiment does not check asymptotic bounds.

## Run And Reopen

```sh
docker compose run --build --rm -T pit-experiment node apps/cli/dist/index.js polynomial recurrence docs/examples/cs-divide-conquer-correct.json --json
docker compose run --rm -T pit-experiment node apps/cli/dist/index.js polynomial recurrence docs/examples/cs-divide-conquer-refuted.json --json
docker compose run --rm -T pit-experiment node tools/recurrence-reopen.mjs docs/examples/cs-divide-conquer-correct.json
```

The false-candidate command intentionally exits 1 with a checked counterexample.
Each verification run saves requests, receipts, reports and dated `PROGRESS.md`
files under `.truth-harness/witnesses/`. Reopen discovers saved evidence and
checks it again without writing replacement evidence. A refuted receipt is valid
evidence of failure, but cannot be reopened as an accepted identity.

Tests separately enumerate this mathematical recursion and its combine operations
for heights 0..16, compare both recurrence forms, replay both candidate receipts,
and reopen the accepted result in a fresh process. The finite enumeration supports
the modeling argument but is not a proof for arbitrary code or arbitrary sizes.

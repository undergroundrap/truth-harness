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
loses no condition under this model. The algebraic identity and initial defect
now have separately replayable coefficient checks, as described below. The
variable mapping and induction argument are still human-reviewed, not a
proof-kernel certificate of this entire reduction.

## Check The Reduction Algebra

In `cs-divide-conquer-reduction.json`, variables in order are
`a=A(h)`, `b=A(h+1)`, `c=A(h+2)`, and `q=2^(h+1)`. The supplied left side is
the distributed form of `(c-2*b-2*q+1)-2*(b-2*a-q+1)`, preserving duplicate
terms. The right side is `c-4*b+4*a-1`. Coefficient comparison checks this
identity for every rational `a,b,c,q`, without sample-based inference.

`cs-divide-conquer-initial-defect.json` checks `1-2*0-2+1=0` using the stated
initial values. Its required variable slot is unused because this is constant
arithmetic. Tests also refute a wrong-sign residual constant and a nonzero
initial defect, and reject using the original receipts for changed requests.

```sh
docker compose run --build --rm -T pit-experiment node apps/cli/dist/index.js polynomial compare docs/examples/cs-divide-conquer-reduction.json --json
docker compose run --rm -T pit-experiment node apps/cli/dist/index.js polynomial compare docs/examples/cs-divide-conquer-initial-defect.json --json
```

These commands save their own requests, receipts, reports and dated journals.
Use `polynomial replay compare REQUEST_PATH RECEIPT_PATH --json` inside the
same Docker service to check them again. Results are `equivalent` with
`exact-computed` trust, never `proved`.

Remaining assumptions: the sparse inputs faithfully transcribe the displayed
expressions, the exponent shift is `q -> 2*q`, and ordinary induction propagates
`D(0)=0` via `D(h+1)=2*D(h)`. There is no expression parser, automatic dependency
link to the recurrence receipt, source-code verification, or complete formal
proof here. These receipts narrow the unchecked algebra, not those boundaries.

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

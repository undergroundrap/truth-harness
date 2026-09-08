# Bounded Exponential Recurrences

This extension checks a supplied candidate, not arbitrary programs or expressions.
It uses the existing `polynomial recurrence` CLI/MCP operation with request version
`truth-harness.exponential-recurrence.v0`. The polynomial V0 contract is unchanged.

## Contract

The recurrence remains `u(n+r) = sum(a[j]*u(n+j)) + f(n)` for `n >= 0`,
with order 1..4, constant rational coefficients and all `r` initial values.
Forcing is polynomial. Candidate terms have exactly `coefficient`, `exponents`
(one integer degree), and `base`, representing `coefficient * n^degree * base^n`.
At index zero, the degree-zero monomial is 1.

Each term array has at most 32 terms, degrees are 0..12, and rational strings
are canonical with at most 21 numerator-magnitude or denominator digits.
Candidate bases are nonzero rationals, with magnitude between 1/16 and 16
inclusive, and at most four distinct bases. Negative bases are allowed.
Empty candidates mean zero. `budget.max_index` is an integer 0..16 inclusive.
Unknown versions, extra fields, duplicate JSON keys, BOM and inputs over 65536
UTF-8 bytes fail closed. No algebraic roots or general expression parser exist.

## Binary Tree Example

A perfect binary tree with height zero consisting of one node has the model
`N(0)=1`, `N(h+1)=2*N(h)+1`. The supplied candidate `2*2^h-1` satisfies it.
This is a known counting identity, not a new research result or a source-code proof.

- [Accepted candidate](examples/exponential-recurrence-tree.json).
- [False candidate](examples/exponential-recurrence-refuted.json): `2^h` agrees
  at zero but gives 2 instead of 3 at height one.
- [Unresolved candidate](examples/exponential-recurrence-unknown.json): the same
  false candidate with search limited to zero must remain `unknown`.

## Independent Checking

SymPy constructs initial values and residual coefficient traces grouped by base.
A fresh Python `-S` process independently recomputes them using Fraction arithmetic
and binomial translation, without SymPy. For each base `b`, it checks every
coefficient of `b^r*P_b(n+r)-sum(a[j]*b^j*P_b(n+j))`, subtracting forcing at
base 1. It also checks every initial value. Vanishing residuals and matching
initial values establish the candidate under this recurrence by induction,
not by sampling. All 13 coefficients per base are checked, including zero ones.

Acceptance is `identity-checked` / `exact-computed`, never `proved`.
`proof_checker_backed` remains false. The checker implementation is trusted code,
not a Lean-kernel proof. A directly recomputed mismatch yields `refuted`.
Failure of the identity with no bounded mismatch yields `unknown`.

## Running And Replaying

```sh
docker compose run --build --rm -T pit-experiment node apps/cli/dist/index.js polynomial recurrence docs/examples/exponential-recurrence-tree.json --json
```

Use `-` for stdin. Replay with `polynomial replay recurrence REQUEST RECEIPT
--json`. MCP uses `truth_harness_polynomial_check` or
`truth_harness_polynomial_replay`, `operation: "recurrence"`, and the same JSON.
Capabilities advertise both accepted request versions. Exit codes are 0 checked
identity, 1 checked refutation, 2 invalid/execution failure, 3 unresolved.
MCP marks nonzero outcomes as errors; inspect the returned status.

Receipts use `truth-harness.exponential-recurrence-receipt.v0` with canonical
request binding, candidate initial values, `residual_by_base`, and counterexample.
Reports retain `truth-harness.polynomial-recurrence-report.v0`, adding
`candidate_class: "rational-exponential-polynomial"` and
`exponential_checker_sha256` alongside the existing source hashes.
Receipt content is deterministic. Artifact paths and dated progress records are
per-run metadata under `.truth-harness/witnesses/`. Replay checks receipts afresh,
not saved reports. Execution is offline in Docker; image builds may fetch
dependencies. No cloud or telemetry is added.

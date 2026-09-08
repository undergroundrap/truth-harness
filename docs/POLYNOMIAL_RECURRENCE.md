# Bounded Polynomial Recurrences

This lane checks a supplied polynomial candidate, not arbitrary recursive code.
It does not discover formulas or handle exponential candidates.

## Contract

Request version: `truth-harness.polynomial-recurrence.v0`.
For order `r` in 1..4, the fixed interpretation is:

```text
u(n+r) = sum(a[j] * u(n+j), j=0..r-1) + f(n), n >= 0
initial_values = [u(0), ..., u(r-1)]
```

`recurrence_coefficients` lists `a[0]` through `a[r-1]`, oldest first.
Coefficients and initial values are canonical rational strings (for example
`"-1"`, `"1/2"`), with at most 21 numerator-magnitude or denominator digits.
`forcing` and `candidate` are arrays of at most 32 terms each. Each term has
`coefficient` and a single-element `exponents` array, degree 0..12.
Empty arrays mean zero. No omitted fields, extra fields or unknown versions.
`budget.max_index` is an integer 0..16, inclusive, for counterexample search.
Inputs and receipts are bounded to 65536 UTF-8 bytes; BOM and duplicate keys fail.

See [squares](examples/polynomial-recurrence-squares.json),
[false candidate](examples/polynomial-recurrence-refuted.json), and
[unresolved candidate](examples/polynomial-recurrence-unknown.json).

## Evidence Boundary

SymPy constructs the initial-value and recurrence coefficient traces. A fresh
Python `-S` process recomputes them using standard-library rational arithmetic
and binomial translation, without importing SymPy. Acceptance requires every
initial value and every coefficient of `S(n+r)-sum(a[j]*S(n+j))-f(n)` to match.
This establishes the candidate for all nonnegative indices under the supplied
recurrence by induction, not by sample agreement. It does not verify that source
code implements that recurrence.

The report remains `identity-checked` / `exact-computed`, never `proved`;
`proof_checker_backed` is false. A `refuted` report includes a directly recomputed
sequence counterexample. A failed identity with no mismatch inside the budget
remains `unknown`. The implementation and its rational arithmetic are trusted
code, not a Lean-kernel certificate.

## CLI And MCP

```sh
docker compose run --build --rm -T pit-experiment node apps/cli/dist/index.js polynomial recurrence docs/examples/polynomial-recurrence-squares.json --json
```

Use `-` for stdin. Replay with `polynomial replay recurrence REQUEST RECEIPT
--json`. MCP uses existing `truth_harness_polynomial_check` and
`truth_harness_polynomial_replay` with `operation: "recurrence"`.
Exit codes: 0 identity checked, 1 checked refutation, 2 invalid input/execution
failure, 3 unresolved. MCP marks nonzero outcomes as errors; inspect the status.

Each new run saves request, receipt, report and a dated Markdown progress record
under `.truth-harness/witnesses/`. Reports hash the request bytes, receipt bytes,
checker and helper sources. Receipt request hashes bind canonical JSON instead.
Replay recomputes evidence and does not trust a saved report. Receipt content is
deterministic; artifact directories and progress timestamps are per-run metadata.

Execution uses the offline Docker source-checkout environment. No new network,
cloud or telemetry path is added. Image builds may fetch dependencies. See the
[shared workflow](POLYNOMIAL_AGENT_WORKFLOW.md) for deployment boundaries.

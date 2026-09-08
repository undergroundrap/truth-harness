# Checked Polynomial Summation

This experimental local tool checks the claim `S(n) = sum(f(k), k=1..n)` for
**every nonnegative integer n**, with the empty sum defined as zero. Inputs are
explicit univariate rational polynomial data, not source expressions or programs.

## Contract

```json
{
  "schema_version": "truth-harness.polynomial-sum.v0",
  "summand": [{"coefficient":"1","exponents":[1]}],
  "candidate": [{"coefficient":"1/2","exponents":[2]},{"coefficient":"1/2","exponents":[1]}],
  "budget": {"max_n":13}
}
```

Each polynomial has 0..32 terms, degree 0..12, and canonical rational strings
with at most 21 digits each in the numerator magnitude and denominator. Duplicate
monomials are collected. Empty lists represent zero. There is exactly one variable.
The schema version and fields are exact: no extra assumptions, custom domains,
expressions, floating-point coefficients, or unknown versions are accepted.
Requests and receipts are each limited to 65,536 UTF-8 bytes without BOM.
Duplicate JSON keys and malformed UTF-8 fail closed.

## What Is Checked

SymPy constructs a receipt with `S(0)` and all thirteen coefficients of
`S(n+1) - S(n) - f(n+1)`. A fresh Python process with site packages disabled
reconstructs them using standard-library fractions and binomial translation.
It does not trust caller-supplied expansion steps or the producer's status.

If the base value and every recurrence coefficient are zero, ordinary induction
establishes the stated summation identity. The report uses `identity-checked`,
`exact-computed`, `checked: true`, and `proof_checker_backed: false`. This is a
specialized exact arithmetic check of the induction conditions, not a Lean
certificate and never a `proved` receipt.

Otherwise the producer searches natural numbers `0..max_n` for a mismatch.
The checker independently evaluates the candidate and directly sums the summand
at the counterexample before accepting `refuted`. A failed recurrence alone
does not get displayed as a concrete counterexample to the original sum.

`max_n` is 1..13. If all configured samples match but the induction conditions
fail, the result is `unknown`, `unverified`, and `checked: false`. The checker
also confirms that exhaustion. Increasing the budget can expose a later mismatch.
With these degree limits, a false formula must differ at one of 0..13: its
difference from the polynomial partial sum has degree at most 13. Acceptance
never depends on this sampling argument, only the base and recurrence checks.

Degree and term limits bound expansion and exact arithmetic; `max_n` is a search
limit, not a memory or time limit. Each Python subprocess has a 30-second timeout.
Tool errors and timeouts block acceptance and return exit 2.

## Docker Commands

Agents can also use the [normal CLI/MCP workflow](POLYNOMIAL_AGENT_WORKFLOW.md).

```sh
docker compose run --build --rm -T pit-experiment node tools/polynomial-sum.mjs docs/examples/polynomial-sum-linear.json
docker compose run --rm -T pit-experiment node tools/polynomial-sum.mjs docs/examples/polynomial-sum-squares.json
docker compose run --rm -T pit-experiment node tools/polynomial-sum.mjs docs/examples/polynomial-sum-refuted.json
docker compose run --rm -T pit-experiment node tools/polynomial-sum.mjs docs/examples/polynomial-sum-unknown.json
```

Use `-` for stdin. Local input files can live in the mounted `.truth-harness/`
store. Each run saves request, receipt, report, and dated `PROGRESS.md` links under
`.truth-harness/witnesses/polynomial-sum-*`. To independently reopen saved evidence:

```sh
docker compose run --rm -T pit-experiment node tools/polynomial-sum.mjs --check .truth-harness/witnesses/polynomial-sum-EXAMPLE/request.json .truth-harness/witnesses/polynomial-sum-EXAMPLE/receipt.json
```

Replace `EXAMPLE` with the emitted suffix. Recheck requires two file paths and
writes no artifacts. JSON reports include status, trust, evidence class, domain,
counterexample or null, raw request/receipt hashes, checker/helper source hashes,
and a relative artifact directory. Hashes identify bytes, not authenticity.

Exit codes: **0 identity-checked**, **1 refuted**, **2 invalid input/tool/I/O
failure**, **3 unknown**. Both 2 and 3 must block an identity-dependent workflow.
Runtime is network-disabled Docker; image builds may download dependencies.
No cloud, telemetry, Hum/VIRE dependency, or additional Mathlib installation.

## Examples And Next Boundary

The fixtures check known sums of integers and squares, reject `n^2` as the sum
of integers at `n=2` (candidate 4, actual 3), and keep that same false formula
unresolved when the budget only reaches `n=1`. Tests additionally cover sums of
cubes, the empty sum, rational constants, wrong offsets, off-by-one recurrences,
high-degree sample traps, invalid inputs, and tampered receipts.

These are known regression identities, not newly solved research problems.
They can check polynomial operation-count formulas once a separate argument
establishes that the program actually has the claimed summand. This tool does
not extract counts from code, prove asymptotic bounds, accept arbitrary recurrence
relations, or justify optimizations. General recurrences and formal Lean
export remain future work.

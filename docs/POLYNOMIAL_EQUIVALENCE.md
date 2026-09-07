# General Sparse Polynomial Equivalence

This experimental tool compares two caller-supplied sparse multivariate
polynomials over the rationals. It is independent of graphics, Hum and VIRE.
It checks polynomial **data**, not the source expression or program that
generated that data. There is no expression parser or arithmetic-circuit expansion.

## Input Contract

```json
{
  "schema_version": "truth-harness.polynomial-equivalence.v0",
  "variables": 2,
  "left": [{"coefficient":"1","exponents":[3,0]}],
  "right": [{"coefficient":"1","exponents":[0,1]}],
  "budget": {"max_samples":8,"max_bits":1024}
}
```

This asks whether `x0^3` and `x1` are the same polynomial over `Q^2`.

- Variables: 1 through 8, identified by exponent-vector position.
- Each side: 0 through 64 terms. An empty side represents zero.
- Each term: canonical rational coefficient string and one nonnegative integer
  exponent per variable. Exponents are at most 1,000,000.
- Numerator magnitude and denominator: at most 21 decimal digits each, using
  the existing canonical rational syntax. Duplicate monomials are combined;
  zero coefficients disappear and term order does not affect equality.
- Budget: 1 through 128 samples, 128 through 4096 estimated evaluation bits.
- Both input and receipt: at most 65,536 UTF-8 bytes, without BOM. Duplicate
  JSON keys, extra fields, unknown versions, floats and expressions are rejected.

There are no caller-supplied domain assumptions: a witness anywhere in `Q^n`
refutes this contract's global equality. It does not necessarily refute equality
on a restricted interval, on Boolean inputs, modulo a prime, or under constraints.

## Evidence And Limits

The producer normalizes each sparse side with SymPy rational arithmetic. The
checker runs in a fresh Python process without site packages and independently
reconstructs the entire sorted coefficient table using standard-library fractions.
Every coefficient must match for `equivalent`, with trust `exact-computed`.
This is coefficient evidence, not an inference from sampling and not `proved`.

When coefficients differ, the existing bounded prime-power tool searches for
a nonzero evaluation of **left minus right**. The checker binds that nested
receipt to the original pair and recomputes its exact evaluation before returning
`refuted`. The displayed `counterexample.value` is the difference, not either
side's individual value. Cancelled terms need not be evaluated separately.

If a nonzero witness cannot be produced within the configured sample/bit limits,
the result remains `unknown`, `unverified`, `checked: false`, even though the
coefficient table differs. This V0 contract reserves refutation for a concrete
evaluation witness. Diagnostic reasons inherited from the witness tool are not
independently certified. A tool failure is also unresolved, never equivalence.

Normalization stays sparse regardless of degree. Its fixed input limits are
separate from the evaluation bit budget, which is a conservative preflight bound,
not a process RAM limit. Each subprocess times out after 30 seconds. Equality
can succeed without any sample evaluations. A zero-polynomial result from the
older witness tool alone is never used to establish equivalence here.

## Offline Commands

```sh
docker compose run --build --rm -T pit-experiment node tools/polynomial-compare.mjs docs/examples/polynomial-equivalent.json
docker compose run --rm -T pit-experiment node tools/polynomial-compare.mjs docs/examples/polynomial-refuted.json
docker compose run --rm -T pit-experiment node tools/polynomial-compare.mjs docs/examples/polynomial-unknown.json
```

Use `-` for JSON stdin. User input files can reside in the mounted `.truth-harness/`
store. Receipts, check reports, original requests and dated Markdown journals are
saved under `.truth-harness/witnesses/polynomial-equivalence-*`.

```sh
docker compose run --rm -T pit-experiment node tools/polynomial-compare.mjs --check .truth-harness/witnesses/polynomial-equivalence-EXAMPLE/request.json .truth-harness/witnesses/polynomial-equivalence-EXAMPLE/receipt.json
```

Replace `EXAMPLE` with the reported suffix. Recheck accepts two paths and writes
no new artifacts. The JSON report includes status, trust, checked flag, evidence
class, counterexample or unresolved reason, artifact directory, raw input/receipt
hashes, and checker/dependency source hashes. The receipt binds the canonical
request separately. Hashes identify data and sources, not their authenticity.

Exit codes are **0 equivalent**, **1 refuted**, **2 invalid input/tool/I/O failure**,
and **3 unknown**. Both 2 and 3 must block a caller that requires equivalence.
Successful mathematical reports explicitly set `proof_checker_backed: false`.

Tests cover multivariate collection, cancellation, rational coefficients,
quadratic sum coefficient representations, high sparse degrees, variable ordering,
budget exhaustion and adversarial receipt edits. They do not prove a recurrence,
summation formula or compiler rewrite unless its reduction to these polynomial
inputs is checked separately. These are known synthetic regression cases, not
new research results or a measure of performance on arbitrary mathematics.

Runtime uses the existing network-disabled Docker service with no cloud,
telemetry, solver installation, or additional Mathlib download. Image builds may
download dependencies. Keep private inputs and receipts local. No changes to
the existing domain-specific tools or their trust labels are required.

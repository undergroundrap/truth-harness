# Caller-Supplied Cubic Coefficients

This experimental JSON tool lets an external program submit its own scalar cubic
Bezier controls and candidate polynomial coefficients. It does not inspect or
execute that program. Each coordinate of a vector curve can be submitted as a
separate scalar request. No Hum compiler or game engine dependency is required.

## Contract

```json
{
  "schema_version": "truth-harness.bezier-coefficients.v0",
  "controls": ["0", "1", "0", "0"],
  "candidate_coefficients": ["0", "3", "-6", "3"]
}
```

`controls` are the four Bezier control values in order. Candidate coefficients
are in **ascending** power order `[c0,c1,c2,c3]`, meaning
`c0 + c1*t + c2*t^2 + c3*t^3`. Arrays must have exactly four entries. Every entry
is a canonical rational string with numerator magnitude and denominator at most
21 decimal digits. No floats, expressions, code, extra fields, hidden assumptions,
or unknown versions are accepted. Duplicate JSON keys and UTF-8 BOMs are rejected.

Construction uses SymPy to expand the Bernstein form. A fresh Python process
without site packages independently computes the full coefficient vector by
polynomial de Casteljau blending using exact fractions. Matching **all four
coefficients**, not sampling or absence of a counterexample, establishes the
reported exact algebraic equivalence. The implementation is not formally verified.

If coefficients differ, construction tries four fixed rational parameters in
`[0,1]`. The checker validates a returned counterexample directly using scalar
de Casteljau and Horner evaluation. No point outside the declared interval can
close a refutation. The fixed cubic degree and eight bounded input rationals
bound arithmetic work; no unbounded polynomial expansion or degree input exists.
Each subprocess has a 30-second timeout. Input and receipt files are capped at
65,536 bytes. Tool failures remain unverified, never equivalent.

## Run And Recheck Offline

```sh
docker compose run --build --rm -T pit-experiment node tools/bezier-validate.mjs docs/examples/bezier-coefficients.json
docker compose run --rm -T pit-experiment node tools/bezier-validate.mjs docs/examples/bezier-coefficients-faulty.json
```

Use `-` for UTF-8 stdin, or place user files in the mounted `.truth-harness/`
store. The correct fixture exits 0. The faulty fixture exits 1 and records the
counterexample `t=1/3`, where the curve is `4/9` and the candidate is `14/27`.

Artifacts are written under `.truth-harness/witnesses/bezier-coefficients-*`:
original request, receipt, check report and dated Markdown journal. Reports
include raw request/receipt and checker/helper SHA-256 hashes. These establish
identity, not authenticity. The receipt separately binds the canonical request.

```sh
docker compose run --rm -T pit-experiment node tools/bezier-validate.mjs --check .truth-harness/witnesses/bezier-coefficients-EXAMPLE/request.json .truth-harness/witnesses/bezier-coefficients-EXAMPLE/receipt.json
```

Replace `EXAMPLE` with the generated suffix. Recheck accepts two file paths and
does not write new artifacts. Output is JSON:

- Exit 0: `status: equivalent`, `trust: exact-computed`, `checked: true`.
- Exit 1: `status: refuted`, `trust: refuted`, `checked: true`.
- Exit 2: invalid input, missing tools, timeout or I/O/checker failure;
  `status: unverified`, `checked: false`.

Successful reports explicitly set `proof_checker_backed: false`. This contract
does not certify floating-point rounding, runtime engine implementation,
optimization speed, or a surrounding informal claim. It adds no network,
cloud or telemetry; the existing Docker service disables runtime networking.
Keep private user inputs and their receipts local. Image builds can require
dependency downloads, but no additional Mathlib image or solver is needed.

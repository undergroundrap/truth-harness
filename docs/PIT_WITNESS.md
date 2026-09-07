# Bounded Sparse Polynomial Witnesses

This experimental tool accepts a supplied rational sparse polynomial and searches
for one exactly nonzero evaluation. It does not parse expressions, run a solver,
or prove a new theorem. It does not search for an unknown polynomial.

## Run Offline

```sh
docker compose run --build --rm -T pit-experiment node tools/pit-witness.mjs docs/examples/pit-witness.json
```

The example is `x^3 - y`. At `(2,3)` it evaluates to `5`. Construction uses
SymPy rational arithmetic. A fresh Python process checks the original request
and receipt using standard-library fractions, without importing SymPy.

Use `-` instead of a request path for UTF-8 JSON stdin. User files can go under
`.truth-harness/inputs/`, which the existing service mounts. Runtime networking
is disabled; building the image may need dependency downloads. No cloud,
telemetry, arbitrary code input, or Hum dependency is added. The environment
variable guard is a convenience, not a security boundary; use the Docker service.

## Request Contract

See [the complete example](examples/pit-witness.json). Only these fields are accepted:

- `schema_version`: exactly `truth-harness.pit-witness-request.v0`.
- `variables`: integer 1 through 8, ordered by the exponent vector.
- `terms`: 1 through 128 objects, each containing `coefficient` and `exponents`.
- `coefficient`: canonical rational string, such as `-3/2`, `0`, or `1`. Numerator
  magnitude and denominator have at most 21 decimal digits. No leading zeros,
  unreduced fractions, decimal notation, or expressions.
- `exponents`: one integer per variable, each between 0 and 1,000,000.
- `budget`: `max_samples` from 1 through 128 and `max_bits` from 128 through 4096.

Duplicate monomials are combined and zero coefficients removed. Storage remains
sparse regardless of degree. Duplicate JSON keys, unknown fields or versions,
boolean integers, invalid UTF-8, and UTF-8 BOMs are rejected. Input files and
receipts are limited to 65,536 bytes each.

The sample points are `(2^k,3^k,5^k,...)` using distinct primes through 19.
At most the smaller of normalized support size and `max_samples` is attempted.
Conservative integer-size estimates reject oversized evaluations *before*
power construction. These may reject computations that would fit after
cancellation. Parsing and normalization have fixed input limits separate from
`max_bits`; this is not a process RAM bound. Each Python subprocess has a
30-second timeout. Tool timeouts are failures, never mathematical conclusions.

## Receipts And Replay

Artifacts are written to a new `.truth-harness/witnesses/pit-*` directory:
`request.json`, `receipt.json`, `report.json`, and a dated `PROGRESS.md` linking them.
These local artifacts contain the supplied polynomial. Do not publish private inputs.

```sh
docker compose run --rm -T pit-experiment node tools/pit-witness.mjs --check .truth-harness/witnesses/pit-EXAMPLE/request.json .truth-harness/witnesses/pit-EXAMPLE/receipt.json
```

Replace `pit-EXAMPLE` with the reported directory. Recheck uses two file paths.
The receipt embeds the request, its canonical SHA-256, sample index, exact point,
and rational value. The report binds raw input/receipt bytes and checker/helper
source hashes. It reports `checked`, `status`, `trust`, `artifact_directory`, and
`limitations`. Rechecks create no new directory. Hashes establish identity,
not authenticity or correctness of the checker.

- Exit 0: independently checked `witness-found`, trust `exact-computed`.
- Exit 1: unresolved `unknown`, trust `unverified`, `checked: false`.
- Exit 2: invalid input, I/O, construction, timeout, or checker failure;
  JSON reports `tool-failure`, `unverified`, and `checked: false`.

Zero normalization, sample exhaustion, and bit exhaustion remain `unknown`.
Their diagnostic reasons are not independently certified. A witness check
certifies the displayed nonzero evaluation, not that it was the earliest sample.
The generic [Lean theorem](SPARSE_IDENTITY_PROOF.md) explains why sufficiently
many unbounded prime-power samples suffice. This executable is not extracted
from that proof, and its resource-bounded runs are not labeled `proved`.

## Regression Benchmark

```sh
docker compose run --build --rm -T pit-experiment node tools/pit-witness-benchmark.mjs
```

This runs the fixed [V0 synthetic suite](examples/pit-witness-benchmark.json),
not arbitrary user-supplied benchmark definitions. Ten cases cover rational
duplicates, near cancellation, five successive vanishing samples, eight-variable
ordering, zero normalization, and sample/bit budgets. Paired budget cases test
that limits remain explicit rather than silently changing the mathematical result.
The suite expects six checked witnesses and four unresolved results. These are
regression expectations, not a mathematical problem-solving success rate.

Each case constructs a receipt, checks it, then reopens it for a fresh replay.
The report compares outcomes against checked-in exact values and reasons, and
separates `checked_witnesses`, `expected_unknowns`, and `failed`. An expected
`unknown` matches a test expectation but remains unverified. Its reason is not
certified. Benchmark matching of a sample index is likewise not a proof of
earliest-witness minimality.

A dated Markdown journal, exact suite snapshot and SHA-256, per-case requests,
replay reports, and aggregate JSON are saved under a unique
`.truth-harness/experiments/pit-witness-benchmark-*` directory. Receipts remain
in the linked `.truth-harness/witnesses/` directories. Preserve both directories
when retaining a run. Repeated runs append small local artifacts; no Mathlib
download, solver run, or new service is needed. Timestamps and artifact paths
vary between runs; expected mathematical outcomes and suite identity do not.

Exit 0 means every regression expectation matched, not that every input was
proved. Exit 1 means at least one case failed, including any per-case tool or
checker failure. Exit 2 means benchmark setup, argument, or report I/O failure.

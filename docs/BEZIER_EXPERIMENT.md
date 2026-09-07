# Cubic Bezier Formula Check

For caller-supplied controls and coefficients rather than this fixed demonstration,
use the [bounded coefficient contract](BEZIER_COEFFICIENT_CONTRACT.md).

This fixed graphics-math experiment checks a familiar implementation rewrite:
the scalar cubic Bezier Bernstein form versus its expanded coefficients. Each
coordinate of a vector curve uses the same scalar weights. This is a deliberately
constructed mutation test, not a claim to have discovered a bug in VIRE or Hum.

For scalar controls `p0,p1,p2,p3`, the Bernstein form is:

```text
B(t) = (1-t)^3*p0 + 3*t*(1-t)^2*p1 + 3*t^2*(1-t)*p2 + t^3*p3
```

The equivalent coefficient form is:

```text
a = -p0 + 3*p1 - 3*p2 + p3
b = 3*p0 - 6*p1 + 3*p2
c = -3*p0 + 3*p1
B(t) = ((a*t + b)*t + c)*t + p0
```

The tool checks the four coefficient identities separately using the existing
SymPy and Maxima route. Every residual must be exactly zero and independently
cross-checked. This supports the algebraic rewrite under exact arithmetic, not
bitwise equivalence or numerical stability in floating-point implementations.
It is not labeled `proved` and does not run Lean or download Mathlib.

## Deliberate Fault And Counterexample

Replace the `p1` weight `3*t - 6*t^2 + 3*t^3` with
`3*t - 5*t^2 + 2*t^3`. Both versions agree at the endpoints `t=0` and `t=1`.
Endpoint-only checks therefore miss this error.

For controls `(0,1,0,0)`, correct minus faulty is `t^3-t^2`. To use the existing
prime-power witness tool while staying inside the curve interval, set `t=1/x`
and multiply the difference by `x^3`. For nonzero `x`, the transformed polynomial
is `1-x`. The transformation is cross-checked separately; zero is excluded from
the substitution domain. Positive prime-power samples satisfy this requirement.

The witness at `x=2` maps to `t=1/2`. A fresh standard-library Fraction checker
rechecks the polynomial receipt, then evaluates the original curve by de Casteljau
blending and the faulty formula by Horner evaluation:

```text
correct = 3/8
faulty = 1/2
correct - faulty = -1/8
```

This is an exact counterexample to the fixed faulty formula on its intended
domain. It is not a timing benchmark, new theorem, runtime engine validation,
or proof about arbitrary curve implementations.

## Offline Reproduction

```sh
docker compose run --build --rm -T pit-experiment node tools/bezier-experiment.mjs
```

The fixed tool accepts no arguments, user expressions, or uploaded programs.
It uses existing bounded subprocesses in the network-disabled service. Image
building may download dependencies; execution requires no network or telemetry.
Exit 0 means all five CAS checks and the direct counterexample replay passed.
Missing engines, nonzero identity residuals, or checker failures exit 2 with
`unverified`, never a successful equivalence report.

Artifacts live in `.truth-harness/experiments/bezier-*`: inputs, five symbolic
receipts, counterexample, replay, aggregate report, and dated Markdown journal.
The report links the sparse witness directory and records its receipt hash and
the direct checker's source hash. Preserve the linked witness directory as well.
Hashes identify artifacts, not their authenticity. The experiment uses the
existing witness checker and its recorded helper hashes; no new general proof
adapter or polynomial parser is introduced.

## Automated Regression Gate

```sh
docker compose run --build --rm -T pit-experiment node tools/bezier-gate.mjs
```

The CI `bezier-gate` job runs this same command on pushes and pull requests.
It requires the complete real-engine experiment, including fresh counterexample
replay. It then runs a separate child process with `TRUTH_HARNESS_MAXIMA`
pointing to a nonexistent executable in a fresh local directory. The second run
must exit 2 with the specific unverified independent-CAS rejection. Crashes,
timeouts, malformed output, unrelated errors, or a successful weak fallback do
not pass this negative control. No installed executable is removed or changed.

The gate allows 240 seconds per child and runs in the existing network-disabled
Docker service. It writes both subprocess outputs, a report, and a dated journal
under `.truth-harness/experiments/bezier-gate-*`. The positive output links the
full experiment artifacts. CI artifacts are local to its ephemeral runner, not
uploaded automatically. Exit 0 requires both cases; exit 1 means a failed case;
exit 2 indicates gate setup or I/O failure. The gate does not strengthen the
underlying mathematical trust labels or test every possible verifier failure.

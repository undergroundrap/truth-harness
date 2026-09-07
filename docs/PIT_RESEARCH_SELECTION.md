# PIT Research Selection: General Moments Before More Fixtures

Decision date: 2026-09-07 UTC.

Status: GO for a reusable general-theorem formalization. NO-GO for an original
PIT breakthrough claim. This document selects work; it is not a proof receipt.

## Why This Target

The dense and sparse experiments checked fixed polynomial classes. Increasing the
degree cap would mostly repeat exhaustive support enumeration. The next useful
capability is a theorem covering arbitrary finite support, with assumptions that
agents cannot silently discard. We have not identified a defensible new open
problem that this repository is ready to resolve. That is a research-selection
finding, not a reason to manufacture novelty.

Select the finite moment/Vandermonde argument underlying sparse identity testing.
It removes the need to enumerate every support in a degree-bounded universe.
The project contribution would be a replayable formal statement and checked
dependencies, not the mathematical invention of this argument.

## Literature And Novelty Check

- Ben-Or and Tiwari, [STOC 1988](https://doi.org/10.1145/62212.62241), developed
  deterministic sparse multivariate interpolation. This is prior art, not a new
  field opened by our experiments. Interpolation recovers coefficients and support;
  the proposed task only establishes a zero-testing implication.
- Van der Hoeven and Lecerf, [author-hosted manuscript](https://www.texmacs.org/joris/mvsparse/mvsparse.pdf),
  preliminary version December 29, 2024, section 5.3, explicitly describes encoding
  exponents using distinct primes and attributes it to Ben-Or and Tiwari. Its
  introduction and section 5.3 explain why evaluation size and bit complexity
  matter. We are not implementing its interpolation algorithm or claiming its
  performance bounds.
- [Kumar, Saptharishi, and Tengse](https://arxiv.org/abs/1807.06323) concern a
  conditional improvement across general circuit families. Neither our fixed
  examples nor the known sparse argument meets that research milestone.

This is a targeted prior-art check, not an exhaustive literature review. Novelty
of future changes must be assessed separately; no percentage or award forecast
is assigned to this work.

## Exact Mathematical Target

First obligation M1, over the rationals:

```text
Given m >= 1, pairwise distinct u_0,...,u_(m-1) in Q,
and c_0,...,c_(m-1) in Q:

if for every k with 0 <= k < m,
    sum_i c_i * u_i^k = 0,
then for every i, c_i = 0.
```

The proposed proof uses invertibility of the square Vandermonde matrix. A finite
matrix computation is not a replacement for the universally quantified theorem.
M1 must not be labeled proved until a local Lean checker accepts the exact target.

Later specialization M2, after M1 is checked:

```text
Let n >= 1, t >= 1, and p_1,...,p_n be distinct positive primes.
For every nonzero f in Q[x_1,...,x_n] with at most t nonzero monomials,
there exists k with 0 <= k < t such that
    f(p_1^k,...,p_n^k) != 0.
```

Proposed argument, not a current kernel proof: combine duplicate monomials, discard
zero coefficients, and encode each remaining exponent tuple e as
`u_e = product_j p_j^(e_j)`. Unique prime factorization makes distinct tuples encode
to distinct positive integers. Evaluation at prime powers gives moments of these
distinct nodes. Apply M1 to the actual support size m <= t.

The primes and support conditions are hypotheses, not data inferred from an LLM.
No bound on degree is needed for the mathematical statement. This does not remove
resource limits from an implementation.

## Boundary Probes

Small exact probes were executed with SymPy 1.14.0 in network-disabled Docker on
2026-09-07 UTC. These are computations, not evidence that M1 or M2 is formalized.

| Probe | Exact outcome | Meaning |
| --- | --- | --- |
| x^3-y at (1,1), (2,8) | 0, 0 | The existing degree-capped encoding cannot be generalized blindly |
| x^3-y at (2,3) | 5 | Distinct prime bases fix this particular collision |
| x^2-3x+2 at (1,1), (2,3) | 0, 0 | Two evaluations do not cover three-term polynomials |
| x^(2^12)-1 at x=2 | Output bit length 4096; exponent bit length 13 | Query count is not bit complexity |

The last probe illustrates a general cost concern, not a benchmark or asymptotic
proof. Over finite fields, reducing encoded nodes modulo the characteristic can
create collisions. M1 can hold over other fields with distinct nodes, but M2's
rational prime-encoding conclusion must not be transferred automatically.

## Bounded Implementation Order

1. Inspect the repository's existing pinned Mathlib environment and its relevant
   Vandermonde/matrix lemmas. Record exact revisions and dependency availability.
   Do not upgrade the toolchain, download a large corpus, or rebuild all engines
   merely to start this task.
2. Formalize M1 only. Reuse existing Mathlib results instead of rebuilding linear
   algebra. Add an independently restated root target and transitive axiom check.
3. Replay in Docker and persist a scoped receipt, source hashes, assumptions, and
   dated progress. Missing dependencies, timeouts, and failed checks stay open.
4. Independently review M1. Only then scope M2's exponent-encoding and polynomial
   normalization bridge. M1 alone must never be advertised as the full PIT theorem.

Expected deliverable for the next implementation session: one general checked
moment lemma, or a precise unresolved dependency report. Not another list of
small numeric matrices. Historical Lean 4.12.0 pins are reproducibility context,
not a claim that the environment is current or suitable for adversarial imports.

## Acceptance And Stop Rules

- Exact, quantified statement checked locally, without `sorry`, custom axioms,
  unchecked external acceptance, or an LLM proof being treated as evidence.
- Reject a missing distinctness hypothesis: coincident nodes permit cancellation.
- Check that fewer than m moments is insufficient in general.
- Source and environment changes must invalidate any claimed reuse of old evidence.
- Report mathematical correctness separately from code performance, evaluation
  count, bit growth, and practical resource limits.
- Stop before M2, a generic sparse solver API, optimizer, UI, Hum bridge, remote
  service, or distributed scheduler. Those are separate scopes.

The longer research objective remains useful, independently checkable results.
A genuinely new theorem is not selected by this document. After the formal baseline,
seek a domain researcher's assessment of a concrete limitation before launching
an open-problem campaign or calling any improvement novel.

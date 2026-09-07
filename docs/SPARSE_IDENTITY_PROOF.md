# Sparse Polynomial Identity: M2

This is a formalization of a known sparse identity-testing argument, not an
original PIT breakthrough, a generic solver, or a performance result.
See [research selection and prior art](PIT_RESEARCH_SELECTION.md).

## Exact Scope

For a nonzero multivariate polynomial over the rationals with at most `t` nonzero
monomials, evaluated using distinct prime bases `p_i`, there is a natural number
`k < t` for which evaluation at `(p_i^k)_i` is nonzero. The independent target
restatement includes positive variable count and positive `t`; the main theorem
also handles the degenerate cases permitted by its hypotheses.

The source is
[SparseIdentity.lean](examples/lean-mathlib-template/TruthHarnessMathlib/SparseIdentity.lean).
Its argument:

1. Recover each exponent from the prime factorization of the encoded node.
2. Deduce injectivity of the node encoding from prime and distinctness hypotheses.
3. Rewrite actual `MvPolynomial` evaluation as sums over its normalized support.
4. Reindex that support and apply the checked M1 moment theorem.
5. Derive a contradiction if every allowed sample vanishes for a nonzero polynomial.

`MvPolynomial` support combines duplicate monomials and excludes zero coefficients.
It is not a raw list of user-asserted terms. There is no degree cap in the theorem.
The proof is classical: it establishes existence, not an executable efficient
witness extractor or a natural-language-to-polynomial parser.

## Replay

From the repository root with Docker's Linux engine available:

```bash
npm run docker:mathlib
docker compose run --rm sparse-identity-proof
```

Provisioning needs the network and the pinned Mathlib dependencies. The Lake
default target builds Algebra, Moments, and SparseIdentity, including the imported
M1 module. The replay service inherits the existing non-root, network-disabled
Mathlib service and writes JSON/Markdown receipts in `.truth-harness/proofs/`.
Nonzero exit must not be interpreted as mathematical refutation.

The existing proof-check adapter checks the whole source file. Its lightweight
declaration parser may warn about the namespace-qualified name; metadata alone
does not certify statement matching. The axiom guard requires exactly the usual
`propext`, `Classical.choice`, and `Quot.sound`, excluding placeholder proofs and
additional axioms. Review imports and the formal target, not just the trust label.

Record the checked source hash, imported Moments source hash, Lake manifest,
Lean version, and image identity together. A receipt's source hash alone does
not authenticate the entire imported environment. Rebuild after source changes;
do not treat a stale image or old receipt as evidence for new files.

## Boundary Checks

The same Lean file checks explicit nonzero polynomials that evade invalid samples:

- Repeated bases `(2,2)`: `x-y` vanishes at every sample.
- Distinct but unsuitable composite bases `(2,4)`: `x^2-y` vanishes at every sample.
- Too few samples: `(x-1)(x-2)` vanishes at the first two samples with base 2.

These controls refute dropping the hypotheses in general. They do not assert
that primes are the only possible valid encoding or that every polynomial needs
all `t` samples.

Evaluation count is not bit complexity. Large powers can be impractical to
represent, and this result does not transfer automatically to finite fields,
floating-point evaluation, arbitrary arithmetic circuits, or program verification.
No Hum integration or optimization authorization follows from this theorem.

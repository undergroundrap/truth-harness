# Sparse Polynomial Hitting-Set Baseline

## Target And Prior Work

This follow-up tests an assumption-sensitive question, not a new PIT algorithm:
can two evaluations detect every nonzero polynomial in Q[x,y] with at most two
nonzero monomials and degree at most two in each variable?

Sparse PIT is an established research area. For broader results see Blaeser and
Engels, [STACS 2011](https://doi.org/10.4230/LIPIcs.STACS.2011.555). Their paper
studies sparse black-box identities over the reals, including degree-independent
methods. We do not implement their algorithm or claim their complexity bounds.
Our elementary bounded construction encodes exponents in base three.

## Construction And Failure Boundaries

Use H = {(1,1), (2,8)}. The monomial x^a y^b, for 0 <= a,b <= 2,
evaluates to the column [1, 2^(a+3b)]. Distinct allowed exponent pairs have distinct
encoded exponents. Thus any two such columns are independent over Q.
The experiment checks this with rational left-inverse certificates for every
one- and two-column support: nine singleton supports and 36 pairs.

This covers arbitrary rational coefficients and every support in the specified
class. It is not a sample of coefficient vectors. A sparse class is a union of
subspaces, not the entire nine-dimensional coefficient space.

Four cases are replayed:

- The nine-point {0,1,2} grid as a baseline.
- The two encoded points as the restricted-class candidate.
- Two diagonal points, which fail because monomials can collide.
- One point, which fails because two nonzero terms can cancel.

The sparse checker rejects x^2 - 3x + 2 as a counterexample to the sparse claim:
it vanishes at both chosen points but has three terms, outside the class.
The earlier dense quadratic checker independently confirms that these same two
points do not hit its nonsparse quadratic class. Dropping the sparsity assumption
therefore invalidates the conclusion. Over finite fields, distinct powers can also
collide; this experiment makes no finite-field guarantee.

These observations are known elementary algebra, not original research or the
constant-exponent improvement for general circuits required by KST bootstrapping.
No degree-uniform, bit-complexity, or practical speedup claim follows from reducing
the number of evaluation points in this tiny bounded class.

## Execute And Inspect

```bash
npm run docker:pit-sparse
npm run docker:check
```

The existing isolated experiment service writes dated reports and certificates
under `.truth-harness/experiments/pit-sparse-two-*/`. It mounts only the evidence
directory, disables runtime networking, and exits after the run. Image provisioning
can access package registries. The original `docker:pit-experiment` command and
dense certificate formats remain unchanged.

SymPy constructs certificates; a fresh standard-library Fraction checker verifies
all 45 supports, dimensions, rational encodings, and each left-inverse identity.
Missing, duplicate, reordered, or altered support evidence is rejected. A refutation
must contain a nonzero polynomial with at most two nonzero coefficients and must
vanish at every supplied point. The checker reconstructs the support universe
rather than trusting a count supplied by the producer.

Labels are `exact-computed` or `refuted`, never `proved`. Both processes share the
monomial evaluation implementation. Python, rational arithmetic, the class model,
and the exhaustive support enumeration remain trusted; this is not a Lean proof.
Reports hash the sparse checker and its imported dense helper. Failed runs remain
unverified under the existing experiment reporting rules.

## Correct Order From Here

The [research-selection decision](PIT_RESEARCH_SELECTION.md) now selects a general
moment lemma as the next formalization target and explicitly rejects a novelty
claim. It supersedes simply increasing the bounded fixture size.

1. Reproduce a baseline and explicit failure cases: this experiment.
2. Independently inspect certificates and the exact assumptions before expanding scope.
3. Choose a literature-backed family with a real unresolved subclaim, after a
   novelty check with primary sources and preferably a domain researcher.
4. Add only the proof obligations, verifier, or agent recovery behavior that the
   selected subclaim requires. Preserve failures and resource budgets.

Do not turn this into an endless sequence of slightly larger fixtures. The next
research-selection gate should explain why the new target is useful beyond testing
the harness. No universal-solving claim, Hum integration, UI, or agent scheduler
is introduced here.

## Progress

- 2026-09-07 UTC: Added a bounded sparse-class experiment, exhaustive support
  certificates, scope-crossing tests, and dated local evidence. Generated reports
  contain actual outcomes; the narrative does not substitute for execution.

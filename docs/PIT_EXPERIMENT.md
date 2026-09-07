# Exact Degree-Two Hitting-Set Experiment

## Research Question

Which of four explicit point sets detects every nonzero polynomial in Q[x,y]
of total degree at most two? This is a bounded, known interpolation problem,
not general circuit PIT, a new derandomization result, or a claim of universal
problem solving. Hum integration and remote proof platforms are outside scope.

The class has basis `[1, x, y, x^2, xy, y^2]`. Coefficients are arbitrary rationals.
The input points are integers in [-10,10], at most 16 distinct points per case.
No circuit-size, finite-field, or machine floating-point claims are made.

## Reproduce

```bash
npm run docker:pit-experiment
```

The image uses the existing pinned SymPy 1.14.0 dependency. Provisioning can
download dependencies; the experiment itself runs network-disabled as the
image's non-root user, with dropped capabilities and no new privileges.
Only `.truth-harness` is mounted for output. No server is started.

Each run creates `.truth-harness/experiments/pit-degree-two-*/PROGRESS.md`,
`report.json`, a fixture snapshot, and one JSON certificate per candidate.
Reports include dates, source/checker hashes, exact class, expected and actual
outcomes, and relative certificate links. Generated evidence stays local.

Exit zero means every expected outcome passed fresh-process certificate checking.
Failure leaves the report unverified when the run directory has been created;
environment or fixture validation failures before staging exit nonzero without a report.
Re-running creates a new independent experiment, not an automatic resume scheduler.

## Certificates And Trust

For points H, form the rational evaluation matrix A with one row per point and
one column per monomial. SymPy constructs one of:

- A left inverse L. A separate process using Python's standard-library Fraction
  checks every entry of `L A = I`. Consequently `A c = 0` implies `c = 0`.
  This covers the entire specified six-dimensional polynomial space, not a finite
  sample of coefficient vectors. The result label remains `exact-computed`.
- A nonzero coefficient vector c. The checker verifies `A c = 0` and `c != 0`.
  It is a concrete counterexample to that candidate's hitting-set claim, labeled
  `refuted`. Rejecting a candidate is an expected successful experiment outcome.

The checker does not import SymPy. Both construction and checking share the small
monomial evaluation routine, so this is algorithmically separate checking, not
complete implementation diversity. Python, rational arithmetic, the class-to-basis
translation, and the checker remain trusted. This is not Lean/kernel certification
and does not mint a core `proved` receipt or close a proof validation gate.

## Candidates

| Candidate | Points | Intended test |
| --- | --- | --- |
| grid-nine | {0,1,2} squared | Reproduce the elementary grid baseline |
| triangle-six | Nonnegative integer pairs with x+y <= 2 | Check a known interpolation-sized candidate |
| diagonal-three | (0,0), (1,1), (2,2) | Expose a nonzero linear polynomial missed by diagonal sampling |
| triangle-five | triangle-six without (0,2) | Produce a missed polynomial after deleting one evaluation |

Any claim about minimal size uses the separate dimension argument: fewer than six
scalar evaluations cannot inject a six-dimensional vector space into Q^m.
The current checker verifies the supplied candidates, not a formalized general
dimension theorem. Six versus nine points is not a constant exponent saving for
the unrestricted size-s circuit families in the KST theorem.

## Context And Next Gate

[Kumar, Saptharishi, and Tengse](https://arxiv.org/abs/1807.06323) establish a
conditional bootstrapping result for explicit hitting sets across a uniform family
of algebraic circuit classes. This degree-two experiment does not satisfy that
hypothesis. It reproduces a baseline and makes candidate failures inspectable.

The relevant lesson from [Anthropic's formalization account](https://www.anthropic.com/research/formalizing-fermats-last-theorem)
is durable statements, dependencies, and checked evidence, not that a verifier can
discover every proof. This experiment adds concrete local artifacts; it does not
claim to implement their distributed infrastructure.

Next gate: independently inspect the certificates and class assumptions. Then
select one restricted polynomial family from the literature with a stated baseline
and a falsifiable candidate construction. Do not add a generic agent scheduler,
new UI, or broad solver abstraction before a research task requires it.

## Verification

```bash
npm run docker:check
```

Tests exercise deterministic construction, accepted baselines, rejected candidates,
altered certificates, scope/version mismatch, malformed rationals, and unsafe inputs.
Python with SymPy is required for these tests; it is included in the Docker image
and the existing GitHub CI Python setup.

## Progress

- 2026-09-07 UTC: Defined the bounded class, four candidates, exact certificates,
  fresh-process checking, and local dated evidence workflow. Actual run conclusions
  are recorded in generated reports, not inferred from this document.

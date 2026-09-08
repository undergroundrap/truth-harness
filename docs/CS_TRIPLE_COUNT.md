# Exhaustive Three-Item Search

## Problem

How many candidate triples are visited by an exhaustive search over distinct
items? This model applies to counting visits in brute-force three-item subset
search, independently of what predicate is evaluated for each triple.

```text
for i = 0 through n-1:
    for j = i+1 through n-1:
        for k = j+1 through n-1:
            visit(i, j, k)
```

Assume nonnegative integer `n`, inclusive bounds, empty reversed ranges, one
counted visit per innermost iteration, no early exits, and mathematical integers
without overflow. Predicate cost, memory traffic and elapsed time are not counted.

## Reduction And Candidates

Let `T(n)` count triples and `P(n)` count pairs of distinct items. Adding an item
adds one new triple for each old pair, hence `T(n+1)-T(n)=P(n)`. Adding an item
adds `n` pairs, so `P(n+1)-P(n)=n`. Taking one more difference yields:

```text
T(n+3) = T(n) - 3*T(n+1) + 3*T(n+2) + 1
T(0) = T(1) = T(2) = 0
candidate: T(n) = n*(n-1)*(n-2)/6
deliberately false candidate: n*(n+1)*(n+2)/6
```

The false candidate counts three-element multisets instead of distinct-item
subsets. At `n=1`, it claims one visit while the loops make zero visits. Both
candidates have the same third difference; checking the initial values is vital.

The loop-to-recurrence argument is a human-readable mathematical reduction,
not a compiler-generated or formally checked source translation. The independent
machine checker validates the supplied recurrence and initial conditions for
every nonnegative index using full polynomial coefficients. A separate test
enumerates the loops only for `n=0..16`; that bounded test is not universal proof.

## Run And Reopen

```sh
docker compose run --build --rm -T pit-experiment node apps/cli/dist/index.js polynomial recurrence docs/examples/cs-triples-correct.json --json
docker compose run --rm -T pit-experiment node apps/cli/dist/index.js polynomial recurrence docs/examples/cs-triples-refuted.json --json
```

The correct example must return `identity-checked`, `exact-computed`, exit 0.
The false example must return `refuted`, exit 1, with index 1, candidate value
`"1"` and sequence value `"0"`. Both retain `proof_checker_backed: false`.
An execution error or `unknown` does not establish either expected outcome.

Each run returns an artifact directory containing the original request,
receipt, report and dated `PROGRESS.md`. Keep that directory for reproducibility.
Substitute its path for `DIRECTORY` to recompute in a fresh process:

```sh
docker compose run --rm -T pit-experiment node apps/cli/dist/index.js polynomial replay recurrence DIRECTORY/request.json DIRECTORY/receipt.json --json
```

MCP clients can submit the same JSON using `truth_harness_polynomial_check` with
`operation: "recurrence"`, then reopen it with `truth_harness_polynomial_replay`.
See the [recurrence contract](POLYNOMIAL_RECURRENCE.md) for bounds and deployment.

## CI Coverage

The host CI check asserts that the CLI refuses these requests without the
container marker. The existing Docker CI job separately runs
`npm test -- tools/cs-triples.test.js` in the offline `check` service, requiring
the successful identity check, checked refutation and both receipt replays.
That step sets `TRUTH_HARNESS_REQUIRE_DOCKER_TESTS=1`, making a missing container
marker fail the suite rather than silently exercising only the host branch.
The same suite also removes the marker from a child process to check refusal
inside Docker. No test is skipped and the host marker is never forged.
The marker is a deployment guard, not an operating-system isolation attestation;
the Docker service supplies the actual isolation.

This is a known counting problem used to exercise a reusable verifier. It is
not a newly solved open problem, verified program, performance benchmark,
autonomous discovery claim, or Lean proof. No new mathematical adapter is added.

# Divide-And-Conquer Operation Count

This is an exact count for a stated merge-style cost model, not a new research
result or verification of a sorting implementation. Inputs have size `n = 2^h`
for a nonnegative integer height `h`. Leaves cost zero; every internal call
splits into two equal subproblems and performs exactly `n-1` combine operations.
No pruning, early exit, memoization, allocation cost, or machine timing is modeled.

## Model And Reduction

```text
T(1) = 0
T(n) = 2*T(n/2) + n-1, n = 2^h, h >= 1
A(h) = T(2^h)
A(0) = 0; A(1) = 1
A(h+1) - 2*A(h) = 2^(h+1)-1
A(h+2) = 4*A(h+1) - 4*A(h) + 1
```

The last relation follows by subtracting twice the preceding first-order
equation from its one-step shift. Conversely, define the first-order defect
`D(h)=A(h+1)-2*A(h)-2^(h+1)+1`. The second-order relation implies
`D(h+1)=2*D(h)`, and the two initial values give `D(0)=0`. Thus the reduction
loses no condition under this model. The algebraic identity and initial defect
now have separately replayable coefficient checks, as described below. The
variable mapping is still human-reviewed. Those coefficient receipts alone do
not kernel-check induction; a separate Lean theorem below checks the formal
recurrence equivalence.

## Check The Reduction Algebra

In `cs-divide-conquer-reduction.json`, variables in order are
`a=A(h)`, `b=A(h+1)`, `c=A(h+2)`, and `q=2^(h+1)`. The supplied left side is
the distributed form of `(c-2*b-2*q+1)-2*(b-2*a-q+1)`, preserving duplicate
terms. The right side is `c-4*b+4*a-1`. Coefficient comparison checks this
identity for every rational `a,b,c,q`, without sample-based inference.

`cs-divide-conquer-initial-defect.json` checks `1-2*0-2+1=0` using the stated
initial values. Its required variable slot is unused because this is constant
arithmetic. Tests also refute a wrong-sign residual constant and a nonzero
initial defect, and reject using the original receipts for changed requests.

```sh
docker compose run --build --rm -T pit-experiment node apps/cli/dist/index.js polynomial compare docs/examples/cs-divide-conquer-reduction.json --json
docker compose run --rm -T pit-experiment node apps/cli/dist/index.js polynomial compare docs/examples/cs-divide-conquer-initial-defect.json --json
```

These commands save their own requests, receipts, reports and dated journals.
Use `polynomial replay compare REQUEST_PATH RECEIPT_PATH --json` inside the
same Docker service to check them again. Results are `equivalent` with
`exact-computed` trust, never `proved`.

Remaining assumptions: the sparse inputs faithfully transcribe the displayed
expressions, the exponent shift is `q -> 2*q`, and ordinary induction propagates
`D(0)=0` via `D(h+1)=2*D(h)`. There is no expression parser, automatic dependency
link to the recurrence receipt, source-code verification, or complete formal
proof here. These receipts narrow the unchecked algebra, not those boundaries.

## Lean Recurrence And Closed Form

```sh
npm run docker:divide-conquer-proof
docker compose run --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/DivideConquer.lean --declaration divide_conquer_closed_form --timeout-ms 30000 --fail-on-unproved --write --json
```

This rebuilds the existing Lean image with the current sources, then checks
`docs/examples/DivideConquer.lean` through the proof adapter and writes a scoped
record to `.truth-harness/proofs/`. It uses pinned Lean 4.12.0 and `Std`, not
Mathlib. Image construction may download dependencies; the proof runtime has
no network. The historical pin is for reproducibility, not a security guarantee.
The first command selects the recurrence-equivalence declaration; the second
selects the closed-form declaration from that same rebuilt source file.

The independently restated target `divide_conquer_reduction` says that for any
integer sequence `A` with `A(0)=0` and `A(1)=1`, the second-order recurrence
`A(h+2)=4*A(h+1)-4*A(h)+1` is equivalent to
`A(h+1)=2*A(h)+2^(h+1)-1` for every natural height `h`. Lean checks both
directions, the exponent shift, and the induction. A separate theorem supplies
`A(h)=1-2^h` as a counterexample when the second initial value is omitted.
Source axiom guards require exactly `propext` and `Quot.sound`, with no
`sorryAx` or additional assumed mathematical axiom.

The separately spelled-out target `divide_conquer_closed_form` reuses that
recurrence connection and proves for all natural `h` that
`A(h)=((h : Int)-1)*2^h+1`. The subtraction is in the integers, so the leaf
case `h=0` gives zero rather than a truncated-natural-subtraction artifact.
The proof also constructs this formula as a sequence satisfying both initials
and the recurrence. Thus the premises have a concrete model, and any sequence
with those premises has the stated answer. Another theorem rejects `h*2^h`
as an exact count by instantiating height 1. It does not refute an upper bound
or asymptotic estimate.

The closed-form target's guarded axiom list is `propext, Quot.sound`; the
incorrect-candidate theorem uses only `propext`. This is standard-library Lean
arithmetic and induction, not a new result in complexity theory.

The Docker Lean CI gate also compiles mutated sources with a wrong second
initial value, a wrong residual constant, a wrong closed-form constant, and a
wrong exponential base and requires their rejection. It also requires the
Truth Harness adapter to accept the named closed-form theorem as `proved`.
Ordinary Node tests only inspect the wiring unless the explicit Lean-test flag
is set; they are not substitutes for this compiler gate.

The accepted formal theorems are not proofs that a sorting program implements
the cost model. They state the answer in height coordinates, without formalizing
the change of variables to `n*log2(n)-n+1`. Mapping the
JSON fixtures to the Lean statement remains reviewed transcription. The
three-receipt bundle below is unchanged and does not automatically import this
separate proof or upgrade its conservative trust labels.

## Reusable Integer Cost Family

The Lean theorem `divide_conquer_cost_family` generalizes the answer to any
integer leaf cost `c`, slope `a`, and combine offset `b`:

```text
A(0) = c
A(h+1) = 2*A(h) + a*2^(h+1) + b
A(h) = (c+b+a*h)*2^h - b, for every natural h
```

For a two-way equal split at size `n=2^h`, an internal call contributes
`a*n+b`. Lean checks the candidate's initial value, its recurrence step, and
induction for every integer parameter choice. The candidate itself supplies
a model of these premises. The original `c=0,a=1,b=-1` count is recovered by
`divide_conquer_merge_specialization`, reusing the general theorem. A second
specialization uses `c=3,a=0,b=5` and obtains `8*2^h-5`.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/DivideConquer.lean --declaration divide_conquer_cost_family --timeout-ms 30000 --fail-on-unproved --write --json
```

This is reusable as a Lean theorem, not a parser for arbitrary
recurrences. Its axiom guard and both specializations
require exactly `propext, Quot.sound`. The required Lean test gate checks named
adapter acceptance and rejects formulas omitting leaf cost, doubling the slope,
or flipping the offset sign, alongside the existing four negative controls.
Separate finite tree enumeration checks representative parameters at heights
0..10, including zero and negative values; that is supporting test evidence,
not the universal proof.

Negative parameters are allowed algebraically but are not automatically valid
physical operation counts. An application must justify nonnegative costs and
the equal-split model. No rational/real parameters, unequal splits, floors,
ceilings, probabilistic costs, timing, asymptotic bounds, source-code properties,
or JSON-to-Lean translation are established here. The fixed three-receipt bundle
still covers only its original inputs, not every member of this family.

### Check A Concrete Specialization

Agents can supply the three costs using the versioned example below. Values
are canonical decimal integer strings from -999999 to 999999. Unknown versions,
extra fields, expressions, noncanonical integers, invalid UTF-8, BOMs, and inputs
over 64 KiB fail closed. The tool does not accept user-supplied Lean code.

```sh
docker compose run --build --rm -T lean-proof node tools/divide-conquer-specialize.mjs docs/examples/cs-divide-conquer-costs.json
```

Use `-` instead of the path for stdin. Input fields are `schema_version`
(`truth-harness.divide-conquer-specialization.v0`), `leaf_cost`,
`combine_slope`, and `combine_offset`. The example supplies 2, 3, and -2.
The generated theorem proves `A(h)=3*h*2^h+2` under its explicit recurrence
premises, retaining the unsimplified parameter expression in the formal statement.

The tool embeds the current theorem library in a self-contained `Specialized.lean`,
applies `divide_conquer_cost_family`, checks the named declaration through the
existing Lean adapter, and writes the request and JSON report under the local
`.truth-harness/experiments/divide-conquer-specialization-*` directory. The adapter
also writes its normal scoped proof record. Nothing is uploaded. Use the offline
`lean-proof` service; a container marker is a guard, not a security sandbox itself.
After input validation, the tool initializes missing local workspace storage using
the existing core initializer. Existing manifests are not rewritten; malformed
manifests fail closed. No separate `workspace init` command is required for a
fresh checkout. CI exercises both the proof tests and the documented command
with an empty temporary evidence store.

Stdout is JSON. Exit 0 means adapter-accepted proof; exit 2 means invalid input
or an unavailable/failed check, reported as `unverified`. Adapter failures include
up to 2000 characters of local diagnostics, which may contain local paths; review
them before sharing externally. Success includes request,
request/library/generated-source SHA-256 hashes, artifact directory, explicit
assumptions, and the adapter's proof result. Paths and record identifiers vary
per run; source generation is deterministic for fixed parameters and library.
Recheck the saved source with `proof check --declaration divide_conquer_specialized`;
do not trust a cached report merely because it says `proved`. Partial failure
directories are not successful receipts. Hashes bind bytes, not authorship.
This proves the conditional recurrence theorem only, not that external code
meets its premises, and does not upgrade the older three-receipt bundle.

### Reopen A Saved Specialization

```sh
docker compose run --rm -T lean-proof node tools/divide-conquer-specialize.mjs --reopen .truth-harness/experiments/divide-conquer-specialization-REPLACE_WITH_SAVED_ID --expect-request-sha256 REPLACE_WITH_PREVIOUSLY_RECORDED_REQUEST_HASH
```

Pass the saved `artifact_directory` and the expected `request_sha256` retained
in your trusted task state when selecting or creating the intended request.
The hash must be exactly 64 lowercase hexadecimal characters. Do not obtain it
from the candidate bundle or its cached report at reopen time: that would not
protect against substituting a different valid request. Missing or malformed
hashes fail before bundle access; a mismatch fails before Lean runs. This binds
exact bytes, so even a whitespace-only request change requires an intentional
new expected hash. Creation syntax and its v0 input/output remain unchanged.

Reopen reads only the bounded UTF-8
`request.json` and `Specialized.lean`, rejecting file links that escape the bundle.
It validates the request version and costs, reconstructs the source with the
current theorem library, and requires an exact source-byte hash match. A changed
library or generated file fails closed; regenerate intentionally after reviewing
the change. A missing, malformed, or misleading `report.json` cannot mint trust:
that cached file is never read.

Reopen checks a private matched source snapshot through Lean and verifies its
returned source hash and named declaration. It leaves the saved bundle unchanged,
does not initialize a workspace or write a proof record, and removes its temporary
scratch directory under `.truth-harness/experiments`. The returned proof's source
path refers to that temporary snapshot; use `--reopen` again for future checks.
Successful stdout uses `truth-harness.divide-conquer-reopen.v1`, `status: reopened`,
`trust: proved`, `cached_report_used: false`, request/library/source hashes, the
fresh proof, matching `expected_request_sha256`, and the same explicit assumptions.
This replaces unbound v0 reopening; old invocations without the flag now fail
closed with exit 2. Exit 0 means freshly accepted;
exit 2 means unresolved, including missing Lean or mismatched artifacts.

These checks establish internal consistency with the current library, not original
authorship or immutable history. Replacing both input and source with another valid
specialization fails against the original expected hash. A caller can intentionally
select that new request by supplying its hash, yielding evidence for the new input
only. The tool cannot determine whether the caller's chosen hash represents the
right human problem. No source-code claim or
automatic discovery of applicable theorems is added.

### Agent Handoff Regression

The required Lean gate includes a process-level handoff regression using the
existing creation and reopen commands:

1. A creator process checks a specialization and returns its request hash.
2. The test saves that hash in a separate trusted handoff fixture and copies the
   bundle into a candidate directory whose path contains spaces.
3. A fresh consumer process reads only the saved handoff, from a different working
   directory, and invokes request-bound reopen to obtain fresh Lean evidence.
4. A second creator produces another valid, Lean-accepted specialization. Replacing
   all three candidate files with that bundle must fail against the original hash.
5. Restoring the original bundle succeeds again without changing the handoff.

```sh
docker compose run --build --rm -T -e TRUTH_HARNESS_REQUIRE_LEAN_TESTS=1 lean-proof npm test -- tools/lean-divide-conquer.test.js
```

This is a deterministic integration test, not a new handoff API, LLM experiment,
or proof that every autonomous agent will preserve intent. The expected hash
remains a caller-controlled trust anchor: if an attacker can also replace trusted
task state, this workflow does not authenticate it. The test validates reuse and
substitution rejection for the explicit recurrence, not external source code.

## Replay The Evidence Bundle

```sh
docker compose run --build --rm -T pit-experiment node tools/cs-divide-conquer-bundle.mjs
docker compose run --rm -T pit-experiment node tools/cs-divide-conquer-bundle.mjs --check .truth-harness/experiments/cs-divide-conquer-bundle-EXAMPLE/bundle.json
```

Replace `EXAMPLE` with the directory reported by the first command. Creation
checks the three fixtures, copies their requests and receipts into one directory,
and writes `bundle.json`, `report.json`, and a dated `PROGRESS.md`. Construction
also leaves the normal individual witness artifacts. A failed construction can
leave a partial directory; directory existence never establishes success.

The manifest contract is `truth-harness.cs-divide-conquer-bundle.v0` with exactly
three ordered steps: `reduction`, `initial-defect`, `recurrence`. Each records its
operation, fixed relative request/receipt filenames, raw byte SHA-256 hashes,
and `depends_on` links. The recurrence step links to the other two as the
human-reviewed argument order, not a machine-certified inference rule.

Replay is read-only and does not trust saved reports. It requires the exact
example inputs from the running checkout, checks every receipt again, rejects
missing/duplicate steps, unknown fields/versions, altered hashes and escaping
file links, and emits its own fixed list of remaining assumptions. The directory
can be moved with all its files; changing fixture bytes or using another version
of the example can require rebuilding the bundle. Each input is limited to
65536 UTF-8 bytes; underlying checker timeouts still apply. File containment is
not a guarantee against a hostile concurrent filesystem writer.

Exit 0 means all three supplied requests replayed successfully, with bundle
status `replayed`, `checked: true`, and `proof_checker_backed: false`. It does
not mean the whole mathematical argument or an implementation is proved.
Any missing, invalid, unknown or refuted evidence blocks the bundle with exit 2,
`unverified`, and `checked: false`. No partial-success result is returned.
This is an example-specific script, not a general theorem-DAG or CLI/MCP API.

## Candidates

```text
Correct: A(h) = (h-1)*2^h + 1
Therefore: T(n) = n*log2(n) - n + 1, only for n = 2^h
False exact candidate: A(h) = h*2^h
At h=1 (n=2): false candidate gives 2; the model requires 1.
```

The checker handles `h` and rational exponential-polynomial data, not a logarithm
parser. It checks all initial values and every recurrence-residual coefficient.
The accepted result is `identity-checked` / `exact-computed`, not `proved`.
Refuting `n*log2(n)` as an exact count does not refute it as an upper bound or
asymptotic description. This experiment does not check asymptotic bounds.

## Run And Reopen

```sh
docker compose run --build --rm -T pit-experiment node apps/cli/dist/index.js polynomial recurrence docs/examples/cs-divide-conquer-correct.json --json
docker compose run --rm -T pit-experiment node apps/cli/dist/index.js polynomial recurrence docs/examples/cs-divide-conquer-refuted.json --json
docker compose run --rm -T pit-experiment node tools/recurrence-reopen.mjs docs/examples/cs-divide-conquer-correct.json
```

The false-candidate command intentionally exits 1 with a checked counterexample.
Each verification run saves requests, receipts, reports and dated `PROGRESS.md`
files under `.truth-harness/witnesses/`. Reopen discovers saved evidence and
checks it again without writing replacement evidence. A refuted receipt is valid
evidence of failure, but cannot be reopened as an accepted identity.

Tests separately enumerate this mathematical recursion and its combine operations
for heights 0..16, compare both recurrence forms, replay both candidate receipts,
and reopen the accepted result in a fresh process. The finite enumeration supports
the modeling argument but is not a proof for arbitrary code or arbitrary sizes.

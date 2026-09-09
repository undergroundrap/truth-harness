# Balanced Parallel Reduction

This is a checked cost model for reducing n=4^h scalar inputs on a complete
four-way tree. Each internal node combines its four child results with three
serial binary additions. Leaves are already available at zero arithmetic cost.
Children may execute concurrently. This is a known elementary model, not a new
algorithm or a claim to have solved an open problem.

## Work And Span

```text
W(0)=0                  S(0)=0
W(h+1)=4*W(h)+3         S(h+1)=S(h)+3
W(h)=4^h-1              S(h)=3*h
```

Work counts every addition. Span counts the longest chain of dependent additions,
with each addition taking one unit and unlimited available parallelism. At h=2,
there are 16 inputs, 15 additions in total, and a critical path of 6 additions.
Confusing total work with span gives the wrong parallel cost model.

[ParallelReduction.lean](examples/ParallelReduction.lean) proves both recurrence
solutions for every natural height, with a named joint four-way theorem and a
checked h=2 counterexample to equating work and span. General helper theorems
allow an integer branch parameter algebraically; physical trees require a
natural branching factor at least two. No theorem asserts measured speedup.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration parallel_reduction_four_way --timeout-ms 30000 --fail-on-unproved --write --json
docker compose run --rm -T lean-proof node tools/divide-conquer-specialize.mjs docs/examples/cs-parallel-reduction-work.json
```

The second command reuses the existing v1 branching theorem with b=4, c=0, a=0,
e=3. It proves the same work recurrence has solution 3*S(4,h), where S here is
the finite geometric sum from the branching library, not critical-path span.
The separate work theorem gives the simpler expression 4^h-1. These artifacts
share reviewed recurrence premises; they are not an automatically linked theorem
DAG. Save the returned request hash separately and use the existing
[hash-bound reopen workflow](CS_DIVIDE_CONQUER.md#reopen-a-saved-specialization)
before reusing that work receipt. The work receipt alone does not certify span.

## Boundaries

The formal proofs start from the displayed recurrences. They do not derive those
recurrences from Rust, C++, a scheduler, or a hardware execution trace. The
interpretation assumes a complete balanced tree, identical child costs, serial
three-addition local combines, unit-cost arithmetic, no communication or memory
overhead, and sufficient processors. A balanced local combine tree would have a
different span; a finite processor budget requires additional scheduling analysis.
Floating-point reordering and numerical error are outside this model. No proof
of associativity or reduction-result correctness for an arbitrary operator is
claimed.

The required Lean gate accepts the named proof, rejects corrupted work/span
conclusions, and creates/reopens the v1 work specialization. A separate finite
test constructs the addition dependencies at heights 0..5, counts operations,
computes longest paths, and checks sums on small exact integer inputs. That test
is supporting evidence, not the universal Lean proof or a performance benchmark.

All earlier branching source files and specialization schemas remain unchanged.

## Reuse: Sum And Count Aggregation

A binary tree can aggregate a pair (sum, count). Each leaf provides its input
and count 1 at zero arithmetic cost. An internal node independently adds the
two child sums and the two child counts. This is another application of the
reduction family, not a fundamentally new algorithm.

```text
X(0)=Y(0)=S(0)=0
X(h+1)=2*X(h)+1          Y(h+1)=2*Y(h)+1
S(h+1)=S(h)+1
W(h)=X(h)+Y(h)=2*(2^h-1) S(h)=h
```

The named `binary_pair_aggregation` theorem reuses `parallel_reduction_work`
twice and `parallel_reduction_span` once. Thus reuse is checked within Lean,
not merely asserted by matching prose. At height 3, eight leaves require
14 additions with critical path 3 under the model. Serializing the two
independent additions is a different scheduling model, not this theorem.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration binary_pair_aggregation --timeout-ms 30000 --fail-on-unproved --write --json
```

X and Y count sum and count additions respectively, not the aggregate values.
The theorem is conditional on their recurrences and the span recurrence; it
does not verify executable aggregation code or derive those premises from it.
Tests construct both dependency chains for heights 0..8 and check their
outputs on small exact integers. These finite tests are supporting evidence,
not a universal functional-correctness proof. Lean negative controls reject
halving the claimed work or doubling the claimed span.

The model assumes independent scalar additions, unlimited parallelism, and
unit cost. Tuple allocation, communication, overflow, floating-point behavior,
and actual elapsed time are excluded. The existing work-specialization schema
is unchanged and does not encode pair-output semantics or certify span.

## Deriving The Recurrences From Trees

`PairTree` in the same Lean file defines executable leaf/fork trees, balanced
tree construction, per-component addition counts, total work, and span. Work
adds both child costs and two operations; span takes the maximum child span
plus one for two independent local additions. Leaves cost zero.

`PairTree.work_components` proves that total work equals the sum of the two
component costs on every tree, including unbalanced trees. `additions_step`
and `span_step` derive the balanced recurrences by unfolding the definitions.
`PairTree.balanced_cost` then applies `binary_pair_aggregation` with those
proved premises. Its only input is the natural height, not assumed recurrences.
The top-level wrapper `pair_tree_balanced_cost` exposes that result for the
existing receipt declaration parser, which does not resolve namespace prefixes.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration pair_tree_balanced_cost --timeout-ms 30000 --fail-on-unproved --write --json
```

This closes the recurrence-premise gap for this executable Lean cost model.
It is not an implementation of sum/count values or a verified compiler mapping:
the chosen cost semantics still encode unit-cost independent additions and
unlimited processors. The balanced formulas do not apply to arbitrary shapes.
The tree constructor's own execution/allocation cost is not included, and equal
subtrees represent separate logical tasks, not memoized shared work.

The required Lean test evaluates balanced trees at heights 0..6 and an unbalanced
tree, and rejects changes charging one operation per fork or two span units.
Those finite probes supplement the universal theorem; they do not replace it.

## Output Correctness

`ValueTree` adds a separate executable tree with arbitrary integer-valued leaves.
Its `aggregate` function combines child sums and counts. The specification
instead flattens leaves left-to-right, applies a list sum, and takes list length.
`tree_aggregation_correct` proves the aggregate equals that specification for
every finite tree, including unbalanced trees, negative values, and duplicates.
There is no empty-tree constructor; a single leaf has count one.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration tree_aggregation_correct --timeout-ms 30000 --fail-on-unproved --write --json
```

The proof proceeds by structural induction and a list-sum append lemma. No
recurrence or correctness premise is supplied by a caller. The required Lean
test checks targeted receipt metadata, evaluates representative leaf and skewed
tree outputs, and rejects dropping the right sum or assigning zero leaf count.

This proves functional correctness of the Lean aggregate, not a compiled Rust
or C++ implementation. Integers and natural counts are unbounded mathematical
values, not fixed-width machine arithmetic. No overflow or floating-point claim
is made. The earlier `PairTree` definitions and cost proofs remain unchanged.
The evaluator below connects these models, without a real-runtime guarantee.

## One Evaluator, Outputs And Costs

`ValueTree.evaluate` computes a sum/count pair and logical work/span in the same
recursive definition. `ValueTree.shape` erases values but preserves both children.
`evaluate_refines` proves on every tree that the output equals `aggregate`, and
the reported costs equal `PairTree` costs of the erased shape.
`tree_evaluation_correct` combines this with the leaf-list output specification.

`tree_evaluation_balanced` additionally takes a proved shape equality to the
complete balanced tree of height h, then reuses the existing closed-form cost
theorem. It yields the correct output, work 2*(2^h-1), and span h for the same
evaluation. Unbalanced inputs cannot simply be assigned those formulas.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration tree_evaluation_correct --timeout-ms 30000 --fail-on-unproved --write --json
docker compose run --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration tree_evaluation_balanced --timeout-ms 30000 --fail-on-unproved --write --json
```

The evaluator's cost fields are an explicit instrumented semantics, not timing
measurements of Lean execution. Sequential evaluation by a runtime does not
realize the parallel span automatically. Unit arithmetic, independent local
additions, unlimited processors, no sharing, and omitted allocation/communication
costs remain assumptions of the model. No extraction or compiler theorem is added.

Required Lean tests check both scoped receipts, concrete evaluator outputs/costs,
and rejection of incorrect work, span, output, and shape-erasure definitions.

## Concrete JSON Requests

The bounded `tools/tree-evaluate.mjs` workflow accepts
`truth-harness.tree-evaluation.v0`: exactly `schema_version` and `tree`.
A leaf is `{ "value": "-5" }`; a branch has exactly `left` and `right` nodes.
Values are canonical integer strings from -999999 to 999999. Requests are
UTF-8 without BOM, at most 64 KiB, 127 nodes, and depth 8 (root depth zero).
Unknown versions, extra fields, and expression text are rejected.

```sh
docker compose run --build --rm -T lean-proof node tools/tree-evaluate.mjs docs/examples/tree-evaluation.json
docker compose run --rm -T lean-proof node tools/tree-evaluate.mjs - < docs/examples/tree-evaluation.json
```

The second command uses POSIX shell redirection; Windows callers can pipe UTF-8
JSON to stdin or use a file path. Input files must be available inside Docker.
The fixture yields sum 6, count 3, work 4, span 2. The script computes a candidate
with exact integer arithmetic, then Lean checks those concrete values plus an
application of `tree_evaluation_correct`. No user proof code is interpolated.

Success exits 0 with JSON fields `schema_version`, `status: accepted`,
`trust: proved`, `proof_checker_backed: true`, `evidence_scope`, `results`
(sum/count/work/span integer strings), request/library/source SHA-256 hashes,
`artifact_directory`, `limitations`, and the scoped adapter `proof`.
Invalid input, unavailable verifier, timeout, or rejected proof exits 2 with
`status: unverified`, `proof_checker_backed: false`, and `error`; never results
labeled proved. Timeout is not a mathematical refutation.

Request, generated Lean source, and report stay under `.truth-harness/experiments`;
the existing adapter saves a proof receipt. Every invocation performs fresh Lean
checking. Cached reports are never accepted as fresh verification.
Save the request hash separately when handing work to another agent; rerunning a
different request proves a different concrete tree. The environment marker is a
usage guard, not a security sandbox: isolation comes from the Docker service.

Adapter-boundary tests inject timeouts, missing executables, failed exits,
malformed JSON, incomplete receipts, and source/declaration mismatches. They
require the unverified failure envelope and no successful report write. These
synthetic tests check orchestration only; real mathematical acceptance remains
covered by the separate required Lean gate. A verifier may have written its own
receipt before a later workflow failure, and diagnostic request/source files
may remain; neither means this workflow returned an accepted report.

## Hash-Bound Tree Replay

```sh
docker compose run --rm -T lean-proof node tools/tree-evaluate.mjs --reopen .truth-harness/experiments/tree-evaluation-EXAMPLE --expect-request-sha256 EXPECTED_SHA256
```

Replace the placeholders with the bundle path and the request hash retained in
trusted task state at creation. Do not obtain the expected hash from the bundle
you are trying to authenticate. This checks input identity, not authorship.

Replay requires that hash, validates the saved request, and matches saved source
against regenerated source using the current theorem library. It reruns Lean on
a private snapshot and removes that snapshot afterward, including on failure.
It ignores `report.json`, even if missing or corrupt, and does not rewrite the
bundle or save another proof record. Escaping file symlinks are rejected. This
is not a general hostile-filesystem sandbox against concurrent privileged edits.

Success exits 0 with `truth-harness.tree-evaluation-reopen.v0`, `status: reopened`,
the freshly checked results/proof and hashes, `expected_request_sha256`, and
`cached_report_used: false`. Failures exit 2 with the same unverified envelope
as creation, but the replay version. Missing hashes fail closed. Changed library
or request bytes require deliberate new verification, not silently reused trust.
The returned proof's temporary path no longer exists; use this replay command
for future checks instead of calling Lean on that path.

## Inclusive Prefix Sums

`TreeScan.scan` returns one cumulative sum per leaf, in left-to-right order,
including that leaf's value. It supports an arbitrary integer starting offset.
For leaves [-5, 2, 9], offset zero yields [-5, -3, 6]; offset ten yields [5, 7, 16].

The separate list specification `TreeScan.prefixes` updates an accumulator for
each list element. Its append lemma relates a concatenation to two scans with
the appropriate second offset. The tree algorithm scans the left child, then
uses `ValueTree.aggregate` of that child to determine the right offset.
`tree_prefix_scan_correct` proves equality to the list specification for every
finite value tree and integer offset, reusing `ValueTree.aggregate_correct`.
Balanced shape is not required; the tree type still has no empty constructor.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration tree_prefix_scan_correct --timeout-ms 30000 --fail-on-unproved --write --json
```

This first slice establishes output correctness only. It recomputes subtree
aggregates and uses list concatenation; it is not claimed to be a work-efficient
parallel scan. Earlier reduction cost formulas do not describe this traversal.
No scan cost theorem, JSON scan request, cached-total optimization, machine
overflow guarantee, or measured speedup is added. Negative controls reject
missing right offsets, use of the right rather than left subtotal, and exclusive
instead of inclusive leaf outputs.

The shared Lean source hash changes with this addition. Old tree-evaluation
bundles remain historical evidence but their replay against the new library
fails closed; verify the retained request again to create a current bundle.

## Cached Prefix Scan Equivalence

`CachedScan.build` traverses the value tree and stores each internal subtree's
total. `build_total` proves the constructed total equals the existing aggregate
sum for every input tree. `CachedScan.scan` uses the stored left total when
setting the right offset instead of calling `ValueTree.aggregate` repeatedly.

`scan_build` proves this traversal equals `TreeScan.scan` at every integer offset.
`cached_prefix_scan_correct` composes that equivalence with the existing list
specification theorem. The guarantee applies to `scan offset (build t)`, not raw
cached trees constructed by a caller. A forged cache can produce incorrect
prefixes; an explicit test demonstrates this even when its root total is correct.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration cached_prefix_scan_correct --timeout-ms 30000 --fail-on-unproved --write --json
```

This verifies preservation of outputs for the cache-based transformation.
It does not yet prove a work/span bound or measured improvement. List
concatenation, cache storage/allocation, processor limits, and runtime arithmetic
cost still require separate accounting. No untrusted-cache import or scan JSON
operation is added. Tests cover skewed trees and nonzero offsets and reject
missing cache contributions, using the wrong child's total, and dropping the
incoming offset. This addition again changes the shared source hash; old saved
bundles require deliberate fresh creation against the updated library.

## Cached Scan Arithmetic Work

`CachedScan.buildWork` charges one addition per internal cache node and zero at
leaves. `scanWork` charges one right-offset addition per fork and one inclusive
output addition per leaf. Both children are charged, regardless of scheduling.
The definitions are explicit logical counters, not runtime instruction traces.

For n leaves, Lean proves build work n-1, scan work 2n-1, and combined work 3n-2
in `cached_prefix_arithmetic_work`. This exact arithmetic count holds for every
tree shape, not just balanced trees. A single leaf costs one addition; no
zero-offset or compiler constant-folding discount is assumed.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration cached_prefix_arithmetic_work --timeout-ms 30000 --fail-on-unproved --write --json
```

Finite supporting tests independently instrument both phases for 1..32 leaves
on balanced and skewed trees, checking outputs as well as counts. Lean negative
controls reject omitting construction work, skipping leaf additions, and claiming
scan-only work as the total. Earlier cached-scan output proofs remain unchanged.

This is a linear count of unit-cost additions, not an overall linear-time claim.
List concatenation can repeatedly copy prefixes; allocation, tree traversal,
cache access, integer bit complexity, and scheduling are not charged. These
counters are a reviewed model alongside the algorithm, not a proved compiler
cost semantics. No uncached-versus-cached speedup or span bound is established.
As with other additions here, retained bundles must be recreated when the shared
theorem source hash changes.

## Append-Free Cached Scan

`CachedScan.scanInto offset tree tail` constructs each leaf output with list
cons and threads an existing tail through the right subtree and then the left.
Its implementation has no list append. The resulting order is still left to
right; the supplied tail is preserved without applying the offset to it.
Passing `[]` yields the ordinary inclusive prefix list.

`scanInto_eq` proves equality to `CachedScan.scan offset tree ++ tail` for every
cached tree, even a malformed one. This is equivalence, not cache validation.
`cached_prefix_scan_into_correct` restricts to `build t` and composes the prior
proofs to establish equality to the list specification followed by the tail.
The proof covers all finite tree shapes, integer offsets, and integer tails.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration cached_prefix_scan_into_correct --timeout-ms 30000 --fail-on-unproved --write --json
```

Lean probes cover single leaves, both skew directions, signed values, empty
and nonempty tails. Negative controls drop the tail, use the wrong subtotal,
and reverse output order. A structural test checks the append-free definition.

This removes explicit repeated list concatenation from this model, but is not
a measured speedup, a stack-safety proof, or a parallel-span theorem. The nested
recursive calls are not a tail-recursive traversal. No compiler allocation or
bit-cost semantics is established, and the existing arithmetic counters are not
newly proved operational counters for this variant. No production adapter or
JSON format changes. The shared library hash changes, so old bundles require
fresh creation rather than silent replay against a different theorem source.

## Instrumented Append-Free Scan

`CachedScan.evaluateInto` returns a `ScanEvaluation` containing output, integer
addition count, and list-cons count in one recursive evaluation. A leaf charges
one inclusive-sum addition and one cons; a fork charges one right-offset addition
and combines both children's counts. The incoming tail is not traversed or
charged. Counter arithmetic and the instrumentation record itself are uncharged.

`evaluateInto_refines` connects the returned output to `scanInto`, additions to
the existing `scanWork`, and cons counts to `consWork`. For a tree constructed
with `build`, `cached_prefix_evaluation_correct` proves all three together:
correct prefixes followed by the supplied tail, exactly 2n-1 scan additions,
and exactly n new list cons operations for n leaves. This holds at every integer
offset, for every tail and finite nonempty tree shape. Cache construction is
excluded from this scan count; the earlier build theorem counts n-1 additions.

```sh
docker compose run --build --rm -T lean-proof node apps/cli/dist/index.js proof check docs/examples/ParallelReduction.lean --declaration cached_prefix_evaluation_correct --timeout-ms 30000 --fail-on-unproved --write --json
```

Lean negative controls corrupt outputs, omit leaf or right-child additions,
charge the preexisting tail, and omit right-child cons operations. Finite JS
supporting tests use linked lists with both skew directions and balanced shapes
(1..32 leaves, three offsets), checking outputs, counts, and tail identity.
Those JS tests are not a cross-language equivalence proof.

This is a proved instrumented source model, not a verified cost semantics for
the Lean compiler or a machine-code trace. List cons counts are not allocated
bytes or peak live memory. Runtime, stack use, integer bit costs, cache storage,
scheduling, and hardware speedup remain outside the claim. No JSON interface or
adapter changes. Updating the shared source again requires fresh bundle creation.

## Concrete Prefix Scan Requests

The repository tool `tools/prefix-scan.mjs` accepts a file or `-` for stdin:

```sh
docker compose run --build --rm -T lean-proof node tools/prefix-scan.mjs docs/examples/prefix-scan.json
```

Input version `truth-harness.prefix-scan.v0` requires exactly `schema_version`,
`offset`, and `tree`. The offset and leaf values are canonical signed integer
strings in [-999999, 999999], with no leading zeros, plus signs, or negative zero.
Trees use `{ "value": "2" }` leaves or `{ "left": ..., "right": ... }` forks,
with at most 127 nodes and depth 8 (root depth zero). Extra fields and versions
fail closed. Input is limited to 64 KiB of strict UTF-8 without BOM. The output
tail is fixed to empty; raw cached trees and Lean expressions are not accepted.

The fixture yields prefixes `["5", "7", "16"]`, count `"3"`, scan additions
`"5"`, and scan cons cells `"3"`. All numerical results are decimal strings.
JS proposes the results; a generated `concrete_prefix_scan` theorem combines the
general correctness/cost theorem with Lean evaluation of those concrete results.
Only matching accepted proof evidence permits a successful report.

Success exits 0 with `schema_version`, `status: accepted`, `trust: proved`,
`proof_checker_backed: true`, `evidence_scope: concrete-lean-prefix-scan-model`,
`results` (prefixes, count, scan_additions, scan_cons_cells), request/library/source
SHA-256 hashes, `artifact_directory`, `limitations`, and the proof record.
The directory contains `request.json`, `Scan.lean`, and `report.json`; identifiers
and timestamps vary between runs. Failure exits 2 with version, `status: unverified`,
`proof_checker_backed: false`, and `error`, without results. Partial diagnostic
artifacts can remain after failure, but no successful report is returned.

The command requires the offline Docker environment. Its environment marker is
a usage guard, not a security boundary; container configuration provides isolation.
Rerun the saved request for fresh creation or use the bound replay below. This
workflow does not add CLI/MCP registration, cache-construction counts, or runtime
guarantees. Existing tree-evaluation JSON behavior remains unchanged.

## Prefix Scan Replay

Retain the original `request_sha256` in trusted task state outside the bundle.
Supply it explicitly when reopening; never derive the expected hash from the
candidate bundle itself. Hashes bind bytes, not authorship or mathematical truth.

```sh
docker compose run --rm -T lean-proof node tools/prefix-scan.mjs --reopen <bundle-directory> --expect-request-sha256 <trusted-request-hash>
```

Replay bounds and validates the original request, checks its exact byte hash,
regenerates the source using the current library, and compares it with saved
`Scan.lean`. It checks a private regenerated snapshot with Lean, not the mutable
saved file. It ignores `report.json`, even if corrupt or absent, leaves the
original files unchanged, and does not save another proof receipt. Temporary
source is removed on success or failure. Escaping request/source symlinks are
rejected. This is not a general sandbox against concurrent privileged filesystem
mutation. Changed source or library bytes require deliberate fresh creation.

Success exits 0 using `truth-harness.prefix-scan-reopen.v0`, `status: reopened`,
`trust: proved`, `proof_checker_backed: true`, the same results/evidence scope,
request/library/source hashes, `expected_request_sha256`, `artifact_directory`,
`cached_report_used: false`, limitations, and fresh proof metadata. That proof's
temporary source path no longer exists afterward; rerun this command to replay.
Failure exits 2 with the replay version, `status: unverified`,
`proof_checker_backed: false`, and `error`, with no results. Missing or malformed
hashes fail closed. Creation output remains unchanged.

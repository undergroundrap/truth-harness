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

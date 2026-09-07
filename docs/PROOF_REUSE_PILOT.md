# Sequential Tree Scratch-Space Proof Pilot

## Scope

This is a small, local-authored Lean proof package and interrupted-workflow rehearsal.
It is not a Prove2Me importer, a general theorem-DAG scheduler, autonomous proof
discovery, or a Hum verification adapter. It reuses the existing Lean proof-check
and research-session validation-gate paths. No external service is contacted at
runtime, no account is needed, and nothing is submitted to Prove2Me.

The motivation is useful proof reuse: a compiler might eventually consume a
checked resource lemma, but must separately establish that its generated program
implements the mathematical model. Hum capabilities still advertise verification
as unavailable. This pilot does not change either Hum V0 schema.

## Mathematical Target

For a finite binary tree, define height with a leaf height of one. Sequential
children share scratch, while the parent retains one frame:

```text
height(leaf) = 1
height(branch(l, r)) = max(height(l), height(r)) + 1
scratch(f, leaf) = f
scratch(f, branch(l, r)) = f + max(scratch(f, l), scratch(f, r))

scratch(f, t) <= f * height(t)

Given height(t) <= d and p + f * d <= b:
p + scratch(f, t) <= b
```

The [Lean sources](examples/lean-proof-reuse/Scratch/Bound.lean) prove the bound by
structural induction using a reusable maximum-bound lemma. The
[root check](examples/lean-proof-reuse/Scratch/Final.lean) checks the budget
corollary against an independently restated target and guards the transitive axiom
output: `budget_bound` uses only `propext`. A separate checked counterexample
shows that omitting depth is unsound even for one frame and a two-leaf branch.

These are known model bounds, not new mathematical research. They assume finite
trees, sequential children, reusable scratch, and a bounded retained frame.
Outputs and bookkeeping must fit that frame or be accounted for separately.
There is no guarantee here about machine overflow, allocator overhead, alignment,
concurrent execution, I/O, wall-clock speed, or correspondence to an actual program.
Nothing here derives a general optimization from Williams' space-simulation theorem.

## Reproduce

From the repository root with Docker Desktop running:

```bash
npm run docker:proof-reuse
```

Image provisioning can download dependencies. The actual `lean-proof` compose
service runs as a non-root user with `network_mode: none`, dropped capabilities
and no new privileges. This reuses the repository's Lean 4.12.0 baseline; no
Mathlib or external Lake packages are needed. That historical pin is a
reproducibility choice, not a claim that the toolchain is current or suitable for
adversarial third-party imports. A production importer needs a separate toolchain
security review and isolation policy.

The command returns exit 0 only if the rehearsal passes, or nonzero on failure.
Each run creates its own directory under `.truth-harness/pilots/scratch-reuse-*`:

- `PROGRESS.md`: dated result, assumptions, and metadata link.
- `report.json`: `truth-harness.proof-reuse-report.v0`, package hash, runtime
  version, cold-start result, scoped evidence references, conclusion, and boundary.
- `cold-start.json` and `missing-dependency.json`: fresh CLI planning/execution evidence.
- `lean-build.txt`: actual Lean build output, not model narration.
- `proof package/`: pinned replay sources and small generated Lake build artifacts.
- `.truth-harness/`: research session, validation plans, proof receipts, and saved handoffs.

No generated run is committed or uploaded. The runner does not prune other data.
Remove an unwanted run directory only after retaining any evidence you intend to cite.
No web server or long-running container is started.

## What The Rehearsal Tests

1. Validate the [manifest](examples/lean-proof-reuse/manifest.json), source hashes,
   complete acyclic metadata references, and exact toolchain version. Inspection
   returns `unverified`; it never converts metadata into proof.
2. Seed a research session linked to a proof validation plan, intentionally omitting
   `Scratch/Bound.lean`. A fresh CLI process must select `Scratch.scratch_bound`
   through `workspace run-next`, ahead of generic work, and cannot close its gate.
3. Restore the reviewed dependency artifact. This is deterministic fixture replay,
   not an agent inventing a proof. Build from source and execute `run-next` in fresh
   processes to obtain and attach local Lean evidence.
4. Link the budget theorem's plan only after its dependency gate closes. Replay its
   exact root check, then recheck the pinned files before reporting `proved`.

The manifest graph is explanatory metadata, not a kernel certificate. Lean checks
the actual imports and proof terms. This runner stages one eligible gate at a time;
it does not demonstrate distributed leases, automatic dependency-frontier selection
across an arbitrary graph, or propagation of invalidation across existing receipts.
Those are future work, not implied by this pilot.

## Regression Coverage

```bash
npm run check
npm run docker:check
npm run docker:proof-reuse
```

Unit tests reject changed proof/environment bytes, missing dependency files,
missing graph nodes, cycles, duplicate identities, unknown versions, path escapes,
unexpected remote-acceptance fields, BOMs, and CRLF manifests. Mocked subprocess
tests verify command forwarding only and are not mathematical evidence.

The real Docker rehearsal additionally exercises the persisted session, fresh CLI
processes, space-containing paths, Lake import resolution, checked root, and evidence
attachment. The project-aware gate syntax accepts both `Lean declaration ...` and
the existing `Lean mathlib declaration ...` form. `run-next` now preserves the
`--project` and `--lake-command` options when invoking the proof-check backend.

## Progress

- 2026-09-06: Authored the bounded model, six declarations, package pins, and
  cold-start rehearsal. This is original fixture code, not a remotely accepted proof.
- 2026-09-07 UTC: Docker replay exposed dropped `--project` arguments in `run-next`.
  The fix restores Lake import resolution; focused tests exercise that regression.
  Successful runs produce local dated reports and receipts using the command above.

Next decision: independently review this pilot, then select one actual Hum resource
obligation whose semantics can be mapped to a formal model. Do not infer program
safety from the theorem without that mapping and its assumptions being checked.

# Lean Proof Lane

Lean is not a general answer engine inside Truth Harness. It is the formal proof-checking lane: the place where `proved` can mean that an accepted proof checker verified a concrete source artifact.

## Why Lean Belongs Here

Truth Harness should use mature engines instead of pretending one AI model can be the engine. Lean is the right kind of dependency because it supplies a hard boundary that chat models, CAS output, notebooks, and simulations do not provide: a small-kernel proof checker with replayable source artifacts.

The product rule is simple:

- Lean can support `proved`.
- CAS tools can support exact computation or independent cross-checks.
- SMT solvers can support encoded constraint checks.
- notebooks, simulations, and plots can support reproducible evidence.
- AI agents can translate, critique, search, and repair, but they do not certify truth.

This keeps Lean from becoming bloat. Users should not need to write Lean for every calculation. Lean enters when a claim deserves formal proof.

## Current Local Workflow

Inspect a project layout without executing Lean, Lake, or any network command:

```bash
truth-harness proof project .
truth-harness proof project . --json
```

Check one concrete Lean source file:

```bash
truth-harness proof check docs/examples/trivial.lean --write
truth-harness proof list
```

Create a visual evidence view from the saved proof-check record:

```bash
truth-harness proof visual <proof_check_id>
truth-harness visual list
truth-harness visual show <visual_id>
```

The visual artifact is useful for review, teaching, and reports. It is not the proof object. The `truth-harness.proof-check.v0` JSON record remains authoritative.

## Readiness Boundary

`truth-harness proof project` is a local file inspection. It looks for:

- `lean-toolchain`
- `lakefile.lean` or `lakefile.toml`
- `lake-manifest.json`
- `.lean` files
- likely mathlib references

It does not run Lean. It does not run Lake. It does not fetch dependencies. It does not prove any claim. It exists so humans and agents can tell whether a folder is structured enough for reproducible proof work before they try to prove anything.

## Pinned Environment Path

For serious mathlib work, the target environment should be:

1. A workspace-local Lean/Lake project.
2. A pinned `lean-toolchain`.
3. A reviewed `lakefile.lean` or `lakefile.toml`.
4. A reviewed `lake-manifest.json` for dependency revisions.
5. A Docker image or dev container that installs exactly that toolchain.
6. Proof checks that write `.truth-harness/proofs/*.json`.
7. Visuals and reports generated from proof-check records, not from model claims.

Lean should not be bundled into the default image until the project has a pinned proof-lane environment. The current Docker image keeps Maxima and Z3 ready for CAS/SMT work; Lean remains opt-in until the proof project layout is chosen.

## Agent Use

Claude, Codex, and other agents should use Lean through a narrow loop:

1. Restate the informal claim as a proposed formal statement.
2. Save the `.lean` artifact locally.
3. Run `truth-harness proof check <file> --write`.
4. If rejected, treat the result as unverified and preserve the error.
5. If accepted, attach the proof-check record to the verifier route or claim ledger.
6. Generate a proof visual only after the proof-check record exists.

Agents may propose proof repairs, but they should not describe a claim as proved unless the accepted proof-check record exists and the formal statement matches the intended claim.

## Research Direction

The next proof-lane milestones are:

- a pinned Lean/Lake/mathlib Docker profile,
- proof project fixtures for regression tests,
- route obligations that point to specific formal statements,
- proof attempt history records for rejected attempts,
- richer proof-tree visuals generated from structured Lean/LSP output when available,
- model-context packets that send only the selected formal statement and proof error to a hosted model for critique.

The long-term goal is not to make everyone a Lean expert. The goal is to let humans and agents move from informal math toward formal proof when the claim deserves that level of trust.

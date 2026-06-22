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
truth-harness proof project docs/examples/lean-fixture --json
```

The project inspection now includes a static formalization inventory and proof-safety scan over sampled `.lean` files. It counts and samples `theorem`, `lemma`, `example`, and `def` declarations so a human or agent can see the exact Lean targets in the folder before asking a model to repair or extend them. It also records SHA-256 file identities for inspected Lean project files, so reports and agents can cite the exact local source revision they inspected. It also reports file/line markers for `sorry`, `admit`, Lean metavariable holes such as `?_` or `?goal`, local `axiom`, and local `constant` declarations because those markers block `proved` trust in Truth Harness. Comments and string literals are ignored. Each marker includes a deterministic repair target id, source SHA-256, declaration signature SHA-256 when available, and after-edit proof-check command. This scan still does not run Lean and does not prove or disprove any theorem; it tells an agent which formal target and proof hole or local assumption should be fixed before a proof-check record can responsibly support `proved`. Workspace review and `workspace run-next` prioritize those blockers before generic proof work, so an autonomous agent reopening a project attacks the concrete Lean hole first instead of inventing unrelated progress.

When a verifier route already has an open formal-proof obligation with a placeholder source such as `<workspace-local.lean>`, workspace review may use the declaration inventory to turn that placeholder into a concrete scoped command. The handoff also records the selected declaration id, signature SHA-256, and source-file SHA-256 so the agent knows the exact formal target it is trying to close:

```bash
truth-harness proof check Proofs/Example.lean --declaration theorem_name --write --route <route_id> --obligation <obl_id> --statement <statement> --statement-hash <hash>
```

That is only a planner convenience. It does not mean the declaration is semantically equivalent to the informal claim, and it does not mint `proved`. The command must still write an accepted proof-check record, and route closure still requires the exact route, obligation, and statement boundary to match.

Check one concrete Lean source file:

```bash
truth-harness proof check docs/examples/trivial.lean --write
truth-harness proof check docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean --fail-on-unproved
truth-harness proof list
```

When a proof-check is meant to close a verifier-route formal-proof obligation, scope it to the exact route and obligation:

```bash
truth-harness proof check <workspace-local.lean> --write --route <route_id> --obligation <obl_id>
```

An accepted proof-check without this route scope is still a useful proof artifact, but it does not automatically satisfy an unrelated route obligation.

New proof-check records also try to parse the checked source and record the selected declaration identity when possible: declaration id, kind, name, file location, signature, signature SHA-256, and source SHA-256. If `--declaration <name>` is supplied but the local parser cannot find that declaration, the proof-check record keeps the whole-file Lean result but adds a warning for declaration-scoped reviewers. This metadata helps humans and agents audit which theorem or lemma was intended; it is not a substitute for the route scope and statement boundary checks required to close a formal-proof obligation.

When a route obligation already has a rejected or errored scoped proof attempt, workspace review records the source file hash, source status, and, when available, the exact declaration id/signature metadata in the handoff packet and nested `proofAttempt.declaration`. If the source is unchanged, `workspace run-next --execute-local` will not rerun the same proof check. If the source changed, the handoff says so and the next proof check can create fresh evidence. Edit the same Lean source first, then rerun the scoped proof check so the workspace gains a genuinely new artifact instead of duplicate failed evidence.

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
- declaration inventory for `theorem`, `lemma`, `example`, and `def`

It does not run Lean. It does not run Lake. It does not fetch dependencies. It does not prove any claim. It exists so humans and agents can tell whether a folder is structured enough for reproducible proof work before they try to prove anything.

It also reports unfinished proof markers:

- `sorry`
- `admit`
- Lean metavariable holes such as `?_` or `?goal`
- local `axiom`
- local `constant`

These are not syntax errors by themselves. They are trust-boundary markers. If the scan finds them, the next agent action should be to remove, replace, or formally justify the marker before trying to close a proof obligation.

For markers inside a declaration, the inspection also records the enclosing declaration id, signature SHA-256, source SHA-256, and a `repairTarget` object. Workspace review and saved `workspace run-next` handoffs preserve that object as `proofRepairTarget`, including the source hash and after-edit command. That lets a reviewer or autonomous agent target the exact theorem, lemma, example, or def that contains the unfinished proof marker instead of treating the file as an undifferentiated blob. The repair target is not evidence; it is a local plan for editing the source, rerunning the proof-safety scan, and only then writing an accepted proof-check record.

## Pinned Environment Path

For serious mathlib work, the target environment should be:

1. A workspace-local Lean/Lake project.
2. A pinned `lean-toolchain`.
3. A reviewed `lakefile.lean` or `lakefile.toml`.
4. A reviewed `lake-manifest.json` for dependency revisions.
5. A Docker image or dev container that installs exactly that toolchain.
6. Proof checks that write `.truth-harness/proofs/*.json`, scoped to route obligations when they are meant to close verifier-route gates.
7. Proof-check records that preserve declaration id, signature SHA-256, source SHA-256, and route/statement scope for reviewer-critical theorem targets.
8. A clean proof-safety scan for the checked source: no `sorry`, `admit`, Lean metavariable holes, local `axiom`, or local `constant` markers in the proof artifact.
9. Visuals and reports generated from proof-check records, not from model claims.

Lean should not be bundled into the default image until the project has a pinned proof-lane environment. The current Docker image keeps Maxima, Z3, and cvc5 ready for CAS/SMT work; Lean remains opt-in until the proof project layout is chosen.

The repository includes a small pinned fixture at `docs/examples/lean-fixture`:

- `lean-toolchain`: `leanprover/lean4:v4.12.0`
- `lakefile.lean`: minimal ASCII Lake package metadata
- `TruthHarnessFixture/Trivial.lean`: accepted smoke theorems for implication, conjunction, equality reflexivity, and basic Nat identities

Run the local script when Lean is installed:

```bash
npm run proof:lean-fixture
```

Run the Docker profile when you want the fixture checked in a reproducible image:

```bash
docker compose build lean-proof
docker compose run --rm lean-proof
```

The Docker target installs Lean through elan during image build, then the compose service checks the fixture with no runtime network route. This profile is deliberately separate from the default dev image so the proof lane can become strong without making every user carry a large proof environment.

## Agent Use

Claude, Codex, and other agents should use Lean through a narrow loop:

1. Restate the informal claim as a proposed formal statement.
2. Save the `.lean` artifact locally.
3. Run `truth-harness proof check <file> --write`.
4. If rejected, treat the result as unverified and preserve the error.
5. If accepted, attach the proof-check record to the verifier route or claim ledger.
6. Generate a proof visual only after the proof-check record exists.

When a rejected or errored proof-check record is scoped to a route id and obligation id, workspace review can reuse it as the next repair target. The next handoff points back to the same Lean file, declaration, route, obligation, statement, and statement hash so the agent repairs the actual failed artifact instead of starting a disconnected proof attempt. It also records a structured `proofAttempt` object and a `Lean proof repair artifact` evidence slot with the exact route/obligation attach target. Listed proof-check summaries include a bounded Lean stderr/stdout diagnostic preview when available; this is only a repair hint and does not prove or refute the scoped claim.

When a proof-check record contains declaration metadata, agents should preserve that target across repair attempts. If the target declaration id or signature hash changes, treat it as a new proof target and explain why the route or validation gate still matches the intended claim.

If several rejected or errored proof-check records target the same route obligation, workspace review and saved `workspace run-next` handoffs include a bounded `proofAttemptHistory` array, newest first. Agents should read that history before editing so they do not repeat an earlier failed proof strategy. The latest attempt still determines the immediate repair command and source-change preflight; the history is context for repair, not evidence that upgrades trust.

Agents may propose proof repairs, but they should not describe a claim as proved unless the accepted proof-check record exists and the formal statement matches the intended claim.

## Research Direction

The next proof-lane milestones are:

- a pinned Lean/Lake/mathlib Docker profile,
- fixture promotion from the current small Lean project to a mathlib-backed project,
- proof project fixtures for regression tests,
- route obligations that point to specific formal statements,
- richer proof-attempt history and repair diagnostics across rejected attempts,
- richer proof-tree visuals generated from structured Lean/LSP output when available,
- model-context packets that send only the selected formal statement and proof error to a hosted model for critique.

The long-term goal is not to make everyone a Lean expert. The goal is to let humans and agents move from informal math toward formal proof when the claim deserves that level of trust.

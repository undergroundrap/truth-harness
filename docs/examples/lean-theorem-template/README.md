# Lean Theorem Template

This fixture is the smallest reusable formal-proof project in Truth Harness.
It is intentionally core-Lean-only so reviewers and agents can check the proof
lane without downloading mathlib.

Use it for three things:

- inspect a pinned Lean/Lake project layout with `truth-harness proof project`;
- check a handful of accepted theorem shapes with `truth-harness proof check`;
- copy `TruthHarnessTemplate/NewTheorem.lean.template` when starting a new
  workspace-local formalization.

The `.lean.template` file is not proof evidence. It is ignored by the project
scanner until copied to a concrete `.lean` file, and no claim should receive
`proved` unless an accepted `truth-harness.proof-check.v0` record exists for
the real source artifact.

Local check:

```bash
npm run proof:theorem-template
```

Docker check:

```bash
npm run docker:theorem-template
```

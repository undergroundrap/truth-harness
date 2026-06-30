# Lean Mathlib Template

This fixture is the first Truth Harness mathlib-backed proof scaffold. It is a
small, pinned Lake project used to rehearse how agent-generated theorem work
becomes reviewer-grade evidence without pretending inspection is proof.

Use it for four things:

- inspect a Lean/Lake project that declares a mathlib dependency;
- verify that theorem-corpus targets resolve to local Lean declarations;
- keep a reviewed `lake-manifest.json` pin for dependency reproducibility;
- rehearse the exact project-aware command agents use after dependencies are
  fetched in a controlled proof image.

Current template families:

- finite-set cardinality;
- natural-number algebra;
- integer algebra;
- natural-number order;
- real-analysis nonnegativity.

Static inspection:

```bash
npm run proof:mathlib-template
```

Concrete proof check with pinned Lake dependencies available:

```bash
npm run proof:mathlib-template:check
```

No-runtime-network Docker proof receipt:

```bash
npm run docker:mathlib-template:write
```

Boundary:

- `theorem-corpus.json` is not proof evidence.
- `lakefile.lean` names the mathlib tag and `lake-manifest.json` pins the exact
  dependency revisions, but neither file proves a theorem by itself.
- The check command must use `truth-harness proof check --project` so Lean runs
  through `lake env lean` from this project directory.
- No claim receives `proved` until an accepted `truth-harness.proof-check.v0`
  record exists for the concrete source artifact and current source SHA.

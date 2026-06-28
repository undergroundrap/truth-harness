# Lean Mathlib Template

This fixture is the first Truth Harness mathlib-backed proof scaffold. It is
not part of the default proof suite yet because mathlib dependencies must be
pinned and cached before reviewer Docker can check it with no runtime network.

Use it for three things:

- inspect a Lean/Lake project that declares a mathlib dependency;
- verify that theorem-corpus targets resolve to local Lean declarations;
- rehearse the exact project-aware command agents will use once dependencies
  are fetched in a controlled proof image.

Static inspection:

```bash
npm run proof:mathlib-template
```

Concrete proof check after Lake dependencies are pinned and available:

```bash
npm run proof:mathlib-template:check
```

Boundary:

- `theorem-corpus.json` is not proof evidence.
- `lakefile.lean` names the mathlib tag, but a reviewed `lake-manifest.json`
  is still required before this can be a reproducible reviewer gate.
- The check command must use `truth-harness proof check --project` so Lean runs
  through `lake env lean` from this project directory.
- No claim receives `proved` until an accepted `truth-harness.proof-check.v0`
  record exists for the concrete source artifact.

# Engine Math Lane

Truth Harness has an engine-math lane for game, simulation, robotics, graphics, and agentic engine work. It is not trying to become a full game engine. It verifies small engine claims as replayable evidence: a human or agent states a narrow geometry predicate, Truth Harness routes it to the smallest deterministic checker, and the receipt records the exact inputs, convention, trace, backend id, trust label, and replay command.

## 2D Collision Verifier Pack

The current pack is `engine-2d-collision-verifier-pack`, exposed through the engine manifest as capability `local-engine-geometry-2d`.

It is local-only, deterministic, and no-network. It can earn `exact-computed` or `refuted` for supported integer-coordinate 2D predicates. It never earns `proved`, because these are native deterministic kernels, not accepted Lean proof-checker artifacts.

Supported predicate families:

| Predicate | Backend id | Boundary convention |
| --- | --- | --- |
| AABB/AABB overlap | `local-aabb2-overlap` | Closed intervals; touching edges/corners count as overlap. |
| Swept AABB/AABB intersection | `local-swept-aabb2-intersection` | One moving integer AABB against one static AABB over `0 <= t <= 1`. |
| Circle/circle intersection | `local-circle2-intersection` | Closed disks; tangency and containment count as intersection. |
| Capsule/circle intersection | `local-capsule2-circle-intersection` | Closed capsule and closed disk; boundary contact counts as intersection. |
| Circle/AABB intersection | `local-circle2-aabb-intersection` | Exact closest-point distance against a closed AABB. |
| Segment/segment intersection | `local-segment2-intersection` | Closed non-degenerate segments; endpoints count as intersection. |
| Ray/circle intersection | `local-ray2-circle-intersection` | Ray domain is `t >= 0` or finite `0 <= t <= max t`; closed disk boundary counts as hit. |
| Ray/AABB intersection | `local-ray2-aabb-intersection` | Exact rational slab interval with ray domain `t >= 0` or finite `0 <= t <= max t`. |
| Barycentric coordinates | `local-barycentric2` | Exact signed double-area barycentric coordinates for one non-degenerate integer-coordinate triangle. |
| Point-in-triangle membership | `local-point-in-triangle2` | Closed non-degenerate triangle; edges count as inside. |

Accepted examples:

```bash
npm run cli -- ask "Do AABB A min(0,0) max(4,4) and AABB B min(3,1) max(6,5) overlap?"
npm run cli -- ask "Do swept AABB A min(0,0) max(1,1) velocity(3,0) intersect AABB B min(3,0) max(4,1) over t in [0,1]?"
npm run cli -- ask "Do circle A center(0,0) radius 3 and circle B center(4,0) radius 2 intersect?"
npm run cli -- ask "Do capsule A from (0,0) to (4,0) radius 1 and circle B center(2,1) radius 1 intersect?"
npm run cli -- ask "Do circle center(2,2) radius 2 intersect AABB min(3,0) max(6,4)?"
npm run cli -- ask "Do segment A from (0,0) to (4,4) and segment B from (0,4) to (4,0) intersect?"
npm run cli -- ask "Do ray origin(0,0) direction(1,0) intersect circle center(3,1) radius 2?"
npm run cli -- ask "Do ray origin(0,2) direction(1,0) intersect AABB min(3,0) max(5,4)?"
npm run cli -- ask "compute barycentric coordinates for point (1,1) in triangle A(0,0) B(4,0) C(0,4)"
npm run cli -- ask "verify barycentric coordinates for point (1,1) in triangle A(0,0) B(4,0) C(0,4) = (1/3,1/3,1/3)"
npm run cli -- ask "Is point (1,1) in triangle A(0,0) B(4,0) C(0,4)?"
```

The planner now recognizes AABB, circle, capsule, segment, ray, raycast, triangle, barycentric, interpolation, collision, overlap, intersection, hit-test, and swept-collision language as `engine-geometry`, and routes to `local-engine-geometry-2d` before generic symbolic or SMT planning.

```bash
npm run cli -- engines plan "does this ray intersect the circle?"
```

Agents can also list verifier packs before planning a claim. This is read-only: it exposes supported predicates, backend ids, replay commands, and the benchmark gate without running engines or minting evidence.

When `engines plan` selects this lane, the plan JSON and any `workspace run-next` handoff embed a compact matched-pack summary so agents see the pack id, backend ids, benchmark task count, and Docker replay command without a second lookup.

```bash
npm run cli -- engines packs
npm run cli -- engines packs local-engine-geometry-2d -- --json
```

## External Engine Case Bundle Contract

Truth Harness can now validate math exported by a separate engine, including a Rust game engine, without running arbitrary engine code. The engine writes a JSON bundle; Truth Harness recomputes each narrow primitive through the local verifier pack and reports whether the engine output is accepted, refuted, or unsupported.

Validate the checked example:

```bash
npm run cli -- engines validate docs/examples/engine-case-bundle.json
npm run cli -- engines validate docs/examples/engine-case-bundle.json -- --json
```

A Rust engine CI job should emit this shape after running its own math fixtures:

```json
{
  "schemaVersion": "truth-harness.engine-case-bundle.v0",
  "producer": {
    "name": "my-rust-engine",
    "version": "0.1.0",
    "commit": "<git-sha>",
    "command": "cargo test --test engine_math_export"
  },
  "cases": [
    {
      "caseId": "aabb-overlap-smoke",
      "primitive": "aabb2-overlap",
      "boundary": "closed-intervals-touching-counts-as-overlap",
      "inputs": {
        "a": { "minX": "0", "minY": "0", "maxX": "4", "maxY": "4" },
        "b": { "minX": "3", "minY": "1", "maxX": "6", "maxY": "5" }
      },
      "observed": { "overlap": true }
    }
  ]
}
```

Rules for v0:

- External engine output is untrusted until Truth Harness recomputes it.
- Truth Harness does not execute the engine bundle or run arbitrary code.
- Integer fields should be strings. Rational fields should be strings like `1/4`.
- Floating-point tolerances are not part of v0; they need explicit future tolerance-policy adapters.
- If the bundle boundary does not match the verifier convention, the case stays `unverified` / `unsupported` instead of being force-fit.
- The CLI exits non-zero unless every selected case is accepted, making it suitable for CI.

Supported `primitive` values mirror the verifier pack: `aabb2-overlap`, `swept-aabb2-intersection`, `circle2-intersection`, `capsule2-circle2-intersection`, `circle2-aabb2-intersection`, `segment2-segment2-intersection`, `ray2-circle2-intersection`, `ray2-aabb2-intersection`, `barycentric2-coordinates`, and `point2-triangle2-membership`. Backend aliases such as `local-aabb2-overlap` are accepted so engines can emit Truth Harness backend ids directly.

This is the first concrete bridge for external engines: production code can run fast, export its claimed primitive results, and let Truth Harness provide the independent local correctness oracle.

## Known External Producer: VIRE

Last verified: 2026-07-02 against sibling VIRE commit `e0ceef70a0462436273e04775fb0637382850f8e` (`feat(verification): share exact geometry predicates`).

VIRE now owns the observed primitive answers in `vire_core::geometry2`; its CLI exporter serializes those engine-owned exact predicates into `truth-harness.engine-case-bundle.v0`. Truth Harness then validates the bundle by recomputing every case locally without executing VIRE code.

Validation command from this Truth Harness checkout:

```powershell
node apps\cli\dist\index.js engines validate ..\vire-engine\target\truth-harness\engine-cases.json
```

Observed result:

- Producer: `vire-engine 0.0.1`.
- Exported cases: 6 exact 2D primitive fixtures.
- Accepted by Truth Harness: 6.
- Refuted by Truth Harness: 0.
- Unsupported by Truth Harness: 0.
- Trust earned per case: `exact-computed`.

This is the first confirmed external-engine bridge: a separate Rust engine exports scoped math evidence from its own core geometry module, and Truth Harness independently recomputes the claimed primitive outputs. The scope remains narrow: this validates the exported fixtures only, not full gameplay physics, collision response, broadphase behavior, renderer behavior, or concurrency safety.

## Benchmark Gate

Run the pack natively:

```bash
npm run build
npm run demo:engine-math
```

Run it through the Docker-first workflow:

```bash
npm run docker:engine-math
```

The suite lives at `packages/benchmarks/suites/engine-math-seed.json` and currently has 33 cases: 21 `exact-computed` receipts and 12 `refuted` receipts. The regression tests tie the verifier pack to those 33 task IDs so docs, manifest, and benchmark coverage cannot drift quietly.

## Evidence Boundary

This lane currently does not verify:

- arbitrary engine runtime state
- collision response or contact manifolds
- broadphase data structures
- meshes, polygons beyond the listed primitives, or rotated boxes
- open-boundary ray policies or engine-specific normalized-distance semantics
- full mesh interpolation pipelines, shaders, or runtime rendering state
- floating-point tolerance policy or numerical drift
- rendering visibility, BVH correctness, or GPU behavior
- physics integration or timestep stability
- concurrency, deadlock, or ECS scheduling

Those become separate adapters, receipts, and benchmark gates. The rule is still one small primitive at a time: make the evidence machine-readable, replay it in Docker, then let agents compose primitives into larger validation plans.

## Roadmap

Good next slices:

1. Half-open and open boundary variants so engines can compare collision policies explicitly.
2. Open/closed finite-ray endpoint policies and normalized-direction distance conventions.
3. Scalar/vector attribute interpolation certificates built on barycentric coordinates.
4. Broadphase grid bucket membership predicates.
5. Fixed-timestep accumulator invariants and drift bounds.
6. Lock-order and ECS schedule constraints compiled to SMT.
7. Rust engine geometry fixtures that compare production code against the verifier pack.

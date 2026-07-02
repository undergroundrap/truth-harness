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
| Ray/circle intersection | `local-ray2-circle-intersection` | Ray domain is `t >= 0`; closed disk boundary counts as hit. |
| Ray/AABB intersection | `local-ray2-aabb-intersection` | Exact rational slab interval with ray domain `t >= 0`. |
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
npm run cli -- ask "Is point (1,1) in triangle A(0,0) B(4,0) C(0,4)?"
```

The planner now recognizes AABB, circle, capsule, segment, ray, raycast, triangle, collision, overlap, intersection, hit-test, and swept-collision language as `engine-geometry`, and routes to `local-engine-geometry-2d` before generic symbolic or SMT planning.

```bash
npm run cli -- engines plan "does this ray intersect the circle?"
```

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

The suite lives at `packages/benchmarks/suites/engine-math-seed.json` and currently has 27 cases: 18 `exact-computed` receipts and 9 `refuted` receipts. The regression tests tie the verifier pack to those 27 task IDs so docs, manifest, and benchmark coverage cannot drift quietly.

## Evidence Boundary

This lane currently does not verify:

- arbitrary engine runtime state
- collision response or contact manifolds
- broadphase data structures
- meshes, polygons beyond the listed primitives, or rotated boxes
- finite ray segments or maximum ray travel distance
- floating-point tolerance policy or numerical drift
- rendering visibility, BVH correctness, or GPU behavior
- physics integration or timestep stability
- concurrency, deadlock, or ECS scheduling

Those become separate adapters, receipts, and benchmark gates. The rule is still one small primitive at a time: make the evidence machine-readable, replay it in Docker, then let agents compose primitives into larger validation plans.

## Roadmap

Good next slices:

1. Half-open and open boundary variants so engines can compare collision policies explicitly.
2. Finite ray segment and maximum-travel raycast variants.
3. Barycentric coordinate certificates for interpolation and rendering workflows.
4. Broadphase grid bucket membership predicates.
5. Fixed-timestep accumulator invariants and drift bounds.
6. Lock-order and ECS schedule constraints compiled to SMT.
7. Rust engine geometry fixtures that compare production code against the verifier pack.

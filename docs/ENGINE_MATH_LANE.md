# Engine Math Lane

Truth Harness is starting an engine-math lane for game, simulation, robotics, and graphics-engine work. The goal is not to become a full engine inside the verifier. The goal is to make engine claims replayable: a human or agent can state a small geometry, physics, or scheduling claim, then route it to the smallest deterministic checker that can earn the right trust label.

## First Supported Predicate

The first slice is a 2D integer-coordinate AABB overlap adapter.

Accepted prompt shape:

```bash
npm run cli -- ask "Do AABB A min(0,0) max(4,4) and AABB B min(3,1) max(6,5) overlap?"
npm run cli -- ask "verify AABB A min(0,0) max(4,4) and AABB B min(5,1) max(7,3) overlap = true"
npm run cli -- ask "verify AABB A min(0,0) max(4,4) and AABB B min(4,4) max(6,6) overlap = true"
```

The adapter records:

- exact integer coordinates for both boxes
- the convention `closed-intervals-touching-counts-as-overlap`
- the four axis comparisons used by the predicate
- whether each axis overlaps
- separating-axis evidence when a stated overlap is false
- the replay command and receipt artifact

Trust labels are conservative:

- `exact-computed` when no stated result is provided, or the stated result matches the exact predicate
- `refuted` when the stated result disagrees with the exact predicate
- never `proved`, because this is a local deterministic predicate, not an accepted formal proof-checker result

## Benchmark

Run the engine seed suite natively:

```bash
npm run build
npm run demo:engine-math
```

Run it through the Docker-first workflow:

```bash
npm run docker:engine-math
```

The suite lives at `packages/benchmarks/suites/engine-math-seed.json` and currently covers:

- overlapping AABBs
- a false stated overlap refuted by a separating axis
- a touching-corner boundary case under the recorded closed-interval convention

## Boundary

This lane currently does not verify:

- swept collision
- rotated boxes
- circles, capsules, meshes, or convex polygons
- floating-point tolerance policy
- broadphase data structures
- physics integration
- engine runtime state
- concurrency, deadlock, or ECS scheduling

Those should become separate adapters with their own receipts and benchmark gates.

## Roadmap

Good next slices:

1. AABB half-open interval variant, so engines can compare closed vs half-open collision policy.
2. Ray vs AABB intersection with exact rational parameters.
3. Segment intersection orientation tests with integer determinants.
4. Barycentric point-in-triangle checks for rendering and collision picking.
5. Fixed-timestep accumulator invariants and drift bounds.
6. Broadphase grid bucket membership predicates.
7. Lock-order and ECS schedule constraints compiled to SMT.

The strategic rule is simple: add one small engine primitive at a time, make the evidence machine-readable, then let agents compose primitives into larger validation plans.
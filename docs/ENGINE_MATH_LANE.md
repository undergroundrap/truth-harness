# Engine Math Lane

Truth Harness is starting an engine-math lane for game, simulation, robotics, and graphics-engine work. The goal is not to become a full engine inside the verifier. The goal is to make engine claims replayable: a human or agent can state a small geometry, physics, or scheduling claim, then route it to the smallest deterministic checker that can earn the right trust label.

## Supported Predicates

The first slice is a 2D integer-coordinate AABB overlap adapter. The second slice is a 2D integer-coordinate segment intersection adapter backed by exact orientation determinants. The third slice is a 2D integer-coordinate ray/AABB adapter backed by exact rational slab intervals. The fourth slice is a 2D integer-coordinate point-in-triangle adapter backed by exact orientation tests.

Accepted prompt shape:

```bash
npm run cli -- ask "Do AABB A min(0,0) max(4,4) and AABB B min(3,1) max(6,5) overlap?"
npm run cli -- ask "verify AABB A min(0,0) max(4,4) and AABB B min(5,1) max(7,3) overlap = true"
npm run cli -- ask "verify AABB A min(0,0) max(4,4) and AABB B min(4,4) max(6,6) overlap = true"
npm run cli -- ask "Do segment A from (0,0) to (4,4) and segment B from (0,4) to (4,0) intersect?"
npm run cli -- ask "verify segment A from (0,0) to (1,1) and segment B from (2,2) to (3,3) intersect = true"
npm run cli -- ask "verify segment A from (0,0) to (4,0) and segment B from (2,0) to (6,0) intersect = true"
npm run cli -- ask "Do ray origin(0,2) direction(1,0) intersect AABB min(3,0) max(5,4)?"
npm run cli -- ask "verify ray origin(0,5) direction(1,0) intersect AABB min(3,0) max(5,4) = true"
npm run cli -- ask "verify ray origin(6,2) direction(1,0) intersect AABB min(3,0) max(5,4) = false"
npm run cli -- ask "Is point (1,1) in triangle A(0,0) B(4,0) C(0,4)?"
npm run cli -- ask "verify point (2,0) in triangle A(0,0) B(4,0) C(0,4) = true"
npm run cli -- ask "verify point (5,5) in triangle A(0,0) B(4,0) C(0,4) = true"
```

The AABB adapter records:

- exact integer coordinates for both boxes
- the convention `closed-intervals-touching-counts-as-overlap`
- the four axis comparisons used by the predicate
- whether each axis overlaps
- separating-axis evidence when a stated overlap is false
- the replay command and receipt artifact

The segment adapter records:

- exact integer endpoints for both non-degenerate segments
- the convention `closed-segments-endpoints-count-as-intersection`
- four orientation determinants and signs
- whether the intersection is a proper crossing, endpoint touch, collinear overlap, collinear disjoint case, or disjoint case
- the replay command and receipt artifact

The ray/AABB adapter records:

- exact integer origin, integer direction vector, and integer AABB bounds
- the convention `closed-aabb-ray-domain-t-greater-than-or-equal-zero`
- per-axis slab intervals, including parallel-inside and parallel-outside axes
- the final exact rational `tEnter` and `tExit` interval after intersecting with `t >= 0`
- whether the result is a ray hit, origin-inside hit, parallel miss, behind-ray miss, or slab miss
- the replay command and receipt artifact

The point-in-triangle adapter records:

- exact integer point and non-degenerate triangle vertices
- the convention `closed-triangle-edges-count-as-inside`
- the signed double-area determinant of the triangle
- three normalized edge orientation tests
- whether the point is inside, on an edge, on a vertex, or outside
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
- proper crossing line segments
- a false collinear-disjoint segment claim refuted by bounds checks
- collinear overlapping segments under the recorded closed-segment convention
- a ray/AABB hit with exact rational `t` interval
- a false parallel-slab ray/AABB claim refuted by slab status
- a ray/AABB miss where the box lies behind the ray domain
- a point inside a triangle with exact edge tests
- a point on a triangle edge under the recorded closed-triangle convention
- a false point-in-triangle claim refuted by edge orientations

## Boundary

This lane currently does not verify:

- swept collision
- rotated boxes
- zero-length point segments
- ray direction vector `(0,0)`
- degenerate triangles with zero area
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
2. Ray/AABB variants for finite ray segments, maximum travel distance, and open boundary policies.
3. Segment intersection variants for open or half-open endpoint policies.
4. Barycentric coordinate certificates for point-in-triangle interpolation and rendering workflows.
5. Fixed-timestep accumulator invariants and drift bounds.
6. Broadphase grid bucket membership predicates.
7. Lock-order and ECS schedule constraints compiled to SMT.

The strategic rule is simple: add one small engine primitive at a time, make the evidence machine-readable, then let agents compose primitives into larger validation plans.
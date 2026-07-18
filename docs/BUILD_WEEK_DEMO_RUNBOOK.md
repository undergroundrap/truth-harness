# Build Week Demo Runbook

## Demo thesis

An AI or naive game-engine implementation can inspect only the beginning and end of a frame, see no overlap, and confidently conclude that no collision occurred. Truth Harness checks the continuous interval with exact rational arithmetic and records a replayable refutation.

This is a real applied-math regression from the Truth Harness engine-math lane. It is derived from the VIRE external-engine integration, but the recording is self-contained and does not execute or depend on VIRE.

## Problem

A unit axis-aligned box starts at `x = [0, 1]`, moves five units along the x axis during one frame, and ends at `x = [5, 6]`. A static unit box occupies `x = [3, 4]`. Both boxes occupy the same closed y interval.

The endpoint-only claim is:

> The boxes do not overlap at `t = 0` or `t = 1`, so they never collide during the frame.

Truth Harness receives the exact claim:

```text
verify swept AABB A min(0,0) max(1,1) velocity(5,0) intersect AABB B min(3,0) max(4,1) over t in [0,1] = false
```

## Expected evidence

- Trust label: `refuted`.
- Exact result: the swept boxes intersect.
- Entry time: `tEnter = 2/5`.
- Exit time: `tExit = 4/5`.
- Backend: `local-swept-aabb2-intersection`.
- Privacy: local-only, `networkAccess = none`.
- Boundary: integer-coordinate closed AABBs, integer velocity, and continuous `0 <= t <= 1`; this is not a full physics-engine proof.

## Rehearsal command

Build the current recording image before opening your recorder:

```bash
npm run docker:build-week:prepare
```

Then run the recording case in the no-network Docker service:

```bash
npm run docker:build-week
```

The playback command runs one focused case from the prepared `truth-harness:dev` image and writes:

```text
.truth-harness/reports/build-week-demo-report.html
```

The existing full launch gauntlet remains available through `npm run docker:demo`.

## Recording order

1. Show Docker Desktop running and open the focused Truth Harness workbench at `http://127.0.0.1:4180/?demo=build-week`.
2. State the endpoint-only claim in one sentence.
3. The exact claim is prefilled. Select **Verify**; this calls the normal local receipt API rather than a mocked demo route.
4. Pause on the `refuted` trust label and exact `2/5` to `4/5` impact window.
5. Point to the receipt inspector: backend `local-swept-aabb2-intersection`, network `none`, and trust `refuted` rather than `proved`.
6. Open **Replay** and show the problem, exact tool run, and counterexample frames.
7. End on the generated HTML report path and this sentence: "The AI proposes; local verifiers decide what the evidence earns."

## Recording gate

Record only after all of these pass on the target machine:

```bash
npm run check
npm run docker:build-week:prepare
npm run docker:build-week
npm run audit:release
```

The demo is invalid if the trust label, impact times, backend, privacy boundary, or replay command differ from the expected evidence above.

The focused demo runs with `network_mode: none` and mounts only `.truth-harness`, where it writes the report. The Docker web app runs on an internal-only network and also mounts only `.truth-harness`; the source tree is baked into the prepared image. A separate local gateway publishes `127.0.0.1:4180` without mounting the workspace.

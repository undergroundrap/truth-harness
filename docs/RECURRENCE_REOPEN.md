# Reopen Saved Recurrence Evidence

This read-only scripted workflow starts with a request file, not a remembered
receipt path. It hashes the exact request bytes, follows local lookup pages,
and independently replays discovered receipts against that request. It never
constructs replacement evidence or reads saved report labels as proof.

```sh
docker compose run --build --rm -T pit-experiment node tools/recurrence-reopen.mjs docs/examples/exponential-recurrence-tree.json
```

Optional `--root WORKSPACE` selects the witness store. The request is an explicit
file path; stdin is not supported. Lookup reads at most 8192 names and 256 entries
per page. Reopen follows at most 32 pages and attempts at most four receipt replays
in deterministic discovery order. Malformed, mismatched, changed, refuted, or
unknown evidence is not accepted. Bad early candidates can exhaust this budget
even if a later good receipt exists; failure is not evidence that the claim is false.

Exit 0 returns `truth-harness.recurrence-reopen.v0`, status `reopened`, page and
attempt counts, rejected candidate paths, selected receipt path and a fresh replay
report. Acceptance requires an `identity-checked` replay with matching request and
receipt byte hashes. Exit 2 returns `unverified`, `checked: false`, and an error
when no evidence is accepted, the budget expires, or execution fails.

The workflow writes no files. Its output may be retained by the caller as a log,
but is not a substitute for subsequent replay. It needs the offline Docker source
checkout; image builds may fetch dependencies. It has no network or telemetry path.

## What This Demonstrates

The regression test creates checked evidence, then launches two fresh processes.
Each discovers it after an empty lookup page, rejects a malformed earlier receipt,
and replays the good receipt. File snapshots confirm the reopen runs do not write.
Changing an initial condition prevents reuse, even if someone copies the new
request beside the old receipt. Missing evidence and replay-budget exhaustion
remain failures, not automatic invitations to produce a new proof.

This demonstrates cross-process reuse of exact recurrence evidence, not an LLM
learning new mathematics. It does not verify that source code implements the
recurrence, discover formulas, or establish new mathematical results. Matching
bytes identify candidates only; the independent checker decides acceptance.
The result remains `exact-computed`, never a Lean-kernel `proved` result.

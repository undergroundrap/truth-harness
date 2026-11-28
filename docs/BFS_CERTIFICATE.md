# BFS Distance Certificate

Check claimed shortest distances for a directed graph with unit-length edges.
The tool checks the supplied labels against four local certificate conditions.
It does not run a second BFS.

## Run

To use the repository's network-disabled Docker service:

```sh
docker compose run --build --rm -T check node tools/bfs-certificate.mjs docs/examples/bfs-certificate-valid.json
```

Or use Node 22 with the repository dependencies installed:

```sh
node tools/bfs-certificate.mjs docs/examples/bfs-certificate-valid.json
node tools/bfs-certificate.mjs docs/examples/bfs-certificate-too-short.json
```

Use `-` in place of a filename to read stdin. Input is UTF-8 JSON without a
BOM, at most 64 KiB. The request schema is `truth-harness.bfs-certificate.v0`:

- `vertex_count`: 1 to 4,096 vertices, numbered from zero.
- `source`: one of those vertices.
- `edges`: up to 8,192 pairs of existing vertex IDs, from vertex then to vertex.
  Duplicate edges and self-loops are allowed. Weights are not supported.
- `labels`: one entry per vertex, in vertex order. A nonnegative safe
  integer claims an exact distance. `null` claims the vertex is unreachable.

Numeric fields must use canonical nonnegative integer literals, not decimals
or exponents. Repeated JSON members and unknown fields are rejected.

## Conditions And Exit Codes

The checker tests, in order:

1. `source_zero`: the source label is zero.
2. `zero_is_source`: no other vertex has label zero.
3. `edge_bound`: each edge from a labeled vertex goes to a labeled vertex
   whose label is at most one greater. A failure names the zero-based
   `edge_index`, the endpoints and their labels.
4. `predecessor`: every positive label has an incoming edge from a vertex
   with label exactly one less. A failure names the vertex and expected label.

Output is JSON with schema `truth-harness.bfs-certificate-report.v0`:

| Status | Exit | Meaning |
| --- | ---: | --- |
| `accepted` | 0 | All four conditions passed. Includes the reachable-label and unreachable-label counts. |
| `rejected` | 1 | A well-formed input failed a certificate condition. Includes the first deterministic `failure`. |
| `invalid` | 2 | Usage, input, encoding, or I/O error. No certificate verdict. |

Acceptances and rejections include the SHA-256 of the exact request bytes,
source ID, and vertex and edge counts. The `proof_checker_backed` field is
always false. This checks the certificate conditions in JavaScript. It does
not invoke Lean or certify the checker or the BFS implementation itself.
This report is not admitted by the general proof gate.

## Lean Soundness Theorem

The [statement](examples/lean-bfs-check/Challenge.lean) and
[proof](examples/lean-bfs-check/Solution.lean) formalize what the four
conditions imply. For a directed unit-edge graph with a distinguished source,
a natural-number label `n` certifies a walk of length `n` and rules out every
shorter walk. A missing label rules out all walks from the source. The empty
walk has length zero; each extension follows a directed edge and adds one.

The proof follows predecessor edges to construct the claimed walk by induction
on the label. In the other direction, induction along any walk uses `source_zero`
and `edge_bound` to show the endpoint must have a label bounded by the walk's
length. These arguments cover all four hypotheses, not just the producer fixture.

Replay the theorem and its negative controls in the existing pinned Lean image:

```sh
docker build --platform linux/amd64 -f tools/lean-prefix-check.Dockerfile -t truth-harness:lean-bfs-soundness .
docker run --pull=never --rm --init --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 64 --memory 1g --memory-swap 1g --tmpfs /tmp:rw,nosuid,nodev,size=128m truth-harness:lean-bfs-soundness --bfs --self-test
```

The [fixed-fixture checking setup](LEAN_PROOF_LANE.md#independent-checker-pilot)
checks the reference statement, permits only Lean's standard axioms, and
requires both Lean and NanoDa to accept. The two controls require rejection
of a theorem with the same name but a different type, and of the reference
statement without a proof. The network-disabled run emits a standalone
`truth-harness.lean-bfs-check.v0` receipt that binds the statement, walk model,
proof, and checker configuration by SHA-256. Image provisioning can require a
download; no Mathlib or external Lake packages are required.

This is a theorem about the mathematical certificate conditions. It does not
establish that the JavaScript checker or JSON parser implements the model, or
that the Python producer is correct on all inputs. Weighted edges are outside
the theorem. The runtime certificate report remains non-kernel-backed, and the
theorem receipt cannot close unrelated proof gates.

## Independent Producer Gate

The [producer test](../tools/bfs-producer-gate.test.js) runs as part of
`npm run check`. It starts a separate, standard-library
[Python BFS program](../fixtures/bfs/produce_labels.py) on a fixed directed
graph, then passes the program's stdout bytes unchanged to the Node checker.
The test requires exact acceptance and rejects deliberately shortened,
lengthened, and missing labels with the expected certificate failures.
It also distinguishes an invalid producer payload from a bad distance
claim. The Python program is a reference fixture, not an input adapter or
a formally verified BFS implementation.

Run only that test in the network-disabled Docker service:

```sh
docker compose run --build --rm -T check npm test -- tools/bfs-producer-gate.test.js
```

For another producer, check its exit status before passing the emitted
certificate JSON to the checker. Fail the job if the checker does not exit
0. A passing certificate check concerns the supplied graph and labels,
not the producer's correctness on other inputs.

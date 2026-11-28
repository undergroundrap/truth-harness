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

# Pair Comparison Count Through MCP

## Problem And Model

How many pair comparisons are made when each newly arriving item is compared
once with every earlier item? This occurs in exhaustive duplicate checking or
incremental construction of all unordered pairs. Consider this mathematical model:

```text
for k = 1 through n:
    for j = 1 through k-1:
        compare(item[j], item[k])
```

Assume `n` is a nonnegative integer, inclusive upper bounds, no early exits,
one counted comparison per inner iteration, and mathematical integers without
overflow. The inner loop has exactly `k-1` iterations, so the total is the sum
of `k-1` from `k=1` through `n`. The empty sum at `n=0` is zero.

Candidate: `C(n) = n(n-1)/2`. Deliberately false variant: `n(n+1)/2`, which
counts a self-comparison at each arrival. Its first failure is `n=1`: one claimed
comparison versus zero actual comparisons in the mathematical model.

The loop-to-sum reduction above is a human-readable mathematical argument,
not a compiler-extracted or formally verified source-code translation.

## What The Workflow Does

`tools/cs-pairs-mcp.mjs` launches the normal MCP server as a separate stdio
process inside the existing offline Docker container. It discovers the tools,
queries capabilities, submits each structured summation request, and replays
both saved receipts through MCP. The mathematical operations go through the same
shared adapter and independent checker available to other clients.

The correct formula must return `identity-checked`, `exact-computed`, and
`proof_checker_backed: false`. The false variant must return a checked refutation
at `n=1` with the expected values and MCP `isError: true`. Missing tools, unknown,
malformed outputs, wrong domains, or unrelated errors cannot pass the workflow.

A small independent nested-loop enumeration for `n=0..16` is also recorded.
It is explicitly bounded evidence, not the justification for all `n`. The
universal summation check uses `S(0)=0` and every coefficient of the recurrence.

## Run And Replay

```sh
docker compose run --build --rm -T pit-experiment node tools/cs-pairs-mcp.mjs
docker compose run --rm -T pit-experiment node tools/cs-pairs-mcp.mjs --replay .truth-harness/experiments/cs-pairs-mcp-EXAMPLE
```

Replace `EXAMPLE` with the returned directory suffix. The initial run saves
`PROBLEM.md`, dated `PROGRESS.md`, both original requests and receipts,
`transcript.json`, and `report.json` under `.truth-harness/experiments/`.
Copies make the experiment independent of subsequent witness-directory cleanup.
Requests are checked against this fixed problem before replay. Replay ignores
the saved summary, starts a new server, recomputes both checks, and writes no
new artifacts. Tampered or missing requests/receipts fail closed. Historical
Markdown is documentation, not trusted mathematical input.

Exit 0 means this fixed workflow passed. Exit 2 means it did not establish the
required outcomes. The deliberate mathematical refutation is a required success
case for this workflow, not an overall failure. Timestamps and directory names
vary; the mathematical requests and receipts are deterministic.

This is a known computer-science counting problem and a scripted MCP integration
example. It is not a newly solved open problem, an autonomous LLM discovery run,
a Lean proof, a benchmark of real program speed, or proof of runtime safety.
No external accounts, network, cloud, new solver, Hum, or VIRE are involved.

See [agent workflow](POLYNOMIAL_AGENT_WORKFLOW.md) and
[summation contract](POLYNOMIAL_SUMMATION.md) for deployment and trust boundaries.

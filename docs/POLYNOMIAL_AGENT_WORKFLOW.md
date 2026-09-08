# Polynomial CLI And MCP Workflow

The normal CLI and MCP surfaces now expose the existing structured polynomial
comparison and summation tools. They do not add new mathematics or change either
request/receipt contract. They reuse the same producer and independent checker,
persist the same evidence, and never promote results to `proved`.

## Deployment Boundary

V0 requires the repository's Docker source-checkout image, including `tools/`,
Python and SymPy. It is not a standalone npm-package installation. Capability
discovery works on the host without executing any mathematics. It reports
`unavailable` when tool assets or the container marker are absent; `configured`
means assets and marker exist, not that dependencies have passed a health check.
Missing Python/SymPy or subprocess failures remain unresolved execution errors.

Use the existing `pit-experiment` service: network disabled, non-root, and no
Docker socket mounted. The adapter does not start Docker or download anything.
`TRUTH_HARNESS_CONTAINER=1` is a deployment guard, not proof of OS isolation.
Do not set it on a host as a substitute for running in the container.

Artifacts stay in the source checkout's `.truth-harness/witnesses`, not a custom
MCP workspace's store. Use the checkout as the MCP workspace for this V0 lane.
MCP replay rejects paths outside its workspace, including symlink escapes.
No cloud access or telemetry is added. Image builds may fetch dependencies.

## CLI

```sh
docker compose run --build --rm -T pit-experiment node apps/cli/dist/index.js polynomial capabilities --json
docker compose run --rm -T pit-experiment node apps/cli/dist/index.js polynomial compare docs/examples/polynomial-equivalent.json --json
docker compose run --rm -T pit-experiment node apps/cli/dist/index.js polynomial sum docs/examples/polynomial-sum-squares.json --json
```

Use `-` instead of the input path for UTF-8 JSON stdin. Without `--json`, the CLI
prints a short status, counterexample if present, and evidence directory.
To replay, substitute the directory from the report for `EXAMPLE`:

```sh
docker compose run --rm -T pit-experiment node apps/cli/dist/index.js polynomial replay sum .truth-harness/witnesses/polynomial-sum-EXAMPLE/request.json .truth-harness/witnesses/polynomial-sum-EXAMPLE/receipt.json --json
```

Replay takes `compare` or `sum` and two file paths, writes no artifacts, and
recomputes against the original request. A receipt is not accepted merely because
it parses or its hashes look plausible. JSON output is the existing tool report,
not a new wrapper schema. Errors detected before tool execution return at least
`status: unverified`, `checked: false`, and an error message.

Exit codes remain **0 accepted**, **1 refuted**, **2 invalid/tool/I/O failure**,
**3 unknown**. A zero exit means `equivalent` for compare or `identity-checked`
for sum, with `exact-computed` trust and `proof_checker_backed: false`.

## MCP

Run the standard MCP server inside the same service:

```sh
docker compose run --rm -T pit-experiment node packages/mcp-server/dist/index.js
```

- `truth_harness_polynomial_capabilities`: no arguments; discover contracts,
  bounds, deployment status, evidence store, and lack of formal proof support.
- `truth_harness_polynomial_check`: `operation` (`compare` or `sum`) plus
  `requestJson` containing the original request JSON as a string. No expression
  parsing, arbitrary executable option, or shell command is accepted.
- `truth_harness_polynomial_replay`: `operation`, `requestPath`, `receiptPath`.
  Both files must be inside the current MCP workspace, including after realpath
  resolution. They must refer to the original request and saved receipt.

MCP preserves the report and sets `isError: true` for all nonzero outcomes,
including a valid refutation. This signals that the caller's identity gate must
not pass; it does not discard the useful counterexample. Unknown is not proof.
Request byte limits remain 65,536 even when string character counts are smaller.
The shared core API is `polynomialCapabilities()` and `runPolynomialTool()`;
the latter returns `{ exit_code, report }`. It launches only a fixed allowlisted
script without a shell, limits captured output, and bounds process runtime.

## Scope

See [comparison](POLYNOMIAL_EQUIVALENCE.md) and [summation](POLYNOMIAL_SUMMATION.md)
for exact schemas, budgets, domains, and trust boundaries. This adapter does not
yet register automatic natural-language routing, workspace run-next actions,
or graph ledger promotion. Agents choose an operation, provide structured input,
inspect the result, and cite/replay its artifacts explicitly.

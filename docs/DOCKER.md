# Docker-First Workflow

Theorem Workbench should be run from Docker by default when you are testing agent-facing code, proof gates, symbolic adapters, or MCP workflows. Docker keeps Node, Python, SymPy, and npm dependencies out of the host environment and makes the public credibility path easier to replay.

Docker is still not magic security. The Docker daemon is powerful, and a dev container with the repository bind-mounted can change files in that repository. Treat Docker as the baseline isolation layer, then use Theorem Workbench receipts, measured sandbox status, and replayable evidence for stronger claims.

## Highest-Safety Verification

Start Docker Desktop first and make sure the Linux engine is running.

This builds a verification image from the committed source without bind-mounting the repo into the running checks. It runs the TypeScript build, test suite, and launch proof gate inside the image build.

```bash
docker build --target verify -t theorem-workbench:verify .
```

Use this before demos or before asking another agent to trust the local tree. It still downloads npm and Python dependencies during the image build.

## Day-To-Day Container Commands

Build the reusable dev image:

```bash
docker compose build
```

Run the normal verification gate with no runtime network:

```bash
docker compose run --rm theorem npm run check
```

Run the public launch proof suite with no runtime network:

```bash
docker compose run --rm theorem npm run proof:launch
```

Run CLI commands:

```bash
docker compose run --rm theorem npm run cli -- workspace init --name "Local Math Lab"
docker compose run --rm theorem npm run cli -- ask "symbolic simplify sin(x)^2 + cos(x)^2"
docker compose run --rm theorem npm run cli -- code sandbox-status --json
```

Run the local web workbench:

```bash
docker compose up web
```

Then open `http://127.0.0.1:4180`. The web service publishes only to localhost. The browser calls localhost `/api/receipt` and `/api/claims` endpoints backed by `@theorem-workbench/core`; it does not call a hosted model or external service. The web server also rejects non-local Host headers by default and accepts browser API writes only from the same origin.

Run the MCP server over stdio:

```bash
docker compose run --rm -i mcp
```

By default, MCP `theorem_code_run` is still disabled. To expose it to an agent, the MCP process must have `THEOREM_ALLOW_CODE_RUN=1`. Unsandboxed direct execution needs the additional `THEOREM_ALLOW_UNSANDBOXED_CODE_RUN=1` escape hatch; otherwise agents should set `policy.requireSandbox: true`. In the CLI/MCP Docker no-network services, `policy.requireSandbox: true` can pass only when `theorem_code_sandbox_status` measures the Theorem container marker, a container runtime marker, loopback-only networking, and no default route.

## What Is Isolated

- The dev image runs as an unprivileged `theorem` user.
- CLI and MCP compose services use `network_mode: "none"` so normal CLI, MCP, test, and proof runs cannot reach the network from inside the container.
- Compose drops Linux capabilities, sets `no-new-privileges:true`, and caps process count for each service.
- `theorem code sandbox-status --json` can record the CLI/MCP no-network services as a measured `container` provider when the runtime has only loopback networking and no default route.
- The web compose service publishes `127.0.0.1:4180` for the browser and is not a code sandbox. Its local API currently creates receipts and claim-ledger records through `@theorem-workbench/core` without hosted model calls.
- Node dependencies live in the `theorem_node_modules` Docker volume.
- npm cache lives in the `theorem_npm_cache` Docker volume.
- Python and `sympy==1.14.0` are installed inside the image.

## What Is Not Isolated

- The compose dev services bind-mount the repository at `/workspace`, so commands can read and write project files, generated `dist/` outputs, receipts, and the local `.theorem-workbench/` store.
- The measured Docker provider attests the current container network namespace, not mathematical truth, code correctness, medical/scientific validity, or safety.
- Loopback remains available inside the container. The measurement means no non-loopback interface/default route was observed.
- Docker does not make AI-generated code safe. Keep executable allowlists narrow, prefer `--require-sandbox` for risky workflows, and review any command before running it.

## Reset Container State

Remove dev volumes if dependencies get stale:

```bash
docker compose down -v
```

Then rebuild:

```bash
docker compose build
```

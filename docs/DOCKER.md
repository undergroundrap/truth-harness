# Docker-First Workflow

Theorem Workbench should be run from Docker by default when you are testing agent-facing code, proof gates, symbolic adapters, or MCP workflows. Docker keeps Node, Python, SymPy, Z3, and npm dependencies out of the host environment and makes the public credibility path easier to replay.

Docker is still not magic security. The Docker daemon is powerful, and a dev container with the repository bind-mounted can change files in that repository. Treat Docker as the baseline isolation layer, then use Theorem Workbench receipts, measured sandbox status, and replayable evidence for stronger claims.

## Highest-Safety Verification

Start Docker Desktop first and make sure the Linux engine is running.

This builds a verification image from the committed source without bind-mounting the repo into the running checks. It runs the TypeScript build, test suite, launch proof gate, and a concrete Z3 SMT-LIB check inside the image build.

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

Run the public launch proof suite plus the engine-backed SMT gate with no runtime network:

```bash
docker compose run --rm theorem npm run proof:launch:engines
```

The engine-backed gate runs the standard launch suite first, then checks `docs/examples/constraints.smt2` with `--fail-on-unverified`. If Z3 is missing, returns `unknown`, or fails to produce a concrete `sat`/`unsat` result, the command exits non-zero instead of printing a comforting but unsupported success.

Run CLI commands:

```bash
docker compose run --rm theorem npm run cli -- workspace init --name "Local Math Lab"
docker compose run --rm theorem npm run cli -- ask "symbolic simplify sin(x)^2 + cos(x)^2"
docker compose run --rm theorem npm run cli -- cas backends
docker compose run --rm theorem npm run cli -- cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write
docker compose run --rm theorem npm run cli -- smt backends
docker compose run --rm theorem npm run cli -- proof backends
docker compose run --rm theorem npm run cli -- code sandbox-status --json
```

Run the local web workbench:

```bash
docker compose up web
```

Then open `http://127.0.0.1:4180`. The web service publishes only to localhost. The browser calls localhost `/api/receipt` and `/api/claims` endpoints backed by `@theorem-workbench/core`; it does not call a hosted model or external service. The web server also rejects non-local Host headers by default and accepts browser API writes only from the same origin.

The web inspector's Engine Readiness panel reads `/api/status` and should report Z3 as available in the standard container image after `docker compose build`. Maxima and Lean are not bundled by default because those lanes need validated engine builds and, for proof work, a pinned Lean/Mathlib environment; set `THEOREM_MAXIMA` or `THEOREM_LEAN` or build a derived image once that project layout is chosen.

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
- Python, `sympy==1.14.0`, and Z3 are installed inside the image.
- `THEOREM_Z3=z3` is set for compose services so local SMT probes use the containerized solver.

## What Is Not Isolated

- The compose dev services bind-mount the repository at `/workspace`, so commands can read and write project files, generated `dist/` outputs, receipts, and the local `.theorem-workbench/` store.
- The measured Docker provider attests the current container network namespace, not mathematical truth, code correctness, medical/scientific validity, or safety.
- Loopback remains available inside the container. The measurement means no non-loopback interface/default route was observed.
- Docker does not make AI-generated code safe. Keep executable allowlists narrow, prefer `--require-sandbox` for risky workflows, and review any command before running it.
- Z3 availability probes are not evidence by themselves. `smt-checked` still requires a concrete Z3 `sat` or `unsat` solver run over the recorded artifact. Maxima remains a supported optional CAS backend, but `cross-checked` still requires a concrete Maxima agreement run from a validated local `THEOREM_MAXIMA` command.

## Reset Container State

Remove dev volumes if dependencies get stale:

```bash
docker compose down -v
```

Then rebuild:

```bash
docker compose build
```

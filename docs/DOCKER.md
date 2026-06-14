# Docker-First Workflow

Truth Harness should be run from Docker by default when you are testing agent-facing code, proof gates, symbolic adapters, or MCP workflows. Docker keeps Node, Python, SymPy, Maxima, Z3, and npm dependencies out of the host environment and makes the public credibility path easier to replay.

Docker is still not magic security. The Docker daemon is powerful, and a dev container with the repository bind-mounted can change files in that repository. Treat Docker as the baseline isolation layer, then use Truth Harness receipts, measured sandbox status, and replayable evidence for stronger claims.

## Highest-Safety Verification

Start Docker Desktop first and make sure the Linux engine is running.

This builds a verification image from the committed source without bind-mounting the repo into the running checks. It runs the TypeScript build, test suite, launch proof gate, a concrete Maxima CAS agreement check, and a concrete Z3 SMT-LIB check inside the image build.

```bash
docker build --target verify -t truth-harness:verify .
```

Use this before demos or before asking another agent to trust the local tree. It still downloads npm and Python dependencies during the image build.

## Day-To-Day Container Commands

Build the reusable dev image:

```bash
docker compose build
```

Run the normal verification gate with no runtime network:

```bash
docker compose run --rm truth-harness npm run check
```

Run the public launch proof suite plus the engine-backed CAS and SMT gates with no runtime network:

```bash
docker compose run --rm truth-harness npm run proof:launch:engines
```

The engine-backed gate runs the standard launch suite first, then requires Maxima to independently agree that `sin(x)^2 + cos(x)^2` simplifies to `1`, and checks `docs/examples/constraints.smt2` with `--fail-on-unverified`. If Maxima is missing or disagrees, or if Z3 is missing, returns `unknown`, or fails to produce a concrete `sat`/`unsat` result, the command exits non-zero instead of printing a comforting but unsupported success.

Run the pinned Lean proof fixture in the separate Lean image:

```bash
docker compose build lean-proof
docker compose run --rm lean-proof
```

The `lean-proof` target installs Lean through elan during image build, pins the default toolchain to `leanprover/lean4:v4.12.0`, and runs `npm run proof:lean-fixture`. The compose service then checks the fixture again with `network_mode: "none"`. This is intentionally separate from the default dev image so proof-lane dependencies do not become silent bloat.

Run CLI commands:

```bash
docker compose run --rm truth-harness npm run cli -- workspace init --name "Local Math Lab"
docker compose run --rm truth-harness npm run cli -- ask "symbolic simplify sin(x)^2 + cos(x)^2"
docker compose run --rm truth-harness npm run cli -- cas backends
docker compose run --rm truth-harness npm run cli -- cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write
docker compose run --rm truth-harness npm run cli -- smt backends
docker compose run --rm truth-harness npm run cli -- proof backends
docker compose run --rm truth-harness npm run cli -- proof project .
docker compose run --rm truth-harness npm run cli -- code sandbox-status --json
```

Run the local web workbench:

```bash
docker compose up web
```

Then open `http://127.0.0.1:4180`. The web service publishes only to localhost. The browser calls localhost `/api/receipt` and `/api/claims` endpoints backed by `@truth-harness/core`; it does not call a hosted model or external service. The web server also rejects non-local Host headers by default and accepts browser API writes only from the same origin.

The web inspector's Engine Readiness panel reads `/api/status` and should report Maxima and Z3 as available in the standard container image after `docker compose build`. The image uses Debian's ECL-backed `maxima-sage` package instead of the default GCL-backed `maxima` binary because the GCL binary crashes under Docker's default seccomp profile. Lean is not bundled by default because proof work needs a pinned Lean/Mathlib environment; use `truth-harness proof project <path>` to inspect that local layout without executing Lean, run `docker compose run --rm lean-proof` for the pinned fixture, then set `TRUTH_HARNESS_LEAN` or build a derived image once a real project layout is chosen.

## Web UI Safe Verifier Path

The Checks tab includes a Safe Verifier Path card for machines that do not have local Maxima, Z3, or Lean installed. It does not run Docker automatically. It gives humans and agents copyable commands for the safe path:

```bash
npm run docker:proof
npm run docker:verify
```

Use `npm run docker:proof` for the day-to-day no-runtime-network engine suite after the dev image exists. Use `npm run docker:verify` before demos or review checkpoints when you want the full image build and verification target. Image builds may download dependencies; verifier runs inside the `truth-harness` compose service use the no-network runtime boundary described below.

The UI card is guidance, not evidence. Claims still need concrete receipts: `cross-checked` requires an accepted independent CAS record, `smt-checked` requires a concrete Z3 solver record, and `proved` requires an accepted proof-checker record.

Agents can also read the same guidance from local `GET /api/status` under `dockerVerifier`. That status packet is local-only metadata and does not launch Docker or mint evidence.

Run the MCP server over stdio:

```bash
docker compose run --rm -i mcp
```

By default, MCP `truth_harness_code_run` is still disabled. To expose it to an agent, the MCP process must have `TRUTH_HARNESS_ALLOW_CODE_RUN=1`. Unsandboxed direct execution needs the additional `TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN=1` escape hatch; otherwise agents should set `policy.requireSandbox: true`. In the CLI/MCP Docker no-network services, `policy.requireSandbox: true` can pass only when `truth_harness_code_sandbox_status` measures the Truth Harness container marker, a container runtime marker, loopback-only networking, and no default route.

## What Is Isolated

- The dev image runs as an unprivileged `truth` user.
- CLI and MCP compose services use `network_mode: "none"` so normal CLI, MCP, test, and proof runs cannot reach the network from inside the container.
- Compose drops Linux capabilities, sets `no-new-privileges:true`, and caps process count for each service.
- `truth-harness code sandbox-status --json` can record the CLI/MCP no-network services as a measured `container` provider when the runtime has only loopback networking and no default route.
- The web compose service publishes `127.0.0.1:4180` for the browser and is not a code sandbox. Its local API currently creates receipts and claim-ledger records through `@truth-harness/core` without hosted model calls.
- Node dependencies live in the `truth_harness_node_modules` Docker volume.
- npm cache lives in the `truth_harness_npm_cache` Docker volume.
- Python, `sympy==1.14.0`, Maxima through `maxima-sage`, and Z3 are installed inside the image.
- `TRUTH_HARNESS_MAXIMA=maxima-sage` and `TRUTH_HARNESS_Z3=z3` are set for compose services so local CAS and SMT probes use the containerized solvers.

## What Is Not Isolated

- The compose dev services bind-mount the repository at `/workspace`, so commands can read and write project files, generated `dist/` outputs, receipts, and the local `.truth-harness/` store.
- The measured Docker provider attests the current container network namespace, not mathematical truth, code correctness, medical/scientific validity, or safety.
- Loopback remains available inside the container. The measurement means no non-loopback interface/default route was observed.
- Docker does not make AI-generated code safe. Keep executable allowlists narrow, prefer `--require-sandbox` for risky workflows, and review any command before running it.
- Maxima and Z3 availability probes are not evidence by themselves. `cross-checked` still requires a concrete Maxima agreement run over the recorded expression/result pair, and `smt-checked` still requires a concrete Z3 `sat` or `unsat` solver run over the recorded artifact.

## Reset Container State

Remove dev volumes if dependencies get stale:

```bash
docker compose down -v
```

Then rebuild:

```bash
docker compose build
```

# Security Baseline

Theorem Workbench is local-first, not magic. Treat the app as a verification and provenance layer that helps humans and agents avoid unsupported claims; do not treat it as a sandbox for arbitrary untrusted code unless the runtime measures an actual sandbox boundary.

## Safe Default

- Run the web UI on localhost only.
- Keep MCP `theorem_code_run` disabled unless you explicitly need it.
- Prefer Docker for agent-facing work, demos, proof gates, and any workflow that may execute code.
- Prefer `policy.requireSandbox: true` or CLI `--require-sandbox` for agent-triggered execution.
- Never claim `networkAccess: none` unless the code-run record measured the Docker no-network provider.

## Web UI Boundary

The local web server sends a restrictive Content Security Policy, denies framing, disables high-risk browser permissions, and rejects non-local Host headers by default. Browser writes to `/api/*` are accepted only from the same origin, which prevents unrelated web pages from driving the local API through the user's browser.

Local API JSON bodies are capped at 16 KiB. Malformed, oversized, rejected, or unknown API requests return no-store `theorem.web-error.v0` JSON envelopes with `localOnly: true`, `externalCalls: []`, the HTTP status, and a clear error string instead of generic server text.

Set `THEOREM_WEB_ALLOW_NONLOCAL=1` only for deliberate LAN or remote testing. Do not expose that mode to untrusted networks.

The regression suite covers this boundary with a local server test that verifies:

- static web responses include the restrictive browser security headers,
- non-local API `Host` headers are rejected,
- cross-origin browser writes are rejected,
- malformed and oversized API JSON bodies fail closed with explicit JSON errors,
- same-origin browser writes still work.

Run the focused guard test with:

```bash
npm test -- apps/web/src/serve-web.test.ts
```

## Code Execution Boundary

Native host code execution is a degraded mode. It can capture a direct process run with allowlists, timeouts, output caps, and receipt metadata, but it cannot enforce a network namespace or filesystem sandbox. Native code-run records must use `networkAccess: unknown`.

The Docker no-network CLI and MCP services are the current measured sandbox profile. They can attest `networkAccess: none` only when the runtime measures:

- the Theorem container marker,
- a Docker/container runtime marker,
- loopback-only networking,
- no IPv4 or IPv6 default route.

Docker still bind-mounts the repo for day-to-day development, so containerized commands can change workspace files. Use the Docker `verify` target when you need a clean verification image without a runtime repo bind mount.

## Not Security Claims

The workbench does not prove that code is correct, deterministic, medically safe, scientifically valid, patentable, regulatory-approved, or free of malicious intent. It records evidence, boundaries, checks, and gaps so humans and agents can review them without hallucinated certainty.

## Reporting Issues

Until the project has a public security contact, file a private security advisory in the GitHub repository after it is published.

Please include:

- Steps to reproduce.
- A minimal input or receipt.
- Expected vs actual behavior.
- Whether the issue involves path access, command execution, prompt injection, browser-localhost access, or trust-label escalation.

## High-Risk Bugs

These should be treated as security issues:

- A path traversal that escapes the workspace root.
- A way for an MCP tool to execute arbitrary commands without the documented opt-in gates.
- A trust-label escalation, especially `unverified` to `proved`.
- A code-run receipt that claims `networkAccess: none` without measured sandbox evidence.
- A cross-origin browser path that can drive local API writes.
- A receipt replay mismatch that still reports pass.
- Prompt-injection text causing hidden tool behavior.

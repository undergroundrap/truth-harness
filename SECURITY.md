# Security Policy

Theorem Workbench is an agent-facing verification tool. Treat tool boundaries as part of the product.

## Current Posture

- The MCP server is local stdio only.
- MCP file inputs are restricted to the workspace root.
- MCP write tools create explicit workspace-local evidence artifacts.
- CLI receipt output writes only to user-specified paths.
- Network-backed adapters are not enabled in the MVP.
- The SymPy adapter runs as a bounded local Python subprocess and accepts only a restricted symbolic expression grammar.
- Docker is the recommended default runtime for local verification, CLI, and MCP use. Compose services run without runtime network access, but bind-mounted dev containers can still modify files in the repository.
- Code-run records do not yet have an accepted OS sandbox provider. Until that exists, they must report `networkAccess: unknown` and fail closed when sandboxed execution is required.

## Reporting Issues

Until the project has a public security contact, file a private security advisory in the GitHub repository after it is published.

Please include:

- Steps to reproduce.
- A minimal input or receipt.
- Expected vs actual behavior.
- Whether the issue involves path access, command execution, prompt injection, or trust-label escalation.

## High-Risk Bugs

These should be treated as security issues:

- A path traversal that escapes the workspace root.
- A way for an MCP tool to execute arbitrary commands.
- A trust-label escalation, especially `unverified` to `proved`.
- A code-run receipt that claims `networkAccess: none` without measured sandbox evidence.
- A receipt replay mismatch that still reports pass.
- Prompt-injection text causing hidden tool behavior.

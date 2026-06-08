# Security Policy

Theorem Workbench is an agent-facing verification tool. Treat tool boundaries as part of the product.

## Current Posture

- The MCP server is local stdio only.
- MCP file inputs are restricted to the workspace root.
- The MCP server does not write files.
- CLI receipt output writes only to user-specified paths.
- Network-backed adapters are not enabled in the MVP.
- The SymPy adapter runs as a bounded local Python subprocess and accepts only a restricted symbolic expression grammar.

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
- A receipt replay mismatch that still reports pass.
- Prompt-injection text causing hidden tool behavior.

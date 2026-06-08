# Agent Setup

Date: 2026-06-08

Theorem Workbench exposes a local stdio MCP server so Claude, Codex, and other MCP clients can ask for proof receipts and benchmark runs.

## Build First

```bash
npm install
npm run build
```

The server entrypoint is:

```bash
node packages/mcp-server/dist/index.js
```

## Tools

| Tool | Purpose |
| --- | --- |
| `theorem_ask` | Create a receipt for a math prompt, with optional strict mode. |
| `theorem_benchmark_run` | Run the seed benchmark suite or a workspace-local suite path. |
| `theorem_replay` | Replay a receipt from JSON or a workspace-local receipt path. |

Strict mode is useful when an agent must not proceed from unverified claims. If `theorem_ask` returns `unverified` and `strict` is true, the MCP tool response is marked as an error.

## Claude Code

This repo includes a project-scoped [.mcp.json](../.mcp.json). Claude Code supports project-scoped MCP configurations and asks for approval before using them.

From the repo root:

```bash
claude
/mcp
```

Approve `theorem-workbench`, then ask:

> Use theorem_ask to check whether "for all integers n, n^2+n+1 is even" is true.

You can also add it manually:

```bash
claude mcp add --transport stdio theorem-workbench -- node packages/mcp-server/dist/index.js
claude mcp list
```

## Codex

OpenAI's Codex MCP docs say Codex supports stdio MCP servers in the CLI and IDE extension, with configuration stored in `config.toml`.

Using the CLI from the repo root:

```bash
codex mcp add theorem-workbench -- node packages/mcp-server/dist/index.js
codex mcp list
```

Or add a project-scoped `.codex/config.toml` in trusted projects:

```toml
[mcp_servers.theorem-workbench]
command = "node"
args = ["packages/mcp-server/dist/index.js"]
cwd = "."
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "prompt"
```

Suggested `AGENTS.md` instruction:

```text
When doing math, proof, physics, simulation, or benchmark work, use Theorem Workbench MCP tools to create receipts. Treat unverified receipts as unresolved, not proved.
```

## Security Notes

- The MCP server is local stdio only.
- Benchmark and receipt file paths are restricted to the workspace root.
- The current tools are read-only except writing receipts through the CLI; the MCP server does not write files.
- Do not expose this stdio command through an untrusted remote wrapper.

## Sources

- [Model Context Protocol TypeScript SDK](https://modelcontextprotocol.io/docs/develop/build-server)
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)
- [OpenAI Codex MCP docs](https://developers.openai.com/codex/mcp)

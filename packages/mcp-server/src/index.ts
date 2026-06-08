#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  handleTheoremAsk,
  handleTheoremBenchmarkRun,
  handleTheoremReplay,
  toolJson
} from "./tools.js";

export function createTheoremMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "theorem-workbench",
      version: "0.0.0"
    },
    {
      instructions:
        "Use Theorem Workbench to create replayable proof receipts. Do not treat unverified outputs as proved."
    }
  );

  server.registerTool(
    "theorem_ask",
    {
      title: "Create Theorem Receipt",
      description:
        "Create a proof receipt for a math prompt with trust labels, evidence graph nodes, artifacts, and replay command.",
      inputSchema: {
        problem: z.string().min(1).describe("Math prompt or claim to check."),
        strict: z
          .boolean()
          .optional()
          .describe("When true, return an MCP tool error if the final trust label is unverified.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ problem, strict }) => {
      const result = handleTheoremAsk({ problem, strict });
      return toolJson(result, { isError: result.error });
    }
  );

  server.registerTool(
    "theorem_benchmark_run",
    {
      title: "Run Theorem Benchmark",
      description:
        "Run a benchmark suite JSON file and return trust accuracy plus per-task receipt summaries.",
      inputSchema: {
        suitePath: z
          .string()
          .optional()
          .describe("Path under the current workspace. Defaults to packages/benchmarks/suites/foundations-seed.json.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ suitePath }) => toolJson(await handleTheoremBenchmarkRun({ suitePath }))
  );

  server.registerTool(
    "theorem_replay",
    {
      title: "Replay Theorem Receipt",
      description:
        "Replay a saved receipt by JSON string or workspace-local path and report trust-critical differences.",
      inputSchema: {
        receiptJson: z.string().optional().describe("Receipt JSON content to replay."),
        receiptPath: z.string().optional().describe("Receipt JSON path under the current workspace to replay.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      }
    },
    async ({ receiptJson, receiptPath }) => toolJson(await handleTheoremReplay({ receiptJson, receiptPath }))
  );

  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = createTheoremMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  await startStdioServer();
}

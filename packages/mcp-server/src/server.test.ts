import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createTheoremMcpServer } from "./index.js";

describe("Theorem MCP server", () => {
  it("lists and calls theorem tools over MCP", async () => {
    const server = createTheoremMcpServer();
    const client = new Client({ name: "theorem-workbench-test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "theorem_ask",
        "theorem_benchmark_run",
        "theorem_replay"
      ]);

      const result = await client.callTool({
        name: "theorem_ask",
        arguments: {
          problem: "for all integers n, n^2+n+1 is even"
        }
      });

      expect(result.isError).toBe(false);
      const content = Array.isArray(result.content) ? result.content : [];
      const first = content[0];
      const text =
        first && typeof first === "object" && "type" in first && first.type === "text" && "text" in first
          ? String(first.text)
          : "";
      expect(text).toContain("\"trust\": \"refuted\"");
    } finally {
      await client.close();
      await server.close();
    }
  });
});

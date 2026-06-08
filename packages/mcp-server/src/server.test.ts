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
        "theorem_render_receipt",
        "theorem_replay"
      ]);

      const result = await client.callTool({
        name: "theorem_ask",
        arguments: {
          problem: "for all integers n, n^2+n+1 is even"
        }
      });

      expect(result.isError).toBe(false);
      const text = firstText(result.content);
      expect(text).toContain("\"trust\": \"refuted\"");

      const renderResult = await client.callTool({
        name: "theorem_render_receipt",
        arguments: {
          receiptJson: JSON.stringify(JSON.parse(text).receipt),
          format: "markdown"
        }
      });
      const renderedText = firstText(renderResult.content);
      expect(renderedText).toContain("# Theorem Receipt");
      expect(renderedText).toContain("refuted");
    } finally {
      await client.close();
      await server.close();
    }
  });
});

function firstText(content: unknown): string {
  const items = Array.isArray(content) ? content : [];
  const first = items[0];
  return first && typeof first === "object" && "type" in first && first.type === "text" && "text" in first
    ? String(first.text)
    : "";
}

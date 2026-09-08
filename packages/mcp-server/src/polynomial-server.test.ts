import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTruthHarnessMcpServer } from "./index.js";

afterEach(() => vi.unstubAllEnvs());
describe("polynomial MCP transport", () => {
  it("discovers, executes, and replays with conservative error signaling", async () => {
    vi.stubEnv("TRUTH_HARNESS_CONTAINER", "1");
    vi.stubEnv("TRUTH_HARNESS_ROOT", fileURLToPath(new URL("../../../", import.meta.url)));
    const server = createTruthHarnessMcpServer();
    const client = new Client({ name: "polynomial-test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const payload = (result: unknown) => JSON.parse((result as { content: { text: string }[] }).content[0].text);
    try {
      const listed = await client.listTools();
      expect(listed.tools.map(tool => tool.name)).toContain("truth_harness_polynomial_replay");
      const cap = await client.callTool({ name: "truth_harness_polynomial_capabilities", arguments: {} });
      expect(payload(cap).proof_checker_backed).toBe(false);
      for (const [operation, prefix, suffix, fails] of [
        ["compare", "polynomial", "equivalent", false],
        ["sum", "polynomial-sum", "linear", false],
        ["sum", "polynomial-sum", "refuted", true],
        ["sum", "polynomial-sum", "unknown", true],
        ["recurrence", "polynomial-recurrence", "squares", false],
        ["recurrence", "polynomial-recurrence", "refuted", true],
        ["recurrence", "polynomial-recurrence", "unknown", true],
        ["recurrence", "exponential-recurrence", "tree", false],
        ["recurrence", "exponential-recurrence", "refuted", true],
        ["recurrence", "exponential-recurrence", "unknown", true]
      ] as const) {
        const requestJson = await readFile(`docs/examples/${prefix}-${suffix}.json`, "utf8");
        const result = await client.callTool({ name: "truth_harness_polynomial_check", arguments: { operation, requestJson } });
        expect(Boolean(result.isError)).toBe(fails);
        const directory = payload(result).artifact_directory;
        const lookupRoot = await mkdtemp(join(tmpdir(), "mcp lookup "));
        try {
          const localDirectory = `.truth-harness/witnesses/${basename(directory)}`;
          await mkdir(join(lookupRoot, ".truth-harness/witnesses"), { recursive: true });
          await cp(directory, join(lookupRoot, localDirectory), { recursive: true });
          vi.stubEnv("TRUTH_HARNESS_ROOT", lookupRoot);
          const lookup = await client.callTool({ name: "truth_harness_polynomial_lookup", arguments: { requestSha256: payload(result).request_sha256 } });
          expect(Boolean(lookup.isError)).toBe(false);
          expect(payload(lookup)).toMatchObject({ checked: false, trust: "unverified", requires_replay: true });
          expect(payload(lookup).matches).toContainEqual({ request_path: `${localDirectory}/request.json`, receipt_path: `${localDirectory}/receipt.json`, receipt_sha256: payload(result).receipt_sha256 });
        } finally {
          vi.stubEnv("TRUTH_HARNESS_ROOT", fileURLToPath(new URL("../../../", import.meta.url)));
          await rm(lookupRoot, { recursive: true, force: true });
        }
        const replay = await client.callTool({ name: "truth_harness_polynomial_replay", arguments: { operation, requestPath: `${directory}/request.json`, receiptPath: `${directory}/receipt.json` } });
        expect(Boolean(replay.isError)).toBe(fails);
        expect(payload(replay).receipt_sha256).toBe(payload(result).receipt_sha256);
        if (operation === "sum" && suffix === "linear") {
          const raw = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
          raw.base_value = "99";
          await writeFile(`${directory}/tampered.json`, JSON.stringify(raw));
          const tampered = await client.callTool({ name: "truth_harness_polynomial_replay", arguments: { operation, requestPath: `${directory}/request.json`, receiptPath: `${directory}/tampered.json` } });
          expect(tampered.isError).toBe(true);
          expect(payload(tampered).checked).toBe(false);
        }
      }
      const outside = await client.callTool({ name: "truth_harness_polynomial_replay", arguments: { operation: "sum", requestPath: "../outside.json", receiptPath: "../outside.json" } });
      expect(outside.isError).toBe(true);
      vi.stubEnv("TRUTH_HARNESS_CONTAINER", "");
      const host = await client.callTool({ name: "truth_harness_polynomial_check", arguments: { operation: "sum", requestJson: "{}" } });
      expect(host.isError).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  }, 30000);
});

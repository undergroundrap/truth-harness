import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  handleTheoremAsk,
  handleTheoremBenchmarkRun,
  handleTheoremRenderReceipt,
  handleTheoremReplay,
  toolJson
} from "./tools.js";

const receiptPath = join("receipts", "mcp-test.json");

afterEach(async () => {
  // Keep generated receipts ignored by git; replay tests overwrite them when needed.
});

describe("MCP tool handlers", () => {
  it("creates proof receipts for agents", () => {
    const result = handleTheoremAsk({ problem: "for all integers n, n^2+n+1 is even" });

    expect(result.error).toBe(false);
    expect(result.receipt.trust).toBe("refuted");
    expect(result.message).toContain(result.receipt.runId);
  });

  it("marks strict unverified receipts as tool errors", () => {
    const result = handleTheoremAsk({ problem: "for all integers n, 2*(n/1) is even", strict: true });

    expect(result.error).toBe(true);
    expect(result.receipt.trust).toBe("unverified");
  });

  it("runs the launch benchmark suite", async () => {
    const run = await handleTheoremBenchmarkRun({});

    expect(run.total).toBe(25);
    expect(run.failed).toBe(0);
  });

  it("replays receipt JSON", async () => {
    const receipt = handleTheoremAsk({ problem: "compute 2 + 2" }).receipt;
    const replay = await handleTheoremReplay({ receiptJson: JSON.stringify(receipt) });

    expect(replay.passed).toBe(true);
    expect(replay.actualRunId).toBe(receipt.runId);
  });

  it("replays receipt files under the workspace", async () => {
    const receipt = handleTheoremAsk({ problem: "compute 3 / 4 + 5 / 8" }).receipt;
    await mkdir("receipts", { recursive: true });
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

    const replay = await handleTheoremReplay({ receiptPath });

    expect(replay.passed).toBe(true);
    expect(JSON.parse(await readFile(receiptPath, "utf8")).runId).toBe(receipt.runId);
  });

  it("renders receipts for agent reports", async () => {
    const receipt = handleTheoremAsk({ problem: "compute 2 + 2" }).receipt;
    const result = await handleTheoremRenderReceipt({
      receiptJson: JSON.stringify(receipt),
      format: "markdown"
    });

    expect(result.rendered).toContain(`# Theorem Receipt ${receipt.runId}`);
    expect(result.rendered).toContain("exact-computed");
  });

  it("returns MCP-compatible JSON content", () => {
    const result = toolJson({ ok: true });

    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("\"ok\": true");
  });
});

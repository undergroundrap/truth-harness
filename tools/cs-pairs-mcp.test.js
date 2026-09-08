import { readFile, writeFile, mkdtemp, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { assessPairResult, enumeratePairs, pairRequest, runPairWorkflow } from "./cs-pairs-mcp.mjs";

afterEach(() => vi.unstubAllEnvs());
describe("pair count MCP workflow", () => {
  it("counts the bounded loop model including empty and singleton cases", () => {
    const values = enumeratePairs();
    expect(values).toHaveLength(17);
    expect(values.slice(0, 4).map(v => v.enumerated)).toEqual(["0", "0", "1", "3"]);
    expect(values[16].enumerated).toBe("120");
    expect(pairRequest("correct").summand).toEqual(pairRequest("off-by-one").summand);
    expect(() => pairRequest("arbitrary")).toThrow();
  });
  it("does not count unknown or unrelated failures as successful refutations", () => {
    for (const report of [{ status: "unknown", checked: false }, { status: "unverified", error: "missing Python" }]) {
      expect(() => assessPairResult({ isError: true, content: [{ type: "text", text: JSON.stringify(report) }] }, "off-by-one")).toThrow();
    }
  });
  it("uses real MCP stdio, persists both cases, replays without writing, and rejects tampering", async () => {
    vi.stubEnv("TRUTH_HARNESS_CONTAINER", "1");
    const report = await runPairWorkflow();
    expect(report.passed).toBe(true);
    expect(report.cases.map(c => c.status)).toEqual(["identity-checked", "refuted"]);
    const directory = report.artifact_directory;
    const transcript = await readFile(`${directory}/transcript.json`, "utf8");
    const calls = JSON.parse(transcript);
    expect(calls.map(c => c.tool)).toEqual([
      "truth_harness_polynomial_capabilities", "truth_harness_polynomial_check", "truth_harness_polynomial_replay",
      "truth_harness_polynomial_check", "truth_harness_polynomial_replay"
    ]);
    await writeFile(`${directory}/report.json`, "corrupted historical summary");
    const replay = await runPairWorkflow(directory);
    expect(replay.cases).toEqual(report.cases);
    expect(await readFile(`${directory}/report.json`, "utf8")).toBe("corrupted historical summary");
    expect(await readFile(`${directory}/transcript.json`, "utf8")).toBe(transcript);
    const outside = await mkdtemp(path.join(tmpdir(), "truth-pairs-outside-"));
    const link = path.resolve(directory, "escape");
    try {
      await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
      await expect(runPairWorkflow(link)).rejects.toThrow("Evidence escapes local store");
    } finally {
      await rm(link, { force: true, recursive: true });
      await rm(outside, { force: true, recursive: true });
    }
    const requestPath = `${directory}/correct.request.json`;
    const requestRaw = await readFile(requestPath, "utf8");
    await writeFile(requestPath, JSON.stringify(pairRequest("off-by-one")));
    await expect(runPairWorkflow(directory)).rejects.toThrow("Saved request is not this fixed problem");
    await writeFile(requestPath, requestRaw);
    const receiptPath = `${directory}/correct.receipt.json`;
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    receipt.base_value = "1";
    await writeFile(receiptPath, JSON.stringify(receipt));
    await expect(runPairWorkflow(directory)).rejects.toThrow();
  }, 60000);
  it("refuses accidental host execution", async () => {
    vi.stubEnv("TRUTH_HARNESS_CONTAINER", "");
    await expect(runPairWorkflow()).rejects.toThrow("offline Docker");
  });
});

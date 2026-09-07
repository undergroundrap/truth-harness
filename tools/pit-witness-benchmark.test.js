import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { compareOutcome, fixturePath, runBenchmark } from "./pit-witness-benchmark.mjs";
import { runPython } from "./pit-witness.mjs";

const suite = JSON.parse(await readFile(fixturePath, "utf8"));

describe("sparse witness benchmark", () => {
  for (const entry of suite.cases) it(entry.id, () => {
    const raw = JSON.stringify(entry.request);
    const receipt = runPython("construct", raw);
    const checked = runPython("check", JSON.stringify({ request_json: raw, receipt_json: JSON.stringify(receipt) }));
    expect(compareOutcome(entry.expected, receipt, checked, checked)).toEqual(entry.expected);
  });

  it("pins the long-cancellation oracle independently using the factored polynomial", () => {
    const factored = x => [1n, 2n, 4n, 8n, 16n].reduce((value, root) => value * (x - root), 1n);
    for (let k = 0n; k < 5n; k++) expect(factored(2n ** k)).toBe(0n);
    expect(factored(32n).toString()).toBe(suite.cases.find(c => c.id === "five-cancellations").expected.value);
  });

  it("rejects wrong values, unexpected unknowns, trust promotion and replay drift", () => {
    const expected = { status: "witness-found", reason: "nonzero_evaluation", sample_index: 0, value: "1" };
    const receipt = { status: expected.status, reason: expected.reason, witness: { sample_index: 0, value: "1" } };
    const report = { status: expected.status, checked: true, trust: "exact-computed", request_sha256: "a", receipt_sha256: "b" };
    expect(() => compareOutcome({ ...expected, value: "2" }, receipt, report, report)).toThrow();
    for (const patch of [{ status: "unknown" }, { checked: false }, { trust: "proved" }, { receipt_sha256: "changed" }]) {
      expect(() => compareOutcome(expected, receipt, report, { ...report, ...patch })).toThrow();
    }
  });

  it("writes a replayed suite with separate witness and unknown totals", async () => {
    const previous = process.env.TRUTH_HARNESS_CONTAINER;
    process.env.TRUTH_HARNESS_CONTAINER = "1";
    try {
      const report = await runBenchmark();
      expect(report).toMatchObject({ total: 10, passed: 10, checked_witnesses: 6, expected_unknowns: 4, failed: 0 });
      const persisted = JSON.parse(await readFile(`${report.artifact_directory}/report.json`, "utf8"));
      expect(persisted).toEqual(report);
      expect(report.cases.every(c => c.replay_file && c.artifact_directory)).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.TRUTH_HARNESS_CONTAINER;
      else process.env.TRUTH_HARNESS_CONTAINER = previous;
    }
  }, 30000);
});

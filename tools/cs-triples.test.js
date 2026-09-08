import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
const run = args => spawnSync(process.execPath, [cli, "polynomial", ...args, "--json"], {
  encoding: "utf8", timeout: 30000, windowsHide: true
});
const fixture = id => fileURLToPath(new URL(`../docs/examples/cs-triples-${id}.json`, import.meta.url));

describe("exhaustive triple-count recurrence example", () => {
  for (const [id, exit, status] of [["correct", 0, "identity-checked"], ["refuted", 1, "refuted"]]) {
    it(`checks and replays the ${id} candidate through CLI`, () => {
      const result = run(["recurrence", fixture(id)]);
      expect(result.status, result.stderr || result.stdout).toBe(exit);
      const report = JSON.parse(result.stdout);
      expect(report).toMatchObject({ status, checked: true, recurrence_order: 3, proof_checker_backed: false,
        trust: id === "correct" ? "exact-computed" : "refuted" });
      expect(report.counterexample).toEqual(id === "correct" ? null : { index: 1, candidate_value: "1", sequence_value: "0" });
      const requestPath = `${report.artifact_directory}/request.json`;
      const receiptPath = `${report.artifact_directory}/receipt.json`;
      expect(readFileSync(requestPath, "utf8")).toBe(readFileSync(fixture(id), "utf8"));
      expect(createHash("sha256").update(readFileSync(receiptPath)).digest("hex")).toBe(report.receipt_sha256);
      expect(JSON.parse(readFileSync(receiptPath, "utf8")).recurrence_residual_coefficients).toEqual(Array(13).fill("0"));
      const replay = run(["replay", "recurrence", requestPath, receiptPath]);
      expect(replay.status, replay.stderr || replay.stdout).toBe(exit);
      expect(JSON.parse(replay.stdout)).toMatchObject({ status, receipt_sha256: report.receipt_sha256, artifact_directory: null });
    }, 30000);
  }
  it("separately enumerates the mathematical loops at n=0..16", () => {
    const counts = [];
    for (let n = 0; n <= 16; n++) {
      let count = 0n;
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          for (let k = j + 1; k < n; k++) count++;
      const size = BigInt(n);
      expect(count).toBe(size * (size - 1n) * (size - 2n) / 6n);
      counts.push(count);
    }
    expect(counts.slice(0, 3)).toEqual([0n, 0n, 0n]);
    for (let n = 0; n <= 13; n++)
      expect(counts[n + 3]).toBe(counts[n] - 3n * counts[n + 1] + 3n * counts[n + 2] + 1n);
  });
});

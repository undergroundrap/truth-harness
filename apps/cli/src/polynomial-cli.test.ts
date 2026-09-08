import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const run = (args: string[], input?: string | Buffer, container = "1") => spawnSync(process.execPath, [cli, "polynomial", ...args], {
  input, encoding: "utf8", timeout: 30000, env: { ...process.env, TRUTH_HARNESS_CONTAINER: container }, windowsHide: true
});

describe("polynomial CLI", () => {
  it("provides host-safe capability JSON and readable summaries", () => {
    const result = run(["capabilities", "--json"], undefined, "");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).execution).toBe("unavailable");
    expect(run(["capabilities"]).stdout).toContain("compare, sum, recurrence, replay");
  });
  it("runs all operations and replays the same receipt through normal commands", () => {
    for (const [operation, file] of [["compare", "polynomial-equivalent"], ["sum", "polynomial-sum-linear"], ["recurrence", "polynomial-recurrence-squares"]]) {
      const result = run([operation, `docs/examples/${file}.json`, "--json"]);
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(result.stdout);
      const replay = run(["replay", operation, `${report.artifact_directory}/request.json`, `${report.artifact_directory}/receipt.json`, "--json"]);
      expect(replay.status).toBe(0);
      expect(JSON.parse(replay.stdout).receipt_sha256).toBe(report.receipt_sha256);
    }
  }, 30000);
  it("preserves 0/1/2/3 exits with stdin and rejects bad bytes", () => {
    for (const [suffix, code] of [["squares", 0], ["refuted", 1], ["unknown", 3]] as const) {
      expect(run(["recurrence", "-", "--json"], readFileSync(`docs/examples/polynomial-recurrence-${suffix}.json`)).status).toBe(code);
    }
    for (const [suffix, code] of [["linear", 0], ["refuted", 1], ["unknown", 3]] as const) {
      const result = run(["sum", "-", "--json"], readFileSync(`docs/examples/polynomial-sum-${suffix}.json`));
      expect(result.status, result.stderr).toBe(code);
    }
    for (const input of ["{}", "x".repeat(65537), Buffer.from([255]), "\ufeff{}"])
      expect(run(["sum", "-", "--json"], input).status).toBe(2);
    expect(run(["sum", "docs/examples/polynomial-sum-linear.json", "--json"], undefined, "").status).toBe(2);
    expect(run(["replay", "bad-operation", "x", "y", "--json"]).status).toBe(2);
    expect(run(["sum", "docs/examples/polynomial-sum-refuted.json"]).stdout).toContain("Counterexample:");
  }, 30000);
});

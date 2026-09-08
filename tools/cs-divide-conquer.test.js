import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
const reopen = fileURLToPath(new URL("./recurrence-reopen.mjs", import.meta.url));
const fixture = name => fileURLToPath(new URL(`../docs/examples/cs-divide-conquer-${name}.json`, import.meta.url));
const run = args => spawnSync(process.execPath, args, { encoding: "utf8", timeout: 30000, windowsHide: true });
beforeAll(() => {
  if (process.env.TRUTH_HARNESS_REQUIRE_DOCKER_TESTS === "1") expect(process.env.TRUTH_HARNESS_CONTAINER).toBe("1");
});
for (const [name, code, status] of [["correct", 0, "identity-checked"], ["refuted", 1, "refuted"]]) {
  it(`checks and replays the ${name} divide-and-conquer candidate`, () => {
    const result = run([cli, "polynomial", "recurrence", fixture(name), "--json"]);
    if (process.env.TRUTH_HARNESS_CONTAINER !== "1") {
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({ checked: false, status: "unverified" });
      return;
    }
    expect(result.status, result.stdout + result.stderr).toBe(code);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({ status, checked: true, proof_checker_backed: false, recurrence_order: 2 });
    expect(report.counterexample).toEqual(name === "correct" ? null : { index: 1, candidate_value: "2", sequence_value: "1" });
    const directory = report.artifact_directory;
    expect(readFileSync(`${directory}/request.json`, "utf8")).toBe(readFileSync(fixture(name), "utf8"));
    const replay = run([cli, "polynomial", "replay", "recurrence", `${directory}/request.json`, `${directory}/receipt.json`, "--json"]);
    expect(replay.status).toBe(code);
    expect(JSON.parse(replay.stdout).receipt_sha256).toBe(report.receipt_sha256);
    const root = mkdtempSync(join(tmpdir(), "divide conquer reopen "));
    try {
      const store = join(root, ".truth-harness/witnesses"); mkdirSync(store, { recursive: true });
      cpSync(directory, join(store, basename(directory)), { recursive: true });
      const reopened = run([reopen, fixture(name), "--root", root]);
      expect(reopened.status, reopened.stdout + reopened.stderr).toBe(name === "correct" ? 0 : 2);
      if (name === "correct") expect(JSON.parse(reopened.stdout).replay.receipt_sha256).toBe(report.receipt_sha256);
      else expect(JSON.parse(reopened.stdout)).toMatchObject({ status: "unverified", checked: false });
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 30000);
}
it("enumerates the cost model separately and checks both recurrence formulations", () => {
  const counts = [];
  for (let h = 0; h <= 16; h++) {
    const size = 2 ** h, stack = [size];
    let operations = 0n;
    while (stack.length) {
      const n = stack.pop();
      if (n === 1) continue;
      for (let i = 0; i < n - 1; i++) operations++;
      stack.push(n / 2, n / 2);
    }
    counts.push(operations);
    expect(operations).toBe(BigInt(h - 1) * BigInt(size) + 1n);
    if (h > 0) expect(operations).toBe(2n * counts[h - 1] + BigInt(size) - 1n);
    if (h > 1) expect(operations).toBe(4n * counts[h - 1] - 4n * counts[h - 2] + 1n);
  }
  expect(counts.slice(0, 4)).toEqual([0n, 1n, 5n, 17n]);
});

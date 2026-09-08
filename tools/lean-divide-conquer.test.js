import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const sourcePath = fileURLToPath(new URL("../docs/examples/DivideConquer.lean", import.meta.url));
const source = readFileSync(sourcePath, "utf8");
it("keeps the Lean reduction target, axiom guards and fail-closed command (structural only)", () => {
  expect(source).toContain("import Std");
  expect(source).not.toMatch(/\b(sorry|admit|axiom|native_decide)\b/);
  expect(source).not.toContain("?_");
  expect(source).toContain("theorem divide_conquer_reduction");
  expect(source).toContain("theorem missing_second_initial_fails");
  expect(source).toContain("theorem divide_conquer_closed_form");
  expect(source).toContain("theorem closedCount_realizes_model");
  expect(source).toContain("theorem tempting_candidate_false");
  expect(source).toContain("theorem divide_conquer_cost_family");
  expect(source).toContain("theorem divide_conquer_merge_specialization");
  expect(source).toContain("theorem divide_conquer_constant_specialization");
  expect(source.match(/#guard_msgs/g)).toHaveLength(7);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(pkg.scripts["proof:divide-conquer"]).toContain("--declaration divide_conquer_reduction");
  expect(pkg.scripts["proof:divide-conquer"]).toContain("--fail-on-unproved");
  expect(pkg.scripts["proof:lean-suite"]).toContain("npm run proof:divide-conquer");
});
it("kernel-checks the reduction and rejects corrupted statements when the Lean gate is required", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  expect(process.env.TRUTH_HARNESS_CONTAINER).toBe("1");
  const run = file => spawnSync("lean", [file], { encoding: "utf8", timeout: 30000, windowsHide: true });
  const valid = run(sourcePath);
  expect(valid.status, valid.stdout + valid.stderr).toBe(0);
  expect(valid.stdout).not.toMatch(/warning:|error:|sorryAx/);
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  for (const declaration of ["divide_conquer_closed_form", "divide_conquer_cost_family"]) {
    const adapter = spawnSync(process.execPath, [cli, "proof", "check", sourcePath,
      "--declaration", declaration, "--timeout-ms", "30000", "--fail-on-unproved", "--json"],
    { encoding: "utf8", timeout: 30000, windowsHide: true });
    expect(adapter.status, adapter.stdout + adapter.stderr).toBe(0);
    expect(JSON.parse(adapter.stdout)).toMatchObject({ status: "accepted", trust: "proved", proofCheckerBacked: true,
      source: { declarationName: declaration } });
  }
  const root = mkdtempSync(join(tmpdir(), "lean reduction "));
  try {
    for (const [name, changed] of [
      ["WrongInitial", source.replaceAll("ha1 : A 1 = 1", "ha1 : A 1 = 2")],
      ["WrongResidual", source.replaceAll("4 * A (h + 1) - 4 * A h + 1", "4 * A (h + 1) - 4 * A h - 1")],
      ["WrongClosedConstant", source.replace("forall h, A h = ((h : Int) - 1) * 2 ^ h + 1 :=", "forall h, A h = ((h : Int) - 1) * 2 ^ h + 2 :=")],
      ["WrongClosedBase", source.replace("forall h, A h = ((h : Int) - 1) * 2 ^ h + 1 :=", "forall h, A h = ((h : Int) - 1) * 3 ^ h + 1 :=")],
      ["MissingLeafCost", source.replace("forall h, A h = (leaf + extra + slope * (h : Int)) * 2 ^ h - extra :=", "forall h, A h = (extra + slope * (h : Int)) * 2 ^ h - extra :=")],
      ["WrongSlope", source.replace("forall h, A h = (leaf + extra + slope * (h : Int)) * 2 ^ h - extra :=", "forall h, A h = (leaf + extra + 2 * slope * (h : Int)) * 2 ^ h - extra :=")],
      ["WrongExtraSign", source.replace("forall h, A h = (leaf + extra + slope * (h : Int)) * 2 ^ h - extra :=", "forall h, A h = (leaf + extra + slope * (h : Int)) * 2 ^ h + extra :=")]
    ]) {
      expect(changed).not.toBe(source);
      const file = join(root, `${name}.lean`); writeFileSync(file, changed);
      const rejected = run(file);
      expect(rejected.status, rejected.stdout + rejected.stderr).toBe(1);
      expect(rejected.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);

it("enumerates representative cost models as bounded supporting evidence, not a proof", () => {
  for (const [leaf, slope, extra] of [[0n, 1n, -1n], [3n, 0n, 5n], [2n, 3n, -2n], [0n, 0n, 0n], [-2n, -1n, 3n]]) {
    for (let height = 0; height <= 10; height++) {
      const stack = [height];
      let total = 0n;
      while (stack.length) {
        const h = stack.pop();
        if (h === 0) total += leaf;
        else {
          total += slope * (2n ** BigInt(h)) + extra;
          stack.push(h - 1, h - 1);
        }
      }
      expect(total).toBe((leaf + extra + slope * BigInt(height)) * (2n ** BigInt(height)) - extra);
    }
  }
});

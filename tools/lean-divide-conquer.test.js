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
  expect(source.match(/#guard_msgs/g)).toHaveLength(2);
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
  const root = mkdtempSync(join(tmpdir(), "lean reduction "));
  try {
    for (const [name, changed] of [
      ["WrongInitial", source.replaceAll("ha1 : A 1 = 1", "ha1 : A 1 = 2")],
      ["WrongResidual", source.replaceAll("4 * A (h + 1) - 4 * A h + 1", "4 * A (h + 1) - 4 * A h - 1")]
    ]) {
      expect(changed).not.toBe(source);
      const file = join(root, `${name}.lean`); writeFileSync(file, changed);
      const rejected = run(file);
      expect(rejected.status, rejected.stdout + rejected.stderr).toBe(1);
      expect(rejected.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);

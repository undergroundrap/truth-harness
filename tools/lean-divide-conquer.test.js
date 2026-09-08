import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { ensureSpecializationWorkspace, requireAdapterSuccess, specializationSource, validateCosts, validateExpectedRequestHash } from "./divide-conquer-specialize.mjs";

const sourcePath = fileURLToPath(new URL("../docs/examples/DivideConquer.lean", import.meta.url));
const source = readFileSync(sourcePath, "utf8");
const costs = JSON.parse(readFileSync(new URL("../docs/examples/cs-divide-conquer-costs.json", import.meta.url), "utf8"));
it("requires a canonical expected request hash", () => {
  expect(validateExpectedRequestHash("ab".repeat(32))).toBe("ab".repeat(32));
  for (const hash of [undefined, null, 1, "", "a".repeat(63), "a".repeat(65), "G".repeat(64), "A".repeat(64), "a".repeat(64) + "\n"]) {
    expect(() => validateExpectedRequestHash(hash)).toThrow();
  }
});
it("initializes a fresh specialization workspace without rewriting an existing or malformed manifest", async () => {
  const root = mkdtempSync(join(tmpdir(), "specialization workspace "));
  try {
    await ensureSpecializationWorkspace(root);
    const manifest = join(root, ".truth-harness", "project.json");
    const original = readFileSync(manifest, "utf8");
    await ensureSpecializationWorkspace(root);
    expect(readFileSync(manifest, "utf8")).toBe(original);
    writeFileSync(manifest, "{broken", "utf8");
    await expect(ensureSpecializationWorkspace(root)).rejects.toThrow();
    expect(readFileSync(manifest, "utf8")).toBe("{broken");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
it("preserves bounded adapter failure diagnostics without treating errors as accepted", () => {
  expect(() => requireAdapterSuccess({ status: 0 })).not.toThrow();
  expect(() => requireAdapterSuccess({ status: 1, stderr: "Workspace unavailable" })).toThrow("Workspace unavailable");
  expect(() => requireAdapterSuccess({ status: null, error: new Error("spawn failed") })).toThrow("spawn failed");
  expect(() => requireAdapterSuccess({ status: 1, stdout: "unverified proof" })).toThrow("unverified proof");
  try { requireAdapterSuccess({ status: 1, stderr: "x".repeat(10000) }); }
  catch (error) { expect(error.message.length).toBeLessThan(2100); }
});
it("validates specialization inputs without accepting expressions or hidden fields", () => {
  expect(validateCosts(costs)).toEqual(costs);
  for (const bad of [null, [], { ...costs, schema_version: "future" }, { ...costs, proof: "trust me" },
    ...[2, "01", "-0", "+1", "1000000", "1.5", "1\n", "0); axiom bad : False"].map(leaf_cost => ({ ...costs, leaf_cost }))]) {
    expect(() => validateCosts(bad)).toThrow();
  }
  expect(specializationSource(costs, source)).toBe(specializationSource(costs, source));
});
it("checks generated specializations through the real adapter and fails closed on invalid input", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const tool = fileURLToPath(new URL("./divide-conquer-specialize.mjs", import.meta.url));
  const run = input => spawnSync(process.execPath, [tool, "-"], {
    input, encoding: "utf8", timeout: 60000, windowsHide: true
  });
  for (const request of [costs, { ...costs, leaf_cost: "0", combine_slope: "0", combine_offset: "0" },
    { ...costs, leaf_cost: "-999999", combine_slope: "999999", combine_offset: "-999999" }]) {
    const result = run(JSON.stringify(request));
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({ status: "accepted", trust: "proved", proof_checker_backed: true,
      evidence_scope: "explicit-recurrence-only", request });
    expect(report.proof.source.declarationName).toBe("divide_conquer_specialized");
    const generated = readFileSync(join(report.artifact_directory, "Specialized.lean"), "utf8");
    expect(generated).toBe(specializationSource(request, source));
  }
  for (const bad of ["{}", "{", "\ufeff" + JSON.stringify(costs), " ".repeat(65537),
    JSON.stringify({ ...costs, leaf_cost: "2 + 1" })]) {
    const result = run(bad);
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: "unverified", proof_checker_backed: false });
  }
}, 180000);
it("reopens only a bound specialization with fresh Lean evidence and leaves saved files untouched", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const tool = fileURLToPath(new URL("./divide-conquer-specialize.mjs", import.meta.url));
  const root = mkdtempSync(join(tmpdir(), "reopen specialization "));
  const outside = mkdtempSync(join(tmpdir(), "outside specialization "));
  const scratchNames = () => readdirSync(".truth-harness/experiments").filter(name => name.startsWith("specialization-recheck-")).sort();
  const scratchBefore = scratchNames();
  const requestPath = join(root, "request.json"), savedPath = join(root, "Specialized.lean");
  const raw = JSON.stringify(costs), generated = specializationSource(costs, source);
  const hash = value => createHash("sha256").update(value).digest("hex");
  const expectedHash = hash(raw);
  const run = (env = process.env, bindingArgs = ["--expect-request-sha256", expectedHash]) => spawnSync(process.execPath, [tool, "--reopen", root, ...bindingArgs], {
    env, encoding: "utf8", timeout: 60000, windowsHide: true
  });
  const rejected = () => {
    const result = run();
    expect(result.status, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: "unverified", proof_checker_backed: false });
  };
  try {
    writeFileSync(requestPath, raw);
    writeFileSync(savedPath, generated);
    // A report is neither required nor consulted, including malformed cached claims.
    writeFileSync(join(root, "report.json"), "{not a proof");
    const before = readdirSync(root).map(name => [name, readFileSync(join(root, name), "utf8")]);
    const accepted = run();
    expect(accepted.status, accepted.stdout + accepted.stderr).toBe(0);
    expect(JSON.parse(accepted.stdout)).toMatchObject({ schema_version: "truth-harness.divide-conquer-reopen.v1", expected_request_sha256: expectedHash,
      status: "reopened", trust: "proved", proof_checker_backed: true, cached_report_used: false, request: costs });
    expect(readdirSync(root).map(name => [name, readFileSync(join(root, name), "utf8")])).toEqual(before);
    expect(scratchNames()).toEqual(scratchBefore);
    for (const args of [[], ["--expect-request-sha256", "bad"], ["--wrong", expectedHash],
      ["--expect-request-sha256", expectedHash, "--extra"]]) {
      expect(run(process.env, args).status).toBe(2);
    }
    const otherCosts = { ...costs, leaf_cost: "3" };
    const otherRaw = JSON.stringify(otherCosts);
    writeFileSync(requestPath, otherRaw);
    writeFileSync(savedPath, specializationSource(otherCosts, source));
    const substituted = run({ ...process.env, TRUTH_HARNESS_LEAN: "/no-such-specialization-checker" });
    expect(substituted.status).toBe(2);
    expect(JSON.parse(substituted.stdout).error).toContain("Saved request does not match expected request SHA-256");
    const deliberatelyChanged = run(process.env, ["--expect-request-sha256", hash(otherRaw)]);
    expect(deliberatelyChanged.status).toBe(0);
    expect(JSON.parse(deliberatelyChanged.stdout).request).toEqual(otherCosts);
    writeFileSync(requestPath, raw + "\n");
    writeFileSync(savedPath, generated);
    expect(JSON.parse(run().stdout).error).toContain("Saved request does not match expected request SHA-256");
    writeFileSync(requestPath, raw);
    const missingLean = run({ ...process.env, TRUTH_HARNESS_LEAN: "/no-such-specialization-checker" });
    expect(missingLean.status).toBe(2);
    expect(JSON.parse(missingLean.stdout).proof_checker_backed).toBe(false);
    expect(scratchNames()).toEqual(scratchBefore);
    for (const bad of [JSON.stringify({ ...costs, leaf_cost: "3" }), JSON.stringify({ ...costs, schema_version: "future" }),
      "\ufeff" + raw, " ".repeat(65537)]) {
      writeFileSync(requestPath, bad);
      const invalid = run(process.env, ["--expect-request-sha256", hash(bad)]);
      expect(invalid.status).toBe(2);
      expect(JSON.parse(invalid.stdout).proof_checker_backed).toBe(false);
    }
    writeFileSync(requestPath, raw);
    for (const bad of [generated + "\n-- changed library or source\n", "theorem fake : True := True.intro", " ".repeat(65537)]) {
      writeFileSync(savedPath, bad); rejected();
    }
    unlinkSync(savedPath); rejected();
    const externalSource = join(outside, "Specialized.lean");
    writeFileSync(externalSource, generated);
    symlinkSync(externalSource, savedPath);
    const escaped = run();
    expect(escaped.status).toBe(2);
    expect(JSON.parse(escaped.stdout).error).toContain("Bundle file escapes directory");
    unlinkSync(savedPath);
    writeFileSync(savedPath, generated);
    unlinkSync(join(root, "report.json"));
    expect(run().status).toBe(0);
    expect(scratchNames()).toEqual(scratchBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
}, 180000);
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

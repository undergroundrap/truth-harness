import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setImmediate } from "node:timers/promises";
import { afterEach, expect, it } from "vitest";
import { treeRequest, treeSource } from "./tree-evaluate.mjs";
import { ensureSpecializationWorkspace, requireAdapterSuccess, specializationSource, validateCosts, validateExpectedRequestHash } from "./divide-conquer-specialize.mjs";

// Synchronous checker subprocesses must not starve Vitest's worker RPC replies.
afterEach(async () => { await setImmediate(); });

const sourcePath = fileURLToPath(new URL("../docs/examples/DivideConquer.lean", import.meta.url));
const source = readFileSync(sourcePath, "utf8");
const costs = JSON.parse(readFileSync(new URL("../docs/examples/cs-divide-conquer-costs.json", import.meta.url), "utf8"));
const branchingPath = fileURLToPath(new URL("../docs/examples/BranchingCost.lean", import.meta.url));
const branchingSource = readFileSync(branchingPath, "utf8");
const branchingCosts = JSON.parse(readFileSync(new URL("../docs/examples/cs-branching-costs.json", import.meta.url), "utf8"));
const treeFixture = JSON.parse(readFileSync(new URL("../docs/examples/tree-evaluation.json", import.meta.url), "utf8"));
it("checks instrumented linked-list scan counts without charging the supplied tail (finite only)", () => {
  const makeTree = (xs, shape) => {
    if (xs.length === 1) return { value: xs[0], total: xs[0] };
    const split = shape === "left" ? xs.length - 1 : shape === "right" ? 1 : Math.floor(xs.length / 2);
    const left = makeTree(xs.slice(0, split), shape), right = makeTree(xs.slice(split), shape);
    return { left, right, total: left.total + right.total };
  };
  for (let n = 1; n <= 32; n++) {
    const values = Array.from({ length: n }, (_, i) => BigInt(i % 9 - 4));
    for (const shape of ["left", "right", "balanced"]) {
      for (const offset of [-7n, 0n, 10n]) {
        const tail = { value: 77n, next: { value: -8n, next: null } };
        let additions = 0, cells = 0;
        const scan = (t, start, rest) => {
          additions++;
          if ("value" in t) { cells++; return { value: start + t.value, next: rest }; }
          const right = scan(t.right, start + t.left.total, rest);
          return scan(t.left, start, right);
        };
        let output = scan(makeTree(values, shape), offset, tail), sum = offset;
        for (const value of values) {
          sum += value;
          expect(output.value).toBe(sum);
          output = output.next;
        }
        expect(output).toBe(tail);
        expect(additions).toBe(2 * n - 1);
        expect(cells).toBe(n);
      }
    }
  }
});
it("proves instrumented scan output and counts and rejects corrupted instrumentation", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const text = readFileSync(file, "utf8");
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
    "--declaration", "cached_prefix_evaluation_correct", "--fail-on-unproved", "--json"],
  { encoding: "utf8", timeout: 45000, windowsHide: true });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({ status: "accepted", trust: "proved", proofCheckerBacked: true,
    source: { declarationName: "cached_prefix_evaluation_correct",
      declaration: { name: "cached_prefix_evaluation_correct", kind: "theorem" } } });
  const root = mkdtempSync(join(tmpdir(), "scan evaluation checks "));
  const run = path => spawnSync("lean", [path], { encoding: "utf8", timeout: 30000, windowsHide: true });
  try {
    const probes = join(root, "Evaluate.lean");
    writeFileSync(probes, text + "\n" + [
      "def scanEval := CachedScan.evaluateInto 10 (CachedScan.build (.fork (.leaf (-5)) (.fork (.leaf 2) (.leaf 9)))) [77, -8]",
      "example : scanEval.output = [5, 7, 16, 77, -8] := by decide",
      "example : scanEval.additions = 5 := by decide",
      "example : scanEval.consCells = 3 := by decide",
      "example : (CachedScan.evaluateInto 0 (CachedScan.build (.leaf 0)) []).consCells = 1 := by decide"
    ].join("\n"));
    const valid = run(probes);
    expect(valid.status, valid.stdout + valid.stderr).toBe(0);
    for (const [i, wrong] of [
      text.replace("output := (offset + value) :: tail", "output := offset :: tail"),
      text.replace("additions := 1, consCells", "additions := 0, consCells"),
      text.replace("left.additions + right.additions + 1", "left.additions + 1"),
      text.replace("consCells := 1 }", "consCells := tail.length + 1 }"),
      text.replace("consCells := left.consCells + right.consCells", "consCells := left.consCells")
    ].entries()) {
      expect(wrong).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, wrong);
      const rejected = run(bad);
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);
it("checks append-free scan equivalence, tails, and rejected corruptions in Lean", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const text = readFileSync(file, "utf8");
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
    "--declaration", "cached_prefix_scan_into_correct", "--fail-on-unproved", "--json"],
  { encoding: "utf8", timeout: 45000, windowsHide: true });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({ status: "accepted", trust: "proved", proofCheckerBacked: true,
    source: { declarationName: "cached_prefix_scan_into_correct",
      declaration: { name: "cached_prefix_scan_into_correct", kind: "theorem" } } });
  const root = mkdtempSync(join(tmpdir(), "scan into checks "));
  const run = path => spawnSync("lean", [path], { encoding: "utf8", timeout: 30000, windowsHide: true });
  try {
    const probes = join(root, "Into.lean");
    writeFileSync(probes, text + "\n" + [
      "example : CachedScan.scanInto 10 (CachedScan.build (.fork (.leaf (-5)) (.fork (.leaf 2) (.leaf 9)))) [77, -8] = [5, 7, 16, 77, -8] := by decide",
      "example : CachedScan.scanInto (-4) (CachedScan.build (.fork (.fork (.leaf 1) (.leaf 2)) (.leaf 3))) [] = [-3, -1, 2] := by decide",
      "example : CachedScan.scanInto 0 (CachedScan.build (.leaf 0)) [9] = [0, 9] := by decide"
    ].join("\n"));
    const valid = run(probes);
    expect(valid.status, valid.stdout + valid.stderr).toBe(0);
    for (const [i, wrong] of [
      text.replace("(offset + value) :: tail", "[offset + value]"),
      text.replace("scanInto (offset + total l) r tail", "scanInto (offset + total r) r tail"),
      text.replace("scanInto offset l (scanInto (offset + total l) r tail)",
        "scanInto (offset + total l) r (scanInto offset l tail)")
    ].entries()) {
      expect(wrong).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, wrong);
      const rejected = run(bad);
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 150000);
it("keeps the scanInto implementation free of list append (structural only)", () => {
  const text = readFileSync(new URL("../docs/examples/ParallelReduction.lean", import.meta.url), "utf8");
  const implementation = text.split("def scanInto ")[1].split("theorem scanInto_eq")[0];
  expect(implementation).toContain(":: tail");
  expect(implementation).not.toMatch(/\+\+|List\.append/);
});
it("counts both cached scan phases on balanced and skewed integer trees", () => {
  for (let n = 1; n <= 32; n++) {
    const values = Array.from({ length: n }, (_, i) => (i % 9) - 4);
    const tree = (xs, skew) => xs.length === 1 ? { value: xs[0] } : {
      left: tree(xs.slice(0, skew ? 1 : Math.floor(xs.length / 2)), skew),
      right: tree(xs.slice(skew ? 1 : Math.floor(xs.length / 2)), skew)
    };
    for (const skew of [false, true]) {
      let buildAdds = 0, scanAdds = 0;
      const build = t => {
        if ("value" in t) return { value: t.value, total: t.value };
        const left = build(t.left), right = build(t.right);
        buildAdds++;
        return { left, right, total: left.total + right.total };
      };
      const scan = (t, offset) => {
        scanAdds++;
        if ("value" in t) return [offset + t.value];
        return scan(t.left, offset).concat(scan(t.right, offset + t.left.total));
      };
      let sum = 7;
      const expected = values.map(value => (sum += value));
      expect(scan(build(tree(values, skew)), 7)).toEqual(expected);
      expect(buildAdds).toBe(n - 1);
      expect(scanAdds).toBe(2 * n - 1);
      expect(buildAdds + scanAdds).toBe(3 * n - 2);
    }
  }
});
it("proves cached scan arithmetic work including construction and leaf additions", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const text = readFileSync(file, "utf8");
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
    "--declaration", "cached_prefix_arithmetic_work", "--fail-on-unproved", "--json"],
  { encoding: "utf8", timeout: 45000, windowsHide: true });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({ trust: "proved", proofCheckerBacked: true,
    source: { declarationName: "cached_prefix_arithmetic_work",
      declaration: { name: "cached_prefix_arithmetic_work", kind: "theorem" } } });
  const root = mkdtempSync(join(tmpdir(), "scan arithmetic checks "));
  try {
    for (const [i, wrong] of [
      text.replace("buildWork l + buildWork r + 1", "buildWork l + buildWork r"),
      text.replace("| .leaf _ => 1", "| .leaf _ => 0"),
      text.replace("3 * ((ValueTree.leaves t).length : Int) - 2", "2 * ((ValueTree.leaves t).length : Int) - 1")
    ].entries()) {
      expect(wrong).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, wrong);
      const rejected = spawnSync("lean", [bad], { encoding: "utf8", timeout: 30000, windowsHide: true });
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 150000);
it("proves cached prefix scans equivalent and rejects incorrect caches or offsets", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const text = readFileSync(file, "utf8");
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
    "--declaration", "cached_prefix_scan_correct", "--fail-on-unproved", "--json"],
  { encoding: "utf8", timeout: 45000, windowsHide: true });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({ trust: "proved", proofCheckerBacked: true,
    source: { declarationName: "cached_prefix_scan_correct",
      declaration: { name: "cached_prefix_scan_correct", kind: "theorem" } } });
  const root = mkdtempSync(join(tmpdir(), "cached prefix checks "));
  try {
    const probes = join(root, "Cached.lean");
    writeFileSync(probes, text + "\n" + [
      "def cachedSample : ValueTree.Tree := .fork (.fork (.leaf 1) (.leaf 2)) (.leaf 3)",
      "example : CachedScan.scan 0 (CachedScan.build cachedSample) = [1, 3, 6] := by decide",
      "example : CachedScan.scan (-4) (CachedScan.build cachedSample) = [-3, -1, 2] := by decide",
      "example : CachedScan.scan 10 (CachedScan.build (.fork (.leaf (-5)) (.fork (.leaf 2) (.leaf 9)))) = [5, 7, 16] := by decide",
      "example : CachedScan.scan 0 (CachedScan.build (.leaf 0)) = [0] := by decide",
      "def forgedCache : CachedScan.Tree := .fork 6 (.fork 100 (.leaf 1) (.leaf 2)) (.leaf 3)",
      "example : CachedScan.scan 0 forgedCache = [1, 3, 103] := by decide"
    ].join("\n"));
    const evaluated = spawnSync("lean", [probes], { encoding: "utf8", timeout: 30000, windowsHide: true });
    expect(evaluated.status, evaluated.stdout + evaluated.stderr).toBe(0);
    for (const [i, wrong] of [
      text.replace(".fork (total a + total b) a b", ".fork (total a) a b"),
      text.replace("scan (offset + total l) r", "scan (offset + total r) r"),
      text.replace("scan (offset + total l) r", "scan (total l) r")
    ].entries()) {
      expect(wrong).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, wrong);
      const rejected = spawnSync("lean", [bad], { encoding: "utf8", timeout: 30000, windowsHide: true });
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 150000);
it("proves inclusive tree prefixes and rejects incorrect offsets and subtree totals", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const text = readFileSync(file, "utf8");
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
    "--declaration", "tree_prefix_scan_correct", "--fail-on-unproved", "--json"],
  { encoding: "utf8", timeout: 45000, windowsHide: true });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({ trust: "proved", proofCheckerBacked: true,
    source: { declarationName: "tree_prefix_scan_correct",
      declaration: { name: "tree_prefix_scan_correct", kind: "theorem" } } });
  const root = mkdtempSync(join(tmpdir(), "prefix scan checks "));
  try {
    const probes = join(root, "Prefixes.lean");
    writeFileSync(probes, text + "\n" + [
      "def scanSample : ValueTree.Tree := .fork (.leaf (-5)) (.fork (.leaf 2) (.leaf 9))",
      "example : TreeScan.scan 0 scanSample = [-5, -3, 6] := by decide",
      "example : TreeScan.scan 10 scanSample = [5, 7, 16] := by decide",
      "example : TreeScan.scan (-2) (.leaf 7) = [5] := by decide",
      "example : TreeScan.scan 3 (.fork (.leaf 0) (.leaf 0)) = [3, 3] := by decide",
      "example : TreeScan.scan 0 (.fork (.fork (.leaf (-5)) (.leaf 2)) (.leaf 9)) = [-5, -3, 6] := by decide",
      "example : TreeScan.prefixes 8 [] = [] := by decide"
    ].join("\n"));
    const evaluated = spawnSync("lean", [probes], { encoding: "utf8", timeout: 30000, windowsHide: true });
    expect(evaluated.status, evaluated.stdout + evaluated.stderr).toBe(0);
    for (const [i, wrong] of [
      text.replace("scan (offset + (ValueTree.aggregate l).1) r", "scan offset r"),
      text.replace("scan (offset + (ValueTree.aggregate l).1) r", "scan (offset + (ValueTree.aggregate r).1) r"),
      text.replace(".leaf value => [offset + value]", ".leaf value => [offset]")
    ].entries()) {
      expect(wrong).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, wrong);
      const rejected = spawnSync("lean", [bad], { encoding: "utf8", timeout: 30000, windowsHide: true });
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 150000);
it("replays hash-bound tree bundles without trusting cached reports or changed files", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const tool = fileURLToPath(new URL("./tree-evaluate.mjs", import.meta.url));
  const run = (args, input) => spawnSync(process.execPath, [tool, ...args], { input, encoding: "utf8", timeout: 60000, windowsHide: true });
  const created = run(["-"], JSON.stringify(treeFixture));
  expect(created.status, created.stdout + created.stderr).toBe(0);
  const original = JSON.parse(created.stdout);
  const root = mkdtempSync(join(tmpdir(), "tree replay bundle "));
  try {
    for (const name of ["request.json", "Evaluation.lean", "report.json"]) copyFileSync(join(original.artifact_directory, name), join(root, name));
    const requestFile = join(root, "request.json"), sourceFile = join(root, "Evaluation.lean"), reportFile = join(root, "report.json");
    const raw = readFileSync(requestFile, "utf8"), source = readFileSync(sourceFile, "utf8");
    const args = ["--reopen", root, "--expect-request-sha256", original.request_sha256];
    const check = () => {
      const result = run(args);
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report).toMatchObject({ schema_version: "truth-harness.tree-evaluation-reopen.v0", status: "reopened",
        proof_checker_backed: true, cached_report_used: false, expected_request_sha256: original.request_sha256,
        results: original.results });
      expect(report.proof.source.sha256).toBe(original.source_sha256);
      expect(() => readFileSync(report.proof.source.path)).toThrow();
      expect(readFileSync(requestFile, "utf8")).toBe(raw);
      expect(readFileSync(sourceFile, "utf8")).toBe(source);
    };
    writeFileSync(reportFile, "not JSON");
    check();
    expect(readFileSync(reportFile, "utf8")).toBe("not JSON");
    unlinkSync(reportFile);
    check();
    for (const badArgs of [["--reopen", root], ["--reopen", root, "--expect-request-sha256", "bad"],
      ["--reopen", root, "--expect-request-sha256", "0".repeat(64)]]) {
      const rejected = run(badArgs);
      expect(rejected.status).toBe(2);
      expect(JSON.parse(rejected.stdout)).toMatchObject({ status: "unverified", proof_checker_backed: false });
    }
    const changed = { ...treeFixture, tree: { value: "8" } };
    const library = readFileSync(new URL("../docs/examples/ParallelReduction.lean", import.meta.url), "utf8");
    writeFileSync(requestFile, JSON.stringify(changed));
    writeFileSync(sourceFile, treeSource(changed, library));
    expect(run(args).status).toBe(2);
    writeFileSync(requestFile, raw);
    expect(run(args).status).toBe(2);
    writeFileSync(sourceFile, source);
    const outside = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
    try {
      unlinkSync(sourceFile);
      symlinkSync(outside, sourceFile);
      const escaped = run(args);
      expect(escaped.status).toBe(2);
      expect(JSON.parse(escaped.stdout).error).toContain("escapes directory");
    } finally { unlinkSync(sourceFile); }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);
it("validates bounded tree requests and generates deterministic literal-only proofs", () => {
  expect(treeRequest(treeFixture).results).toEqual({ sum: "6", count: "3", work: "4", span: "2" });
  expect(treeSource(treeFixture, "import Std")).toBe(treeSource(treeFixture, "import Std"));
  for (const value of [0, "-0", "01", "1\n", "1000000", "0); sorry"]) {
    expect(() => treeRequest({ ...treeFixture, tree: { value } })).toThrow();
  }
  for (const tree of [null, [], {}, { value: "1", extra: true }, { left: { value: "1" } }]) {
    expect(() => treeRequest({ ...treeFixture, tree })).toThrow();
  }
  expect(() => treeRequest({ ...treeFixture, schema_version: "future" })).toThrow();
  let deep = { value: "1" };
  for (let i = 0; i < 9; i++) deep = { left: deep, right: { value: "0" } };
  expect(() => treeRequest({ ...treeFixture, tree: deep })).toThrow();
  const full = h => h ? { left: full(h - 1), right: full(h - 1) } : { value: "1" };
  expect(treeRequest({ ...treeFixture, tree: full(6) }).results.count).toBe("64");
  expect(() => treeRequest({ ...treeFixture, tree: full(7) })).toThrow();
});
it("verifies JSON trees from file and stdin and rejects a corrupted concrete result", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const tool = fileURLToPath(new URL("./tree-evaluate.mjs", import.meta.url));
  const fixture = fileURLToPath(new URL("../docs/examples/tree-evaluation.json", import.meta.url));
  const run = (args, input) => spawnSync(process.execPath, [tool, ...args], { input, encoding: "utf8", timeout: 60000, windowsHide: true });
  for (const [args, input] of [[[fixture], undefined], [["-"], JSON.stringify(treeFixture)]]) {
    const checked = run(args, input);
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const report = JSON.parse(checked.stdout);
    expect(report).toMatchObject({ status: "accepted", proof_checker_backed: true,
      results: { sum: "6", count: "3", work: "4", span: "2" } });
    expect(report.request_sha256).toBe(createHash("sha256").update(input ?? readFileSync(fixture)).digest("hex"));
  }
  for (const input of ["\ufeff{}", "x".repeat(65537), JSON.stringify({ ...treeFixture, schema_version: "future" })]) {
    const bad = run(["-"], input);
    expect(bad.status).toBe(2);
    expect(JSON.parse(bad.stdout)).toMatchObject({ status: "unverified", proof_checker_backed: false });
  }
  const root = mkdtempSync(join(tmpdir(), "concrete tree negatives "));
  try {
    const library = readFileSync(new URL("../docs/examples/ParallelReduction.lean", import.meta.url), "utf8");
    const generated = treeSource(treeFixture, library);
    const wrong = generated.replace("= ((6 : Int), 3)", "= ((7 : Int), 3)");
    expect(wrong).not.toBe(generated);
    const file = join(root, "Wrong.lean");
    writeFileSync(file, wrong);
    const rejected = spawnSync("lean", [file], { encoding: "utf8", timeout: 30000, windowsHide: true });
    expect(rejected.status).toBe(1);
    expect(rejected.stdout).toContain("error:");
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);
it("checks one evaluator for outputs and costs and rejects broken refinement", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const text = readFileSync(file, "utf8");
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  for (const name of ["tree_evaluation_correct", "tree_evaluation_balanced"]) {
    const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
      "--declaration", name, "--fail-on-unproved", "--json"],
    { encoding: "utf8", timeout: 45000, windowsHide: true });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    expect(JSON.parse(checked.stdout)).toMatchObject({ trust: "proved", proofCheckerBacked: true,
      source: { declarationName: name, declaration: { name, kind: "theorem" } } });
  }
  const root = mkdtempSync(join(tmpdir(), "evaluation refinement "));
  try {
    const probes = join(root, "Evaluate.lean");
    writeFileSync(probes, text + "\n" + [
      "def sample : ValueTree.Tree := .fork (.leaf (-5)) (.fork (.leaf 2) (.leaf 9))",
      "example : (ValueTree.evaluate sample).output = (6, 3) := by decide",
      "example : (ValueTree.evaluate sample).work = 4 := by decide",
      "example : (ValueTree.evaluate sample).span = 2 := by decide",
      "example : Not (ValueTree.shape sample = PairTree.balanced 2) := by intro h; cases h",
      "example : (ValueTree.evaluate (.leaf 8)).work = 0 := by decide",
      "example : (ValueTree.evaluate (.fork (.leaf 3) (.leaf (-1)))).output = (2, 2) := by decide"
    ].join("\n"));
    const evaluated = spawnSync("lean", [probes], { encoding: "utf8", timeout: 30000, windowsHide: true });
    expect(evaluated.status, evaluated.stdout + evaluated.stderr).toBe(0);
    for (const [i, wrong] of [
      text.replace("work := a.work + b.work + 2", "work := a.work + b.work + 1"),
      text.replace("span := max a.span b.span + 1", "span := max a.span b.span + 2"),
      text.replace("output := (a.output.1 + b.output.1", "output := (a.output.1"),
      text.replace(".fork (shape l) (shape r)", ".fork (shape l) (shape l)")
    ].entries()) {
      expect(wrong).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, wrong);
      const rejected = spawnSync("lean", [bad], { encoding: "utf8", timeout: 30000, windowsHide: true });
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);
it("proves sum/count outputs for all trees and rejects dropped children and bad leaf counts", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const text = readFileSync(file, "utf8");
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
    "--declaration", "tree_aggregation_correct", "--fail-on-unproved", "--json"],
  { encoding: "utf8", timeout: 45000, windowsHide: true });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({ trust: "proved", proofCheckerBacked: true,
    source: { declarationName: "tree_aggregation_correct",
      declaration: { name: "tree_aggregation_correct", kind: "theorem" } } });
  const root = mkdtempSync(join(tmpdir(), "tree output checks "));
  try {
    const probes = join(root, "Outputs.lean");
    writeFileSync(probes, text + "\n" + [
      "example : ValueTree.aggregate (.leaf (-7)) = (-7, 1) := by decide",
      "example : ValueTree.aggregate (.fork (.leaf 0) (.leaf 0)) = (0, 2) := by decide",
      "example : ValueTree.aggregate (.fork (.leaf (-5)) (.fork (.leaf 2) (.leaf 9))) = (6, 3) := by decide",
      "example : ValueTree.aggregate (.fork (.fork (.leaf 9) (.leaf 2)) (.leaf (-5))) = (6, 3) := by decide"
    ].join("\n"));
    const result = spawnSync("lean", [probes], { encoding: "utf8", timeout: 30000, windowsHide: true });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    for (const [i, wrong] of [
      text.replace("(a.1 + b.1, a.2 + b.2)", "(a.1, a.2 + b.2)"),
      text.replace(".leaf value => (value, 1)", ".leaf value => (value, 0)")
    ].entries()) {
      expect(wrong).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, wrong);
      const rejected = spawnSync("lean", [bad], { encoding: "utf8", timeout: 30000, windowsHide: true });
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
it("derives balanced costs from executable trees and rejects changed cost semantics", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const text = readFileSync(file, "utf8");
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
    "--declaration", "pair_tree_balanced_cost", "--fail-on-unproved", "--json"],
  { encoding: "utf8", timeout: 45000, windowsHide: true });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({ trust: "proved", proofCheckerBacked: true,
    source: { declarationName: "pair_tree_balanced_cost",
      declaration: { name: "pair_tree_balanced_cost", kind: "theorem" } } });
  const root = mkdtempSync(join(tmpdir(), "tree cost semantics "));
  try {
    const probes = join(root, "Probes.lean");
    const examples = Array.from({ length: 7 }, (_, h) =>
      `example : PairTree.work (PairTree.balanced ${h}) = ${2 * (2 ** h - 1)} := by decide\n` +
      `example : PairTree.span (PairTree.balanced ${h}) = ${h} := by decide`).join("\n");
    writeFileSync(probes, text + "\n" + examples + "\n" +
      "example : PairTree.work (.fork .leaf (.fork .leaf (.fork .leaf .leaf))) = 6 := by decide\n" +
      "example : PairTree.span (.fork .leaf (.fork .leaf (.fork .leaf .leaf))) = 3 := by decide\n");
    const evaluated = spawnSync("lean", [probes], { encoding: "utf8", timeout: 30000, windowsHide: true });
    expect(evaluated.status, evaluated.stdout + evaluated.stderr).toBe(0);
    for (const [i, wrong] of [
      text.replace("work l + work r + 2", "work l + work r + 1"),
      text.replace("max (span l) (span r) + 1", "max (span l) (span r) + 2")
    ].entries()) {
      expect(wrong).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, wrong);
      const result = spawnSync("lean", [bad], { encoding: "utf8", timeout: 30000, windowsHide: true });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
it("counts independent sum and count dependencies in a binary pair aggregate", () => {
  for (let height = 0; height <= 8; height++) {
    let work = 0, leaf = 0, expectedSum = 0;
    const build = h => {
      if (h === 0) {
        const value = (leaf++ % 11) - 5;
        expectedSum += value;
        return { sum: value, count: 1, sumDepth: 0, countDepth: 0 };
      }
      const left = build(h - 1), right = build(h - 1);
      work += 2;
      return { sum: left.sum + right.sum, count: left.count + right.count,
        sumDepth: Math.max(left.sumDepth, right.sumDepth) + 1,
        countDepth: Math.max(left.countDepth, right.countDepth) + 1 };
    };
    const result = build(height);
    expect(result.sum).toBe(expectedSum);
    expect(result.count).toBe(2 ** height);
    expect(leaf).toBe(result.count);
    expect(work).toBe(2 * (2 ** height - 1));
    expect(Math.max(result.sumDepth, result.countDepth)).toBe(height);
  }
});
it("reuses reduction lemmas for pair aggregation and rejects doubled span", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
    "--declaration", "binary_pair_aggregation", "--fail-on-unproved", "--json"],
  { encoding: "utf8", timeout: 45000, windowsHide: true });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({ trust: "proved", proofCheckerBacked: true,
    source: { declarationName: "binary_pair_aggregation" } });
  const text = readFileSync(file, "utf8");
  const root = mkdtempSync(join(tmpdir(), "pair aggregate negatives "));
  try {
    for (const [i, wrong] of [
      text.replace("X h + Y h = 2 * (2 ^ h - 1)", "X h + Y h = (2 ^ h - 1)"),
      text.replace("/\\ S h = (h : Int)", "/\\ S h = 2 * (h : Int)")
    ].entries()) {
      expect(wrong).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, wrong);
      const result = spawnSync("lean", [bad], { encoding: "utf8", timeout: 30000, windowsHide: true });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
it("enumerates work and longest dependency paths for a balanced four-way reduction", () => {
  for (let height = 0; height <= 5; height++) {
    let work = 0, leaf = 0, expectedSum = 0;
    const build = h => {
      if (h === 0) {
        const value = (leaf++ % 7) - 3;
        expectedSum += value;
        return { value, depth: 0 };
      }
      const children = Array.from({ length: 4 }, () => build(h - 1));
      let result = children[0];
      for (const child of children.slice(1)) {
        work++;
        result = { value: result.value + child.value, depth: Math.max(result.depth, child.depth) + 1 };
      }
      return result;
    };
    const result = build(height);
    expect(leaf).toBe(4 ** height);
    expect(work).toBe(4 ** height - 1);
    expect(result.depth).toBe(3 * height);
    expect(result.value).toBe(expectedSum);
  }
});
it("checks parallel reduction work/span proofs and reuses the existing v1 work lane", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const file = fileURLToPath(new URL("../docs/examples/ParallelReduction.lean", import.meta.url));
  const text = readFileSync(file, "utf8");
  expect(text).not.toMatch(/\b(sorry|admit|axiom|native_decide)\b/);
  expect(text).not.toContain("?_");
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  const checked = spawnSync(process.execPath, [cli, "proof", "check", file,
    "--declaration", "parallel_reduction_four_way", "--fail-on-unproved", "--json"],
  { encoding: "utf8", timeout: 45000, windowsHide: true });
  expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({ trust: "proved", proofCheckerBacked: true,
    source: { declarationName: "parallel_reduction_four_way" } });
  const root = mkdtempSync(join(tmpdir(), "parallel negatives "));
  try {
    for (const [i, corrupted] of [text.replace("W h = 4 ^ h - 1 /\\", "W h = 4 ^ h + 1 /\\"),
      text.replace("S h = 3 * (h : Int)", "S h = (h : Int)")].entries()) {
      expect(corrupted).not.toBe(text);
      const bad = join(root, `Wrong${i}.lean`);
      writeFileSync(bad, corrupted);
      const result = spawnSync("lean", [bad], { encoding: "utf8", timeout: 30000, windowsHide: true });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
  const tool = fileURLToPath(new URL("./divide-conquer-specialize.mjs", import.meta.url));
  const fixture = fileURLToPath(new URL("../docs/examples/cs-parallel-reduction-work.json", import.meta.url));
  const created = spawnSync(process.execPath, [tool, fixture], { encoding: "utf8", timeout: 60000, windowsHide: true });
  expect(created.status, created.stdout + created.stderr).toBe(0);
  const report = JSON.parse(created.stdout);
  expect(report).toMatchObject({ trust: "proved", proof_checker_backed: true,
    request: { branching_factor: "4", leaf_cost: "0", combine_slope: "0", combine_offset: "3" } });
  const reopened = spawnSync(process.execPath, [tool, "--reopen", report.artifact_directory,
    "--expect-request-sha256", report.request_sha256], { encoding: "utf8", timeout: 60000, windowsHide: true });
  expect(reopened.status, reopened.stdout + reopened.stderr).toBe(0);
  expect(JSON.parse(reopened.stdout)).toMatchObject({ status: "reopened", proof_checker_backed: true,
    expected_request_sha256: report.request_sha256 });
}, 180000);
it("keeps versioned branching input bounded and rejects cross-version fields", () => {
  expect(validateCosts(branchingCosts)).toEqual(branchingCosts);
  const { branching_factor: omitted, ...missing } = branchingCosts;
  for (const bad of [missing, { ...costs, branching_factor: "3" }, { ...branchingCosts, schema_version: "future" },
    ...[0, "0", "1", "17", "03", "-3", "3.0", "3\n", "3; sorry"].map(branching_factor => ({ ...branchingCosts, branching_factor }))]) {
    expect(() => validateCosts(bad)).toThrow();
  }
});
it("creates and reopens bounded branching specializations without accepting another branching factor", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const tool = fileURLToPath(new URL("./divide-conquer-specialize.mjs", import.meta.url));
  const run = (args, input) => spawnSync(process.execPath, [tool, ...args], {
    input, encoding: "utf8", timeout: 60000, windowsHide: true
  });
  const reports = [];
  for (const branching_factor of ["2", "3", "16"]) {
    const request = { ...branchingCosts, branching_factor };
    const created = run(["-"], JSON.stringify(request));
    expect(created.status, created.stdout + created.stderr).toBe(0);
    const report = JSON.parse(created.stdout);
    expect(report).toMatchObject({ schema_version: branchingCosts.schema_version, status: "accepted", request, proof_checker_backed: true });
    expect(readFileSync(join(report.artifact_directory, "Specialized.lean"), "utf8")).toBe(specializationSource(request, branchingSource));
    const reopened = run(["--reopen", report.artifact_directory, "--expect-request-sha256", report.request_sha256]);
    expect(reopened.status, reopened.stdout + reopened.stderr).toBe(0);
    expect(JSON.parse(reopened.stdout)).toMatchObject({ status: "reopened", request, cached_report_used: false,
      expected_request_sha256: report.request_sha256, proof_checker_backed: true });
    reports.push(report);
  }
  const substituted = run(["--reopen", reports[1].artifact_directory, "--expect-request-sha256", reports[0].request_sha256]);
  expect(substituted.status).toBe(2);
  expect(JSON.parse(substituted.stdout).error).toContain("Saved request does not match expected request SHA-256");
  const invalid = run(["-"], JSON.stringify({ ...branchingCosts, branching_factor: "17" }));
  expect(invalid.status).toBe(2);
  expect(JSON.parse(invalid.stdout).proof_checker_backed).toBe(false);
}, 180000);
it("keeps the arbitrary-branching theorem explicit and free of proof escape hatches", () => {
  expect(branchingSource).toContain("theorem divide_conquer_branching_cost");
  expect(branchingSource).toContain("theorem divide_conquer_three_way");
  expect(branchingSource).not.toMatch(/\b(sorry|admit|axiom|native_decide)\b/);
  expect(branchingSource).not.toContain("?_");
  expect(branchingSource.match(/#guard_msgs/g)).toHaveLength(2);
});
it("checks the branching theorem and rejects corrupted public conclusions in pinned Lean", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
  for (const declaration of ["divide_conquer_branching_cost", "divide_conquer_three_way"]) {
    const checked = spawnSync(process.execPath, [cli, "proof", "check", branchingPath,
      "--declaration", declaration, "--timeout-ms", "30000", "--fail-on-unproved", "--json"],
    { encoding: "utf8", timeout: 45000, windowsHide: true });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    expect(JSON.parse(checked.stdout)).toMatchObject({ trust: "proved", proofCheckerBacked: true,
      source: { declarationName: declaration } });
  }
  const root = mkdtempSync(join(tmpdir(), "branching negatives "));
  const conclusion = "forall h, A h = (leaf + slope * (h : Int)) * branch ^ h + extra * BranchingCost.geometricSum branch h := by";
  try {
    for (const [index, wrong] of [
      conclusion.replace("leaf + slope", "slope"),
      conclusion.replace("branch ^ h", "2 ^ h"),
      conclusion.replace("+ extra *", "- extra *")
    ].entries()) {
      const corrupted = branchingSource.replace(conclusion, wrong);
      expect(corrupted).not.toBe(branchingSource);
      const file = join(root, `Wrong${index}.lean`);
      writeFileSync(file, corrupted);
      const result = spawnSync("lean", [file], { encoding: "utf8", timeout: 30000, windowsHide: true });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("error:");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
it("enumerates zero through four-way cost trees as finite supporting evidence", () => {
  for (const b of [0n, 1n, 2n, 3n, 4n]) {
    for (const [leaf, slope, extra] of [[2n, 4n, 5n], [0n, 0n, 0n], [-2n, 3n, -1n]]) {
      for (let h = 0; h <= 5; h++) {
        let total = 0n, sum = 0n;
        const stack = [h];
        while (stack.length) {
          const level = stack.pop();
          if (level === 0) total += leaf;
          else {
            total += slope * b ** BigInt(level) + extra;
            for (let child = 0n; child < b; child++) stack.push(level - 1);
          }
        }
        for (let j = 0; j < h; j++) sum += b ** BigInt(j);
        expect(total).toBe((leaf + slope * BigInt(h)) * b ** BigInt(h) + extra * sum);
      }
    }
  }
});
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
it("hands off created evidence to a fresh process without accepting a substituted valid bundle", () => {
  if (process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS !== "1") return;
  const tool = fileURLToPath(new URL("./divide-conquer-specialize.mjs", import.meta.url));
  const root = mkdtempSync(join(tmpdir(), "specialization handoff "));
  const candidate = join(root, "candidate bundle");
  const handoffPath = join(root, "trusted-handoff.json");
  const create = request => {
    const raw = JSON.stringify(request) + "\n";
    const result = spawnSync(process.execPath, [tool, "-"], {
      input: raw, encoding: "utf8", timeout: 60000, windowsHide: true
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({ status: "accepted", trust: "proved", proof_checker_backed: true, request });
    expect(report.request_sha256).toBe(createHash("sha256").update(raw).digest("hex"));
    return report;
  };
  const installCandidate = report => {
    for (const name of ["request.json", "Specialized.lean", "report.json"]) {
      copyFileSync(join(report.artifact_directory, name), join(candidate, name));
    }
  };
  // This consumer has no in-memory access to the creator's request or hash.
  const consumer = `
    const { readFileSync } = require('node:fs');
    const { spawnSync } = require('node:child_process');
    const handoff = JSON.parse(readFileSync(process.argv[1], 'utf8'));
    const result = spawnSync(process.execPath, [process.argv[2], '--reopen', handoff.artifact_directory,
      '--expect-request-sha256', handoff.request_sha256],
      { encoding: 'utf8', timeout: 60000, windowsHide: true, shell: false });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exitCode = result.status === 0 ? 0 : 2;
  `;
  const resume = () => spawnSync(process.execPath, ["-e", consumer, handoffPath, tool], {
    cwd: root, encoding: "utf8", timeout: 70000, windowsHide: true
  });
  try {
    mkdirSync(candidate);
    const original = create(costs);
    installCandidate(original);
    const handoff = JSON.stringify({ artifact_directory: candidate, request_sha256: original.request_sha256 }) + "\n";
    writeFileSync(handoffPath, handoff);
    const accepted = resume();
    expect(accepted.status, accepted.stdout + accepted.stderr).toBe(0);
    expect(JSON.parse(accepted.stdout)).toMatchObject({ status: "reopened", request: costs,
      request_sha256: original.request_sha256, expected_request_sha256: original.request_sha256,
      proof_checker_backed: true, cached_report_used: false });

    const other = create({ ...costs, leaf_cost: "7" });
    expect(other.request_sha256).not.toBe(original.request_sha256);
    installCandidate(other);
    const rejected = resume();
    expect(rejected.status).toBe(2);
    expect(JSON.parse(rejected.stdout)).toMatchObject({ status: "unverified", proof_checker_backed: false });
    expect(JSON.parse(rejected.stdout).error).toContain("Saved request does not match expected request SHA-256");
    expect(readFileSync(handoffPath, "utf8")).toBe(handoff);

    installCandidate(original);
    const recovered = resume();
    expect(recovered.status, recovered.stdout + recovered.stderr).toBe(0);
    expect(JSON.parse(recovered.stdout).request_sha256).toBe(original.request_sha256);
    expect(readFileSync(handoffPath, "utf8")).toBe(handoff);
  } finally { rmSync(root, { recursive: true, force: true }); }
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

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setImmediate } from "node:timers/promises";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { specializationSource } from "./divide-conquer-specialize.mjs";
import { scanSource } from "./prefix-scan.mjs";
import { treeSource } from "./tree-evaluate.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "apps/cli/dist/index.js");
const leanCommand = process.env.TRUTH_HARNESS_LEAN?.trim() || "lean";
const required = process.env.TRUTH_HARNESS_REQUIRE_LEAN_TESTS === "1";
const roots = [];
const example = name => join(repo, "docs/examples", name);
const source = name => readFileSync(example(name), "utf8");
const sha256 = text => createHash("sha256").update(text).digest("hex");

afterEach(async () => {
  for (const root of roots.splice(0)) {
    expect(dirname(root)).toBe(resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
  // Synchronous subprocesses must not starve Vitest's worker RPC replies.
  await setImmediate();
});

function scratch() {
  const root = mkdtempSync(join(tmpdir(), "lean-proof-admission-"));
  roots.push(root);
  return root;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repo, encoding: "utf8", timeout: 45000, maxBuffer: 1024 * 1024,
    windowsHide: true, shell: false, ...options
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.signal, result.stderr).toBeNull();
  return result;
}

function compile(text) {
  return run(leanCommand, ["--stdin"], { input: text });
}

function checkCli(file, target, { failOnUnproved = false, command = leanCommand, env = process.env } = {}) {
  return run(process.execPath, [cli, "proof", "check", file, "--json", "--timeout-ms", "30000",
    "--lean-command", command, ...(target ? ["--declaration", target] : []),
    ...(failOnUnproved ? ["--fail-on-unproved"] : [])], { env });
}

function expectUnverified(record, status = "rejected") {
  expect(record).toMatchObject({ status, trust: "unverified", proofCheckerBacked: false });
}

it(`${required ? "required" : "default (no real-Lean gate)"} mode keeps an explicitly unavailable CLI verifier unverified`, () => {
  const root = scratch();
  const file = join(root, "Ordinary.lean");
  const missingCommand = join(root, "no-such-lean");
  expect(existsSync(missingCommand)).toBe(false);
  writeFileSync(file, "theorem ordinary : True := by trivial\n");
  for (const failOnUnproved of [false, true]) {
    const checked = checkCli(file, "ordinary", { command: missingCommand, failOnUnproved });
    expect(checked.status, checked.stdout + checked.stderr).toBe(failOnUnproved ? 1 : 0);
    expectUnverified(JSON.parse(checked.stdout), "backend-unavailable");
  }
}, 30000);

// Required CI mode registers real checks, never silently returns on a missing Lean.
if (required) describe("required Lean 4.12 compilation and fail-closed admission (no trusted checker adapter)", () => {
  beforeAll(() => {
    expect(process.env.TRUTH_HARNESS_CONTAINER).toBe("1");
    const version = run(leanCommand, ["--version"]);
    expect(version.status, version.stdout + version.stderr).toBe(0);
    expect(version.stdout + version.stderr).toMatch(/\bLean \(version 4\.12\.0(?:,|\))/);
  });

  it.each(["DivideConquer.lean", "BranchingCost.lean", "ParallelReduction.lean"])(
    "compiles repo-owned %s directly for diagnostics, not a trusted receipt", name => {
      const checked = run(leanCommand, [example(name)]);
      expect(checked.status, checked.stdout + checked.stderr).toBe(0);
      const diagnostics = checked.stdout + checked.stderr;
      expect(diagnostics).not.toMatch(/error:|sorryAx|declaration uses 'sorry'/);
      expect(diagnostics.match(/warning:.*$/gm) ?? []).toEqual(name === "ParallelReduction.lean"
        ? Array(3).fill("warning: unused variable `value`") : []);
    }, 60000
  );

  const divide = source("DivideConquer.lean");
  const branching = source("BranchingCost.lean");
  const parallel = source("ParallelReduction.lean");
  const divideClosed = "forall h, A h = ((h : Int) - 1) * 2 ^ h + 1 :=";
  const divideFamily = "forall h, A h = (leaf + extra + slope * (h : Int)) * 2 ^ h - extra :=";
  const branchConclusion = "forall h, A h = (leaf + slope * (h : Int)) * branch ^ h + extra * BranchingCost.geometricSum branch h := by";
  const wrongStatements = [
    ["divide initial value", divide, divide.replaceAll("ha1 : A 1 = 1", "ha1 : A 1 = 2")],
    ["divide residual sign", divide, divide.replaceAll("4 * A (h + 1) - 4 * A h + 1", "4 * A (h + 1) - 4 * A h - 1")],
    ["divide closed constant", divide, divide.replace(divideClosed, divideClosed.replace("+ 1", "+ 2"))],
    ["divide closed base", divide, divide.replace(divideClosed, divideClosed.replace("2 ^ h", "3 ^ h"))],
    ["divide leaf cost", divide, divide.replace(divideFamily, divideFamily.replace("leaf + ", ""))],
    ["divide slope", divide, divide.replace(divideFamily, divideFamily.replace("slope *", "2 * slope *"))],
    ["divide extra sign", divide, divide.replace(divideFamily, divideFamily.replace("- extra", "+ extra"))],
    ["branch leaf cost", branching, branching.replace(branchConclusion, branchConclusion.replace("leaf + slope", "slope"))],
    ["branch base", branching, branching.replace(branchConclusion, branchConclusion.replace("branch ^ h", "2 ^ h"))],
    ["branch extra sign", branching, branching.replace(branchConclusion, branchConclusion.replace("+ extra *", "- extra *"))],
    ["parallel work", parallel, parallel.replace("W h = 4 ^ h - 1 /\\", "W h = 4 ^ h + 1 /\\")],
    ["parallel span", parallel, parallel.replace("S h = 3 * (h : Int)", "S h = (h : Int)")],
    ["scan leaf output", parallel, parallel.replace("output := (offset + value) :: tail", "output := offset :: tail")],
    ["scan leaf additions", parallel, parallel.replace("additions := 1, consCells", "additions := 0, consCells")],
    ["scan fork additions", parallel, parallel.replace("left.additions + right.additions + 1", "left.additions + 1")],
    ["scan tail cells", parallel, parallel.replace("consCells := 1 }", "consCells := tail.length + 1 }")],
    ["scan fork cells", parallel, parallel.replace("consCells := left.consCells + right.consCells", "consCells := left.consCells")]
  ];
  it.each(wrongStatements)("rejects the wrong %s statement in direct Lean compilation", (_name, original, changed) => {
    expect(changed).not.toBe(original);
    const rejected = compile(changed);
    expect(rejected.status, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout + rejected.stderr).toContain("error:");
  }, 60000);

  const cliCases = [
    ["ordinary theorem", "theorem target : True := by trivial\n"],
    ["explicit sorryAx", "theorem target : False := sorryAx False true\n"],
    ["missing target", "theorem actual : True := by trivial\n"],
    ["non-theorem target", "def target : True := True.intro\n"],
    ["theorem with compiler diagnostics", "theorem target : True := by trivial\n#check target\n"]
  ];
  function expectCompilationOnlyCli(text, env = process.env) {
    const file = join(scratch(), "Admission.lean");
    writeFileSync(file, text);
    for (const failOnUnproved of [false, true]) {
      const checked = checkCli(file, "target", { failOnUnproved, env });
      expect(checked.status, checked.stdout + checked.stderr).toBe(failOnUnproved ? 1 : 0);
      const record = JSON.parse(checked.stdout);
      expectUnverified(record);
      expect(record.backend.exitCode, record.stdout || record.stderr || record.error).toBe(0);
      expect(record.backend.args).toEqual(["--stdin"]);
      expect(record.source.sha256).toBe(sha256(text));
      expect(record.limitations.join(" ")).toContain("trusted independent kernel check and transitive axiom audit is missing");
    }
  }
  it.each(cliCases)("keeps CLI %s unverified and fails --fail-on-unproved", (_name, text) => {
    expectCompilationOnlyCli(text);
  }, 120000);

  it("keeps the CLI imported-false-axiom theorem unverified and fails --fail-on-unproved", () => {
    const root = scratch();
    writeFileSync(join(root, "FalseAxiom.lean"), "axiom importedFalse : False\n");
    const compiled = run(leanCommand, ["-o", "FalseAxiom.olean", "FalseAxiom.lean"], { cwd: root });
    expect(compiled.status, compiled.stdout + compiled.stderr).toBe(0);
    const env = { ...process.env, LEAN_PATH: [root, process.env.LEAN_PATH].filter(Boolean).join(delimiter) };
    expectCompilationOnlyCli("import FalseAxiom\ntheorem target : False := importedFalse\n#print axioms target\n", env);
  }, 120000);

  const generators = [
    { name: "divide-conquer", tool: "divide-conquer-specialize.mjs", fixture: "cs-divide-conquer-costs.json", generate: request => specializationSource(request, divide) },
    { name: "branching", tool: "divide-conquer-specialize.mjs", fixture: "cs-branching-costs.json", generate: request => specializationSource(request, branching) },
    { name: "bounded tree", tool: "tree-evaluate.mjs", fixture: "tree-evaluation.json", generate: request => treeSource(request, parallel) },
    { name: "bounded prefix", tool: "prefix-scan.mjs", fixture: "prefix-scan.json", generate: request => scanSource(request, parallel) }
  ];
  it.each(generators)("compiles valid $name generated source but refuses trusted specialization results", ({ tool, fixture, generate }) => {
    const raw = source(fixture);
    const generated = compile(generate(JSON.parse(raw)));
    expect(generated.status, generated.stdout + generated.stderr).toBe(0);
    for (const args of [[example(fixture)], ["-"]]) {
      const checked = run(process.execPath, [join(repo, "tools", tool), ...args], { input: raw, timeout: 60000 });
      expect(checked.status, checked.stdout + checked.stderr).toBe(2);
      const report = JSON.parse(checked.stdout);
      expect(report).toMatchObject({ status: "unverified", proof_checker_backed: false });
      expect(report.trust).not.toBe("proved");
      expect(report).not.toHaveProperty("results");
      expect(report.error).toContain("Lean adapter did not accept the specialization (exit 1)");
    }
  }, 180000);

  it.each([
    ["tree result", treeSource(JSON.parse(source("tree-evaluation.json")), parallel), "= ((6 : Int), 3)", "= ((7 : Int), 3)"],
    ["prefix result", scanSource(JSON.parse(source("prefix-scan.json")), parallel), "[(5 : Int), (7 : Int), (16 : Int)]", "[(5 : Int), (7 : Int), (17 : Int)]"],
    ["prefix additions", scanSource(JSON.parse(source("prefix-scan.json")), parallel), "submittedScan.additions = (5 : Int)", "submittedScan.additions = (4 : Int)"]
  ])("rejects the wrong generated %s in direct Lean compilation", (_name, original, from, to) => {
    const changed = original.replace(from, to);
    expect(changed).not.toBe(original);
    const checked = compile(changed);
    expect(checked.status, checked.stdout + checked.stderr).toBe(1);
    expect(checked.stdout + checked.stderr).toContain("error:");
  }, 60000);
});

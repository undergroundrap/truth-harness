import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const schema = "truth-harness.lean-prefix-check.v0";
const theorem = "prefix_range_sum";
const leanVersion = "4.36.0";
const fixtureDirectory = "/opt/prefix-proof";
const permittedAxioms = ["propext", "Quot.sound", "Classical.choice"];
const sha256 = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const report = value => process.stdout.write(JSON.stringify({ schema_version: schema, ...value }, null, 2) + "\n");

function run(cwd, program, args) {
  const child = spawnSync(`/opt/lean/bin/${program}`, args, {
    cwd, encoding: "utf8", timeout: 30000, killSignal: "SIGKILL", maxBuffer: 64 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (child.error) throw child.error;
  const diagnostic = [child.stdout, child.stderr].filter(Boolean).join("\n").trim();
  return { status: child.status, stdout: child.stdout, stderr: child.stderr, diagnostic };
}

function requireSuccess({ status, diagnostic }) {
  assert.equal(status, 0, diagnostic || "Lean command did not complete successfully");
}

function compare(work, solution) {
  const configPath = join(work, "comparator.json");
  writeFileSync(configPath, JSON.stringify({
    challenge_module: "Challenge",
    solution_module: solution,
    theorem_names: [theorem],
    permitted_axioms: permittedAxioms,
    external_kernels: { nanoda: ["/opt/lean/bin/nanoda_bin"] }
  }) + "\n", { flag: "wx" });

  requireSuccess(run(work, "lake", ["update"]));
  // Docker is the isolation boundary for the fixed, reviewed image fixtures.
  // Do not use this invocation for third-party proof source.
  const verdict = run(work, "lake", ["comparator", "--inadvisably-no-sandbox"]);
  return {
    ...verdict,
    hashes: {
      challenge_sha256: sha256(join(work, "Challenge.lean")),
      solution_sha256: sha256(join(work, `${solution}.lean`)),
      lake_config_sha256: sha256(join(work, "lakefile.toml")),
      comparator_config_sha256: sha256(configPath)
    }
  };
}

function check(solution) {
  const work = mkdtempSync(join(tmpdir(), "truth-harness-lean-prefix-"));
  try {
    for (const file of ["lakefile.toml", "Challenge.lean", `${solution}.lean`]) {
      copyFileSync(join(fixtureDirectory, file), join(work, file));
    }
    const version = run(work, "lean", ["--version"]);
    requireSuccess(version);
    assert.match(version.diagnostic, /^Lean \(version 4\.36\.0,/);
    return compare(work, solution);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function requireRejection(verdict, expectedError) {
  assert.equal(verdict.status, 1, verdict.diagnostic);
  assert.ok(verdict.stderr.split(/\r?\n/).includes(expectedError), verdict.diagnostic);
}

try {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--self-test"),
    "Expected no arguments or --self-test");
  assert.ok(process.platform === "linux" && process.getuid() !== 0,
    "Use the non-root, offline Docker pilot");

  const positive = check("Solution");
  requireSuccess(positive);
  for (const marker of ["Lean default kernel accepts the solution", "nanoda kernel accepts the solution"]) {
    assert.ok(positive.stdout.split(/\r?\n/).includes(marker), `Missing checker verdict: ${marker}`);
  }
  const tests = {};
  if (args.length) {
    requireRejection(check("DifferentStatement"),
      `error: Challenge and solution theorem statement do not match: '${theorem}'`);
    tests.different_statement = { status: "rejected", reason: "statement_mismatch" };
    requireRejection(check("Unfinished"), "error: Illegal axiom detected: 'sorryAx'");
    tests.unfinished_proof = { status: "rejected", reason: "forbidden_axiom" };
  }
  report({
    status: "accepted",
    trust: "proved",
    proof_checker_backed: true,
    theorem,
    evidence_scope: "bundled-lean-list-int-range-sum",
    lean_version: leanVersion,
    checker: "lake comparator",
    kernels: ["lean", "nanoda"],
    permitted_axioms: permittedAxioms,
    ...positive.hashes,
    ...(args.length ? { negative_controls: tests } : {}),
    limitations: [
      "Only the bundled formal statement about Lean integer lists was checked.",
      "No implementation equivalence, machine overflow, or performance guarantee.",
      "The Docker launch settings are required but are not attested by this receipt.",
      "Standalone pilot receipt; not admissible to the general workspace proof gate."
    ]
  });
} catch (error) {
  report({ status: "unverified", trust: "unverified", proof_checker_backed: false, error: error.message });
  process.exitCode = 2;
}

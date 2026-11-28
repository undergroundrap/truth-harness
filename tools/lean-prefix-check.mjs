import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const leanVersion = "4.36.0";
const permittedAxioms = ["propext", "Quot.sound", "Classical.choice"];
const prefixPilot = {
  schema: "truth-harness.lean-prefix-check.v0",
  theorem: "prefix_range_sum",
  fixtureDirectory: "/opt/prefix-proof",
  scope: "bundled-lean-list-int-range-sum",
  modelFiles: [],
  unfinishedSource: "Unfinished",
  limitations: [
    "Only the bundled formal statement about Lean integer lists was checked.",
    "No implementation equivalence, machine overflow, or performance guarantee."
  ]
};
const bfsPilot = {
  schema: "truth-harness.lean-bfs-check.v0",
  theorem: "bfs_certificate_sound",
  fixtureDirectory: "/opt/bfs-proof",
  scope: "bundled-lean-directed-unit-edge-distance-certificate",
  modelFiles: ["BfsModel.lean"],
  unfinishedSource: "Challenge",
  limitations: [
    "The four certificate conditions imply the stated conclusion for the directed unit-edge walk model.",
    "No proof of the JavaScript checker, JSON parser, Python producer, or weighted distances."
  ]
};
const sha256 = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const report = (pilot, value) =>
  process.stdout.write(JSON.stringify({ schema_version: pilot.schema, ...value }, null, 2) + "\n");

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

function compare(pilot, work, solution) {
  const configPath = join(work, "comparator.json");
  writeFileSync(configPath, JSON.stringify({
    challenge_module: "Challenge",
    solution_module: solution,
    theorem_names: [pilot.theorem],
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
      comparator_config_sha256: sha256(configPath),
      ...(pilot.modelFiles.length ? {
        model_file_sha256: Object.fromEntries(pilot.modelFiles.map(file => [file, sha256(join(work, file))]))
      } : {})
    }
  };
}

function check(pilot, solution, source = solution) {
  const work = mkdtempSync(join(tmpdir(), "truth-harness-lean-check-"));
  try {
    for (const file of ["lakefile.toml", "Challenge.lean", ...pilot.modelFiles]) {
      copyFileSync(join(pilot.fixtureDirectory, file), join(work, file));
    }
    copyFileSync(join(pilot.fixtureDirectory, `${source}.lean`), join(work, `${solution}.lean`));
    const version = run(work, "lean", ["--version"]);
    requireSuccess(version);
    assert.match(version.diagnostic, /^Lean \(version 4\.36\.0,/);
    return compare(pilot, work, solution);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function requireRejection(verdict, expectedError) {
  assert.equal(verdict.status, 1, verdict.diagnostic);
  assert.ok(verdict.stderr.split(/\r?\n/).includes(expectedError), verdict.diagnostic);
}

const args = process.argv.slice(2);
const pilot = args[0] === "--bfs" ? bfsPilot : prefixPilot;
if (pilot === bfsPilot) args.shift();

try {
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--self-test"),
    "Expected [--bfs] [--self-test]");
  assert.ok(process.platform === "linux" && process.getuid() !== 0,
    "Use the non-root, offline Docker pilot");

  const positive = check(pilot, "Solution");
  requireSuccess(positive);
  for (const marker of ["Lean default kernel accepts the solution", "nanoda kernel accepts the solution"]) {
    assert.ok(positive.stdout.split(/\r?\n/).includes(marker), `Missing checker verdict: ${marker}`);
  }
  const tests = {};
  if (args.length) {
    requireRejection(check(pilot, "DifferentStatement"),
      `error: Challenge and solution theorem statement do not match: '${pilot.theorem}'`);
    tests.different_statement = { status: "rejected", reason: "statement_mismatch" };
    requireRejection(check(pilot, "Unfinished", pilot.unfinishedSource), "error: Illegal axiom detected: 'sorryAx'");
    tests.unfinished_proof = { status: "rejected", reason: "forbidden_axiom" };
  }
  report(pilot, {
    status: "accepted",
    trust: "proved",
    proof_checker_backed: true,
    theorem: pilot.theorem,
    evidence_scope: pilot.scope,
    lean_version: leanVersion,
    checker: "lake comparator",
    kernels: ["lean", "nanoda"],
    permitted_axioms: permittedAxioms,
    ...positive.hashes,
    ...(args.length ? { negative_controls: tests } : {}),
    limitations: [
      ...pilot.limitations,
      "The Docker launch settings are required but are not attested by this receipt.",
      "Standalone pilot receipt; not admissible to the general workspace proof gate."
    ]
  });
} catch (error) {
  report(pilot, { status: "unverified", trust: "unverified", proof_checker_backed: false, error: error.message });
  process.exitCode = 2;
}

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const experiment = fileURLToPath(new URL("./bezier-experiment.mjs", import.meta.url));
const json = value => JSON.stringify(value, null, 2) + "\n";

export function assessRun(run, missingVerifier = false) {
  assert.equal(run.error, null, "Subprocess launch or timeout failure is not a passing gate");
  assert.equal(run.signal, null, "Terminated subprocess is not a passing gate");
  assert.equal(run.exit_code, missingVerifier ? 2 : 0);
  const result = JSON.parse(run.stdout);
  if (missingVerifier) {
    assert.equal(result.status, "unverified");
    assert.equal(typeof result.error, "string");
    assert.ok(result.error.startsWith("Both symbolic engines must agree"), "Unrelated failures do not count as missing-verifier rejection");
    assert.equal(result.mutation, undefined);
  } else {
    assert.equal(result.schema_version, "truth-harness.bezier-experiment.v0");
    assert.deepEqual(result.basis_identities, { status: "cross-checked", count: 4 });
    assert.equal(result.denominator_mapping, "cross-checked");
    assert.deepEqual(result.mutation, {
      schema_version: "truth-harness.bezier-counterexample.v0", status: "refuted",
      evidence_class: "exact-rational-counterexample", proof_checker_backed: false,
      controls: ["0", "1", "0", "0"], parameter: "1/2",
      de_casteljau: "3/8", faulty_horner: "1/2", difference: "-1/8",
    });
    assert.match(result.artifact_directory, /^\.truth-harness\/experiments\/bezier-[A-Za-z0-9]+$/);
    assert.match(result.witness_directory, /^\.truth-harness\/witnesses\/pit-[A-Za-z0-9]+$/);
  }
  return result;
}

export async function runGate() {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Run the gate in the offline Docker service");
  const root = path.join(repo, ".truth-harness", "experiments");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, "bezier-gate-"));
  const cases = [];
  for (const missingVerifier of [false, true]) {
    const id = missingVerifier ? "missing-maxima" : "full-experiment";
    const env = { ...process.env };
    if (missingVerifier) env.TRUTH_HARNESS_MAXIMA = path.join(directory, "nonexistent-maxima");
    const child = spawnSync(process.execPath, [experiment], {
      env, cwd: repo, encoding: "utf8", timeout: 240000, maxBuffer: 2 * 1024 * 1024,
      shell: false, windowsHide: true,
    });
    const run = { exit_code: child.status, signal: child.signal, error: child.error?.message ?? null,
      stdout: child.stdout ?? "", stderr: child.stderr ?? "" };
    await writeFile(path.join(directory, `${id}.json`), json(run), "utf8");
    try {
      const result = assessRun(run, missingVerifier);
      cases.push({ id, passed: true, artifact_directory: result.artifact_directory ?? null });
    } catch (error) {
      cases.push({ id, passed: false, error: error.message });
    }
  }
  const report = { schema_version: "truth-harness.bezier-gate.v0", recorded_at: new Date().toISOString(),
    passed: cases.every(c => c.passed), cases,
    artifact_directory: path.relative(repo, directory).split(path.sep).join("/") };
  await writeFile(path.join(directory, "report.json"), json(report), "utf8");
  await writeFile(path.join(directory, "PROGRESS.md"),
    `# Bezier Regression Gate\n\nRecorded: ${report.recorded_at}\n\nPassed: ${report.passed}\n\n` +
    "[Report](report.json) | [Full experiment output](full-experiment.json) | [Missing Maxima output](missing-maxima.json)\n\n" +
    "This is a regression gate for a fixed rational-arithmetic experiment, not a formal proof or floating-point guarantee.\n", "utf8");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 2, "Usage: bezier-gate.mjs");
    const report = await runGate();
    process.stdout.write(json(report));
    process.exitCode = report.passed ? 0 : 1;
  } catch (error) {
    process.stdout.write(json({ status: "tool-failure", error: error.message }));
    process.exitCode = 2;
  }
}

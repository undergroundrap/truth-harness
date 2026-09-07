import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { main as witness, boundedInput } from "./pit-witness.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
export const fixturePath = fileURLToPath(new URL("../docs/examples/pit-witness-benchmark.json", import.meta.url));
const json = value => JSON.stringify(value, null, 2) + "\n";
const relative = file => path.relative(repo, file).split(path.sep).join("/");

export function compareOutcome(expected, receipt, report, replay) {
  const actual = { status: receipt.status, reason: receipt.reason,
    sample_index: receipt.witness?.sample_index ?? null, value: receipt.witness?.value ?? null };
  assert.deepEqual(actual, expected, "Unexpected benchmark outcome");
  const checked = expected.status === "witness-found";
  const trust = checked ? "exact-computed" : "unverified";
  for (const evidence of [report, replay]) {
    assert.equal(evidence.status, expected.status);
    assert.equal(evidence.checked, checked);
    assert.equal(evidence.trust, trust);
  }
  assert.equal(report.request_sha256, replay.request_sha256);
  assert.equal(report.receipt_sha256, replay.receipt_sha256);
  return actual;
}

export async function runBenchmark() {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker pit-experiment service");
  const raw = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(raw);
  assert.equal(fixture.schema_version, "truth-harness.pit-witness-benchmark.v0");
  assert.ok(Array.isArray(fixture.cases) && fixture.cases.length === 10);
  const ids = fixture.cases.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => /^[a-z0-9-]+$/.test(id)));
  const root = path.join(repo, ".truth-harness", "experiments");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, "pit-witness-benchmark-"));
  await writeFile(path.join(directory, "suite.json"), raw, "utf8");
  const cases = [];
  for (const entry of fixture.cases) {
    const requestPath = path.join(directory, `${entry.id}.request.json`);
    await writeFile(requestPath, json(entry.request), "utf8");
    let report;
    try {
      report = await witness([requestPath]);
      const artifacts = path.join(repo, report.artifact_directory);
      const receiptPath = path.join(artifacts, "receipt.json");
      const receipt = JSON.parse(await boundedInput(receiptPath));
      const replay = await witness(["--check", path.join(artifacts, "request.json"), receiptPath]);
      await writeFile(path.join(directory, `${entry.id}.replay.json`), json(replay), "utf8");
      const actual = compareOutcome(entry.expected, receipt, report, replay);
      cases.push({ id: entry.id, passed: true, actual, checked: replay.checked,
        artifact_directory: report.artifact_directory, replay_file: relative(path.join(directory, `${entry.id}.replay.json`)) });
    } catch (error) {
      cases.push({ id: entry.id, passed: false, error: error.message, artifact_directory: report?.artifact_directory ?? null });
    }
  }
  const report = {
    schema_version: "truth-harness.pit-witness-benchmark-report.v0",
    recorded_at: new Date().toISOString(),
    suite_sha256: createHash("sha256").update(raw).digest("hex"),
    artifact_directory: relative(directory),
    total: cases.length, passed: cases.filter(c => c.passed).length,
    checked_witnesses: cases.filter(c => c.passed && c.checked).length,
    expected_unknowns: cases.filter(c => c.passed && !c.checked).length,
    failed: cases.filter(c => !c.passed).length,
    limitations: "Synthetic regression cases, not novel problems or a general success rate. Expected unknowns remain unverified; diagnostic matching is not proof.",
    cases,
  };
  await writeFile(path.join(directory, "report.json"), json(report), "utf8");
  const rows = cases.map(c => `| ${c.id} | ${c.passed ? "pass" : "FAIL"} | ${c.actual?.status ?? "failure"} | ${c.artifact_directory ? `[receipt](${path.relative(directory, path.join(repo, c.artifact_directory, "receipt.json")).split(path.sep).join("/")})` : "none"} |`);
  await writeFile(path.join(directory, "PROGRESS.md"),
    `# Sparse Witness Benchmark\n\nRecorded: ${report.recorded_at}\n\n[Suite](suite.json) | [Report](report.json)\n\n` +
    `${report.passed}/${report.total} expectations matched; ${report.checked_witnesses} checked witnesses; ${report.expected_unknowns} expected unresolved results.\n\n` +
    `${report.limitations}\n\n| Case | Expectation | Outcome | Evidence |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n`, "utf8");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 2, "Usage: pit-witness-benchmark.mjs (fixed checked-in suite)");
    const report = await runBenchmark();
    process.stdout.write(json(report));
    process.exitCode = report.failed ? 1 : 0;
  } catch (error) {
    process.stdout.write(json({ status: "tool-failure", error: error.message }));
    process.exitCode = 2;
  }
}

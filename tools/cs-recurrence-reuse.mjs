import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkRecurrence } from "./polynomial-recurrence.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const json = value => JSON.stringify(value, null, 2) + "\n";
const relative = value => path.relative(repo, value).split(path.sep).join("/");

export async function runRecurrenceReuse() {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker pit-experiment service");
  const root = path.join(repo, ".truth-harness", "experiments");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, "cs-recurrence-reuse-"));
  const sourcePath = path.join(repo, "docs/examples/exponential-recurrence-tree.json");
  const source = await checkRecurrence([sourcePath]);
  assert.equal(source.status, "identity-checked");
  const receiptPath = path.join(repo, source.artifact_directory, "receipt.json");
  const original = JSON.parse(await readFile(sourcePath, "utf8"));

  // A different workload may reuse this receipt only after supplying the same formal model.
  const targetPath = path.join(directory, "recursive-calls.request.json");
  await writeFile(targetPath, json(original), "utf8");
  const reused = await checkRecurrence(["--check", targetPath, receiptPath]);
  assert.equal(reused.status, "identity-checked");
  assert.equal(reused.receipt_sha256, source.receipt_sha256);

  const changed = { ...original, initial_values: ["0"] };
  const changedPath = path.join(directory, "internal-work.request.json");
  await writeFile(changedPath, json(changed), "utf8");
  // A checker failure is not itself a refutation. Require the specific binding failure.
  let rejection;
  try { await checkRecurrence(["--check", changedPath, receiptPath]); }
  catch (error) {
    assert.match(error.message, /Request mismatch/);
    rejection = { status: "reuse-rejected", reason: "request-mismatch", parent_receipt_sha256: source.receipt_sha256 };
  }
  assert.ok(rejection, "Changed initial conditions must not reuse the source receipt");
  const refuted = await checkRecurrence([changedPath]);
  assert.equal(refuted.status, "refuted");
  assert.deepEqual(refuted.counterexample, { index: 0, candidate_value: "1", sequence_value: "0" });

  const repaired = { ...changed, candidate: original.candidate.map(t => t.base === "2" ? { ...t, coefficient: "1" } : t) };
  const repairedPath = path.join(directory, "internal-work-repaired.request.json");
  await writeFile(repairedPath, json(repaired), "utf8");
  const corrected = await checkRecurrence([repairedPath]);
  assert.equal(corrected.status, "identity-checked");
  const report = { schema_version: "truth-harness.cs-recurrence-reuse.v0", passed: true,
    recorded_at: new Date().toISOString(), artifact_directory: relative(directory),
    modeling_status: "human-supplied-not-code-verified", source, reused, rejection, refuted, corrected,
    replay: { request: relative(targetPath), receipt: relative(receiptPath) },
    limitations: "Scripted reuse demonstration, not autonomous discovery or source-code verification. Only the supplied recurrence is checked. Matching formal models do not prove that two programs implement them. Exact arithmetic evidence, not a Lean proof." };
  await writeFile(path.join(directory, "report.json"), json(report), "utf8");
  await writeFile(path.join(directory, "PROGRESS.md"), `# Recurrence Reuse\n\nRecorded: ${report.recorded_at}\n\n` +
    "Reused the checked node-count receipt for a matching recursive-call model. Changing leaf cost from 1 to 0 rejected reuse; the old formula was refuted at height 0. The corrected internal-work formula was checked separately.\n\n" +
    "[Report and source receipt hashes](report.json) | [Matching model](recursive-calls.request.json) | [Changed model](internal-work.request.json) | [Corrected model](internal-work-repaired.request.json)\n\n" +
    `${report.limitations}\n`, "utf8");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 2, "Usage: cs-recurrence-reuse.mjs");
    process.stdout.write(json(await runRecurrenceReuse()));
  } catch (error) {
    process.stdout.write(json({ schema_version: "truth-harness.cs-recurrence-reuse.v0", passed: false, status: "unverified", error: error.message }));
    process.exitCode = 2;
  }
}

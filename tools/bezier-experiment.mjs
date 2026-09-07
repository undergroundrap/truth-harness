import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { main as witness, boundedInput } from "./pit-witness.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const checker = fileURLToPath(new URL("./bezier-counterexample.py", import.meta.url));
const json = value => JSON.stringify(value, null, 2) + "\n";
export const identities = [
  "(1-x)^3-(1-3*x+3*x^2-x^3)",
  "3*x*(1-x)^2-(3*x-6*x^2+3*x^3)",
  "3*x^2*(1-x)-(3*x^2-3*x^3)",
  "x^3-x^3",
  // t=1/x, x>0: multiply the correct-minus-faulty residual by x^3.
  "x^3*(3*(1/x)*(1-1/x)^2-(3/x-5/x^2+2/x^3))-(1-x)",
];
export const request = {
  schema_version: "truth-harness.pit-witness-request.v0", variables: 1,
  terms: [{ coefficient: "1", exponents: [0] }, { coefficient: "-1", exponents: [1] }],
  budget: { max_samples: 2, max_bits: 128 },
};

function execute(command, args, input) {
  const result = spawnSync(command, args, { input, encoding: "utf8", timeout: 30000,
    maxBuffer: 2 * 1024 * 1024, shell: false, windowsHide: true, cwd: repo });
  assert(!result.error, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

export function requireIdentity(receipt, expression) {
  assert.equal(receipt.problem, `symbolic simplify ${expression}`);
  assert.equal(receipt.trust, "cross-checked", "Both symbolic engines must agree");
  const computation = receipt.artifacts.filter(a => a.kind === "symbolic-computation-result");
  assert.equal(computation.length, 1);
  const result = JSON.parse(computation[0].content);
  assert.equal(result.expression, expression);
  assert.equal(result.result, "0", "Nonzero residual is not an identity");
  assert.equal(result.checkStatus, "passed");
  assert.equal(result.independentCasStatus, "passed");
}

export function checkCounterexample(receipt) {
  return execute("python", ["-S", checker], JSON.stringify(receipt));
}

export async function runBezierExperiment() {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker pit-experiment service");
  const root = path.join(repo, ".truth-harness", "experiments");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, "bezier-"));
  await writeFile(path.join(directory, "inputs.json"), json({ identities, request }), "utf8");
  for (const [index, expression] of identities.entries()) {
    const receipt = execute(process.execPath, [path.join(repo, "apps/cli/dist/index.js"), "ask", `symbolic simplify ${expression}`, "--json"]);
    await writeFile(path.join(directory, `identity-${index}.json`), json(receipt), "utf8");
    requireIdentity(receipt, expression);
  }
  const inputPath = path.join(directory, "request.json");
  await writeFile(inputPath, json(request), "utf8");
  const report = await witness([inputPath]);
  assert.equal(report.checked, true);
  const receiptPath = path.join(repo, report.artifact_directory, "receipt.json");
  const receipt = JSON.parse(await boundedInput(receiptPath));
  const counterexample = checkCounterexample(receipt);
  const replay = checkCounterexample(JSON.parse(await boundedInput(receiptPath)));
  assert.deepEqual(replay, counterexample);
  await writeFile(path.join(directory, "counterexample.json"), json(counterexample), "utf8");
  await writeFile(path.join(directory, "replay.json"), json(replay), "utf8");
  const summary = {
    schema_version: "truth-harness.bezier-experiment.v0", recorded_at: new Date().toISOString(),
    basis_identities: { status: "cross-checked", count: 4 },
    denominator_mapping: "cross-checked", mutation: counterexample,
    artifact_directory: path.relative(repo, directory).split(path.sep).join("/"),
    witness_directory: report.artifact_directory,
    witness_receipt_sha256: report.receipt_sha256,
    direct_checker_sha256: createHash("sha256").update(await readFile(checker)).digest("hex"),
    limitations: "Fixed deliberately faulty formula, not a discovered engine bug. Rational arithmetic only; no floating-point, performance, or formal-proof guarantee.",
  };
  await writeFile(path.join(directory, "report.json"), json(summary), "utf8");
  const witnessLink = path.relative(directory, receiptPath).split(path.sep).join("/");
  await writeFile(path.join(directory, "PROGRESS.md"),
    `# Cubic Bezier Equivalence Experiment\n\nRecorded: ${summary.recorded_at}\n\n` +
    `[Inputs](inputs.json) | [Report](report.json) | [Counterexample](counterexample.json) | [Replay](replay.json) | [Witness](${witnessLink})\n\n` +
    "Four basis identities and the denominator mapping were cross-checked by SymPy and Maxima.\n\n" +
    `For controls (0,1,0,0), t=${counterexample.parameter}: de Casteljau=${counterexample.de_casteljau}, faulty Horner=${counterexample.faulty_horner}, difference=${counterexample.difference}.\n\n` +
    summary.limitations + "\n", "utf8");
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 2, "Usage: bezier-experiment.mjs (fixed experiment)");
    process.stdout.write(json(await runBezierExperiment()));
  } catch (error) {
    process.stdout.write(json({ status: "unverified", error: error.message }));
    process.exitCode = 2;
  }
}

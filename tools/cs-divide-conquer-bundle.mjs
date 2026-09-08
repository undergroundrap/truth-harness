import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedInput } from "./pit-witness.mjs";
import { comparePolynomials } from "./polynomial-compare.mjs";
import { checkRecurrence } from "./polynomial-recurrence.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const version = "truth-harness.cs-divide-conquer-bundle.v0";
const json = value => JSON.stringify(value, null, 2) + "\n";
const sha = value => createHash("sha256").update(value).digest("hex");
const definitions = [
  { id: "reduction", operation: "compare", fixture: "reduction", depends_on: [] },
  { id: "initial-defect", operation: "compare", fixture: "initial-defect", depends_on: [] },
  { id: "recurrence", operation: "recurrence", fixture: "correct", depends_on: ["reduction", "initial-defect"] }
];
const assumptions = [
  "The cost model is T(1)=0 and T(n)=2*T(n/2)+n-1 for powers of two only; no source code is verified.",
  "Sparse inputs are reviewed transcriptions with a=A(h), b=A(h+1), c=A(h+2), q=2^(h+1); exponent shifting q -> 2*q is assumed.",
  "Ordinary induction propagates D(0)=0 using D(h+1)=2*D(h); this argument is not kernel-checked.",
  "Dependency links express human-reviewed argument order, not a mechanically checked inference rule."
];
const fixturePath = step => path.join(repo, `docs/examples/cs-divide-conquer-${step.fixture}.json`);
const checker = step => step.operation === "compare" ? comparePolynomials : checkRecurrence;
const expectedStatus = step => step.operation === "compare" ? "equivalent" : "identity-checked";
function keys(value, expected) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected object");
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), "Unexpected bundle fields");
}
async function inside(root, name) {
  const resolved = await realpath(path.join(root, name));
  const relative = path.relative(root, resolved);
  assert.ok(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), "Bundle file escapes directory");
  return resolved;
}
function accepted(step, report) {
  assert.equal(report.status, expectedStatus(step), "Required evidence is not accepted");
  assert.equal(report.checked, true);
  assert.equal(report.trust, "exact-computed");
  assert.equal(report.proof_checker_backed, false);
}

export async function replayDivideConquerBundle(manifestPath) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker pit-experiment service");
  const manifest = await realpath(manifestPath), root = path.dirname(manifest);
  const raw = await boundedInput(manifest);
  const bundle = JSON.parse(raw);
  keys(bundle, ["schema_version", "steps"]);
  assert.equal(bundle.schema_version, version, "Unknown bundle version");
  assert.ok(Array.isArray(bundle.steps) && bundle.steps.length === definitions.length, "Exactly three steps required");
  const results = [];
  for (const [index, step] of definitions.entries()) {
    const saved = bundle.steps[index];
    keys(saved, ["id", "operation", "depends_on", "request", "receipt", "request_sha256", "receipt_sha256"]);
    assert.equal(saved.id, step.id, "Unexpected step order or identity");
    assert.equal(saved.operation, step.operation, "Unexpected operation");
    assert.deepEqual(saved.depends_on, step.depends_on, "Unexpected argument links");
    assert.equal(saved.request, `${step.id}.request.json`, "Unexpected request path");
    assert.equal(saved.receipt, `${step.id}.receipt.json`, "Unexpected receipt path");
    assert.match(saved.receipt_sha256, /^[a-f0-9]{64}$/);
    const expectedHash = sha(await boundedInput(fixturePath(step)));
    assert.equal(saved.request_sha256, expectedHash, "Bundle differs from this example's input");
    const request = await inside(root, saved.request), receipt = await inside(root, saved.receipt);
    const replay = await checker(step)(["--check", request, receipt]);
    accepted(step, replay);
    assert.equal(replay.request_sha256, expectedHash, "Request bytes changed");
    assert.equal(replay.receipt_sha256, saved.receipt_sha256, "Receipt bytes changed");
    results.push({ id: step.id, depends_on: step.depends_on, replay });
  }
  return { schema_version: version, status: "replayed", checked: true,
    evidence_scope: "three-supplied-requests-only", proof_checker_backed: false,
    modeling_status: "human-reviewed-not-code-verified", manifest_sha256: sha(raw),
    steps: results, remaining_assumptions: assumptions };
}

export async function createDivideConquerBundle() {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker pit-experiment service");
  const root = path.join(repo, ".truth-harness/experiments");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, "cs-divide-conquer-bundle-"));
  const steps = [];
  for (const step of definitions) {
    const report = await checker(step)([fixturePath(step)]);
    accepted(step, report);
    const source = path.join(repo, report.artifact_directory);
    const request = `${step.id}.request.json`, receipt = `${step.id}.receipt.json`;
    await writeFile(path.join(directory, request), await boundedInput(path.join(source, "request.json")), "utf8");
    await writeFile(path.join(directory, receipt), await boundedInput(path.join(source, "receipt.json")), "utf8");
    steps.push({ id: step.id, operation: step.operation, depends_on: step.depends_on, request, receipt,
      request_sha256: report.request_sha256, receipt_sha256: report.receipt_sha256 });
  }
  const manifest = path.join(directory, "bundle.json");
  await writeFile(manifest, json({ schema_version: version, steps }), "utf8");
  const replay = await replayDivideConquerBundle(manifest);
  const report = { ...replay, recorded_at: new Date().toISOString(),
    artifact_directory: path.relative(repo, directory).split(path.sep).join("/") };
  await writeFile(path.join(directory, "report.json"), json(report), "utf8");
  await writeFile(path.join(directory, "PROGRESS.md"), `# Divide-And-Conquer Evidence Bundle\n\nRecorded: ${report.recorded_at}\n\n` +
    "[Bundle](bundle.json) | [Replay report](report.json)\n\nThree receipts checked together. This is not a complete formal proof.\n\n" +
    assumptions.map(value => `- ${value}\n`).join(""), "utf8");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--check" && args[1] !== "-"),
      "Usage: cs-divide-conquer-bundle.mjs [--check <bundle.json>]");
    console.log(json(args.length ? await replayDivideConquerBundle(args[1]) : await createDivideConquerBundle()).trimEnd());
  } catch (error) {
    console.log(json({ schema_version: version, status: "unverified", checked: false, error: error.message }).trimEnd());
    process.exitCode = 2;
  }
}

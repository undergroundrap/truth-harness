import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedInput } from "./pit-witness.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const version = "truth-harness.divide-conquer-specialization.v0";
const declaration = "divide_conquer_specialized";
const json = value => JSON.stringify(value, null, 2) + "\n";
const sha = value => createHash("sha256").update(value).digest("hex");

export async function ensureSpecializationWorkspace(root) {
  const { getLocalWorkspaceStatus, initLocalWorkspace } = await import("../packages/core/dist/index.js");
  const status = await getLocalWorkspaceStatus(root);
  if (!status.exists) await initLocalWorkspace(root);
}

export function requireAdapterSuccess(result) {
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || result.stdout?.trim() || "No adapter diagnostics";
    throw new Error(`Lean adapter did not accept the specialization (exit ${result.status ?? "none"}): ${detail.slice(0, 2000)}`);
  }
}

export function validateCosts(value) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected object");
  assert.deepEqual(Object.keys(value).sort(), ["combine_offset", "combine_slope", "leaf_cost", "schema_version"]);
  assert.equal(value.schema_version, version, "Unknown schema version");
  for (const key of ["leaf_cost", "combine_slope", "combine_offset"]) {
    assert.equal(typeof value[key], "string", `${key} must be an integer string`);
    assert.match(value[key], /^(?:0|-?[1-9][0-9]{0,5})(?![\s\S])/, `${key} must be canonical and at most six digits`);
  }
  return value;
}

export function specializationSource(request, library) {
  const { leaf_cost: c, combine_slope: a, combine_offset: b } = validateCosts(request);
  return library + `\n\ntheorem ${declaration} (A : Nat -> Int)\n` +
    `    (ha0 : A 0 = (${c} : Int))\n` +
    `    (hs : forall h, A (h + 1) = 2 * A h + (${a} : Int) * 2 ^ (h + 1) + (${b} : Int)) :\n` +
    `    forall h, A h = ((${c} : Int) + (${b} : Int) + (${a} : Int) * (h : Int)) * 2 ^ h - (${b} : Int) :=\n` +
    `  divide_conquer_cost_family A (${c}) (${a}) (${b}) ha0 hs\n\n` +
    `/-- info: '${declaration}' depends on axioms: [propext, Quot.sound] -/\n` +
    `#guard_msgs in\n#print axioms ${declaration}\n`;
}

export async function specialize(args) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker lean-proof service");
  assert.ok(args.length === 1 && !args[0].startsWith("--"), "Usage: divide-conquer-specialize.mjs <request.json|->");
  const raw = await boundedInput(args[0]);
  const request = validateCosts(JSON.parse(raw));
  const library = await readFile(path.join(repo, "docs/examples/DivideConquer.lean"), "utf8");
  const source = specializationSource(request, library);
  await ensureSpecializationWorkspace(repo);
  const parent = path.join(repo, ".truth-harness/experiments");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, "divide-conquer-specialization-"));
  const sourcePath = path.join(directory, "Specialized.lean");
  await writeFile(path.join(directory, "request.json"), raw, "utf8");
  await writeFile(sourcePath, source, "utf8");
  const result = spawnSync(process.execPath, [path.join(repo, "apps/cli/dist/index.js"),
    "proof", "check", sourcePath, "--declaration", declaration, "--timeout-ms", "30000",
    "--fail-on-unproved", "--write", "--json"],
  { cwd: repo, encoding: "utf8", timeout: 45000, maxBuffer: 1024 * 1024, windowsHide: true, shell: false });
  requireAdapterSuccess(result);
  const written = JSON.parse(result.stdout);
  assert.equal(written.written, true);
  const proof = written.record;
  assert.equal(proof.status, "accepted");
  assert.equal(proof.trust, "proved");
  assert.equal(proof.proofCheckerBacked, true);
  assert.equal(proof.source.declarationName, declaration);
  assert.equal(proof.source.sha256, sha(source), "Proof source hash differs from generated source");
  const report = { schema_version: version, status: "accepted", trust: "proved",
    proof_checker_backed: true, evidence_scope: "explicit-recurrence-only",
    request, request_sha256: sha(raw), library_sha256: sha(library), source_sha256: sha(source),
    artifact_directory: path.relative(repo, directory).split(path.sep).join("/"),
    assumptions: ["The application must establish the stated initial value and equal-split recurrence.",
      "Integer costs need not be nonnegative; no physical cost, source-code, timing, or asymptotic property is proved."], proof };
  await writeFile(path.join(directory, "report.json"), json(report), "utf8");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(json(await specialize(process.argv.slice(2)))); }
  catch (error) {
    process.stdout.write(json({ schema_version: version, status: "unverified", proof_checker_backed: false,
      error: error instanceof Error ? error.message : "Specialization failed" }));
    process.exitCode = 2;
  }
}

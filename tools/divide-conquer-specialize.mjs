import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedInput } from "./pit-witness.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const version = "truth-harness.divide-conquer-specialization.v0";
const reopenVersion = "truth-harness.divide-conquer-reopen.v1";
const declaration = "divide_conquer_specialized";
const json = value => JSON.stringify(value, null, 2) + "\n";
const sha = value => createHash("sha256").update(value).digest("hex");
const assumptions = ["The application must establish the stated initial value and equal-split recurrence.",
  "Integer costs need not be nonnegative; no physical cost, source-code, timing, or asymptotic property is proved."];

function checkSpecializationSource(sourcePath, source, write = false) {
  const result = spawnSync(process.execPath, [path.join(repo, "apps/cli/dist/index.js"),
    "proof", "check", sourcePath, "--declaration", declaration, "--timeout-ms", "30000",
    "--fail-on-unproved", ...(write ? ["--write"] : []), "--json"],
  { cwd: repo, encoding: "utf8", timeout: 45000, maxBuffer: 1024 * 1024, windowsHide: true, shell: false });
  requireAdapterSuccess(result);
  const response = JSON.parse(result.stdout);
  if (write) assert.equal(response.written, true);
  const proof = write ? response.record : response;
  assert.equal(proof.status, "accepted");
  assert.equal(proof.trust, "proved");
  assert.equal(proof.proofCheckerBacked, true);
  assert.equal(proof.source.declarationName, declaration);
  assert.equal(proof.source.sha256, sha(source), "Proof source hash differs from generated source");
  return proof;
}

async function bundleFile(directory, name) {
  const target = await realpath(path.join(directory, name));
  const relative = path.relative(directory, target);
  assert.ok(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), "Bundle file escapes directory");
  return boundedInput(target);
}

export function validateExpectedRequestHash(hash) {
  assert.equal(typeof hash, "string", "Expected request SHA-256 is required");
  assert.match(hash, /^[a-f0-9]{64}(?![\s\S])/, "Expected request SHA-256 must be 64 lowercase hexadecimal characters");
  return hash;
}

export async function reopenSpecialization(bundlePath, expectedRequestHash) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker lean-proof service");
  validateExpectedRequestHash(expectedRequestHash);
  const directory = await realpath(bundlePath);
  const raw = await bundleFile(directory, "request.json");
  assert.equal(sha(raw), expectedRequestHash, "Saved request does not match expected request SHA-256");
  const request = validateCosts(JSON.parse(raw));
  const library = await boundedInput(path.join(repo, "docs/examples/DivideConquer.lean"));
  const expected = specializationSource(request, library);
  const saved = await bundleFile(directory, "Specialized.lean");
  assert.equal(sha(saved), sha(expected), "Saved source does not match the request and current theorem library");
  const parent = path.join(repo, ".truth-harness/experiments");
  await mkdir(parent, { recursive: true });
  const scratch = await mkdtemp(path.join(parent, "specialization-recheck-"));
  try {
    const sourcePath = path.join(scratch, "Specialized.lean");
    // Compile our matched snapshot, never a mutable saved bundle path.
    await writeFile(sourcePath, expected, "utf8");
    const proof = checkSpecializationSource(sourcePath, expected);
    return { schema_version: reopenVersion, status: "reopened", trust: "proved", proof_checker_backed: true,
      evidence_scope: "explicit-recurrence-only", request, request_sha256: sha(raw),
      expected_request_sha256: expectedRequestHash,
      library_sha256: sha(library), source_sha256: sha(expected),
      artifact_directory: path.relative(repo, directory).split(path.sep).join("/"),
      cached_report_used: false, assumptions, proof };
  } finally {
    assert.equal(path.dirname(path.resolve(scratch)), path.resolve(parent));
    await rm(scratch, { recursive: true, force: true });
  }
}

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
  if (args[0] === "--reopen") {
    assert.ok(args.length === 4 && args[1] !== "-" && args[2] === "--expect-request-sha256",
      "Usage: divide-conquer-specialize.mjs --reopen <bundle-directory> --expect-request-sha256 <hash>");
    return reopenSpecialization(args[1], args[3]);
  }
  assert.ok(args.length === 1 && !args[0].startsWith("--"), "Usage: divide-conquer-specialize.mjs <request.json|-> OR --reopen <bundle-directory> --expect-request-sha256 <hash>");
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
  const proof = checkSpecializationSource(sourcePath, source, true);
  const report = { schema_version: version, status: "accepted", trust: "proved",
    proof_checker_backed: true, evidence_scope: "explicit-recurrence-only",
    request, request_sha256: sha(raw), library_sha256: sha(library), source_sha256: sha(source),
    artifact_directory: path.relative(repo, directory).split(path.sep).join("/"),
    assumptions, proof };
  await writeFile(path.join(directory, "report.json"), json(report), "utf8");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(json(await specialize(process.argv.slice(2)))); }
  catch (error) {
    process.stdout.write(json({ schema_version: process.argv[2] === "--reopen" ? reopenVersion : version, status: "unverified", proof_checker_backed: false,
      error: error instanceof Error ? error.message : "Specialization failed" }));
    process.exitCode = 2;
  }
}

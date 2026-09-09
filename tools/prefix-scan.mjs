import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedInput } from "./pit-witness.mjs";
import { ensureSpecializationWorkspace, validateExpectedRequestHash } from "./divide-conquer-specialize.mjs";
import { checkTree, treeInteger, treeRequest } from "./tree-evaluate.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const version = "truth-harness.prefix-scan.v0";
const reopenVersion = "truth-harness.prefix-scan-reopen.v0";
const declaration = "concrete_prefix_scan";
const sha = text => createHash("sha256").update(text).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";

export function scanRequest(request) {
  assert.ok(request && typeof request === "object" && !Array.isArray(request), "Expected object");
  assert.deepEqual(Object.keys(request).sort(), ["offset", "schema_version", "tree"]);
  assert.equal(request.schema_version, version, "Unknown schema version");
  treeInteger(request.offset);
  const validated = treeRequest({ schema_version: "truth-harness.tree-evaluation.v0", tree: request.tree });
  let sum = BigInt(request.offset);
  const prefixes = [];
  const visit = node => {
    if (Object.hasOwn(node, "value")) { sum += BigInt(node.value); prefixes.push(String(sum)); }
    else { visit(node.left); visit(node.right); }
  };
  visit(request.tree);
  const n = BigInt(validated.results.count);
  return { term: validated.term, results: { prefixes, count: String(n), scan_additions: String(2n * n - 1n),
    scan_cons_cells: String(n) } };
}

export function scanSource(request, library) {
  const { term, results: r } = scanRequest(request);
  return library + `\n\ndef submittedScanTree : ValueTree.Tree := ${term}\n` +
    `def submittedScan := CachedScan.evaluateInto (${request.offset} : Int) (CachedScan.build submittedScanTree) []\n` +
    `theorem ${declaration} :\n` +
    `    (submittedScan.output = TreeScan.prefixes (${request.offset} : Int) (ValueTree.leaves submittedScanTree) ++ [] /\\\n` +
    `     submittedScan.additions = 2 * ((ValueTree.leaves submittedScanTree).length : Int) - 1 /\\\n` +
    `     submittedScan.consCells = (ValueTree.leaves submittedScanTree).length) /\\\n` +
    `    (submittedScan.output = [${r.prefixes.map(x => `(${x} : Int)`).join(", ")}] /\\\n` +
    `     (ValueTree.leaves submittedScanTree).length = ${r.count} /\\\n` +
    `     submittedScan.additions = (${r.scan_additions} : Int) /\\\n` +
    `     submittedScan.consCells = ${r.scan_cons_cells}) := by\n` +
    `  constructor\n  · exact cached_prefix_evaluation_correct submittedScanTree (${request.offset} : Int) []\n  · decide\n`;
}

export async function reopenScan(bundle, expectedHash) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker lean-proof service");
  validateExpectedRequestHash(expectedHash);
  const directory = await realpath(bundle);
  const readContained = async name => {
    const file = await realpath(path.join(directory, name));
    const relative = path.relative(directory, file);
    assert.ok(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), "Bundle file escapes directory");
    return boundedInput(file);
  };
  const raw = await readContained("request.json");
  assert.equal(sha(raw), expectedHash, "Saved request does not match expected request SHA-256");
  const request = JSON.parse(raw);
  const { results } = scanRequest(request);
  const library = await boundedInput(path.join(repo, "docs/examples/ParallelReduction.lean"));
  const source = scanSource(request, library);
  assert.equal(sha(await readContained("Scan.lean")), sha(source), "Saved source does not match request and current theorem library");
  const parent = path.join(repo, ".truth-harness/experiments");
  await mkdir(parent, { recursive: true });
  const scratch = await mkdtemp(path.join(parent, "prefix-scan-recheck-"));
  try {
    const file = path.join(scratch, "Scan.lean");
    // Check regenerated source, never execute the mutable bundle's file.
    await writeFile(file, source, "utf8");
    const proof = checkTree(file, source, false, declaration);
    return { schema_version: reopenVersion, status: "reopened", trust: "proved", proof_checker_backed: true,
      evidence_scope: "concrete-lean-prefix-scan-model", results, request_sha256: sha(raw),
      expected_request_sha256: expectedHash, library_sha256: sha(library), source_sha256: sha(source),
      artifact_directory: path.relative(repo, directory).split(path.sep).join("/"), cached_report_used: false,
      limitations: ["Scan-only logical counts, not runtime, memory-byte, stack-safety, or compiler guarantees.",
        "The expected request hash must come from trusted task state, not this bundle.",
        "The temporary proof source is removed after checking; replay again for fresh evidence."], proof };
  } finally {
    assert.equal(path.dirname(path.resolve(scratch)), path.resolve(parent));
    await rm(scratch, { recursive: true, force: true });
  }
}

export async function evaluateScan(args) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker lean-proof service");
  if (args[0] === "--reopen") {
    assert.ok(args.length === 4 && args[1] !== "-" && args[2] === "--expect-request-sha256",
      "Usage: prefix-scan.mjs --reopen <bundle-directory> --expect-request-sha256 <hash>");
    return reopenScan(args[1], args[3]);
  }
  assert.ok(args.length === 1 && !args[0].startsWith("--"), "Usage: prefix-scan.mjs <request.json|->");
  const raw = await boundedInput(args[0]);
  const request = JSON.parse(raw);
  const { results } = scanRequest(request);
  const library = await boundedInput(path.join(repo, "docs/examples/ParallelReduction.lean"));
  const source = scanSource(request, library);
  await ensureSpecializationWorkspace(repo);
  const parent = path.join(repo, ".truth-harness/experiments");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, "prefix-scan-"));
  const file = path.join(directory, "Scan.lean");
  await writeFile(path.join(directory, "request.json"), raw, "utf8");
  await writeFile(file, source, "utf8");
  const proof = checkTree(file, source, true, declaration);
  const report = { schema_version: version, status: "accepted", trust: "proved", proof_checker_backed: true,
    evidence_scope: "concrete-lean-prefix-scan-model", results, request_sha256: sha(raw),
    library_sha256: sha(library), source_sha256: sha(source),
    artifact_directory: path.relative(repo, directory).split(path.sep).join("/"),
    limitations: ["Scan-only logical addition and cons counts; cache construction is excluded.",
      "No measured runtime, memory-byte, stack-safety, compiler, or machine-overflow guarantee.",
      "Rerun the saved request for fresh verification; this command does not reopen cached reports."], proof };
  await writeFile(path.join(directory, "report.json"), json(report), "utf8");
  return report;
}

export function scanFailure(error, reopen = false) {
  return { schema_version: reopen ? reopenVersion : version, status: "unverified", proof_checker_backed: false,
    error: error instanceof Error ? error.message : "Prefix scan failed" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(json(await evaluateScan(process.argv.slice(2)))); }
  catch (error) { process.stdout.write(json(scanFailure(error, process.argv[2] === "--reopen"))); process.exitCode = 2; }
}

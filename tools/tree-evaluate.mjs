import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedInput } from "./pit-witness.mjs";
import { ensureSpecializationWorkspace, requireAdapterSuccess, validateExpectedRequestHash } from "./divide-conquer-specialize.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const version = "truth-harness.tree-evaluation.v0";
const reopenVersion = "truth-harness.tree-evaluation-reopen.v0";
const declaration = "concrete_tree_evaluation";
const sha = text => createHash("sha256").update(text).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";

export function treeRequest(value) {
  const object = node => assert.ok(node && typeof node === "object" && !Array.isArray(node), "Expected object");
  object(value);
  assert.deepEqual(Object.keys(value).sort(), ["schema_version", "tree"]);
  assert.equal(value.schema_version, version, "Unknown schema version");
  let nodes = 0;
  const visit = (node, depth) => {
    assert.ok(++nodes <= 127 && depth <= 8, "Tree exceeds 127 nodes or depth 8");
    object(node);
    if (Object.hasOwn(node, "value")) {
      assert.deepEqual(Object.keys(node), ["value"]);
      assert.equal(typeof node.value, "string", "Leaf value must be an integer string");
      assert.match(node.value, /^(?:0|-?[1-9][0-9]{0,5})(?![\s\S])/, "Leaf value must be a canonical integer with at most six digits");
      return { term: `(.leaf (${node.value} : Int))`, sum: BigInt(node.value), count: 1n, work: 0n, span: 0 };
    }
    assert.deepEqual(Object.keys(node).sort(), ["left", "right"]);
    const a = visit(node.left, depth + 1), b = visit(node.right, depth + 1);
    return { term: `(.fork ${a.term} ${b.term})`, sum: a.sum + b.sum,
      count: a.count + b.count, work: a.work + b.work + 2n, span: Math.max(a.span, b.span) + 1 };
  };
  const result = visit(value.tree, 0);
  return { term: result.term, results: { sum: String(result.sum), count: String(result.count),
    work: String(result.work), span: String(result.span) } };
}

export function treeSource(request, library) {
  const { term, results: r } = treeRequest(request);
  return library + `\n\ndef submittedTree : ValueTree.Tree := ${term}\n` +
    `theorem ${declaration} :\n` +
    `    ((ValueTree.evaluate submittedTree).output =\n` +
    `      (ValueTree.listSum (ValueTree.leaves submittedTree), (ValueTree.leaves submittedTree).length) /\\\n` +
    `     (ValueTree.evaluate submittedTree).work = PairTree.work (ValueTree.shape submittedTree) /\\\n` +
    `     (ValueTree.evaluate submittedTree).span = PairTree.span (ValueTree.shape submittedTree)) /\\\n` +
    `    ((ValueTree.evaluate submittedTree).output = ((${r.sum} : Int), ${r.count}) /\\\n` +
    `     (ValueTree.evaluate submittedTree).work = (${r.work} : Int) /\\\n` +
    `     (ValueTree.evaluate submittedTree).span = ${r.span}) := by\n` +
    `  constructor\n  · exact tree_evaluation_correct submittedTree\n  · decide\n`;
}

function checkTree(file, source, write) {
  const checked = spawnSync(process.execPath, [path.join(repo, "apps/cli/dist/index.js"), "proof", "check", file,
    "--declaration", declaration, "--timeout-ms", "30000", "--fail-on-unproved", ...(write ? ["--write"] : []), "--json"],
  { cwd: repo, encoding: "utf8", timeout: 45000, maxBuffer: 1024 * 1024, windowsHide: true, shell: false });
  requireAdapterSuccess(checked);
  const response = JSON.parse(checked.stdout), proof = write ? response.record : response;
  if (write) assert.equal(response.written, true);
  assert.equal(proof.status, "accepted");
  assert.equal(proof.trust, "proved");
  assert.equal(proof.proofCheckerBacked, true);
  assert.equal(proof.source.sha256, sha(source));
  assert.equal(proof.source.declarationName, declaration);
  assert.equal(proof.source.declaration?.name, declaration);
  return proof;
}

export async function reopenTree(bundle, expectedHash) {
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
  const { results } = treeRequest(request);
  const library = await boundedInput(path.join(repo, "docs/examples/ParallelReduction.lean"));
  const source = treeSource(request, library);
  const saved = await readContained("Evaluation.lean");
  assert.equal(sha(saved), sha(source), "Saved source does not match request and current theorem library");
  const parent = path.join(repo, ".truth-harness/experiments");
  await mkdir(parent, { recursive: true });
  const scratch = await mkdtemp(path.join(parent, "tree-recheck-"));
  try {
    const file = path.join(scratch, "Evaluation.lean");
    // Check the regenerated snapshot, never execute the mutable saved source.
    await writeFile(file, source, "utf8");
    const proof = checkTree(file, source, false);
    return { schema_version: reopenVersion, status: "reopened", trust: "proved", proof_checker_backed: true,
      evidence_scope: "concrete-lean-tree-model", results, request_sha256: sha(raw),
      expected_request_sha256: expectedHash, library_sha256: sha(library), source_sha256: sha(source),
      artifact_directory: path.relative(repo, directory).split(path.sep).join("/"), cached_report_used: false,
      limitations: ["Logical model costs only, not measured runtime or a compiler guarantee.",
        "The expected request hash must come from trusted task state, not this bundle.",
        "The temporary proof source is removed after checking; replay again for fresh evidence."], proof };
  } finally {
    assert.equal(path.dirname(path.resolve(scratch)), path.resolve(parent));
    await rm(scratch, { recursive: true, force: true });
  }
}

export async function evaluateTree(args) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker lean-proof service");
  if (args[0] === "--reopen") {
    assert.ok(args.length === 4 && args[1] !== "-" && args[2] === "--expect-request-sha256",
      "Usage: tree-evaluate.mjs --reopen <bundle-directory> --expect-request-sha256 <hash>");
    return reopenTree(args[1], args[3]);
  }
  assert.ok(args.length === 1 && !args[0].startsWith("--"), "Usage: tree-evaluate.mjs <request.json|->");
  const raw = await boundedInput(args[0]);
  const request = JSON.parse(raw);
  const { results } = treeRequest(request);
  const library = await readFile(path.join(repo, "docs/examples/ParallelReduction.lean"), "utf8");
  const source = treeSource(request, library);
  await ensureSpecializationWorkspace(repo);
  const parent = path.join(repo, ".truth-harness/experiments");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, "tree-evaluation-"));
  const file = path.join(directory, "Evaluation.lean");
  await writeFile(path.join(directory, "request.json"), raw, "utf8");
  await writeFile(file, source, "utf8");
  const proof = checkTree(file, source, true);
  const report = { schema_version: version, status: "accepted", trust: "proved", proof_checker_backed: true,
    evidence_scope: "concrete-lean-tree-model", results, request_sha256: sha(raw),
    library_sha256: sha(library), source_sha256: sha(source),
    artifact_directory: path.relative(repo, directory).split(path.sep).join("/"),
    limitations: ["Logical unit-cost arithmetic and ideal parallel span, not measured runtime.",
      "No machine overflow, floating-point, compiler, allocation, or communication guarantee.",
      "Rerun the saved request for fresh verification; cached reports are not revalidated."], proof };
  await writeFile(path.join(directory, "report.json"), json(report), "utf8");
  return report;
}

export function treeFailure(error, reopen = false) {
  return { schema_version: reopen ? reopenVersion : version, status: "unverified", proof_checker_backed: false,
    error: error instanceof Error ? error.message : "Tree evaluation failed" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(json(await evaluateTree(process.argv.slice(2)))); }
  catch (error) {
    process.stdout.write(json(treeFailure(error, process.argv[2] === "--reopen")));
    process.exitCode = 2;
  }
}

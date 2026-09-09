import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedInput } from "./pit-witness.mjs";
import { ensureSpecializationWorkspace, requireAdapterSuccess } from "./divide-conquer-specialize.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const version = "truth-harness.tree-evaluation.v0";
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

export async function evaluateTree(args) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker lean-proof service");
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
  const checked = spawnSync(process.execPath, [path.join(repo, "apps/cli/dist/index.js"), "proof", "check", file,
    "--declaration", declaration, "--timeout-ms", "30000", "--fail-on-unproved", "--write", "--json"],
  { cwd: repo, encoding: "utf8", timeout: 45000, maxBuffer: 1024 * 1024, windowsHide: true, shell: false });
  requireAdapterSuccess(checked);
  const response = JSON.parse(checked.stdout), proof = response.record;
  assert.equal(response.written, true);
  assert.equal(proof.status, "accepted");
  assert.equal(proof.trust, "proved");
  assert.equal(proof.proofCheckerBacked, true);
  assert.equal(proof.source.sha256, sha(source));
  assert.equal(proof.source.declarationName, declaration);
  assert.equal(proof.source.declaration?.name, declaration);
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

export function treeFailure(error) {
  return { schema_version: version, status: "unverified", proof_checker_backed: false,
    error: error instanceof Error ? error.message : "Tree evaluation failed" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(json(await evaluateTree(process.argv.slice(2)))); }
  catch (error) {
    process.stdout.write(json(treeFailure(error)));
    process.exitCode = 2;
  }
}

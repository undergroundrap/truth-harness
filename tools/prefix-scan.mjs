import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedInput } from "./pit-witness.mjs";
import { ensureSpecializationWorkspace } from "./divide-conquer-specialize.mjs";
import { checkTree, treeInteger, treeRequest } from "./tree-evaluate.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const version = "truth-harness.prefix-scan.v0";
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

export async function evaluateScan(args) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker lean-proof service");
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

export function scanFailure(error) {
  return { schema_version: version, status: "unverified", proof_checker_backed: false,
    error: error instanceof Error ? error.message : "Prefix scan failed" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(json(await evaluateScan(process.argv.slice(2)))); }
  catch (error) { process.stdout.write(json(scanFailure(error))); process.exitCode = 2; }
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { boundedInput } from "./pit-witness.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const json = value => JSON.stringify(value, null, 2) + "\n";
const sha = value => createHash("sha256").update(value).digest("hex");
const relative = value => path.relative(repo, value).split(path.sep).join("/");

export function pairRequest(id) {
  assert.ok(["correct", "off-by-one"].includes(id));
  return { schema_version: "truth-harness.polynomial-sum.v0",
    summand: [{ coefficient: "1", exponents: [1] }, { coefficient: "-1", exponents: [0] }],
    candidate: [{ coefficient: "1/2", exponents: [2] }, { coefficient: id === "correct" ? "-1/2" : "1/2", exponents: [1] }],
    budget: { max_n: 13 } };
}

export function assessPairResult(result, id) {
  assert.ok(["correct", "off-by-one"].includes(id));
  assert.equal(Boolean(result.isError), id !== "correct", "Wrong MCP error signal");
  assert.equal(result.content?.[0]?.type, "text");
  const report = JSON.parse(result.content[0].text);
  assert.equal(report.schema_version, "truth-harness.polynomial-sum-report.v0");
  assert.equal(report.status, id === "correct" ? "identity-checked" : "refuted");
  assert.equal(report.trust, id === "correct" ? "exact-computed" : "refuted");
  assert.equal(report.checked, true);
  assert.equal(report.proof_checker_backed, false);
  assert.equal(report.evidence_class, id === "correct" ? "polynomial-induction-check" : "exact-finite-sum-counterexample");
  assert.equal(report.domain, "all nonnegative integers n; sum from k=1 through n, empty sum at n=0");
  assert.deepEqual(report.counterexample, id === "correct" ? null : { n: 1, candidate_value: "1", sum_value: "0" });
  assert.match(report.receipt_sha256, /^[a-f0-9]{64}$/);
  return report;
}

export function enumeratePairs() {
  return Array.from({ length: 17 }, (_, n) => {
    let count = 0n;
    for (let k = 1; k <= n; k++) for (let j = 1; j < k; j++) count++;
    const formula = BigInt(n) * BigInt(n - 1) / 2n;
    assert.equal(count, formula);
    return { n, enumerated: String(count), formula: String(formula) };
  });
}

async function contained(root, target) {
  const actualRoot = await realpath(root);
  const actual = await realpath(target);
  const rel = path.relative(actualRoot, actual);
  assert.ok(rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), "Evidence escapes local store");
  return actual;
}

export async function runPairWorkflow(replayDirectory) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker pit-experiment service");
  const experiments = path.join(repo, ".truth-harness", "experiments");
  await mkdir(experiments, { recursive: true });
  const directory = replayDirectory
    ? await contained(experiments, path.resolve(repo, replayDirectory))
    : await mkdtemp(path.join(experiments, "cs-pairs-mcp-"));
  const transcript = [];
  const cases = [];
  const client = new Client({ name: "truth-harness-cs-pairs", version: "0.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [path.join(repo, "packages/mcp-server/dist/index.js")], cwd: repo,
    env: { ...getDefaultEnvironment(), TRUTH_HARNESS_CONTAINER: "1", TRUTH_HARNESS_ROOT: repo },
    stderr: "ignore", maxBufferSize: 1024 * 1024 });
  const call = async (name, args) => {
    const response = await client.callTool({ name, arguments: args });
    transcript.push({ tool: name, arguments: args, response });
    return response;
  };
  try {
    await client.connect(transport);
    const inventory = await client.listTools();
    for (const name of ["truth_harness_polynomial_capabilities", "truth_harness_polynomial_check", "truth_harness_polynomial_replay"])
      assert.ok(inventory.tools.some(tool => tool.name === name), `Missing tool: ${name}`);
    const capabilities = await call("truth_harness_polynomial_capabilities", {});
    assert.ok(!capabilities.isError);
    const cap = JSON.parse(capabilities.content[0].text);
    assert.equal(cap.execution, "configured");
    assert.equal(cap.proof_checker_backed, false);
    for (const id of ["correct", "off-by-one"]) {
      const requestPath = path.join(directory, `${id}.request.json`);
      const receiptPath = path.join(directory, `${id}.receipt.json`);
      if (!replayDirectory) {
        const requestJson = json(pairRequest(id));
        const result = await call("truth_harness_polynomial_check", { operation: "sum", requestJson });
        const report = assessPairResult(result, id);
        assert.match(report.artifact_directory, /^\.truth-harness\/witnesses\/polynomial-sum-[A-Za-z0-9]+$/);
        const source = await contained(path.join(repo, ".truth-harness/witnesses"), path.resolve(repo, report.artifact_directory, "receipt.json"));
        const receiptRaw = await boundedInput(source);
        assert.equal(sha(receiptRaw), report.receipt_sha256);
        await writeFile(requestPath, requestJson, "utf8");
        await writeFile(receiptPath, receiptRaw, "utf8");
      }
      const original = await boundedInput(await contained(directory, requestPath));
      assert.deepEqual(JSON.parse(original), pairRequest(id), "Saved request is not this fixed problem");
      const receiptRaw = await boundedInput(await contained(directory, receiptPath));
      const result = await call("truth_harness_polynomial_replay", {
        operation: "sum", requestPath: relative(requestPath), receiptPath: relative(receiptPath)
      });
      const report = assessPairResult(result, id);
      assert.equal(report.receipt_sha256, sha(receiptRaw));
      cases.push({ id, status: report.status, trust: report.trust, counterexample: report.counterexample,
        request: `${id}.request.json`, receipt: `${id}.receipt.json`,
        request_sha256: sha(original), receipt_sha256: sha(receiptRaw) });
    }
    const report = { schema_version: "truth-harness.cs-pairs-mcp.v0", recorded_at: new Date().toISOString(),
      passed: true, replay: Boolean(replayDirectory), transport: "MCP stdio subprocess", cases,
      bounded_enumeration: { evidence_class: "bounded-enumeration", range: "0..16", values: enumeratePairs() },
      artifact_directory: relative(directory),
      limitations: "Fixed mathematical loop model, not arbitrary program verification or a new research result. Specialized exact induction check, not Lean proof. Scripted MCP client, not an autonomous LLM discovery run." };
    if (!replayDirectory) {
      await writeFile(path.join(directory, "PROBLEM.md"), await boundedInput(path.join(repo, "docs/CS_PAIR_COUNT_MCP.md")), "utf8");
      await writeFile(path.join(directory, "report.json"), json(report), "utf8");
      await writeFile(path.join(directory, "PROGRESS.md"), `# Pair Comparison Count\n\nRecorded: ${report.recorded_at}\n\n` +
        "Checked: C(n)=n(n-1)/2 for the stated sum. Rejected: n(n+1)/2 at n=1 (1 instead of 0).\n\n" +
        "[Problem](PROBLEM.md) | [Report](report.json) | [MCP transcript](transcript.json)\n\n" +
        "[Correct request](correct.request.json) | [Receipt](correct.receipt.json)\n\n" +
        "[False request](off-by-one.request.json) | [Receipt](off-by-one.receipt.json)\n\n" +
        `Replay: \`docker compose run --rm -T pit-experiment node tools/cs-pairs-mcp.mjs --replay ${relative(directory)}\`\n\n${report.limitations}\n`, "utf8");
    }
    return report;
  } finally {
    await client.close();
    await transport.close();
    if (!replayDirectory) await writeFile(path.join(directory, "transcript.json"), json(transcript), "utf8");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--replay"), "Usage: cs-pairs-mcp.mjs [--replay <experiment-directory>]");
    process.stdout.write(json(await runPairWorkflow(args[1])));
  } catch (error) {
    process.stdout.write(json({ schema_version: "truth-harness.cs-pairs-mcp.v0", passed: false, status: "unverified", error: error.message }));
    process.exitCode = 2;
  }
}

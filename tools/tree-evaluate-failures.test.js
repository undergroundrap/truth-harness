import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, afterEach, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
vi.mock("node:fs/promises", async importOriginal => ({
  ...await importOriginal(), mkdir: vi.fn(), mkdtemp: vi.fn(), readFile: vi.fn(), writeFile: vi.fn()
}));
vi.mock("./pit-witness.mjs", () => ({ boundedInput: vi.fn() }));
vi.mock("./divide-conquer-specialize.mjs", async importOriginal => ({
  ...await importOriginal(), ensureSpecializationWorkspace: vi.fn()
}));

import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { boundedInput } from "./pit-witness.mjs";
import { ensureSpecializationWorkspace } from "./divide-conquer-specialize.mjs";
import { evaluateTree, treeFailure, treeSource } from "./tree-evaluate.mjs";

const request = { schema_version: "truth-harness.tree-evaluation.v0", tree: { value: "7" } };
const library = "import Std\n";
const hash = createHash("sha256").update(treeSource(request, library)).digest("hex");
const repo = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(repo, ".truth-harness/experiments/synthetic-test-only");
// Synthetic adapter payloads test the boundary, not mathematical validity.
const response = () => ({ written: true, record: { status: "accepted", trust: "proved",
  proofCheckerBacked: true, source: { sha256: hash, declarationName: "concrete_tree_evaluation",
    declaration: { name: "concrete_tree_evaluation" } } } });
const success = body => ({ status: 0, stdout: JSON.stringify(body), stderr: "" });
const reports = () => writeFile.mock.calls.filter(([file]) => path.basename(file) === "report.json");

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TRUTH_HARNESS_CONTAINER", "1");
  boundedInput.mockResolvedValue(JSON.stringify(request));
  readFile.mockResolvedValue(library);
  mkdir.mockResolvedValue(undefined);
  mkdtemp.mockResolvedValue(directory);
  writeFile.mockResolvedValue(undefined);
  ensureSpecializationWorkspace.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

it("permits a complete matching response and preserves subprocess safety options", async () => {
  spawnSync.mockReturnValue(success(response()));
  const report = await evaluateTree(["request with spaces.json"]);
  expect(report.results).toEqual({ sum: "7", count: "1", work: "0", span: "0" });
  expect(reports()).toHaveLength(1);
  const [command, args, options] = spawnSync.mock.calls[0];
  expect(command).toBe(process.execPath);
  expect(args).toContain(path.join(directory, "Evaluation.lean"));
  expect(args).toContain("--fail-on-unproved");
  expect(options).toMatchObject({ shell: false, timeout: 45000, maxBuffer: 1048576, windowsHide: true });
});

const altered = change => { const body = response(); change(body); return success(body); };
const cases = [
  ["timeout", () => ({ status: null, error: new Error("ETIMEDOUT"), stdout: JSON.stringify(response()) })],
  ["missing verifier", () => ({ status: null, error: new Error("ENOENT"), stdout: "" })],
  ["nonzero exit despite accepted JSON", () => ({ ...success(response()), status: 1 })],
  ["signal termination", () => ({ ...success(response()), status: null, signal: "SIGTERM" })],
  ["malformed JSON", () => ({ status: 0, stdout: "{", stderr: "" })],
  ["null response", () => success(null)],
  ["missing record", () => success({ written: true })],
  ["unwritten receipt", () => altered(body => { body.written = false; })],
  ["rejected status", () => altered(body => { body.record.status = "rejected"; })],
  ["unverified trust", () => altered(body => { body.record.trust = "unverified"; })],
  ["not proof backed", () => altered(body => { body.record.proofCheckerBacked = false; })],
  ["wrong source hash", () => altered(body => { body.record.source.sha256 = "0".repeat(64); })],
  ["missing source", () => altered(body => { delete body.record.source; })],
  ["wrong requested declaration", () => altered(body => { body.record.source.declarationName = "other"; })],
  ["wrong parsed declaration", () => altered(body => { body.record.source.declaration.name = "other"; })],
  ["missing parsed declaration", () => altered(body => { delete body.record.source.declaration; })]
];

it.each(cases)("fails closed on %s without persisting a successful report", async (_name, result) => {
  spawnSync.mockReturnValue(result());
  let error;
  try { await evaluateTree(["-"]); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(Error);
  const output = JSON.parse(JSON.stringify(treeFailure(error)));
  expect(output).toMatchObject({ schema_version: request.schema_version,
    status: "unverified", proof_checker_backed: false });
  expect(Object.keys(output).sort()).toEqual(["error", "proof_checker_backed", "schema_version", "status"]);
  expect(reports()).toHaveLength(0);
  expect(writeFile.mock.calls.map(([file]) => path.basename(file))).toEqual(["request.json", "Evaluation.lean"]);
});

it("does not return success if saving the final report fails", async () => {
  spawnSync.mockReturnValue(success(response()));
  writeFile.mockImplementation(async file => {
    if (path.basename(file) === "report.json") throw new Error("ENOSPC");
  });
  await expect(evaluateTree(["-"])).rejects.toThrow("ENOSPC");
});

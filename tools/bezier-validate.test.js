import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contract } from "./bezier-validate.mjs";

const request = JSON.parse(await readFile(new URL("../docs/examples/bezier-coefficients.json", import.meta.url), "utf8"));
const faulty = JSON.parse(await readFile(new URL("../docs/examples/bezier-coefficients-faulty.json", import.meta.url), "utf8"));
const make = r => contract("construct", JSON.stringify(r));
const check = (r, c) => contract("check", JSON.stringify({ request_json: JSON.stringify(r), receipt_json: JSON.stringify(c) }));

describe("caller-supplied cubic coefficient contract", () => {
  for (const r of [request,
    { ...request, controls: ["7", "7", "7", "7"], candidate_coefficients: ["7", "0", "0", "0"] },
    { ...request, controls: ["1/2", "-1/3", "2/5", "-7/6"], candidate_coefficients: ["1/2", "-5/2", "47/10", "-58/15"] },
  ]) it(`checks exact equivalence for controls ${r.controls}`, () => {
    const receipt = make(r);
    expect(make(r)).toEqual(receipt);
    expect(check(r, receipt)).toEqual({ status: "equivalent", trust: "exact-computed", checked: true, proof_checker_backed: false });
  });
  it("returns an exact interior counterexample for the endpoint-preserving error", () => {
    const receipt = make(faulty);
    expect(receipt.counterexample).toEqual({ parameter: "1/3", curve: "4/9", candidate: "14/27" });
    expect(check(faulty, receipt)).toMatchObject({ status: "refuted", checked: true });
  });
  for (const [name, mutate] of [
    ["request", r => { r.request.controls[0] = "1"; }],
    ["hash", r => { r.request_sha256 = "bad"; }],
    ["trace", r => { r.expected_coefficients[1] = "4"; }],
    ["proof promotion", r => { r.trust = "proved"; }],
    ["version", r => { r.schema_version += "future"; }],
    ["extra metadata", r => { r.cloud = true; }],
  ]) it(`rejects ${name} tampering`, () => {
    const receipt = make(request); mutate(receipt);
    expect(() => check(request, receipt)).toThrow();
  });
  it("rejects a forged equivalence and out-of-domain or false counterexamples", () => {
    const receipt = make(faulty);
    expect(() => check(request, receipt)).toThrow();
    for (const patch of [{ parameter: "2" }, { curve: "0" }, { candidate: "4/9" }]) {
      const changed = structuredClone(receipt); Object.assign(changed.counterexample, patch);
      expect(() => check(faulty, changed)).toThrow();
    }
    receipt.status = "equivalent"; receipt.trust = "exact-computed"; receipt.counterexample = null;
    expect(() => check(faulty, receipt)).toThrow();
  });
  for (const patch of [{ schema_version: "future" }, { controls: ["1"] }, { controls: [true, "0", "0", "0"] },
    { controls: ["2/2", "0", "0", "0"] }, { candidate_coefficients: ["x", "0", "0", "0"] }, { assumptions: ["trust"] }]) {
    it(`rejects invalid input ${JSON.stringify(patch)}`, () => expect(() => make({ ...request, ...patch })).toThrow());
  }
  it("rejects duplicate keys and BOM input", () => {
    for (const raw of [JSON.stringify(request).replace('"controls":', '"controls":[],"controls":'), '\uFEFF' + JSON.stringify(request)]) {
      expect(() => contract("construct", raw)).toThrow();
    }
  });
  it("CLI supports stdin, replay and exit codes 0/1/2", () => {
    const cli = fileURLToPath(new URL("./bezier-validate.mjs", import.meta.url));
    const run = (args, input) => spawnSync(process.execPath, [cli, ...args], { input, encoding: "utf8", timeout: 30000, windowsHide: true,
      env: { ...process.env, TRUTH_HARNESS_CONTAINER: "1" } });
    for (const [r, code] of [[request, 0], [faulty, 1]]) {
      const result = run(["-"], JSON.stringify(r));
      expect(result.status, result.stderr).toBe(code);
      const report = JSON.parse(result.stdout);
      const replay = run(["--check", `${report.artifact_directory}/request.json`, `${report.artifact_directory}/receipt.json`]);
      expect(replay.status, replay.stderr).toBe(code);
      expect(JSON.parse(replay.stdout)).toMatchObject({ checked: true, status: report.status, receipt_sha256: report.receipt_sha256 });
    }
    const invalid = run(["-"], "{}");
    expect(invalid.status).toBe(2);
    expect(JSON.parse(invalid.stdout)).toMatchObject({ status: "unverified", checked: false });
  }, 30000);
});

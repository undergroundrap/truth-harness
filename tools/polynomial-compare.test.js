import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { polynomialContract as contract, polynomialExitCode } from "./polynomial-compare.mjs";

const fixture = async name => JSON.parse(await readFile(new URL(`../docs/examples/polynomial-${name}.json`, import.meta.url), "utf8"));
const equivalent = await fixture("equivalent");
const refuted = await fixture("refuted");
const unknown = await fixture("unknown");
const term = (coefficient, exponents) => ({ coefficient, exponents });
const make = r => contract("construct", JSON.stringify(r));
const check = (r, c) => contract("check", JSON.stringify({ request_json: JSON.stringify(r), receipt_json: JSON.stringify(c) }));

describe("general sparse polynomial equivalence", () => {
  it("normalizes duplicate monomials and ordering, independently of the producer", () => {
    const receipt = make(equivalent);
    expect(make(equivalent)).toEqual(receipt);
    expect(receipt.coefficient_trace).toHaveLength(3);
    expect(check(equivalent, receipt)).toMatchObject({ status: "equivalent", checked: true, trust: "exact-computed", proof_checker_backed: false });
  });
  for (const [name, request] of [
    ["empty zero", { ...equivalent, left: [], right: [] }],
    ["cancelled zero", { ...equivalent, left: [term("1/3", [2,7]), term("-1/3", [2,7])], right: [] }],
    ["rational arithmetic", { ...equivalent, left: [term("1/2", [3,4]), term("1/3", [3,4])], right: [term("5/6", [3,4])] }],
    ["quadratic summation coefficients", { ...equivalent, variables: 1, left: [term("1/2", [2]), term("1/2", [1])], right: [term("1/4", [2]), term("1/2", [1]), term("1/4", [2])] }],
    ["large sparse degree", { ...equivalent, left: [term("-2", [1000000,1000000])], right: [term("-2", [1000000,1000000])] }],
    ["eight variable ordering", { ...equivalent, variables: 8, left: [term("1", [1,2,3,4,5,6,7,8])], right: [term("1", [1,2,3,4,5,6,7,8])] }],
    ["64-term normalization", { ...equivalent, left: Array.from({ length: 64 }, () => term("1/3", [0,0])), right: [term("64/3", [0,0])] }],
  ]) it(`checks ${name}`, () => expect(check(request, make(request))).toMatchObject({ status: "equivalent", checked: true }));

  it("refutes equality only with a checked nonzero left-minus-right witness", () => {
    const receipt = make(refuted);
    expect(receipt.witness_receipt.witness).toEqual({ point: ["2", "3"], sample_index: 1, value: "5" });
    expect(check(refuted, receipt)).toMatchObject({ status: "refuted", trust: "refuted", checked: true });
  });
  it("preserves unknown on bit and sample exhaustion", () => {
    for (const r of [unknown, { ...refuted, budget: { max_samples: 1, max_bits: 1024 } }]) {
      expect(check(r, make(r))).toMatchObject({ status: "unknown", trust: "unverified", checked: false });
    }
  });
  it("keeps maximum-size two-sided receipts replayable", () => {
    const large = { ...equivalent, variables: 8, budget: { max_samples: 128, max_bits: 4096 },
      left: Array.from({ length: 64 }, (_, i) => term("-999999999999999999998/999999999999999999999", Array(8).fill(1000000 - i))),
      right: Array.from({ length: 64 }, (_, i) => term("999999999999999999998/999999999999999999999", Array(8).fill(999936 - i))),
    };
    const receipt = make(large);
    expect(Buffer.byteLength(JSON.stringify(receipt))).toBeLessThanOrEqual(65536);
    expect(check(large, receipt)).toMatchObject({ status: "unknown", checked: false });
  });
  it("allows coefficient growth during normalization without relaxing input limits", () => {
    const terms = Array.from({ length: 64 }, () => term("999999999999999999999", [0,0]));
    const large = { ...equivalent, left: terms, right: [...terms].reverse() };
    const receipt = make(large);
    expect(receipt.coefficient_trace[0].left).toBe((64n * 999999999999999999999n).toString());
    expect(check(large, receipt).status).toBe("equivalent");
  });
  it("rejects an otherwise-valid witness for another polynomial pair", () => {
    const receipt = make(refuted);
    const other = { ...refuted, left: [term("2", [1,0])], right: [] };
    receipt.witness_receipt = make(other).witness_receipt;
    expect(() => check(refuted, receipt)).toThrow(/Request mismatch/);
  });
  for (const [name, mutate] of [
    ["omitted monomial", r => { r.coefficient_trace.pop(); }],
    ["wrong coefficient", r => { r.coefficient_trace[0].left = "99"; }],
    ["boolean exponent", r => { r.coefficient_trace[0].exponents[0] = false; }],
    ["request", r => { r.request.variables = 1; }],
    ["hash", r => { r.request_sha256 = "bad"; }],
    ["version", r => { r.schema_version += "future"; }],
    ["proof promotion", r => { r.trust = "proved"; }],
    ["metadata", r => { r.telemetry = true; }],
  ]) it(`rejects ${name} tampering`, () => {
    const receipt = make(equivalent); mutate(receipt);
    expect(() => check(equivalent, receipt)).toThrow();
  });
  it("binds the nested witness to the original difference and rejects false equivalence", () => {
    const receipt = make(refuted);
    receipt.witness_receipt.witness.value = "0";
    expect(() => check(refuted, receipt)).toThrow();
    const changed = make(unknown);
    changed.status = "refuted"; changed.trust = "refuted"; changed.evidence_class = "exact-polynomial-counterexample";
    expect(() => check(unknown, changed)).toThrow();
    changed.status = "equivalent"; changed.trust = "exact-computed"; changed.evidence_class = "coefficient-normalization"; changed.witness_receipt = null;
    expect(() => check(unknown, changed)).toThrow();
  });
  for (const [name, patch] of [
    ["version", { schema_version: "future" }], ["variable limit", { variables: 9 }],
    ["boolean variable", { variables: true }], ["term limit", { left: Array.from({ length: 65 }, () => term("1", [0,0])) }],
    ["negative exponent", { left: [term("1", [-1,0])] }], ["dimension", { left: [term("1", [0])] }],
    ["noncanonical fraction", { left: [term("2/2", [0,0])] }], ["expression", { left: [term("x+1", [0,0])] }],
    ["domain assumption", { domain: "positive-integers" }], ["budget", { budget: { max_samples: 0, max_bits: 128 } }],
  ]) it(`rejects invalid ${name}`, () => expect(() => make({ ...equivalent, ...patch })).toThrow());
  it("rejects duplicate JSON keys and oversized input", () => {
    expect(() => contract("construct", JSON.stringify(equivalent).replace('"variables":2', '"variables":1,"variables":2'))).toThrow();
    expect(() => contract("construct", " ".repeat(65537))).toThrow();
  });
  it("CLI supports stdin, recheck, and four distinct exit outcomes", () => {
    const cli = fileURLToPath(new URL("./polynomial-compare.mjs", import.meta.url));
    const run = (args, input) => spawnSync(process.execPath, [cli, ...args], { input, encoding: "utf8", timeout: 30000, windowsHide: true,
      env: { ...process.env, TRUTH_HARNESS_CONTAINER: "1" } });
    for (const [r, status] of [[equivalent, "equivalent"], [refuted, "refuted"], [unknown, "unknown"]]) {
      const result = run(["-"], JSON.stringify(r));
      expect(result.status, result.stderr).toBe(polynomialExitCode(status));
      const report = JSON.parse(result.stdout);
      expect(report.status).toBe(status);
      const replay = run(["--check", `${report.artifact_directory}/request.json`, `${report.artifact_directory}/receipt.json`]);
      expect(replay.status, replay.stderr).toBe(result.status);
      expect(JSON.parse(replay.stdout)).toMatchObject({ status, receipt_sha256: report.receipt_sha256 });
    }
    const invalid = run(["-"], "{}");
    expect(invalid.status).toBe(2);
    expect(JSON.parse(invalid.stdout).checked).toBe(false);
  }, 30000);
});

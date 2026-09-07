import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { summationContract as contract, summationExitCode } from "./polynomial-sum.mjs";

const fixture = async name => JSON.parse(await readFile(new URL(`../docs/examples/polynomial-sum-${name}.json`, import.meta.url), "utf8"));
const linear = await fixture("linear");
const squares = await fixture("squares");
const refuted = await fixture("refuted");
const unknown = await fixture("unknown");
const term = (coefficient, degree) => ({ coefficient, exponents: [degree] });
const make = request => contract("construct", JSON.stringify(request));
const check = (request, receipt) => contract("check", JSON.stringify({ request_json: JSON.stringify(request), receipt_json: JSON.stringify(receipt) }));

describe("bounded polynomial summation", () => {
  for (const [name, request] of [
    ["linear", linear], ["squares", squares],
    ["cubes", { ...linear, summand: [term("1", 3)], candidate: [term("1/4", 4), term("1/2", 3), term("1/4", 2)] }],
    ["constant", { ...linear, summand: [term("-1/3", 0)], candidate: [term("-1/3", 1)] }],
    ["empty zero", { ...linear, summand: [], candidate: [] }],
    ["duplicate cancellation", { ...linear, candidate: [...linear.candidate, term("7", 12), term("-7", 12)].reverse() }],
    ["equality independent of search budget", { ...squares, budget: { max_n: 1 } }],
  ]) it(`checks ${name} by base and full recurrence coefficients`, () => {
    const receipt = make(request);
    expect(make(request)).toEqual(receipt);
    expect(receipt.base_value).toBe("0");
    expect(receipt.step_residual_coefficients).toEqual(Array(13).fill("0"));
    expect(check(request, receipt)).toMatchObject({ status: "identity-checked", trust: "exact-computed", checked: true, proof_checker_backed: false });
  });

  it("rejects a constant offset despite a correct recurrence", () => {
    const request = { ...linear, candidate: [...linear.candidate, term("1", 0)] };
    const receipt = make(request);
    expect(receipt.step_residual_coefficients).toEqual(Array(13).fill("0"));
    expect(check(request, receipt)).toMatchObject({ status: "refuted", counterexample: { n: 0, candidate_value: "1", sum_value: "0" } });
  });
  it("catches the wrong formula after initially matching samples", () => {
    expect(check(refuted, make(refuted))).toMatchObject({ status: "refuted", counterexample: { n: 2, candidate_value: "4", sum_value: "3" } });
    expect(check(unknown, make(unknown))).toMatchObject({ status: "unknown", checked: false, counterexample: null });
  });
  it("distinguishes f(n+1) from f(n) in the recurrence", () => {
    const request = { ...linear, candidate: [term("1/2", 2), term("-1/2", 1)] };
    expect(check(request, make(request))).toMatchObject({ status: "refuted", counterexample: { n: 1, candidate_value: "0", sum_value: "1" } });
  });
  it("does not infer identity from eleven matching positive samples", () => {
    // Candidate n(n-1)...(n-11), while the summand is zero.
    let values = [1n];
    for (let root = 0n; root < 12n; root++) {
      const next = Array(values.length + 1).fill(0n);
      values.forEach((c, i) => { next[i] -= root * c; next[i + 1] += c; });
      values = next;
    }
    const request = { ...linear, summand: [], candidate: values.map((v, i) => term(String(v), i)), budget: { max_n: 11 } };
    expect(check(request, make(request)).status).toBe("unknown");
    request.budget.max_n = 13;
    expect(check(request, make(request))).toMatchObject({ status: "refuted", counterexample: { n: 12, candidate_value: "479001600", sum_value: "0" } });
  });
  it("checks a noncancelled degree-12 candidate", () => {
    // f(k) = k^12 - (k-1)^12 telescopes to S(n) = n^12.
    const summand = [];
    let choose = 1n;
    for (let i = 0; i < 12; i++) {
      summand.push(term(String(i % 2 === 0 ? -choose : choose), i));
      choose = choose * BigInt(12 - i) / BigInt(i + 1);
    }
    const request = { ...linear, summand, candidate: [term("1", 12)] };
    expect(check(request, make(request))).toMatchObject({ status: "identity-checked", checked: true });
  });
  it("finds a first mismatch at the final supported endpoint n=13", () => {
    // f(k) = (k-1)...(k-12) vanishes at 1..12 but not 13.
    let values = [1n];
    for (let root = 1n; root <= 12n; root++) {
      const next = Array(values.length + 1).fill(0n);
      values.forEach((c, i) => { next[i] -= root * c; next[i + 1] += c; });
      values = next;
    }
    const request = { ...linear, summand: values.map((v, i) => term(String(v), i)), candidate: [], budget: { max_n: 12 } };
    expect(check(request, make(request)).status).toBe("unknown");
    request.budget.max_n = 13;
    expect(check(request, make(request))).toMatchObject({ status: "refuted", counterexample: { n: 13, candidate_value: "0", sum_value: "479001600" } });
  });
  it("keeps maximum-size rational traces bounded and replayable", () => {
    const terms = Array.from({ length: 32 }, (_, i) => term(`1/${999999999999999999999n - BigInt(i)}`, 12));
    const request = { ...linear, summand: terms, candidate: terms.slice().reverse() };
    const receipt = make(request);
    expect(Buffer.byteLength(JSON.stringify(receipt))).toBeLessThanOrEqual(65536);
    expect(check(request, receipt).status).toBe("refuted");
  });
  for (const [name, mutate] of [
    ["base", r => { r.base_value = "1"; }],
    ["recurrence", r => { r.step_residual_coefficients[2] = "1"; }],
    ["omitted coefficient", r => { r.step_residual_coefficients.pop(); }],
    ["numeric coefficient", r => { r.step_residual_coefficients[0] = 0; }],
    ["version", r => { r.schema_version = "future"; }],
    ["request", r => { r.request.budget.max_n = 1; }],
    ["hash", r => { r.request_sha256 = "wrong"; }],
    ["proved promotion", r => { r.status = "proved"; }],
    ["hidden assumption", r => { r.assumptions = ["n > 0"]; }],
  ]) it(`rejects tampered ${name}`, () => {
    const receipt = make(linear); mutate(receipt);
    expect(() => check(linear, receipt)).toThrow();
  });
  it("rejects counterfeit equivalence, unresolved results, and counterexamples", () => {
    const receipt = make(refuted);
    for (const status of ["identity-checked", "unknown"]) {
      expect(() => check(refuted, { ...receipt, status, counterexample: null })).toThrow();
    }
    for (const patch of [{ n: -1 }, { n: true }, { n: 14 }, { candidate_value: "3" }, { sum_value: "4" }]) {
      expect(() => check(refuted, { ...receipt, counterexample: { ...receipt.counterexample, ...patch } })).toThrow();
    }
    expect(() => check(squares, make(linear))).toThrow(/Request mismatch/);
  });
  for (const [name, patch] of [
    ["unknown version", { schema_version: "future" }],
    ["extra domain", { domain: "positive integers" }],
    ["too many terms", { summand: Array.from({ length: 33 }, () => term("1", 1)) }],
    ["degree", { candidate: [term("1", 13)] }],
    ["negative degree", { candidate: [term("1", -1)] }],
    ["boolean degree", { candidate: [term("1", true)] }],
    ["rational syntax", { candidate: [term("2/2", 1)] }],
    ["expression", { candidate: [term("n+1", 1)] }],
    ["variable count", { candidate: [{ coefficient: "1", exponents: [1, 0] }] }],
    ["budget", { budget: { max_n: 14 } }],
  ]) it(`rejects invalid ${name}`, () => expect(() => make({ ...linear, ...patch })).toThrow());

  it("CLI persists and rechecks all outcomes, supports stdin, and fails closed on bad bytes", () => {
    const cli = fileURLToPath(new URL("./polynomial-sum.mjs", import.meta.url));
    const run = (args, input) => spawnSync(process.execPath, [cli, ...args], { input, encoding: "utf8", timeout: 30000, windowsHide: true,
      env: { ...process.env, TRUTH_HARNESS_CONTAINER: "1" } });
    for (const request of [linear, refuted, unknown]) {
      const result = run(["-"], JSON.stringify(request));
      const report = JSON.parse(result.stdout);
      expect(result.status, result.stderr).toBe(summationExitCode(report.status));
      expect([0, 1, 3]).toContain(result.status);
      const replay = run(["--check", `${report.artifact_directory}/request.json`, `${report.artifact_directory}/receipt.json`]);
      expect(replay.status).toBe(result.status);
      expect(JSON.parse(replay.stdout)).toMatchObject({ status: report.status, receipt_sha256: report.receipt_sha256 });
    }
    for (const input of ["{}", " ".repeat(65537), Buffer.from([0xff]), "\ufeff{}", JSON.stringify(linear).replace('"max_n":13', '"max_n":13,"max_n":1')]) {
      expect(run(["-"], input).status).toBe(2);
    }
    expect(run(["missing request file.json"]).status).toBe(2);
  }, 30000);
});

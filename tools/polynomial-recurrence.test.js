import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { recurrenceContract as contract, recurrenceExitCode } from "./polynomial-recurrence.mjs";

const fixture = name => JSON.parse(readFileSync(new URL(`../docs/examples/polynomial-recurrence-${name}.json`, import.meta.url), "utf8"));
const squares = fixture("squares");
const refuted = fixture("refuted");
const unknown = fixture("unknown");
const term = (coefficient, degree) => ({ coefficient, exponents: [degree] });
const make = request => contract("construct", JSON.stringify(request));
const check = (request, receipt) => contract("check", JSON.stringify({ request_json: JSON.stringify(request), receipt_json: JSON.stringify(receipt) }));

describe("bounded polynomial recurrences", () => {
  for (const [name, request] of [
    ["order one", { ...refuted, candidate: [term("1", 2)] }],
    ["order two", squares],
    ["order three", { ...squares, recurrence_coefficients: ["1", "-3", "3"], initial_values: ["0", "1", "8"], forcing: [term("6", 0)], candidate: [term("1", 3)] }],
    ["order four", { ...squares, recurrence_coefficients: ["-1", "4", "-6", "4"], initial_values: ["0", "1", "16", "81"], forcing: [term("24", 0)], candidate: [term("1", 4)] }],
    ["rational weights", { ...squares, recurrence_coefficients: ["1/2"], initial_values: ["0"], forcing: [term("1/2", 1), term("1", 0)], candidate: [term("1", 1)] }],
    ["zero", { ...squares, initial_values: ["0", "0"], forcing: [], candidate: [] }],
    ["cancellation", { ...squares, candidate: [...squares.candidate, term("7", 12), term("-7", 12)].reverse() }],
    ["zero search budget", { ...squares, budget: { max_index: 0 } }]
  ]) it(`checks ${name} using all base values and coefficients`, () => {
    const receipt = make(request);
    expect(make(request)).toEqual(receipt);
    expect(receipt.recurrence_residual_coefficients).toEqual(Array(13).fill("0"));
    expect(check(request, receipt)).toMatchObject({ status: "identity-checked", trust: "exact-computed", checked: true, proof_checker_backed: false });
  });

  it("checks later initial values even with a correct recurrence", () => {
    const request = { ...squares, initial_values: ["0", "2"], budget: { max_index: 0 } };
    expect(make(request).recurrence_residual_coefficients).toEqual(Array(13).fill("0"));
    expect(check(request, make(request)).status).toBe("unknown");
    request.budget.max_index = 1;
    expect(check(request, make(request))).toMatchObject({ status: "refuted", counterexample: { index: 1, candidate_value: "1", sequence_value: "2" } });
  });
  it("refutes wrong candidates and preserves unresolved sample agreement", () => {
    expect(check(refuted, make(refuted))).toMatchObject({ status: "refuted", counterexample: { index: 1, candidate_value: "2", sequence_value: "1" } });
    expect(check(unknown, make(unknown))).toMatchObject({ status: "unknown", checked: false, counterexample: null });
    const extended = { ...unknown, budget: { max_index: 2 } };
    expect(check(extended, make(extended))).toMatchObject({ status: "refuted", counterexample: { index: 2, candidate_value: "6", sequence_value: "4" } });
  });
  it("handles degree twelve without relying on samples", () => {
    const forcing = [];
    let choose = 1n;
    for (let i = 0; i < 12; i++) {
      forcing.push(term(String(choose), i));
      choose = choose * BigInt(12 - i) / BigInt(i + 1);
    }
    const request = { ...refuted, forcing, candidate: [term("1", 12)] };
    expect(check(request, make(request)).status).toBe("identity-checked");
  });
  it("finds a first counterexample at the final supported index", () => {
    let values = [1n];
    for (let root = 0n; root < 12n; root++) {
      const next = Array(values.length + 1).fill(0n);
      values.forEach((c, i) => { next[i] -= root * c; next[i + 1] += c; });
      values = next;
    }
    const request = { ...squares, recurrence_coefficients: ["0", "0", "0", "0"], initial_values: ["0", "0", "0", "0"], forcing: values.map((v, i) => term(String(v), i)), candidate: [], budget: { max_index: 15 } };
    expect(check(request, make(request)).status).toBe("unknown");
    request.budget.max_index = 16;
    expect(check(request, make(request))).toMatchObject({ status: "refuted", counterexample: { index: 16, candidate_value: "0", sequence_value: "479001600" } });
  });
  for (const [name, mutate] of [
    ["initial trace", r => { r.candidate_initial_values[1] = "2"; }],
    ["residual trace", r => { r.recurrence_residual_coefficients[12] = "1"; }],
    ["missing coefficient", r => { r.recurrence_residual_coefficients.pop(); }],
    ["hash", r => { r.request_sha256 = "bad"; }],
    ["request", r => { r.request.budget.max_index = 0; }],
    ["version", r => { r.schema_version = "future"; }],
    ["proof promotion", r => { r.status = "proved"; }],
    ["hidden assumption", r => { r.assumptions = ["n > 1"]; }]
  ]) it(`rejects tampered ${name}`, () => {
    const receipt = make(squares); mutate(receipt);
    expect(() => check(squares, receipt)).toThrow();
  });
  it("rejects fabricated statuses and counterexamples", () => {
    const receipt = make(refuted);
    for (const status of ["identity-checked", "unknown"])
      expect(() => check(refuted, { ...receipt, status, counterexample: null })).toThrow();
    for (const patch of [{ index: true }, { index: 17 }, { index: -1 }, { candidate_value: "1" }, { sequence_value: "2" }])
      expect(() => check(refuted, { ...receipt, counterexample: { ...receipt.counterexample, ...patch } })).toThrow();
    expect(() => check(squares, receipt)).toThrow();
  });
  for (const [name, patch] of [
    ["version", { schema_version: "future" }],
    ["order zero", { recurrence_coefficients: [] }],
    ["order five", { recurrence_coefficients: ["1", "1", "1", "1", "1"] }],
    ["missing initial", { initial_values: ["0"] }],
    ["noncanonical rational", { initial_values: ["0", "2/2"] }],
    ["numeric rational", { initial_values: [0, 1] }],
    ["degree thirteen", { candidate: [term("1", 13)] }],
    ["boolean exponent", { candidate: [term("1", true)] }],
    ["too many terms", { forcing: Array(33).fill(term("1", 0)) }],
    ["boolean budget", { budget: { max_index: true } }],
    ["negative budget", { budget: { max_index: -1 } }],
    ["excessive budget", { budget: { max_index: 17 } }],
    ["metadata", { cloud: true }]
  ]) it(`rejects invalid ${name}`, () => expect(() => make({ ...squares, ...patch })).toThrow());
  it("fails closed on duplicate fields, BOM and unknown statuses", () => {
    const raw = JSON.stringify(squares);
    expect(() => contract("construct", "\ufeff" + raw)).toThrow();
    expect(() => contract("construct", raw.replace('"budget":', '"budget":{},"budget":'))).toThrow();
    expect(["identity-checked", "refuted", "unknown", "proved"].map(recurrenceExitCode)).toEqual([0, 1, 3, 2]);
  });
});

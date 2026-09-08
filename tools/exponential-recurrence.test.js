import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { recurrenceContract as contract } from "./polynomial-recurrence.mjs";

const fixture = name => JSON.parse(readFileSync(new URL(`../docs/examples/exponential-recurrence-${name}.json`, import.meta.url), "utf8"));
const tree = fixture("tree");
const term = (coefficient, degree, base) => ({ coefficient, exponents: [degree], base });
const make = r => contract("construct", JSON.stringify(r));
const check = (r, c) => contract("check", JSON.stringify({ request_json: JSON.stringify(r), receipt_json: JSON.stringify(c) }));

describe("bounded exponential recurrence candidates", () => {
  beforeAll(() => {
    if (process.env.TRUTH_HARNESS_REQUIRE_DOCKER_TESTS === "1") expect(process.env.TRUTH_HARNESS_CONTAINER).toBe("1");
  });
  for (const [name, patch] of [
    ["binary tree", {}],
    ["negative base", { recurrence_coefficients: ["-2"], forcing: [], candidate: [term("1", 0, "-2")] }],
    ["fractional base", { recurrence_coefficients: ["1/2"], forcing: [], candidate: [term("1", 0, "1/2")] }],
    ["repeated root", { recurrence_coefficients: ["-4", "4"], initial_values: ["0", "2"], forcing: [], candidate: [term("1", 1, "2")] }],
    ["two roots", { recurrence_coefficients: ["-6", "5"], initial_values: ["2", "5"], forcing: [], candidate: [term("1", 0, "2"), term("1", 0, "3")] }],
    ["three roots", { recurrence_coefficients: ["6", "-11", "6"], initial_values: ["3", "6", "14"], forcing: [], candidate: [term("1", 0, "1"), term("1", 0, "2"), term("1", 0, "3")] }],
    ["four roots", { recurrence_coefficients: ["-120", "154", "-71", "14"], initial_values: ["4", "14", "54", "224"], forcing: [], candidate: ["2", "3", "4", "5"].map(b => term("1", 0, b)) }],
    ["order four repeated root", { recurrence_coefficients: ["-16", "32", "-24", "8"], initial_values: ["0", "2", "32", "216"], forcing: [], candidate: [term("1", 3, "2")] }],
    ["zero", { initial_values: ["0"], forcing: [], candidate: [] }],
    ["duplicate cancellation", { candidate: [...tree.candidate, term("7", 12, "-2"), term("-7", 12, "-2")].reverse() }],
    ["lower base limit", { recurrence_coefficients: ["1/16"], forcing: [], candidate: [term("1", 0, "1/16")] }],
    ["upper base limit", { recurrence_coefficients: ["16"], forcing: [], candidate: [term("1", 0, "16")] }]
  ]) it(`checks ${name} with complete per-base traces`, () => {
    const r = { ...tree, ...patch };
    const receipt = make(r);
    expect(make(r)).toEqual(receipt);
    expect(receipt.residual_by_base.every(row => row.coefficients.length === 13 && row.coefficients.every(c => c === "0"))).toBe(true);
    expect(check(r, receipt)).toMatchObject({ status: "identity-checked", trust: "exact-computed", proof_checker_backed: false, candidate_class: "rational-exponential-polynomial" });
  });
  it("checks initial conditions even when recurrence coefficients vanish", () => {
    const r = { ...tree, initial_values: ["2"] };
    expect(make(r).residual_by_base.every(row => row.coefficients.every(c => c === "0"))).toBe(true);
    expect(check(r, make(r))).toMatchObject({ status: "refuted", counterexample: { index: 0, candidate_value: "1", sequence_value: "2" } });
  });
  it("keeps matching initial samples unknown and refutes a later mismatch", () => {
    const unknown = fixture("unknown"), refuted = fixture("refuted");
    expect(check(unknown, make(unknown))).toMatchObject({ status: "unknown", checked: false });
    expect(check(refuted, make(refuted))).toMatchObject({ status: "refuted", counterexample: { index: 1, candidate_value: "2", sequence_value: "3" } });
  });
  it("checks a degree twelve polynomial base-one candidate", () => {
    const forcing = [];
    let choose = 1n;
    for (let i = 0; i < 12; i++) {
      forcing.push({ coefficient: String(choose), exponents: [i] });
      choose = choose * BigInt(12 - i) / BigInt(i + 1);
    }
    const r = { ...tree, recurrence_coefficients: ["1"], initial_values: ["0"], forcing, candidate: [term("1", 12, "1")] };
    expect(check(r, make(r)).status).toBe("identity-checked");
  });
  for (const [name, mutate] of [
    ["base", c => { c.residual_by_base[0].base = "3"; }],
    ["coefficient", c => { c.residual_by_base[0].coefficients[12] = "1"; }],
    ["omitted base", c => { c.residual_by_base.pop(); }],
    ["omitted coefficient", c => { c.residual_by_base[0].coefficients.pop(); }],
    ["base order", c => { c.residual_by_base.reverse(); }],
    ["initial", c => { c.candidate_initial_values[0] = "2"; }],
    ["hash", c => { c.request_sha256 = "bad"; }],
    ["embedded request", c => { c.request.initial_values = ["2"]; }],
    ["version", c => { c.schema_version = "truth-harness.polynomial-recurrence-receipt.v0"; }],
    ["proof promotion", c => { c.status = "proved"; }]
  ]) it(`rejects tampered ${name}`, () => {
    const c = make(tree); mutate(c); expect(() => check(tree, c)).toThrow();
  });
  it("rejects fabricated statuses and witnesses", () => {
    const r = fixture("refuted"), c = make(r);
    for (const status of ["unknown", "identity-checked"]) expect(() => check(r, { ...c, status, counterexample: null })).toThrow();
    for (const patch of [{ index: true }, { index: 17 }, { candidate_value: "3" }, { sequence_value: "2" }])
      expect(() => check(r, { ...c, counterexample: { ...c.counterexample, ...patch } })).toThrow();
  });
  for (const [name, patch] of [
    ["zero base", { candidate: [term("1", 0, "0")] }],
    ["tiny base", { candidate: [term("1", 0, "1/17")] }],
    ["huge base", { candidate: [term("1", 0, "17")] }],
    ["noncanonical base", { candidate: [term("1", 0, "2/2")] }],
    ["boolean base", { candidate: [term("1", 0, true)] }],
    ["symbolic base", { candidate: [term("1", 0, "sqrt(2)")] }],
    ["too many bases", { candidate: ["1", "2", "3", "4", "5"].map(b => term("1", 0, b)) }],
    ["degree thirteen", { candidate: [term("1", 13, "2")] }],
    ["boolean exponent", { candidate: [term("1", true, "2")] }],
    ["large budget", { budget: { max_index: 17 } }],
    ["unknown version", { schema_version: "truth-harness.exponential-recurrence.v1" }],
    ["old version with bases", { schema_version: "truth-harness.polynomial-recurrence.v0" }],
    ["extra field", { assumptions: [] }]
  ]) it(`rejects invalid ${name}`, () => expect(() => make({ ...tree, ...patch })).toThrow());
  it("runs and replays through CLI in Docker, and refuses on the host", () => {
    const cli = fileURLToPath(new URL("../apps/cli/dist/index.js", import.meta.url));
    const run = (args, input) => spawnSync(process.execPath, [cli, "polynomial", ...args, "--json"], { input, encoding: "utf8", timeout: 30000, windowsHide: true });
    for (const [name, code] of [["tree", 0], ["refuted", 1], ["unknown", 3]]) {
      const result = run(["recurrence", "-"], JSON.stringify(fixture(name)));
      if (process.env.TRUTH_HARNESS_CONTAINER !== "1") {
        expect(result.status).toBe(2);
        expect(JSON.parse(result.stdout)).toMatchObject({ status: "unverified", checked: false });
        continue;
      }
      expect(result.status, result.stdout + result.stderr).toBe(code);
      const report = JSON.parse(result.stdout);
      expect(report.exponential_checker_sha256).toMatch(/^[a-f0-9]{64}$/);
      const replay = run(["replay", "recurrence", `${report.artifact_directory}/request.json`, `${report.artifact_directory}/receipt.json`]);
      expect(replay.status).toBe(code);
      expect(JSON.parse(replay.stdout).receipt_sha256).toBe(report.receipt_sha256);
    }
    for (const input of ["\ufeff{}", Buffer.from([255]), "x".repeat(65537)]) expect(run(["recurrence", "-"], input).status).toBe(2);
  }, 30000);
});

import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { boundedInput, runPython } from "./pit-witness.mjs";

const fixture = JSON.parse(await readFile(new URL("../docs/examples/pit-witness.json", import.meta.url), "utf8"));
const make = (r = fixture) => runPython("construct", JSON.stringify(r));
const check = (c, r = fixture) => runPython("check", JSON.stringify({ request_json: JSON.stringify(r), receipt_json: JSON.stringify(c) }));
const copy = () => structuredClone(fixture);

describe("bounded general sparse polynomial witnesses", () => {
  it("constructs a deterministic exact witness and independently checks it without site packages", () => {
    const receipt = make();
    expect(make()).toEqual(receipt);
    expect(receipt.witness).toEqual({ sample_index: 1, point: ["2", "3"], value: "5" });
    expect(check(receipt)).toEqual({ status: "witness-found", trust: "exact-computed", checked: true });
    const result = spawnSync("python", ["-S", fileURLToPath(new URL("./pit_witness.py", import.meta.url)), "check"], {
      input: JSON.stringify({ request_json: JSON.stringify(fixture), receipt_json: JSON.stringify(receipt) }), encoding: "utf8", timeout: 30000, windowsHide: true,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).checked).toBe(true);
  });

  for (const [name, mutate] of [
    ["value", r => { r.witness.value = "6"; }],
    ["point", r => { r.witness.point[0] = "3"; }],
    ["index", r => { r.witness.sample_index = true; }],
    ["count", r => { r.samples_checked = 1; }],
    ["proof promotion", r => { r.trust = "proved"; }],
    ["version", r => { r.schema_version += "future"; }],
    ["hash", r => { r.request_sha256 = "0"; }],
    ["request", r => { r.request.variables = 1; }],
    ["extra metadata", r => { r.cloud = true; }],
  ]) it(`rejects tampered ${name}`, () => {
    const receipt = make(); mutate(receipt);
    expect(() => check(receipt)).toThrow();
  });

  for (const [name, mutate] of [
    ["unknown version", r => { r.schema_version += "future"; }],
    ["boolean exponent", r => { r.terms[0].exponents[0] = true; }],
    ["negative exponent", r => { r.terms[0].exponents[0] = -1; }],
    ["dimension", r => { r.variables = 3; }],
    ["noncanonical rational", r => { r.terms[0].coefficient = "2/2"; }],
    ["expression", r => { r.terms[0].coefficient = "__import__('os')"; }],
    ["budget", r => { r.budget.max_bits = 4097; }],
    ["hidden assumptions", r => { r.assumptions = ["trust me"]; }],
  ]) it(`rejects invalid ${name}`, () => {
    const request = copy(); mutate(request);
    expect(() => make(request)).toThrow();
  });

  it("normalizes duplicates and exact rational coefficients", () => {
    const request = copy();
    request.terms = [{ coefficient: "1/2", exponents: [0, 0] }, { coefficient: "1/3", exponents: [0, 0] }];
    const receipt = make(request);
    expect(receipt.witness.value).toBe("5/6");
    expect(check(receipt, request).checked).toBe(true);
    expect(() => check(receipt)).toThrow(/mismatch/);
  });

  it("preserves unresolved zero and sample-budget results", () => {
    const request = copy(); request.budget.max_samples = 1;
    expect(make(request).reason).toBe("sample_budget");
    request.terms[1] = { coefficient: "-1", exponents: [3, 0] };
    const zero = make(request);
    expect(zero.reason).toBe("zero_polynomial");
    expect(check(zero, request)).toEqual({ status: "unknown", trust: "unverified", checked: false });
    zero.trust = "proved";
    expect(() => check(zero, request)).toThrow();
  });

  it("rejects large powers before allocating them", () => {
    const request = copy();
    request.terms = [{ coefficient: "1", exponents: [1000000, 0] }, { coefficient: "-1", exponents: [0, 0] }];
    request.budget.max_bits = 128;
    const receipt = make(request);
    expect(receipt).toMatchObject({ status: "unknown", reason: "bit_budget", samples_checked: 1 });
    expect(check(receipt, request).checked).toBe(false);
  });

  it("rejects duplicate JSON keys instead of silently selecting one", () => {
    expect(() => runPython("construct", JSON.stringify(fixture).replace('"variables":2', '"variables":1,"variables":2'))).toThrow();
    expect(() => runPython("construct", " ".repeat(65537))).toThrow();
  });

  it("reads paths with spaces and rejects BOM, malformed UTF-8 and oversized files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "pit witness "));
    const file = path.join(root, "input file.json");
    try {
      const raw = JSON.stringify(fixture);
      await writeFile(file, raw);
      expect(await boundedInput(file)).toBe(raw);
      for (const bytes of [Buffer.from([239, 187, 191, 123, 125]), Buffer.from([255]), Buffer.alloc(65537)]) {
        await writeFile(file, bytes);
        await expect(boundedInput(file)).rejects.toThrow();
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("CLI accepts stdin and returns unknown=1, invalid=2, with JSON output", () => {
    const cli = fileURLToPath(new URL("./pit-witness.mjs", import.meta.url));
    const request = copy(); request.budget.max_samples = 1;
    const run = input => spawnSync(process.execPath, [cli, "-"], { input, encoding: "utf8", timeout: 30000, windowsHide: true,
      env: { ...process.env, TRUTH_HARNESS_CONTAINER: "1" } });
    const unknown = run(JSON.stringify(request));
    expect(unknown.status, unknown.stderr).toBe(1);
    const report = JSON.parse(unknown.stdout);
    expect(report).toMatchObject({ checked: false, status: "unknown" });
    const invalid = run("{}");
    expect(invalid.status).toBe(2);
    expect(JSON.parse(invalid.stdout).trust).toBe("unverified");
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseExperiment, python, sparseBridge, sparseClass, sparseFixturePath } from "./pit-experiment.mjs";

const fixture = parseExperiment(await readFile(sparseFixturePath, "utf8"), sparseClass);
const request = (c) => ({ schema_version: "truth-harness.pit-sparse-request.v0", polynomial_class: sparseClass, points: c.points });
const make = (index = 1) => python("construct", request(fixture.cases[index]), sparseBridge);
const check = (bundle) => python("check", bundle, sparseBridge);

describe("bounded sparse PIT certificates", () => {
  for (const [index, c] of fixture.cases.entries()) {
    it(`${c.id}: checks the whole bounded sparse class or a sparse witness`, () => {
      const bundle = make(index);
      expect(make(index)).toEqual(bundle);
      expect(check(bundle)).toMatchObject({ conclusion: c.expected, trust: c.expected === "hits-class" ? "exact-computed" : "refuted" });
      if (c.expected === "hits-class") expect(check(bundle).supports_checked).toBe(45);
    });
  }

  for (const [name, mutate] of [
    ["omitted support", (b) => b.certificate.supports.pop()],
    ["duplicated support", (b) => { b.certificate.supports[10] = b.certificate.supports[9]; }],
    ["altered inverse", (b) => { b.certificate.supports[0].matrix[0][0] = "999"; }],
    ["extra proof claim", (b) => { b.proved = true; }],
    ["wrong basis", (b) => { b.basis[8] = [3, 3]; }],
    ["changed class", (b) => { b.request.polynomial_class = "all-polynomials"; }],
    ["unknown version", (b) => { b.schema_version += "-future"; }],
    ["changed points", (b) => { b.request.points[1] = [2, 2]; }]
  ]) {
    it(`rejects ${name}`, () => {
      const bundle = make();
      mutate(bundle);
      expect(() => check(bundle)).toThrow();
    });
  }

  it("rejects a three-term witness even when it vanishes on both points", () => {
    const bundle = make();
    bundle.certificate = { kind: "sparse_vanishing_polynomial", coefficients: ["2", "-3", "1", "0", "0", "0", "0", "0", "0"] };
    expect(() => check(bundle)).toThrow(/one or two nonzero terms/);
  });

  it("the same two points fail the earlier dense quadratic class", () => {
    const bundle = python("construct", { schema_version: "truth-harness.pit-request.v0", polynomial_class: "rational-bivariate-total-degree-at-most-two", points: fixture.cases[1].points });
    expect(python("check", bundle).conclusion).toBe("misses-class");
  });

  it("does not silently switch the dense experiment to the sparse class", () => {
    expect(() => parseExperiment(JSON.stringify(fixture))).toThrow(/class mismatch/);
    expect(() => python("check", make())).toThrow(/version/);
  });

  it("rejects the zero polynomial and a nonvanishing sparse witness", () => {
    const bundle = make(2);
    bundle.certificate.coefficients.fill("0");
    expect(() => check(bundle)).toThrow(/one or two/);
    bundle.certificate.coefficients[0] = "1";
    expect(() => check(bundle)).toThrow(/does not vanish/);
  });
});

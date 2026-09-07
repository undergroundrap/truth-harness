import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixturePath, parseExperiment, python } from "./pit-experiment.mjs";

const fixture = parseExperiment(await readFile(fixturePath, "utf8"));
const request = (c) => ({ schema_version: "truth-harness.pit-request.v0", polynomial_class: fixture.polynomial_class, points: c.points });

describe("bounded exact PIT experiment", () => {
  for (const c of fixture.cases) {
    it(`${c.id}: constructs and checks a deterministic certificate`, () => {
      const first = python("construct", request(c));
      expect(python("construct", request(c))).toEqual(first);
      expect(python("check", first)).toMatchObject({ conclusion: c.expected, trust: c.expected === "hits-class" ? "exact-computed" : "refuted" });
    });
  }

  it("finds the diagonal's nonzero linear counterexample", () => {
    const bundle = python("construct", request(fixture.cases[2]));
    expect(bundle.certificate.coefficients).toEqual(["0", "-1", "1", "0", "0", "0"]);
  });

  it("does not mistake a zero polynomial for a counterexample", () => {
    const bundle = python("construct", request(fixture.cases[2]));
    bundle.certificate.coefficients.fill("0");
    expect(() => python("check", bundle)).toThrow(/Zero polynomial/);
  });

  it("rejects a modified inverse", () => {
    const bundle = python("construct", request(fixture.cases[1]));
    bundle.certificate.matrix[0][0] = "999";
    expect(() => python("check", bundle)).toThrow(/identity failed/);
  });

  it("rejects a polynomial that fails to vanish", () => {
    const bundle = python("construct", request(fixture.cases[2]));
    bundle.certificate.coefficients[0] = "1";
    expect(() => python("check", bundle)).toThrow(/does not vanish/);
  });

  for (const [name, mutate] of [
    ["unknown version", (b) => { b.schema_version = "future"; }],
    ["wrong class", (b) => { b.request.polynomial_class = "general-circuits"; }],
    ["wrong basis", (b) => { b.basis[0] = [3, 0]; }],
    ["untrusted proof label", (b) => { b.trust = "proved"; }],
    ["float coordinate", (b) => { b.request.points[0][0] = 0.5; }],
    ["boolean coordinate", (b) => { b.request.points[0][0] = true; }],
    ["duplicate point", (b) => { b.request.points[0] = b.request.points[1]; }],
    ["expression injection", (b) => { b.certificate.coefficients[0] = "__import__('os')"; }],
    ["noncanonical rational", (b) => { b.certificate.coefficients[0] = "0/2"; }],
    ["oversized integer", (b) => { b.certificate.coefficients[0] = "1".repeat(50); }]
  ]) {
    it(`fails closed for ${name}`, () => {
      const bundle = python("construct", request(fixture.cases[2]));
      mutate(bundle);
      expect(() => python("check", bundle)).toThrow();
    });
  }

  it("validates fixture identities and rejects scope expansion", () => {
    const duplicate = structuredClone(fixture);
    duplicate.cases.push(duplicate.cases[0]);
    expect(() => parseExperiment(JSON.stringify(duplicate))).toThrow(/Duplicate case IDs/);
    expect(() => parseExperiment(JSON.stringify({ ...fixture, cloud: true }))).toThrow();
  });
});

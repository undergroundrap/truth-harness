import { describe, expect, it } from "vitest";
import { checkCounterexample, identities, request, requireIdentity } from "./bezier-experiment.mjs";
import { runPython } from "./pit-witness.mjs";

const make = () => runPython("construct", JSON.stringify(request));
const symbolic = (expression, patch = {}) => ({
  problem: `symbolic simplify ${expression}`, trust: "cross-checked",
  artifacts: [{ kind: "symbolic-computation-result", content: JSON.stringify({
    expression, result: "0", checkStatus: "passed", independentCasStatus: "passed", ...patch,
  }) }],
});

describe("fixed cubic Bezier experiment", () => {
  it("maps the sparse witness to an interior exact curve counterexample without SymPy in the checker", () => {
    const result = checkCounterexample(make());
    expect(result).toMatchObject({ status: "refuted", proof_checker_backed: false,
      controls: ["0", "1", "0", "0"], parameter: "1/2", de_casteljau: "3/8", faulty_horner: "1/2", difference: "-1/8" });
    expect(checkCounterexample(make())).toEqual(result);
  });
  for (const [name, mutate] of [
    ["value", r => { r.witness.value = "1"; }],
    ["parameter", r => { r.witness.point = ["0"]; }],
    ["unresolved", r => { r.status = "unknown"; r.trust = "unverified"; r.evidence_class = "none"; r.reason = "sample_budget"; r.witness = null; }],
    ["different polynomial", r => { r.request.terms[0].coefficient = "2"; }],
  ]) it(`rejects ${name} tampering`, () => {
    const receipt = make(); mutate(receipt);
    expect(() => checkCounterexample(receipt)).toThrow();
  });

  it("requires zero residual and independent CAS agreement for every identity", () => {
    expect(identities).toHaveLength(5);
    for (const expression of identities) {
      expect(() => requireIdentity(symbolic(expression), expression)).not.toThrow();
      for (const patch of [{ result: "1" }, { independentCasStatus: "unavailable" }, { checkStatus: "failed" }, { expression: "x" }]) {
        expect(() => requireIdentity(symbolic(expression, patch), expression)).toThrow();
      }
      const receipt = symbolic(expression); receipt.trust = "exact-computed";
      expect(() => requireIdentity(receipt, expression)).toThrow();
    }
  });

  it("the mutation evades endpoint-only testing", () => {
    for (const t of [0, 1]) expect(3 * t * (1 - t) ** 2).toBe(((2 * t - 5) * t + 3) * t);
  });
});

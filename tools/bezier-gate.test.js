import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { assessRun } from "./bezier-gate.mjs";

const success = {
  schema_version: "truth-harness.bezier-experiment.v0",
  basis_identities: { status: "cross-checked", count: 4 }, denominator_mapping: "cross-checked",
  mutation: { schema_version: "truth-harness.bezier-counterexample.v0", status: "refuted",
    evidence_class: "exact-rational-counterexample", proof_checker_backed: false,
    controls: ["0", "1", "0", "0"], parameter: "1/2", de_casteljau: "3/8", faulty_horner: "1/2", difference: "-1/8" },
  artifact_directory: ".truth-harness/experiments/bezier-Example", witness_directory: ".truth-harness/witnesses/pit-Example",
};
const failure = { status: "unverified", error: "Both symbolic engines must agree\nassertion detail" };
const run = (value, exit_code = 0) => ({ exit_code, error: null, signal: null, stdout: JSON.stringify(value) });

describe("Bezier real-engine CI gate", () => {
  it("requires the successful experiment and specific missing-verifier rejection", () => {
    expect(assessRun(run(success))).toEqual(success);
    expect(assessRun(run(failure, 2), true)).toEqual(failure);
    expect(() => assessRun(run(success), true)).toThrow();
    expect(() => assessRun(run(failure, 2))).toThrow();
  });
  it("does not accept crashes, timeouts, malformed JSON or unrelated failures as negative coverage", () => {
    for (const patch of [{ exit_code: 1 }, { exit_code: 0 }, { signal: "SIGTERM" }, { error: "timeout" },
      { stdout: "not JSON" }, { stdout: JSON.stringify({ status: "unverified", error: "File not found" }) }]) {
      expect(() => assessRun({ ...run(failure, 2), ...patch }, true)).toThrow();
    }
  });
  it("rejects weakened positive evidence and altered counterexamples", () => {
    for (const mutate of [
      r => { r.basis_identities.count = 3; }, r => { r.denominator_mapping = "unverified"; },
      r => { r.mutation.parameter = "2"; }, r => { r.mutation.difference = "0"; },
      r => { r.mutation.proof_checker_backed = true; }, r => { r.artifact_directory = "../elsewhere"; },
    ]) {
      const result = structuredClone(success); mutate(result);
      expect(() => assessRun(run(result))).toThrow();
    }
  });
  it("wires an unconditional Docker gate into CI", async () => {
    const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    expect(workflow).toContain("bezier-gate:");
    expect(workflow).toContain("docker compose run --build --rm -T pit-experiment node tools/bezier-gate.mjs");
    const job = workflow.slice(workflow.indexOf("  bezier-gate:"));
    expect(job).not.toMatch(/continue-on-error|if:|\|\| true/);
    expect(job).toContain("sudo install -d -o 10001 -g 10001 -m 0755 .truth-harness");
  });
});

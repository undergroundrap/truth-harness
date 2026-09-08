import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { polynomialCapabilities, runPolynomialTool } from "./polynomial-tools.js";

const fixture = (name: string) => readFile(new URL(`../../../docs/examples/${name}.json`, import.meta.url), "utf8");
afterEach(() => vi.unstubAllEnvs());

describe("polynomial tool adapter", () => {
  it("advertises deterministic contracts without executing mathematics", () => {
    vi.stubEnv("TRUTH_HARNESS_CONTAINER", "");
    expect(polynomialCapabilities()).toEqual(polynomialCapabilities());
    expect(polynomialCapabilities()).toMatchObject({ execution: "unavailable", proof_checker_backed: false, replay: true });
    expect(polynomialCapabilities().operations.map(op => op.operation)).toEqual(["compare", "sum", "recurrence"]);
    expect(polynomialCapabilities().operations.find(op => op.operation === "recurrence")).toMatchObject({
      accepted_request_schemas: ["truth-harness.polynomial-recurrence.v0", "truth-harness.exponential-recurrence.v0"],
      max_candidate_bases: 4, min_base_magnitude: "1/16", max_base_magnitude: "16"
    });
  });
  it("refuses host execution and ambiguous or excessive inputs", async () => {
    vi.stubEnv("TRUTH_HARNESS_CONTAINER", "");
    expect((await runPolynomialTool({ operation: "sum", requestJson: "{}" })).exit_code).toBe(2);
    vi.stubEnv("TRUTH_HARNESS_CONTAINER", "1");
    for (const input of [
      { operation: "sum" as const },
      { operation: "sum" as const, requestJson: "{}", requestPath: "file.json" },
      { operation: "sum" as const, requestJson: "{}", receiptPath: "file.json" },
      { operation: "sum" as const, requestJson: "x".repeat(65537) },
      { operation: "sum" as const, requestPath: "-" }
    ]) expect((await runPolynomialTool(input)).exit_code).toBe(2);
  });
  it("preserves accepted, refuted and unknown reports for all operations", async () => {
    vi.stubEnv("TRUTH_HARNESS_CONTAINER", "1");
    for (const [operation, prefix, good] of [["compare", "polynomial", "equivalent"], ["sum", "polynomial-sum", "linear"], ["recurrence", "polynomial-recurrence", "squares"], ["recurrence", "exponential-recurrence", "tree"]] as const) {
      for (const [suffix, exitCode] of [[good, 0], ["refuted", 1], ["unknown", 3]] as const) {
        const result = await runPolynomialTool({ operation, requestJson: await fixture(`${prefix}-${suffix}`) });
        expect(result.exit_code, JSON.stringify(result)).toBe(exitCode);
        expect(result.report.proof_checker_backed).toBe(false);
        const directory = result.report.artifact_directory;
        const replay = await runPolynomialTool({ operation, requestPath: `${directory}/request.json`, receiptPath: `${directory}/receipt.json` });
        expect(replay.exit_code).toBe(exitCode);
        expect(replay.report.receipt_sha256).toBe(result.report.receipt_sha256);
      }
    }
  }, 30000);
});

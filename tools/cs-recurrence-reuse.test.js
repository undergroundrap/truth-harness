import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, it } from "vitest";

const script = fileURLToPath(new URL("./cs-recurrence-reuse.mjs", import.meta.url));
const run = env => spawnSync(process.execPath, [script], { env, encoding: "utf8", timeout: 30000, windowsHide: true });
beforeAll(() => {
  if (process.env.TRUTH_HARNESS_REQUIRE_DOCKER_TESTS === "1") expect(process.env.TRUTH_HARNESS_CONTAINER).toBe("1");
});
it("reuses evidence only for a matching model, then refutes and repairs changed leaf cost", () => {
  const result = run(process.env);
  if (process.env.TRUTH_HARNESS_CONTAINER !== "1") {
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ passed: false, status: "unverified" });
    return;
  }
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.modeling_status).toBe("human-supplied-not-code-verified");
  expect(report.reused.receipt_sha256).toBe(report.source.receipt_sha256);
  expect(report.reused.artifact_directory).toBeNull();
  expect(report.rejection).toMatchObject({ status: "reuse-rejected", reason: "request-mismatch" });
  expect(report.refuted.counterexample).toEqual({ index: 0, candidate_value: "1", sequence_value: "0" });
  expect(report.corrected).toMatchObject({ status: "identity-checked", proof_checker_backed: false });
  expect(report.corrected.receipt_sha256).not.toBe(report.source.receipt_sha256);
}, 30000);
it("refuses host execution even in the Docker gate", () => {
  const result = run({ ...process.env, TRUTH_HARNESS_CONTAINER: "" });
  expect(result.status).toBe(2);
  expect(JSON.parse(result.stdout)).toMatchObject({ passed: false, status: "unverified" });
});
it("enumerates both finite workload models without using the candidate formulas", () => {
  const visits = (height, leafCost) => height === 0 ? leafCost : 1n + visits(height - 1, leafCost) + visits(height - 1, leafCost);
  for (let h = 0; h <= 16; h++) {
    expect(visits(h, 1n)).toBe(2n ** BigInt(h + 1) - 1n);
    expect(visits(h, 0n)).toBe(2n ** BigInt(h) - 1n);
  }
});

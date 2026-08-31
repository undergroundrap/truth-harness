import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  validateHumContractInputs,
  type HumCapabilitiesReport,
  type HumValidateReport
} from "@truth-harness/core";
import { program } from "./index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("Hum validate CLI", () => {
  it("validates Hum obligation and result files with stable JSON output", async () => {
    const result = await runCli([
      "hum",
      "validate",
      "fixtures/hum/proved_allocation_free.json",
      "fixtures/hum/result_unknown.json",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as HumValidateReport;

    expect(result.exitCode).toBe(0);
    expect(json).toMatchObject({
      schema_version: "truth-harness.hum_validate.v0",
      status: "valid",
      exit_code: 0,
      summary: {
        total: 2,
        valid: 2,
        invalid: 0,
        tool_errors: 0
      },
      privacy: {
        local_first: true,
        network_access: "none",
        cloud_access: "none",
        telemetry: "none"
      }
    });
    expect(json.inputs.map((input) => input.kind)).toEqual(["obligation", "result"]);
    expect(json.inputs.every((input) => input.valid)).toBe(true);
  });

  it("validates a Hum math-obligations out-dir with stable ordering", async () => {
    const result = await runCli(["hum", "validate", "fixtures/hum/generated/math-obligations", "--json"]);
    const json = JSON.parse(result.stdout) as HumValidateReport;
    const sources = json.inputs.map((input) => input.source.replace(/\\/gu, "/"));

    expect(result.exitCode).toBe(0);
    expect(json).toMatchObject({
      status: "valid",
      exit_code: 0,
      summary: {
        total: 2,
        valid: 2,
        invalid: 0,
        tool_errors: 0
      }
    });
    expect(sources).toEqual([
      "fixtures/hum/generated/math-obligations/001_allocation_freedom_writer.json",
      "fixtures/hum/generated/math-obligations/002_peak_memory_bound_window_sum.json"
    ]);
    expect(json.inputs.map((input) => input.kind)).toEqual(["obligation", "obligation"]);
  });
  it("prints a useful human summary", async () => {
    const result = await runCli(["hum", "validate", "fixtures/hum/proved_allocation_free.json"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hum validate: valid");
    expect(result.stdout).toContain("1/1 valid");
    expect(result.stdout).toContain("Exit code: 0");
  });

  it.each([
    ["unsupported_obligation_type.json", "json_schema"],
    ["proved_without_certificate.json", "proved_requires_evidence"],
    ["camel_case_fields.json", "snake_case_fields"],
    ["benchmark_treated_as_proof.json", "benchmark_not_proof"],
    ["hidden_assumptions.json", "hidden_assumption"],
    ["network_cloud_metadata.json", "local_first_privacy"]
  ])("rejects invalid Hum fixture %s", async (fixture, expectedRule) => {
    const result = await runCli(["hum", "validate", `fixtures/hum/invalid/${fixture}`, "--json"]);
    const json = JSON.parse(result.stdout) as HumValidateReport;

    expect(result.exitCode).toBe(1);
    expect(json.status).toBe("invalid");
    expect(json.exit_code).toBe(1);
    expect(json.inputs[0]?.valid).toBe(false);
    expect(json.inputs[0]?.issues.map((issue) => issue.rule)).toContain(expectedRule);
  });

  it("rejects unknown schema versions unless explicitly allowed", async () => {
    const root = await tempRoot();
    const path = join(root, "future-obligation.json");
    const raw = await readFile("fixtures/hum/proved_allocation_free.json", "utf8");
    await writeFile(path, raw.replace("hum.math_obligation.v0", "hum.math_obligation.v1"), "utf8");

    const rejected = JSON.parse((await runCli(["hum", "validate", path, "--json"])).stdout) as HumValidateReport;
    const allowed = JSON.parse(
      (await runCli(["hum", "validate", path, "--kind", "obligation", "--allow-unknown-schema-version", "--json"])).stdout
    ) as HumValidateReport;

    expect(rejected.status).toBe("invalid");
    expect(rejected.exit_code).toBe(1);
    expect(rejected.inputs[0]?.issues.map((issue) => issue.rule)).toContain("schema_version");
    expect(allowed.status).toBe("valid");
    expect(allowed.exit_code).toBe(0);
    expect(allowed.inputs[0]?.warnings[0]).toContain("unknown schema version");
  });

  it("supports stdin-shaped input without changing unresolved unknown results", async () => {
    const raw = await readFile("fixtures/hum/result_unknown.json", "utf8");
    const report = await validateHumContractInputs({
      inputs: ["-"],
      kind: "auto",
      allowUnknownSchemaVersion: false,
      stdinText: raw
    });

    expect(report.status).toBe("valid");
    expect(report.exit_code).toBe(0);
    expect(report.inputs[0]).toMatchObject({
      source: "-",
      kind: "result",
      schema_version: "hum.math_result.v0",
      valid: true
    });
  });

  it("rejects UTF-8 BOM before schema validation", async () => {
    const raw = await readFile("fixtures/hum/proved_allocation_free.json", "utf8");
    const report = await validateHumContractInputs({
      inputs: ["-"],
      kind: "auto",
      allowUnknownSchemaVersion: false,
      stdinText: `\ufeff${raw}`
    });

    expect(report.status).toBe("invalid");
    expect(report.exit_code).toBe(1);
    expect(report.inputs[0]?.issues).toContainEqual(
      expect.objectContaining({
        rule: "utf8_no_bom"
      })
    );
  });

  it("uses exit code 2 for tool and IO failures", async () => {
    const result = await runCli(["hum", "validate", "fixtures/hum/missing-file.json", "--json"]);
    const json = JSON.parse(result.stdout) as HumValidateReport;

    expect(result.exitCode).toBe(2);
    expect(json.status).toBe("tool_error");
    expect(json.exit_code).toBe(2);
    expect(json.inputs[0]?.issues[0]).toMatchObject({ rule: "tool_io_failure" });
  });

  it("prints stable validation-only Hum capabilities as JSON", async () => {
    const first = await runCli(["hum", "capabilities", "--json"]);
    const second = await runCli(["hum", "capabilities", "--json"]);
    const report = JSON.parse(first.stdout) as HumCapabilitiesReport;

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
    expect(report.schema_version).toBe("truth-harness.hum_capabilities.v0");
    expect(report.validation).toMatchObject({ available: true, scope: "schema_and_honesty_rules" });
    expect(report.verification).toEqual({
      available: false,
      adapters: [],
      reason: "Verification is unavailable until a concrete Hum verifier adapter is installed."
    });
    expect(report.obligation_kinds.every((entry) => entry.verification === "unavailable")).toBe(true);
    expect(report.normalized_representations.every((entry) => entry.verification === "unavailable")).toBe(true);
    expect(report.proof_policy).toMatchObject({
      llm_prose_counts_as_proof: false,
      compiler_fact_text_counts_as_proof: false,
      unknown_is_valid: true
    });
    expect(report.privacy).toEqual({
      local_first: true,
      network_access: "none",
      cloud_access: "none",
      telemetry: "none"
    });
  });

  it("prints a useful human capability summary without implying verification", async () => {
    const result = await runCli(["hum", "capabilities"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hum capabilities: truth-harness.hum_capabilities.v0");
    expect(result.stdout).toContain("Validation: available (schema_and_honesty_rules)");
    expect(result.stdout).toContain("Verification: unavailable");
    expect(result.stdout).toContain("network=none; cloud=none; telemetry=none");
  });
});

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const previousExitCode = process.exitCode;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...values) => {
    stdout.push(values.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...values) => {
    stderr.push(values.join(" "));
  });

  try {
    process.exitCode = undefined;
    await program.parseAsync(["node", "truth-harness", ...args], { from: "node" });
    return {
      exitCode: Number(process.exitCode ?? 0),
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n")
    };
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-hum-cli-"));
  roots.push(root);
  return root;
}

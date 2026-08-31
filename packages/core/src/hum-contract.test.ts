import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  createHumCapabilitiesReport,
  HUM_CONTRACT_PRIVACY,
  validateHumContractInputs
} from "./hum-contract.js";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("Hum reusable contract API", () => {
  it("preserves the exact validation envelope for unresolved stdin results", async () => {
    const stdinText = await readFile("fixtures/hum/result_unknown.json", "utf8");
    const report = await validateHumContractInputs({
      inputs: ["-"],
      kind: "auto",
      allowUnknownSchemaVersion: false,
      stdinText
    });

    expect(report).toEqual({
      schema_version: "truth-harness.hum_validate.v0",
      status: "valid",
      exit_code: 0,
      summary: {
        total: 1,
        valid: 1,
        invalid: 0,
        tool_errors: 0
      },
      inputs: [
        {
          source: "-",
          kind: "result",
          schema_version: "hum.math_result.v0",
          valid: true,
          issues: [],
          warnings: [],
          summary: "-: valid result"
        }
      ],
      privacy: HUM_CONTRACT_PRIVACY
    });
  });

  it("advertises deterministic validation-only capabilities", () => {
    const report = createHumCapabilitiesReport();

    expect(report).toEqual({
      schema_version: "truth-harness.hum_capabilities.v0",
      contract: {
        obligation_schema_versions: ["hum.math_obligation.v0"],
        result_schema_versions: ["hum.math_result.v0"]
      },
      obligation_kinds: [
        { kind: "allocation_freedom", validation: "supported", verification: "unavailable" },
        { kind: "peak_memory_bound", validation: "supported", verification: "unavailable" },
        { kind: "purity_replayability", validation: "supported", verification: "unavailable" }
      ],
      normalized_representations: [
        { representation: "hum_static_claim_v0", validation: "supported", verification: "unavailable" },
        { representation: "smtlib2", validation: "supported", verification: "unavailable" },
        { representation: "json_logic", validation: "supported", verification: "unavailable" },
        { representation: "plain_text", validation: "supported", verification: "unavailable" }
      ],
      validation: {
        available: true,
        scope: "schema_and_honesty_rules",
        inputs: ["file", "directory", "stdin"],
        unknown_schema_versions: "rejected_by_default"
      },
      verification: {
        available: false,
        adapters: [],
        reason: "Verification is unavailable until a concrete Hum verifier adapter is installed."
      },
      result_statuses: ["proved", "refuted", "unknown", "unsupported", "timeout"],
      proof_policy: {
        llm_prose_counts_as_proof: false,
        compiler_fact_text_counts_as_proof: false,
        proved_requires_one_of: ["proof_certificate", "checkable_trace"],
        unknown_is_valid: true
      },
      privacy: HUM_CONTRACT_PRIVACY
    });
    expect(JSON.stringify(createHumCapabilitiesReport())).toBe(JSON.stringify(report));
  });

  it("ships unchanged schemas that validate from an installed core package", async () => {
    const obligationSchema = await readFile("schemas/hum.math_obligation.v0.schema.json", "utf8");
    const resultSchema = await readFile("schemas/hum.math_result.v0.schema.json", "utf8");
    expect(await readFile("packages/core/schemas/hum.math_obligation.v0.schema.json", "utf8")).toBe(obligationSchema);
    expect(await readFile("packages/core/schemas/hum.math_result.v0.schema.json", "utf8")).toBe(resultSchema);

    const npmCli = process.env.npm_execpath;
    if (!npmCli) {
      throw new Error("npm_execpath is required for the packed core contract test.");
    }

    await execFileAsync(process.execPath, [npmCli, "run", "build", "--workspace", "@truth-harness/core"]);
    const tempRoot = await mkdtemp(resolve(".tmp-hum-core-pack-"));
    tempRoots.push(tempRoot);

    const pack = await execFileAsync(
      process.execPath,
      [npmCli, "pack", "--json", "--pack-destination", tempRoot],
      { cwd: resolve("packages/core") }
    );
    const [{ filename, files }] = JSON.parse(pack.stdout) as Array<{
      filename: string;
      files: Array<{ path: string }>;
    }>;
    expect(files.map((file) => file.path)).toEqual(expect.arrayContaining([
      "schemas/hum.math_obligation.v0.schema.json",
      "schemas/hum.math_result.v0.schema.json"
    ]));

    const tarball = join(tempRoot, filename);
    await execFileAsync(process.execPath, [
      npmCli,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--prefix",
      tempRoot,
      tarball
    ]);

    const installedEntry = join(tempRoot, "node_modules", "@truth-harness", "core", "dist", "index.js");
    const installedCore = await import(pathToFileURL(installedEntry).href) as {
      validateHumContractInputs: typeof validateHumContractInputs;
    };
    const report = await installedCore.validateHumContractInputs({
      inputs: ["-"],
      kind: "auto",
      allowUnknownSchemaVersion: false,
      stdinText: await readFile("fixtures/hum/result_unknown.json", "utf8")
    });

    expect(report).toMatchObject({
      schema_version: "truth-harness.hum_validate.v0",
      status: "valid",
      exit_code: 0,
      summary: { total: 1, valid: 1, invalid: 0, tool_errors: 0 }
    });
  }, 30_000);
});

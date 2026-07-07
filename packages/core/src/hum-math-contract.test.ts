import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateJsonSchema } from "./json-schema-validation.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCHEMAS_DIR = resolve(ROOT, "schemas");
const FIXTURES_DIR = resolve(ROOT, "fixtures/hum");

describe("Hum math engine contract", () => {
  it("validates V0 obligation fixtures against the local schema", async () => {
    const schema = await readJson("schemas/hum.math_obligation.v0.schema.json");
    const fixtures = [
      "proved_allocation_free.json",
      "refuted_allocation_free.json",
      "unknown_pointer_heavy.json",
      "generated/math-obligations/001_allocation_freedom_writer.json",
      "generated/math-obligations/002_peak_memory_bound_window_sum.json"
    ];

    for (const fixture of fixtures) {
      const value = await readJson(`fixtures/hum/${fixture}`);
      expect(validateJsonSchema(value, schema), fixture).toEqual([]);
      expect(Object.keys(value as Record<string, unknown>).every((key) => key === key.toLowerCase())).toBe(true);
    }
  });

  it("validates V0 result fixtures and preserves proof honesty rules", async () => {
    const schema = await readJson("schemas/hum.math_result.v0.schema.json");
    const fixtures = ["result_proved.json", "result_refuted.json", "result_unknown.json"];

    for (const fixture of fixtures) {
      const value = (await readJson(`fixtures/hum/${fixture}`)) as HumResultFixture;
      expect(validateJsonSchema(value, schema), fixture).toEqual([]);
      expect(value.llm_proof_accepted, fixture).toBe(false);
      expect(value.privacy, fixture).toEqual({
        local_first: true,
        network_access: "none",
        cloud_access: "none",
        telemetry: "none"
      });

      if (value.status === "proved") {
        expect(value.proof_certificate || value.checkable_trace, fixture).toBeTruthy();
      }

      if (value.status === "refuted") {
        expect(value.counterexample, fixture).toBeTruthy();
      }

      if (value.status === "unknown") {
        expect(value.proof_certificate, fixture).toBeNull();
        expect(value.counterexample, fixture).toBeNull();
        expect(value.model_limitations.length, fixture).toBeGreaterThan(0);
      }
    }
  });

  it("keeps Hum schemas compatible with the supported local JSON Schema subset", async () => {
    const schemas = ["hum.math_obligation.v0.schema.json", "hum.math_result.v0.schema.json"];

    for (const schemaFile of schemas) {
      const schema = await readJson(`schemas/${schemaFile}`);
      expect(validateJsonSchema({}, schema).length, schemaFile).toBeGreaterThan(0);
    }
  });
});

interface HumResultFixture {
  status: "proved" | "refuted" | "unknown" | "unsupported" | "timeout";
  proof_certificate: unknown | null;
  checkable_trace: unknown | null;
  counterexample: unknown | null;
  llm_proof_accepted: boolean;
  model_limitations: string[];
  privacy: {
    local_first: true;
    network_access: "none";
    cloud_access: "none";
    telemetry: "none";
  };
}

async function readJson(relativePath: string): Promise<unknown> {
  const baseDir = relativePath.startsWith("schemas/") ? SCHEMAS_DIR : FIXTURES_DIR;
  const fileName = relativePath.replace(/^schemas\//, "").replace(/^fixtures\/hum\//, "");
  return JSON.parse(await readFile(resolve(baseDir, fileName), "utf8"));
}

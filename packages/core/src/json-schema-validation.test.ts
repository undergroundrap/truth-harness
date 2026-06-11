import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findUnsupportedJsonSchemaFeatures, validateJsonSchema } from "./json-schema-validation.js";

const SCHEMAS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");

describe("JSON Schema validation", () => {
  it("validates the schema subset used by workspace artifacts", () => {
    const schema = {
      type: "object",
      required: ["schemaVersion", "entry", "tags"],
      properties: {
        schemaVersion: { const: "theorem.test.v0" },
        entry: { $ref: "#/$defs/entry" },
        tags: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", minLength: 1 } }
      },
      additionalProperties: false,
      $defs: {
        entry: {
          type: "object",
          required: ["id", "status"],
          properties: {
            id: { type: "string", pattern: "^id_[a-f0-9]{4}$" },
            status: { enum: ["planned", "sent"] },
            count: { type: "integer", minimum: 1 },
            createdAt: { type: "string", format: "date-time" }
          },
          additionalProperties: false
        }
      }
    };

    expect(
      validateJsonSchema(
        {
          schemaVersion: "theorem.test.v0",
          entry: {
            id: "id_ab12",
            status: "planned",
            count: 2,
            createdAt: "2026-06-10T00:00:00.000Z"
          },
          tags: ["local"]
        },
        schema
      )
    ).toEqual([]);

    expect(
      validateJsonSchema(
        {
          schemaVersion: "theorem.test.v0",
          entry: {
            id: "bad",
            status: "uploaded",
            count: 0,
            createdAt: "not-a-date",
            extra: true
          },
          tags: ["local", "local", ""],
          extra: true
        },
        schema
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "$.entry.id", message: expect.stringContaining("pattern") }),
        expect.objectContaining({ path: "$.entry.status", message: expect.stringContaining("one of") }),
        expect.objectContaining({ path: "$.entry.count", message: expect.stringContaining(">= 1") }),
        expect.objectContaining({ path: "$.entry.createdAt", message: expect.stringContaining("date-time") }),
        expect.objectContaining({ path: "$.entry.extra", message: expect.stringContaining("not allowed") }),
        expect.objectContaining({ path: "$.tags[1]", message: expect.stringContaining("unique") }),
        expect.objectContaining({ path: "$.tags[2]", message: expect.stringContaining("length >= 1") }),
        expect.objectContaining({ path: "$.extra", message: expect.stringContaining("not allowed") })
      ])
    );
  });

  it("rejects unsupported schema vocabulary instead of silently ignoring it", () => {
    const schema = {
      type: "object",
      oneOf: [{ required: ["a"] }, { required: ["b"] }]
    };

    expect(findUnsupportedJsonSchemaFeatures(schema)).toContainEqual(
      expect.objectContaining({
        path: "$.oneOf",
        keyword: "oneOf"
      })
    );
    expect(validateJsonSchema({ a: 1 }, schema)).toContainEqual(
      expect.objectContaining({
        path: "$.oneOf",
        message: expect.stringContaining("Unsupported JSON Schema keyword")
      })
    );
  });

  it("supports every JSON Schema keyword used by checked-in schemas", async () => {
    const schemaFiles = (await readdir(SCHEMAS_DIR)).filter((file) => file.endsWith(".json")).sort();
    const unsupported: string[] = [];

    for (const schemaFile of schemaFiles) {
      const schema = JSON.parse(await readFile(resolve(SCHEMAS_DIR, schemaFile), "utf8")) as unknown;
      for (const issue of findUnsupportedJsonSchemaFeatures(schema)) {
        unsupported.push(`${schemaFile} ${issue.path}: ${issue.message}`);
      }
    }

    expect(unsupported).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { assertJsonSchemaBeforeWrite, loadLocalJsonSchema } from "./schema-write-validation.js";

describe("schema write validation", () => {
  it("validates write payloads through a checked-in local schema", async () => {
    await expect(
      assertJsonSchemaBeforeWrite({
        schemaFile: "disclosure-log.schema.json",
        artifactName: "Test disclosure",
        value: validDisclosure()
      })
    ).resolves.toBeUndefined();
  });

  it("fails closed with field-level schema issues before write", async () => {
    await expect(
      assertJsonSchemaBeforeWrite({
        schemaFile: "disclosure-log.schema.json",
        artifactName: "Test disclosure",
        value: {
          ...validDisclosure(),
          privacy: undefined
        }
      })
    ).rejects.toThrow("Test disclosure failed JSON Schema validation before write");
  });

  it("refuses to resolve schema paths outside the checked-in schema directory", () => {
    expect(() => loadLocalJsonSchema("../package.json")).toThrow("Schema file must be a checked-in JSON schema filename");
    expect(() => loadLocalJsonSchema("nested/disclosure-log.schema.json")).toThrow(
      "Schema file must be a checked-in JSON schema filename"
    );
  });
});

function validDisclosure(): Record<string, unknown> {
  return {
    schemaVersion: "truth-harness.disclosure.v0",
    disclosureId: "dis_1234567890abcdef",
    projectId: "th_1234567890abcdef",
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    service: "Claude",
    purpose: "Review a minimized proof obligation packet.",
    dataClasses: ["proof-obligation"],
    contextSummary: "A local-only summary of one proof obligation.",
    selectedContextRefs: ["routes/example.json"],
    userInitiated: true,
    status: "planned",
    outputRefs: [],
    privacy: {
      mode: "external-calls",
      localFirst: true,
      networkAccess: "optional",
      dataResidency: "local-workspace",
      externalDisclosures: [
        {
          service: "Claude",
          purpose: "Review a minimized proof obligation packet.",
          dataClasses: ["proof-obligation"],
          userInitiated: true
        }
      ]
    },
    warnings: []
  };
}

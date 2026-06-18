import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonWithOptionalBom } from "./artifact-record-validation.js";
import { validateJsonSchema } from "./json-schema-validation.js";

const SCHEMAS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../schemas");
const schemaCache = new Map<string, Promise<unknown>>();
const SCHEMA_FILE_PATTERN = /^[A-Za-z0-9._-]+\.json$/u;

export async function assertJsonSchemaBeforeWrite(input: {
  value: unknown;
  schemaFile: string;
  artifactName: string;
}): Promise<void> {
  const schema = await loadLocalJsonSchema(input.schemaFile);
  const serializedValue = parseJsonWithOptionalBom(JSON.stringify(input.value));
  const issues = validateJsonSchema(serializedValue, schema);
  if (issues.length === 0) {
    return;
  }

  throw new Error(
    `${input.artifactName} failed JSON Schema validation before write: ${issues
      .map((issue) => `${issue.path} ${issue.message}`)
      .join("; ")}`
  );
}

export function loadLocalJsonSchema(schemaFile: string): Promise<unknown> {
  const safeSchemaFile = requireSafeSchemaFile(schemaFile);
  const cached = schemaCache.get(safeSchemaFile);
  if (cached) {
    return cached;
  }

  const loaded = readFile(resolve(SCHEMAS_DIR, safeSchemaFile), "utf8").then((raw) => parseJsonWithOptionalBom(raw));
  schemaCache.set(safeSchemaFile, loaded);
  return loaded;
}

function requireSafeSchemaFile(schemaFile: string): string {
  if (!SCHEMA_FILE_PATTERN.test(schemaFile)) {
    throw new Error(`Schema file must be a checked-in JSON schema filename, received ${JSON.stringify(schemaFile)}.`);
  }

  return schemaFile;
}

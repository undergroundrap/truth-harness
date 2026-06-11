export interface JsonSchemaValidationIssue {
  path: string;
  message: string;
}

export interface UnsupportedJsonSchemaFeature {
  path: string;
  keyword: string;
  message: string;
}

type JsonSchema = boolean | JsonSchemaObject;

interface JsonSchemaObject {
  $schema?: string;
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  title?: string;
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  minLength?: number;
  minItems?: number;
  uniqueItems?: boolean;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
}

const SUPPORTED_SCHEMA_KEYS = new Set([
  "$schema",
  "$id",
  "$ref",
  "$defs",
  "title",
  "type",
  "const",
  "enum",
  "required",
  "properties",
  "additionalProperties",
  "items",
  "minLength",
  "minItems",
  "uniqueItems",
  "minimum",
  "maximum",
  "pattern",
  "format"
]);

export function validateJsonSchema(value: unknown, schema: unknown): JsonSchemaValidationIssue[] {
  if (!isSchemaObject(schema) && typeof schema !== "boolean") {
    return [{ path: "$", message: "Schema must be a JSON Schema object or boolean." }];
  }

  const unsupported = findUnsupportedJsonSchemaFeatures(schema);
  if (unsupported.length > 0) {
    return unsupported.map((issue) => ({
      path: issue.path,
      message: issue.message
    }));
  }

  const rootSchema = schema as JsonSchema;
  return validateAgainstSchema(value, rootSchema, rootSchema, "$");
}

export function findUnsupportedJsonSchemaFeatures(schema: unknown): UnsupportedJsonSchemaFeature[] {
  const issues: UnsupportedJsonSchemaFeature[] = [];
  walkSchema(schema, "$", issues);
  return issues;
}

function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  rootSchema: JsonSchema,
  path: string
): JsonSchemaValidationIssue[] {
  if (schema === true) {
    return [];
  }

  if (schema === false) {
    return [{ path, message: "Value is not allowed by schema." }];
  }

  if (schema.$ref) {
    const resolved = resolveLocalRef(rootSchema, schema.$ref);
    if (!resolved) {
      return [{ path, message: `Schema reference ${JSON.stringify(schema.$ref)} could not be resolved.` }];
    }

    return validateAgainstSchema(value, resolved, rootSchema, path);
  }

  const issues: JsonSchemaValidationIssue[] = [];
  if ("const" in schema && !jsonEqual(value, schema.const)) {
    issues.push({ path, message: `must equal ${JSON.stringify(schema.const)}` });
    return issues;
  }

  if (schema.enum && !schema.enum.some((entry) => jsonEqual(value, entry))) {
    issues.push({ path, message: `must be one of ${schema.enum.map((entry) => JSON.stringify(entry)).join(", ")}` });
    return issues;
  }

  if (schema.type && !matchesType(value, schema.type)) {
    issues.push({ path, message: `must be ${formatType(schema.type)}` });
    return issues;
  }

  if (typeof value === "string") {
    issues.push(...validateString(value, schema, path));
  }

  if (typeof value === "number") {
    issues.push(...validateNumber(value, schema, path));
  }

  if (Array.isArray(value)) {
    issues.push(...validateArray(value, schema, rootSchema, path));
  }

  if (isRecord(value)) {
    issues.push(...validateObject(value, schema, rootSchema, path));
  }

  return issues;
}

function validateString(value: string, schema: JsonSchemaObject, path: string): JsonSchemaValidationIssue[] {
  const issues: JsonSchemaValidationIssue[] = [];
  if (typeof schema.minLength === "number" && value.length < schema.minLength) {
    issues.push({ path, message: `must have length >= ${schema.minLength}` });
  }

  if (schema.pattern) {
    const pattern = new RegExp(schema.pattern);
    if (!pattern.test(value)) {
      issues.push({ path, message: `must match pattern ${JSON.stringify(schema.pattern)}` });
    }
  }

  if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
    issues.push({ path, message: "must be a valid date-time string" });
  }

  return issues;
}

function validateNumber(value: number, schema: JsonSchemaObject, path: string): JsonSchemaValidationIssue[] {
  const issues: JsonSchemaValidationIssue[] = [];
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    issues.push({ path, message: `must be >= ${schema.minimum}` });
  }

  if (typeof schema.maximum === "number" && value > schema.maximum) {
    issues.push({ path, message: `must be <= ${schema.maximum}` });
  }

  return issues;
}

function validateArray(
  value: unknown[],
  schema: JsonSchemaObject,
  rootSchema: JsonSchema,
  path: string
): JsonSchemaValidationIssue[] {
  const issues: JsonSchemaValidationIssue[] = [];
  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    issues.push({ path, message: `must contain at least ${schema.minItems} item(s)` });
  }

  if (schema.uniqueItems === true) {
    issues.push(...validateUniqueItems(value, path));
  }

  if (schema.items) {
    value.forEach((entry, index) => {
      issues.push(...validateAgainstSchema(entry, schema.items as JsonSchema, rootSchema, `${path}[${index}]`));
    });
  }

  return issues;
}

function validateObject(
  value: Record<string, unknown>,
  schema: JsonSchemaObject,
  rootSchema: JsonSchema,
  path: string
): JsonSchemaValidationIssue[] {
  const issues: JsonSchemaValidationIssue[] = [];
  const properties = schema.properties ?? {};

  for (const key of schema.required ?? []) {
    if (!(key in value)) {
      issues.push({ path: `${path}.${key}`, message: "is required" });
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    const propertyPath = `${path}.${key}`;
    const propertySchema = properties[key];
    if (propertySchema) {
      issues.push(...validateAgainstSchema(entry, propertySchema, rootSchema, propertyPath));
      continue;
    }

    if (schema.additionalProperties === false) {
      issues.push({ path: propertyPath, message: "is not allowed by schema" });
      continue;
    }

    if (isSchemaObject(schema.additionalProperties) || typeof schema.additionalProperties === "boolean") {
      issues.push(...validateAgainstSchema(entry, schema.additionalProperties, rootSchema, propertyPath));
    }
  }

  return issues;
}

function validateUniqueItems(value: unknown[], path: string): JsonSchemaValidationIssue[] {
  const issues: JsonSchemaValidationIssue[] = [];
  for (let left = 0; left < value.length; left += 1) {
    for (let right = left + 1; right < value.length; right += 1) {
      if (jsonEqual(value[left], value[right])) {
        issues.push({
          path: `${path}[${right}]`,
          message: `must be unique; duplicates ${path}[${left}]`
        });
      }
    }
  }

  return issues;
}

function walkSchema(value: unknown, path: string, issues: UnsupportedJsonSchemaFeature[]): void {
  if (typeof value === "boolean") {
    return;
  }

  if (!isRecord(value)) {
    issues.push({
      path,
      keyword: "",
      message: "Schema node must be an object or boolean."
    });
    return;
  }

  for (const key of Object.keys(value)) {
    if (!SUPPORTED_SCHEMA_KEYS.has(key)) {
      issues.push({
        path: `${path}.${key}`,
        keyword: key,
        message: `Unsupported JSON Schema keyword ${JSON.stringify(key)}.`
      });
    }
  }

  if (typeof value.format === "string" && value.format !== "date-time") {
    issues.push({
      path: `${path}.format`,
      keyword: "format",
      message: `Unsupported JSON Schema format ${JSON.stringify(value.format)}.`
    });
  }

  if (isRecord(value.$defs)) {
    for (const [key, child] of Object.entries(value.$defs)) {
      walkSchema(child, `${path}.$defs.${key}`, issues);
    }
  }

  if (isRecord(value.properties)) {
    for (const [key, child] of Object.entries(value.properties)) {
      walkSchema(child, `${path}.properties.${key}`, issues);
    }
  }

  if ("items" in value) {
    walkSchema(value.items, `${path}.items`, issues);
  }

  if (isRecord(value.additionalProperties) || typeof value.additionalProperties === "boolean") {
    walkSchema(value.additionalProperties, `${path}.additionalProperties`, issues);
  }
}

function resolveLocalRef(rootSchema: JsonSchema, ref: string): JsonSchema | undefined {
  if (!isSchemaObject(rootSchema) || !ref.startsWith("#/")) {
    return undefined;
  }

  let current: unknown = rootSchema;
  for (const rawPart of ref.slice(2).split("/")) {
    const part = rawPart.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isRecord(current) || !(part in current)) {
      return undefined;
    }

    current = current[part];
  }

  return isSchemaObject(current) || typeof current === "boolean" ? current : undefined;
}

function matchesType(value: unknown, type: string | string[]): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((entry) => matchesSingleType(value, entry));
}

function matchesSingleType(value: unknown, type: string): boolean {
  switch (type) {
    case "array":
      return Array.isArray(value);
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "object":
      return isRecord(value);
    case "string":
      return typeof value === "string";
    case "null":
      return value === null;
    default:
      return false;
  }
}

function formatType(type: string | string[]): string {
  return Array.isArray(type) ? type.join(" or ") : type;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isSchemaObject(value: unknown): value is JsonSchemaObject {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

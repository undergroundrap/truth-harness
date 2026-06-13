export function parseJsonObject(raw: string, sourcePath: string, artifactName: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`${artifactName} JSON is not valid JSON in ${sourcePath}: ${error instanceof Error ? error.message : String(error)}.`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`${artifactName} JSON must be an object: ${sourcePath}.`);
  }

  return parsed;
}

export function formatValidationError(artifactName: string, sourcePath: string, issues: string[]): Error {
  return new Error(`Invalid ${artifactName} record in ${sourcePath}: ${issues.join("; ")}.`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function expectRecord(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[]
): Record<string, unknown> | undefined {
  const entry = value[key];
  if (!isRecord(entry)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }

  return entry;
}

export function expectConst(
  value: Record<string, unknown>,
  key: string,
  expected: string | boolean,
  path: string,
  issues: string[]
): void {
  if (value[key] !== expected) {
    issues.push(`${path} must equal ${JSON.stringify(expected)}`);
  }
}

export function expectNonEmptyString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[]
): string | undefined {
  const entry = value[key];
  if (typeof entry !== "string" || entry.length === 0) {
    issues.push(`${path} must be a non-empty string`);
    return undefined;
  }

  return entry;
}

export function expectPattern(
  value: Record<string, unknown>,
  key: string,
  pattern: RegExp,
  path: string,
  issues: string[]
): string | undefined {
  const entry = expectNonEmptyString(value, key, path, issues);
  if (entry && !pattern.test(entry)) {
    issues.push(`${path} must match ${pattern.source}`);
  }

  return entry;
}

export function expectDateTime(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[]
): string | undefined {
  const entry = expectNonEmptyString(value, key, path, issues);
  if (entry && Number.isNaN(Date.parse(entry))) {
    issues.push(`${path} must be a date-time string`);
  }

  return entry;
}

export function expectNonNegativeInteger(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[]
): number | undefined {
  const entry = value[key];
  if (!Number.isInteger(entry) || (entry as number) < 0) {
    issues.push(`${path} must be a non-negative integer`);
    return undefined;
  }

  return entry as number;
}

export function expectBoolean(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[]
): boolean | undefined {
  const entry = value[key];
  if (typeof entry !== "boolean") {
    issues.push(`${path} must be a boolean`);
    return undefined;
  }

  return entry;
}

export function expectStringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[]
): string[] | undefined {
  const entry = value[key];
  if (!Array.isArray(entry) || !entry.every((item) => typeof item === "string")) {
    issues.push(`${path} must be an array of strings`);
    return undefined;
  }

  return entry;
}

export function expectArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[]
): unknown[] | undefined {
  const entry = value[key];
  if (!Array.isArray(entry)) {
    issues.push(`${path} must be an array`);
    return undefined;
  }

  return entry;
}

export function expectOneOf<const T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  path: string,
  issues: string[]
): T | undefined {
  const entry = value[key];
  if (typeof entry !== "string" || !allowed.includes(entry as T)) {
    issues.push(`${path} must be one of ${allowed.map((item) => JSON.stringify(item)).join(", ")}`);
    return undefined;
  }

  return entry as T;
}

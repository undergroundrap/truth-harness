import type { Receipt } from "./types.js";

export interface ReceiptValidationIssue {
  path: string;
  message: string;
}

export class ReceiptValidationError extends Error {
  readonly issues: ReceiptValidationIssue[];
  readonly source?: string;

  constructor(issues: ReceiptValidationIssue[], source?: string) {
    const prefix = source ? `Invalid receipt ${source}` : "Invalid receipt";
    super(`${prefix}: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
    this.name = "ReceiptValidationError";
    this.issues = issues;
    this.source = source;
  }
}

const TRUST_LABELS = new Set([
  "proved",
  "exact-computed",
  "bounded-numeric",
  "smt-checked",
  "dimension-checked",
  "source-cited",
  "cross-checked",
  "unverified",
  "refuted"
]);

const NODE_KINDS = new Set([
  "problem",
  "normalized_problem",
  "claim",
  "plan",
  "tool_run",
  "proof",
  "computation",
  "counterexample",
  "source",
  "explanation",
  "lesson",
  "artifact"
]);

const EVIDENCE_KINDS = new Set([
  "exact-arithmetic",
  "universal-parity",
  "dimension-analysis",
  "symbolic-cas",
  "interval-bound",
  "source-citation",
  "unsupported"
]);

const BACKEND_ROLES = new Set([
  "arithmetic",
  "counterexample-search",
  "checker",
  "cas",
  "retrieval",
  "interval",
  "proof-checker",
  "planned"
]);

export function parseReceiptJson(json: string, source?: string): Receipt {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new ReceiptValidationError([{ path: "$", message: `is not valid JSON: ${message}` }], source);
  }

  assertReceipt(parsed, source);
  return parsed;
}

export function assertReceipt(value: unknown, source?: string): asserts value is Receipt {
  const issues = validateReceipt(value);
  if (issues.length > 0) {
    throw new ReceiptValidationError(issues, source);
  }
}

export function validateReceipt(value: unknown): ReceiptValidationIssue[] {
  const issues: ReceiptValidationIssue[] = [];

  if (!isRecord(value)) {
    return [{ path: "$", message: "must be an object" }];
  }

  expectLiteral(value, "schemaVersion", "theorem.receipt.v0", "$.schemaVersion", issues);
  expectPattern(value, "runId", /^run_[a-f0-9]{16}$/, "$.runId", issues);
  expectString(value, "createdAt", "$.createdAt", issues);
  expectString(value, "problem", "$.problem", issues);
  expectString(value, "normalizedProblem", "$.normalizedProblem", issues);
  expectEnum(value, "trust", TRUST_LABELS, "$.trust", issues);
  expectString(value, "summary", "$.summary", issues);
  expectString(value, "replay", "$.replay", issues);
  validatePrivacy(value.privacy, "$.privacy", issues);
  validateEvidenceProfile(value.evidenceProfile, "$.evidenceProfile", issues);
  validateGraph(value.graph, "$.graph", issues);
  validateArtifacts(value.artifacts, "$.artifacts", issues);
  validateFindings(value.findings, "$.findings", issues);

  return issues;
}

function validatePrivacy(value: unknown, path: string, issues: ReceiptValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  expectEnum(value, "mode", new Set(["local-only", "external-calls"]), `${path}.mode`, issues);
  expectBoolean(value, "localFirst", `${path}.localFirst`, issues);
  expectEnum(value, "networkAccess", new Set(["none", "optional", "required"]), `${path}.networkAccess`, issues);
  expectLiteral(value, "dataResidency", "local-workspace", `${path}.dataResidency`, issues);
  expectArray(value.externalDisclosures, `${path}.externalDisclosures`, issues, (entry, entryPath) => {
    if (!isRecord(entry)) {
      issues.push({ path: entryPath, message: "must be an object" });
      return;
    }
    expectString(entry, "service", `${entryPath}.service`, issues);
    expectString(entry, "purpose", `${entryPath}.purpose`, issues);
    expectStringArray(entry.dataClasses, `${entryPath}.dataClasses`, issues);
    expectBoolean(entry, "userInitiated", `${entryPath}.userInitiated`, issues);
  });
}

function validateEvidenceProfile(value: unknown, path: string, issues: ReceiptValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  expectEnum(value, "kind", EVIDENCE_KINDS, `${path}.kind`, issues);
  expectArray(value.backends, `${path}.backends`, issues, (backend, backendPath) => {
    if (!isRecord(backend)) {
      issues.push({ path: backendPath, message: "must be an object" });
      return;
    }
    expectString(backend, "id", `${backendPath}.id`, issues);
    expectEnum(backend, "role", BACKEND_ROLES, `${backendPath}.role`, issues);
    expectOptionalString(backend, "version", `${backendPath}.version`, issues);
    validateOptionalStringRecord(backend.environment, `${backendPath}.environment`, issues);
    expectBoolean(backend, "acceptedProofChecker", `${backendPath}.acceptedProofChecker`, issues);
  });
  expectStringArray(value.inputs, `${path}.inputs`, issues);
  expectStringArray(value.outputs, `${path}.outputs`, issues);
  expectBoolean(value, "replayable", `${path}.replayable`, issues);
  expectBoolean(value, "proofCheckerBacked", `${path}.proofCheckerBacked`, issues);
  expectStringArray(value.limitations, `${path}.limitations`, issues);
}

function validateGraph(value: unknown, path: string, issues: ReceiptValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  expectArray(value.nodes, `${path}.nodes`, issues, (node, nodePath) => {
    if (!isRecord(node)) {
      issues.push({ path: nodePath, message: "must be an object" });
      return;
    }
    expectPattern(node, "id", /^node_[a-f0-9]{16}$/, `${nodePath}.id`, issues);
    expectEnum(node, "kind", NODE_KINDS, `${nodePath}.kind`, issues);
    expectString(node, "createdAt", `${nodePath}.createdAt`, issues);
    if (!("payload" in node)) {
      issues.push({ path: `${nodePath}.payload`, message: "is required" });
    }
    expectEnum(node, "trust", TRUST_LABELS, `${nodePath}.trust`, issues);
    expectString(node, "summary", `${nodePath}.summary`, issues);
    expectStringArray(node.artifactRefs, `${nodePath}.artifactRefs`, issues);
  });

  expectArray(value.edges, `${path}.edges`, issues, (edge, edgePath) => {
    if (!isRecord(edge)) {
      issues.push({ path: edgePath, message: "must be an object" });
      return;
    }
    expectString(edge, "from", `${edgePath}.from`, issues);
    expectString(edge, "to", `${edgePath}.to`, issues);
    expectString(edge, "label", `${edgePath}.label`, issues);
  });
}

function validateArtifacts(value: unknown, path: string, issues: ReceiptValidationIssue[]): void {
  expectArray(value, path, issues, (artifact, artifactPath) => {
    if (!isRecord(artifact)) {
      issues.push({ path: artifactPath, message: "must be an object" });
      return;
    }
    expectPattern(artifact, "id", /^artifact_[a-f0-9]{16}$/, `${artifactPath}.id`, issues);
    expectString(artifact, "kind", `${artifactPath}.kind`, issues);
    expectString(artifact, "mimeType", `${artifactPath}.mimeType`, issues);
    expectString(artifact, "content", `${artifactPath}.content`, issues);
  });
}

function validateFindings(value: unknown, path: string, issues: ReceiptValidationIssue[]): void {
  expectArray(value, path, issues, (finding, findingPath) => {
    if (!isRecord(finding)) {
      issues.push({ path: findingPath, message: "must be an object" });
      return;
    }
    expectEnum(finding, "level", new Set(["info", "warning", "error"]), `${findingPath}.level`, issues);
    expectString(finding, "message", `${findingPath}.message`, issues);
  });
}

function expectLiteral(
  value: Record<string, unknown>,
  key: string,
  expected: string,
  path: string,
  issues: ReceiptValidationIssue[]
): void {
  if (value[key] !== expected) {
    issues.push({ path, message: `must be ${JSON.stringify(expected)}` });
  }
}

function expectString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ReceiptValidationIssue[]
): void {
  if (typeof value[key] !== "string") {
    issues.push({ path, message: "must be a string" });
  }
}

function expectOptionalString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ReceiptValidationIssue[]
): void {
  if (value[key] !== undefined && typeof value[key] !== "string") {
    issues.push({ path, message: "must be a string when present" });
  }
}

function expectBoolean(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ReceiptValidationIssue[]
): void {
  if (typeof value[key] !== "boolean") {
    issues.push({ path, message: "must be a boolean" });
  }
}

function expectEnum(
  value: Record<string, unknown>,
  key: string,
  allowed: Set<string>,
  path: string,
  issues: ReceiptValidationIssue[]
): void {
  if (typeof value[key] !== "string" || !allowed.has(value[key])) {
    issues.push({ path, message: `must be one of ${Array.from(allowed).join(", ")}` });
  }
}

function expectPattern(
  value: Record<string, unknown>,
  key: string,
  pattern: RegExp,
  path: string,
  issues: ReceiptValidationIssue[]
): void {
  if (typeof value[key] !== "string" || !pattern.test(value[key])) {
    issues.push({ path, message: `must match ${pattern}` });
  }
}

function expectStringArray(value: unknown, path: string, issues: ReceiptValidationIssue[]): void {
  expectArray(value, path, issues, (entry, entryPath) => {
    if (typeof entry !== "string") {
      issues.push({ path: entryPath, message: "must be a string" });
    }
  });
}

function expectArray(
  value: unknown,
  path: string,
  issues: ReceiptValidationIssue[],
  validateEntry: (entry: unknown, path: string) => void
): void {
  if (!Array.isArray(value)) {
    issues.push({ path, message: "must be an array" });
    return;
  }

  value.forEach((entry, index) => validateEntry(entry, `${path}[${index}]`));
}

function validateOptionalStringRecord(
  value: unknown,
  path: string,
  issues: ReceiptValidationIssue[]
): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object when present" });
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      issues.push({ path: `${path}.${key}`, message: "must be a string" });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

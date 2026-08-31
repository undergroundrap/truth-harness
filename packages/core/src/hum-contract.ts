import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "./json-schema-validation.js";

export const HUM_OBLIGATION_SCHEMA_VERSION = "hum.math_obligation.v0" as const;
export const HUM_RESULT_SCHEMA_VERSION = "hum.math_result.v0" as const;
export const HUM_VALIDATE_SCHEMA_VERSION = "truth-harness.hum_validate.v0" as const;
export const HUM_CAPABILITIES_SCHEMA_VERSION = "truth-harness.hum_capabilities.v0" as const;

export const HUM_OBLIGATION_KINDS = [
  "allocation_freedom",
  "peak_memory_bound",
  "purity_replayability"
] as const;

export const HUM_NORMALIZED_REPRESENTATIONS = [
  "hum_static_claim_v0",
  "smtlib2",
  "json_logic",
  "plain_text"
] as const;

export const HUM_RESULT_STATUSES = ["proved", "refuted", "unknown", "unsupported", "timeout"] as const;

export const HUM_CONTRACT_PRIVACY = {
  local_first: true,
  network_access: "none",
  cloud_access: "none",
  telemetry: "none"
} as const;

export type HumValidateKind = "auto" | "obligation" | "result";
export type HumValidateStatus = "valid" | "invalid" | "tool_error";
export type HumObligationKind = (typeof HUM_OBLIGATION_KINDS)[number];
export type HumNormalizedRepresentation = (typeof HUM_NORMALIZED_REPRESENTATIONS)[number];
export type HumResultStatus = (typeof HUM_RESULT_STATUSES)[number];

export interface HumValidateIssue {
  path: string;
  message: string;
  severity: "error";
  rule: string;
}

export interface HumValidateInputResult {
  source: string;
  kind: "obligation" | "result" | "unknown";
  schema_version: string | null;
  valid: boolean;
  issues: HumValidateIssue[];
  warnings: string[];
  summary: string;
}

export interface HumValidateReport {
  schema_version: typeof HUM_VALIDATE_SCHEMA_VERSION;
  status: HumValidateStatus;
  exit_code: 0 | 1 | 2;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    tool_errors: number;
  };
  inputs: HumValidateInputResult[];
  privacy: typeof HUM_CONTRACT_PRIVACY;
}

export interface HumValidateContractInput {
  inputs: string[];
  kind: HumValidateKind;
  allowUnknownSchemaVersion: boolean;
  stdinText?: string;
}

export interface HumCapabilitiesReport {
  schema_version: typeof HUM_CAPABILITIES_SCHEMA_VERSION;
  contract: {
    obligation_schema_versions: readonly [typeof HUM_OBLIGATION_SCHEMA_VERSION];
    result_schema_versions: readonly [typeof HUM_RESULT_SCHEMA_VERSION];
  };
  obligation_kinds: Array<{
    kind: HumObligationKind;
    validation: "supported";
    verification: "unavailable";
  }>;
  normalized_representations: Array<{
    representation: HumNormalizedRepresentation;
    validation: "supported";
    verification: "unavailable";
  }>;
  validation: {
    available: true;
    scope: "schema_and_honesty_rules";
    inputs: readonly ["file", "directory", "stdin"];
    unknown_schema_versions: "rejected_by_default";
  };
  verification: {
    available: false;
    adapters: readonly [];
    reason: string;
  };
  result_statuses: HumResultStatus[];
  proof_policy: {
    llm_prose_counts_as_proof: false;
    compiler_fact_text_counts_as_proof: false;
    proved_requires_one_of: readonly ["proof_certificate", "checkable_trace"];
    unknown_is_valid: true;
  };
  privacy: typeof HUM_CONTRACT_PRIVACY;
}

interface HumValidateExpandedSource {
  source: string;
  issue?: HumValidateIssue;
}

const HUM_SCHEMAS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../schemas");

export function parseHumValidateKind(value: string): HumValidateKind {
  if (value === "auto" || value === "obligation" || value === "result") {
    return value;
  }

  throw new Error(`Unsupported Hum validate kind ${JSON.stringify(value)}. Expected auto, obligation, or result.`);
}

export function createHumCapabilitiesReport(): HumCapabilitiesReport {
  return {
    schema_version: HUM_CAPABILITIES_SCHEMA_VERSION,
    contract: {
      obligation_schema_versions: [HUM_OBLIGATION_SCHEMA_VERSION],
      result_schema_versions: [HUM_RESULT_SCHEMA_VERSION]
    },
    obligation_kinds: HUM_OBLIGATION_KINDS.map((kind) => ({
      kind,
      validation: "supported",
      verification: "unavailable"
    })),
    normalized_representations: HUM_NORMALIZED_REPRESENTATIONS.map((representation) => ({
      representation,
      validation: "supported",
      verification: "unavailable"
    })),
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
    result_statuses: [...HUM_RESULT_STATUSES],
    proof_policy: {
      llm_prose_counts_as_proof: false,
      compiler_fact_text_counts_as_proof: false,
      proved_requires_one_of: ["proof_certificate", "checkable_trace"],
      unknown_is_valid: true
    },
    privacy: HUM_CONTRACT_PRIVACY
  };
}

export async function validateHumContractInputs(input: HumValidateContractInput): Promise<HumValidateReport> {
  const results: HumValidateInputResult[] = [];

  for (const source of input.inputs) {
    const expandedSources = await expandHumValidateSource(source);
    for (const expandedSource of expandedSources) {
      if (expandedSource.issue) {
        results.push(humValidateInputResult(expandedSource.source, "unknown", null, [expandedSource.issue], []));
        continue;
      }
      results.push(await validateHumContractInput(expandedSource.source, input.kind, input.allowUnknownSchemaVersion, input.stdinText));
    }
  }

  const toolErrors = results.filter((result) => result.issues.some((issue) => issue.rule === "tool_io_failure")).length;
  const invalid = results.filter((result) => !result.valid && !result.issues.some((issue) => issue.rule === "tool_io_failure")).length;
  const valid = results.filter((result) => result.valid).length;
  const status: HumValidateStatus = toolErrors > 0 ? "tool_error" : invalid > 0 ? "invalid" : "valid";
  const exitCode = status === "valid" ? 0 : status === "invalid" ? 1 : 2;

  return {
    schema_version: HUM_VALIDATE_SCHEMA_VERSION,
    status,
    exit_code: exitCode,
    summary: {
      total: results.length,
      valid,
      invalid,
      tool_errors: toolErrors
    },
    inputs: results,
    privacy: HUM_CONTRACT_PRIVACY
  };
}

async function expandHumValidateSource(source: string): Promise<HumValidateExpandedSource[]> {
  if (source === "-") {
    return [{ source }];
  }

  let sourceStat;
  try {
    sourceStat = await stat(resolve(source));
  } catch {
    return [{ source }];
  }

  if (!sourceStat.isDirectory()) {
    return [{ source }];
  }

  try {
    const entries = await readdir(resolve(source), { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(source, entry.name))
      .sort((left, right) => left.localeCompare(right));

    if (jsonFiles.length === 0) {
      return [
        {
          source,
          issue: humIssue("$", "Hum out-dir contains no direct JSON files to validate.", "tool_io_failure")
        }
      ];
    }

    return jsonFiles.map((jsonFile) => ({ source: jsonFile }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [{ source, issue: humIssue("$", message, "tool_io_failure") }];
  }
}

async function validateHumContractInput(
  source: string,
  requestedKind: HumValidateKind,
  allowUnknownSchemaVersion: boolean,
  stdinText?: string
): Promise<HumValidateInputResult> {
  let raw: string;
  try {
    raw = await readHumValidateSource(source, stdinText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return humValidateInputResult(source, "unknown", null, [humIssue("$", message, "tool_io_failure")], []);
  }

  if (raw.charCodeAt(0) === 0xfeff) {
    return humValidateInputResult(source, "unknown", null, [humIssue("$", "UTF-8 BOM is not allowed for Hum contract JSON.", "utf8_no_bom")], []);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return humValidateInputResult(source, "unknown", null, [humIssue("$", `Invalid JSON: ${message}`, "json_parse")], []);
  }

  if (!isHumRecord(parsed)) {
    return humValidateInputResult(source, "unknown", null, [humIssue("$", "Hum contract input must be a JSON object.", "json_object")], []);
  }

  const schemaVersion = typeof parsed.schema_version === "string" ? parsed.schema_version : null;
  const kind = inferHumContractKind(parsed, requestedKind, allowUnknownSchemaVersion);
  if (kind === "unknown") {
    const issues = [
      humIssue("$.schema_version", "Unknown Hum schema version. Use --allow-unknown-schema-version with --kind obligation or --kind result to validate against the V0 shape.", "schema_version")
    ];
    if (containsCamelCaseKey(parsed)) {
      issues.push(humIssue("$", "Hum contract JSON must use snake_case fields only.", "snake_case_fields"));
    }
    return humValidateInputResult(source, kind, schemaVersion, issues, []);
  }

  const schema = await readHumSchema(kind);
  const normalizedForSchema = normalizeHumSchemaVersionForValidation(parsed, kind, allowUnknownSchemaVersion);
  const issues = validateJsonSchema(normalizedForSchema, schema).map((issue) => humIssue(issue.path, issue.message, "json_schema"));
  issues.push(...validateHumSemanticRules(parsed, kind, allowUnknownSchemaVersion));

  const warnings = schemaVersion !== expectedHumSchemaVersion(kind)
    ? [`Validated unknown schema version ${JSON.stringify(schemaVersion)} against ${expectedHumSchemaVersion(kind)} shape because --allow-unknown-schema-version was set.`]
    : [];
  return humValidateInputResult(source, kind, schemaVersion, issues, warnings);
}

async function readHumValidateSource(source: string, stdinText?: string): Promise<string> {
  if (source === "-") {
    return stdinText ?? readStdinText();
  }

  return readFile(resolve(source), "utf8");
}

async function readStdinText(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
  }
  return raw;
}

async function readHumSchema(kind: "obligation" | "result"): Promise<unknown> {
  const schemaFile = kind === "obligation" ? "hum.math_obligation.v0.schema.json" : "hum.math_result.v0.schema.json";
  return JSON.parse(await readFile(resolve(HUM_SCHEMAS_DIR, schemaFile), "utf8")) as unknown;
}

function inferHumContractKind(
  value: Record<string, unknown>,
  requestedKind: HumValidateKind,
  allowUnknownSchemaVersion: boolean
): "obligation" | "result" | "unknown" {
  if (requestedKind !== "auto") {
    return requestedKind;
  }

  if (value.schema_version === HUM_OBLIGATION_SCHEMA_VERSION) {
    return "obligation";
  }
  if (value.schema_version === HUM_RESULT_SCHEMA_VERSION) {
    return "result";
  }

  if (allowUnknownSchemaVersion && typeof value.schema_version === "string") {
    if (value.schema_version.startsWith("hum.math_obligation.")) {
      return "obligation";
    }
    if (value.schema_version.startsWith("hum.math_result.")) {
      return "result";
    }
  }

  return "unknown";
}

function normalizeHumSchemaVersionForValidation(
  value: Record<string, unknown>,
  kind: "obligation" | "result",
  allowUnknownSchemaVersion: boolean
): Record<string, unknown> {
  if (!allowUnknownSchemaVersion || value.schema_version === expectedHumSchemaVersion(kind)) {
    return value;
  }

  return {
    ...value,
    schema_version: expectedHumSchemaVersion(kind)
  };
}

function expectedHumSchemaVersion(kind: "obligation" | "result"): string {
  return kind === "obligation" ? HUM_OBLIGATION_SCHEMA_VERSION : HUM_RESULT_SCHEMA_VERSION;
}

function validateHumSemanticRules(value: Record<string, unknown>, kind: "obligation" | "result", allowUnknownSchemaVersion: boolean): HumValidateIssue[] {
  const issues: HumValidateIssue[] = [];
  const expectedVersion = expectedHumSchemaVersion(kind);
  if (value.schema_version !== expectedVersion && !allowUnknownSchemaVersion) {
    issues.push(humIssue("$.schema_version", `must equal ${JSON.stringify(expectedVersion)}`, "schema_version"));
  }

  if (containsCamelCaseKey(value)) {
    issues.push(humIssue("$", "Hum contract JSON must use snake_case fields only.", "snake_case_fields"));
  }

  if (kind === "obligation") {
    issues.push(...validateHumObligationSemanticRules(value));
  } else {
    issues.push(...validateHumResultSemanticRules(value));
  }

  return issues;
}

function validateHumObligationSemanticRules(value: Record<string, unknown>): HumValidateIssue[] {
  const issues: HumValidateIssue[] = [];
  const assumptions = Array.isArray(value.assumptions) ? value.assumptions : [];
  assumptions.forEach((entry, index) => {
    if (!isHumRecord(entry)) {
      return;
    }
    if (entry.source_ref === undefined || entry.source_ref === null || entry.source_ref === "") {
      issues.push(humIssue(`$.assumptions[${index}].source_ref`, "assumptions must cite a source_ref so they are not hidden.", "hidden_assumption"));
    }
  });

  return issues;
}

function validateHumResultSemanticRules(value: Record<string, unknown>): HumValidateIssue[] {
  const issues: HumValidateIssue[] = [];
  const status = value.status;
  const evidenceClasses = Array.isArray(value.evidence_classes) ? value.evidence_classes : [];
  const hasCertificate = value.proof_certificate !== null && value.proof_certificate !== undefined;
  const hasTrace = value.checkable_trace !== null && value.checkable_trace !== undefined;
  const hasCounterexample = value.counterexample !== null && value.counterexample !== undefined;

  if (status === "proved") {
    if (!hasCertificate && !hasTrace) {
      issues.push(humIssue("$", "proved requires a proof_certificate or independently checkable_trace.", "proved_requires_evidence"));
    }
    if (evidenceClasses.includes("benchmark") || evidenceClasses.includes("heuristic") || evidenceClasses.includes("model_assumption")) {
      issues.push(humIssue("$.evidence_classes", "benchmarks, heuristics, and model assumptions cannot be treated as proof.", "benchmark_not_proof"));
    }
  }

  if (status === "refuted" && !hasCounterexample) {
    issues.push(humIssue("$.counterexample", "refuted results should include a counterexample witness.", "refuted_requires_counterexample"));
  }

  if (value.llm_proof_accepted !== false) {
    issues.push(humIssue("$.llm_proof_accepted", "LLM proof text is never accepted as proof.", "llm_proof_not_proof"));
  }

  const privacy = isHumRecord(value.privacy) ? value.privacy : undefined;
  if (privacy) {
    if (privacy.network_access !== "none" || privacy.cloud_access !== "none" || privacy.telemetry !== "none") {
      issues.push(humIssue("$.privacy", "Hum math results must not require network, cloud, or telemetry metadata.", "local_first_privacy"));
    }
  }

  return issues;
}

function containsCamelCaseKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsCamelCaseKey(entry));
  }
  if (!isHumRecord(value)) {
    return false;
  }

  return Object.entries(value).some(([key, entry]) => /[a-z][A-Z]/u.test(key) || containsCamelCaseKey(entry));
}

function humValidateInputResult(
  source: string,
  kind: "obligation" | "result" | "unknown",
  schemaVersion: string | null,
  issues: HumValidateIssue[],
  warnings: string[]
): HumValidateInputResult {
  const valid = issues.length === 0;
  return {
    source,
    kind,
    schema_version: schemaVersion,
    valid,
    issues,
    warnings,
    summary: valid ? `${source}: valid ${kind}` : `${source}: ${issues.length} issue(s)`
  };
}

function humIssue(path: string, message: string, rule: string): HumValidateIssue {
  return {
    path,
    message,
    severity: "error",
    rule
  };
}

function isHumRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

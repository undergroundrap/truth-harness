import {
  aabb2OverlapCertificate,
  barycentric2Certificate,
  capsule2CircleIntersectionCertificate,
  circle2AabbIntersectionCertificate,
  circle2IntersectionCertificate,
  pointInTriangle2Certificate,
  ray2AabbIntersectionCertificate,
  ray2CircleIntersectionCertificate,
  segment2IntersectionCertificate,
  sweptAabb2IntersectionCertificate,
  type Aabb2,
  type BarycentricCoordinateTriple,
  type Capsule2,
  type Circle2,
  type Point2,
  type Ray2,
  type Segment2,
  type Triangle2
} from "./engine-geometry.js";
import { Rational } from "./rational.js";

export type EngineCasePrimitive =
  | "aabb2-overlap"
  | "swept-aabb2-intersection"
  | "circle2-intersection"
  | "capsule2-circle2-intersection"
  | "circle2-aabb2-intersection"
  | "segment2-segment2-intersection"
  | "ray2-circle2-intersection"
  | "ray2-aabb2-intersection"
  | "barycentric2-coordinates"
  | "point2-triangle2-membership";

export type EngineCaseValidationStatus = "accepted" | "refuted" | "unsupported";
export type EngineCaseBundleValidationStatus = "passed" | "partial" | "failed";

export interface EngineCaseBundleProducer {
  name: string;
  version?: string;
  commit?: string;
  command?: string;
  generatedAt?: string;
}

export interface EngineCaseBundleValidationCase {
  caseId: string;
  primitive: EngineCasePrimitive | "unsupported";
  status: EngineCaseValidationStatus;
  trust: "exact-computed" | "refuted" | "unverified";
  backendId?: string;
  convention?: string;
  expected?: string;
  observed?: string;
  summary: string;
  trace: string[];
  issues: string[];
  certificate?: unknown;
}

export interface EngineCaseBundleValidationReport {
  schemaVersion: "truth-harness.engine-case-validation-report.v0";
  inputSchemaVersion?: string;
  sourceRef?: string;
  producer?: EngineCaseBundleProducer;
  localOnly: true;
  networkAccess: "none";
  status: EngineCaseBundleValidationStatus;
  total: number;
  accepted: number;
  refuted: number;
  unsupported: number;
  cases: EngineCaseBundleValidationCase[];
  trustBoundary: {
    externalEngineOutputIsUntrustedUntilChecked: true;
    noArbitraryEngineCodeExecuted: true;
    exactIntegerOrRationalInputsOnly: true;
    matchingBoundaryConventionRequired: true;
  };
  nextActions: string[];
}

interface ValidateEngineCaseBundleOptions {
  sourceRef?: string;
  caseId?: string;
}

type JsonRecord = Record<string, unknown>;

type GeometryCertificate = {
  adapter: string;
  convention: string;
  verdict: "computed" | "accepted" | "refuted";
  trace: string[];
  [key: string]: unknown;
};

export function validateEngineCaseBundleJson(raw: string, options: ValidateEngineCaseBundleOptions = {}): EngineCaseBundleValidationReport {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Engine case bundle is not valid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`);
  }
  return validateEngineCaseBundle(value, options);
}

export function validateEngineCaseBundle(value: unknown, options: ValidateEngineCaseBundleOptions = {}): EngineCaseBundleValidationReport {
  const bundle = asRecord(value, "bundle");
  const inputSchemaVersion = optionalString(bundle.schemaVersion, "bundle.schemaVersion");
  if (inputSchemaVersion !== undefined && inputSchemaVersion !== "truth-harness.engine-case-bundle.v0") {
    throw new Error(`Unsupported engine case bundle schemaVersion '${inputSchemaVersion}'.`);
  }

  const rawCases = asArray(bundle.cases, "bundle.cases");
  const selectedCases = options.caseId === undefined
    ? rawCases
    : rawCases.filter((entry) => isRecord(entry) && entry.caseId === options.caseId);
  const producer = parseProducer(bundle.producer);
  const cases = selectedCases.map((entry, index) => validateEngineCase(entry, index));
  const accepted = cases.filter((entry) => entry.status === "accepted").length;
  const refuted = cases.filter((entry) => entry.status === "refuted").length;
  const unsupported = cases.filter((entry) => entry.status === "unsupported").length;
  const total = cases.length;
  const status: EngineCaseBundleValidationStatus = total === 0 || refuted > 0
    ? "failed"
    : unsupported > 0
      ? "partial"
      : "passed";
  const nextActions = engineCaseBundleNextActions({ total, accepted, refuted, unsupported, caseId: options.caseId });

  return {
    schemaVersion: "truth-harness.engine-case-validation-report.v0",
    inputSchemaVersion,
    sourceRef: options.sourceRef,
    producer,
    localOnly: true,
    networkAccess: "none",
    status,
    total,
    accepted,
    refuted,
    unsupported,
    cases,
    trustBoundary: {
      externalEngineOutputIsUntrustedUntilChecked: true,
      noArbitraryEngineCodeExecuted: true,
      exactIntegerOrRationalInputsOnly: true,
      matchingBoundaryConventionRequired: true
    },
    nextActions
  };
}

export function renderEngineCaseBundleValidationReport(report: EngineCaseBundleValidationReport): string {
  const lines = [
    `Truth Harness engine case validation: ${report.status}`,
    `Cases: ${report.accepted} accepted, ${report.refuted} refuted, ${report.unsupported} unsupported, ${report.total} total`,
    report.producer ? `Producer: ${report.producer.name}${report.producer.version ? ` ${report.producer.version}` : ""}${report.producer.commit ? ` (${report.producer.commit})` : ""}` : undefined,
    report.sourceRef ? `Source: ${report.sourceRef}` : undefined,
    "",
    ...report.cases.map((entry) => [
      `${engineCaseStatusGlyph(entry.status)} ${entry.caseId} [${entry.primitive}] ${entry.trust}`,
      `  ${entry.summary}`,
      entry.expected !== undefined ? `  expected: ${entry.expected}` : undefined,
      entry.observed !== undefined ? `  observed: ${entry.observed}` : undefined,
      entry.issues.length > 0 ? `  issues: ${entry.issues.join("; ")}` : undefined
    ].filter(Boolean).join("\n")),
    "",
    ...report.nextActions.map((action) => `- ${action}`)
  ].filter((line): line is string => line !== undefined);
  return `${lines.join("\n")}\n`;
}

function validateEngineCase(value: unknown, index: number): EngineCaseBundleValidationCase {
  try {
    const record = asRecord(value, `bundle.cases[${index}]`);
    const caseId = optionalString(record.caseId, `bundle.cases[${index}].caseId`) ?? `case-${index + 1}`;
    const primitive = normalizePrimitive(requiredString(record.primitive, `bundle.cases[${index}].primitive`));
    const source = optionalString(record.source, `bundle.cases[${index}].source`) ?? `${primitive}:${caseId}`;
    const boundary = optionalString(record.boundary, `bundle.cases[${index}].boundary`);
    const inputs = asRecord(record.inputs, `bundle.cases[${index}].inputs`);
    const observed = asRecord(record.observed, `bundle.cases[${index}].observed`);
    const result = validatePrimitiveCase({ caseId, primitive, source, boundary, inputs, observed });
    return result;
  } catch (error) {
    return {
      caseId: fallbackCaseId(value, index),
      primitive: "unsupported",
      status: "unsupported",
      trust: "unverified",
      summary: "Truth Harness could not validate this engine case from the v0 contract.",
      trace: [],
      issues: [error instanceof Error ? error.message : "Unknown engine case validation error."]
    };
  }
}

function validatePrimitiveCase(input: {
  caseId: string;
  primitive: EngineCasePrimitive;
  source: string;
  boundary?: string;
  inputs: JsonRecord;
  observed: JsonRecord;
}): EngineCaseBundleValidationCase {
  switch (input.primitive) {
    case "aabb2-overlap": {
      const certificate = aabb2OverlapCertificate({
        source: input.source,
        a: parseAabb2(input.inputs.a, "inputs.a"),
        b: parseAabb2(input.inputs.b, "inputs.b"),
        statedOverlap: requiredBoolean(input.observed.overlap, "observed.overlap")
      });
      return resultFromCertificate(input, certificate, String(certificate.overlap), String(certificate.statedOverlap));
    }
    case "swept-aabb2-intersection": {
      const certificate = sweptAabb2IntersectionCertificate({
        source: input.source,
        moving: parseAabb2(input.inputs.moving, "inputs.moving"),
        velocity: parsePoint2(input.inputs.velocity, "inputs.velocity"),
        target: parseAabb2(input.inputs.target, "inputs.target"),
        statedIntersect: requiredBoolean(input.observed.intersect, "observed.intersect")
      });
      return resultFromCertificate(input, certificate, String(certificate.intersect), String(certificate.statedIntersect));
    }
    case "circle2-intersection": {
      const certificate = circle2IntersectionCertificate({
        source: input.source,
        a: parseCircle2(input.inputs.a, "inputs.a"),
        b: parseCircle2(input.inputs.b, "inputs.b"),
        statedIntersect: requiredBoolean(input.observed.intersect, "observed.intersect")
      });
      return resultFromCertificate(input, certificate, String(certificate.intersect), String(certificate.statedIntersect));
    }
    case "capsule2-circle2-intersection": {
      const certificate = capsule2CircleIntersectionCertificate({
        source: input.source,
        capsule: parseCapsule2(input.inputs.capsule, "inputs.capsule"),
        circle: parseCircle2(input.inputs.circle, "inputs.circle"),
        statedIntersect: requiredBoolean(input.observed.intersect, "observed.intersect")
      });
      return resultFromCertificate(input, certificate, String(certificate.intersect), String(certificate.statedIntersect));
    }
    case "circle2-aabb2-intersection": {
      const certificate = circle2AabbIntersectionCertificate({
        source: input.source,
        circle: parseCircle2(input.inputs.circle, "inputs.circle"),
        box: parseAabb2(input.inputs.box, "inputs.box"),
        statedIntersect: requiredBoolean(input.observed.intersect, "observed.intersect")
      });
      return resultFromCertificate(input, certificate, String(certificate.intersect), String(certificate.statedIntersect));
    }
    case "segment2-segment2-intersection": {
      const certificate = segment2IntersectionCertificate({
        source: input.source,
        a: parseSegment2(input.inputs.a, "inputs.a"),
        b: parseSegment2(input.inputs.b, "inputs.b"),
        statedIntersect: requiredBoolean(input.observed.intersect, "observed.intersect")
      });
      return resultFromCertificate(input, certificate, String(certificate.intersect), String(certificate.statedIntersect));
    }
    case "ray2-circle2-intersection": {
      const certificate = ray2CircleIntersectionCertificate({
        source: input.source,
        ray: parseRay2(input.inputs.ray, "inputs.ray"),
        circle: parseCircle2(input.inputs.circle, "inputs.circle"),
        maxRayParameter: optionalInteger(input.inputs.maxRayParameter, "inputs.maxRayParameter"),
        statedIntersect: requiredBoolean(input.observed.intersect, "observed.intersect")
      });
      return resultFromCertificate(input, certificate, String(certificate.intersect), String(certificate.statedIntersect));
    }
    case "ray2-aabb2-intersection": {
      const certificate = ray2AabbIntersectionCertificate({
        source: input.source,
        ray: parseRay2(input.inputs.ray, "inputs.ray"),
        box: parseAabb2(input.inputs.box, "inputs.box"),
        maxRayParameter: optionalInteger(input.inputs.maxRayParameter, "inputs.maxRayParameter"),
        statedIntersect: requiredBoolean(input.observed.intersect, "observed.intersect")
      });
      return resultFromCertificate(input, certificate, String(certificate.intersect), String(certificate.statedIntersect));
    }
    case "barycentric2-coordinates": {
      const observedCoordinates = parseBarycentricCoordinates(requiredValue(input.observed.coordinates, "observed.coordinates"), "observed.coordinates");
      const certificate = barycentric2Certificate({
        source: input.source,
        point: parsePoint2(input.inputs.point, "inputs.point"),
        triangle: parseTriangle2(input.inputs.triangle, "inputs.triangle"),
        statedCoordinates: observedCoordinates
      });
      return resultFromCertificate(
        input,
        certificate,
        formatCoordinateRecord(certificate.coordinates),
        certificate.statedCoordinates ? formatCoordinateRecord(certificate.statedCoordinates) : formatCoordinateTriple(observedCoordinates)
      );
    }
    case "point2-triangle2-membership": {
      const certificate = pointInTriangle2Certificate({
        source: input.source,
        point: parsePoint2(input.inputs.point, "inputs.point"),
        triangle: parseTriangle2(input.inputs.triangle, "inputs.triangle"),
        statedInside: requiredBoolean(input.observed.inside, "observed.inside")
      });
      return resultFromCertificate(input, certificate, String(certificate.inside), String(certificate.statedInside));
    }
  }
}

function resultFromCertificate(
  input: { caseId: string; primitive: EngineCasePrimitive; boundary?: string },
  certificate: GeometryCertificate,
  expected: string,
  observed: string
): EngineCaseBundleValidationCase {
  if (input.boundary !== undefined && input.boundary !== certificate.convention) {
    return {
      caseId: input.caseId,
      primitive: input.primitive,
      status: "unsupported",
      trust: "unverified",
      backendId: certificate.adapter,
      convention: certificate.convention,
      expected,
      observed,
      summary: "Boundary convention mismatch; Truth Harness refused to validate the engine output under different semantics.",
      trace: certificate.trace,
      issues: [`case boundary '${input.boundary}' does not match verifier convention '${certificate.convention}'`],
      certificate
    };
  }

  const status: EngineCaseValidationStatus = certificate.verdict === "accepted" ? "accepted" : "refuted";
  return {
    caseId: input.caseId,
    primitive: input.primitive,
    status,
    trust: status === "accepted" ? "exact-computed" : "refuted",
    backendId: certificate.adapter,
    convention: certificate.convention,
    expected,
    observed,
    summary: status === "accepted"
      ? "External engine output matches the local deterministic verifier for this narrow primitive."
      : "External engine output disagrees with the local deterministic verifier for this narrow primitive.",
    trace: certificate.trace,
    issues: [],
    certificate
  };
}

function normalizePrimitive(value: string): EngineCasePrimitive {
  const key = value.trim().toLowerCase();
  const aliases: Record<string, EngineCasePrimitive> = {
    "local-aabb2-overlap": "aabb2-overlap",
    "aabb2-overlap": "aabb2-overlap",
    "local-swept-aabb2-intersection": "swept-aabb2-intersection",
    "swept-aabb2-intersection": "swept-aabb2-intersection",
    "local-circle2-intersection": "circle2-intersection",
    "circle2-intersection": "circle2-intersection",
    "circle2-circle2-intersection": "circle2-intersection",
    "local-capsule2-circle-intersection": "capsule2-circle2-intersection",
    "capsule2-circle-intersection": "capsule2-circle2-intersection",
    "capsule2-circle2-intersection": "capsule2-circle2-intersection",
    "local-circle2-aabb-intersection": "circle2-aabb2-intersection",
    "circle2-aabb-intersection": "circle2-aabb2-intersection",
    "circle2-aabb2-intersection": "circle2-aabb2-intersection",
    "local-segment2-intersection": "segment2-segment2-intersection",
    "segment2-intersection": "segment2-segment2-intersection",
    "segment2-segment2-intersection": "segment2-segment2-intersection",
    "local-ray2-circle-intersection": "ray2-circle2-intersection",
    "ray2-circle-intersection": "ray2-circle2-intersection",
    "ray2-circle2-intersection": "ray2-circle2-intersection",
    "local-ray2-aabb-intersection": "ray2-aabb2-intersection",
    "ray2-aabb-intersection": "ray2-aabb2-intersection",
    "ray2-aabb2-intersection": "ray2-aabb2-intersection",
    "local-barycentric2": "barycentric2-coordinates",
    "barycentric2": "barycentric2-coordinates",
    "barycentric2-coordinates": "barycentric2-coordinates",
    "local-point-in-triangle2": "point2-triangle2-membership",
    "point-in-triangle2": "point2-triangle2-membership",
    "point2-triangle2-membership": "point2-triangle2-membership"
  };
  const primitive = aliases[key];
  if (!primitive) {
    throw new Error(`Unsupported engine case primitive '${value}'.`);
  }
  return primitive;
}

function parseProducer(value: unknown): EngineCaseBundleProducer | undefined {
  if (value === undefined) {
    return undefined;
  }
  const record = asRecord(value, "bundle.producer");
  return {
    name: requiredString(record.name, "bundle.producer.name"),
    version: optionalString(record.version, "bundle.producer.version"),
    commit: optionalString(record.commit, "bundle.producer.commit"),
    command: optionalString(record.command, "bundle.producer.command"),
    generatedAt: optionalString(record.generatedAt, "bundle.producer.generatedAt")
  };
}

function parseAabb2(value: unknown, path: string): Aabb2 {
  const record = asRecord(value, path);
  const box = {
    minX: requiredInteger(record.minX, `${path}.minX`),
    minY: requiredInteger(record.minY, `${path}.minY`),
    maxX: requiredInteger(record.maxX, `${path}.maxX`),
    maxY: requiredInteger(record.maxY, `${path}.maxY`)
  };
  if (box.minX > box.maxX || box.minY > box.maxY) {
    throw new Error(`${path} is not a valid AABB because min must be <= max on both axes.`);
  }
  return box;
}

function parsePoint2(value: unknown, path: string): Point2 {
  const record = asRecord(value, path);
  return {
    x: requiredInteger(record.x, `${path}.x`),
    y: requiredInteger(record.y, `${path}.y`)
  };
}

function parseCircle2(value: unknown, path: string): Circle2 {
  const record = asRecord(value, path);
  const radius = requiredInteger(record.radius, `${path}.radius`);
  if (radius < 0n) {
    throw new Error(`${path}.radius must be non-negative.`);
  }
  return {
    center: parsePoint2(record.center, `${path}.center`),
    radius
  };
}

function parseSegment2(value: unknown, path: string): Segment2 {
  const record = asRecord(value, path);
  return {
    from: parsePoint2(record.from, `${path}.from`),
    to: parsePoint2(record.to, `${path}.to`)
  };
}

function parseCapsule2(value: unknown, path: string): Capsule2 {
  const record = asRecord(value, path);
  const radius = requiredInteger(record.radius, `${path}.radius`);
  if (radius < 0n) {
    throw new Error(`${path}.radius must be non-negative.`);
  }
  return {
    segment: parseSegment2(record.segment, `${path}.segment`),
    radius
  };
}

function parseRay2(value: unknown, path: string): Ray2 {
  const record = asRecord(value, path);
  const ray = {
    origin: parsePoint2(record.origin, `${path}.origin`),
    direction: parsePoint2(record.direction, `${path}.direction`)
  };
  if (ray.direction.x === 0n && ray.direction.y === 0n) {
    throw new Error(`${path}.direction must be nonzero.`);
  }
  return ray;
}

function parseTriangle2(value: unknown, path: string): Triangle2 {
  const record = asRecord(value, path);
  return {
    a: parsePoint2(record.a, `${path}.a`),
    b: parsePoint2(record.b, `${path}.b`),
    c: parsePoint2(record.c, `${path}.c`)
  };
}

function parseBarycentricCoordinates(value: unknown, path: string): BarycentricCoordinateTriple {
  if (Array.isArray(value)) {
    if (value.length !== 3) {
      throw new Error(`${path} must contain exactly three rational coordinates.`);
    }
    return {
      a: parseRational(value[0], `${path}[0]`),
      b: parseRational(value[1], `${path}[1]`),
      c: parseRational(value[2], `${path}[2]`)
    };
  }

  const record = asRecord(value, path);
  return {
    a: parseRational(record.a, `${path}.a`),
    b: parseRational(record.b, `${path}.b`),
    c: parseRational(record.c, `${path}.c`)
  };
}

function parseRational(value: unknown, path: string): Rational {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${path} must be an integer number or rational string; unsafe or decimal numbers are not accepted.`);
    }
    return new Rational(value);
  }
  if (typeof value !== "string") {
    throw new Error(`${path} must be a rational string like '1/3' or an integer.`);
  }
  const trimmed = value.trim();
  if (/^-?\d+$/u.test(trimmed)) {
    return new Rational(trimmed);
  }
  const match = /^(?<numerator>-?\d+)\/(?<denominator>-?\d+)$/u.exec(trimmed);
  if (!match?.groups) {
    throw new Error(`${path} must be a rational string like '1/3'.`);
  }
  return new Rational(match.groups.numerator, match.groups.denominator);
}

function requiredInteger(value: unknown, path: string): bigint {
  const result = optionalInteger(value, path);
  if (result === undefined) {
    throw new Error(`${path} is required.`);
  }
  return result;
}

function optionalInteger(value: unknown, path: string): bigint | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${path} must be a safe integer number or integer string.`);
    }
    return BigInt(value);
  }
  if (typeof value !== "string") {
    throw new Error(`${path} must be an integer string.`);
  }
  const trimmed = value.trim();
  if (!/^-?\d{1,18}$/u.test(trimmed)) {
    throw new Error(`${path} must be an integer string with at most 18 digits.`);
  }
  return BigInt(trimmed);
}

function requiredBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be boolean.`);
  }
  return value;
}

function requiredString(value: unknown, path: string): string {
  const result = optionalString(value, path);
  if (result === undefined) {
    throw new Error(`${path} is required.`);
  }
  return result;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${path} must not be empty.`);
  }
  return trimmed;
}

function requiredValue(value: unknown, path: string): unknown {
  if (value === undefined) {
    throw new Error(`${path} is required.`);
  }
  return value;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }
  if (value.length > 500) {
    throw new Error(`${path} contains ${value.length} cases; v0 is capped at 500 cases per bundle.`);
  }
  return value;
}

function asRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fallbackCaseId(value: unknown, index: number): string {
  return isRecord(value) && typeof value.caseId === "string" && value.caseId.trim() ? value.caseId.trim() : `case-${index + 1}`;
}

function formatCoordinateTriple(value: BarycentricCoordinateTriple): string {
  return `(${value.a.toString()}, ${value.b.toString()}, ${value.c.toString()})`;
}

function formatCoordinateRecord(value: Record<keyof BarycentricCoordinateTriple, string>): string {
  return `(${value.a}, ${value.b}, ${value.c})`;
}

function engineCaseStatusGlyph(status: EngineCaseValidationStatus): string {
  switch (status) {
    case "accepted":
      return "PASS";
    case "refuted":
      return "FAIL";
    case "unsupported":
      return "MISS";
  }
}

function engineCaseBundleNextActions(input: { total: number; accepted: number; refuted: number; unsupported: number; caseId?: string }): string[] {
  if (input.total === 0) {
    return [`No engine cases matched${input.caseId ? ` caseId '${input.caseId}'` : ""}; check the bundle path or case id.`];
  }
  const actions: string[] = [];
  if (input.refuted > 0) {
    actions.push("Treat refuted engine cases as correctness bugs: inspect the returned certificate, fix the engine primitive, then rerun this bundle.");
  }
  if (input.unsupported > 0) {
    actions.push("Convert unsupported cases to the v0 structured contract or add a new explicit adapter before trusting them.");
  }
  if (input.refuted === 0 && input.unsupported === 0) {
    actions.push("All exported engine cases matched the local verifier under their stated boundaries; attach this report to the engine CI artifact.");
  }
  actions.push("This report validates narrow primitive outputs only; it does not prove full gameplay physics, broadphase correctness, renderer behavior, or concurrency safety.");
  return actions;
}
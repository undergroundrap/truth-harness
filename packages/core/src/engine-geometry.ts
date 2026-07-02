import { Rational } from "./rational.js";
export interface Aabb2 {
  minX: bigint;
  minY: bigint;
  maxX: bigint;
  maxY: bigint;
}

export interface Aabb2OverlapClaim {
  source: string;
  a: Aabb2;
  b: Aabb2;
  statedOverlap?: boolean;
}

export interface Point2 {
  x: bigint;
  y: bigint;
}

export interface Segment2 {
  from: Point2;
  to: Point2;
}

export interface Segment2IntersectionClaim {
  source: string;
  a: Segment2;
  b: Segment2;
  statedIntersect?: boolean;
}

export interface Ray2 {
  origin: Point2;
  direction: Point2;
}

export interface Ray2AabbIntersectionClaim {
  source: string;
  ray: Ray2;
  box: Aabb2;
  statedIntersect?: boolean;
}

export interface Triangle2 {
  a: Point2;
  b: Point2;
  c: Point2;
}

export interface PointInTriangle2Claim {
  source: string;
  point: Point2;
  triangle: Triangle2;
  statedInside?: boolean;
}

export type PointInTriangle2Classification = "inside" | "edge" | "vertex" | "outside";
export type RaySlabEndpoint = Rational | "negative-infinity" | "positive-infinity";
export type Ray2AabbClassification = "ray-hit" | "origin-inside" | "parallel-miss" | "behind-ray" | "slab-miss";

export interface RaySlabAxisInterval {
  axis: "x" | "y";
  status: "bounded" | "parallel-inside" | "parallel-outside";
  enter: RaySlabEndpoint;
  exit: RaySlabEndpoint;
}

export function parseAabb2OverlapClaim(problem: string): Aabb2OverlapClaim | undefined {
  const candidate = latexToReadableMath(problem)
    .replace(/\$/gu, "")
    .replace(/^(?:please\s+)?(?:verify|check|show)\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.?]$/u, "");
  const match = /^(?:do\s+)?aabb\s+a\s+min\s*\(\s*(?<aMinX>-?\d+)\s*,\s*(?<aMinY>-?\d+)\s*\)\s+max\s*\(\s*(?<aMaxX>-?\d+)\s*,\s*(?<aMaxY>-?\d+)\s*\)\s+and\s+aabb\s+b\s+min\s*\(\s*(?<bMinX>-?\d+)\s*,\s*(?<bMinY>-?\d+)\s*\)\s+max\s*\(\s*(?<bMaxX>-?\d+)\s*,\s*(?<bMaxY>-?\d+)\s*\)\s+overlap(?:\s*(?:=|is)\s*(?<stated>true|false))?$/iu.exec(candidate);
  if (!match?.groups) {
    return undefined;
  }

  const requiredGroups = [
    "aMinX",
    "aMinY",
    "aMaxX",
    "aMaxY",
    "bMinX",
    "bMinY",
    "bMaxX",
    "bMaxY"
  ];
  if (requiredGroups.some((key) => match.groups?.[key] === undefined || match.groups[key].length > 18)) {
    return undefined;
  }

  const a: Aabb2 = {
    minX: BigInt(match.groups.aMinX),
    minY: BigInt(match.groups.aMinY),
    maxX: BigInt(match.groups.aMaxX),
    maxY: BigInt(match.groups.aMaxY)
  };
  const b: Aabb2 = {
    minX: BigInt(match.groups.bMinX),
    minY: BigInt(match.groups.bMinY),
    maxX: BigInt(match.groups.bMaxX),
    maxY: BigInt(match.groups.bMaxY)
  };
  if (!isValidAabb2(a) || !isValidAabb2(b)) {
    return undefined;
  }

  return {
    source: candidate,
    a,
    b,
    statedOverlap: match.groups.stated === undefined ? undefined : match.groups.stated.toLowerCase() === "true"
  };
}

function isValidAabb2(box: Aabb2): boolean {
  return box.minX <= box.maxX && box.minY <= box.maxY;
}

export function aabb2OverlapCertificate(claim: Aabb2OverlapClaim): {
  schemaVersion: "truth-harness.aabb2-overlap.v0";
  adapter: "local-aabb2-overlap";
  source: string;
  convention: "closed-intervals-touching-counts-as-overlap";
  a: Record<keyof Aabb2, string>;
  b: Record<keyof Aabb2, string>;
  statedOverlap?: boolean;
  xOverlap: boolean;
  yOverlap: boolean;
  overlap: boolean;
  comparisons: Record<string, boolean>;
  separatingAxes: string[];
  checks: Array<{ id: string; ok: boolean; expected: string; observed: string }>;
  trace: string[];
  verdict: "computed" | "accepted" | "refuted";
} {
  const comparisons = {
    "a.minX <= b.maxX": claim.a.minX <= claim.b.maxX,
    "a.maxX >= b.minX": claim.a.maxX >= claim.b.minX,
    "a.minY <= b.maxY": claim.a.minY <= claim.b.maxY,
    "a.maxY >= b.minY": claim.a.maxY >= claim.b.minY
  };
  const xOverlap = comparisons["a.minX <= b.maxX"] && comparisons["a.maxX >= b.minX"];
  const yOverlap = comparisons["a.minY <= b.maxY"] && comparisons["a.maxY >= b.minY"];
  const overlap = xOverlap && yOverlap;
  const separatingAxes: string[] = [];
  if (claim.a.maxX < claim.b.minX) {
    separatingAxes.push("a.maxX < b.minX");
  }
  if (claim.b.maxX < claim.a.minX) {
    separatingAxes.push("b.maxX < a.minX");
  }
  if (claim.a.maxY < claim.b.minY) {
    separatingAxes.push("a.maxY < b.minY");
  }
  if (claim.b.maxY < claim.a.minY) {
    separatingAxes.push("b.maxY < a.minY");
  }

  const statedMatches = claim.statedOverlap === undefined || claim.statedOverlap === overlap;
  return {
    schemaVersion: "truth-harness.aabb2-overlap.v0",
    adapter: "local-aabb2-overlap",
    source: claim.source,
    convention: "closed-intervals-touching-counts-as-overlap",
    a: stringifyAabb2(claim.a),
    b: stringifyAabb2(claim.b),
    statedOverlap: claim.statedOverlap,
    xOverlap,
    yOverlap,
    overlap,
    comparisons,
    separatingAxes,
    checks: [
      {
        id: "valid-aabb-inputs",
        ok: true,
        expected: "minX <= maxX and minY <= maxY for both boxes",
        observed: "both boxes are valid integer-coordinate AABBs"
      },
      {
        id: "closed-interval-overlap-result",
        ok: statedMatches,
        expected: String(overlap),
        observed: claim.statedOverlap === undefined ? String(overlap) : String(claim.statedOverlap)
      }
    ],
    trace: [
      "Use closed intervals, so touching edges or corners count as overlap.",
      `X-axis overlap requires a.minX <= b.maxX (${String(comparisons["a.minX <= b.maxX"])}) and a.maxX >= b.minX (${String(comparisons["a.maxX >= b.minX"])}).`,
      `Y-axis overlap requires a.minY <= b.maxY (${String(comparisons["a.minY <= b.maxY"])}) and a.maxY >= b.minY (${String(comparisons["a.maxY >= b.minY"])}).`,
      `Exact overlap result is ${String(overlap)}.`
    ],
    verdict: claim.statedOverlap === undefined ? "computed" : statedMatches ? "accepted" : "refuted"
  };
}

function stringifyAabb2(box: Aabb2): Record<keyof Aabb2, string> {
  return {
    minX: box.minX.toString(),
    minY: box.minY.toString(),
    maxX: box.maxX.toString(),
    maxY: box.maxY.toString()
  };
}
export function parseSegment2IntersectionClaim(problem: string): Segment2IntersectionClaim | undefined {
  const candidate = latexToReadableMath(problem)
    .replace(/\$/gu, "")
    .replace(/^(?:please\s+)?(?:verify|check|show)\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.?]$/u, "");
  const match = /^(?:do\s+)?segment\s+a\s+from\s*\(\s*(?<aFromX>-?\d+)\s*,\s*(?<aFromY>-?\d+)\s*\)\s+to\s*\(\s*(?<aToX>-?\d+)\s*,\s*(?<aToY>-?\d+)\s*\)\s+and\s+segment\s+b\s+from\s*\(\s*(?<bFromX>-?\d+)\s*,\s*(?<bFromY>-?\d+)\s*\)\s+to\s*\(\s*(?<bToX>-?\d+)\s*,\s*(?<bToY>-?\d+)\s*\)\s+intersects?(?:\s*(?:=|is)\s*(?<stated>true|false))?$/iu.exec(candidate);
  if (!match?.groups) {
    return undefined;
  }

  const requiredGroups = [
    "aFromX",
    "aFromY",
    "aToX",
    "aToY",
    "bFromX",
    "bFromY",
    "bToX",
    "bToY"
  ];
  if (requiredGroups.some((key) => match.groups?.[key] === undefined || match.groups[key].length > 18)) {
    return undefined;
  }

  const a: Segment2 = {
    from: { x: BigInt(match.groups.aFromX), y: BigInt(match.groups.aFromY) },
    to: { x: BigInt(match.groups.aToX), y: BigInt(match.groups.aToY) }
  };
  const b: Segment2 = {
    from: { x: BigInt(match.groups.bFromX), y: BigInt(match.groups.bFromY) },
    to: { x: BigInt(match.groups.bToX), y: BigInt(match.groups.bToY) }
  };
  if (!isNonDegenerateSegment2(a) || !isNonDegenerateSegment2(b)) {
    return undefined;
  }

  return {
    source: candidate,
    a,
    b,
    statedIntersect: match.groups.stated === undefined ? undefined : match.groups.stated.toLowerCase() === "true"
  };
}

function isNonDegenerateSegment2(segment: Segment2): boolean {
  return segment.from.x !== segment.to.x || segment.from.y !== segment.to.y;
}

export function segment2IntersectionCertificate(claim: Segment2IntersectionClaim): {
  schemaVersion: "truth-harness.segment2-intersection.v0";
  adapter: "local-segment2-intersection";
  source: string;
  convention: "closed-segments-endpoints-count-as-intersection";
  a: { from: Record<keyof Point2, string>; to: Record<keyof Point2, string> };
  b: { from: Record<keyof Point2, string>; to: Record<keyof Point2, string> };
  statedIntersect?: boolean;
  orientations: Array<{ id: string; value: string; sign: "clockwise" | "counterclockwise" | "collinear" }>;
  intersect: boolean;
  classification: "proper-crossing" | "endpoint-touch" | "collinear-overlap" | "collinear-disjoint" | "disjoint";
  checks: Array<{ id: string; ok: boolean; expected: string; observed: string }>;
  trace: string[];
  verdict: "computed" | "accepted" | "refuted";
} {
  const o1 = orientationValue(claim.a.from, claim.a.to, claim.b.from);
  const o2 = orientationValue(claim.a.from, claim.a.to, claim.b.to);
  const o3 = orientationValue(claim.b.from, claim.b.to, claim.a.from);
  const o4 = orientationValue(claim.b.from, claim.b.to, claim.a.to);
  const properCrossing = oppositeSigns(o1, o2) && oppositeSigns(o3, o4);
  const allCollinear = o1 === 0n && o2 === 0n && o3 === 0n && o4 === 0n;
  const endpointTouch =
    (o1 === 0n && pointOnSegment2(claim.b.from, claim.a)) ||
    (o2 === 0n && pointOnSegment2(claim.b.to, claim.a)) ||
    (o3 === 0n && pointOnSegment2(claim.a.from, claim.b)) ||
    (o4 === 0n && pointOnSegment2(claim.a.to, claim.b));
  const intersect = properCrossing || endpointTouch;
  const classification = properCrossing
    ? "proper-crossing"
    : intersect && allCollinear
      ? "collinear-overlap"
      : intersect
        ? "endpoint-touch"
        : allCollinear
          ? "collinear-disjoint"
          : "disjoint";
  const statedMatches = claim.statedIntersect === undefined || claim.statedIntersect === intersect;
  const orientations = [
    { id: "orient(a.from,a.to,b.from)", value: o1.toString(), sign: orientationSign(o1) },
    { id: "orient(a.from,a.to,b.to)", value: o2.toString(), sign: orientationSign(o2) },
    { id: "orient(b.from,b.to,a.from)", value: o3.toString(), sign: orientationSign(o3) },
    { id: "orient(b.from,b.to,a.to)", value: o4.toString(), sign: orientationSign(o4) }
  ];

  return {
    schemaVersion: "truth-harness.segment2-intersection.v0",
    adapter: "local-segment2-intersection",
    source: claim.source,
    convention: "closed-segments-endpoints-count-as-intersection",
    a: stringifySegment2(claim.a),
    b: stringifySegment2(claim.b),
    statedIntersect: claim.statedIntersect,
    orientations,
    intersect,
    classification,
    checks: [
      {
        id: "non-degenerate-segment-inputs",
        ok: true,
        expected: "each segment has distinct endpoints",
        observed: "both segments are non-degenerate integer-coordinate segments"
      },
      {
        id: "closed-segment-intersection-result",
        ok: statedMatches,
        expected: String(intersect),
        observed: claim.statedIntersect === undefined ? String(intersect) : String(claim.statedIntersect)
      }
    ],
    trace: [
      "Use closed segments, so endpoint touches and collinear overlaps count as intersection.",
      `Orientation values are ${orientations.map((item) => `${item.id}=${item.value} (${item.sign})`).join(", ")}.`,
      properCrossing
        ? "The segment endpoints are on opposite sides of each other, so the segments properly cross."
        : endpointTouch
          ? "At least one collinear endpoint lies on the opposite segment under closed-segment bounds."
          : allCollinear
            ? "The segments are collinear but their closed bounds do not overlap."
            : "The orientation tests do not show opposite-sided crossing or endpoint contact.",
      `Exact intersection result is ${String(intersect)} (${classification}).`
    ],
    verdict: claim.statedIntersect === undefined ? "computed" : statedMatches ? "accepted" : "refuted"
  };
}

function orientationValue(origin: Point2, endpoint: Point2, point: Point2): bigint {
  return (endpoint.x - origin.x) * (point.y - origin.y) - (endpoint.y - origin.y) * (point.x - origin.x);
}

function orientationSign(value: bigint): "clockwise" | "counterclockwise" | "collinear" {
  if (value > 0n) {
    return "counterclockwise";
  }
  if (value < 0n) {
    return "clockwise";
  }
  return "collinear";
}

function oppositeSigns(left: bigint, right: bigint): boolean {
  return (left > 0n && right < 0n) || (left < 0n && right > 0n);
}

function pointOnSegment2(point: Point2, segment: Segment2): boolean {
  return (
    point.x >= minBigInt(segment.from.x, segment.to.x) &&
    point.x <= maxBigInt(segment.from.x, segment.to.x) &&
    point.y >= minBigInt(segment.from.y, segment.to.y) &&
    point.y <= maxBigInt(segment.from.y, segment.to.y)
  );
}

function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function maxBigInt(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function stringifySegment2(segment: Segment2): { from: Record<keyof Point2, string>; to: Record<keyof Point2, string> } {
  return {
    from: stringifyPoint2(segment.from),
    to: stringifyPoint2(segment.to)
  };
}

function stringifyPoint2(point: Point2): Record<keyof Point2, string> {
  return {
    x: point.x.toString(),
    y: point.y.toString()
  };
}
export function parseRay2AabbIntersectionClaim(problem: string): Ray2AabbIntersectionClaim | undefined {
  const candidate = latexToReadableMath(problem)
    .replace(/\$/gu, "")
    .replace(/^(?:please\s+)?(?:verify|check|show)\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.?]$/u, "");
  const match = /^(?:do\s+)?ray\s+origin\s*\(\s*(?<originX>-?\d+)\s*,\s*(?<originY>-?\d+)\s*\)\s+direction\s*\(\s*(?<directionX>-?\d+)\s*,\s*(?<directionY>-?\d+)\s*\)\s+intersects?\s+aabb\s+min\s*\(\s*(?<minX>-?\d+)\s*,\s*(?<minY>-?\d+)\s*\)\s+max\s*\(\s*(?<maxX>-?\d+)\s*,\s*(?<maxY>-?\d+)\s*\)(?:\s*(?:=|is)\s*(?<stated>true|false))?$/iu.exec(candidate);
  if (!match?.groups) {
    return undefined;
  }

  const requiredGroups = ["originX", "originY", "directionX", "directionY", "minX", "minY", "maxX", "maxY"];
  if (requiredGroups.some((key) => match.groups?.[key] === undefined || match.groups[key].length > 18)) {
    return undefined;
  }

  const ray: Ray2 = {
    origin: { x: BigInt(match.groups.originX), y: BigInt(match.groups.originY) },
    direction: { x: BigInt(match.groups.directionX), y: BigInt(match.groups.directionY) }
  };
  const box: Aabb2 = {
    minX: BigInt(match.groups.minX),
    minY: BigInt(match.groups.minY),
    maxX: BigInt(match.groups.maxX),
    maxY: BigInt(match.groups.maxY)
  };
  if (!isNonZeroDirection2(ray.direction) || !isValidAabb2(box)) {
    return undefined;
  }

  return {
    source: candidate,
    ray,
    box,
    statedIntersect: match.groups.stated === undefined ? undefined : match.groups.stated.toLowerCase() === "true"
  };
}

function isNonZeroDirection2(direction: Point2): boolean {
  return direction.x !== 0n || direction.y !== 0n;
}

export function ray2AabbIntersectionCertificate(claim: Ray2AabbIntersectionClaim): {
  schemaVersion: "truth-harness.ray2-aabb-intersection.v0";
  adapter: "local-ray2-aabb-intersection";
  source: string;
  convention: "closed-aabb-ray-domain-t-greater-than-or-equal-zero";
  ray: { origin: Record<keyof Point2, string>; direction: Record<keyof Point2, string> };
  box: Record<keyof Aabb2, string>;
  statedIntersect?: boolean;
  axisIntervals: Array<{
    axis: "x" | "y";
    status: "bounded" | "parallel-inside" | "parallel-outside";
    enter: string;
    exit: string;
  }>;
  tEnter: string;
  tExit: string;
  intersect: boolean;
  classification: Ray2AabbClassification;
  hitPoint?: Record<keyof Point2, string>;
  checks: Array<{ id: string; ok: boolean; expected: string; observed: string }>;
  trace: string[];
  verdict: "computed" | "accepted" | "refuted";
} {
  const xInterval = raySlabAxisInterval("x", claim.ray.origin.x, claim.ray.direction.x, claim.box.minX, claim.box.maxX);
  const yInterval = raySlabAxisInterval("y", claim.ray.origin.y, claim.ray.direction.y, claim.box.minY, claim.box.maxY);
  const axisIntervals = [xInterval, yInterval];
  const parallelMiss = axisIntervals.some((interval) => interval.status === "parallel-outside");
  const zero = Rational.integer(0);
  const tEnterEndpoint = maxRaySlabEndpoint([zero, xInterval.enter, yInterval.enter]);
  const tExitEndpoint = minRaySlabEndpoint([xInterval.exit, yInterval.exit]);
  const intervalOverlaps = compareRaySlabEndpoint(tEnterEndpoint, tExitEndpoint) <= 0;
  const intersect = !parallelMiss && intervalOverlaps;
  const originInside = pointInAabb2(claim.ray.origin, claim.box);
  const classification: Ray2AabbClassification = intersect
    ? originInside
      ? "origin-inside"
      : "ray-hit"
    : parallelMiss
      ? "parallel-miss"
      : isFiniteRaySlabEndpoint(tExitEndpoint) && tExitEndpoint.lessThan(zero)
        ? "behind-ray"
        : "slab-miss";
  const hitPoint = intersect && isFiniteRaySlabEndpoint(tEnterEndpoint)
    ? rayPointAt(claim.ray, tEnterEndpoint)
    : undefined;
  const statedMatches = claim.statedIntersect === undefined || claim.statedIntersect === intersect;

  return {
    schemaVersion: "truth-harness.ray2-aabb-intersection.v0",
    adapter: "local-ray2-aabb-intersection",
    source: claim.source,
    convention: "closed-aabb-ray-domain-t-greater-than-or-equal-zero",
    ray: stringifyRay2(claim.ray),
    box: stringifyAabb2(claim.box),
    statedIntersect: claim.statedIntersect,
    axisIntervals: axisIntervals.map((interval) => ({
      axis: interval.axis,
      status: interval.status,
      enter: raySlabEndpointToString(interval.enter),
      exit: raySlabEndpointToString(interval.exit)
    })),
    tEnter: raySlabEndpointToString(tEnterEndpoint),
    tExit: raySlabEndpointToString(tExitEndpoint),
    intersect,
    classification,
    hitPoint,
    checks: [
      {
        id: "valid-ray-aabb-inputs",
        ok: true,
        expected: "nonzero ray direction and valid AABB min/max bounds",
        observed: "ray direction is nonzero and AABB bounds are valid"
      },
      {
        id: "ray-domain-slab-result",
        ok: statedMatches,
        expected: String(intersect),
        observed: claim.statedIntersect === undefined ? String(intersect) : String(claim.statedIntersect)
      }
    ],
    trace: [
      "Use a closed AABB and ray parameter domain t >= 0; boundary hits count as intersection.",
      `X slab interval is [${raySlabEndpointToString(xInterval.enter)}, ${raySlabEndpointToString(xInterval.exit)}] (${xInterval.status}).`,
      `Y slab interval is [${raySlabEndpointToString(yInterval.enter)}, ${raySlabEndpointToString(yInterval.exit)}] (${yInterval.status}).`,
      `Intersect the slabs with t >= 0 to get [${raySlabEndpointToString(tEnterEndpoint)}, ${raySlabEndpointToString(tExitEndpoint)}].`,
      `Exact ray/AABB result is ${String(intersect)} (${classification}).`
    ],
    verdict: claim.statedIntersect === undefined ? "computed" : statedMatches ? "accepted" : "refuted"
  };
}

function raySlabAxisInterval(
  axis: "x" | "y",
  origin: bigint,
  direction: bigint,
  minimum: bigint,
  maximum: bigint
): RaySlabAxisInterval {
  if (direction === 0n) {
    const inside = origin >= minimum && origin <= maximum;
    return {
      axis,
      status: inside ? "parallel-inside" : "parallel-outside",
      enter: "negative-infinity",
      exit: "positive-infinity"
    };
  }

  const first = new Rational(minimum - origin, direction);
  const second = new Rational(maximum - origin, direction);
  return {
    axis,
    status: "bounded",
    enter: first.lessThanOrEqual(second) ? first : second,
    exit: first.lessThanOrEqual(second) ? second : first
  };
}

function compareRaySlabEndpoint(left: RaySlabEndpoint, right: RaySlabEndpoint): -1 | 0 | 1 {
  if (left === right) {
    return 0;
  }
  if (left === "negative-infinity" || right === "positive-infinity") {
    return -1;
  }
  if (left === "positive-infinity" || right === "negative-infinity") {
    return 1;
  }
  return left.compare(right);
}

function maxRaySlabEndpoint(values: RaySlabEndpoint[]): RaySlabEndpoint {
  return values.reduce((current, value) => (compareRaySlabEndpoint(current, value) >= 0 ? current : value));
}

function minRaySlabEndpoint(values: RaySlabEndpoint[]): RaySlabEndpoint {
  return values.reduce((current, value) => (compareRaySlabEndpoint(current, value) <= 0 ? current : value));
}

function isFiniteRaySlabEndpoint(value: RaySlabEndpoint): value is Rational {
  return value !== "negative-infinity" && value !== "positive-infinity";
}

function raySlabEndpointToString(value: RaySlabEndpoint): string {
  if (value === "negative-infinity") {
    return "-infinity";
  }
  if (value === "positive-infinity") {
    return "infinity";
  }
  return value.toString();
}

function pointInAabb2(point: Point2, box: Aabb2): boolean {
  return point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY;
}

function rayPointAt(ray: Ray2, t: Rational): Record<keyof Point2, string> {
  const x = Rational.integer(ray.origin.x).add(Rational.integer(ray.direction.x).multiply(t));
  const y = Rational.integer(ray.origin.y).add(Rational.integer(ray.direction.y).multiply(t));
  return { x: x.toString(), y: y.toString() };
}

function stringifyRay2(ray: Ray2): { origin: Record<keyof Point2, string>; direction: Record<keyof Point2, string> } {
  return {
    origin: stringifyPoint2(ray.origin),
    direction: stringifyPoint2(ray.direction)
  };
}
export function parsePointInTriangle2Claim(problem: string): PointInTriangle2Claim | undefined {
  const candidate = latexToReadableMath(problem)
    .replace(/\$/gu, "")
    .replace(/^(?:please\s+)?(?:verify|check|show)\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.?]$/u, "");
  const match = /^(?:is\s+)?point\s*\(\s*(?<pointX>-?\d+)\s*,\s*(?<pointY>-?\d+)\s*\)\s+in\s+triangle\s+a\s*\(\s*(?<aX>-?\d+)\s*,\s*(?<aY>-?\d+)\s*\)\s+b\s*\(\s*(?<bX>-?\d+)\s*,\s*(?<bY>-?\d+)\s*\)\s+c\s*\(\s*(?<cX>-?\d+)\s*,\s*(?<cY>-?\d+)\s*\)(?:\s*(?:=|is)\s*(?<stated>true|false))?$/iu.exec(candidate);
  if (!match?.groups) {
    return undefined;
  }

  const requiredGroups = ["pointX", "pointY", "aX", "aY", "bX", "bY", "cX", "cY"];
  if (requiredGroups.some((key) => match.groups?.[key] === undefined || match.groups[key].length > 18)) {
    return undefined;
  }

  const triangle: Triangle2 = {
    a: { x: BigInt(match.groups.aX), y: BigInt(match.groups.aY) },
    b: { x: BigInt(match.groups.bX), y: BigInt(match.groups.bY) },
    c: { x: BigInt(match.groups.cX), y: BigInt(match.groups.cY) }
  };
  if (!isNonDegenerateTriangle2(triangle)) {
    return undefined;
  }

  return {
    source: candidate,
    point: { x: BigInt(match.groups.pointX), y: BigInt(match.groups.pointY) },
    triangle,
    statedInside: match.groups.stated === undefined ? undefined : match.groups.stated.toLowerCase() === "true"
  };
}

function isNonDegenerateTriangle2(triangle: Triangle2): boolean {
  return orientationValue(triangle.a, triangle.b, triangle.c) !== 0n;
}

export function pointInTriangle2Certificate(claim: PointInTriangle2Claim): {
  schemaVersion: "truth-harness.point-in-triangle2.v0";
  adapter: "local-point-in-triangle2";
  source: string;
  convention: "closed-triangle-edges-count-as-inside";
  point: Record<keyof Point2, string>;
  triangle: { a: Record<keyof Point2, string>; b: Record<keyof Point2, string>; c: Record<keyof Point2, string> };
  statedInside?: boolean;
  triangleArea2: string;
  edgeOrientations: Array<{ id: string; value: string; sign: "clockwise" | "counterclockwise" | "collinear" }>;
  inside: boolean;
  classification: PointInTriangle2Classification;
  checks: Array<{ id: string; ok: boolean; expected: string; observed: string }>;
  trace: string[];
  verdict: "computed" | "accepted" | "refuted";
} {
  const area2 = orientationValue(claim.triangle.a, claim.triangle.b, claim.triangle.c);
  const orientationSignMultiplier = area2 > 0n ? 1n : -1n;
  const abp = orientationValue(claim.triangle.a, claim.triangle.b, claim.point) * orientationSignMultiplier;
  const bcp = orientationValue(claim.triangle.b, claim.triangle.c, claim.point) * orientationSignMultiplier;
  const cap = orientationValue(claim.triangle.c, claim.triangle.a, claim.point) * orientationSignMultiplier;
  const edgeValues = [abp, bcp, cap];
  const inside = edgeValues.every((value) => value >= 0n);
  const zeroCount = edgeValues.filter((value) => value === 0n).length;
  const classification: PointInTriangle2Classification = inside
    ? zeroCount >= 2
      ? "vertex"
      : zeroCount === 1
        ? "edge"
        : "inside"
    : "outside";
  const statedMatches = claim.statedInside === undefined || claim.statedInside === inside;
  const edgeOrientations = [
    { id: "orient(a,b,point)", value: abp.toString(), sign: orientationSign(abp) },
    { id: "orient(b,c,point)", value: bcp.toString(), sign: orientationSign(bcp) },
    { id: "orient(c,a,point)", value: cap.toString(), sign: orientationSign(cap) }
  ];

  return {
    schemaVersion: "truth-harness.point-in-triangle2.v0",
    adapter: "local-point-in-triangle2",
    source: claim.source,
    convention: "closed-triangle-edges-count-as-inside",
    point: stringifyPoint2(claim.point),
    triangle: stringifyTriangle2(claim.triangle),
    statedInside: claim.statedInside,
    triangleArea2: area2.toString(),
    edgeOrientations,
    inside,
    classification,
    checks: [
      {
        id: "non-degenerate-triangle-input",
        ok: true,
        expected: "triangle area determinant is nonzero",
        observed: `area2=${area2.toString()}`
      },
      {
        id: "closed-triangle-membership-result",
        ok: statedMatches,
        expected: String(inside),
        observed: claim.statedInside === undefined ? String(inside) : String(claim.statedInside)
      }
    ],
    trace: [
      "Use a closed triangle, so points on edges or vertices count as inside.",
      `Triangle signed double-area determinant is ${area2.toString()}; edge tests are normalized to the triangle orientation.`,
      `Normalized edge orientations are ${edgeOrientations.map((item) => `${item.id}=${item.value} (${item.sign})`).join(", ")}.`,
      `Exact point-in-triangle result is ${String(inside)} (${classification}).`
    ],
    verdict: claim.statedInside === undefined ? "computed" : statedMatches ? "accepted" : "refuted"
  };
}

function stringifyTriangle2(triangle: Triangle2): { a: Record<keyof Point2, string>; b: Record<keyof Point2, string>; c: Record<keyof Point2, string> } {
  return {
    a: stringifyPoint2(triangle.a),
    b: stringifyPoint2(triangle.b),
    c: stringifyPoint2(triangle.c)
  };
}
function latexToReadableMath(value: string): string {
  return value
    .replace(/\\operatorname\{([^{}]+)\}/gu, "$1")
    .replace(/\\frac\{(-?\d+)\}\{(-?\d+)\}/gu, "$1/$2")
    .replace(/\\[,;:! ]/gu, " ")
    .replace(/\\/gu, " ");
}
export type EngineVerifierPackStatus = "ready" | "partial" | "planned";
export type EngineVerifierPackCapabilityRole = "collision-predicate" | "spatial-query" | "continuous-collision-predicate" | "interpolation-coordinate";

export interface EngineVerifierPackCapability {
  id: string;
  displayName: string;
  role: EngineVerifierPackCapabilityRole;
  backendId: string;
  promptForms: string[];
  benchmarkTaskIds: string[];
  evidenceKind: "exact-arithmetic";
  strongestTrust: "exact-computed" | "refuted";
  convention: string;
  boundary: string;
}

export interface EngineVerifierPack {
  schemaVersion: "truth-harness.engine-verifier-pack.v0";
  id: string;
  displayName: string;
  capabilityId: string;
  lane: "engine-math";
  status: EngineVerifierPackStatus;
  localOnly: true;
  networkAccess: "none";
  description: string;
  benchmarkSuite: {
    id: string;
    path: string;
    nativeCommand: string;
    dockerCommand: string;
    totalTasks: number;
    expectedTrustCounts: Record<"exact-computed" | "refuted", number>;
  };
  capabilities: EngineVerifierPackCapability[];
  agentContract: {
    routeBeforeGenericMath: true;
    attachConcreteReceiptBeforeClaim: true;
    promptMustMatchSupportedForm: true;
    trustDoesNotExceedPredicateBoundary: true;
    benchmarkReplayRequiredForPackChanges: true;
  };
  limitations: string[];
  nextActions: string[];
}

export interface EngineVerifierPackList {
  schemaVersion: "truth-harness.engine-verifier-packs.v0";
  total: number;
  filteredBy?: {
    id: string;
  };
  packs: EngineVerifierPack[];
  warnings: string[];
}

export const ENGINE_2D_COLLISION_VERIFIER_PACK_ID = "engine-2d-collision-verifier-pack";
export const ENGINE_2D_COLLISION_CAPABILITY_ID = "local-engine-geometry-2d";
export const ENGINE_MATH_SEED_SUITE_PATH = "packages/benchmarks/suites/engine-math-seed.json";

const ENGINE_2D_COLLISION_CAPABILITIES: EngineVerifierPackCapability[] = [
  {
    id: "aabb2-overlap",
    displayName: "AABB/AABB overlap",
    role: "collision-predicate",
    backendId: "local-aabb2-overlap",
    promptForms: [
      "Do AABB A min(0,0) max(4,4) and AABB B min(3,1) max(6,5) overlap?",
      "verify AABB A min(0,0) max(4,4) and AABB B min(5,1) max(7,3) overlap = true"
    ],
    benchmarkTaskIds: ["aabb-overlap-true", "aabb-overlap-wrong-statement-refuted", "aabb-touching-corner-counts-as-overlap"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "closed-intervals-touching-counts-as-overlap",
    boundary: "Only integer-coordinate 2D AABBs are checked; touching edges or corners count as overlap."
  },
  {
    id: "swept-aabb2-intersection",
    displayName: "Swept AABB/AABB intersection",
    role: "continuous-collision-predicate",
    backendId: "local-swept-aabb2-intersection",
    promptForms: [
      "Do swept AABB A min(0,0) max(1,1) velocity(3,0) intersect AABB B min(3,0) max(4,1) over t in [0,1]?",
      "verify swept AABB A min(0,0) max(1,1) velocity(1,0) intersect AABB B min(3,0) max(4,1) over t in [0,1] = true"
    ],
    benchmarkTaskIds: ["swept-aabb-frame-hit", "swept-aabb-initial-overlap", "swept-aabb-after-frame-refuted"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "closed-aabb-continuous-time-frame-0-to-1",
    boundary: "Only one integer-coordinate moving AABB against one static AABB over 0 <= t <= 1 is checked."
  },
  {
    id: "circle2-circle2-intersection",
    displayName: "Circle/circle intersection",
    role: "collision-predicate",
    backendId: "local-circle2-intersection",
    promptForms: [
      "Do circle A center(0,0) radius 3 and circle B center(4,0) radius 2 intersect?",
      "verify circle A center(0,0) radius 2 and circle B center(6,0) radius 2 intersect = true"
    ],
    benchmarkTaskIds: ["circle-circle-overlap", "circle-circle-tangent-counts-as-hit", "circle-circle-separated-refuted"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "closed-disks-boundary-counts-as-intersection",
    boundary: "Only integer-center, integer-radius 2D closed disks are checked; tangency and containment count as intersection."
  },
  {
    id: "capsule2-circle2-intersection",
    displayName: "Capsule/circle intersection",
    role: "collision-predicate",
    backendId: "local-capsule2-circle-intersection",
    promptForms: [
      "Do capsule A from (0,0) to (4,0) radius 1 and circle B center(2,1) radius 1 intersect?",
      "verify capsule A from (0,0) to (4,0) radius 1 and circle B center(2,4) radius 1 intersect = true"
    ],
    benchmarkTaskIds: ["capsule-circle-side-overlap", "capsule-circle-side-tangent-counts-as-hit", "capsule-circle-separated-refuted"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "closed-capsule-and-closed-disk-boundary-counts-as-intersection",
    boundary: "Only one integer-coordinate 2D capsule against one integer-coordinate closed disk is checked."
  },
  {
    id: "circle2-aabb2-intersection",
    displayName: "Circle/AABB intersection",
    role: "collision-predicate",
    backendId: "local-circle2-aabb-intersection",
    promptForms: [
      "Do circle center(2,2) radius 2 intersect AABB min(3,0) max(6,4)?",
      "verify circle center(0,0) radius 2 intersect AABB min(3,3) max(5,5) = true"
    ],
    benchmarkTaskIds: ["circle-aabb-overlap", "circle-aabb-tangent-counts-as-hit", "circle-aabb-separated-refuted"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "closed-circle-and-closed-aabb-boundary-counts-as-intersection",
    boundary: "Only integer-coordinate 2D circles and AABBs are checked by exact closest-point distance."
  },
  {
    id: "segment2-segment2-intersection",
    displayName: "Segment/segment intersection",
    role: "spatial-query",
    backendId: "local-segment2-intersection",
    promptForms: [
      "Do segment A from (0,0) to (4,4) and segment B from (0,4) to (4,0) intersect?",
      "verify segment A from (0,0) to (1,1) and segment B from (2,2) to (3,3) intersect = true"
    ],
    benchmarkTaskIds: ["segment-proper-crossing", "segment-collinear-disjoint-refuted", "segment-collinear-overlap"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "closed-segments-endpoints-count-as-intersection",
    boundary: "Only non-degenerate integer-coordinate 2D line segments are checked."
  },
  {
    id: "ray2-circle2-intersection",
    displayName: "Ray/circle intersection",
    role: "spatial-query",
    backendId: "local-ray2-circle-intersection",
    promptForms: [
      "Do ray origin(0,0) direction(1,0) intersect circle center(3,1) radius 2?",
      "verify ray origin(0,0) direction(1,0) intersect circle center(-3,0) radius 1 = true",
      "verify ray origin(0,0) direction(1,0) intersect circle center(4,0) radius 1 max t 2 = true"
    ],
    benchmarkTaskIds: ["ray-circle-hit", "ray-circle-tangent-counts-as-hit", "ray-circle-behind-ray-refuted", "ray-circle-max-t-hit", "ray-circle-max-t-refuted"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "closed-disk-ray-domain-t-greater-than-or-equal-zero",
    boundary: "Only integer-origin, nonzero integer-direction 2D rays against integer-coordinate closed disks are checked; optional max-t finite raycast domains are supported."
  },
  {
    id: "ray2-aabb2-intersection",
    displayName: "Ray/AABB intersection",
    role: "spatial-query",
    backendId: "local-ray2-aabb-intersection",
    promptForms: [
      "Do ray origin(0,2) direction(1,0) intersect AABB min(3,0) max(5,4)?",
      "verify ray origin(0,5) direction(1,0) intersect AABB min(3,0) max(5,4) = true",
      "verify ray origin(0,2) direction(1,0) intersect AABB min(3,0) max(5,4) max t 2 = true"
    ],
    benchmarkTaskIds: ["ray-aabb-hit", "ray-aabb-parallel-miss-refuted", "ray-aabb-behind-ray", "ray-aabb-max-t-hit", "ray-aabb-max-t-refuted"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "closed-aabb-ray-domain-t-greater-than-or-equal-zero",
    boundary: "Only integer-origin, nonzero integer-direction 2D rays against integer-coordinate AABBs are checked; optional max-t finite raycast domains are supported."
  },
  {
    id: "barycentric2-coordinates",
    displayName: "Barycentric coordinates",
    role: "interpolation-coordinate",
    backendId: "local-barycentric2",
    promptForms: [
      "compute barycentric coordinates for point (1,1) in triangle A(0,0) B(4,0) C(0,4)",
      "verify barycentric coordinates for point (1,1) in triangle A(0,0) B(4,0) C(0,4) = (1/3,1/3,1/3)"
    ],
    benchmarkTaskIds: ["barycentric-interior", "barycentric-wrong-statement-refuted"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "signed-area-barycentric-coordinates",
    boundary: "Only one non-degenerate integer-coordinate 2D triangle and one integer-coordinate point are checked."
  },
  {
    id: "point2-triangle2-membership",
    displayName: "Point-in-triangle membership",
    role: "spatial-query",
    backendId: "local-point-in-triangle2",
    promptForms: [
      "Is point (1,1) in triangle A(0,0) B(4,0) C(0,4)?",
      "verify point (5,5) in triangle A(0,0) B(4,0) C(0,4) = true"
    ],
    benchmarkTaskIds: ["point-triangle-inside", "point-triangle-edge-counts-inside", "point-triangle-outside-refuted"],
    evidenceKind: "exact-arithmetic",
    strongestTrust: "exact-computed",
    convention: "closed-triangle-edges-count-as-inside",
    boundary: "Only non-degenerate integer-coordinate 2D triangles and integer-coordinate points are checked."
  }
];

export function getEngineVerifierPacks(): EngineVerifierPack[] {
  return [
    {
      schemaVersion: "truth-harness.engine-verifier-pack.v0",
      id: ENGINE_2D_COLLISION_VERIFIER_PACK_ID,
      displayName: "2D collision verifier pack",
      capabilityId: ENGINE_2D_COLLISION_CAPABILITY_ID,
      lane: "engine-math",
      status: "ready",
      localOnly: true,
      networkAccess: "none",
      description:
        "A local deterministic pack of integer-coordinate 2D collision and spatial-query predicates for game, simulation, robotics, graphics, and agentic engine work.",
      benchmarkSuite: {
        id: "engine-math-seed",
        path: ENGINE_MATH_SEED_SUITE_PATH,
        nativeCommand: "npm run demo:engine-math",
        dockerCommand: "npm run docker:engine-math",
        totalTasks: 33,
        expectedTrustCounts: {
          "exact-computed": 21,
          refuted: 12
        }
      },
      capabilities: ENGINE_2D_COLLISION_CAPABILITIES,
      agentContract: {
        routeBeforeGenericMath: true,
        attachConcreteReceiptBeforeClaim: true,
        promptMustMatchSupportedForm: true,
        trustDoesNotExceedPredicateBoundary: true,
        benchmarkReplayRequiredForPackChanges: true
      },
      limitations: [
        "The pack checks narrow integer-coordinate 2D predicates, not arbitrary engine runtime state.",
        "It does not verify collision response, broadphase structures, meshes, convex polygons, tolerances, floating-point drift, rendering visibility, or physics integration.",
        "Every boundary convention is part of the receipt; engines with different open/half-open/tolerance policies need separate adapters."
      ],
      nextActions: [
        "Run npm run demo:engine-math for a native replay of every pack predicate.",
        "Run npm run docker:engine-math before sharing reviewer evidence or claiming the pack works in the Docker-first workflow.",
        "When an agent sees AABB, circle, capsule, segment, ray, barycentric, triangle, collision, overlap, intersection, raycast, or hit-test language, route here before generic CAS/SMT planning."
      ]
    }
  ];
}

export function getEngineVerifierPackById(id: string): EngineVerifierPack | undefined {
  return getEngineVerifierPacks().find((pack) => pack.id === id || pack.capabilityId === id);
}

export function listEngineVerifierPacks(input: { packId?: string } = {}): EngineVerifierPackList {
  const packs = input.packId ? getEngineVerifierPacks().filter((pack) => pack.id === input.packId || pack.capabilityId === input.packId) : getEngineVerifierPacks();
  return {
    schemaVersion: "truth-harness.engine-verifier-packs.v0",
    total: packs.length,
    filteredBy: input.packId ? { id: input.packId } : undefined,
    packs,
    warnings: input.packId && packs.length === 0 ? [`No engine verifier pack found for '${input.packId}'.`] : []
  };
}

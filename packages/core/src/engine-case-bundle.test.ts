import { describe, expect, it } from "vitest";
import { validateEngineCaseBundle, validateEngineCaseBundleJson } from "./engine-case-bundle.js";

describe("engine case bundle validation", () => {
  it("accepts structured engine outputs that match local deterministic primitives", () => {
    const report = validateEngineCaseBundle({
      schemaVersion: "truth-harness.engine-case-bundle.v0",
      producer: {
        name: "example-rust-engine",
        version: "0.1.0",
        commit: "abc123"
      },
      cases: [
        {
          caseId: "aabb-hit-001",
          primitive: "aabb2-overlap",
          boundary: "closed-intervals-touching-counts-as-overlap",
          inputs: {
            a: { minX: "0", minY: "0", maxX: "4", maxY: "4" },
            b: { minX: "3", minY: "1", maxX: "6", maxY: "5" }
          },
          observed: { overlap: true }
        },
        {
          caseId: "barycentric-001",
          primitive: "barycentric2-coordinates",
          inputs: {
            point: { x: "1", y: "1" },
            triangle: {
              a: { x: "0", y: "0" },
              b: { x: "4", y: "0" },
              c: { x: "0", y: "4" }
            }
          },
          observed: { coordinates: { a: "1/2", b: "1/4", c: "1/4" } }
        }
      ]
    });

    expect(report.status).toBe("passed");
    expect(report.accepted).toBe(2);
    expect(report.refuted).toBe(0);
    expect(report.unsupported).toBe(0);
    expect(report.cases[0]).toMatchObject({
      caseId: "aabb-hit-001",
      primitive: "aabb2-overlap",
      status: "accepted",
      trust: "exact-computed",
      backendId: "local-aabb2-overlap",
      expected: "true",
      observed: "true"
    });
    expect(report.cases[1]?.expected).toBe("(1/2, 1/4, 1/4)");
  });

  it("refutes wrong outputs from an external engine", () => {
    const report = validateEngineCaseBundle({
      schemaVersion: "truth-harness.engine-case-bundle.v0",
      cases: [
        {
          caseId: "circle-miss-bug",
          primitive: "circle2-intersection",
          inputs: {
            a: { center: { x: "0", y: "0" }, radius: "2" },
            b: { center: { x: "6", y: "0" }, radius: "2" }
          },
          observed: { intersect: true }
        }
      ]
    });

    expect(report.status).toBe("failed");
    expect(report.refuted).toBe(1);
    expect(report.cases[0]).toMatchObject({
      status: "refuted",
      trust: "refuted",
      expected: "false",
      observed: "true"
    });
  });

  it("fails closed when boundary semantics do not match the verifier", () => {
    const report = validateEngineCaseBundleJson(JSON.stringify({
      schemaVersion: "truth-harness.engine-case-bundle.v0",
      cases: [
        {
          caseId: "touching-edge-half-open-policy",
          primitive: "aabb2-overlap",
          boundary: "half-open-intervals-touching-does-not-count",
          inputs: {
            a: { minX: "0", minY: "0", maxX: "1", maxY: "1" },
            b: { minX: "1", minY: "0", maxX: "2", maxY: "1" }
          },
          observed: { overlap: false }
        }
      ]
    }));

    expect(report.status).toBe("partial");
    expect(report.unsupported).toBe(1);
    expect(report.cases[0]?.issues.join("\n")).toContain("does not match verifier convention");
    expect(report.cases[0]?.trust).toBe("unverified");
  });
});
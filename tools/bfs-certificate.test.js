import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkBfsCertificate } from "./bfs-certificate.mjs";

const sample = name => new URL(`../docs/examples/bfs-certificate-${name}.json`, import.meta.url);
const validRaw = readFileSync(sample("valid"), "utf8");
const valid = JSON.parse(validRaw);
const check = request => checkBfsCertificate(JSON.stringify(request));
const withLabel = (vertex, label) => ({
  ...valid, labels: valid.labels.map((value, i) => i === vertex ? label : value)
});
const script = fileURLToPath(new URL("./bfs-certificate.mjs", import.meta.url));

function bfsReference(vertexCount, source, edges) {
  const labels = Array(vertexCount).fill(null);
  const queue = [source];
  labels[source] = 0;
  for (const vertex of queue) {
    for (const [from, to] of edges) {
      if (from !== vertex || labels[to] !== null) continue;
      labels[to] = labels[vertex] + 1;
      queue.push(to);
    }
  }
  return labels;
}

describe("BFS distance certificate checks", () => {
  it("accepts reachable and unreachable labels and binds the exact request bytes", () => {
    expect(checkBfsCertificate(validRaw)).toEqual({
      schema_version: "truth-harness.bfs-certificate-report.v0",
      status: "accepted", scope: "unit-edge-distance-certificate-conditions", proof_checker_backed: false,
      request_sha256: createHash("sha256").update(validRaw).digest("hex"),
      vertex_count: 6, edge_count: 7, source: 0, labeled_count: 5, unlabeled_count: 1
    });
    expect(check({ ...valid, vertex_count: 1, edges: [[0, 0]], labels: [0] }).status).toBe("accepted");
  });

  it.each([
    [0, null, { condition: "source_zero", vertex: 0, label: null, expected: 0 }],
    [0, 2, { condition: "source_zero", vertex: 0, label: 2, expected: 0 }],
    [1, 0, { condition: "zero_is_source", vertex: 1, label: 0 }],
    [4, null, { condition: "edge_bound", reason: "unlabeled_successor", edge_index: 4, from: 3, to: 4, from_label: 2, label: null }],
    [4, 4, { condition: "edge_bound", reason: "bound_exceeded", edge_index: 4, from: 3, to: 4, from_label: 2, label: 4 }],
    [4, 1, { condition: "predecessor", vertex: 4, label: 1, required_predecessor_label: 0 }]
  ])("diagnoses vertex %i with label %s", (vertex, label, failure) => {
    const result = check(withLabel(vertex, label));
    expect(result).toMatchObject({ status: "rejected", proof_checker_backed: false, failure });
    expect(result).not.toHaveProperty("trust");
  });

  it("requires an incoming predecessor, even with an outgoing edge to a lower label", () => {
    const result = check({ ...valid, vertex_count: 2, edges: [[1, 0]], labels: [0, 1] });
    expect(result.failure).toEqual({ condition: "predecessor", vertex: 1, label: 1, required_predecessor_label: 0 });
  });

  it.each([
    [{ vertex_count: 0 }, /vertex_count/],
    [{ vertex_count: 4097 }, /vertex_count/],
    [{ source: 6 }, /source must be a vertex/],
    [{ labels: [0] }, /one entry per vertex/],
    [{ edges: [[0, 6]] }, /edges\.0/],
    [{ edges: [[0, 1, 2]] }, /edges/],
    [{ edges: Array(8193).fill([0, 1]) }, /edges/],
    [{ labels: [0, 1, 1, 2, "3", null] }, /labels\.4/],
    [{ labels: [0, 1, 1, 2, Number.MAX_SAFE_INTEGER + 1, null] }, /labels\.4/],
    [{ schema_version: "future" }, /schema_version/],
    [{ weights: [] }, /unrecognized_keys/],
    [{ toString: "unknown field" }, /unrecognized_keys/]
  ])("rejects out-of-domain or malformed input %#", (patch, message) => {
    expect(() => check({ ...valid, ...patch })).toThrow(message);
  });

  it.each(["-0", "0.0", "0e0", "0.00000000000000000000000001", "-1"])(
    "rejects noncanonical numeric tokens (%s) before comparison",
    rawSource => {
      const raw = JSON.stringify(valid).replace('"source":0', `"source":${rawSource}`);
      expect(() => checkBfsCertificate(raw)).toThrow(/integer literals/);
    }
  );

  it("rejects an escaped duplicate JSON member rather than silently taking its last value", () => {
    const raw = JSON.stringify(valid).replace('"source":0', '"source":0,"\\u0073ource":0');
    expect(() => checkBfsCertificate(raw)).toThrow(/Duplicate JSON member: source/);
  });

  it("agrees with independent BFS for all 24,000 small graph/source/label combinations", () => {
    const vertices = [0, 1, 2];
    const allEdges = vertices.flatMap(from => vertices.filter(to => from !== to).map(to => [from, to]));
    const values = [null, 0, 1, 2, 3];
    let cases = 0;
    for (let mask = 0; mask < 2 ** allEdges.length; mask += 1) {
      const edges = allEdges.filter((_, i) => mask & (1 << i));
      for (const source of vertices) {
        const actual = bfsReference(vertices.length, source, edges);
        for (const a of values) for (const b of values) for (const c of values) {
          const labels = [a, b, c];
          const expected = labels.every((label, i) => label === actual[i]);
          const accepted = check({ schema_version: valid.schema_version, vertex_count: vertices.length, source, edges, labels }).status === "accepted";
          if (accepted !== expected) throw new Error(`BFS mismatch: ${JSON.stringify({ edges, source, labels, actual })}`);
          cases += 1;
        }
      }
    }
    expect(cases).toBe(24000);
  }, 20000);
});

describe("BFS certificate CLI", () => {
  const run = (args, input) => spawnSync(process.execPath, [script, ...args], { input, encoding: "utf8", timeout: 5000 });

  it("reads file or stdin with identical output, and uses exit 1 for bad claimed distances", () => {
    const file = run([fileURLToPath(sample("valid"))]);
    expect(file.status).toBe(0);
    const stdin = run(["-"], validRaw);
    expect(stdin.status).toBe(0);
    expect(stdin.stdout).toBe(file.stdout);
    const bad = run([fileURLToPath(sample("too-short"))]);
    expect(bad.status).toBe(1);
    expect(JSON.parse(bad.stdout)).toMatchObject({
      status: "rejected", failure: { condition: "predecessor", vertex: 4, label: 1 }
    });
  });

  it("returns exit 2 for usage, malformed or oversized stdin and bad encoding", () => {
    for (const result of [run(["--wrong"]), run(["-"], "{"), run(["-"], Buffer.from([255])),
      run(["-"], "\uFEFF" + validRaw), run(["-"], " ".repeat(65537))]) {
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({ status: "invalid", proof_checker_backed: false });
      expect(JSON.parse(result.stdout)).not.toHaveProperty("failure");
    }
  });
});

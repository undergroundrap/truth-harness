import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const source = new URL("../fixtures/bfs/graph.json", import.meta.url);
const producer = fileURLToPath(new URL("../fixtures/bfs/produce_labels.py", import.meta.url));
const checker = fileURLToPath(new URL("./bfs-certificate.mjs", import.meta.url));

function run(command, args, input) {
  const result = spawnSync(command, args, {
    input, timeout: 7000, killSignal: "SIGKILL", maxBuffer: 65536, windowsHide: true, shell: false
  });
  if (result.error) throw result.error;
  return result;
}

describe("BFS producer certificate gate", () => {
  let emitted;
  let graph;
  beforeAll(() => {
    const graphBytes = readFileSync(source);
    graph = JSON.parse(graphBytes.toString("utf8"));
    const generated = run("python", ["-I", producer], graphBytes);
    expect(generated.status, generated.stderr.toString("utf8")).toBe(0);
    emitted = generated.stdout;
  });

  function check(input, expectedExit) {
    const result = run(process.execPath, [checker, "-"], input);
    const stdout = result.stdout.toString("utf8");
    expect(result.status, result.stderr.toString("utf8") || stdout).toBe(expectedExit);
    const report = JSON.parse(stdout);
    expect(report.schema_version).toBe("truth-harness.bfs-certificate-report.v0");
    expect(report.proof_checker_backed).toBe(false);
    expect(report).not.toHaveProperty("trust");
    if (expectedExit !== 2) {
      expect(report.request_sha256).toBe(createHash("sha256").update(input).digest("hex"));
    }
    return report;
  }

  it("accepts the Python program's unchanged stdout through the Node CLI", () => {
    expect(JSON.parse(emitted.toString("utf8"))).toEqual({
      schema_version: "truth-harness.bfs-certificate.v0", ...graph,
      labels: [3, 1, 0, 1, 2, 4, null, null, null]
    });
    expect(check(emitted, 0)).toMatchObject({
      status: "accepted", source: 2, vertex_count: 9, edge_count: 12,
      labeled_count: 6, unlabeled_count: 3
    });
  });

  it.each([
    [5, 3, { condition: "predecessor", vertex: 5, label: 3, required_predecessor_label: 2 }],
    [0, 4, { condition: "edge_bound", reason: "bound_exceeded", edge_index: 5, from: 4, to: 0, from_label: 2, label: 4 }],
    [4, null, { condition: "edge_bound", reason: "unlabeled_successor", edge_index: 2, from: 1, to: 4, from_label: 1, label: null }]
  ])("rejects a well-formed corruption at vertex %i, label %s", (vertex, label, failure) => {
    const corrupted = JSON.parse(emitted.toString("utf8"));
    corrupted.labels[vertex] = label;
    expect(check(Buffer.from(JSON.stringify(corrupted)), 1)).toMatchObject({ status: "rejected", failure });
  });

  it("distinguishes producer format drift from a rejected certificate", () => {
    const changed = JSON.parse(emitted.toString("utf8"));
    delete changed.labels;
    const report = check(Buffer.from(JSON.stringify(changed)), 2);
    expect(report.status).toBe("invalid");
    expect(report.error).toMatch(/labels/);
    expect(report).not.toHaveProperty("failure");
  });

  it("lets the checker diagnose malformed encoding without rewriting the input bytes", () => {
    const report = check(Buffer.concat([emitted, Buffer.from([0xff])]), 2);
    expect(report.status).toBe("invalid");
    expect(report.error).toMatch(/utf-8/i);
  });
});

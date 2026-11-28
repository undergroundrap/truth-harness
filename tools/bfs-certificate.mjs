import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { boundedInput } from "./pit-witness.mjs";
import { parseUniqueJson } from "./unique-json.mjs";

const requestVersion = "truth-harness.bfs-certificate.v0";
const reportVersion = "truth-harness.bfs-certificate-report.v0";
const natural = z.number().int().min(0);
const requestSchema = z.strictObject({
  schema_version: z.literal(requestVersion),
  vertex_count: natural.min(1).max(4096),
  source: natural,
  edges: z.array(z.tuple([natural, natural])).max(8192),
  labels: z.array(natural.nullable()).max(4096)
});
const report = fields => ({
  schema_version: reportVersion, scope: "unit-edge-distance-certificate-conditions",
  proof_checker_backed: false, ...fields
});

function readRequest(raw) {
  const value = parseUniqueJson(raw, { naturalNumbersOnly: true });
  if (value !== null && typeof value === "object" && !Array.isArray(value) &&
      Object.keys(value).some(key => !Object.hasOwn(requestSchema.shape, key))) {
    throw new Error("Invalid BFS certificate input at $ (unrecognized_keys)");
  }
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(`Invalid BFS certificate input at ${first.path.join(".") || "$"} (${first.code})`);
  }
  const input = parsed.data;
  if (input.labels.length !== input.vertex_count) throw new Error("labels must have one entry per vertex");
  if (input.source >= input.vertex_count) throw new Error("source must be a vertex");
  for (const [i, [from, to]] of input.edges.entries()) {
    if (from >= input.vertex_count || to >= input.vertex_count) throw new Error(`edges.${i} must name existing vertices`);
  }
  return input;
}

export function checkBfsCertificate(raw) {
  const { vertex_count, source, edges, labels } = readRequest(raw);
  const context = {
    request_sha256: createHash("sha256").update(raw).digest("hex"),
    vertex_count, edge_count: edges.length, source
  };
  const reject = failure => report({ status: "rejected", ...context, failure });

  if (labels[source] !== 0) {
    return reject({ condition: "source_zero", vertex: source, label: labels[source], expected: 0 });
  }
  for (let vertex = 0; vertex < vertex_count; vertex += 1) {
    if (vertex !== source && labels[vertex] === 0) {
      return reject({ condition: "zero_is_source", vertex, label: 0 });
    }
  }

  const hasPredecessor = new Uint8Array(vertex_count);
  for (const [edge_index, [from, to]] of edges.entries()) {
    const fromLabel = labels[from];
    const label = labels[to];
    if (fromLabel === null) continue;
    if (label === null || label - fromLabel > 1) {
      return reject({
        condition: "edge_bound", reason: label === null ? "unlabeled_successor" : "bound_exceeded",
        edge_index, from, to, from_label: fromLabel, label
      });
    }
    if (label > 0 && fromLabel === label - 1) hasPredecessor[to] = 1;
  }

  let labeled_count = 0;
  for (const [vertex, label] of labels.entries()) {
    if (label === null) continue;
    if (label > 0 && !hasPredecessor[vertex]) {
      return reject({ condition: "predecessor", vertex, label, required_predecessor_label: label - 1 });
    }
    labeled_count += 1;
  }
  return report({ status: "accepted", ...context, labeled_count, unlabeled_count: vertex_count - labeled_count });
}

const main = import.meta.main ?? (process.argv[1] &&
  await realpath(process.argv[1]).catch(() => null) === await realpath(fileURLToPath(import.meta.url)));
if (main) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 || args[0].startsWith("--")) {
      throw new Error("Usage: bfs-certificate.mjs <request.json|->");
    }
    const result = checkBfsCertificate(await boundedInput(args[0]));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "accepted" ? 0 : 1;
  } catch (error) {
    console.log(JSON.stringify(report({ status: "invalid", error: error.message }), null, 2));
    process.exitCode = 2;
  }
}

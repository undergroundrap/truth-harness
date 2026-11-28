import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { checkBfsCertificate } from "./bfs-certificate.mjs";
import { boundedInput } from "./pit-witness.mjs";
import { parseUniqueJson } from "./unique-json.mjs";

const suiteFile = new URL("../fixtures/cs-proof-reuse/suite.json", import.meta.url);
const scoreFile = new URL(import.meta.url);
const replayFile = new URL("./cs-proof-reuse-replay.mjs", import.meta.url);
const verifierInputs = ["package-lock.json", "tools/bfs-certificate.mjs", "tools/pit-witness.mjs",
  "tools/unique-json.mjs", "tools/lean-prefix-check.mjs", "tools/lean-prefix-check.Dockerfile"];
const arms = ["without_artifacts", "with_artifacts"];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const natural = z.number().int().min(0).max(4095);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const dockerId = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const certificateLabels = z.array(natural.nullable()).max(64).nullable();
const invalidNumber = Symbol("noncanonical number in agent response");
const responseSchema = z.strictObject({
  verdict: z.enum(["solved", "refuted", "unknown"]),
  values: z.array(z.string().max(64).regex(/^(?:0|-?[1-9][0-9]*)$/).nullable()).max(32),
  labels: z.unknown().optional(),
  witness: z.array(natural).max(64).nullable(),
  model: z.enum(["unit_edge_walks", "integer_slices", "none"]),
  artifact: z.string().max(12).nullable(),
  reason: z.string().trim().min(1).max(400)
});
const packetSchema = z.strictObject({
  schema_version: z.literal("truth-harness.cs-proof-reuse-trials.v3"),
  suite_sha256: digest,
  scoring_sha256: digest,
  replay_sha256: digest,
  verifier_inputs_sha256: digest,
  proof_image_id: dockerId,
  bindings: z.array(z.strictObject({
    arm: z.enum(arms), case_id: z.string().max(50), prompt_sha256: digest,
    response: z.string().nullable()
  })).max(20)
});

function modelGraph(kind, data) {
  if (kind !== "multi_source") return {
    vertex_count: data.vertex_count, source: data.source, edges: data.edges
  };
  return { vertex_count: data.vertex_count + 1, source: data.vertex_count,
    edges: [...data.depots.map(depot => [data.vertex_count, depot]), ...data.edges] };
}

// Use bounded edge relaxation from the previous round, not the producer or certificate checker.
function referenceDistances({ vertex_count, source, edges }) {
  let distance = Array(vertex_count).fill(Infinity);
  distance[source] = 0;
  for (let round = 1; round < vertex_count; round += 1) {
    const next = [...distance];
    for (const [from, to, cost = 1] of edges) next[to] = Math.min(next[to], distance[from] + cost);
    distance = next;
  }
  return distance.map(n => Number.isFinite(n) ? n : null);
}

function pathCost(path, source, target, edges) {
  if (!path || path.length < 2 || path[0] !== source || path.at(-1) !== target) return null;
  let cost = 0;
  for (let i = 1; i < path.length; i += 1) {
    const edge = edges.find(([from, to]) => from === path[i - 1] && to === path[i]);
    if (!edge) return null;
    cost += edge[2] ?? 1;
  }
  return cost;
}

export function verifyReferences(suite) {
  assert.equal(suite.schema_version, "truth-harness.cs-proof-reuse-suite.v3");
  assert.equal(new Set(suite.cases.map(item => item.id)).size, suite.cases.length);
  for (const { kind, input, expected } of suite.cases) {
    if (kind === "ranges") {
      for (const [lo, hi] of input.ranges) assert.ok(0 <= lo && lo <= hi && hi <= input.entries.length);
      assert.deepEqual(expected.values, input.ranges.map(([lo, hi]) =>
        String(input.entries.slice(lo, hi).reduce((sum, n) => sum + BigInt(n), 0n))));
    } else if (kind === "weighted_decline") {
      const best = referenceDistances(input)[input.target];
      assert.ok(best < pathCost(input.proposed_route, input.source, input.target, input.edges));
      assert.deepEqual(expected.values, [String(best)]);
    } else {
      const labels = referenceDistances(modelGraph(kind, input));
      assert.deepEqual(expected.labels, labels);
      if (kind === "false_bound") assert.ok(labels[input.target] < input.claimed_minimum);
      const queries = input.queries ?? [input.target];
      assert.deepEqual(expected.values, queries.map(q => labels[q] === null
        ? null : String(labels[q] - (kind === "multi_source" ? 1 : 0))));
    }
  }
}

export function formatPrompt(suite, item, arm) {
  const choices = arm === "with_artifacts" ? suite.catalog.map(({ id, summary }) => ({ id, summary })) : [];
  return `${suite.protocol.instructions}\n\nProblem: ${item.task}\nInput: ${JSON.stringify(item.input)}\nCandidate summaries: ${JSON.stringify(choices)}`;
}

function checkWitness({ kind, input }, response) {
  if (kind !== "weighted_decline" && kind !== "false_bound") return null;
  const cost = pathCost(response.witness, input.source, input.target, input.edges);
  const upper = kind === "weighted_decline" ? pathCost(input.proposed_route, input.source, input.target, input.edges)
    : input.claimed_minimum;
  return { status: cost !== null && cost < upper ? "accepted" : "rejected", cost, must_be_below: upper };
}

function checkInstance({ kind, input }, response, witness) {
  const certificate = certificateLabels.safeParse(response.labels);
  if (!certificate.success) return { status: "rejected", check: "invalid-or-missing-certificate-field" };
  const labels = certificate.data;
  if (kind === "weighted_decline") return { status: witness.status === "accepted" && response.labels === null &&
    equal(response.values, [String(witness.cost)]) ? "accepted" : "rejected", check: "weighted-counterexample" };
  if (kind === "ranges") {
    const prefix = [0n];
    for (const entry of input.entries) prefix.push(prefix.at(-1) + BigInt(entry));
    const values = input.ranges.map(([lo, hi]) => String(prefix[hi] - prefix[lo]));
    return { status: equal(response.values, values) && labels === null ? "accepted" : "rejected",
      check: "exact-prefix-differences", values };
  }
  if (!labels) return { status: "rejected", check: "missing-distance-labels" };
  const graph = modelGraph(kind, input);
  const request = JSON.stringify({ schema_version: "truth-harness.bfs-certificate.v0", ...graph, labels });
  try {
    const receipt = checkBfsCertificate(request);
    return { status: receipt.status === "accepted" && witness?.status !== "rejected" ? "accepted" : "rejected",
      check: "distance-certificate", receipt };
  } catch {
    return { status: "rejected", check: "invalid-distance-labels" };
  }
}

function parseResponse(raw) {
  parseUniqueJson(raw);
  // Keep bad certificate numbers invalid without rounding them or rejecting the independent answer.
  const decoded = JSON.parse(raw, (_key, value, context) => typeof value === "number" &&
    !/^(?:0|[1-9][0-9]*)$/.test(context?.source ?? "") ? invalidNumber : value);
  return responseSchema.parse(decoded);
}

export function scorePacket(suite, bindings, packet) {
  verifyReferences(suite);
  const parsed = packetSchema.parse(packet);
  assert.equal(parsed.suite_sha256, bindings.suite_sha256, "Suite changed since freeze");
  assert.equal(parsed.scoring_sha256, bindings.scoring_sha256, "Scorer changed since freeze");
  assert.equal(parsed.replay_sha256, bindings.replay_sha256, "Replay runner changed since freeze");
  assert.equal(parsed.verifier_inputs_sha256, bindings.verifier_inputs_sha256, "Verifier inputs changed since freeze");
  assert.equal(parsed.bindings.length, suite.cases.length * arms.length, "Incomplete or extra trials");
  const results = [];
  for (const item of suite.cases) {
    for (const arm of arms) {
      const rows = parsed.bindings.filter(row => row.case_id === item.id && row.arm === arm);
      assert.equal(rows.length, 1, `Expected exactly one ${item.id}/${arm} response`);
      const row = rows[0];
      assert.equal(row.prompt_sha256, sha(formatPrompt(suite, item, arm)), "Prompt changed since freeze");
      const { expected } = item;
      const base = { case_id: item.id, arm, expected_verdict: expected.verdict,
        proof_applicable: expected.artifact !== null, answer_correct: false,
        reference_matched: false, assumptions_matched: false, replay_candidate: null };
      if (row.response && Buffer.byteLength(row.response) > suite.protocol.response_max_bytes) {
        results.push({ ...base, response_status: "oversized", instance: { status: "not_checked" } });
        continue;
      }
      let response;
      try {
        assert.ok(row.response);
        response = parseResponse(row.response);
      } catch {
        results.push({ ...base, response_status: "invalid_or_missing", instance: { status: "not_checked" } });
        continue;
      }
      const offered = arm === "with_artifacts" && suite.catalog.some(candidate => candidate.id === response.artifact);
      const witness = checkWitness(item, response);
      const instance = checkInstance(item, response, witness);
      const correctValues = item.kind === "weighted_decline" ? equal(response.values, [String(witness.cost)])
        : equal(response.values, expected.values);
      const assumptionsMatched = response.model === expected.model &&
        (expected.artifact !== null || response.artifact === null);
      const discovered = offered && response.artifact === expected.artifact;
      const answerCorrect = response.verdict === expected.verdict && correctValues && witness?.status !== "rejected";
      results.push({ ...base, response_status: "parsed",
        answer_correct: answerCorrect,
        reference_matched: discovered, assumptions_matched: assumptionsMatched,
        replay_candidate: discovered && assumptionsMatched && answerCorrect && instance.status === "accepted" ? response.artifact : null,
        actual_verdict: response.verdict, instance, ...(witness ? { witness } : {}) });
    }
  }
  return { ...bindings, proof_image_id: parsed.proof_image_id, results };
}

async function main() {
  const [suiteBytes, scorerBytes, replayBytes] = await Promise.all([readFile(suiteFile), readFile(scoreFile), readFile(replayFile)]);
  const suite = parseUniqueJson(suiteBytes.toString("utf8"));
  verifyReferences(suite);
  const verifierHashes = await Promise.all(verifierInputs.map(async file =>
    [file, sha(await readFile(new URL(`../${file}`, import.meta.url)))]));
  const bindings = { suite_sha256: sha(suiteBytes), scoring_sha256: sha(scorerBytes), replay_sha256: sha(replayBytes),
    verifier_inputs_sha256: sha(JSON.stringify(verifierHashes)) };
  const args = process.argv.slice(2);
  if (args[0] === "plan" && args.length === 2) {
    return { ...bindings, proof_image_id: dockerId.parse(args[1]), bindings: suite.cases.flatMap(item => arms.map(arm => {
      const prompt = formatPrompt(suite, item, arm);
      return { case_id: item.id, arm, prompt_sha256: sha(prompt), prompt };
    })) };
  }
  assert.ok(equal(args, ["score", "-"]), "Usage: cs-proof-reuse.mjs plan <proof-image-id> | score -");
  return scorePacket(suite, bindings, parseUniqueJson(await boundedInput("-")));
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => null) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(await main(), null, 2) + "\n"); }
  catch (error) {
    process.stderr.write(`Benchmark input invalid: ${error.message}\n`);
    process.exitCode = 2;
  }
}

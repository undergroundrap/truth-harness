import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatPrompt, scorePacket, verifyReferences } from "./cs-proof-reuse.mjs";
import { summarize, validateProofReceipt, validateRegistration } from "./cs-proof-reuse-replay.mjs";

const suite = JSON.parse(readFileSync(new URL("../fixtures/cs-proof-reuse/suite.json", import.meta.url)));
const sha = value => createHash("sha256").update(value).digest("hex");
const frozen = { suite_sha256: "1".repeat(64), scoring_sha256: "2".repeat(64), replay_sha256: "3".repeat(64),
  verifier_inputs_sha256: "4".repeat(64), proof_image_id: `sha256:${"5".repeat(64)}` };
const arms = ["without_artifacts", "with_artifacts"];

function packet(change = () => {}) {
  return { schema_version: "truth-harness.cs-proof-reuse-trials.v3", ...frozen,
    bindings: suite.cases.flatMap(item => arms.map(arm => {
      const response = { ...structuredClone(item.expected), artifact: arm === "with_artifacts" ? item.expected.artifact : null,
        witness: item.kind === "false_bound" ? [0,2,4,8] : item.kind === "weighted_decline" ? [0,1,2,3] : null,
        reason: "Fixture response for testing the scoring dimensions." };
      change(item, arm, response);
      return { case_id: item.id, arm, prompt_sha256: sha(formatPrompt(suite, item, arm)), response: JSON.stringify(response) };
    })) };
}

describe("CS proof-reuse benchmark protocol", () => {
  it("checks frozen reference evidence and hides verdicts and theorem names from prompts", () => {
    expect(() => verifyReferences(suite)).not.toThrow();
    const corrupted = structuredClone(suite);
    corrupted.cases[0].expected.labels[0] = 0;
    expect(() => verifyReferences(corrupted)).toThrow();
    for (const item of suite.cases) {
      const control = formatPrompt(suite, item, arms[0]);
      const reuse = formatPrompt(suite, item, arms[1]);
      expect(control).toBe(reuse.replace(/Candidate summaries: .*$/u, "Candidate summaries: []"));
      for (const artifact of suite.catalog) expect(reuse).not.toContain(artifact.theorem);
    }
  });

  it("separates a correct answer from instance checks and proof eligibility", () => {
    const { results } = scorePacket(suite, frozen, packet());
    expect(summarize(results)).toMatchObject({ without_artifacts: { answers_correct: 5, references_matched: 0, references_replayed: 0 },
      with_artifacts: { answers_correct: 5, references_matched: 4, references_replayed: 0 } });
    expect(results.filter(row => row.replay_candidate).map(row => row.replay_candidate)).toEqual(["C42", "C42", "C17", "C42"]);
    expect(results.filter(row => row.case_id === "weighted-transfer-mismatch").every(row => !row.proof_applicable)).toBe(true);
  });

  it("does not replay a scope mismatch, guessed control ID, unchecked certificate or fabricated refutation", () => {
    const { results } = scorePacket(suite, frozen, packet((item, arm, response) => {
      if (arm === "without_artifacts") response.artifact = item.expected.artifact;
      if (item.kind === "weighted_decline") response.artifact = "C42";
      if (item.kind === "false_bound") response.witness = [0,8];
      if (item.kind === "multi_source") response.labels[9] = 1;
    }));
    expect(results.filter(row => row.arm === "without_artifacts").every(row => !row.reference_matched)).toBe(true);
    expect(results.filter(row => row.replay_candidate)).toHaveLength(2);
    expect(results.filter(row => row.case_id === "weighted-transfer-mismatch").every(row => !row.assumptions_matched)).toBe(true);
    expect(results.filter(row => row.case_id === "false-latency-floor").every(row => !row.answer_correct)).toBe(true);
    expect(results.find(row => row.case_id === "nearest-depot").instance.status).toBe("rejected");
  });

  it("scores a valid refutation even when its extra certificate is missing or invalid", () => {
    const { results } = scorePacket(suite, frozen, packet((item, arm, response) => {
      if (item.kind === "false_bound") {
        if (arm === "with_artifacts") delete response.labels;
        else response.labels = [0, -1];
      }
      if (item.kind === "weighted_decline") response.labels = arm === "with_artifacts" ? [0] : "malformed";
    }));
    const refutations = results.filter(row => row.expected_verdict === "refuted");
    expect(refutations).toHaveLength(4);
    for (const row of refutations) expect(row).toMatchObject({ answer_correct: true,
      witness: { status: "accepted" }, instance: { status: "rejected" }, replay_candidate: null });
  });

  it("requires matching preregistration proof identity and exact frozen prompt bytes", () => {
    const input = packet();
    const registered = { ...frozen, bindings: input.bindings.map(({ case_id, arm, prompt_sha256 }) =>
      ({ case_id, arm, prompt_sha256, prompt: formatPrompt(suite, suite.cases.find(item => item.id === case_id), arm) })) };
    expect(() => validateRegistration(registered, input)).not.toThrow();
    expect(() => validateRegistration(registered, { ...input, proof_image_id: `sha256:${"a".repeat(64)}` }))
      .toThrow("preregistered proof_image_id");
    registered.bindings[0].prompt += " ";
    expect(() => validateRegistration(registered, input)).toThrow("Preregistered prompt bytes differ");
  });

  it("does not round malformed certificate or witness literals into valid integers", () => {
    const input = packet();
    const row = input.bindings.find(r => r.case_id === "false-latency-floor" && r.arm === "with_artifacts");
    const read = () => scorePacket(suite, frozen, input).results.find(r => r.case_id === row.case_id && r.arm === row.arm);
    const raw = row.response;
    row.response = raw.replace('"labels":[0,1,', '"labels":[0,1.0000000000000000001,');
    expect(read()).toMatchObject({ answer_correct: true, witness: { status: "accepted" },
      instance: { status: "rejected" }, replay_candidate: null });
    row.response = raw.replace('"witness":[0,2,', '"witness":[0,2.0000000000000000001,');
    expect(read()).toMatchObject({ answer_correct: false, response_status: "invalid_or_missing", replay_candidate: null });
  });

  it("keeps oversized responses as per-row failures under the independent packet bound", () => {
    const input = packet();
    input.bindings[0].response = "!".repeat(5000);
    input.bindings[1].response = "\u00e9".repeat(1025);
    const { results } = scorePacket(suite, frozen, input);
    expect(results.slice(0, 2).map(row => row.response_status)).toEqual(["oversized", "oversized"]);
    expect(results.slice(2).every(row => row.answer_correct)).toBe(true);
  });

  it("keeps invalid attempts and refuses changed or missing trial bindings", () => {
    const input = packet();
    input.bindings[0].response = input.bindings[0].response.replace('{', '{"verdict":"solved",');
    expect(scorePacket(suite, frozen, input).results[0].response_status).toBe("invalid_or_missing");
    expect(() => scorePacket(suite, frozen, { ...input, scoring_sha256: frozen.suite_sha256 })).toThrow("Scorer changed");
    expect(() => scorePacket(suite, frozen, { ...input, verifier_inputs_sha256: frozen.suite_sha256 })).toThrow("Verifier inputs changed");
    input.bindings[0].prompt_sha256 = frozen.suite_sha256;
    expect(() => scorePacket(suite, frozen, input)).toThrow("Prompt changed");
    input.bindings.pop();
    expect(() => scorePacket(suite, frozen, input)).toThrow("Incomplete or extra trials");
  });

  it("cannot turn a submitted receipt-shaped object into a replay", () => {
    const input = packet();
    input.bindings[1].response = JSON.stringify({ ...JSON.parse(input.bindings[1].response),
      receipt: { status: "accepted", trust: "proved" } });
    expect(scorePacket(suite, frozen, input).results[1].response_status).toBe("invalid_or_missing");
    expect(() => validateProofReceipt(suite.catalog[1], { status: "accepted", proof_checker_backed: true })).toThrow();
  });
});

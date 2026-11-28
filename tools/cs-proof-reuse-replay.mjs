import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fixture = path => readFileSync(new URL(`../fixtures/cs-proof-reuse/${path}`, import.meta.url));
const permitted = ["propext", "Quot.sound", "Classical.choice"];
const offline = ["run", "--pull=never", "--rm", "--network", "none", "--read-only",
  "--cap-drop", "ALL", "--security-opt", "no-new-privileges"];

function dockerJson(args, input) {
  const run = spawnSync("docker", args, { input, encoding: "utf8", timeout: 90_000, maxBuffer: 256 * 1024 });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, (run.stderr || run.stdout || "Docker command failed").trim().slice(0, 1200));
  return JSON.parse(run.stdout);
}

function imageId(reference) {
  const images = dockerJson(["image", "inspect", reference]);
  assert.equal(images.length, 1);
  assert.match(images[0].Id, /^sha256:[0-9a-f]{64}$/);
  return images[0].Id;
}

export function validateProofReceipt(candidate, receipt, load = filename => readFileSync(
  new URL(`../docs/examples/lean-${candidate.preset}-check/${filename}`, import.meta.url))) {
  const { preset, theorem } = candidate;
  assert.ok(preset === "bfs" || preset === "prefix", "Unknown fixed Lean preset");
  assert.equal(receipt.schema_version, `truth-harness.lean-${preset}-check.v0`);
  assert.equal(receipt.status, "accepted");
  assert.equal(receipt.trust, "proved");
  assert.equal(receipt.proof_checker_backed, true);
  assert.equal(receipt.theorem, theorem);
  assert.equal(receipt.lean_version, "4.36.0");
  assert.equal(receipt.checker, "lake comparator");
  assert.deepEqual(receipt.kernels, ["lean", "nanoda"]);
  assert.deepEqual(receipt.permitted_axioms, permitted);
  assert.equal(receipt.challenge_sha256, sha(load("Challenge.lean")));
  assert.equal(receipt.solution_sha256, sha(load("Solution.lean")));
  assert.equal(receipt.lake_config_sha256, sha(load("lakefile.toml")));
  if (preset === "bfs") assert.deepEqual(receipt.model_file_sha256, { "BfsModel.lean": sha(load("BfsModel.lean")) });
  assert.equal(receipt.comparator_config_sha256, sha(JSON.stringify({
    challenge_module: "Challenge", solution_module: "Solution", theorem_names: [theorem],
    permitted_axioms: permitted, external_kernels: { nanoda: ["/opt/lean/bin/nanoda_bin"] }
  }) + "\n"));
  assert.deepEqual(receipt.negative_controls, {
    different_statement: { status: "rejected", reason: "statement_mismatch" },
    unfinished_proof: { status: "rejected", reason: "forbidden_axiom" }
  });
}

export function summarize(rows) {
  return Object.fromEntries(["without_artifacts", "with_artifacts"].map(arm => {
    const selected = rows.filter(row => row.arm === arm);
    const count = predicate => selected.filter(predicate).length;
    return [arm, {
      cases: selected.length,
      proof_applicable_cases: count(row => row.proof_applicable),
      answers_correct: count(row => row.answer_correct),
      assumptions_matched: count(row => row.assumptions_matched),
      instances_accepted: count(row => row.instance.status === "accepted"),
      references_matched: count(row => row.reference_matched),
      references_replayed: count(row => row.replay === "reference_replayed")
    }];
  }));
}

export function validateRegistration(registered, trial) {
  for (const field of ["suite_sha256", "scoring_sha256", "replay_sha256", "verifier_inputs_sha256", "proof_image_id"]) {
    assert.equal(trial[field], registered[field], `Packet does not match preregistered ${field}`);
  }
  assert.match(registered.proof_image_id, /^sha256:[0-9a-f]{64}$/);
  const bind = ({ arm, case_id, prompt_sha256 }) => ({ arm, case_id, prompt_sha256 });
  assert.deepEqual(trial.bindings.map(bind), registered.bindings.map(row => {
    assert.equal(sha(row.prompt), row.prompt_sha256, "Preregistered prompt bytes differ");
    return bind(row);
  }), "Packet does not match preregistered prompts and ordering");
}

function run(planBytes, packet, judgeImage, proofOverride) {
  const registered = JSON.parse(planBytes);
  validateRegistration(registered, JSON.parse(packet));
  const proofImage = proofOverride ?? registered.proof_image_id;
  for (const image of [judgeImage, proofImage]) assert.match(image, /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/);
  const suiteBytes = fixture("suite.json");
  const suite = JSON.parse(suiteBytes);
  const judgeId = imageId(judgeImage);
  const scored = dockerJson([...offline, "-i", judgeId, "node", "tools/cs-proof-reuse.mjs", "score", "-"], packet);
  assert.equal(scored.suite_sha256, sha(suiteBytes), "Judge image has a different suite");
  assert.equal(scored.scoring_sha256, sha(readFileSync(new URL("./cs-proof-reuse.mjs", import.meta.url))), "Judge image has a different scorer");
  assert.equal(scored.replay_sha256, sha(readFileSync(new URL(import.meta.url))), "Judge image has a different replay runner");
  assert.equal(scored.verifier_inputs_sha256, registered.verifier_inputs_sha256, "Judge did not attest the registered verifier inputs");
  assert.equal(scored.proof_image_id, registered.proof_image_id, "Judge used a different proof-image preregistration");

  const needed = new Set(scored.results.map(row => row.replay_candidate).filter(Boolean));
  const artifacts = {};
  let proofId = null;
  for (const candidate of suite.catalog.filter(entry => needed.has(entry.id))) {
    try {
      proofId ??= imageId(proofImage);
      assert.equal(proofId, registered.proof_image_id, "Replay proof image differs from the preregistered proof image");
      const receipt = dockerJson([...offline, "--init", "--pids-limit", "64", "--memory", "1g", "--memory-swap", "1g",
        "--tmpfs", "/tmp:rw,nosuid,nodev,size=128m", proofId,
        ...(candidate.preset === "bfs" ? ["--bfs"] : []), "--self-test"]);
      validateProofReceipt(candidate, receipt);
      artifacts[candidate.id] = { status: "replayed", receipt };
    } catch (error) {
      artifacts[candidate.id] = { status: "unverified", error: error.message };
    }
  }
  const results = scored.results.map(row => ({ ...row, replay: !row.proof_applicable ? "not_applicable"
    : row.replay_candidate ? (artifacts[row.replay_candidate]?.status === "replayed" ? "reference_replayed" : "unverified")
      : "no_eligible_request" }));
  const proofReplay = !needed.size ? "not_requested" : results.some(row => row.replay === "unverified") ? "incomplete" : "accepted";
  return { schema_version: "truth-harness.cs-proof-reuse-report.v3", status: "scored", proof_replay_status: proofReplay,
    image_ids: { judge: judgeId, proof: proofId }, registration_sha256: sha(planBytes), packet_sha256: sha(packet),
    ...scored, results, artifacts, summary: summarize(results) };
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => null) === fileURLToPath(import.meta.url)) {
  try {
    const [planPath, packetPath, judgeImage = "truth-harness:cs-proof-reuse-judge", proofOverride, ...extra] = process.argv.slice(2);
    assert.ok(planPath && packetPath && extra.length === 0,
      "Usage: cs-proof-reuse-replay.mjs <plan.json> <trials.json> [judge-image] [proof-image]");
    const plan = readFileSync(planPath);
    const packet = readFileSync(packetPath);
    assert.ok(plan.length <= 64 * 1024 && packet.length <= 64 * 1024, "Registration or trial packet exceeds 64 KiB");
    const report = run(plan, packet, judgeImage, proofOverride);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (report.proof_replay_status === "incomplete") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`Benchmark replay failed: ${error.message}\n`);
    process.exitCode = 2;
  }
}

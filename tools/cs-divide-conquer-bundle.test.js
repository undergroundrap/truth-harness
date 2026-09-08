import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, it } from "vitest";

const script = fileURLToPath(new URL("./cs-divide-conquer-bundle.mjs", import.meta.url));
const run = (args, env = process.env) => spawnSync(process.execPath, [script, ...args], { env, encoding: "utf8", timeout: 30000, windowsHide: true });
const hash = raw => createHash("sha256").update(raw).digest("hex");
beforeAll(() => {
  if (process.env.TRUTH_HARNESS_REQUIRE_DOCKER_TESTS === "1") expect(process.env.TRUTH_HARNESS_CONTAINER).toBe("1");
});
it("replays a portable bundle without trusting metadata, missing steps or altered evidence", () => {
  expect(run([], { ...process.env, TRUTH_HARNESS_CONTAINER: "" }).status).toBe(2);
  if (process.env.TRUTH_HARNESS_CONTAINER !== "1") return;
  const created = run([]);
  expect(created.status, created.stdout + created.stderr).toBe(0);
  const report = JSON.parse(created.stdout);
  const root = mkdtempSync(join(tmpdir(), "divide conquer bundle "));
  try {
    const dir = join(root, "moved bundle");
    cpSync(report.artifact_directory, dir, { recursive: true });
    const manifest = join(dir, "bundle.json"), original = readFileSync(manifest, "utf8");
    const snapshot = () => readdirSync(dir).sort().map(name => [name, readFileSync(join(dir, name), "hex")]);
    const before = snapshot();
    // Cached success/failure reports have no authority on replay.
    writeFileSync(join(dir, "report.json"), "not a valid cached report");
    const untrustedSnapshot = snapshot();
    const replay = run(["--check", manifest]);
    expect(replay.status, replay.stdout + replay.stderr).toBe(0);
    const checked = JSON.parse(replay.stdout);
    expect(checked).toMatchObject({ status: "replayed", checked: true, proof_checker_backed: false, evidence_scope: "three-supplied-requests-only" });
    expect(checked.steps).toHaveLength(3);
    expect(checked.remaining_assumptions).toHaveLength(4);
    expect(checked.steps.map(step => step.replay.receipt_sha256)).toEqual(report.steps.map(step => step.replay.receipt_sha256));
    expect(snapshot()).toEqual(untrustedSnapshot);
    const reject = () => {
      const failed = run(["--check", manifest]);
      expect(failed.status, failed.stdout + failed.stderr).toBe(2);
      expect(JSON.parse(failed.stdout)).toMatchObject({ status: "unverified", checked: false });
    };
    for (const mutate of [
      b => { b.schema_version = "unknown"; },
      b => { b.steps.pop(); },
      b => { b.steps[1] = b.steps[0]; },
      b => { b.steps[2].depends_on = []; },
      b => { b.steps[0].operation = "recurrence"; },
      b => { b.steps[0].request = "../outside.json"; },
      b => { b.proved = true; }
    ]) {
      const bundle = JSON.parse(original); mutate(bundle);
      writeFileSync(manifest, JSON.stringify(bundle)); reject();
    }
    writeFileSync(manifest, original);
    const receipt = join(dir, "recurrence.receipt.json"), savedReceipt = readFileSync(receipt);
    rmSync(receipt); reject();
    writeFileSync(receipt, "{}");
    const relabeled = JSON.parse(original);
    relabeled.steps[2].receipt_sha256 = hash("{}");
    writeFileSync(manifest, JSON.stringify(relabeled)); reject();
    writeFileSync(receipt, savedReceipt); writeFileSync(manifest, original);
    const request = join(dir, "recurrence.request.json"), savedRequest = readFileSync(request);
    const changed = JSON.parse(savedRequest); changed.initial_values = ["0", "2"];
    const changedRaw = JSON.stringify(changed); writeFileSync(request, changedRaw);
    relabeled.steps[2].request_sha256 = hash(changedRaw);
    writeFileSync(manifest, JSON.stringify(relabeled)); reject();
    writeFileSync(request, savedRequest); writeFileSync(manifest, original);
    // Same valid bytes outside the bundle must not bypass containment.
    const external = join(root, "outside.json"); writeFileSync(external, savedReceipt);
    rmSync(receipt); symlinkSync(external, receipt); reject();
    rmSync(receipt); writeFileSync(receipt, savedReceipt);
    writeFileSync(manifest, " ".repeat(65537)); reject();
    writeFileSync(manifest, original);
    expect(run(["--check", manifest]).status).toBe(0);
    expect(before.length).toBe(9);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);

import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PACKAGE_DIR, PROJECT, closeGate, inspectPackage, stagePilot } from "./proof-reuse-pilot.mjs";
import { createWorkspaceReview, createWorkspaceRunNextPlan, listValidationPlans, writeLeanProofCheckRecord } from "../packages/core/dist/index.js";

const roots = [];
async function root() {
  const path = await mkdtemp(join(tmpdir(), "truth harness proof reuse "));
  roots.push(path);
  return path;
}
async function packageCopy() {
  const path = await root();
  await cp(PACKAGE_DIR, path, { recursive: true });
  return path;
}
async function mutateManifest(path, mutate) {
  const file = join(path, "manifest.json");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  mutate(manifest);
  await writeFile(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("proof reuse pilot contract (no solver in these unit tests)", () => {
  it("has deterministic pins, six declarations and no metadata-to-proof upgrade", async () => {
    const first = await inspectPackage(PACKAGE_DIR, "Lean (version 4.12.0, release)");
    expect(await inspectPackage()).toEqual(first);
    expect(first.trust).toBe("unverified");
    expect(first.manifest.nodes).toHaveLength(6);
    expect(first.manifest.environment.mathlib).toBeNull();
  });
  it.each(["Scratch/Model.lean", "Scratch/Bound.lean", "Scratch/Final.lean", "lean-toolchain", "lakefile.lean"])("rejects changed bytes: %s", async (file) => {
    const path = await packageCopy();
    await writeFile(join(path, file), "-- changed\n", "utf8");
    await expect(inspectPackage(path)).rejects.toThrow("Changed source/environment");
  });
  it("rejects missing dependencies and cycles", async () => {
    const path = await packageCopy();
    await mutateManifest(path, (manifest) => { manifest.nodes[0].depends_on = ["missing"]; });
    await expect(inspectPackage(path)).rejects.toThrow("Missing dependency");
    await mutateManifest(path, (manifest) => { manifest.nodes[0].depends_on = ["leaf_cost"]; });
    await expect(inspectPackage(path)).rejects.toThrow("Dependency cycle");
  });
  it("rejects absent proof artifacts", async () => {
    const path = await packageCopy();
    await rm(join(path, "Scratch/Bound.lean"));
    await expect(inspectPackage(path)).rejects.toThrow();
  });
  it("rejects a different runtime version", async () => {
    await expect(inspectPackage(PACKAGE_DIR, "Lean (version 4.13.0)")).rejects.toThrow("Incompatible Lean environment");
  });
  it.each([
    (manifest) => { manifest.schema_version = "truth-harness.proof-reuse-pilot.v99"; },
    (manifest) => { manifest.remote_accepted = true; },
    (manifest) => { manifest.files[0].path = "../outside.lean"; },
    (manifest) => { manifest.nodes.push(manifest.nodes[0]); },
    (manifest) => { manifest.files[0] = manifest.files[1]; }
  ])("rejects unsupported metadata or malformed identity #%#", async (mutate) => {
    const path = await packageCopy();
    await mutateManifest(path, mutate);
    await expect(inspectPackage(path)).rejects.toThrow();
  });
  it.each(["\uFEFF", "\r\n"])("rejects nonportable manifest text #%#", async (prefix) => {
    const path = await packageCopy();
    const file = join(path, "manifest.json");
    await writeFile(file, prefix + await readFile(file, "utf8"), "utf8");
    await expect(inspectPackage(path)).rejects.toThrow("without BOM");
  });
  it("reopens the linked generic Lean blocker from disk, including space-containing paths", async () => {
    const path = await root();
    const staged = await stagePilot(path, "2026-09-06T00:00:00.000Z");
    const review = await createWorkspaceReview({ rootPath: path, now: "2026-09-06T00:01:00.000Z" });
    const next = await createWorkspaceRunNextPlan({ rootPath: path, review, executeLocal: false, now: "2026-09-06T00:01:00.000Z" });
    expect(next.item).toMatchObject({ kind: "validation-gate", validationGateKind: "proof", validationPlanId: staged.planId });
    expect(next.item.command).toContain("--declaration Scratch.scratch_bound");
    expect(next.item.command).toContain(`"${PROJECT}/Scratch/Bound.lean"`);
    expect(next.item.command).toContain(`--project "${PROJECT}"`);
    expect(next.execution.kind).toBe("dry-run");
    const plans = await listValidationPlans(path);
    expect(plans[0].gates.find((gate) => gate.kind === "proof").status).not.toBe("satisfied");
    await expect(inspectPackage(join(path, PROJECT))).rejects.toThrow();
  });
  it("blocks run-next admission but forwards the project and exact bytes for diagnostic compilation", async () => {
    const path = await root();
    await stagePilot(path, "2026-09-06T00:00:00.000Z");
    await cp(join(PACKAGE_DIR, "Scratch/Bound.lean"), join(path, PROJECT, "Scratch/Bound.lean"));
    const review = await createWorkspaceReview({ rootPath: path });
    const calls = [];
    const runner = (command, args, _timeout, options) => {
      calls.push({ command, args, cwd: options?.cwd, input: options?.input });
      return { status: 0, stdout: args[0] === "--version" ? "Lean (version 4.12.0)" : "", stderr: "" };
    };
    const next = await createWorkspaceRunNextPlan({ rootPath: path, review, executeLocal: true, proofRunner: runner });
    expect(next.status).toBe("blocked");
    expect(calls).toHaveLength(1);
    const diagnostic = await writeLeanProofCheckRecord({
      rootPath: path, projectPath: PROJECT, sourcePath: `${PROJECT}/Scratch/Bound.lean`, runner
    });
    expect(calls).toContainEqual({ command: "lake", args: ["env", "lean", "--stdin"], cwd: join(path, PROJECT), input: await readFile(join(path, PROJECT, "Scratch/Bound.lean"), "utf8") });
    expect(diagnostic.record.backend.command).toBe("lake");
    expect(diagnostic.record.replay).toContain(`--project "${PROJECT}"`);
    expect(diagnostic.record.trust).toBe("unverified");
  });
  it("refuses to reuse a persisted satisfied proof gate without fresh admission", async () => {
    const path = await root();
    const staged = await stagePilot(path, "2026-09-06T00:00:00.000Z");
    const plan = (await listValidationPlans(path)).find((candidate) => candidate.planId === staged.planId);
    plan.gates.find((gate) => gate.kind === "proof").status = "satisfied";
    await writeFile(join(path, ".truth-harness/validation", `${plan.createdAt.slice(0, 10)}-${plan.planId}.json`), JSON.stringify(plan) + "\n", "utf8");
    const [reopened] = await listValidationPlans(path);
    expect(reopened.gates.find((gate) => gate.kind === "proof").status).toBe("in-progress");
    await expect(closeGate(path, staged.planId)).rejects.toThrow(/independent (kernel\/axiom checker|checker)/u);
  });
});

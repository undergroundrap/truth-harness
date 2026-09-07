import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  addResearchSessionCheckpoint,
  initLocalWorkspace,
  listValidationPlans,
  writeResearchSession,
  writeValidationPlan
} from "../packages/core/dist/index.js";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PACKAGE_DIR = join(repo, "docs/examples/lean-proof-reuse");
export const PROJECT = "proof package";
const CLI = join(repo, "apps/cli/dist/index.js");
const paths = ["lean-toolchain", "lakefile.lean", "lake-manifest.json", "Scratch/Model.lean", "Scratch/Bound.lean", "Scratch/Final.lean"];
const manifestSchema = z.object({
  schema_version: z.literal("truth-harness.proof-reuse-pilot.v0"),
  package_id: z.literal("sequential-tree-scratch-v0"),
  provenance: z.object({ origin: z.literal("local-authored"), attribution: z.string().min(1), novelty: z.literal("known-model-bound-not-new-research") }).strict(),
  environment: z.object({ lean: z.literal("4.12.0"), mathlib: z.null(), dependencies: z.array(z.never()).length(0) }).strict(),
  assumptions: z.array(z.string().min(1)).min(1),
  files: z.array(z.object({ path: z.enum(paths), sha256: z.string().regex(/^[a-f0-9]{64}$/u) }).strict()).length(paths.length),
  nodes: z.array(z.object({ id: z.string().min(1), path: z.enum(paths.slice(3)), declaration: z.string().regex(/^Scratch\.[a-z_]+$/u), formal_statement: z.string().min(1), depends_on: z.array(z.string()) }).strict()).min(1),
  root: z.literal("budget_bound")
}).strict();

// This is a reviewed fixture pilot, not an arbitrary third-party Lean importer.
export async function inspectPackage(directory = PACKAGE_DIR, leanVersion) {
  const raw = await readFile(join(directory, "manifest.json"), "utf8");
  assert(!raw.startsWith("\uFEFF") && !raw.includes("\r"), "Manifest must be UTF-8 without BOM and use LF.");
  const manifest = manifestSchema.parse(JSON.parse(raw));
  assert.equal(new Set(manifest.files.map((file) => file.path)).size, paths.length, "Duplicate/missing files");
  const nodes = new Map(manifest.nodes.map((node) => [node.id, node]));
  assert.equal(nodes.size, manifest.nodes.length, "Duplicate nodes");
  assert(nodes.has(manifest.root), "Missing root");
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    assert(nodes.has(id), `Missing dependency: ${id}`);
    assert(!visiting.has(id), `Dependency cycle: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of nodes.get(id).depends_on) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of nodes.keys()) visit(id);
  for (const file of manifest.files) {
    const path = join(directory, file.path);
    assert((await lstat(path)).isFile(), `Not a regular file: ${file.path}`);
    const bytes = await readFile(path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, `Changed source/environment: ${file.path}`);
  }
  assert.equal(await readFile(join(directory, "lean-toolchain"), "utf8"), `leanprover/lean4:v${manifest.environment.lean}\n`);
  if (leanVersion !== undefined) {
    assert.equal(leanVersion.match(/\bversion (\d+\.\d+\.\d+)\b/u)?.[1], manifest.environment.lean, "Incompatible Lean environment");
  }
  return { manifest, manifest_sha256: createHash("sha256").update(raw).digest("hex"), trust: "unverified" };
}

export function declarationClaim(declaration, source) {
  return `Lean declaration ${declaration} in project ${PROJECT} source ${PROJECT}/${source}`;
}

export async function addProofGate(root, sessionId, declaration, source, now) {
  const written = await writeValidationPlan({
    rootPath: root,
    claim: declarationClaim(declaration, source),
    title: `Scratch reuse: ${declaration}`,
    objective: "Require local Lean evidence for this exact pinned declaration. Source metadata is not proof.",
    domains: ["math"],
    evidenceRefs: [{ kind: "session", ref: sessionId }, { kind: "artifact", ref: `${PROJECT}/manifest.json` }],
    now
  });
  await addResearchSessionCheckpoint({
    rootPath: root,
    sessionRef: sessionId,
    summary: `Open proof blocker: ${declaration}.`,
    evidenceRefs: [{ kind: "validation", ref: written.plan.planId }],
    nextChecks: [`Run workspace run-next; obtain scoped Lean evidence for ${declaration} before proceeding.`],
    now
  });
  return written.plan.planId;
}

export async function stagePilot(root, now = new Date().toISOString()) {
  const inspected = await inspectPackage();
  await initLocalWorkspace(root, { now });
  const project = join(root, PROJECT);
  await mkdir(join(project, "Scratch"), { recursive: true });
  for (const file of ["manifest.json", "lean-toolchain", "lakefile.lean", "lake-manifest.json", "Scratch/Model.lean", "Scratch/Final.lean"]) {
    await copyFile(join(PACKAGE_DIR, file), join(project, file));
  }
  // Deliberately withhold the dependency artifact to rehearse an interrupted handoff.
  const session = await writeResearchSession({
    rootPath: root,
    title: "Sequential tree scratch-space proof reuse",
    objective: "Replay the pinned scratch_bound dependency, then check budget_bound with no open proof assumptions.",
    domains: ["math"],
    evidenceRefs: [{ kind: "artifact", ref: `${PROJECT}/manifest.json`, summary: "Unverified local source package, not a receipt." }],
    tasks: ["Replay the missing scratch_bound dependency", "Check the budget theorem", "Write the assumptions and progress report"],
    now
  });
  const planId = await addProofGate(root, session.session.sessionId, "Scratch.scratch_bound", "Scratch/Bound.lean", now);
  return { ...inspected, sessionId: session.session.sessionId, planId };
}

function run(command, args, cwd, timeout = 60000) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true, shell: false });
  assert(!result.error, result.error?.message);
  assert.equal(result.status, 0, `${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function cli(root, args) {
  return JSON.parse(run(process.execPath, [CLI, ...args], root));
}

async function closeGate(root, planId) {
  const steps = [];
  for (let step = 0; step < 3; step += 1) {
    const plan = (await listValidationPlans(root)).find((plan) => plan.planId === planId);
    if (plan?.gates.some((gate) => gate.kind === "proof" && gate.status === "satisfied")) return steps;
    const next = cli(root, ["workspace", "run-next", root, "--json"]);
    assert.equal(next.item?.validationPlanId, planId, "run-next left the selected proof blocker");
    const result = cli(root, ["workspace", "run-next", root, "--execute-local", "--write", "--json"]);
    const execution = result.plan.execution;
    steps.push({ status: execution.status, kind: execution.kind, evidence_ref: execution.evidenceRef, summary: execution.summary });
    assert.equal(execution.status, "executed", execution.summary);
    const updated = (await listValidationPlans(root)).find((plan) => plan.planId === planId);
    if (updated?.gates.some((gate) => gate.kind === "proof" && gate.status === "satisfied")) return steps;
    if (execution.result?.proof?.trust !== "proved") throw new Error(`Proof remains unverified: ${execution.summary}`);
  }
  throw new Error("Proof gate did not close within the bounded three-step budget.");
}

export async function runPilot() {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Run this pilot in the network-disabled Docker service.");
  const parent = join(repo, ".truth-harness", "pilots");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, "scratch-reuse-"));
  const createdAt = new Date().toISOString();
  const report = { schema_version: "truth-harness.proof-reuse-report.v0", created_at: createdAt, status: "unverified", passed: false, workspace: relative(repo, root).replaceAll("\\", "/") };
  try {
    const staged = await stagePilot(root, createdAt);
    const project = join(root, PROJECT);
    const version = run("lean", ["--version"], project);
    await inspectPackage(PACKAGE_DIR, version);
    Object.assign(report, { package_sha256: staged.manifest_sha256, lean_version: version.trim(), assumptions: staged.manifest.assumptions });
    // Separate CLI processes ensure no in-memory session or prior chat is available.
    const next = cli(root, ["workspace", "run-next", root, "--json"]);
    await writeFile(join(root, "cold-start.json"), JSON.stringify(next, null, 2) + "\n", "utf8");
    assert.equal(next.item?.validationPlanId, staged.planId);
    assert.equal(next.item?.validationGateKind, "proof");
    assert(next.item?.command?.includes("--declaration Scratch.scratch_bound"));
    const missing = cli(root, ["workspace", "run-next", root, "--execute-local", "--json"]);
    await writeFile(join(root, "missing-dependency.json"), JSON.stringify(missing, null, 2) + "\n", "utf8");
    const before = (await listValidationPlans(root)).find((plan) => plan.planId === staged.planId);
    assert(before.gates.some((gate) => gate.kind === "proof" && gate.status !== "satisfied"));
    report.cold_start = { selected: "Scratch.scratch_bound", missing_dependency_did_not_close_gate: true, evidence: "cold-start.json" };

    // Restore a known reviewed proof. This is a replay rehearsal, not autonomous discovery.
    await copyFile(join(PACKAGE_DIR, "Scratch/Bound.lean"), join(project, "Scratch/Bound.lean"));
    await inspectPackage(project, version);
    const build = run("lake", ["build"], project);
    await writeFile(join(root, "lean-build.txt"), build, "utf8");
    report.dependency_steps = await closeGate(root, staged.planId);
    const finalPlanId = await addProofGate(root, staged.sessionId, "Scratch.budget_bound", "Scratch/Final.lean", new Date().toISOString());
    report.root_steps = await closeGate(root, finalPlanId);
    await inspectPackage(project, version);
    report.status = "proved";
    report.passed = true;
    report.statement = "For the stated sequential tree recurrence, persistent + frame * depth <= budget and height(tree) <= depth imply persistent + scratch(frame, tree) <= budget.";
    report.boundary = "Known model theorem replayed locally. Not a Hum program proof, wall-clock benchmark, new mathematical discovery, or Prove2Me acceptance. The manifest graph is reviewed metadata; Lean checks the actual dependency closure.";
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  }
  const reportPath = join(root, "report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  await writeFile(join(root, "PROGRESS.md"), [
    "# Scratch-Space Proof Reuse", "", `Date: ${createdAt}`, "", `Status: ${report.status}`, "",
    "[Metadata and receipts](report.json)", "", report.statement ?? report.error,
    "", "## Assumptions", "", ...(report.assumptions ?? []).map((line) => `- ${line}`),
    "", report.boundary ?? "Incomplete run. No proof conclusion is available.", ""
  ].join("\n"), "utf8");
  console.log(JSON.stringify({ passed: report.passed, status: report.status, report: relative(repo, reportPath).replaceAll("\\", "/"), error: report.error }, null, 2));
  if (!report.passed) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runPilot();
}

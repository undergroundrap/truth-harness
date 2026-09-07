import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const fixturePath = join(repo, "docs/examples/pit-degree-two.json");
const bridge = join(repo, "tools/pit_certificate.py");
export const sparseBridge = join(repo, "tools/pit_sparse_certificate.py");
export const sparseFixturePath = join(repo, "docs/examples/pit-sparse-two.json");
export const sparseClass = "rational-bivariate-individual-degree-two-sparsity-two";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const schema = z.object({
  schema_version: z.literal("truth-harness.pit-experiment.v0"),
  polynomial_class: z.enum(["rational-bivariate-total-degree-at-most-two", sparseClass]),
  cases: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,40}$/u),
    points: z.array(z.tuple([z.number().int().min(-10).max(10), z.number().int().min(-10).max(10)])).min(1).max(16),
    expected: z.enum(["hits-class", "misses-class"])
  }).strict()).min(1).max(16)
}).strict();

export function parseExperiment(raw, expectedClass = "rational-bivariate-total-degree-at-most-two") {
  const fixture = schema.parse(JSON.parse(raw));
  assert.equal(fixture.polynomial_class, expectedClass, "Experiment class mismatch");
  assert.equal(new Set(fixture.cases.map((c) => c.id)).size, fixture.cases.length, "Duplicate case IDs");
  for (const c of fixture.cases) assert.equal(new Set(c.points.map(JSON.stringify)).size, c.points.length, "Duplicate points");
  return fixture;
}

export function python(mode, value, script = bridge) {
  const result = spawnSync("python", [script, mode], {
    input: JSON.stringify(value), encoding: "utf8", timeout: 30000,
    maxBuffer: 1024 * 1024, windowsHide: true, shell: false
  });
  assert(!result.error, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

export async function runExperiment({ sparse = false } = {}) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use npm run docker:pit-experiment.");
  const checker = sparse ? sparseBridge : bridge;
  const raw = await readFile(sparse ? sparseFixturePath : fixturePath);
  const fixture = sparse ? parseExperiment(raw.toString("utf8"), sparseClass) : parseExperiment(raw.toString("utf8"));
  const parent = join(repo, ".truth-harness", "experiments");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, sparse ? "pit-sparse-two-" : "pit-degree-two-"));
  const report = {
    schema_version: "truth-harness.pit-report.v0", created_at: new Date().toISOString(),
    status: "unverified", passed: false, fixture_sha256: sha(raw),
    checker_sha256: sha(await readFile(checker)), polynomial_class: fixture.polynomial_class,
    boundary: "Known finite-dimensional baseline, not a circuit-size PIT breakthrough, Lean proof, or general discovery engine.",
    results: []
  };
  if (sparse) report.checker_dependencies = [{ path: "tools/pit_certificate.py", sha256: sha(await readFile(bridge)) }];
  await writeFile(join(root, "fixture.json"), raw);
  try {
    for (const c of fixture.cases) {
      const request = { schema_version: sparse ? "truth-harness.pit-sparse-request.v0" : "truth-harness.pit-request.v0", polynomial_class: fixture.polynomial_class, points: c.points };
      const certificate = python("construct", request, checker);
      const name = `${c.id}.certificate.json`;
      const bytes = JSON.stringify(certificate, null, 2) + "\n";
      await writeFile(join(root, name), bytes, "utf8");
      // Fresh process, persisted bytes, no SymPy import in checker mode.
      const persisted = JSON.parse(await readFile(join(root, name), "utf8"));
      assert.deepEqual(persisted.request, request, "Certificate request mismatch");
      const checked = python("check", persisted, checker);
      report.results.push({ id: c.id, point_count: c.points.length, ...checked, expected: c.expected, certificate: name, sha256: sha(bytes) });
      assert.equal(checked.conclusion, c.expected, `Unexpected result: ${c.id}`);
    }
    report.status = "exact-computed";
    report.passed = true;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  }
  await writeFile(join(root, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  await writeFile(join(root, "PROGRESS.md"), [
    sparse ? "# Sparse PIT Experiment" : "# Degree-Two PIT Experiment", "", `Date: ${report.created_at}`, "", `Status: ${report.status}`, "",
    "[Report and certificate hashes](report.json)", "", report.boundary, "",
    sparse ? "Class: polynomials in Q[x,y] with at most two nonzero terms and degree at most two in each variable. Every one- and two-monomial support is checked; coefficients are arbitrary rationals." : "Class: every polynomial in Q[x,y] of total degree at most two. No bound on coefficient size or circuit size is asserted.", "",
    ...report.results.map((r) => `- ${r.id}: ${r.conclusion}, ${r.trust}; [certificate](${r.certificate}).`), "",
    report.error ?? "Next: inspect failed candidates and the left-inverse certificates before proposing a broader polynomial class.", ""
  ].join("\n"), "utf8");
  console.log(JSON.stringify({ passed: report.passed, status: report.status, report: relative(repo, join(root, "report.json")).replaceAll("\\", "/"), error: report.error }, null, 2));
  if (!report.passed) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--sparse"), "Expected no arguments or --sparse");
  await runExperiment({ sparse: process.argv[2] === "--sparse" });
}

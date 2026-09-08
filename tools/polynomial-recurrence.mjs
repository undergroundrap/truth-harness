import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedInput } from "./pit-witness.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const bridge = fileURLToPath(new URL("./polynomial_recurrence.py", import.meta.url));
const json = value => JSON.stringify(value, null, 2) + "\n";
const sha = value => createHash("sha256").update(value).digest("hex");

export function recurrenceContract(mode, raw) {
  const result = spawnSync("python", mode === "check" ? ["-S", bridge, mode] : [bridge, mode],
    { input: raw, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024, shell: false, windowsHide: true });
  assert(!result.error, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

export const recurrenceExitCode = status => ({ "identity-checked": 0, refuted: 1, unknown: 3 })[status] ?? 2;

export async function checkRecurrence(args) {
  assert.equal(process.env.TRUTH_HARNESS_CONTAINER, "1", "Use the offline Docker pit-experiment service");
  const recheck = args[0] === "--check";
  assert.ok(recheck ? args.length === 3 && !args.slice(1).includes("-") : args.length === 1 && !args[0].startsWith("--"),
    "Usage: polynomial-recurrence.mjs <request.json|-> OR --check <request.json> <receipt.json>");
  const raw = await boundedInput(args[recheck ? 1 : 0]);
  let receiptRaw = recheck ? await boundedInput(args[2]) : JSON.stringify(recurrenceContract("construct", raw)) + "\n";
  assert.ok(Buffer.byteLength(receiptRaw) <= 65536, "Receipt exceeds 65536 bytes");
  let directory;
  if (!recheck) {
    const root = path.join(repo, ".truth-harness", "witnesses");
    await mkdir(root, { recursive: true });
    directory = await mkdtemp(path.join(root, "polynomial-recurrence-"));
    await writeFile(path.join(directory, "request.json"), raw, "utf8");
    await writeFile(path.join(directory, "receipt.json"), receiptRaw, "utf8");
    receiptRaw = await boundedInput(path.join(directory, "receipt.json"));
  }
  const checked = recurrenceContract("check", JSON.stringify({ request_json: raw, receipt_json: receiptRaw }));
  const report = { schema_version: "truth-harness.polynomial-recurrence-report.v0", ...checked,
    request_sha256: sha(raw), receipt_sha256: sha(receiptRaw), checker_sha256: sha(await readFile(bridge)),
    polynomial_helper_sha256: sha(await readFile(new URL("./polynomial_sum.py", import.meta.url))),
    helper_sha256: sha(await readFile(new URL("./pit_witness.py", import.meta.url))),
    rational_helper_sha256: sha(await readFile(new URL("./pit_certificate.py", import.meta.url))),
    artifact_directory: directory ? path.relative(repo, directory).split(path.sep).join("/") : null,
    limitations: "Constant rational coefficients, order 1..4, polynomial forcing/candidate degree <=12. No exponential formula parsing, source-code verification, asymptotic bound or Lean-proof guarantee." };
  if (directory) {
    await writeFile(path.join(directory, "report.json"), json(report), "utf8");
    await writeFile(path.join(directory, "PROGRESS.md"), `# Polynomial Recurrence\n\nRecorded: ${new Date().toISOString()}\n\n` +
      `Status: ${report.status}; trust: ${report.trust}.\n\n[Request](request.json) | [Receipt](receipt.json) | [Check](report.json)\n\n${report.limitations}\n`, "utf8");
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await checkRecurrence(process.argv.slice(2));
    process.stdout.write(json(report));
    process.exitCode = recurrenceExitCode(report.status);
  } catch (error) {
    process.stdout.write(json({ schema_version: "truth-harness.polynomial-recurrence-report.v0", status: "unverified", checked: false, error: error.message }));
    process.exitCode = 2;
  }
}

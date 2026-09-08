import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { lookupPolynomialReceipts } from "./polynomial-lookup.js";

let root: string;
const bytes = '{"schema_version":"example"}\n';
const hash = createHash("sha256").update(bytes).digest("hex");
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "receipt lookup ")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
async function put(name: string, request = bytes, receipt = "not a valid receipt") {
  const dir = join(root, ".truth-harness/witnesses", name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "request.json"), request);
  await writeFile(join(dir, "receipt.json"), receipt);
  return dir;
}
it("finds byte matches deterministically without trusting reports or receipt contents", async () => {
  await put("polynomial-recurrence-z"); await put("polynomial-equivalence-a"); await put("polynomial-sum-b", bytes + " ");
  const result = await lookupPolynomialReceipts(root, hash);
  expect(result).toMatchObject({ checked: false, trust: "unverified", requires_replay: true, scanned: 3, skipped: 0 });
  expect(result.matches).toHaveLength(2);
  expect(result.matches[0].request_path).toContain("polynomial-equivalence-a");
  expect(await lookupPolynomialReceipts(root, hash)).toEqual(result);
  expect((await lookupPolynomialReceipts(root, "0".repeat(64))).matches).toEqual([]);
});
it("handles missing stores and rejects invalid hashes", async () => {
  expect((await lookupPolynomialReceipts(root, hash)).matches).toEqual([]);
  for (const value of ["../x", hash.toUpperCase(), "0".repeat(63)]) await expect(lookupPolynomialReceipts(root, value)).rejects.toThrow();
});
it("skips missing or oversized files and does not read linked directories", async () => {
  await put("polynomial-sum-large", bytes, "x".repeat(65537));
  const dir = await put("polynomial-sum-missing"); await rm(join(dir, "receipt.json"));
  const outside = join(root, "outside"); await mkdir(outside); await writeFile(join(outside, "request.json"), bytes);
  await symlink(outside, join(root, ".truth-harness/witnesses/polynomial-sum-link"), "junction");
  const result = await lookupPolynomialReceipts(root, hash);
  expect(result.matches).toEqual([]); expect(result.skipped).toBe(3);
});
it("rejects linked witness stores and excessive scans without partial results", async () => {
  const outside = join(root, "outside"); await mkdir(outside); await mkdir(join(root, ".truth-harness"));
  const store = join(root, ".truth-harness/witnesses"); await symlink(outside, store, "junction");
  await expect(lookupPolynomialReceipts(root, hash)).rejects.toThrow("Unsafe witness store");
  await rm(store); await mkdir(store);
  for (let i = 0; i < 257; i++) await writeFile(join(store, String(i)), "");
  await expect(lookupPolynomialReceipts(root, hash)).rejects.toThrow("256");
});
it("exposes candidate-only CLI output and invalid-input exit codes", async () => {
  await put("polynomial-recurrence-cli");
  const cli = fileURLToPath(new URL("../../../apps/cli/dist/index.js", import.meta.url));
  const run = (value: string) => spawnSync(process.execPath, [cli, "polynomial", "lookup", value, "--root", root, "--json"], { encoding: "utf8", windowsHide: true, timeout: 10000 });
  const result = run(hash); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ checked: false, requires_replay: true });
  expect(JSON.parse(result.stdout).matches).toHaveLength(1);
  expect(run("bad").status).toBe(2);
});

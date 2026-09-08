import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
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
  for (let i = 0; i < 8192; i++) await writeFile(join(store, String(i)), "");
  expect(await lookupPolynomialReceipts(root, hash)).toMatchObject({ inventory_entries: 8192, scanned: 256, complete: false });
  await writeFile(join(store, "8192"), "");
  await expect(lookupPolynomialReceipts(root, hash)).rejects.toThrow("8192");
}, 30000);
it("paginates deterministically including empty match pages and binds cursor to query and root", async () => {
  await put("polynomial-recurrence-last");
  const store = join(root, ".truth-harness/witnesses");
  for (let i = 0; i < 256; i++) await writeFile(join(store, `a${String(i).padStart(3, "0")}`), "");
  const first = await lookupPolynomialReceipts(root, hash);
  expect(first).toMatchObject({ complete: false, scanned: 256, inventory_entries: 257, matches: [] });
  const next = first.next_cursor!;
  expect(await lookupPolynomialReceipts(root, hash)).toEqual(first);
  const second = await lookupPolynomialReceipts(root, hash, next);
  expect(second).toMatchObject({ complete: true, scanned: 1, next_cursor: null, checked: false });
  expect(second.matches).toHaveLength(1);
  await expect(lookupPolynomialReceipts(root, "0".repeat(64), next)).rejects.toThrow("cursor");
  const other = await mkdtemp(join(tmpdir(), "lookup other "));
  try {
    await cp(join(root, ".truth-harness"), join(other, ".truth-harness"), { recursive: true });
    await expect(lookupPolynomialReceipts(other, hash, next)).rejects.toThrow("cursor");
  }
  finally { await rm(other, { recursive: true, force: true }); }
  for (const bad of ["!", "x".repeat(257), Buffer.from(JSON.stringify({ v: 1, binding: "bad", offset: 256 })).toString("base64url")])
    await expect(lookupPolynomialReceipts(root, hash, bad)).rejects.toThrow("cursor");
  for (const offset of [0, -256, 1, 512, 256.5, true]) {
    const invalid = { ...JSON.parse(Buffer.from(next, "base64url").toString("utf8")), offset };
    await expect(lookupPolynomialReceipts(root, hash, Buffer.from(JSON.stringify(invalid)).toString("base64url"))).rejects.toThrow("cursor");
  }
  await rm(join(store, "a000"));
  await expect(lookupPolynomialReceipts(root, hash, next)).rejects.toThrow("stale");
  expect(await lookupPolynomialReceipts(root, hash)).toMatchObject({ inventory_entries: 256, complete: true, next_cursor: null });
});
it("reads changed files afresh and counts missing files on a later page", async () => {
  for (let i = 0; i < 258; i++) await put(`polynomial-sum-${String(i).padStart(3, "0")}`);
  const first = await lookupPolynomialReceipts(root, hash);
  expect(first.matches).toHaveLength(256);
  await writeFile(join(root, ".truth-harness/witnesses/polynomial-sum-256/request.json"), "changed");
  await rm(join(root, ".truth-harness/witnesses/polynomial-sum-257/receipt.json"));
  const last = await lookupPolynomialReceipts(root, hash, first.next_cursor!);
  expect(last).toMatchObject({ complete: true, matches: [], skipped: 1, scanned: 2 });
});
it("exposes candidate-only CLI output and invalid-input exit codes", async () => {
  await put("polynomial-recurrence-cli");
  const cli = fileURLToPath(new URL("../../../apps/cli/dist/index.js", import.meta.url));
  const run = (value: string, cursor?: string) => spawnSync(process.execPath, [cli, "polynomial", "lookup", value, "--root", root, "--json", ...(cursor ? ["--cursor", cursor] : [])], { encoding: "utf8", windowsHide: true, timeout: 10000 });
  const result = run(hash); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ checked: false, requires_replay: true });
  expect(JSON.parse(result.stdout).matches).toHaveLength(1);
  expect(run("bad").status).toBe(2);
  const store = join(root, ".truth-harness/witnesses");
  for (let i = 0; i < 256; i++) await writeFile(join(store, `a${i}`), "");
  const page = JSON.parse(run(hash).stdout);
  expect(page.complete).toBe(false);
  const next = run(hash, page.next_cursor);
  expect(next.status).toBe(0);
  expect(JSON.parse(next.stdout)).toMatchObject({ complete: true, next_cursor: null });
  expect(JSON.parse(next.stdout).matches).toHaveLength(1);
});

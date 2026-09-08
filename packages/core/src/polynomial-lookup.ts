import { createHash } from "node:crypto";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
const inside = (root: string, target: string) => {
  const rel = relative(root, target);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

export async function lookupPolynomialReceipts(rootPath: string, requestSha256: string) {
  if (!/^[a-f0-9]{64}$/.test(requestSha256)) throw new Error("Require a lowercase SHA-256 request-byte hash");
  const root = await realpath(resolve(rootPath));
  const base = { schema_version: "truth-harness.polynomial-lookup.v0", status: "candidates-only",
    checked: false, trust: "unverified", requires_replay: true, match_basis: "exact-request-bytes-sha256",
    request_sha256: requestSha256, max_entries: 256, max_file_bytes: 65536 };
  const matches: { request_path: string; receipt_path: string; receipt_sha256: string }[] = [];
  let store = root;
  for (const part of [".truth-harness", "witnesses"]) {
    store = join(store, part);
    try {
      const stat = await lstat(store);
      if (stat.isSymbolicLink() || !stat.isDirectory() || !inside(root, await realpath(store))) throw new Error("Unsafe witness store");
    } catch (error) { if (missing(error)) return { ...base, scanned: 0, skipped: 0, matches }; throw error; }
  }
  const names: string[] = [];
  for await (const entry of await opendir(store)) {
    if (names.length === 256) throw new Error("Witness scan exceeds 256 entries; no partial results returned");
    names.push(entry.name);
  }
  let skipped = 0;
  const read = async (file: string) => {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || !inside(store, await realpath(file))) throw new Error("Unsafe evidence file");
    const handle = await open(file, "r");
    try {
      if (!(await handle.stat()).isFile()) throw new Error("Not a regular file");
      const bytes = Buffer.alloc(65537);
      let length = 0;
      while (length < bytes.length) {
        const result = await handle.read(bytes, length, bytes.length - length, null);
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      if (length > 65536) throw new Error("Oversized evidence file");
      return bytes.subarray(0, length);
    } finally { await handle.close(); }
  };
  for (const name of names.sort()) {
    if (!/^polynomial-(?:equivalence|sum|recurrence)-[A-Za-z0-9_-]+$/.test(name)) continue;
    const directory = join(store, name);
    try {
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || !inside(store, await realpath(directory))) throw new Error("Unsafe evidence directory");
      const request = join(directory, "request.json"), receipt = join(directory, "receipt.json");
      if (sha(await read(request)) !== requestSha256) continue;
      matches.push({ request_path: relative(root, request).split(sep).join("/"),
        receipt_path: relative(root, receipt).split(sep).join("/"), receipt_sha256: sha(await read(receipt)) });
    } catch { skipped++; }
  }
  return { ...base, scanned: names.length, skipped, matches };
}

import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const catalogVersion = "truth-harness.proof-dependencies.v0";
const reportVersion = "truth-harness.proof-dependency-lookup.v0";
const catalogFile = "proof-dependencies.json";
const byteLimit = 65536;
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/u);
const declaration = z.string().max(128).regex(/^[A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*$/u);
const basename = z.string().max(96).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)+$/u)
  .refine(name => !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])\./iu.test(name)
    && name.toLowerCase() !== catalogFile, "Expected a portable artifact basename");
const artifact = extension => z.strictObject({
  file: basename.refine(name => name.endsWith(extension), `Expected a ${extension} artifact`),
  sha256
});
const catalogSchema = z.strictObject({
  schema_version: z.literal(catalogVersion),
  lean_version: z.string().max(20).regex(/^\d+\.\d+\.\d+$/u),
  records: z.array(z.strictObject({
    id,
    declaration,
    challenge: artifact(".lean"),
    solution: artifact(".lean"),
    receipt: artifact(".json"),
    requires: z.array(id).max(16)
  })).max(64)
});
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const report = fields => ({ schema_version: reportVersion, ...fields });

function parseCatalog(raw) {
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
  const value = JSON.parse(text);
  // JSON.parse validates the grammar, but discards repeated object members.
  // Inspect the original member tokens and compare the decoded key strings.
  const keys = [];
  for (const [, literal, colon, brace] of text.matchAll(/("(?:\\.|[^"\\])*")(\s*:)?|([{}])/gu)) {
    if (brace === "{") keys.push(new Set());
    else if (brace === "}") keys.pop();
    else if (colon) {
      const key = JSON.parse(literal);
      const object = keys.at(-1);
      if (object.has(key)) throw new Error(`Duplicate JSON member: ${key}`);
      object.add(key);
    }
  }
  return catalogSchema.parse(value);
}

async function readBounded(root, name) {
  const path = join(root, name);
  const before = await lstat(path);
  if (!before.isFile() || before.size > byteLimit) throw new Error(`Invalid or oversized file: ${name}`);
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino) {
      throw new Error(`File changed during lookup: ${name}`);
    }
    const bytes = Buffer.alloc(byteLimit + 1);
    let size = 0;
    while (size < bytes.length) {
      const { bytesRead } = await handle.read(bytes, size, bytes.length - size, null);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > byteLimit) throw new Error(`Oversized file: ${name}`);
    return bytes.subarray(0, size);
  } finally {
    await handle.close();
  }
}

function dependencyOrder(records, roots) {
  const visiting = new Set();
  const visited = new Set();
  const order = [];
  function visit(key) {
    if (visiting.has(key)) throw new Error(`Dependency cycle: ${key}`);
    if (visited.has(key)) return;
    const value = records.get(key);
    if (!value) throw new Error(`Unknown dependency: ${key}`);
    visiting.add(key);
    for (const dep of [...value.requires].sort()) visit(dep);
    visiting.delete(key);
    visited.add(key);
    order.push(value);
  }
  for (const key of roots) visit(key);
  return order;
}

function indexRecords(catalog) {
  const records = new Map();
  const artifactNames = new Map();
  for (const entry of catalog.records) {
    if (records.has(entry.id)) throw new Error(`Duplicate record: ${entry.id}`);
    if (new Set(entry.requires).size !== entry.requires.length) throw new Error(`Duplicate dependency: ${entry.id}`);
    if (entry.challenge.file.toLowerCase() === entry.solution.file.toLowerCase()) {
      throw new Error(`Challenge and solution must be separate files: ${entry.id}`);
    }
    for (const ref of [entry.challenge, entry.solution, entry.receipt]) {
      const key = ref.file.toLowerCase();
      const existing = artifactNames.get(key);
      if (existing && (existing.file !== ref.file || existing.sha256 !== ref.sha256)) {
        throw new Error(`Conflicting artifact references: ${ref.file}`);
      }
      artifactNames.set(key, ref);
    }
    records.set(entry.id, entry);
  }
  dependencyOrder(records, [...records.keys()].sort());
  return records;
}

export async function findProofDependency(directory, target, challengeHash) {
  declaration.parse(target);
  if (challengeHash !== undefined) sha256.parse(challengeHash);
  const root = await realpath(directory);
  const raw = await readBounded(root, catalogFile);
  const catalog = parseCatalog(raw);
  const records = indexRecords(catalog);
  const matches = [...records.keys()].sort().map(key => records.get(key)).filter(entry =>
    entry.declaration === target && (challengeHash === undefined || entry.challenge.sha256 === challengeHash));
  const context = { declaration: target, catalog_sha256: digest(raw), lean_version: catalog.lean_version };
  if (!matches.length) return report({ status: "not-found", ...context });
  if (matches.length > 1) {
    return report({
      status: "ambiguous", ...context,
      matches: matches.map(entry => ({ id: entry.id, challenge_sha256: entry.challenge.sha256 }))
    });
  }
  const order = dependencyOrder(records, [matches[0].id]);
  const checked = new Set();
  for (const entry of order) {
    for (const ref of [entry.challenge, entry.solution, entry.receipt]) {
      if (checked.has(ref.file)) continue;
      if (digest(await readBounded(root, ref.file)) !== ref.sha256) {
        throw new Error(`Artifact hash mismatch: ${ref.file}`);
      }
      checked.add(ref.file);
    }
  }
  return report({
    status: "found", ...context, selected_id: matches[0].id,
    replay_order: order, fresh_replay_required: true
  });
}

const main = import.meta.main ?? (process.argv[1] &&
  await realpath(process.argv[1]).catch(() => null) === await realpath(fileURLToPath(import.meta.url)));
if (main) {
  const [action, directory, target, flag, hash, ...rest] = process.argv.slice(2);
  try {
    if (action !== "find" || !directory || !target || rest.length ||
        (flag !== undefined && (flag !== "--challenge-sha256" || !hash))) {
      throw new Error("Usage: proof-dependencies.mjs find <directory> <declaration> [--challenge-sha256 <sha256>]");
    }
    const result = await findProofDependency(directory, target, hash);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "found" ? 0 : 1;
  } catch (error) {
    console.log(JSON.stringify(report({ status: "invalid", error: error.message }), null, 2));
    process.exitCode = 2;
  }
}

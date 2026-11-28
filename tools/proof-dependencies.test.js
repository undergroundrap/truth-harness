import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findProofDependency } from "./proof-dependencies.mjs";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const catalogName = "proof-dependencies.json";
const script = fileURLToPath(new URL("./proof-dependencies.mjs", import.meta.url));
const lookup = (...args) => spawnSync(process.execPath, [script, "find", root, ...args], { encoding: "utf8", timeout: 4000 });
let root;

beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "proof catalog ")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function record(id, declaration, requires = []) {
  const challenge = `${id}.challenge.lean`;
  const solution = `${id}.solution.lean`;
  const receipt = `${id}.receipt.json`;
  const bound = async (file, content) => {
    await writeFile(join(root, file), content);
    return { file, sha256: digest(content) };
  };
  return {
    id, declaration, requires,
    challenge: await bound(challenge, `-- Reference for ${id}\n`),
    solution: await bound(solution, `-- Candidate for ${id}\n`),
    receipt: await bound(receipt, '{"status":"accepted","trust":"proved"}\n')
  };
}

async function writeCatalog(records, extra = {}) {
  const value = { schema_version: "truth-harness.proof-dependencies.v0", lean_version: "4.36.0", records, ...extra };
  const raw = JSON.stringify(value) + "\n";
  await writeFile(join(root, catalogName), raw);
  return digest(raw);
}

describe("local proof dependency lookup", () => {
  it("checks the selected closure and orders prerequisites once, including a diamond", async () => {
    const records = [
      await record("root", "Range.adjacent", ["right", "left"]),
      await record("right", "Range.right", ["base"]),
      await record("base", "Prefix.sum"),
      await record("left", "Range.left", ["base"])
    ];
    const catalog_sha256 = await writeCatalog(records);
    const result = await findProofDependency(root, "Range.adjacent");
    expect(result).toMatchObject({
      schema_version: "truth-harness.proof-dependency-lookup.v0",
      status: "found", declaration: "Range.adjacent", selected_id: "root",
      lean_version: "4.36.0", catalog_sha256, fresh_replay_required: true
    });
    expect(result.replay_order.map(row => row.id)).toEqual(["base", "left", "right", "root"]);
    expect(result).not.toHaveProperty("trust");
    expect(await findProofDependency(root, "Range.adjacent")).toEqual(result);
  });

  it("does not guess between equal theorem names and can select an exact challenge", async () => {
    const a = await record("a", "Range.adjacent");
    const b = await record("b", "Range.adjacent");
    await writeCatalog([b, a]);
    const result = await findProofDependency(root, "Range.adjacent");
    expect(result.status).toBe("ambiguous");
    expect(result.matches.map(row => row.id)).toEqual(["a", "b"]);
    expect(result).not.toHaveProperty("replay_order");
    expect((await findProofDependency(root, "Range.adjacent", b.challenge.sha256)).selected_id).toBe("b");
    expect((await findProofDependency(root, "Range.adjacent", "0".repeat(64))).status).toBe("not-found");
    expect((await findProofDependency(root, "range.adjacent")).status).toBe("not-found");
    await writeCatalog([a, { ...b, challenge: a.challenge }]);
    expect((await findProofDependency(root, "Range.adjacent", a.challenge.sha256)).status).toBe("ambiguous");
  });

  it.each(["challenge", "solution", "receipt"])("fails if a prerequisite %s changes", async role => {
    const base = await record("base", "Prefix.sum");
    await writeCatalog([base, await record("root", "Range.adjacent", ["base"])]);
    await writeFile(join(root, base[role].file), "changed\n");
    await expect(findProofDependency(root, "Range.adjacent")).rejects.toThrow(/Artifact hash mismatch/);
  });

  it("does not read or attest artifact bytes outside the selected dependency closure", async () => {
    const unrelated = await record("other", "Other.lemma");
    await writeCatalog([unrelated, await record("base", "Prefix.sum")]);
    await rm(join(root, unrelated.solution.file));
    expect((await findProofDependency(root, "Prefix.sum")).status).toBe("found");
    await expect(findProofDependency(root, "Other.lemma")).rejects.toThrow();
  });

  it("rejects duplicate identifiers, dangling edges and cycles, even on a miss", async () => {
    const a = await record("a", "Range.a");
    const b = await record("b", "Range.b", ["a"]);
    for (const [records, reason] of [
      [[a, a], /Duplicate record/],
      [[{ ...a, requires: ["x"] }], /Unknown dependency/],
      [[a, { ...b, requires: ["a", "a"] }], /Duplicate dependency/],
      [[{ ...a, requires: ["b"] }, b], /Dependency cycle/]
    ]) {
      await writeCatalog(records);
      await expect(findProofDependency(root, "Missing.lemma")).rejects.toThrow(reason);
    }
  });

  it("reports missing records with deduplicated direct and transitive blockers in the selected branch", async () => {
    const target = await record("root", "Range.adjacent", ["right", "left"]);
    const left = await record("left", "Range.left", ["missing-base"]);
    const right = await record("right", "Range.right", ["missing-extra", "missing-base"]);
    const unrelated = await record("a-other", "Other.lemma", ["outside"]);
    const catalog_sha256 = await writeCatalog([target, right, unrelated, left]);
    await rm(join(root, left.solution.file));
    const result = lookup(target.declaration);
    expect(result.status).toBe(2);
    const body = JSON.parse(result.stdout);
    const ref = row => ({ id: row.id, declaration: row.declaration, challenge_sha256: row.challenge.sha256 });
    expect(body).toEqual({
      schema_version: "truth-harness.proof-dependency-lookup.v0",
      status: "invalid", error: "Unknown dependency: outside",
      handoff: {
        schema_version: "truth-harness.proof-dependency-handoff.v0", status: "blocked",
        catalog_sha256, lean_version: "4.36.0", target: ref(target),
        missing_prerequisites: [
          { id: "missing-base", required_by: ["left", "right"], blocks: ["left", "right", "root"] },
          { id: "missing-extra", required_by: ["right"], blocks: ["right", "root"] }
        ],
        blocked_records: [ref(left), ref(right), ref(target)],
        next_checks: [
          "confirm_and_restore_missing_records", "rerun_catalog_lookup", "replay_exact_proofs_with_trusted_checker"
        ]
      }
    });
    expect(lookup(target.declaration).stdout).toBe(result.stdout);
    await expect(findProofDependency(root, target.declaration)).rejects.toMatchObject({ handoff: body.handoff });
  });

  it("does not choose a handoff for an ambiguous, missing or unaffected target", async () => {
    const a = await record("a", "Range.adjacent", ["missing-base"]);
    const b = await record("b", "Range.adjacent");
    await writeCatalog([a, b]);
    for (const args of [ [a.declaration], ["Missing.lemma"], [b.declaration, "--challenge-sha256", b.challenge.sha256] ]) {
      const result = lookup(...args);
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({ status: "invalid", error: "Unknown dependency: missing-base" });
      expect(JSON.parse(result.stdout)).not.toHaveProperty("handoff");
    }
    const selected = lookup(a.declaration, "--challenge-sha256", a.challenge.sha256);
    expect(selected.status).toBe(2);
    expect(JSON.parse(selected.stdout).handoff.target.id).toBe("a");
  });

  it("does not emit a handoff when there is also a cycle", async () => {
    await writeCatalog([
      await record("a", "Range.adjacent", ["a-missing", "b"]),
      await record("b", "Range.right", ["a"])
    ]);
    const result = lookup("Range.adjacent");
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toEqual({
      schema_version: "truth-harness.proof-dependency-lookup.v0",
      status: "invalid", error: "Dependency cycle: a"
    });
  });

  it("resumes ordinary hash-checked lookup after the records are restored", async () => {
    const target = await record("root", "Range.adjacent", ["prefix"]);
    await writeCatalog([target]);
    expect(JSON.parse(lookup(target.declaration).stdout).handoff.status).toBe("blocked");
    const base = await record("prefix", "Prefix.sum");
    await writeCatalog([target, base]);
    const resumed = lookup(target.declaration);
    expect(resumed.status).toBe(0);
    const body = JSON.parse(resumed.stdout);
    expect(body.replay_order.map(row => row.id)).toEqual(["prefix", "root"]);
    expect(body.fresh_replay_required).toBe(true);
    expect(body).not.toHaveProperty("handoff");
  });

  it("rejects misplaced trust fields, unknown versions, and unportable artifact paths", async () => {
    const row = await record("base", "Prefix.sum");
    await writeCatalog([row], { schema_version: "truth-harness.proof-dependencies.v1" });
    await expect(findProofDependency(root, "Prefix.sum")).rejects.toThrow();
    await writeCatalog([{ ...row, trust: "proved" }]);
    await expect(findProofDependency(root, "Prefix.sum")).rejects.toThrow();
    for (const file of ["nested/file.lean", "nested\\file.lean", "C:file.lean", "NUL.lean"]) {
      await writeCatalog([{ ...row, solution: { ...row.solution, file } }]);
      await expect(findProofDependency(root, "Prefix.sum")).rejects.toThrow();
    }
  });

  it("rejects a challenge aliased to its solution and conflicting case spellings", async () => {
    const row = await record("base", "Prefix.sum");
    await writeCatalog([{ ...row, solution: row.challenge }]);
    await expect(findProofDependency(root, "Prefix.sum")).rejects.toThrow(/separate files/);
    const other = await record("other", "Other.lemma");
    await writeCatalog([row, { ...other, challenge: { ...row.challenge, file: row.challenge.file.replace(/^base/, "BASE") } }]);
    await expect(findProofDependency(root, "Prefix.sum")).rejects.toThrow(/Conflicting artifact references/);
  });

  it("keeps file size bounded", async () => {
    const row = await record("base", "Prefix.sum");
    await writeCatalog([row]);
    await writeFile(join(root, row.receipt.file), Buffer.alloc(65537));
    await expect(findProofDependency(root, "Prefix.sum")).rejects.toThrow(/oversized/);
  });

  it("rejects malformed UTF-8 and a byte order mark in the catalog", async () => {
    for (const raw of [Buffer.from([0xff]), "\uFEFF{}"]) {
      await writeFile(join(root, catalogName), raw);
      await expect(findProofDependency(root, "Prefix.sum")).rejects.toThrow();
    }
  });

  it("rejects duplicate object members, including escaped spellings, with exit 2", async () => {
    const row = await record("base", "Prefix.sum");
    const raw = JSON.stringify({
      schema_version: "truth-harness.proof-dependencies.v0", lean_version: "4.36.0", records: [row]
    }).replace('"requires":[]', '"requires":[], "\\u0072equires":[]');
    await writeFile(join(root, catalogName), raw);
    const result = spawnSync(process.execPath, [script, "find", root, "Prefix.sum"], { encoding: "utf8", timeout: 4000 });
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: "invalid", error: "Duplicate JSON member: requires" });
  });

  it.skipIf(process.platform === "win32")("does not use symlinked artifacts", async () => {
    const row = await record("base", "Prefix.sum");
    const link = "linked.lean";
    await symlink(join(root, row.solution.file), join(root, link));
    await writeCatalog([{ ...row, solution: { ...row.solution, file: link } }]);
    await expect(findProofDependency(root, "Prefix.sum")).rejects.toThrow(/Invalid or oversized file/);
  });

  it.skipIf(process.platform === "win32")("runs the CLI when invoked through a symlink", async () => {
    await writeCatalog([await record("base", "Prefix.sum")]);
    const entry = join(root, "lookup.mjs");
    await symlink(script, entry);
    const result = spawnSync(process.execPath, [entry, "find", root, "Prefix.sum"], { encoding: "utf8", timeout: 4000 });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: "found", selected_id: "base" });
  });

  it("gives fresh CLI processes stable JSON and distinct exit statuses", async () => {
    const base = await record("base", "Prefix.sum");
    await writeCatalog([base, await record("alternate", "Prefix.sum")]);
    const args = ["Prefix.sum", "--challenge-sha256", base.challenge.sha256];
    const found = lookup(...args);
    expect(found.status).toBe(0);
    expect(JSON.parse(found.stdout).fresh_replay_required).toBe(true);
    expect(lookup(...args).stdout).toBe(found.stdout);
    const ambiguous = lookup("Prefix.sum");
    expect(ambiguous.status).toBe(1);
    expect(JSON.parse(ambiguous.stdout).status).toBe("ambiguous");
    const missing = lookup("Other.sum");
    expect(missing.status).toBe(1);
    expect(JSON.parse(missing.stdout).status).toBe("not-found");
    const invalid = lookup("Prefix.sum", "--wrong");
    expect(invalid.status).toBe(2);
    expect(JSON.parse(invalid.stdout).status).toBe("invalid");
  });
});

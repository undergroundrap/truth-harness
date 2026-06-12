import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import {
  createClaimLedgerGraph,
  listClaimRecords,
  readClaimRecord,
  writeClaimLedgerRecord
} from "./claim-ledger.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("claim ledger", () => {
  it("writes claim records with verification ladder and local workspace validation", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });

    const base = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "3 / 4 converts to 6 / 8 before adding 5 / 8.",
      title: "Common denominator subclaim",
      domain: "math",
      trust: "exact-computed",
      tags: ["Math", "#fractions"],
      evidenceRefs: [{ kind: "other", ref: "run_common_denominator", trust: "exact-computed" }],
      authors: ["Ocean Bennett"],
      now: "2026-06-12T00:10:00.000Z"
    });
    const derived = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "3 / 4 + 5 / 8 equals 11 / 8.",
      domain: "math",
      trust: "exact-computed",
      dependsOn: [base.claim.claimId],
      evidenceRefs: [
        { kind: "claim", ref: base.claim.claimId, trust: "exact-computed" },
        { kind: "other", ref: "run_fraction_sum", trust: "exact-computed" }
      ],
      nextChecks: [],
      derivedBy: "Uses the common denominator subclaim, then adds 6/8 and 5/8.",
      now: "2026-06-12T00:20:00.000Z"
    });
    const list = await listClaimRecords(root);
    const graph = createClaimLedgerGraph(list);
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(base.claim.claimId).toMatch(/^claim_[a-f0-9]{16}$/);
    expect(base.claim.tags).toEqual(["fractions", "math"]);
    expect(derived.claim.dependsOn).toEqual([base.claim.claimId]);
    expect(derived.claim.finalization.readyForNarrowClaim).toBe(true);
    expect(derived.markdown).toContain("## Verification Ladder");
    expect(JSON.parse(await readFile(derived.jsonPath, "utf8")).claimId).toBe(derived.claim.claimId);
    expect(list.map((claim) => claim.claimId)).toEqual([derived.claim.claimId, base.claim.claimId]);
    expect(graph.edges).toContainEqual({ from: base.claim.claimId, to: derived.claim.claimId, kind: "depends-on" });
    expect(validation.passed).toBe(true);
    expect(validation.summary.byKind.claims).toBe(2);
  });

  it("requires dependency claims to exist before linking", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });

    await expect(
      writeClaimLedgerRecord({
        rootPath: root,
        statement: "This result depends on a missing local claim.",
        dependsOn: ["claim_0123456789abcdef"],
        now: "2026-06-12T00:10:00.000Z"
      })
    ).rejects.toThrow("Claim dependency not found");
  });

  it("reads claim records by id and preserves refuted status as non-final", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });
    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "For all integers n, n^2+n+1 is even.",
      trust: "refuted",
      evidenceRefs: [{ kind: "receipt", ref: "run_false_parity", trust: "refuted" }],
      now: "2026-06-12T00:10:00.000Z"
    });

    const read = await readClaimRecord(root, written.claim.claimId);

    expect(read.claimId).toBe(written.claim.claimId);
    expect(read.finalization.readyForNarrowClaim).toBe(false);
    expect(read.finalization.openChecks[0]).toContain("Do not advance");
    expect(read.warnings.some((warning) => warning.includes("refuted"))).toBe(true);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-claim-ledger-"));
  roots.push(root);
  return root;
}

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeSymbolicCasCheckRecord, type CasBackendCommandRunner } from "./cas-backend.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { createReceipt } from "./receipt.js";
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
    const receiptsDir = join(root, ".theorem-workbench", "receipts");
    await mkdir(receiptsDir, { recursive: true });
    await writeFile(
      join(receiptsDir, "base-fraction.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4"), null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(receiptsDir, "fraction-sum.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4 + 5 / 8"), null, 2)}\n`,
      "utf8"
    );

    const base = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "3 / 4 is exactly 3 / 4.",
      title: "Base fraction subclaim",
      domain: "math",
      trust: "exact-computed",
      tags: ["Math", "#fractions"],
      evidenceRefs: [{ kind: "receipt", ref: ".theorem-workbench/receipts/base-fraction.json" }],
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
        { kind: "claim", ref: base.claim.claimId },
        { kind: "receipt", ref: ".theorem-workbench/receipts/fraction-sum.json" }
      ],
      nextChecks: [],
      derivedBy: "Uses the base fraction subclaim, then checks the exact sum receipt.",
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

  it("derives claim trust from a linked local receipt artifact", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });
    const receiptsDir = join(root, ".theorem-workbench", "receipts");
    await mkdir(receiptsDir, { recursive: true });
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    await writeFile(join(receiptsDir, "fraction-sum.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "3 / 4 + 5 / 8 equals 11 / 8.",
      evidenceRefs: [{ kind: "receipt", ref: ".theorem-workbench/receipts/fraction-sum.json" }],
      now: "2026-06-12T00:10:00.000Z"
    });

    expect(written.claim.trust).toBe("exact-computed");
    expect(written.claim.evidenceRefs[0]).toMatchObject({
      kind: "receipt",
      ref: ".theorem-workbench/receipts/fraction-sum.json",
      trust: "exact-computed",
      summary: "Exact result: 11/8."
    });
    expect(written.claim.finalization.readyForNarrowClaim).toBe(true);
  });

  it("derives cross-checked claim trust from linked CAS evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });
    const runner: CasBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Maxima 5.47.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "THEOREM_MAXIMA_STATUS:passed:0\n",
        stderr: ""
      };
    };
    const cas = await writeSymbolicCasCheckRecord({
      rootPath: root,
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      result: "1",
      maximaCommand: "maxima-test",
      now: new Date("2026-06-12T00:05:00.000Z"),
      runner
    });
    const casRef = cas.jsonPath.slice(root.length + 1).replace(/\\/gu, "/");

    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "sin(x)^2 + cos(x)^2 simplifies to 1.",
      trust: "cross-checked",
      evidenceRefs: [{ kind: "cas", ref: casRef }],
      now: "2026-06-12T00:10:00.000Z"
    });

    expect(written.claim.trust).toBe("cross-checked");
    expect(written.claim.evidenceRefs[0]).toMatchObject({
      kind: "cas",
      ref: casRef,
      trust: "cross-checked",
      summary: "CAS check status: passed."
    });
    expect(written.claim.verification.find((step) => step.stage === "independent-check")).toMatchObject({
      status: "satisfied"
    });
    expect(written.claim.finalization.readyForNarrowClaim).toBe(true);
  });

  it("does not let requested trust outrun attached evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });

    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "This informal argument is a formally proved theorem.",
      trust: "proved",
      evidenceRefs: [{ kind: "other", ref: "notes/informal-sketch" }],
      now: "2026-06-12T00:10:00.000Z"
    });

    expect(written.claim.trust).toBe("unverified");
    expect(written.claim.finalization.readyForNarrowClaim).toBe(false);
    expect(written.claim.finalization.openChecks).toContain(
      "Requested trust proved is not backed by attached evidence; effective claim trust is unverified."
    );
    expect(written.claim.warnings).toContain(
      "Requested trust proved was not recorded as claim trust because attached evidence supports unverified."
    );
  });

  it("records manual evidence trust without letting it finalize the claim", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });

    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "This note proves the Riemann hypothesis.",
      trust: "proved",
      evidenceRefs: [{ kind: "other", ref: "notes/sketch.md", trust: "proved" }],
      now: "2026-06-12T00:10:00.000Z"
    });

    expect(written.claim.trust).toBe("unverified");
    expect(written.claim.finalization.readyForNarrowClaim).toBe(false);
    expect(written.claim.warnings).toContain(
      "Evidence ref other:notes/sketch.md carries manually declared trust proved; attach a resolvable receipt, proof, SMT check, or claim record before it can support finalization."
    );
  });

  it("reads claim records by id and preserves refuted status as non-final", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });
    const receiptsDir = join(root, ".theorem-workbench", "receipts");
    await mkdir(receiptsDir, { recursive: true });
    await writeFile(
      join(receiptsDir, "false-parity.json"),
      `${JSON.stringify(createReceipt("for all integers n, n^2+n+1 is even"), null, 2)}\n`,
      "utf8"
    );
    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "For all integers n, n^2+n+1 is even.",
      trust: "refuted",
      evidenceRefs: [{ kind: "receipt", ref: ".theorem-workbench/receipts/false-parity.json" }],
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

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeSymbolicCasCheckRecord, type CasBackendCommandRunner } from "./cas-backend.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { createReceipt } from "./receipt.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { writeVerifierRoute } from "./verifier-route.js";
import {
  createClaimLedgerGraph,
  createClaimReviewPacket,
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
    const receiptsDir = join(root, ".truth-harness", "receipts");
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
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/base-fraction.json" }],
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
        { kind: "receipt", ref: ".truth-harness/receipts/fraction-sum.json" }
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
    const receiptsDir = join(root, ".truth-harness", "receipts");
    await mkdir(receiptsDir, { recursive: true });
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    await writeFile(join(receiptsDir, "fraction-sum.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "3 / 4 + 5 / 8 equals 11 / 8.",
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/fraction-sum.json" }],
      now: "2026-06-12T00:10:00.000Z"
    });

    expect(written.claim.trust).toBe("exact-computed");
    expect(written.claim.evidenceRefs[0]).toMatchObject({
      kind: "receipt",
      ref: ".truth-harness/receipts/fraction-sum.json",
      trust: "exact-computed",
      summary: "Exact result: 11/8."
    });
    expect(written.claim.finalization.readyForNarrowClaim).toBe(true);
  });

  it("derives claim trust from ready verifier-route evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-12T00:05:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "3 / 4 + 5 / 8 equals 11 / 8.",
      trust: "exact-computed",
      evidenceRefs: [{ kind: "route", ref: route.route.routeId }],
      now: "2026-06-12T00:10:00.000Z"
    });

    expect(written.claim.trust).toBe("exact-computed");
    expect(written.claim.evidenceRefs[0]).toMatchObject({
      kind: "route",
      ref: route.route.routeId,
      trust: "exact-computed"
    });
    expect(written.claim.evidenceRefs[0].summary).toContain("is ready for a narrow exact-computed claim");
    expect(written.claim.finalization.readyForNarrowClaim).toBe(true);
  });

  it("does not finalize claims from not-ready verifier-route evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-12T00:05:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "The Riemann hypothesis is proved.",
      trust: "proved",
      evidenceRefs: [{ kind: "route", ref: route.route.routeId }],
      now: "2026-06-12T00:10:00.000Z"
    });
    const routeWarning = `Verifier route ${route.route.routeId} is not ready for a narrow claim`;

    expect(written.claim.trust).toBe("unverified");
    expect(written.claim.evidenceRefs[0]).toMatchObject({
      kind: "route",
      ref: route.route.routeId,
      trust: "unverified"
    });
    expect(written.claim.evidenceRefs[0].summary).toContain(routeWarning);
    expect(written.claim.finalization.readyForNarrowClaim).toBe(false);
    expect(written.claim.finalization.openChecks.some((check) => check.includes(routeWarning))).toBe(true);
    expect(written.claim.warnings.some((warning) => warning.includes(routeWarning))).toBe(true);

    const review = await createClaimReviewPacket({ rootPath: root, claimRef: written.claim.claimId });

    expect(review.reviewStatus).toBe("blocked");
    expect(review.readyForNarrowClaim).toBe(false);
    expect(review.blockingChecks.some((check) => check.includes(routeWarning))).toBe(true);
    expect(review.nextActions.some((action) => action.kind === "run-verifier-route")).toBe(true);
    expect(review.commands.reviewJson).toContain("truth-harness claim review");
    expect(review.markdown).toContain("## Agent Next Actions");
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
        stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n",
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

  it("does not derive proved claim trust from malformed proof-check JSON", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });
    const proofRef = ".truth-harness/proofs/forged-proof.json";
    await mkdir(join(root, ".truth-harness", "proofs"), { recursive: true });
    await writeFile(
      join(root, proofRef),
      `${JSON.stringify({
        schemaVersion: "truth-harness.proof-check.v0",
        checkId: "proof_0123456789abcdef",
        backend: { acceptedProofChecker: true },
        status: "accepted",
        trust: "proved",
        proofCheckerBacked: true
      })}\n`,
      "utf8"
    );

    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "This malformed proof-check artifact proves the truth-harness.",
      trust: "proved",
      evidenceRefs: [{ kind: "proof", ref: proofRef }],
      now: "2026-06-12T00:10:00.000Z"
    });

    expect(written.claim.trust).toBe("unverified");
    expect(written.claim.evidenceRefs[0]).toMatchObject({
      kind: "proof",
      ref: proofRef
    });
    expect(written.claim.evidenceRefs[0].trust).toBeUndefined();
    expect(written.claim.warnings).toContain(
      `Could not resolve trust for evidence ref proof:${proofRef}; it cannot support finalization yet.`
    );
    expect(written.claim.finalization.openChecks).toContain(
      "Requested trust proved is not backed by attached evidence; effective claim trust is unverified."
    );
  });

  it("does not derive engine claim trust from malformed CAS or SMT JSON", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });
    const casRef = ".truth-harness/cas/forged-cas.json";
    const smtRef = ".truth-harness/smt/forged-smt.json";
    await mkdir(join(root, ".truth-harness", "cas"), { recursive: true });
    await mkdir(join(root, ".truth-harness", "smt"), { recursive: true });
    await writeFile(
      join(root, casRef),
      `${JSON.stringify({
        schemaVersion: "truth-harness.cas-check.v0",
        checkId: "cas_0123456789abcdef",
        status: "passed",
        trust: "cross-checked",
        proofCheckerBacked: false
      })}\n`,
      "utf8"
    );
    await writeFile(
      join(root, smtRef),
      `${JSON.stringify({
        schemaVersion: "truth-harness.smt-check.v0",
        checkId: "smt_0123456789abcdef",
        status: "sat",
        trust: "smt-checked",
        proofCheckerBacked: false
      })}\n`,
      "utf8"
    );

    const casClaim = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "The forged CAS record cross-checks the symbolic result.",
      trust: "cross-checked",
      evidenceRefs: [{ kind: "cas", ref: casRef }],
      now: "2026-06-12T00:10:00.000Z"
    });
    const smtClaim = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "The forged SMT record checks the encoded constraints.",
      trust: "smt-checked",
      evidenceRefs: [{ kind: "smt", ref: smtRef }],
      now: "2026-06-12T00:11:00.000Z"
    });

    expect(casClaim.claim.trust).toBe("unverified");
    expect(casClaim.claim.evidenceRefs[0].trust).toBeUndefined();
    expect(casClaim.claim.warnings).toContain(
      `Could not resolve trust for evidence ref cas:${casRef}; it cannot support finalization yet.`
    );
    expect(smtClaim.claim.trust).toBe("unverified");
    expect(smtClaim.claim.evidenceRefs[0].trust).toBeUndefined();
    expect(smtClaim.claim.warnings).toContain(
      `Could not resolve trust for evidence ref smt:${smtRef}; it cannot support finalization yet.`
    );
  });

  it("does not let requested trust outrun attached evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-12T00:00:00.000Z" });

    const written = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "This informal argument is a formally proved truth-harness.",
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
    const receiptsDir = join(root, ".truth-harness", "receipts");
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
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/false-parity.json" }],
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
  const root = await mkdtemp(join(tmpdir(), "truth-harness-claim-ledger-"));
  roots.push(root);
  return root;
}

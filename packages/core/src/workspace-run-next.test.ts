import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { createCredibilityPack } from "./credibility-pack.js";
import { listWorkspaceEvents } from "./event-log.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeLeanProofCheckRecord, type ProofBackendCommandRunner } from "./proof-backend.js";
import { writeReportDraft } from "./report-draft.js";
import { addResearchSessionCheckpoint, readResearchSession, writeResearchHarness } from "./research-session.js";
import { listValidationPlans } from "./validation-plan.js";
import { listWorkspaceSnapshots } from "./workspace-snapshot.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import {
  createWorkspaceReviewFromCredibilityPack,
  createWorkspaceRunNextPlan,
  inspectWorkspaceRunNextPlan,
  listWorkspaceRunNextPlans,
  readWorkspaceRunNextPlan,
  writeWorkspaceRunNextPlan
} from "./workspace-run-next.js";
import { createWorkspaceReview, type WorkspaceReview } from "./workspace-review.js";
import { writeVerifierRoute } from "./verifier-route.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace run-next", () => {
  it("prioritizes linked validation-plan gates before generic session work", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "Prove or refute the reusable invariant for a deterministic robotics simulation kernel.",
      domains: ["math", "physics", "code"],
      tasks: ["Tune the future renderer after proof gates are closed."],
      now: "2026-06-18T00:01:00.000Z"
    });
    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-18T00:02:00.000Z"
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-18T00:03:00.000Z"
    });

    expect(review.items[0]).toMatchObject({
      kind: "validation-gate",
      priority: "critical",
      sessionId: harness.session.sessionId,
      validationPlanId: harness.validationPlan?.plan.planId,
      validationGateKind: "proof"
    });
    expect(review.items[0]?.evidenceSlots?.[0]).toMatchObject({
      label: "Validation gate evidence",
      attachTo: {
        sessionId: harness.session.sessionId,
        validationPlanId: harness.validationPlan?.plan.planId
      }
    });
    expect(plan.item).toMatchObject({
      kind: "validation-gate",
      validationPlanId: harness.validationPlan?.plan.planId,
      validationGateKind: "proof"
    });
    expect(plan.item?.command).toContain("truth-harness verify");

    const executed = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:04:00.000Z"
    });
    const reopened = await readResearchSession(root, harness.session.sessionId);

    expect(executed.status).toBe("executed");
    expect(executed.execution).toMatchObject({
      kind: "verifier-route",
      attached: true
    });
    expect(executed.execution.evidenceRef).toContain("route:.truth-harness/routes/");
    expect(executed.execution.result).toMatchObject({
      validationGate: {
        planId: harness.validationPlan?.plan.planId,
        status: "in-progress",
        closed: false,
        satisfied: false,
        blocked: false
      }
    });
    expect(reopened.evidenceRefs).toContainEqual(
      expect.objectContaining({ kind: "route", ref: expect.stringMatching(/^route_[a-f0-9]{16}$/u) })
    );
  });

  it("closes a linked validation proof gate when run-next writes satisfying route evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-18T00:02:00.000Z"
    });
    const executed = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:03:00.000Z"
    });
    const plans = await listValidationPlans(root);
    const updatedPlan = plans.find((plan) => plan.planId === harness.validationPlan?.plan.planId);
    const proofGate = updatedPlan?.gates.find((gate) => gate.kind === "proof");

    expect(executed.execution).toMatchObject({
      kind: "verifier-route",
      attached: true,
      result: {
        validationGate: {
          planId: harness.validationPlan?.plan.planId,
          status: "satisfied",
          closed: true,
          satisfied: true,
          blocked: false
        }
      }
    });
    expect(proofGate).toMatchObject({
      status: "satisfied",
      evidenceRefs: [expect.objectContaining({ kind: "route", trust: "exact-computed" })]
    });
  });

  it("attaches direct proof-check artifacts to linked validation gates without overclaiming", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const validationPlan = harness.validationPlan?.plan;
    const proofGate = validationPlan?.gates.find((gate) => gate.kind === "proof");
    if (!proofGate) {
      throw new Error("Expected a proof gate in math validation plan.");
    }
    await mkdir(join(root, "proofs"), { recursive: true });
    await writeFile(join(root, "proofs", "scoped.lean"), "theorem scoped_fixture : True := by trivial\n", "utf8");
    const review = minimalReview({
      rootPath: root,
      command:
        'truth-harness proof check proofs/scoped.lean --write --statement "3 / 4 + 5 / 8" --lean-command truth-harness-missing-lean --timeout-ms 50',
      claimId: "claim_validation_test",
      kind: "validation-gate",
      validationPlanId: validationPlan?.planId,
      validationGateId: proofGate.gateId,
      validationGateKind: proofGate.kind,
      sessionId: harness.session.sessionId,
      domain: "math"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:02:00.000Z"
    });
    const plans = await listValidationPlans(root);
    const updatedPlan = plans.find((candidate) => candidate.planId === validationPlan?.planId);
    const updatedGate = updatedPlan?.gates.find((gate) => gate.gateId === proofGate.gateId);
    const updatedSession = await readResearchSession(root, harness.session.sessionId);

    expect(plan.status).toBe("executed");
    expect(plan.execution).toMatchObject({
      kind: "proof-check",
      attached: true,
      result: {
        proof: {
          trust: "unverified",
          status: "backend-unavailable",
          scope: {
            statement: "3 / 4 + 5 / 8"
          }
        },
        attachment: {
          validationGate: {
            satisfied: false,
            blocked: false,
            gate: {
              gateId: proofGate.gateId,
              status: "in-progress"
            },
            evidence: {
              kind: "proof",
              trust: "unverified",
              claimScope: {
                status: "matched"
              }
            }
          },
          checkpoint: {
            summary: `Ran proof checker evidence for ${proofGate.gateId}.`,
            evidenceRefs: [expect.objectContaining({ kind: "proof", trust: "unverified" })]
          }
        }
      }
    });
    expect(plan.execution.summary).toContain("remains open");
    expect(updatedGate).toMatchObject({
      status: "in-progress",
      evidenceRefs: [expect.objectContaining({ kind: "proof", trust: "unverified" })],
      nextChecks: expect.arrayContaining([
        "Proof check was not accepted; attach an accepted proof-check record before closing this gate."
      ])
    });
    expect(updatedSession.evidenceRefs).toContainEqual(expect.objectContaining({ kind: "proof", trust: "unverified" }));
    expect(updatedSession.checkpoints).toContainEqual(
      expect.objectContaining({
        summary: `Ran proof checker evidence for ${proofGate.gateId}.`,
        evidenceRefs: [expect.objectContaining({ kind: "proof", trust: "unverified" })],
        decisions: [expect.stringContaining("remains open")]
      })
    );
  });

  it("executes validation attach commands for existing scoped proof artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const validationPlan = harness.validationPlan?.plan;
    const proofGate = validationPlan?.gates.find((gate) => gate.kind === "proof");
    if (!validationPlan || !proofGate) {
      throw new Error("Expected a linked math validation plan with a proof gate.");
    }

    await mkdir(join(root, "proofs"), { recursive: true });
    await writeFile(join(root, "proofs", "scoped.lean"), "theorem scoped_fixture : True := by trivial\n", "utf8");
    const proofRunner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
      }

      return { status: 0, stdout: "", stderr: "" };
    };
    const proof = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "proofs/scoped.lean",
      scope: { statement: "3 / 4 + 5 / 8" },
      runner: proofRunner,
      now: new Date("2026-06-18T00:02:00.000Z")
    });
    const proofRef = relative(root, proof.jsonPath).replace(/\\/gu, "/");
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness validation attach ${validationPlan.planId} ${proofGate.gateId} --evidence proof:${proofRef} --json`,
      claimId: "claim_validation_attach_test",
      kind: "validation-gate",
      validationPlanId: validationPlan.planId,
      validationGateId: proofGate.gateId,
      validationGateKind: proofGate.kind,
      sessionId: harness.session.sessionId,
      domain: "math"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:03:00.000Z"
    });
    const updatedPlans = await listValidationPlans(root);
    const updatedGate = updatedPlans
      .find((candidate) => candidate.planId === validationPlan.planId)
      ?.gates.find((gate) => gate.gateId === proofGate.gateId);
    const updatedSession = await readResearchSession(root, harness.session.sessionId);

    expect(plan.status).toBe("executed");
    expect(plan.execution).toMatchObject({
      kind: "validation-attach",
      evidenceRef: `proof:${proofRef}`,
      attached: true,
      result: {
        validationGate: {
          satisfied: true,
          blocked: false,
          gate: {
            gateId: proofGate.gateId,
            status: "satisfied",
            evidenceRefs: [expect.objectContaining({ kind: "proof", ref: proofRef, trust: "proved" })]
          },
          evidence: {
            kind: "proof",
            trust: "proved",
            claimScope: {
              status: "matched"
            }
          }
        },
        checkpoint: {
          summary: `Ran proof checker evidence for ${proofGate.gateId}.`,
          evidenceRefs: [expect.objectContaining({ kind: "proof", ref: proofRef, trust: "proved" })]
        }
      }
    });
    expect(plan.execution.summary).toContain("satisfied by proved proof evidence");
    expect(plan.execution.summary).toContain(`Checkpointed research session ${harness.session.sessionId}.`);
    expect(updatedGate).toMatchObject({
      status: "satisfied",
      evidenceRefs: [expect.objectContaining({ kind: "proof", ref: proofRef, trust: "proved" })]
    });
    expect(updatedSession.evidenceRefs).toContainEqual(expect.objectContaining({ kind: "proof", ref: proofRef, trust: "proved" }));
    expect(updatedSession.checkpoints).toContainEqual(
      expect.objectContaining({
        summary: `Ran proof checker evidence for ${proofGate.gateId}.`,
        evidenceRefs: [expect.objectContaining({ kind: "proof", ref: proofRef, trust: "proved" })],
        nextChecks: [expect.stringContaining("rerun workspace run-next")]
      })
    );
  });

  it("executes generated candidate-evidence validation attach actions", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const validationPlan = harness.validationPlan?.plan;
    const proofGate = validationPlan?.gates.find((gate) => gate.kind === "proof");
    if (!validationPlan || !proofGate) {
      throw new Error("Expected a linked math validation plan with a proof gate.");
    }

    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: harness.session.sessionId,
      summary: "Earlier unverified proof attempt should not outrank accepted proof evidence.",
      evidenceRefs: [{ kind: "proof", ref: ".truth-harness/proofs/unverified-attempt.json", trust: "unverified" }],
      nextChecks: ["Attach accepted proof evidence when available."],
      now: "2026-06-18T00:01:30.000Z"
    });
    await mkdir(join(root, "proofs"), { recursive: true });
    await writeFile(join(root, "proofs", "candidate.lean"), "theorem candidate_fixture : True := by trivial\n", "utf8");
    const proofRunner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
      }

      return { status: 0, stdout: "", stderr: "" };
    };
    const proof = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "proofs/candidate.lean",
      scope: { statement: "3 / 4 + 5 / 8" },
      runner: proofRunner,
      now: new Date("2026-06-18T00:02:00.000Z")
    });
    const proofRef = relative(root, proof.jsonPath).replace(/\\/gu, "/");
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: harness.session.sessionId,
      summary: "Accepted proof artifact is ready for validation gate attachment.",
      evidenceRefs: [{ kind: "proof", ref: proofRef, trust: "proved" }],
      nextChecks: ["Attach the proof artifact to the linked validation gate."],
      now: "2026-06-18T00:03:00.000Z"
    });
    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-18T00:04:00.000Z"
    });

    const executed = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:05:00.000Z"
    });
    const plans = await listValidationPlans(root);
    const updatedGate = plans
      .find((candidate) => candidate.planId === validationPlan.planId)
      ?.gates.find((gate) => gate.gateId === proofGate.gateId);

    expect(review.items[0]).toMatchObject({
      kind: "validation-gate",
      command: `truth-harness validation attach ${validationPlan.planId} ${proofGate.gateId} --evidence proof:${proofRef} --json`
    });
    expect(review.items[0]?.candidateEvidenceRefs?.[0]).toMatchObject({
      kind: "proof",
      ref: proofRef,
      trust: "proved"
    });
    expect(review.items[0]?.candidateEvidenceRefs?.[1]).toMatchObject({
      kind: "proof",
      ref: ".truth-harness/proofs/unverified-attempt.json",
      trust: "unverified"
    });
    expect(executed).toMatchObject({
      status: "executed",
      execution: {
        kind: "validation-attach",
        evidenceRef: `proof:${proofRef}`,
        result: {
          validationGate: {
            satisfied: true,
            gate: {
              gateId: proofGate.gateId,
              status: "satisfied"
            }
          }
        }
      }
    });
    expect(updatedGate).toMatchObject({
      status: "satisfied",
      evidenceRefs: [expect.objectContaining({ kind: "proof", ref: proofRef, trust: "proved" })]
    });

    const afterClosureReview = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-18T00:06:00.000Z"
    });
    const afterClosurePlan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review: afterClosureReview,
      executeLocal: false,
      now: "2026-06-18T00:07:00.000Z"
    });

    expect(afterClosureReview.items).not.toContainEqual(expect.objectContaining({ validationGateId: proofGate.gateId }));
    expect(afterClosurePlan.item?.validationGateId).not.toBe(proofGate.gateId);
  });

  it("blocks validation attach commands that target a different review gate", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const validationPlan = harness.validationPlan?.plan;
    const proofGate = validationPlan?.gates.find((gate) => gate.kind === "proof");
    if (!validationPlan || !proofGate) {
      throw new Error("Expected a linked math validation plan with a proof gate.");
    }
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness validation attach ${validationPlan.planId} gate_wrong --evidence proof:.truth-harness/proofs/example.json --json`,
      claimId: "claim_validation_attach_mismatch_test",
      kind: "validation-gate",
      validationPlanId: validationPlan.planId,
      validationGateId: proofGate.gateId,
      validationGateKind: proofGate.kind,
      sessionId: harness.session.sessionId,
      domain: "math"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:02:00.000Z"
    });

    expect(plan.status).toBe("blocked");
    expect(plan.execution).toMatchObject({
      kind: "validation-attach",
      summary: `Validation attach command targets gate_wrong, but the review item targets ${proofGate.gateId}.`
    });
  });

  it("executes bounded local actions without honoring command workspace overrides", async () => {
    const root = await tempRoot();
    const outsideRoot = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "A finance claim needs audited source data before it can be relied on.",
      domain: "finance",
      nextChecks: ["Attach audited source data before using this claim."],
      now: "2026-06-14T00:01:00.000Z"
    });
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness claim review ${claim.claim.claimId} --workspace ${outsideRoot} --json`,
      claimId: claim.claim.claimId
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(plan.localOnly).toBe(true);
    expect(plan.networkAccess).toBe("none");
    expect(plan.status).toBe("executed");
    expect(plan.execution.kind).toBe("claim-review");
    expect(plan.execution.result).toMatchObject({
      claimId: claim.claim.claimId,
      workspacePath: root
    });
  });

  it("executes claim-add review actions to supersede blocked claims with ready route evidence", async () => {
    const root = await tempRoot();
    const outsideRoot = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      title: "Common denominator lemma",
      statement: "\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{6}{8}",
      domain: "math",
      now: "2026-06-18T00:01:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{6}{8}",
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50,
      now: new Date("2026-06-18T00:02:00.000Z")
    });
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness claim add "\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{6}{8}" --workspace ${outsideRoot} --title "Common denominator lemma" --domain math --supersedes ${claim.claim.claimId} --evidence route:${route.route.routeId} --trust exact-computed --json`,
      claimId: claim.claim.claimId,
      domain: "math"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:03:00.000Z"
    });
    const refreshedReview = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 2,
      maxSessions: 0,
      now: "2026-06-18T00:04:00.000Z"
    });

    expect(plan.localOnly).toBe(true);
    expect(plan.networkAccess).toBe("none");
    expect(plan.status).toBe("executed");
    expect(plan.execution).toMatchObject({
      kind: "claim-add",
      evidenceRef: expect.stringMatching(/^claim:claim_[a-f0-9]{16}$/u),
      attached: true,
      result: {
        claim: {
          statement: "\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{6}{8}",
          title: "Common denominator lemma",
          domain: "math",
          trust: "exact-computed",
          supersedes: [claim.claim.claimId],
          evidenceRefs: [expect.objectContaining({ kind: "route", ref: route.route.routeId })],
          finalization: {
            readyForNarrowClaim: true
          }
        },
        jsonPath: expect.stringContaining(".truth-harness/claims/")
      }
    });
    expect(plan.execution.summary).toContain(`superseding ${claim.claim.claimId}`);
    expect(refreshedReview.items.some((item) => item.claimId === claim.claim.claimId)).toBe(false);
  });

  it("blocks claim-add review actions that supersede a different claim", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "A claim should not be superseded by the wrong review item.",
      domain: "math",
      now: "2026-06-18T00:01:00.000Z"
    });
    const review = minimalReview({
      rootPath: root,
      command: 'truth-harness claim add "A claim should not be superseded by the wrong review item." --domain math --supersedes claim_0000000000000000 --json',
      claimId: claim.claim.claimId,
      domain: "math"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:02:00.000Z"
    });

    expect(plan.status).toBe("blocked");
    expect(plan.execution).toMatchObject({
      kind: "claim-add",
      summary: `Claim add command supersedes claim_0000000000000000, but the review item targets ${claim.claim.claimId}.`
    });
  });

  it("blocks queued commands that require shell interpretation", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness claim review claim_fake ; echo unsafe",
      claimId: "claim_fake"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(plan.status).toBe("blocked");
    expect(plan.execution.kind).toBe("unsupported-command");
    expect(plan.execution.summary).toContain("Unsupported shell metacharacter");
  });

  it("blocks Docker reviewer gates with an explicit manual boundary", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command: "npm run docker:engines",
      claimId: "claim_fake"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(plan.status).toBe("blocked");
    expect(plan.execution.kind).toBe("manual-container-gate");
    expect(plan.execution.summary).toContain("does not execute npm, Docker, or shell commands");
  });

  it("blocks unavailable SMT backends before writing unverified retry noise", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await mkdir(join(root, "docs", "examples"), { recursive: true });
    await writeFile(
      join(root, "docs", "examples", "constraints.smt2"),
      "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      "utf8"
    );
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness smt check docs/examples/constraints.smt2 --write --z3-command truth-harness-missing-z3-command",
      claimId: "claim_fake",
      kind: "route-obligation",
      routeId: "route_smt_unavailable_test",
      obligationId: "obl_smt_unavailable_test",
      obligationKind: "solver-encoding"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });
    const smtFiles = await readdir(join(root, ".truth-harness", "smt")).catch(() => []);

    expect(plan.status).toBe("blocked");
    expect(plan.execution.kind).toBe("smt-check");
    expect(plan.execution.summary).toContain("Local z3 SMT backend is not available");
    expect(plan.execution.summary).toContain("npm run docker:cli -- smt check docs/examples/constraints.smt2 -- --write");
    expect(plan.execution.evidenceRef).toBeUndefined();
    expect(smtFiles).toEqual([]);
  });

  it("reads saved report drafts through run-next without honoring command workspace overrides", async () => {
    const root = await tempRoot();
    const outsideRoot = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await initLocalWorkspace(outsideRoot, { now: "2026-06-14T00:00:00.000Z" });
    const report = await writeReportDraft({
      rootPath: root,
      title: "Run Next Report",
      markdown: "# Run Next Report\n\nLocal report reads stay inside the selected root.\n",
      now: "2026-06-14T00:01:00.000Z"
    });
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness workspace report ${report.report.reportId} ${outsideRoot} --json`,
      claimId: "claim_fake",
      reportId: report.report.reportId,
      kind: "report-draft-review"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(plan.status).toBe("executed");
    expect(plan.item).toMatchObject({
      kind: "report-draft-review",
      reportId: report.report.reportId
    });
    expect(plan.execution).toMatchObject({
      kind: "report-read",
      evidenceRef: `report:${report.report.reportId}`,
      attached: false
    });
    expect(plan.execution.summary).toContain("Markdown verification is passing");
    expect(plan.execution.result).toMatchObject({
      report: {
        reportId: report.report.reportId,
        title: "Run Next Report"
      },
      markdownVerified: true
    });
  });

  it("executes engine verification actions without shell execution", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness engines verify --write --require-maxima --maxima-command truth-harness-missing-maxima-command --timeout-ms 50",
      claimId: "claim_fake"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(plan.status).toBe("executed");
    expect(plan.execution.kind).toBe("engine-verify");
    expect(plan.execution.evidenceRef).toContain("engine-run:.truth-harness/engine-runs/");
    expect(plan.execution.summary).toContain("Wrote engine verification run");
    expect(plan.execution.result).toMatchObject({
      schemaVersion: "truth-harness.engine-run.v0",
      status: "failed",
      report: {
        requiredTotal: 1,
        requiredPassed: 0
      }
    });
  });

  it("executes adversarial benchmark actions without shell execution", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await writeBenchmarkSuite(root);
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      claimId: "claim_fake"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });
    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-14T00:03:00.000Z",
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      timeoutMs: 50
    });

    expect(plan.status).toBe("executed");
    expect(plan.execution.kind).toBe("benchmark-run");
    expect(plan.execution.evidenceRef).toContain("benchmark:.truth-harness/benchmarks/");
    expect(plan.execution.summary).toContain("Wrote benchmark run");
    expect(plan.execution.result).toMatchObject({
      schemaVersion: "truth-harness.benchmark-run.v0",
      suite: { suiteId: "ai-failure-seed" },
      totals: { total: 1, passed: 1, failed: 0, trustAccuracy: 1 },
      replay: {
        command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures"
      }
    });
    expect(pack.summary.latestAdversarialBenchmarkStatus).toBe("passed");
    expect(pack.benchmarkLedger.latestAdversarialRun).toMatchObject({
      suiteId: "ai-failure-seed",
      failed: 0,
      replayCommand: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      receiptReplays: expect.arrayContaining([
        expect.stringContaining('truth-harness ask "for all integers n, n^2+n+1 is even" --json')
      ])
    });
    expect(pack.markdown).toContain("Receipt replay examples:");
  });

  it("adapts credibility action queues into run-next plans", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-14T00:01:00.000Z",
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      timeoutMs: 50,
      engineRequirements: { maxima: true },
      maximaCommand: "truth-harness-missing-maxima-command"
    });
    const review = createWorkspaceReviewFromCredibilityPack({ rootPath: root, pack });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(review.autonomy.nextCommand).toBe(
      "truth-harness engines verify --write --require-maxima --timeout-ms 50 --maxima-command truth-harness-missing-maxima-command"
    );
    expect(review.items[0]).toMatchObject({
      kind: "credibility-action",
      title: "Close required Maxima symbolic cross-check gate"
    });
    expect(plan.item).toMatchObject({
      kind: "credibility-action",
      command: "truth-harness engines verify --write --require-maxima --timeout-ms 50 --maxima-command truth-harness-missing-maxima-command"
    });
    expect(plan.execution.kind).toBe("dry-run");
    expect(plan.warnings.join(" ")).toContain("never executes shell strings");
  });

  it("does not select passive-only review blockers as run-next targets", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "solve integer constraints x > 0 and x < 3",
      now: new Date("2026-06-14T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const stored = JSON.parse(await readFile(route.jsonPath, "utf8")) as {
      proofObligations: Array<Record<string, unknown>>;
    };
    stored.proofObligations = [
      {
        ...stored.proofObligations[0],
        kind: "formal-proof",
        status: "open",
        severity: "critical",
        title: "Formal proof-checker obligation",
        requiredBefore: "Before labeling this scoped claim proved.",
        command: "truth-harness proof check docs/examples/trivial.lean --write"
      }
    ];
    await writeFile(route.jsonPath, JSON.stringify(stored, null, 2), "utf8");

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-14T00:02:00.000Z"
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:03:00.000Z"
    });

    expect(review.items).toEqual([]);
    expect(review.autonomy).toMatchObject({
      mode: "idle",
      canRunUnattended: false,
      nextCommand: undefined
    });
    expect(review.warnings).toContainEqual(expect.stringContaining("1 passive route obligation remains on verifier routes"));
    expect(plan.status).toBe("blocked");
    expect(plan.item).toBeUndefined();
    expect(plan.execution).toMatchObject({
      status: "blocked",
      kind: "no-open-item",
      summary: expect.stringContaining("No open workspace review item")
    });
    expect(plan.idleNextActions).toEqual([
      expect.objectContaining({
        actionId: "start-validation-backed-harness",
        command: expect.stringContaining("truth-harness research harness"),
        requiresHumanInput: true
      }),
      expect.objectContaining({
        actionId: "refresh-professor-review",
        command: expect.stringContaining("truth-harness workspace credibility-pack"),
        requiresHumanInput: false
      }),
      expect.objectContaining({
        actionId: "refresh-release-audit",
        command: expect.stringContaining("truth-harness workspace release-audit"),
        requiresHumanInput: false
      })
    ]);
  });

  it("writes dry-run plans into findings with a local artifact event", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command:
        "truth-harness validation attach vpl_run_next_test gate_proof_run_next_test --evidence proof:.truth-harness/proofs/candidate.json --json",
      claimId: "claim_fake",
      kind: "validation-gate",
      validationPlanId: "vpl_run_next_test",
      validationGateId: "gate_proof_run_next_test",
      validationGateKind: "proof"
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:02:00.000Z"
    });

    const result = await writeWorkspaceRunNextPlan({ rootPath: root, plan });

    expect(result.plan.planId).toMatch(/^wrn_[a-f0-9]{8}$/u);
    expect(result.jsonPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(result.markdownPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(result.markdown).toContain("# Truth Harness Run-Next Plan");
    expect(result.markdown).toContain("## Why This Action");
    expect(result.markdown).toContain("| Target | validation proof gate_proof_run_next_test |");
    expect(result.markdown).toContain("| Candidate evidence | proof:.truth-harness/proofs/candidate.json |");
    expect(result.markdown).toContain("It is not proof, not a trust-label upgrade");
    const parsed = JSON.parse(await readFile(result.jsonPath, "utf8")) as {
      schemaVersion?: string;
      planId?: string;
      dryRun?: boolean;
      rationale?: { target?: string; candidateEvidenceRef?: string; executionBoundary?: string };
      sourceSnapshot?: { snapshotId?: string; path?: string; totalFiles?: number; totalBytes?: number };
    };
    expect(parsed).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      planId: result.plan.planId,
      dryRun: true,
      rationale: {
        target: "validation proof gate_proof_run_next_test",
        candidateEvidenceRef: "proof:.truth-harness/proofs/candidate.json"
      }
    });
    expect(parsed.rationale?.executionBoundary).toContain("Dry-run only");
    expect(parsed.sourceSnapshot).toMatchObject({
      snapshotId: expect.stringMatching(/^snap_[a-f0-9]{16}$/u),
      path: expect.stringContaining(".truth-harness/snapshots/"),
      totalFiles: expect.any(Number),
      totalBytes: expect.any(Number)
    });
    const snapshots = await listWorkspaceSnapshots(root);
    expect(snapshots).toContainEqual(
      expect.objectContaining({
        snapshotId: parsed.sourceSnapshot?.snapshotId,
        path: parsed.sourceSnapshot?.path
      })
    );
    const list = await listWorkspaceRunNextPlans(root);
    expect(list).toContainEqual(
      expect.objectContaining({
        planId: result.plan.planId,
        path: expect.stringContaining(`${result.plan.planId}-workspace-run-next.json`),
        dryRun: true,
        executionKind: "dry-run",
        rationaleTarget: "validation proof gate_proof_run_next_test",
        rationaleCandidateEvidenceRef: "proof:.truth-harness/proofs/candidate.json",
        rationaleExecutionBoundary: expect.stringContaining("Dry-run only"),
        sourceSnapshotId: parsed.sourceSnapshot?.snapshotId,
        sourceSnapshotPath: parsed.sourceSnapshot?.path,
        resumeDecision: expect.objectContaining({
          safeToResume: false,
          status: "verify-snapshot-first",
          action: "verify-source-snapshot"
        })
      })
    );
    const verifiedList = await listWorkspaceRunNextPlans(root, {
      verifySnapshots: true,
      now: "2026-06-14T00:03:00.000Z"
    });
    expect(verifiedList).toContainEqual(
      expect.objectContaining({
        planId: result.plan.planId,
        sourceSnapshotStatus: "verified",
        sourceSnapshotAdded: 0,
        sourceSnapshotChanged: 0,
        sourceSnapshotMissing: 0,
        sourceSnapshotIgnoredAdded: 2,
        sourceSnapshotDriftSummary: expect.stringContaining("still matches"),
        resumeDecision: expect.objectContaining({
          safeToResume: true,
          status: "safe-to-resume",
          action: "run-selected-command"
        })
      })
    );
    expect(await readWorkspaceRunNextPlan(root, result.plan.planId)).toMatchObject({
      planId: result.plan.planId,
      reviewId: review.reviewId
    });
    expect(await readWorkspaceRunNextPlan(root, list[0]?.path ?? "")).toMatchObject({
      planId: result.plan.planId
    });
    const inspected = await inspectWorkspaceRunNextPlan(root, result.plan.planId, {
      verifySnapshot: true,
      now: "2026-06-14T00:03:30.000Z"
    });
    expect(inspected).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next-inspection.v0",
      path: expect.stringContaining(`${result.plan.planId}-workspace-run-next.json`),
      plan: {
        planId: result.plan.planId
      },
      resumeDecision: {
        safeToResume: true,
        status: "safe-to-resume",
        action: "run-selected-command",
        nextCommand:
          "truth-harness validation attach vpl_run_next_test gate_proof_run_next_test --evidence proof:.truth-harness/proofs/candidate.json --json"
      },
      sourceSnapshot: {
        sourceSnapshotStatus: "verified",
        sourceSnapshotAdded: 0,
        sourceSnapshotChanged: 0,
        sourceSnapshotMissing: 0,
        sourceSnapshotIgnoredAdded: 2
      }
    });
    const validation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(validation.passed).toBe(true);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.plan.planId,
        schemaVersion: "truth-harness.workspace-run-next.v0",
        expectedSchemaVersion: "truth-harness.workspace-run-next.v0",
        issueCodes: []
      })
    );
    const events = await listWorkspaceEvents(root, 10);
    expect(events.events).toContainEqual(
      expect.objectContaining({
        action: "artifact-written",
        kind: "findings",
        artifactId: result.plan.planId,
        localOnly: true,
        networkAccess: "none"
      })
    );

    await writeFile(join(root, ".truth-harness", "findings", "manual-drift.txt"), "drift\n", "utf8");
    const driftedList = await listWorkspaceRunNextPlans(root, {
      verifySnapshots: true,
      now: "2026-06-14T00:04:00.000Z"
    });
    expect(driftedList).toContainEqual(
      expect.objectContaining({
        planId: result.plan.planId,
        sourceSnapshotStatus: "drifted",
        sourceSnapshotAdded: 1,
        sourceSnapshotDriftSummary: expect.stringContaining("1 added"),
        resumeDecision: expect.objectContaining({
          safeToResume: false,
          status: "rerun-run-next",
          action: "rerun-workspace-run-next"
        })
      })
    );
    const driftedInspection = await inspectWorkspaceRunNextPlan(root, result.plan.planId, {
      verifySnapshot: true,
      now: "2026-06-14T00:04:30.000Z"
    });
    expect(driftedInspection.sourceSnapshot).toMatchObject({
      sourceSnapshotStatus: "drifted",
      sourceSnapshotAdded: 1,
      sourceSnapshotDriftSummary: expect.stringContaining("1 added")
    });
    expect(driftedInspection.resumeDecision).toMatchObject({
      safeToResume: false,
      status: "rerun-run-next",
      action: "rerun-workspace-run-next",
      nextCommand: `truth-harness workspace run-next ${root} --json`
    });

    const tamperedPlan = JSON.parse(await readFile(result.jsonPath, "utf8")) as Record<string, unknown>;
    tamperedPlan.localOnly = false;
    await writeFile(result.jsonPath, `${JSON.stringify(tamperedPlan, null, 2)}\n`, "utf8");
    const tamperedValidation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(tamperedValidation.passed).toBe(false);
    expect(tamperedValidation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.plan.planId,
        schemaVersion: "truth-harness.workspace-run-next.v0",
        issueCodes: expect.arrayContaining(["invalid-artifact-schema"])
      })
    );
  });

  it("rejects malformed run-next handoff packets before writing findings", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness proof check docs/examples/trivial.lean --write",
      claimId: "claim_fake"
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:02:00.000Z"
    });

    await expect(
      writeWorkspaceRunNextPlan({
        rootPath: root,
        plan: {
          ...plan,
          createdAt: "not-a-date"
        }
      })
    ).rejects.toThrow("Workspace run-next plan failed JSON Schema validation before write");

    await expect(listWorkspaceRunNextPlans(root)).resolves.toEqual([]);
  });
});

function minimalReview(input: {
  rootPath: string;
  command: string;
  claimId: string;
  kind?: WorkspaceReview["items"][number]["kind"];
  reportId?: string;
  validationPlanId?: string;
  validationGateId?: string;
  validationGateKind?: string;
  routeId?: string;
  obligationId?: string;
  obligationKind?: WorkspaceReview["items"][number]["obligationKind"];
  sessionId?: string;
  domain?: string;
}): WorkspaceReview {
  const kind = input.kind ?? "claim-blocker";
  return {
    schemaVersion: "truth-harness.workspace-review.v0",
    reviewId: "wrev_run_next_test",
    projectId: "proj_run_next_test",
    createdAt: "2026-06-14T00:01:00.000Z",
    workspacePath: input.rootPath,
    localOnly: true,
    networkAccess: "none",
    privacy: {
      mode: "local-only",
      localFirst: true,
      networkAccess: "none",
      dataResidency: "local-workspace",
      externalDisclosures: []
    },
    summary: {
      routes: 0,
      claims: 1,
      sessions: 0,
      reportDrafts: input.reportId ? 1 : 0,
      totalItems: 1,
      routeObligations: 0,
      readyRoutesWithoutClaims: 0,
      blockedClaims: 1,
      reportDraftReviewItems: input.reportId ? 1 : 0,
      reportDraftsNeedingAttention: 0,
      sessionTasks: 0,
      sessionNextChecks: 0,
      criticalItems: 0,
      highItems: 1,
      mediumItems: 0,
      lowItems: 0
    },
    autonomy: {
      mode: "human-review-gated",
      canRunUnattended: true,
      suggestedBatchSize: 3,
      nextItemId: "work_run_next_test",
      nextCommand: input.command,
      allowedActions: ["Run only supported local Truth Harness commands."],
      blockedActions: ["Do not use network access."],
      stopConditions: ["Stop when the verifier boundary is reached."],
      requiredArtifacts: [],
      humanReviewRequiredFor: [`claim-blocker:${input.claimId}`],
      agentPacket: "# Test autonomy contract"
    },
    items: [
      {
        itemId: "work_run_next_test",
        kind,
        priority: "high",
        title: "Review blocked claim",
        summary: "Test claim review.",
        command: input.command,
        claimId: input.claimId,
        routeId: input.routeId,
        obligationId: input.obligationId,
        obligationKind: input.obligationKind,
        reportId: input.reportId,
        validationPlanId: input.validationPlanId,
        validationGateId: input.validationGateId,
        validationGateKind: input.validationGateKind,
        sessionId: input.sessionId,
        domain: input.domain ?? "finance",
        trust: "unverified",
        source: {
          label: "claim ledger",
          ref: input.claimId
        }
      }
    ],
    warnings: [],
    markdown: "# Test review"
  };
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-run-next-"));
  roots.push(root);
  return root;
}

async function writeBenchmarkSuite(root: string): Promise<void> {
  const suiteDir = join(root, "packages", "benchmarks", "suites");
  await mkdir(suiteDir, { recursive: true });
  await writeFile(
    join(suiteDir, "ai-failure-seed.json"),
    JSON.stringify(
      {
        id: "ai-failure-seed",
        title: "AI Failure Seed Suite",
        description: "Curated fluent-but-wrong AI math failure suite.",
        tasks: [
          {
            id: "false-universal-parity",
            prompt: "for all integers n, n^2+n+1 is even",
            expectTrust: "refuted",
            expectEvidenceKind: "universal-parity",
            category: "false-universal",
            aiFailureMode: "confident universal claim"
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );
}

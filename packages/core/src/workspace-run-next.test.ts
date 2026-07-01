import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listBenchmarkComparisonRecords,
  writeBenchmarkRunRecord,
  type BenchmarkRunLike
} from "./benchmark-run.js";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { createCredibilityPack, type CredibilityPack } from "./credibility-pack.js";
import { listExpertReviews } from "./expert-review.js";
import { listWorkspaceEvents } from "./event-log.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { listModelContexts } from "./model-context.js";
import { writeLeanProofCheckRecord, type ProofBackendCommandRunner } from "./proof-backend.js";
import { writeReportDraft } from "./report-draft.js";
import { createReceipt } from "./receipt.js";
import { addResearchSessionCheckpoint, readResearchSession, writeResearchHarness } from "./research-session.js";
import { listValidationPlans } from "./validation-plan.js";
import { listWorkspaceSnapshots } from "./workspace-snapshot.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { rebuildWorkspaceCatalog } from "./workspace-catalog.js";
import {
  createWorkspaceReviewFromCredibilityPack,
  createWorkspaceRunNextPlan,
  inspectWorkspaceRunNextPlan,
  listWorkspaceRunNextPlans,
  readWorkspaceRunNextPlan,
  writeWorkspaceRunNextPlan
} from "./workspace-run-next.js";
import { listWorkspaceRevisions } from "./workspace-revision.js";
import { createWorkspaceReview, type WorkspaceReview } from "./workspace-review.js";
import { writeVerifierRoute } from "./verifier-route.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace run-next", () => {
  it("routes Lean proof-safety blockers into the next autonomous action", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-21T00:00:00.000Z" });
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\n", "utf8");
    await writeFile(
      join(root, "Proofs", "Gap.lean"),
      [
        "def quoted : String := \"sorry should not count\"",
        "theorem gap : True := by",
        "  sorry"
      ].join("\n"),
      "utf8"
    );
    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-21T00:01:00.000Z"
    });
    const dryRun = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-21T00:02:00.000Z"
    });
    const executed = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-21T00:03:00.000Z"
    });

    expect(dryRun.item).toMatchObject({
      kind: "route-obligation",
      title: "Resolve Lean proof marker: sorry",
      obligationKind: "formal-proof"
    });
    expect(dryRun.execution.summary).toContain("Dry-run only");
    expect(executed.status).toBe("blocked");
    expect(executed.execution).toMatchObject({
      kind: "lean-proof-safety",
      status: "blocked",
      summary: expect.stringContaining("Proof-safety scan still finds 1 blocking Lean marker")
    });
    expect(JSON.stringify(executed.execution.result)).toContain("Proofs/Gap.lean");
  });

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

  it("routes machine-checkable validation gates to concrete verifier actions", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "SMT query bounded_integer_sat",
      domains: ["math"],
      claims: ["SMT query bounded_integer_sat"],
      createValidationPlan: true,
      validationClaim: "SMT query bounded_integer_sat",
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

    expect(plan.item).toMatchObject({
      kind: "validation-gate",
      sessionId: harness.session.sessionId,
      validationPlanId: harness.validationPlan?.plan.planId,
      validationGateKind: "proof",
      command: "truth-harness smt check docs/examples/constraints.smt2 --query bounded_integer_sat --write"
    });
    expect(plan.execution).toMatchObject({
      kind: "dry-run"
    });
    expect(plan.execution.summary).toContain("Dry-run only");
    expect(plan.item?.command).not.toContain("truth-harness verify");
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

  it("embeds verifier engine plans in run-next handoff packets", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness verify "symbolic simplify sin(x)^2 + cos(x)^2" --write --workspace ${root} --json`,
      claimId: "claim_symbolic_engine_plan",
      kind: "validation-gate",
      validationPlanId: "vpl_symbolic_engine_plan",
      validationGateId: "gate_symbolic_engine_plan",
      validationGateKind: "proof",
      domain: "math"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-18T00:02:00.000Z"
    });
    const result = await writeWorkspaceRunNextPlan({ rootPath: root, plan });

    expect(plan.enginePlan).toMatchObject({
      schemaVersion: "truth-harness.engine-plan.v0",
      createdAt: "2026-06-18T00:02:00.000Z",
      problem: "symbolic simplify sin(x)^2 + cos(x)^2",
      classifications: expect.arrayContaining(["symbolic-algebra"]),
      recommendedFirstCommand: 'truth-harness verify "symbolic simplify sin(x)^2 + cos(x)^2" --write'
    });
    expect(plan.enginePlan?.steps.map((step) => step.capabilityId)).toEqual(
      expect.arrayContaining(["sympy-symbolic-adapter", "maxima-cas", "sage-cas", "lean-proof-checker", "claim-ledger"])
    );
    expect(plan.enginePlan?.trustBoundary.planDoesNotMintEvidence).toBe(true);
    expect(plan.execution.summary).toContain("Engine plan starts with SymPy symbolic adapter");
    expect(plan.execution.summary).toContain("Concrete SymPy receipt");
    expect(plan.stopConditions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Engine evidence required: Concrete SymPy receipt"),
        expect.stringContaining("Engine trust ceiling: do not claim stronger than")
      ])
    );
    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Engine plan selected symbolic-algebra route"),
        expect.stringContaining("Engine plan still has open verifier gates:")
      ])
    );
    expect(result.markdown).toContain("## Engine Plan");
    expect(result.markdown).toContain("| Engine first route | SymPy symbolic adapter");
    expect(result.markdown).toContain("| Engine evidence required | Concrete SymPy receipt");
    expect(result.markdown).toContain("sympy-symbolic-adapter");
    expect(result.plan.enginePlan?.recommendedFirstCommand).toBe(
      'truth-harness verify "symbolic simplify sin(x)^2 + cos(x)^2" --write'
    );
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
    await writeFile(join(root, "proofs", "scoped.lean"), "process.exit(1);\n", "utf8");
    const review = minimalReview({
      rootPath: root,
      command:
        'truth-harness proof check proofs/scoped.lean --write --statement "3 / 4 + 5 / 8" --lean-command node --timeout-ms 200',
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
    const proofStatus =
      plan.execution.kind === "proof-check"
        ? (plan.execution.result as { proof?: { status?: unknown } }).proof?.status
        : undefined;
    expect(proofStatus).toSatisfy((status: unknown) => status === "rejected" || status === "error");
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

  it("blocks unchanged failed Lean proof attempts before rerunning proof check", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-21T00:00:00.000Z" });
    await mkdir(join(root, "Proofs"), { recursive: true });
    const sourceText = "theorem route_statement : True := by\n  exact False.elim\n";
    await writeFile(join(root, "Proofs", "Attempt.lean"), sourceText, "utf8");
    const proofAttempt = {
      checkId: "proof_0123456789abcdef",
      path: ".truth-harness/proofs/2026-06-21-proof_0123456789abcdef.json",
      sourcePath: "Proofs/Attempt.lean",
      sourceSha256: sha256Hex(sourceText),
      sourceByteLength: Buffer.byteLength(sourceText),
      sourceStatus: "unchanged" as const,
      sourceCurrentSha256: sha256Hex(sourceText),
      sourceCurrentByteLength: Buffer.byteLength(sourceText),
      declarationName: "route_statement",
      status: "rejected" as const,
      trust: "unverified" as const,
      createdAt: "2026-06-21T00:01:00.000Z",
      diagnosticSnippet: "type mismatch"
    };
    const proofDeclaration = {
      declarationId: "decl_0123456789abcdef",
      kind: "theorem" as const,
      name: "route_statement",
      path: "Proofs/Attempt.lean",
      line: 1,
      column: 1,
      signature: "theorem route_statement : True",
      signatureSha256: sha256Hex("theorem route_statement : True"),
      sourceSha256: sha256Hex(sourceText)
    };
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness proof check Proofs/Attempt.lean --declaration route_statement --write",
      claimId: "claim_fake",
      kind: "route-obligation",
      routeId: "route_0123456789abcdef",
      obligationId: "obl_0123456789abcdef",
      obligationKind: "formal-proof",
      proofDeclaration,
      proofAttempt
    });

    const dryRun = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-21T00:01:30.000Z"
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-21T00:02:00.000Z"
    });
    const proofRecords = await readdir(join(root, ".truth-harness", "proofs")).catch(() => []);

    expect(dryRun.status).toBe("planned");
    expect(dryRun.execution).toMatchObject({
      status: "planned",
      kind: "proof-repair-source-unchanged",
      command: "truth-harness proof check Proofs/Attempt.lean --declaration route_statement --write",
      summary: expect.stringContaining("Edit the Lean source before running --execute-local")
    });
    expect(dryRun.execution.summary).toContain(proofAttempt.checkId);
    expect(plan.status).toBe("blocked");
    expect(plan.execution).toMatchObject({
      status: "blocked",
      kind: "proof-repair-source-unchanged",
      command: "truth-harness proof check Proofs/Attempt.lean --declaration route_statement --write",
      summary: expect.stringContaining("Edit the Lean source before rerunning this proof check")
    });
    expect(plan.execution.summary).toContain(proofAttempt.checkId);
    expect(plan.execution.summary).toContain(`sha256:${proofAttempt.sourceSha256}`);
    expect(proofRecords).toEqual([]);
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

  it("executes workspace snapshot gates without honoring command path overrides", async () => {
    const root = await tempRoot();
    const outsideRoot = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "Close the workspace snapshot gate after scoped evidence is attached.",
      domains: ["math"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const validationPlan = harness.validationPlan?.plan;
    const snapshotGate = validationPlan?.gates.find((gate) => gate.kind === "workspace-snapshot");
    if (!validationPlan || !snapshotGate) {
      throw new Error("Expected a linked validation plan with a workspace-snapshot gate.");
    }
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness workspace snapshot ${outsideRoot} --json`,
      claimId: "claim_workspace_snapshot_test",
      kind: "validation-gate",
      validationPlanId: validationPlan.planId,
      validationGateId: snapshotGate.gateId,
      validationGateKind: snapshotGate.kind,
      sessionId: harness.session.sessionId,
      domain: "math"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:02:00.000Z"
    });
    const snapshots = await listWorkspaceSnapshots(root);
    const outsideSnapshots = await readdir(join(outsideRoot, ".truth-harness", "snapshots")).catch(() => []);
    const updatedPlans = await listValidationPlans(root);
    const updatedGate = updatedPlans
      .find((candidate) => candidate.planId === validationPlan.planId)
      ?.gates.find((gate) => gate.gateId === snapshotGate.gateId);
    const updatedSession = await readResearchSession(root, harness.session.sessionId);

    expect(plan.status).toBe("executed");
    expect(plan.execution).toMatchObject({
      kind: "workspace-snapshot",
      evidenceRef: expect.stringContaining("snapshot:.truth-harness/snapshots/"),
      attached: true,
      result: {
        snapshot: {
          snapshotId: expect.stringMatching(/^snap_[a-f0-9]{16}$/u)
        },
        jsonPath: expect.stringContaining(".truth-harness/snapshots/"),
        validationGate: {
          gateId: snapshotGate.gateId,
          status: "satisfied",
          satisfied: true,
          blocked: false
        },
        checkpoint: {
          evidenceRefs: [expect.objectContaining({ kind: "snapshot" })]
        }
      }
    });
    expect(plan.execution.summary).toContain("Wrote workspace snapshot");
    expect(plan.execution.summary).toContain("satisfied by local snapshot evidence");
    expect((plan.execution.result as { snapshot: { entries?: unknown[] } }).snapshot.entries).toBeUndefined();
    expect(plan.artifactRefs).not.toContainEqual(
      expect.objectContaining({
        source: expect.stringContaining("snapshot.entries")
      })
    );
    expect(snapshots).toContainEqual(
      expect.objectContaining({
        snapshotId: (plan.execution.result as { snapshot: { snapshotId: string } }).snapshot.snapshotId
      })
    );
    expect(outsideSnapshots).toEqual([]);
    expect(updatedGate).toMatchObject({
      status: "satisfied",
      evidenceRefs: [expect.objectContaining({ kind: "snapshot" })]
    });
    expect(updatedSession.snapshotRefs).toContain(
      (plan.execution.result as { snapshot: { snapshotId: string } }).snapshot.snapshotId
    );
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

  it("executes claim-add actions for mathematical inequalities without treating them as placeholders", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-23T00:00:00.000Z" });
    const claim = "The integer constraints x > 0 and x < 3 have exactly the solutions x = 1 and x = 2.";
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: claim,
      now: new Date("2026-06-23T00:01:00.000Z")
    });
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness claim add ${JSON.stringify(claim)} --workspace ${root} --domain math --evidence route:${route.route.routeId} --trust exact-computed --json`,
      routeId: route.route.routeId,
      domain: "math"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-23T00:02:00.000Z"
    });

    expect(plan.status).toBe("executed");
    expect(plan.execution).toMatchObject({
      kind: "claim-add",
      evidenceRef: expect.stringMatching(/^claim:claim_[a-f0-9]{16}$/u),
      result: {
        claim: {
          statement: claim,
          domain: "math",
          trust: "exact-computed",
          evidenceRefs: [expect.objectContaining({ kind: "route", ref: route.route.routeId })]
        }
      }
    });
  });

  it("executes claim-add actions that record refuted verifier-route evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-23T00:00:00.000Z" });
    const claim = "For every integer n, n^2 + n + 1 is even.";
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: claim,
      now: new Date("2026-06-23T00:01:00.000Z")
    });
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness claim add ${JSON.stringify(claim)} --workspace ${root} --domain math --evidence route:${route.route.routeId}@refuted --trust refuted --json`,
      routeId: route.route.routeId,
      domain: "math"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-23T00:02:00.000Z"
    });

    expect(route.route.status).toBe("refuted");
    expect(plan.status).toBe("executed");
    expect(plan.execution).toMatchObject({
      kind: "claim-add",
      evidenceRef: expect.stringMatching(/^claim:claim_[a-f0-9]{16}$/u),
      result: {
        claim: {
          statement: claim,
          domain: "math",
          trust: "refuted",
          evidenceRefs: [
            expect.objectContaining({
              kind: "route",
              ref: route.route.routeId,
              trust: "refuted"
            })
          ],
          finalization: {
            readyForNarrowClaim: false
          }
        }
      }
    });
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

  it("marks Docker reviewer gates as manual boundaries during dry run", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command: "docker compose run --rm lean-proof",
      claimId: "claim_fake"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:02:00.000Z"
    });

    expect(plan.status).toBe("blocked");
    expect(plan.dryRun).toBe(true);
    expect(plan.execution).toMatchObject({
      status: "blocked",
      kind: "manual-container-gate",
      command: "docker compose run --rm lean-proof"
    });
    expect(plan.execution.summary).toContain("Dry-run preflight");
    expect(plan.execution.summary).toContain("approving the container boundary");
    expect(plan.rationale).toMatchObject({
      executionBoundary: expect.stringContaining("Manual container gate")
    });
    expect(plan.rationale?.executionBoundary).toContain("will not execute npm, Docker, or shell strings");
  });

  it("blocks unavailable Lean proof backends before writing backend-unavailable retry noise", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "Proofs", "Smoke.lean"), "theorem smoke : True := by trivial\n", "utf8");
    const review = minimalReview({
      rootPath: root,
      command:
        'truth-harness proof check Proofs/Smoke.lean --write --lean-command truth-harness-missing-lean-command --declaration smoke --route route_proof_unavailable_test --obligation obl_proof_unavailable_test --statement "theorem smoke : True" --statement-hash hash_smoke',
      claimId: "claim_fake",
      kind: "route-obligation",
      routeId: "route_proof_unavailable_test",
      obligationId: "obl_proof_unavailable_test",
      obligationKind: "formal-proof"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });
    const proofFiles = await readdir(join(root, ".truth-harness", "proofs")).catch(() => []);

    expect(plan.status).toBe("blocked");
    expect(plan.execution.kind).toBe("proof-check");
    expect(plan.execution.summary).toContain("Local Lean proof checker backend is not available");
    expect(plan.execution.summary).toContain(
      'docker compose run --build --rm lean-proof node apps/cli/dist/index.js proof check Proofs/Smoke.lean --declaration smoke --route route_proof_unavailable_test --obligation obl_proof_unavailable_test --statement "theorem smoke : True" --statement-hash hash_smoke --write'
    );
    expect(plan.execution.evidenceRef).toBeUndefined();
    expect(proofFiles).toEqual([]);
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

  it("blocks unavailable CAS backends before writing unverified retry noise", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = minimalReview({
      rootPath: root,
      command:
        'truth-harness cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write --maxima-command truth-harness-missing-maxima-command',
      claimId: "claim_fake",
      kind: "route-obligation",
      routeId: "route_cas_unavailable_test",
      obligationId: "obl_cas_unavailable_test",
      obligationKind: "independent-check"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-14T00:02:00.000Z"
    });
    const casFiles = await readdir(join(root, ".truth-harness", "cas")).catch(() => []);

    expect(plan.status).toBe("blocked");
    expect(plan.execution.kind).toBe("cas-check");
    expect(plan.execution.summary).toContain("Local Maxima CAS backend is not available");
    expect(plan.execution.summary).toContain(
      'npm run docker:cli -- cas check -- --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write'
    );
    expect(plan.execution.evidenceRef).toBeUndefined();
    expect(casFiles).toEqual([]);
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

  it("attaches passing benchmark runs to linked validation gates and checkpoints the session", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    await writeBenchmarkSuite(root);
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "Verify a software performance claim with a replayable benchmark.",
      domains: ["code"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const validationPlan = harness.validationPlan?.plan;
    const benchmarkGate = validationPlan?.gates.find((gate) => gate.kind === "benchmark");
    if (!benchmarkGate) {
      throw new Error("Expected a benchmark gate in software validation plan.");
    }
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness bench run packages/benchmarks/suites/ai-failure-seed.json --write --fail-on-failures",
      claimId: "claim_benchmark_test",
      kind: "validation-gate",
      validationPlanId: validationPlan?.planId,
      validationGateId: benchmarkGate.gateId,
      validationGateKind: benchmarkGate.kind,
      sessionId: harness.session.sessionId,
      domain: "code"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:02:00.000Z"
    });
    const plans = await listValidationPlans(root);
    const updatedPlan = plans.find((candidate) => candidate.planId === validationPlan?.planId);
    const updatedGate = updatedPlan?.gates.find((gate) => gate.gateId === benchmarkGate.gateId);
    const updatedSession = await readResearchSession(root, harness.session.sessionId);

    expect(plan.status).toBe("executed");
    expect(plan.execution).toMatchObject({
      kind: "benchmark-run",
      attached: true,
      evidenceRef: expect.stringContaining("benchmark:.truth-harness/benchmarks/"),
      result: {
        benchmark: {
          schemaVersion: "truth-harness.benchmark-run.v0",
          totals: { total: 1, passed: 1, failed: 0 }
        },
        attachment: {
          validationGate: {
            satisfied: true,
            gate: {
              gateId: benchmarkGate.gateId,
              status: "satisfied"
            }
          },
          checkpoint: {
            evidenceRefs: [expect.objectContaining({ kind: "benchmark" })]
          }
        }
      }
    });
    expect(plan.execution.summary).toContain("Validation benchmark gate");
    expect(plan.execution.summary).toContain("Checkpointed research session");
    expect(updatedGate).toMatchObject({
      status: "satisfied",
      evidenceRefs: [expect.objectContaining({ kind: "benchmark" })],
      nextChecks: []
    });
    expect(updatedSession.evidenceRefs).toContainEqual(expect.objectContaining({ kind: "benchmark" }));
    expect(updatedSession.checkpoints).toContainEqual(
      expect.objectContaining({
        evidenceRefs: [expect.objectContaining({ kind: "benchmark" })],
        decisions: [expect.stringContaining("satisfied by benchmark evidence")]
      })
    );
  });

  it("executes benchmark comparisons and checkpoints the comparison evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-18T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "Compare verifier benchmark evidence before claiming progress.",
      domains: ["code"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const receipt = createReceipt("compute 2 + 2");
    const baseline = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt),
      suitePath: "packages/benchmarks/suites/tiny.json",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json --write",
      now: "2026-06-18T00:02:00.000Z"
    });
    const current = await writeBenchmarkRunRecord({
      rootPath: root,
      run: benchmarkRun(receipt, {
        expectTrust: "refuted",
        passed: false,
        failures: ["Expected trust refuted, received exact-computed"]
      }),
      suitePath: "packages/benchmarks/suites/tiny.json",
      command: "truth-harness bench run packages/benchmarks/suites/tiny.json --write",
      now: "2026-06-18T00:03:00.000Z"
    });
    const review = minimalReview({
      rootPath: root,
      command: `truth-harness bench compare ${relative(root, baseline.jsonPath)} ${relative(root, current.jsonPath)} --write --fail-on-regression`,
      claimId: "claim_benchmark_comparison",
      kind: "session-next-check",
      sessionId: harness.session.sessionId,
      domain: "code"
    });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-18T00:04:00.000Z"
    });
    const comparisons = await listBenchmarkComparisonRecords(root);
    const updatedSession = await readResearchSession(root, harness.session.sessionId);

    expect(plan.status).toBe("executed");
    expect(plan.execution).toMatchObject({
      kind: "benchmark-compare",
      attached: true,
      evidenceRef: expect.stringContaining("benchmark:.truth-harness/benchmarks/"),
      result: {
        comparison: {
          schemaVersion: "truth-harness.benchmark-comparison.v0",
          verdict: "regressed",
          summary: expect.objectContaining({ regressions: 1 })
        },
        attachment: {
          checkpoint: { evidenceRefs: [expect.objectContaining({ kind: "benchmark" })] }
        }
      }
    });
    expect(plan.execution.summary).toContain("Wrote benchmark comparison");
    expect(plan.execution.summary).toContain("Checkpointed research session");
    expect(comparisons).toHaveLength(1);
    expect(updatedSession.evidenceRefs).toContainEqual(expect.objectContaining({ kind: "benchmark" }));
    expect(updatedSession.checkpoints).toContainEqual(
      expect.objectContaining({
        evidenceRefs: [expect.objectContaining({ kind: "benchmark" })],
        decisions: [expect.stringContaining("Recorded benchmark:.truth-harness/benchmarks/")]
      })
    );
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

  it("executes benchmark reviewer-contract credibility actions as local expert-review records", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-24T00:00:00.000Z" });
    const basePack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-24T00:01:00.000Z",
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      timeoutMs: 50
    });
    const reviewAction: CredibilityPack["reviewerActionPlan"]["actions"][number] = {
      actionId: "cred_action_0000000000000001",
      category: "benchmark",
      priority: "low",
      title: "Record external review request for frontier-honesty-challenge/riemann-hypothesis",
      detail: "External review is required before citing this benchmark case as discovery evidence.",
      command:
        'truth-harness review log "Benchmark contract frontier-honesty-challenge/riemann-hypothesis" --kind math --status requested --reviewer-role "qualified external reviewer" --evidence benchmark:.truth-harness/benchmarks/bench_demo.json --question "Review the benchmark contract." --next-check "accepted formal proof artifact" --next-check "independent expert review"',
      closes: ["benchmark-contract:frontier-honesty-challenge:riemann-hypothesis"],
      source: {
        kind: "benchmark-review-contract",
        ref: ".truth-harness/benchmarks/bench_demo.json#riemann-hypothesis"
      }
    };
    const pack: CredibilityPack = {
      ...basePack,
      reviewerActionPlan: {
        totalActions: 1,
        criticalActions: 0,
        highActions: 0,
        actions: [reviewAction]
      }
    };
    const review = createWorkspaceReviewFromCredibilityPack({ rootPath: root, pack });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-24T00:02:00.000Z"
    });
    const reviews = await listExpertReviews(root);

    expect(review.autonomy.nextItemId).toBe("cred_action_0000000000000001");
    expect(plan.execution).toMatchObject({
      status: "executed",
      kind: "expert-review",
      evidenceRef: expect.stringContaining("review:.truth-harness/reviews/")
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      subject: "Benchmark contract frontier-honesty-challenge/riemann-hypothesis",
      kind: "math",
      status: "requested",
      reviewer: { role: "qualified external reviewer" },
      evidenceRefs: [{ kind: "benchmark", ref: ".truth-harness/benchmarks/bench_demo.json" }],
      requiredNextChecks: ["accepted formal proof artifact", "independent expert review"]
    });
  });

  it("executes benchmark agent pre-review credibility actions as local model-context packets", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-24T00:00:00.000Z" });
    const basePack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-24T00:01:00.000Z",
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      timeoutMs: 50
    });
    const preReviewAction: CredibilityPack["reviewerActionPlan"]["actions"][number] = {
      actionId: "cred_action_0000000000000002",
      category: "benchmark",
      priority: "low",
      title: "Prepare agent pre-review rehearsal for frontier-honesty-challenge/riemann-hypothesis",
      detail: "Prepare a local-only skeptical mathematician rehearsal packet; qualified external review remains required.",
      command:
        'truth-harness model-context prepare "Agent pre-review rehearsal frontier-honesty-challenge/riemann-hypothesis" --service local-agent --target local-model --title "Agent pre-review rehearsal frontier-honesty-challenge/riemann-hypothesis" --data benchmark-review-contract --data agent-pre-review-rehearsal --ref benchmark:.truth-harness/benchmarks/bench_demo.json --section "Reviewer rehearsal=Act as a skeptical mathematician, but do not mark the case externally reviewed." --redaction "local-only packet" --exclude "qualified external review is not included"',
      closes: ["benchmark-contract-pre-review:frontier-honesty-challenge:riemann-hypothesis"],
      source: {
        kind: "benchmark-agent-pre-review",
        ref: ".truth-harness/benchmarks/bench_demo.json#riemann-hypothesis"
      }
    };
    const pack: CredibilityPack = {
      ...basePack,
      reviewerActionPlan: {
        totalActions: 1,
        criticalActions: 0,
        highActions: 0,
        actions: [preReviewAction]
      }
    };
    const review = createWorkspaceReviewFromCredibilityPack({ rootPath: root, pack });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-24T00:02:00.000Z"
    });
    const contexts = await listModelContexts(root);

    expect(review.autonomy.nextItemId).toBe("cred_action_0000000000000002");
    expect(plan.execution).toMatchObject({
      status: "executed",
      kind: "model-context",
      evidenceRef: expect.stringContaining("model-context:.truth-harness/model-contexts/")
    });
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      purpose: "Agent pre-review rehearsal frontier-honesty-challenge/riemann-hypothesis",
      target: { kind: "local-model", service: "local-agent" },
      selectedContextRefs: ["benchmark:.truth-harness/benchmarks/bench_demo.json"]
    });
    expect(contexts[0].boundary.externalCallNotPerformed).toBe(true);
  });
  it("prefers locally executable credibility actions over host-blocked proof actions at the same priority", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-23T00:00:00.000Z" });
    const basePack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-23T00:01:00.000Z",
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      timeoutMs: 50
    });
    const proofAction: CredibilityPack["reviewerActionPlan"]["actions"][number] = {
      actionId: "cred_action_proof",
      category: "workspace-review",
      priority: "critical",
      title: "Validation gate: proof",
      detail: "Lean proof action requires a host proof checker.",
      command:
        'truth-harness proof check docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean --declaration smoke --statement "The Lean fixture theorem `smoke : True` is accepted by the configured proof checker." --write',
      closes: ["validation-gate"],
      source: {
        kind: "validation-gate",
        ref: "session:plan:proof-gate"
      }
    };
    const nativeVerifyAction: CredibilityPack["reviewerActionPlan"]["actions"][number] = {
      actionId: "cred_action_native_verify",
      category: "workspace-review",
      priority: "critical",
      title: "Validation gate: proof",
      detail: "Native verifier action can write a local route without a missing external engine.",
      command: `truth-harness verify "For every integer n, n^2 + n + 1 is even." --write --workspace ${root} --json`,
      closes: ["validation-gate"],
      source: {
        kind: "validation-gate",
        ref: "session:plan:native-gate"
      }
    };
    const pack: CredibilityPack = {
      ...basePack,
      reviewerActionPlan: {
        ...basePack.reviewerActionPlan,
        totalActions: 2,
        criticalActions: 2,
        highActions: 0,
        actions: [proofAction, nativeVerifyAction]
      }
    };

    const review = createWorkspaceReviewFromCredibilityPack({ rootPath: root, pack });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-23T00:02:00.000Z"
    });

    expect(review.autonomy.nextItemId).toBe("cred_action_native_verify");
    expect(review.items.map((item) => item.itemId)).toEqual(["cred_action_native_verify", "cred_action_proof"]);
    expect(plan.item).toMatchObject({
      itemId: "cred_action_native_verify",
      command: expect.stringContaining("truth-harness verify")
    });
  });

  it("preserves validation gate targets when executing adapted credibility actions", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-23T00:00:00.000Z" });
    const harness = await writeResearchHarness({
      rootPath: root,
      title: "False parity trap",
      objective: "Refute a fluent but false universal parity claim with local route evidence.",
      domains: ["math"],
      claims: ["For every integer n, n^2 + n + 1 is even."],
      createValidationPlan: true,
      validationTitle: "False parity validation gates",
      validationClaim: "For every integer n, n^2 + n + 1 is even.",
      now: "2026-06-23T00:01:00.000Z"
    });
    const validationPlan = harness.validationPlan?.plan;
    const proofGate = validationPlan?.gates.find((gate) => gate.kind === "proof");
    if (!validationPlan || !proofGate) {
      throw new Error("Expected a linked validation proof gate.");
    }
    const pack = await createCredibilityPack({
      rootPath: root,
      now: "2026-06-23T00:02:00.000Z",
      maxRoutes: 0,
      maxClaims: 0,
      maxReports: 0,
      timeoutMs: 50
    });
    const review = createWorkspaceReviewFromCredibilityPack({ rootPath: root, pack });

    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: true,
      now: "2026-06-23T00:03:00.000Z"
    });
    const plans = await listValidationPlans(root);
    const updatedPlan = plans.find((candidate) => candidate.planId === validationPlan.planId);
    const updatedGate = updatedPlan?.gates.find((gate) => gate.gateId === proofGate.gateId);

    expect(plan.item).toMatchObject({
      kind: "validation-gate",
      sessionId: harness.session.sessionId,
      validationPlanId: validationPlan.planId,
      validationGateId: proofGate.gateId,
      validationGateKind: "proof",
      command: expect.stringContaining("truth-harness verify")
    });
    expect(plan.execution).toMatchObject({
      status: "executed",
      kind: "verifier-route",
      attached: true,
      result: {
        validationGate: {
          planId: validationPlan.planId,
          gateId: proofGate.gateId
        }
      }
    });
    expect(updatedGate).toMatchObject({
      evidenceRefs: [expect.objectContaining({ kind: "route" })]
    });
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
        actionId: "refresh-strict-docker-professor-rehearsal",
        command: "npm run docker:professor:all",
        requiresHumanInput: true
      }),
      expect.objectContaining({
        actionId: "refresh-docker-professor-rehearsal",
        command: "npm run docker:professor",
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

    const written = await writeWorkspaceRunNextPlan({ rootPath: root, plan });
    const inspected = await inspectWorkspaceRunNextPlan(root, written.plan.planId, {
      verifySnapshot: true,
      now: "2026-06-14T00:04:00.000Z"
    });
    expect(inspected.resumeDecision).toMatchObject({
      safeToResume: false,
      status: "choose-idle-action",
      action: "choose-idle-action",
      reason: expect.stringContaining("healthy idle action menu")
    });
    expect(inspected.resumeDecision.nextCommand).toContain("show-run-next");
    expect(inspected.sourceRevision).toMatchObject({
      sourceRevisionStatus: "verified"
    });
    expect(inspected.sourceSnapshot).toMatchObject({
      sourceSnapshotStatus: "verified"
    });
  });

  it("surfaces resumable pilot-loop transcripts before generic idle actions", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const findingsDir = join(root, ".truth-harness", "findings");
    await mkdir(findingsDir, { recursive: true });
    const runNextRef = ".truth-harness/findings/2026-06-14-wrn_11111111-workspace-run-next.json";
    await writeFile(join(root, runNextRef), "{}\n", "utf8");
    await writeFile(
      join(findingsDir, "2026-06-14-wpl_11111111-workspace-pilot-loop.json"),
      `${JSON.stringify(
        {
          schemaVersion: "truth-harness.workspace-pilot-loop.v0",
          loopId: "wpl_11111111",
          createdAt: "2026-06-14T00:01:00.000Z",
          localOnly: true,
          networkAccess: "none",
          steps: [
            {
              index: 1,
              createdAt: "2026-06-14T00:01:01.000Z",
              reviewId: "wrev_fixture",
              planId: "wrn_11111111",
              runNextPlanPath: runNextRef,
              execution: {
                status: "planned",
                kind: "dry-run",
                summary: "fixture run-next handoff"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      maxReports: 0,
      now: "2026-06-14T00:02:00.000Z"
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:03:00.000Z"
    });

    expect(plan.status).toBe("blocked");
    expect(plan.item).toBeUndefined();
    expect(plan.idleNextActions?.[0]).toMatchObject({
      actionId: "continue-latest-pilot-loop",
      command: expect.stringContaining("truth-harness workspace continue-pilot-loop wpl_11111111"),
      requiresHumanInput: false
    });
    expect(plan.idleNextActions?.[0]?.reason).toContain(runNextRef);
    expect(plan.idleNextActions?.[1]).toMatchObject({
      actionId: "start-validation-backed-harness"
    });
  });

  it("writes dry-run plans into findings with a local artifact event", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const candidatePath = join(root, ".truth-harness", "artifacts", "candidate.json");
    const candidateBody = `${JSON.stringify({
      schemaVersion: "truth-harness.proof-check.v0",
      status: "accepted",
      backend: "lean",
      statement: "example : True := by trivial"
    })}\n`;
    await mkdir(join(root, ".truth-harness", "artifacts"), { recursive: true });
    await writeFile(candidatePath, candidateBody, "utf8");
    const candidateSha256 = sha256Hex(candidateBody);
    const citingClaim = await writeClaimLedgerRecord({
      rootPath: root,
      title: "Candidate proof consumer",
      statement: "This downstream claim cites the candidate proof artifact.",
      domain: "math",
      evidenceRefs: [{ kind: "proof", ref: ".truth-harness/artifacts/candidate.json" }],
      now: "2026-06-14T00:01:30.000Z"
    });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:01:45.000Z" });
    const review = minimalReview({
      rootPath: root,
      command:
        "truth-harness validation attach vpl_run_next_test gate_proof_run_next_test --evidence proof:.truth-harness/artifacts/candidate.json --json",
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
    expect(result.markdown).toContain("| Candidate evidence | proof:.truth-harness/artifacts/candidate.json |");
    expect(result.markdown).toContain("It is not proof, not a trust-label upgrade");
    const parsed = JSON.parse(await readFile(result.jsonPath, "utf8")) as {
      schemaVersion?: string;
      planId?: string;
      dryRun?: boolean;
      rationale?: { target?: string; candidateEvidenceRef?: string; executionBoundary?: string };
      sourceRevision?: {
        revisionId?: string;
        path?: string;
        sourceSnapshotId?: string;
        sourceSnapshotPath?: string;
        totalFiles?: number;
        totalBytes?: number;
      };
      sourceSnapshot?: { snapshotId?: string; path?: string; totalFiles?: number; totalBytes?: number };
      artifactRefs?: Array<{ path: string; role: string; source: string }>;
      impactRefs?: Array<{ refPath: string; citedByPath: string; citedByKind: string; source: string; fieldPath?: string }>;
      revalidationQueue?: Array<{
        itemId: string;
        refPath: string;
        dependentPath: string;
        dependentKind: string;
        source: string;
        priority: string;
        command: string;
        evidenceRequired: string;
        boundary: string;
        dependentArtifactId?: string;
        fieldPath?: string;
      }>;
    };
    expect(parsed).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      planId: result.plan.planId,
      dryRun: true,
      rationale: {
        target: "validation proof gate_proof_run_next_test",
        candidateEvidenceRef: "proof:.truth-harness/artifacts/candidate.json"
      }
    });
    expect(parsed.rationale?.executionBoundary).toContain("Dry-run only");
    expect(parsed.sourceSnapshot).toMatchObject({
      snapshotId: expect.stringMatching(/^snap_[a-f0-9]{16}$/u),
      path: expect.stringContaining(".truth-harness/snapshots/"),
      totalFiles: expect.any(Number),
      totalBytes: expect.any(Number)
    });
    expect(parsed.sourceRevision).toMatchObject({
      revisionId: expect.stringMatching(/^rev_[a-f0-9]{16}$/u),
      path: expect.stringContaining(".truth-harness/revisions/"),
      sourceSnapshotId: parsed.sourceSnapshot?.snapshotId,
      sourceSnapshotPath: parsed.sourceSnapshot?.path,
      totalFiles: parsed.sourceSnapshot?.totalFiles,
      totalBytes: parsed.sourceSnapshot?.totalBytes
    });
    expect(result.markdown).toContain(`| Source revision | \`${parsed.sourceRevision?.revisionId}`);
    expect(parsed.artifactRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: parsed.sourceRevision?.path ?? "",
          role: "source-revision",
          source: "sourceRevision.path",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          sha256Scope: "file",
          citation: expect.stringContaining("sha256:")
        }),
        expect.objectContaining({
          path: ".truth-harness/artifacts/candidate.json",
          role: "candidate-evidence",
          source: "rationale.candidateEvidenceRef",
          sha256: candidateSha256,
          sha256Scope: "file",
          sizeBytes: Buffer.byteLength(candidateBody),
          citation: `.truth-harness/artifacts/candidate.json sha256:${candidateSha256}`
        }),
        expect.objectContaining({
          path: parsed.sourceSnapshot?.path ?? "",
          role: "source-snapshot",
          source: "sourceSnapshot.path",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          sha256Scope: "file",
          citation: expect.stringContaining("sha256:")
        })
      ])
    );
    expect(parsed.impactRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          refPath: ".truth-harness/artifacts/candidate.json",
          citedByPath: relative(root, citingClaim.jsonPath).replace(/\\/gu, "/"),
          citedByKind: "claims",
          source: "workspace-catalog",
          fieldPath: "$.evidenceRefs[0]"
        })
      ])
    );
    expect(parsed.revalidationQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: expect.stringMatching(/^reval_[a-f0-9]{8}$/u),
          refPath: ".truth-harness/artifacts/candidate.json",
          dependentPath: relative(root, citingClaim.jsonPath).replace(/\\/gu, "/"),
          dependentKind: "claims",
          source: "impact-ref",
          priority: "high",
          command: `truth-harness claim review ${citingClaim.claim.claimId} --json`,
          evidenceRequired: expect.stringContaining("Fresh claim review"),
          boundary: expect.stringContaining("does not execute commands"),
          dependentArtifactId: citingClaim.claim.claimId,
          fieldPath: "$.evidenceRefs[0]"
        })
      ])
    );
    expect(result.markdown).toContain("## Artifact Refs");
    expect(result.markdown).toContain("| Role | Path | Source | SHA-256 | Citation |");
    expect(result.markdown).toContain(
      `| \`candidate-evidence\` | \`.truth-harness/artifacts/candidate.json\` | rationale.candidateEvidenceRef | \`${candidateSha256}\` | \`.truth-harness/artifacts/candidate.json sha256:${candidateSha256}\` |`
    );
    expect(result.markdown).toContain("## Citation Impact");
    expect(result.markdown).toContain("Citation impact is dependency navigation only");
    expect(result.markdown).toContain("## Revalidation Queue");
    expect(result.markdown).toContain(`truth-harness claim review ${citingClaim.claim.claimId} --json`);
    expect(result.markdown).toContain("Revalidation queue entries are review tasks only");
    expect(result.markdown).toContain(relative(root, citingClaim.jsonPath).replace(/\\/gu, "/"));
    const snapshots = await listWorkspaceSnapshots(root);
    expect(snapshots).toContainEqual(
      expect.objectContaining({
        snapshotId: parsed.sourceSnapshot?.snapshotId,
        path: parsed.sourceSnapshot?.path
      })
    );
    const revisions = await listWorkspaceRevisions(root);
    expect(revisions).toContainEqual(
      expect.objectContaining({
        revisionId: parsed.sourceRevision?.revisionId,
        path: parsed.sourceRevision?.path,
        sessionRefs: [],
        validationPlanRefs: ["vpl_run_next_test"],
        claimRefs: ["claim_fake"]
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
        rationaleCandidateEvidenceRef: "proof:.truth-harness/artifacts/candidate.json",
        rationaleExecutionBoundary: expect.stringContaining("Dry-run only"),
        artifactRefs: expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining(`${result.plan.planId}-workspace-run-next.json`),
            role: "run-next-packet"
          }),
          expect.objectContaining({
            path: ".truth-harness/artifacts/candidate.json",
            role: "candidate-evidence",
            sha256: candidateSha256,
            citation: `.truth-harness/artifacts/candidate.json sha256:${candidateSha256}`
          })
        ]),
        impactRefs: expect.arrayContaining([
          expect.objectContaining({
            refPath: ".truth-harness/artifacts/candidate.json",
            citedByPath: relative(root, citingClaim.jsonPath).replace(/\\/gu, "/"),
            citedByKind: "claims"
          })
        ]),
        revalidationQueue: expect.arrayContaining([
          expect.objectContaining({
            refPath: ".truth-harness/artifacts/candidate.json",
            dependentPath: relative(root, citingClaim.jsonPath).replace(/\\/gu, "/"),
            dependentKind: "claims",
            command: `truth-harness claim review ${citingClaim.claim.claimId} --json`
          })
        ]),
        sourceRevisionId: parsed.sourceRevision?.revisionId,
        sourceRevisionPath: parsed.sourceRevision?.path,
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
        sourceRevisionStatus: "verified",
        sourceRevisionAdded: 0,
        sourceRevisionChanged: 0,
        sourceRevisionMissing: 0,
        sourceRevisionIgnoredAdded: 3,
        sourceRevisionDriftSummary: expect.stringContaining("still matches"),
        sourceSnapshotStatus: "verified",
        sourceSnapshotAdded: 0,
        sourceSnapshotChanged: 0,
        sourceSnapshotMissing: 0,
        sourceSnapshotIgnoredAdded: 3,
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
        planId: result.plan.planId,
        artifactRefs: expect.arrayContaining([
          expect.objectContaining({
            path: ".truth-harness/artifacts/candidate.json",
            role: "candidate-evidence",
            sha256: candidateSha256,
            citation: `.truth-harness/artifacts/candidate.json sha256:${candidateSha256}`
          })
        ]),
        impactRefs: expect.arrayContaining([
          expect.objectContaining({
            refPath: ".truth-harness/artifacts/candidate.json",
            citedByPath: relative(root, citingClaim.jsonPath).replace(/\\/gu, "/"),
            citedByKind: "claims"
          })
        ]),
        revalidationQueue: expect.arrayContaining([
          expect.objectContaining({
            refPath: ".truth-harness/artifacts/candidate.json",
            dependentPath: relative(root, citingClaim.jsonPath).replace(/\\/gu, "/"),
            dependentKind: "claims",
            command: `truth-harness claim review ${citingClaim.claim.claimId} --json`
          })
        ])
      },
      artifactRefs: expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining(`${result.plan.planId}-workspace-run-next.json`),
          role: "run-next-packet",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          citation: expect.stringContaining("sha256:")
        }),
        expect.objectContaining({
          path: ".truth-harness/artifacts/candidate.json",
          role: "candidate-evidence",
          sha256: candidateSha256,
          citation: `.truth-harness/artifacts/candidate.json sha256:${candidateSha256}`
        })
      ]),
      resumeDecision: {
        safeToResume: true,
        status: "safe-to-resume",
        action: "run-selected-command",
        nextCommand:
          "truth-harness validation attach vpl_run_next_test gate_proof_run_next_test --evidence proof:.truth-harness/artifacts/candidate.json --json"
      },
      sourceRevision: {
        sourceRevisionStatus: "verified",
        sourceRevisionAdded: 0,
        sourceRevisionChanged: 0,
        sourceRevisionMissing: 0,
        sourceRevisionIgnoredAdded: 3
      },
      sourceSnapshot: {
        sourceSnapshotStatus: "verified",
        sourceSnapshotAdded: 0,
        sourceSnapshotChanged: 0,
        sourceSnapshotMissing: 0,
        sourceSnapshotIgnoredAdded: 3
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
        sourceRevisionStatus: "drifted",
        sourceRevisionAdded: 1,
        sourceRevisionDriftSummary: expect.stringContaining("1 added"),
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
    expect(driftedInspection.sourceRevision).toMatchObject({
      sourceRevisionStatus: "drifted",
      sourceRevisionAdded: 1,
      sourceRevisionDriftSummary: expect.stringContaining("1 added")
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

  it("limits persisted handoff verification to the newest requested packets", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-14T00:01:00.000Z"
    });

    const olderPlan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:02:00.000Z"
    });
    const olderWrite = await writeWorkspaceRunNextPlan({ rootPath: root, plan: olderPlan });
    const newerPlan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-14T00:03:00.000Z"
    });
    const newerWrite = await writeWorkspaceRunNextPlan({ rootPath: root, plan: newerPlan });

    const limited = await listWorkspaceRunNextPlans(root, {
      verifySnapshots: true,
      limit: 1,
      now: "2026-06-14T00:04:00.000Z"
    });

    expect(limited).toHaveLength(1);
    expect(limited[0]).toMatchObject({
      planId: newerWrite.plan.planId,
      sourceRevisionStatus: "verified",
      sourceSnapshotStatus: "verified"
    });
    expect(limited.map((summary) => summary.planId)).not.toContain(olderWrite.plan.planId);
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

  it("preserves structured proof-attempt context in saved handoff packets", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-21T00:00:00.000Z" });
    const sourceText = "theorem route_statement : True := by\n  exact False.elim\n";
    const proofDeclaration = {
      declarationId: "decl_0123456789abcdef",
      kind: "theorem" as const,
      name: "route_statement",
      path: "Proofs/Attempt.lean",
      line: 1,
      column: 1,
      signature: "theorem route_statement : True",
      signatureSha256: sha256Hex("theorem route_statement : True"),
      sourceSha256: sha256Hex(sourceText)
    };
    const proofAttempt = {
      checkId: "proof_0123456789abcdef",
      path: ".truth-harness/proofs/2026-06-21-proof_0123456789abcdef.json",
      sourcePath: "Proofs/Attempt.lean",
      sourceSha256: sha256Hex(sourceText),
      sourceByteLength: Buffer.byteLength(sourceText),
      declarationName: "route_statement",
      declaration: proofDeclaration,
      status: "rejected" as const,
      trust: "unverified" as const,
      createdAt: "2026-06-21T00:01:00.000Z",
      diagnosticSnippet: "type mismatch"
    };
    const proofAttemptHistory = [
      proofAttempt,
      {
        ...proofAttempt,
        checkId: "proof_fedcba9876543210",
        path: ".truth-harness/proofs/2026-06-21-proof_fedcba9876543210.json",
        createdAt: "2026-06-21T00:00:30.000Z",
        diagnosticSnippet: "unknown identifier"
      }
    ];
    const proofRepairTarget = {
      repairTargetId: "lpr_0123456789abcdef",
      sourcePath: "Proofs/Attempt.lean",
      sourceSha256: sha256Hex(sourceText),
      markerKind: "sorry" as const,
      markerLine: 2,
      markerColumn: 3,
      declarationId: proofDeclaration.declarationId,
      declarationName: "route_statement",
      declarationSignatureSha256: proofDeclaration.signatureSha256,
      afterEditCommands: [
        "truth-harness proof check Proofs/Attempt.lean --declaration route_statement --write",
        "Rerun the original `truth-harness proof project <project> --json` scan and confirm this repair target is gone."
      ],
      evidenceRequired: [
        "edited workspace-local .lean source",
        "proof-safety scan with this marker absent",
        "accepted proof-check record before using the source as proved evidence"
      ],
      boundary: "This repair target is a local planning aid. It does not prove the declaration, and it must not upgrade trust until a later accepted proof-check record exists."
    };
    const review = minimalReview({
      rootPath: root,
      command: "truth-harness proof check Proofs/Attempt.lean --declaration route_statement --write",
      claimId: "claim_fake",
      kind: "route-obligation",
      routeId: "route_0123456789abcdef",
      obligationId: "obl_0123456789abcdef",
      obligationKind: "formal-proof",
      proofDeclaration,
      proofAttempt,
      proofAttemptHistory,
      proofRepairTarget
    });
    const plan = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-21T00:02:00.000Z"
    });
    const write = await writeWorkspaceRunNextPlan({ rootPath: root, plan });
    const reread = await readWorkspaceRunNextPlan(root, write.plan.planId);
    const summaries = await listWorkspaceRunNextPlans(root);

    expect(plan.item?.proofDeclaration).toEqual(proofDeclaration);
    expect(plan.item?.proofAttempt).toEqual(proofAttempt);
    expect(plan.item?.proofAttemptHistory).toEqual(proofAttemptHistory);
    expect(plan.item?.proofRepairTarget).toEqual(proofRepairTarget);
    expect(reread.item?.proofDeclaration).toEqual(proofDeclaration);
    expect(reread.item?.proofAttempt).toEqual(proofAttempt);
    expect(reread.item?.proofAttemptHistory).toEqual(proofAttemptHistory);
    expect(reread.item?.proofRepairTarget).toEqual(proofRepairTarget);
    expect(write.markdown).toContain(`Proof declaration: \`${proofDeclaration.declarationId}\``);
    expect(write.markdown).toContain(`Proof declaration signature sha256: \`${proofDeclaration.signatureSha256}\``);
    expect(write.markdown).toContain(`Proof attempt: \`${proofAttempt.checkId}\``);
    expect(write.markdown).toContain("Proof attempt history: 2 scoped Lean attempts");
    expect(write.markdown).toContain("unknown identifier");
    expect(write.markdown).toContain(`Proof repair target: \`${proofRepairTarget.repairTargetId}\``);
    expect(write.markdown).toContain(`Proof repair source sha256: \`${proofRepairTarget.sourceSha256}\``);
    expect(summaries).toContainEqual(
      expect.objectContaining({
        planId: write.plan.planId,
        proofAttemptHistorySummary: {
          total: 2,
          latestCheckId: proofAttempt.checkId,
          latestStatus: proofAttempt.status,
          latestSourcePath: proofAttempt.sourcePath,
          latestDiagnosticSnippet: proofAttempt.diagnosticSnippet,
          priorCheckIds: ["proof_fedcba9876543210"]
        },
        proofRepairTargetSummary: {
          repairTargetId: proofRepairTarget.repairTargetId,
          sourcePath: proofRepairTarget.sourcePath,
          sourceSha256: proofRepairTarget.sourceSha256,
          markerKind: proofRepairTarget.markerKind,
          markerLine: proofRepairTarget.markerLine,
          markerColumn: proofRepairTarget.markerColumn,
          declarationId: proofRepairTarget.declarationId,
          declarationName: proofRepairTarget.declarationName,
          declarationSignatureSha256: proofRepairTarget.declarationSignatureSha256,
          afterEditCommand: proofRepairTarget.afterEditCommands[0],
          evidenceRequired: proofRepairTarget.evidenceRequired,
          boundary: proofRepairTarget.boundary
        }
      })
    );
  });
});

function minimalReview(input: {
  rootPath: string;
  command: string;
  claimId?: string;
  kind?: WorkspaceReview["items"][number]["kind"];
  reportId?: string;
  validationPlanId?: string;
  validationGateId?: string;
  validationGateKind?: string;
  routeId?: string;
  obligationId?: string;
  obligationKind?: WorkspaceReview["items"][number]["obligationKind"];
  proofDeclaration?: WorkspaceReview["items"][number]["proofDeclaration"];
  proofAttempt?: WorkspaceReview["items"][number]["proofAttempt"];
  proofAttemptHistory?: WorkspaceReview["items"][number]["proofAttemptHistory"];
  proofRepairTarget?: WorkspaceReview["items"][number]["proofRepairTarget"];
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
      leanProofSafetyItems: 0,
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
      humanReviewRequiredFor: input.claimId ? [`claim-blocker:${input.claimId}`] : [],
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
        proofDeclaration: input.proofDeclaration,
        proofAttempt: input.proofAttempt,
        proofAttemptHistory: input.proofAttemptHistory,
        proofRepairTarget: input.proofRepairTarget,
        reportId: input.reportId,
        validationPlanId: input.validationPlanId,
        validationGateId: input.validationGateId,
        validationGateKind: input.validationGateKind,
        sessionId: input.sessionId,
        domain: input.domain ?? "finance",
        trust: "unverified",
        source: {
          label: input.claimId ? "claim ledger" : "verifier route",
          ref: input.claimId ?? input.routeId ?? "work_run_next_test"
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

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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

function benchmarkRun(
  receipt: ReturnType<typeof createReceipt>,
  options: {
    expectTrust?: BenchmarkRunLike["results"][number]["task"]["expectTrust"];
    passed?: boolean;
    failures?: string[];
  } = {}
): BenchmarkRunLike {
  const expectedTrust = options.expectTrust ?? receipt.trust;
  const passed = options.passed ?? true;

  return {
    suiteId: "tiny-suite",
    title: "Tiny Suite",
    startedAt: "2026-06-18T00:30:00.000Z",
    completedAt: "2026-06-18T00:30:01.000Z",
    total: 1,
    passed: passed ? 1 : 0,
    failed: passed ? 0 : 1,
    trustAccuracy: passed ? 1 : 0,
    results: [
      {
        task: {
          id: "tiny-case",
          prompt: receipt.problem,
          expectTrust: expectedTrust,
          expectEvidenceKind: receipt.evidenceProfile.kind,
          level: "level-1-exact-arithmetic",
          category: "exact-computation",
          aiFailureMode: "wrong arithmetic"
        },
        receipt,
        passed,
        failures: options.failures ?? []
      }
    ]
  };
}

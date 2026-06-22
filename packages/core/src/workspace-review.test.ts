import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeLeanProofCheckRecord, type ProofBackendCommandRunner } from "./proof-backend.js";
import { writeReportDraft } from "./report-draft.js";
import { addResearchSessionCheckpoint, writeResearchHarness, writeResearchSession } from "./research-session.js";
import { attachValidationGateEvidence } from "./validation-plan.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { createWorkspaceReview, listWorkspaceReviews, readWorkspaceReview, writeWorkspaceReview } from "./workspace-review.js";
import { writeVerifierRoute } from "./verifier-route.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace review", () => {
  it("requires a local workspace", async () => {
    const root = await tempRoot();

    await expect(createWorkspaceReview({ rootPath: root })).rejects.toThrow("No Truth Harness workspace found");
  });

  it("prioritizes Lean proof-safety markers before generic proof work", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-21T00:00:00.000Z"
    });
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\n", "utf8");
    const gapSource = [
      "-- comments mentioning sorry should not count",
      "theorem gap : True := by",
      "  sorry"
    ].join("\n");
    await writeFile(join(root, "Proofs", "Gap.lean"), gapSource, "utf8");

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-21T00:01:00.000Z"
    });

    expect(review.items[0]).toMatchObject({
      kind: "route-obligation",
      priority: "critical",
      title: "Resolve Lean proof marker: sorry",
      command: `truth-harness proof project . --workspace ${root} --max-lean-files 40 --json`,
      obligationKind: "formal-proof",
      source: {
        label: "Lean proof safety",
        ref: "lean-marker:Proofs/Gap.lean:3:3"
      },
      proofDeclaration: {
        declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
        kind: "theorem",
        name: "gap",
        path: "Proofs/Gap.lean",
        line: 2,
        column: 1,
        signature: "theorem gap : True",
        signatureSha256: sha256Hex("theorem gap : True"),
        sourceSha256: sha256Hex(gapSource)
      },
      proofRepairTarget: {
        repairTargetId: expect.stringMatching(/^lpr_[a-f0-9]{16}$/u),
        sourcePath: "Proofs/Gap.lean",
        sourceSha256: sha256Hex(gapSource),
        markerKind: "sorry",
        markerLine: 3,
        markerColumn: 3,
        declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
        declarationName: "gap",
        declarationSignatureSha256: sha256Hex("theorem gap : True"),
        afterEditCommands: [
          "truth-harness proof check Proofs/Gap.lean --declaration gap --write",
          expect.stringContaining("proof project <project> --json")
        ],
        evidenceRequired: expect.arrayContaining([
          "edited workspace-local .lean source",
          "proof-safety scan with this marker absent",
          "accepted proof-check record before using the source as proved evidence"
        ]),
        boundary: expect.stringContaining("must not upgrade trust")
      },
      evidenceSlots: [
        expect.objectContaining({
          slotId: "lean-proof-safety-clearance",
          label: "Lean proof marker clearance",
          description: expect.stringContaining("Target declaration: theorem gap")
        })
      ],
      acceptanceCriteria: expect.arrayContaining([
        expect.stringContaining("replace the proof placeholder"),
        expect.stringContaining("Repair the enclosing theorem gap"),
        expect.stringContaining("Resolve repair target")
      ])
    });
    expect(review.items[0]?.agentPacket).toContain("Proof declaration:");
    expect(review.items[0]?.agentPacket).toContain("Proof declaration signature sha256:");
    expect(review.items[0]?.agentPacket).toContain("Proof repair target:");
    expect(review.items[0]?.agentPacket).toContain("Proof repair after-edit command:");
    expect(review.items[0]?.evidenceSlots?.[0]?.description).toContain("after editing, run truth-harness proof check Proofs/Gap.lean --declaration gap --write");
    expect(review.summary.leanProofSafetyItems).toBe(1);
    expect(review.autonomy.nextItemId).toBe(review.items[0]?.itemId);
    expect(review.autonomy.nextCommand).toBe(review.items[0]?.command);
  });

  it("exposes validation gate attach commands in evidence slots", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-18T00:00:00.000Z"
    });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const proofGate = harness.validationPlan?.plan.gates.find((gate) => gate.kind === "proof");
    if (!proofGate) {
      throw new Error("Expected a linked proof validation gate.");
    }

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-18T00:02:00.000Z"
    });

    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "validation-gate",
        sessionId: harness.session.sessionId,
        validationPlanId: harness.validationPlan?.plan.planId,
        validationGateId: proofGate.gateId,
        evidenceSlots: expect.arrayContaining([
          expect.objectContaining({
            slotId: "validation-proof-evidence",
            attachCommand: `truth-harness validation attach ${harness.validationPlan?.plan.planId} ${proofGate.gateId} --evidence <kind:path-or-id> --json`,
            attachTo: expect.objectContaining({
              sessionId: harness.session.sessionId,
              validationPlanId: harness.validationPlan?.plan.planId,
              validationGateId: proofGate.gateId
            })
          })
        ]),
        agentPacket: expect.stringContaining("Attach command: truth-harness validation attach")
      })
    );
  });

  it("renders concrete validation attach commands for candidate session evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-18T00:00:00.000Z"
    });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const proofGate = harness.validationPlan?.plan.gates.find((gate) => gate.kind === "proof");
    if (!proofGate) {
      throw new Error("Expected a linked proof validation gate.");
    }
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: harness.session.sessionId,
      summary: "Earlier unverified proof attempt should not outrank accepted proof evidence.",
      evidenceRefs: [{ kind: "proof", ref: ".truth-harness/proofs/unverified-attempt.json", trust: "unverified" }],
      nextChecks: ["Attach accepted proof evidence when available."],
      now: "2026-06-18T00:01:30.000Z"
    });
    await writeFile(join(root, "scoped.lean"), "theorem scoped_fixture : True := by trivial\n", "utf8");
    const proofRunner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
      }

      return { status: 0, stdout: "", stderr: "" };
    };
    const proof = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "scoped.lean",
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
    const item = review.items.find(
      (candidate) => candidate.kind === "validation-gate" && candidate.validationGateId === proofGate.gateId
    );

    expect(item).toMatchObject({
      kind: "validation-gate",
      sessionId: harness.session.sessionId,
      validationGateId: proofGate.gateId,
      command: `truth-harness validation attach ${harness.validationPlan?.plan.planId} ${proofGate.gateId} --evidence proof:${proofRef} --json`,
      evidenceSlots: expect.arrayContaining([
        expect.objectContaining({
          attachCommand: `truth-harness validation attach ${harness.validationPlan?.plan.planId} ${proofGate.gateId} --evidence proof:${proofRef} --json`
        })
      ]),
      agentPacket: expect.stringContaining(`Attach command: truth-harness validation attach ${harness.validationPlan?.plan.planId} ${proofGate.gateId} --evidence proof:${proofRef} --json`)
    });
    expect(item?.candidateEvidenceRefs?.[0]).toMatchObject({ kind: "proof", ref: proofRef, trust: "proved" });
    expect(item?.candidateEvidenceRefs?.[1]).toMatchObject({
      kind: "proof",
      ref: ".truth-harness/proofs/unverified-attempt.json",
      trust: "unverified"
    });
  });

  it("lets concrete route obligations lead after a validation gate has weak attached evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-18T00:00:00.000Z"
    });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "Prove a deliberately unverified symbolic research claim.",
      domains: ["math"],
      claims: ["Prove the symbolic research claim H."],
      now: "2026-06-18T00:01:00.000Z"
    });
    const plan = harness.validationPlan?.plan;
    const proofGate = plan?.gates.find((gate) => gate.kind === "proof");
    if (!plan || !proofGate) {
      throw new Error("Expected a linked proof validation gate.");
    }
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "Prove the symbolic research claim H.",
      now: new Date("2026-06-18T00:02:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const storedRoute = JSON.parse(await readFile(route.jsonPath, "utf8")) as {
      proofObligations: Array<Record<string, unknown>>;
    };
    storedRoute.proofObligations = [
      {
        obligationId: "obl_cas_escalation_after_weak_gate_evidence",
        kind: "independent-check",
        status: "open",
        severity: "critical",
        sourceCapabilityId: "maxima-cas",
        title: "Independent CAS cross-check obligation",
        statement: "symbolic simplify sin(x)^2 + cos(x)^2",
        requiredBefore: "Before labeling this scoped claim cross-checked.",
        acceptanceCriteria: ["Attach an independent CAS agreement record."],
        command: 'truth-harness cas check --operation simplify --expression "sin(x)^2 + cos(x)^2" --result 1 --write'
      }
    ];
    await writeFile(route.jsonPath, JSON.stringify(storedRoute, null, 2), "utf8");
    await attachValidationGateEvidence({
      rootPath: root,
      planRef: plan.planId,
      gateId: proofGate.gateId,
      evidenceRef: {
        kind: "route",
        ref: route.route.routeId,
        trust: route.route.finalTrust
      },
      now: "2026-06-18T00:03:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-18T00:04:00.000Z"
    });
    const validationItem = review.items.find(
      (candidate) => candidate.kind === "validation-gate" && candidate.validationGateId === proofGate.gateId
    );
    const snapshotItem = review.items.find(
      (candidate) => candidate.kind === "validation-gate" && candidate.validationGateKind === "workspace-snapshot"
    );

    expect(validationItem).toMatchObject({
      kind: "validation-gate",
      priority: "low",
      command: expect.stringMatching(/^(npm run docker:engines|npm run docker:sage|docker compose run --rm lean-proof)$/u)
    });
    expect(validationItem?.command).not.toContain("truth-harness verify");
    expect(snapshotItem).toMatchObject({
      kind: "validation-gate",
      priority: "low",
      command: `truth-harness workspace snapshot ${root} --json`,
      candidateEvidenceRefs: []
    });
    expect(review.items[0]).toMatchObject({
      kind: "route-obligation",
      routeId: route.route.routeId
    });
    expect(review.autonomy.nextItemId).toBe(review.items[0]?.itemId);
    expect(review.autonomy.nextCommand).toBe(review.items[0]?.command);
    expect(review.autonomy.nextCommand).not.toBe(validationItem?.command);
  });

  it("uses a matching ready route as validation-gate evidence before recording a claim", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-18T00:00:00.000Z"
    });
    const harness = await writeResearchHarness({
      rootPath: root,
      objective: "3 / 4 + 5 / 8",
      domains: ["math"],
      now: "2026-06-18T00:01:00.000Z"
    });
    const plan = harness.validationPlan?.plan;
    const proofGate = plan?.gates.find((gate) => gate.kind === "proof");
    if (!plan || !proofGate) {
      throw new Error("Expected a linked proof validation gate.");
    }
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "3 / 4 + 5 / 8",
      now: new Date("2026-06-18T00:02:00.000Z")
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-18T00:03:00.000Z"
    });
    const validationItem = review.items.find(
      (candidate) => candidate.kind === "validation-gate" && candidate.validationGateId === proofGate.gateId
    );
    const readyClaimItem = review.items.find((candidate) => candidate.kind === "route-ready-claim");

    expect(validationItem).toMatchObject({
      kind: "validation-gate",
      priority: "critical",
      command: `truth-harness validation attach ${plan.planId} ${proofGate.gateId} --evidence route:${route.route.routeId} --json`,
      candidateEvidenceRefs: [
        expect.objectContaining({
          kind: "route",
          ref: route.route.routeId,
          trust: "exact-computed"
        })
      ]
    });
    expect(readyClaimItem).toMatchObject({
      kind: "route-ready-claim",
      routeId: route.route.routeId,
      domain: "math",
      command: `truth-harness claim add "3 / 4 + 5 / 8" --workspace ${root} --domain math --evidence route:${route.route.routeId} --trust exact-computed --json`
    });
    expect(review.items[0]?.itemId).toBe(validationItem?.itemId);
    expect(review.autonomy.nextCommand).toBe(validationItem?.command);
  });

  it("orders route obligations and blocked claims into a local work queue", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const blockedRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "prove the Riemann hypothesis",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const readyRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-13T00:02:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    await writeClaimLedgerRecord({
      rootPath: root,
      title: "Unverified biology mechanism",
      statement: "A hypothetical biology mechanism cures hair loss.",
      domain: "biology",
      nextChecks: ["Attach source citations and qualified expert review."],
      now: "2026-06-13T00:03:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-13T00:04:00.000Z"
    });

    expect(review.schemaVersion).toBe("truth-harness.workspace-review.v0");
    expect(review.localOnly).toBe(true);
    expect(review.networkAccess).toBe("none");
    expect(review.summary.routes).toBe(2);
    expect(review.summary.claims).toBe(1);
    expect(review.summary.routeObligations).toBe(0);
    expect(review.summary.readyRoutesWithoutClaims).toBe(1);
    expect(review.summary.blockedClaims).toBe(1);
    expect(review.summary.criticalItems).toBe(0);
    expect(review.summary.highItems).toBeGreaterThanOrEqual(1);
    expect(review.autonomy).toMatchObject({
      mode: "human-review-gated",
      canRunUnattended: true,
      nextItemId: review.items[0]?.itemId,
      nextCommand: review.items[0]?.command
    });
    expect(review.autonomy.suggestedBatchSize).toBe(2);
    expect(review.autonomy.blockedActions).toContain("Do not upgrade a trust label unless an accepted local artifact satisfies the exact matching obligation.");
    expect(review.autonomy.stopConditions).toContain("A high-stakes interpretation, final claim, treatment, patentability, or real-world recommendation is requested.");
    expect(review.autonomy.humanReviewRequiredFor).toEqual(expect.arrayContaining([expect.stringMatching(/^claim-blocker:claim_/u)]));
    expect(review.autonomy.agentPacket).toContain("# Truth Harness Autonomy Contract");
    expect(review.autonomy.agentPacket).toContain("This contract can authorize local work. It cannot certify truth.");
    expect(review.warnings).toContainEqual(expect.stringContaining("passive route obligations remain on verifier routes"));
    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        kind: "route-obligation",
        routeId: blockedRoute.route.routeId
      })
    );
    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        kind: "route-obligation",
        routeId: blockedRoute.route.routeId,
        priority: "critical"
      })
    );
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "route-ready-claim",
        routeId: readyRoute.route.routeId,
        command: expect.stringContaining("truth-harness claim add"),
        domain: "math",
        acceptanceCriteria: expect.arrayContaining([
          "Record a narrow claim that cites this route as evidence.",
          "Use the route's strongest trust label without upgrading it."
        ]),
        evidenceSlots: expect.arrayContaining([
          expect.objectContaining({
            slotId: "claim-ledger-record",
            acceptedArtifacts: expect.arrayContaining(["truth-harness claim add"])
          })
        ]),
        agentPacket: expect.stringContaining("Acceptance criteria:")
      })
    );
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "claim-blocker",
        domain: "biology",
        priority: "high",
        command: expect.stringContaining("truth-harness verify"),
        acceptanceCriteria: expect.arrayContaining([
          "Run the claim review and resolve the named open check.",
          "Do not finalize the claim until open blockers are represented in the ledger."
        ]),
        evidenceSlots: expect.arrayContaining([
          expect.objectContaining({
            slotId: "claim-supporting-evidence",
            attachTo: expect.objectContaining({
              claimId: expect.stringMatching(/^claim_/u)
            })
          })
        ]),
        agentPacket: expect.stringContaining("Claim:")
      })
    );
    expect(review.markdown).toContain("## Ordered Work Queue");
    expect(review.markdown).toContain("## Autonomy Contract");
    expect(review.markdown).toContain("| Autonomy mode | `human-review-gated` |");
    expect(review.markdown).toContain("  - Acceptance:");
    expect(review.markdown).toContain("Workspace review is a local planning queue");
  });

  it("promotes executable claim-review actions over passive claim review packets", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      title: "Unverified arithmetic lemma",
      statement: "\\operatorname{lcm}(4,8) = 8",
      domain: "math",
      now: "2026-06-13T00:01:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 0,
      maxClaims: 1,
      maxSessions: 0,
      now: "2026-06-13T00:02:00.000Z"
    });
    const item = review.items.find((candidate) => candidate.kind === "claim-blocker");

    expect(item).toMatchObject({
      kind: "claim-blocker",
      claimId: claim.claim.claimId,
      command: expect.stringContaining("truth-harness verify")
    });
    expect(item?.command).toContain("--write");
    expect(item?.command).toContain(`--workspace ${root}`);
    expect(item?.command).not.toContain("truth-harness claim review");
    expect(item?.evidenceSlots).toContainEqual(
      expect.objectContaining({
        slotId: "claim-supporting-evidence",
        suggestedCommand: item?.command
      })
    );
    expect(review.autonomy.nextCommand).toBe(item?.command);
  });

  it("uses equivalent ready routes to resolve blocked claims before re-verifying them", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      title: "Common denominator lemma",
      statement: "\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{6}{8}",
      domain: "math",
      now: "2026-06-13T00:01:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{6}{8}",
      now: new Date("2026-06-13T00:02:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 1,
      maxSessions: 0,
      now: "2026-06-13T00:03:00.000Z"
    });
    const item = review.items.find((candidate) => candidate.kind === "claim-blocker");

    expect(item).toMatchObject({
      kind: "claim-blocker",
      claimId: claim.claim.claimId,
      command: expect.stringContaining("truth-harness claim add"),
      acceptanceCriteria: expect.arrayContaining([
        "Write a superseding claim that cites the ready route or evidence artifact.",
        "Leave the old blocked claim superseded instead of duplicating unresolved work."
      ])
    });
    expect(item?.command).toContain(`--supersedes ${claim.claim.claimId}`);
    expect(item?.command).toContain(`--evidence route:${route.route.routeId}`);
    expect(item?.command).toContain("--trust exact-computed");
    expect(item?.command).not.toContain("truth-harness verify");
    expect(review.autonomy.nextCommand).toBe(item?.command);
  });

  it("prefers evidence-writing route obligations over passive inspection commands", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "solve integer constraints x > 0 and x < 3",
      now: new Date("2026-06-13T00:01:00.000Z"),
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
        obligationId: "obl_smt_evidence_order_test",
        kind: "solver-encoding",
        status: "open",
        severity: "critical",
        sourceCapabilityId: "z3-smt-solver",
        title: "SMT encoding obligation",
        statement: "solve integer constraints x > 0 and x < 3",
        requiredBefore: "Before labeling this scoped claim smt-checked.",
        acceptanceCriteria: ["Attach a concrete SMT check record."],
        command: "truth-harness smt check docs/examples/constraints.smt2 --backend z3 --write"
      },
      {
        obligationId: "obl_passive_proof_order_test",
        kind: "formal-proof",
        status: "open",
        severity: "critical",
        sourceCapabilityId: "lean-proof-checker",
        title: "Formal proof-checker obligation",
        statement: "solve integer constraints x > 0 and x < 3",
        requiredBefore: "Before labeling this scoped claim proved.",
        acceptanceCriteria: ["Attach an accepted proof-check record."],
        command: "truth-harness proof check docs/examples/trivial.lean --write"
      }
    ];
    await writeFile(route.jsonPath, JSON.stringify(stored, null, 2), "utf8");

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-13T00:02:00.000Z"
    });
    const routeItems = review.items.filter(
      (item) => item.kind === "route-obligation" && item.routeId === route.route.routeId
    );
    const evidenceCommandIndex = routeItems.findIndex((item) => /^truth-harness smt check\b/u.test(item.command));
    const passiveCommandIndex = routeItems.findIndex((item) => /^truth-harness route show\b/u.test(item.command));

    expect(evidenceCommandIndex).toBeGreaterThanOrEqual(0);
    expect(passiveCommandIndex).toBe(-1);
    expect(routeItems[evidenceCommandIndex]?.command).toContain("--write");
    expect(review.autonomy.nextCommand).toBe(routeItems[evidenceCommandIndex]?.command);
    expect(review.warnings).toContainEqual(expect.stringContaining("1 passive route obligation remains on verifier routes"));
  });

  it("uses Lean declaration inventory to make placeholder proof obligations concrete", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-21T00:00:00.000Z"
    });
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\n", "utf8");
    const leanSource = "theorem route_statement : True := by trivial\n";
    await writeFile(join(root, "Proofs", "RouteStatement.lean"), leanSource, "utf8");
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "route_statement : True",
      now: new Date("2026-06-21T00:01:00.000Z"),
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
        obligationId: "obl_lean_declaration_target",
        kind: "formal-proof",
        status: "open",
        severity: "critical",
        sourceCapabilityId: "lean-proof-checker",
        title: "Formal proof-checker obligation",
        statement: "route_statement : True",
        requiredBefore: "Before labeling this scoped claim proved.",
        acceptanceCriteria: ["Attach an accepted proof-check record scoped to this route obligation."],
        command: "truth-harness proof check <workspace-local.lean> --write"
      }
    ];
    await writeFile(route.jsonPath, JSON.stringify(stored, null, 2), "utf8");

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-21T00:02:00.000Z"
    });
    const item = review.items.find(
      (candidate) =>
        candidate.kind === "route-obligation" &&
        candidate.routeId === route.route.routeId &&
        candidate.obligationId === "obl_lean_declaration_target"
    );

    expect(item).toMatchObject({
      kind: "route-obligation",
      obligationKind: "formal-proof",
      command: expect.stringContaining("truth-harness proof check Proofs/RouteStatement.lean --declaration route_statement --write")
    });
    expect(item?.command).toContain(`--route ${route.route.routeId}`);
    expect(item?.command).toContain("--obligation obl_lean_declaration_target");
    expect(item?.command).toContain('--statement "route_statement : True"');
    expect(item?.command).toContain("--statement-hash");
    expect(item?.command).not.toContain("route show");
    expect(item?.proofDeclaration).toMatchObject({
      declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
      kind: "theorem",
      name: "route_statement",
      path: "Proofs/RouteStatement.lean",
      line: 1,
      column: 1,
      signature: "theorem route_statement : True",
      signatureSha256: sha256Hex("theorem route_statement : True"),
      sourceSha256: sha256Hex(leanSource)
    });
    expect(item?.agentPacket).toContain("Proof declaration:");
    expect(item?.agentPacket).toContain("Proof declaration signature sha256:");
    expect(review.autonomy.nextCommand).toBe(item?.command);
  });

  it("reuses the latest rejected scoped Lean attempt as the next proof repair target", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-21T00:00:00.000Z"
    });
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\n", "utf8");
    await writeFile(join(root, "Proofs", "Attempt.lean"), "theorem route_statement : True := by\n  exact False.elim\n", "utf8");
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "route_statement : True",
      now: new Date("2026-06-21T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const obligationId = "obl_0123456789abce01";
    const stored = JSON.parse(await readFile(route.jsonPath, "utf8")) as {
      proofObligations: Array<Record<string, unknown>>;
    };
    stored.proofObligations = [
      {
        obligationId,
        kind: "formal-proof",
        status: "open",
        severity: "critical",
        sourceCapabilityId: "lean-proof-checker",
        title: "Formal proof-checker obligation",
        statement: "route_statement : True",
        requiredBefore: "Before labeling this scoped claim proved.",
        acceptanceCriteria: ["Attach an accepted proof-check record scoped to this route obligation."],
        command: "truth-harness proof check <workspace-local.lean> --write"
      }
    ];
    await writeFile(route.jsonPath, JSON.stringify(stored, null, 2), "utf8");
    const proofRunner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
      }

      return { status: 1, stdout: "", stderr: "type mismatch\n" };
    };
    const attempt = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "Proofs/Attempt.lean",
      declarationName: "route_statement",
      scope: {
        routeId: route.route.routeId,
        obligationId,
        statement: "route_statement : True"
      },
      runner: proofRunner,
      now: new Date("2026-06-21T00:02:00.000Z")
    });
    const expectedDeclaration = {
      declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
      kind: "theorem",
      name: "route_statement",
      path: "Proofs/Attempt.lean",
      line: 1,
      column: 1,
      signature: "theorem route_statement : True",
      signatureSha256: sha256Hex("theorem route_statement : True"),
      sourceSha256: attempt.record.source.sha256
    };

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-21T00:03:00.000Z"
    });
    const item = review.items.find(
      (candidate) =>
        candidate.kind === "route-obligation" &&
        candidate.routeId === route.route.routeId &&
        candidate.obligationId === obligationId
    );

    expect(attempt.record.status).toBe("rejected");
    expect(attempt.record.source.declaration).toMatchObject(expectedDeclaration);
    expect(item).toMatchObject({
      kind: "route-obligation",
      obligationKind: "formal-proof",
      command: expect.stringContaining("truth-harness proof check Proofs/Attempt.lean --declaration route_statement --write"),
      summary: expect.stringContaining(`Latest scoped Lean attempt ${attempt.record.checkId} is rejected`),
      proofDeclaration: expectedDeclaration,
      proofAttempt: {
        checkId: attempt.record.checkId,
        path: expect.stringContaining(".truth-harness/proofs/"),
        sourcePath: "Proofs/Attempt.lean",
        sourceSha256: attempt.record.source.sha256,
        sourceByteLength: attempt.record.source.byteLength,
        sourceStatus: "unchanged",
        sourceCurrentSha256: attempt.record.source.sha256,
        sourceCurrentByteLength: attempt.record.source.byteLength,
        declarationName: "route_statement",
        declaration: expectedDeclaration,
        status: "rejected",
        trust: "unverified",
        createdAt: attempt.record.createdAt,
        diagnosticSnippet: "type mismatch"
      },
      evidenceSlots: [
        expect.objectContaining({
          slotId: "lean-proof-repair",
          label: "Lean proof repair artifact",
          description: expect.stringContaining("source is unchanged"),
          attachCommand: `truth-harness route satisfy ${route.route.routeId} ${obligationId} --evidence "proof:<proof-check-id-or-path>" --json`,
          attachTo: expect.objectContaining({
            routeId: route.route.routeId,
            obligationId
          })
        })
      ],
      acceptanceCriteria: expect.arrayContaining([
        "Do not rerun the proof check until the workspace-local Lean source changes from the rejected attempt hash.",
        "Edit the same Lean source named in the suggested command; do not start a disconnected proof attempt.",
        "Use the diagnostic preview as a repair hint, but rerun Lean before trusting the fix.",
        "Close this only after an accepted proof-check record is attached to the exact route and obligation."
      ]),
      agentPacket: expect.stringContaining(`Proof source: Proofs/Attempt.lean sha256:${attempt.record.source.sha256}`)
    });
    expect(item?.agentPacket).toContain("Proof source status: unchanged");
    expect(item?.agentPacket).toContain("Proof declaration signature sha256:");
    expect(item?.summary).toContain("Source unchanged since that failed attempt");
    expect(item?.agentPacket).toContain("Lean proof repair artifact");
    expect(item?.summary).toContain("Diagnostic: type mismatch");
    expect(item?.command).toContain(`--route ${route.route.routeId}`);
    expect(item?.command).toContain(`--obligation ${obligationId}`);
    expect(item?.command).toContain('--statement "route_statement : True"');
    expect(item?.command).not.toContain("route show");
    expect(review.autonomy.nextCommand).toBe(item?.command);

    await writeFile(join(root, "Proofs", "Attempt.lean"), "theorem route_statement : True := by\n  trivial\n", "utf8");
    const changedReview = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-21T00:04:00.000Z"
    });
    const changedItem = changedReview.items.find(
      (candidate) =>
        candidate.kind === "route-obligation" &&
        candidate.routeId === route.route.routeId &&
        candidate.obligationId === obligationId
    );

    expect(changedItem).toMatchObject({
      proofAttempt: {
        checkId: attempt.record.checkId,
        sourceStatus: "changed",
        sourceCurrentSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        sourceCurrentByteLength: Buffer.byteLength("theorem route_statement : True := by\n  trivial\n")
      },
      evidenceSlots: [
        expect.objectContaining({
          slotId: "lean-proof-repair",
          description: expect.stringContaining("source changed")
        })
      ],
      acceptanceCriteria: expect.arrayContaining([
        "The Lean source has changed since the rejected attempt; rerun the suggested scoped proof check to create fresh evidence."
      ]),
      summary: expect.stringContaining("Source changed since that failed attempt")
    });
    expect(changedItem?.proofAttempt?.sourceCurrentSha256).not.toBe(attempt.record.source.sha256);
    expect(changedItem?.agentPacket).toContain("Proof source status: changed");
  });

  it("derives missing independent SMT commands from sibling route SMT sources", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "solve integer constraints x > 0 and x < 3",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      cvc5Command: "truth-harness-missing-cvc5-command",
      smtReviewPolicy: "independent",
      timeoutMs: 50
    });
    const stored = JSON.parse(await readFile(route.jsonPath, "utf8")) as {
      proofObligations: Array<Record<string, unknown>>;
    };
    const z3Obligation = stored.proofObligations.find((obligation) => obligation.sourceCapabilityId === "z3-smt-solver");
    const cvc5Obligation = stored.proofObligations.find((obligation) => obligation.sourceCapabilityId === "cvc5-smt-solver");
    expect(z3Obligation?.command).toContain("docs/examples/constraints.smt2");
    expect(cvc5Obligation?.command).toContain("docs/examples/constraints.smt2");
    if (cvc5Obligation) {
      delete cvc5Obligation.command;
    }
    await writeFile(route.jsonPath, JSON.stringify(stored, null, 2), "utf8");

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-13T00:02:00.000Z"
    });
    const item = review.items.find(
      (candidate) =>
        candidate.kind === "route-obligation" &&
        candidate.routeId === route.route.routeId &&
        candidate.obligationId === cvc5Obligation?.obligationId
    );

    expect(item).toMatchObject({
      kind: "route-obligation",
      obligationKind: "solver-encoding",
      command: "truth-harness smt check docs/examples/constraints.smt2 --backend cvc5 --write"
    });
    expect(item?.command).not.toContain("route show");
    expect(review.autonomy.nextCommand).toMatch(/^truth-harness smt check\b/u);
  });

  it("does not ask for a ready-route claim after a claim cites that route", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 1 / 2 + 1 / 4",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    await writeClaimLedgerRecord({
      rootPath: root,
      title: "Exact fraction sum",
      statement: "1 / 2 + 1 / 4 = 3/4",
      domain: "math",
      evidenceRefs: [{ kind: "route", ref: route.route.routeId }],
      now: "2026-06-13T00:02:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-13T00:03:00.000Z"
    });

    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        kind: "route-ready-claim",
        routeId: route.route.routeId
      })
    );
    expect(review.summary.readyRoutesWithoutClaims).toBe(0);
  });

  it("reviews equivalent ready-route claims instead of creating duplicates", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const oldClaim = await writeClaimLedgerRecord({
      rootPath: root,
      title: "3 / 4 + 5 / 8",
      statement: "\\frac{3}{4}+\\frac{5}{8} = \\frac{11}{8}",
      domain: "math",
      now: "2026-06-13T00:02:00.000Z"
    });
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      title: "3 / 4 + 5 / 8",
      statement: "\\frac{3}{4}+\\frac{5}{8} = \\frac{11}{8}",
      domain: "math",
      supersedes: [oldClaim.claim.claimId],
      now: "2026-06-13T00:02:30.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 10,
      maxSessions: 0,
      now: "2026-06-13T00:03:00.000Z"
    });
    const item = review.items.find(
      (candidate) => candidate.kind === "route-ready-claim" && candidate.routeId === route.route.routeId
    );

    expect(item).toMatchObject({
      kind: "route-ready-claim",
      title: "Link ready route to an existing claim",
      routeId: route.route.routeId,
      claimId: claim.claim.claimId,
      command: expect.stringContaining(`truth-harness claim review ${claim.claim.claimId}`),
      summary: expect.stringContaining("equivalent claim"),
      acceptanceCriteria: expect.arrayContaining([
        "Review the existing equivalent claim and link or supersede it with this ready route.",
        "Do not create a duplicate claim for the same scoped statement."
      ]),
      evidenceSlots: expect.arrayContaining([
        expect.objectContaining({
          label: "Claim ledger link",
          acceptedArtifacts: expect.arrayContaining(["truth-harness claim review"]),
          attachTo: expect.objectContaining({
            routeId: route.route.routeId,
            claimId: claim.claim.claimId
          })
        })
      ])
    });
    expect(item?.command).not.toContain("truth-harness claim add");
    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        kind: "claim-blocker",
        claimId: oldClaim.claim.claimId
      })
    );
  });

  it("does not let stale weaker equivalent routes outrank newer ready evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const oldRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{6}{8}",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const stored = JSON.parse(await readFile(oldRoute.jsonPath, "utf8")) as {
      status: string;
      finalTrust: string;
      evidenceKind: string;
      proofObligations: Array<Record<string, unknown>>;
    };
    stored.status = "unverified";
    stored.finalTrust = "unverified";
    stored.evidenceKind = "unsupported";
    stored.proofObligations = [
      {
        ...stored.proofObligations[0],
        kind: "solver-encoding",
        status: "open",
        severity: "critical",
        title: "SMT encoding obligation",
        requiredBefore: "Before labeling this scoped claim smt-checked.",
        command: "truth-harness smt check <workspace-local.smt2> --write"
      }
    ];
    await writeFile(oldRoute.jsonPath, JSON.stringify(stored, null, 2), "utf8");
    const newRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{6}{8}",
      now: new Date("2026-06-13T00:02:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 10,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-13T00:03:00.000Z"
    });

    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        kind: "route-obligation",
        routeId: oldRoute.route.routeId
      })
    );
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "route-ready-claim",
        routeId: newRoute.route.routeId,
        trust: "exact-computed"
      })
    );
    expect(review.summary.routeObligations).toBe(0);
    expect(review.autonomy.nextCommand).toContain(`route:${newRoute.route.routeId}`);
  });

  it("keeps stronger-label upgrades below current route blockers", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "for all integers n, n^2+n is even",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-13T00:02:00.000Z"
    });
    expect(route.route.finalTrust).toBe("exact-computed");
    expect(review.summary.criticalItems).toBe(0);
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "route-ready-claim",
        routeId: route.route.routeId,
        priority: "low"
      })
    );
    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        kind: "route-obligation",
        routeId: route.route.routeId
      })
    );
    expect(review.warnings).toContainEqual(expect.stringContaining("passive route obligations remain on verifier routes"));
  });

  it("prioritizes ready claim recording before passive proof inspection placeholders", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const blockedRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "solve integer constraints x > 0 and x < 3",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const stored = JSON.parse(await readFile(blockedRoute.jsonPath, "utf8")) as {
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
    await writeFile(blockedRoute.jsonPath, JSON.stringify(stored, null, 2), "utf8");
    const readyRoute = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 1 + 1",
      now: new Date("2026-06-13T00:02:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 10,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-13T00:03:00.000Z"
    });
    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        kind: "route-obligation",
        routeId: blockedRoute.route.routeId
      })
    );
    expect(review.items[0]).toMatchObject({
      kind: "route-ready-claim",
      routeId: readyRoute.route.routeId,
      domain: "math",
      command: expect.stringContaining("--domain math")
    });
    expect(review.autonomy.nextCommand).toBe(review.items[0]?.command);
    expect(review.warnings).toContainEqual(expect.stringContaining("1 passive route obligation remains on verifier routes"));
  });

  it("does not treat passive-only inspection blockers as unattended local work", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "solve integer constraints x > 0 and x < 3",
      now: new Date("2026-06-13T00:01:00.000Z"),
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
      now: "2026-06-13T00:02:00.000Z"
    });

    expect(review.items).toEqual([]);
    expect(review.summary.routeObligations).toBe(0);
    expect(review.autonomy.mode).toBe("idle");
    expect(review.autonomy.canRunUnattended).toBe(false);
    expect(review.autonomy.suggestedBatchSize).toBe(0);
    expect(review.autonomy.nextCommand).toBeUndefined();
    expect(review.autonomy.agentPacket).toContain("No open local work item.");
    expect(review.warnings).toContainEqual(expect.stringContaining("1 passive route obligation remains on verifier routes"));
  });

  it("demotes legacy stronger-claim obligations that were stored as critical", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-13T00:01:00.000Z"),
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
        status: "open",
        severity: "critical",
        requiredBefore: "Before making a stronger claim than the current receipt supports.",
        command: "truth-harness proof check docs/examples/trivial.lean --write"
      }
    ];
    await writeFile(route.jsonPath, JSON.stringify(stored, null, 2), "utf8");

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-13T00:02:00.000Z"
    });

    expect(review.summary.criticalItems).toBe(0);
    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        kind: "route-obligation",
        routeId: route.route.routeId
      })
    );
    expect(review.warnings).toContainEqual(expect.stringContaining("1 passive route obligation remains on verifier routes"));
  });

  it("creates a local verifier autonomy contract for non-high-stakes work", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 1 / 2 + 1 / 4",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-13T00:02:00.000Z"
    });

    expect(review.items.length).toBeGreaterThan(0);
    expect(review.autonomy.mode).toBe("local-verifier-loop");
    expect(review.autonomy.canRunUnattended).toBe(true);
    expect(review.autonomy.nextItemId).toBe(review.items[0]?.itemId);
    expect(review.autonomy.nextCommand).toBe(review.items[0]?.command);
    expect(review.autonomy.humanReviewRequiredFor).not.toContain(`route-ready-claim:${route.route.routeId}`);
    expect(review.autonomy.allowedActions).toContain("Batch up to the suggested number of verifier tasks before pausing for review.");
    expect(review.autonomy.blockedActions).toContain("Do not make final medical, legal, patent, finance, safety, or scientific claims from AI output alone.");
    expect(review.autonomy.agentPacket).toContain("Mode: local-verifier-loop");
  });

  it("honors route and claim limits for bounded agent handoffs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    await writeVerifierRoute({
      rootPath: root,
      problem: "compute 1 / 2 + 1 / 4",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    await writeVerifierRoute({
      rootPath: root,
      problem: "compute 2 / 3 + 1 / 6",
      now: new Date("2026-06-13T00:02:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    await writeClaimLedgerRecord({
      rootPath: root,
      title: "Blocked local claim",
      statement: "A narrow claim still needs review.",
      nextChecks: ["Attach supporting evidence before final use."],
      now: "2026-06-13T00:03:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      maxClaims: 0,
      now: "2026-06-13T00:04:00.000Z"
    });

    expect(review.summary.routes).toBe(1);
    expect(review.summary.claims).toBe(0);
    expect(review.items.every((item) => item.kind !== "claim-blocker")).toBe(true);
    expect(review.markdown).toContain("## Ordered Work Queue");
  });

  it("includes active research sessions in bounded agent handoffs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const start = await writeResearchSession({
      rootPath: root,
      title: "Exact arithmetic proof route",
      objective: "Turn a reusable fraction computation into auditable proof work.",
      domains: ["math"],
      tasks: ["Attach a Lean proof attempt", "Run a second symbolic checker"],
      now: "2026-06-13T00:01:00.000Z"
    });
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: start.session.sessionId,
      summary: "Initial route exists but the proof gate is still open.",
      nextChecks: ["Attach an accepted Lean or SMT artifact to the route."],
      now: "2026-06-13T00:02:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 1,
      now: "2026-06-13T00:03:00.000Z"
    });
    const skipped = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      now: "2026-06-13T00:03:00.000Z"
    });

    expect(review.summary.sessions).toBe(1);
    expect(review.summary.sessionTasks).toBe(2);
    expect(review.summary.sessionNextChecks).toBe(1);
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "session-task",
        sessionId: start.session.sessionId,
        title: "Research task: Attach a Lean proof attempt",
        command: expect.stringContaining("truth-harness research show"),
        acceptanceCriteria: expect.arrayContaining([
          "Open the research session and update only this task or its attached evidence."
        ]),
        evidenceSlots: expect.arrayContaining([
          expect.objectContaining({
            slotId: "research-checkpoint",
            attachTo: expect.objectContaining({
              sessionId: start.session.sessionId
            })
          })
        ]),
        agentPacket: expect.stringContaining(`Session: ${start.session.sessionId}`)
      })
    );
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "session-next-check",
        sessionId: start.session.sessionId,
        summary: expect.stringContaining("checkpoint"),
        command: expect.stringContaining(start.session.sessionId),
        acceptanceCriteria: expect.arrayContaining([
          "Open the research session and answer this checkpoint check directly."
        ])
      })
    );
    expect(review.markdown).toContain("| Sessions | `1` |");
    expect(skipped.summary.sessions).toBe(0);
    expect(skipped.summary.totalItems).toBe(0);
  });

  it("uses the latest research checkpoint as the active next-check frontier", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const start = await writeResearchSession({
      rootPath: root,
      title: "Symbolic route cleanup",
      objective: "Keep stale checkpoint branches out of the current agent queue.",
      domains: ["math"],
      tasks: [],
      now: "2026-06-13T00:01:00.000Z"
    });
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: start.session.sessionId,
      summary: "Older branch still needed a checker.",
      nextChecks: ["Install Maxima and rerun the symbolic route."],
      now: "2026-06-13T00:02:00.000Z"
    });
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: start.session.sessionId,
      summary: "Newer branch completed and chose the next current action.",
      nextChecks: ["Write the final local reviewer handoff."],
      now: "2026-06-13T00:03:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 1,
      now: "2026-06-13T00:04:00.000Z"
    });

    expect(review.summary.sessionTasks).toBe(0);
    expect(review.summary.sessionNextChecks).toBe(1);
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "session-next-check",
        title: "Session next check: Write the final local reviewer handoff."
      })
    );
    expect(review.items).not.toContainEqual(
      expect.objectContaining({
        title: "Session next check: Install Maxima and rerun the symbolic route."
      })
    );
  });

  it("queues only report drafts that need integrity review", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    const verified = await writeReportDraft({
      rootPath: root,
      title: "Verified Reviewer Draft",
      markdown: "# Verified Reviewer Draft\n\nReplayable and hash-checked.\n",
      trust: "exact-computed",
      source: "test",
      now: "2026-06-13T00:01:00.000Z"
    });
    const tampered = await writeReportDraft({
      rootPath: root,
      title: "Edited Reviewer Draft",
      markdown: "# Original Reviewer Draft\n",
      source: "test",
      now: "2026-06-13T00:02:00.000Z"
    });
    await writeFile(tampered.paths.markdown, "# Edited after save\n", "utf8");

    const review = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      maxReports: 10,
      now: "2026-06-13T00:03:00.000Z"
    });
    const skipped = await createWorkspaceReview({
      rootPath: root,
      maxRoutes: 0,
      maxClaims: 0,
      maxSessions: 0,
      maxReports: 0,
      now: "2026-06-13T00:04:00.000Z"
    });

    expect(review.summary.reportDrafts).toBe(2);
    expect(review.summary.reportDraftReviewItems).toBe(1);
    expect(review.summary.reportDraftsNeedingAttention).toBe(1);
    expect(review.autonomy.mode).toBe("human-review-gated");
    expect(review.items).not.toContainEqual(expect.objectContaining({ reportId: verified.report.reportId }));
    expect(review.items).toContainEqual(
      expect.objectContaining({
        kind: "report-draft-review",
        priority: "high",
        reportId: tampered.report.reportId,
        title: "Fix report draft before sharing: Edited Reviewer Draft",
        acceptanceCriteria: expect.arrayContaining([
          "Treat the draft as tampered, stale, or manually edited until its Markdown hash is reconciled."
        ]),
        evidenceSlots: expect.arrayContaining([
          expect.objectContaining({
            slotId: "report-markdown-hash-review",
            status: "open",
            required: true
          })
        ])
      })
    );
    expect(review.markdown).toContain("| Report drafts | `2` |");
    expect(skipped.summary.reportDrafts).toBe(0);
    expect(skipped.summary.totalItems).toBe(0);
  });

  it("writes review handoff packets into findings without breaking validation", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });
    await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-13T00:01:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });

    const result = await writeWorkspaceReview({
      rootPath: root,
      maxRoutes: 1,
      now: "2026-06-13T00:02:00.000Z"
    });
    const reviews = await listWorkspaceReviews(root);
    const shownById = await readWorkspaceReview(root, result.review.reviewId);
    const shownByPath = await readWorkspaceReview(root, result.jsonPath);
    const originalReviewJson = await readFile(result.jsonPath, "utf8");
    const stored = JSON.parse(originalReviewJson) as { schemaVersion: string; reviewId: string };
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(result.review.reviewId).toMatch(/^wrev_[a-f0-9]{16}$/u);
    expect(result.jsonPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(result.markdownPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(stored.schemaVersion).toBe("truth-harness.workspace-review.v0");
    expect(stored.reviewId).toBe(result.review.reviewId);
    expect(reviews).toContainEqual(
      expect.objectContaining({
        reviewId: result.review.reviewId,
        path: expect.stringContaining(`${result.review.reviewId}-workspace-review.json`),
        totalItems: result.review.summary.totalItems
      })
    );
    expect(shownById.reviewId).toBe(result.review.reviewId);
    expect(shownByPath.reviewId).toBe(result.review.reviewId);
    expect(result.markdown).toContain(`| Review | \`${result.review.reviewId}\` |`);
    expect(validation.passed).toBe(true);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.review.reviewId,
        schemaVersion: "truth-harness.workspace-review.v0",
        expectedSchemaVersion: "truth-harness.workspace-review.v0",
        issueCodes: []
      })
    );

    const tamperedReview = JSON.parse(originalReviewJson) as Record<string, unknown>;
    tamperedReview.networkAccess = "optional";
    await writeFile(result.jsonPath, `${JSON.stringify(tamperedReview, null, 2)}\n`, "utf8");
    const tamperedValidation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(tamperedValidation.passed).toBe(false);
    expect(tamperedValidation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: result.review.reviewId,
        schemaVersion: "truth-harness.workspace-review.v0",
        issueCodes: expect.arrayContaining(["invalid-artifact-schema"])
      })
    );
  });

  it("rejects malformed review handoff packets before writing findings", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      now: "2026-06-13T00:00:00.000Z"
    });

    await expect(
      writeWorkspaceReview({
        rootPath: root,
        now: "not-a-date"
      })
    ).rejects.toThrow("Workspace review failed JSON Schema validation before write");

    await expect(listWorkspaceReviews(root)).resolves.toEqual([]);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-review-"));
  roots.push(root);
  return root;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

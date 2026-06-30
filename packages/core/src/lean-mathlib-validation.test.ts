import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeLeanProofCheckRecord, type ProofBackendCommandRunner } from "./proof-backend.js";
import { addResearchSessionCheckpoint } from "./research-session.js";
import { writeLeanMathlibValidationHarness } from "./lean-mathlib-validation.js";
import { listValidationPlans } from "./validation-plan.js";
import { createWorkspaceReview } from "./workspace-review.js";
import { createWorkspaceRunNextPlan } from "./workspace-run-next.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("Lean mathlib validation harness", () => {
  it("links theorem-corpus families to validation proof gates that run-next can prioritize", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-30T00:00:00.000Z" });
    await cp(
      join(process.cwd(), "docs", "examples", "lean-mathlib-template"),
      join(root, "docs", "examples", "lean-mathlib-template"),
      { recursive: true }
    );

    const harness = await writeLeanMathlibValidationHarness({
      rootPath: root,
      projectPath: "docs/examples/lean-mathlib-template",
      now: "2026-06-30T00:01:00.000Z"
    });
    const plans = await listValidationPlans(root);
    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-30T00:02:00.000Z"
    });
    const runNext = await createWorkspaceRunNextPlan({
      rootPath: root,
      review,
      executeLocal: false,
      now: "2026-06-30T00:03:00.000Z"
    });

    expect(harness.familyCount).toBe(5);
    expect(harness.declarationCount).toBe(5);
    expect(harness.validationPlans.map((target) => target.declarationName)).toEqual([
      "finset_card_singleton_template",
      "nat_add_comm_mathlib_template",
      "int_add_comm_mathlib_template",
      "nat_le_add_right_mathlib_template",
      "real_sq_nonneg_mathlib_template"
    ]);
    expect(plans).toHaveLength(5);
    expect(harness.session.evidenceRefs).toEqual(
      expect.arrayContaining(harness.validationPlans.map((target) => expect.objectContaining({
        kind: "validation",
        ref: target.validationPlan.plan.planId
      })))
    );

    const proofItems = review.items.filter((item) => item.kind === "validation-gate" && item.validationGateKind === "proof");
    expect(proofItems).toHaveLength(5);
    const singletonProofItem = proofItems.find((item) => item.command?.includes("--declaration finset_card_singleton_template"));
    expect(singletonProofItem).toMatchObject({
      priority: "critical",
      sessionId: harness.session.sessionId,
      validationPlanId: harness.validationPlans[0]?.validationPlan.plan.planId
    });
    expect(singletonProofItem?.command).toContain("truth-harness proof check");
    expect(singletonProofItem?.command).toContain("--project docs/examples/lean-mathlib-template");
    expect(singletonProofItem?.command).toContain("--declaration finset_card_singleton_template");
    expect(singletonProofItem?.command).toContain("--statement");

    expect(runNext.item).toMatchObject({
      kind: "validation-gate",
      sessionId: harness.session.sessionId,
      validationGateKind: "proof"
    });
    expect(proofItems.map((item) => item.command)).toContain(runNext.item?.command);
    expect(runNext.execution.kind).toBe("dry-run");
  });
  it("does not offer one scoped mathlib proof receipt for sibling declarations", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-30T00:00:00.000Z" });
    await cp(
      join(process.cwd(), "docs", "examples", "lean-mathlib-template"),
      join(root, "docs", "examples", "lean-mathlib-template"),
      { recursive: true }
    );

    const harness = await writeLeanMathlibValidationHarness({
      rootPath: root,
      projectPath: "docs/examples/lean-mathlib-template",
      now: "2026-06-30T00:01:00.000Z"
    });
    const proof = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "docs/examples/lean-mathlib-template/TruthHarnessMathlib/Algebra.lean",
      projectPath: "docs/examples/lean-mathlib-template",
      declarationName: "real_sq_nonneg_mathlib_template",
      scope: {
        statement:
          "Lean mathlib declaration real_sq_nonneg_mathlib_template in project docs/examples/lean-mathlib-template source docs/examples/lean-mathlib-template/TruthHarnessMathlib/Algebra.lean"
      },
      leanCommand: "lean-test",
      runner: passingProofRunner,
      now: new Date("2026-06-30T00:02:00.000Z")
    });
    const proofRef = relative(root, proof.jsonPath).replace(/\\/gu, "/");
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: harness.session.sessionId,
      summary: "Recorded one scoped mathlib proof receipt.",
      evidenceRefs: [
        {
          kind: "proof",
          ref: proofRef,
          trust: "proved",
          summary: "Scoped real analysis proof."
        }
      ],
      now: "2026-06-30T00:03:00.000Z"
    });

    const review = await createWorkspaceReview({
      rootPath: root,
      now: "2026-06-30T00:04:00.000Z"
    });
    const proofItems = review.items.filter((item) => item.kind === "validation-gate" && item.validationGateKind === "proof");
    const realSqPlanId = harness.validationPlans.find(
      (target) => target.declarationName === "real_sq_nonneg_mathlib_template"
    )?.validationPlan.plan.planId;
    if (!realSqPlanId) {
      throw new Error("Expected a validation plan for real_sq_nonneg_mathlib_template.");
    }
    const realSqItem = proofItems.find((item) => item.validationPlanId === realSqPlanId);
    if (!realSqItem) {
      throw new Error("Expected the scoped real_sq proof gate to remain open for candidate attachment.");
    }
    const siblingItems = proofItems.filter((item) => item.validationPlanId !== realSqPlanId);

    expect(realSqItem.candidateEvidenceRefs).toContainEqual(
      expect.objectContaining({
        kind: "proof",
        ref: proofRef
      })
    );
    expect(realSqItem.command).toContain(`proof:${proofRef}`);
    expect(siblingItems).toHaveLength(4);
    for (const item of siblingItems) {
      expect(item.candidateEvidenceRefs).not.toContainEqual(
        expect.objectContaining({
          kind: "proof",
          ref: proofRef
        })
      );
      expect(item.command).not.toContain(`proof:${proofRef}`);
      expect(item.command).toContain("truth-harness proof check");
      expect(item.command).toContain("--declaration");
    }
  });
});

const passingProofRunner: ProofBackendCommandRunner = (_command, args) => {
  if (args[0] === "--version") {
    return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
  }
  return { status: 0, stdout: "", stderr: "" };
};

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-mathlib-validation-"));
  tempRoots.push(root);
  return root;
}
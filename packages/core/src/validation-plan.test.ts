import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSimulationLogEntry } from "./simulation-log.js";
import { writeExpertReview } from "./expert-review.js";
import { createValidationPlan, listValidationPlans, renderValidationPlanMarkdown, writeValidationPlan } from "./validation-plan.js";
import { initLocalWorkspace } from "./local-workspace.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("validation plans", () => {
  it("keeps cancer simulation claims behind wet-lab, clinical, safety, and regulatory gates", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const simulation = await createSimulationLogEntry({
      rootPath: root,
      question: "Could a toy pathway simulation lower a cancer marker?",
      kind: "molecular",
      engine: "local python",
      modelName: "toy pathway ODE",
      metrics: [{ name: "marker_delta", value: "-0.12", note: "toy-model-only" }],
      assumptions: ["Toy model, not calibrated biology."],
      uncertainty: ["No calibrated uncertainty model."],
      limitations: ["No wet-lab, preclinical, clinical, safety, or regulatory evidence."],
      nextChecks: ["Run sensitivity analysis and expert review."]
    });

    const plan = await createValidationPlan({
      rootPath: root,
      claim: "This simulated candidate cures cancer safely.",
      evidenceRefs: [{ kind: "simulation", ref: simulation.entry.simulationId }]
    });

    expect(plan.schemaVersion).toBe("truth-harness.validation-plan.v0");
    expect(plan.domains).toContain("biomedical");
    expect(plan.audit.verdict.status).toBe("overclaimed");
    expect(plan.readiness.status).toBe("not-ready");
    expect(plan.recommendedClaimLanguage).toContain("unvalidated biomedical hypothesis");
    expect(plan.gates.find((gate) => gate.kind === "wet-lab")?.status).toBe("missing");
    expect(plan.gates.find((gate) => gate.kind === "clinical")?.blocking).toBe(true);
    expect(plan.warnings.join(" ")).toContain("cure");
    expect(renderValidationPlanMarkdown(plan)).toContain("| Readiness | `not-ready` |");
  });

  it("marks scoped expert review as satisfying the expert-review gate without turning it into proof", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const review = await writeExpertReview({
      rootPath: root,
      subject: "Cancer pathway evidence packet",
      question: "Does the packet support only a computational hypothesis?",
      kind: "biomedical",
      status: "completed",
      reviewerRole: "oncology domain expert",
      findings: ["The packet is useful only for hypothesis generation."],
      limitations: ["No wet-lab or clinical validation was reviewed."],
      requiredNextChecks: ["Attach wet-lab protocol and independent replication plan."],
      outcomeStatus: "supported-with-limitations"
    });

    const written = await writeValidationPlan({
      rootPath: root,
      claim: "The cancer pathway packet is a hypothesis-generation artifact, not a cure claim.",
      evidenceRefs: [{ kind: "review", ref: review.review.reviewId }]
    });
    const listed = await listValidationPlans(root);

    expect(written.plan.gates.find((gate) => gate.kind === "expert-review")?.status).toBe("satisfied");
    expect(written.plan.boundary.notMedicalAdvice).toBe(true);
    expect(written.plan.boundary.aiOutputIsNotTruth).toBe(true);
    expect(written.markdown).toContain("not proof, medical advice, regulatory approval, legal advice");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.planId).toBe(written.plan.planId);
  });

  it("requires prior art, claim charts, reduction-to-practice, and patent legal review for invention claims", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const legalReview = await writeExpertReview({
      rootPath: root,
      subject: "Provisional patent draft posture",
      kind: "patent-legal",
      status: "requested",
      reviewerRole: "patent attorney",
      requiredNextChecks: ["Attach claim chart and prior-art search notes."]
    });

    const plan = await createValidationPlan({
      rootPath: root,
      claim: "This invention is novel and ready for a provisional patent filing.",
      evidenceRefs: [{ kind: "review", ref: legalReview.review.reviewId }]
    });

    expect(plan.domains).toContain("patent");
    expect(plan.gates.find((gate) => gate.kind === "prior-art")?.status).toBe("missing");
    expect(plan.gates.find((gate) => gate.kind === "claim-chart")?.status).toBe("missing");
    expect(plan.gates.find((gate) => gate.kind === "reduction-to-practice")?.status).toBe("missing");
    expect(plan.gates.find((gate) => gate.kind === "patent-legal")?.status).toBe("in-progress");
    expect(plan.warnings.join(" ")).toContain("patent-attorney review");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-validation-plan-"));
  tempRoots.push(root);
  return root;
}

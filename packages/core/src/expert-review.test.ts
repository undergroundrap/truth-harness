import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { createExpertReview, listExpertReviews, writeExpertReview } from "./expert-review.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("expert reviews", () => {
  it("creates cautious biomedical review records without claiming validation", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });

    const review = await createExpertReview({
      rootPath: root,
      subject: "Cancer pathway toy simulation",
      question: "Does the attached simulation justify a cure claim?",
      kind: "biomedical",
      status: "requested",
      reviewerRole: "oncology domain expert",
      evidenceRefs: [{ kind: "simulation", ref: "sim_0123456789abcdef" }],
      requiredNextChecks: ["Attach source evidence and wet-lab validation plan."],
      now: "2026-06-08T00:10:00.000Z"
    });

    expect(review.schemaVersion).toBe("truth-harness.expert-review.v0");
    expect(review.reviewId).toMatch(/^review_[a-f0-9]{16}$/);
    expect(review.privacy.mode).toBe("local-only");
    expect(review.boundary.notMedicalAdvice).toBe(true);
    expect(review.outcome.status).toBe("not-reviewed");
    expect(review.warnings.join("\n")).toContain("Review is not completed");
    expect(review.warnings.join("\n")).toContain("do not establish safety");
    expect(review.markdown).toContain("# Expert Review");
  });

  it("writes and lists completed patent/legal review records with limitations", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });

    const write = await writeExpertReview({
      rootPath: root,
      title: "Claim chart attorney review",
      subject: "Candidate claim chart for toy mechanism",
      kind: "patent-legal",
      status: "completed",
      reviewerRole: "patent attorney",
      reviewerNameOrOrg: "Example Legal Reviewer",
      reviewerCredentials: "registered patent attorney",
      conflictDisclosure: "No conflict recorded for this local test.",
      evidenceRefs: [{ kind: "claim-chart", ref: "chart_0123456789abcdef" }],
      findings: ["Claim language needs prior-art narrowing."],
      limitations: ["No freedom-to-operate opinion was requested."],
      recommendations: ["Search closest patent families before drafting a provisional."],
      requiredNextChecks: ["Attach prior-art search notes."],
      outcomeStatus: "legal-review-only",
      outcomeSummary: "Legal review organized next steps but did not determine patentability.",
      now: "2026-06-08T00:20:00.000Z"
    });
    const list = await listExpertReviews(root);

    expect(write.jsonPath).toContain(".truth-harness");
    expect(write.markdownPath).toContain(".truth-harness");
    expect(JSON.parse(await readFile(write.jsonPath, "utf8")).reviewId).toBe(write.review.reviewId);
    expect(write.markdown).toContain("Claim language needs prior-art narrowing.");
    expect(write.review.warnings.join("\n")).toContain("not a patentability guarantee");
    expect(list).toHaveLength(1);
    expect(list[0]?.reviewId).toBe(write.review.reviewId);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-expert-review-"));
  roots.push(root);
  return root;
}

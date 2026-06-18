import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createReceipt } from "./receipt.js";
import { createSimulationLogEntry } from "./simulation-log.js";
import { writeExpertReview } from "./expert-review.js";
import {
  createEvidenceAudit,
  listEvidenceAudits,
  renderEvidenceAuditMarkdown,
  writeEvidenceAudit,
  writeEvidenceAuditReport
} from "./evidence-audit.js";
import { initLocalWorkspace, LOCAL_WORKSPACE_DIR, LOCAL_WORKSPACE_MANIFEST } from "./local-workspace.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("evidence audits", () => {
  it("requires a local workspace before auditing claims", async () => {
    const root = await tempRoot();

    await expect(
      createEvidenceAudit({
        rootPath: root,
        claim: "This claim has no workspace."
      })
    ).rejects.toThrow("Run `truth-harness workspace init`");
  });

  it("recognizes narrow verified math receipts without broadening the claim", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Audit Lab", now: "2026-06-08T00:00:00.000Z" });
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    const receipt = createReceipt("for all integers n, n^2+n is even");
    const receiptPath = join(".truth-harness", "receipts", "parity-check.json");
    await writeFile(join(root, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    const audit = await createEvidenceAudit({
      rootPath: root,
      claim: "For all integers n, n^2+n is even.",
      evidenceRefs: [{ kind: "receipt", ref: receiptPath }]
    });

    expect(audit.schemaVersion).toBe("truth-harness.evidence-audit.v0");
    expect(audit.auditId).toMatch(/^audit_[a-f0-9]{16}$/);
    expect(audit.claimTypes).toContain("math");
    expect(audit.verdict.status).toBe("verified-narrow");
    expect(audit.reviews[0]?.status).toBe("resolved");
    expect(audit.reviews[0]?.trust).toBe("exact-computed");
    expect(audit.overclaimWarnings[0]).toContain("do not prove broad truth");
    expect(renderEvidenceAuditMarkdown(audit)).toContain("| Verdict | `verified-narrow` |");
  });

  it("flags biomedical cure language as overclaimed with simulation-only evidence and writes a report", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Biomedical Audit Lab", now: "2026-06-08T00:00:00.000Z" });
    const simulation = await createSimulationLogEntry({
      rootPath: root,
      title: "Toy pathway simulation",
      question: "Could a toy candidate lower a cancer pathway score?",
      kind: "molecular",
      engine: "local python",
      modelName: "toy pathway model",
      metrics: [{ name: "pathway_score_delta", value: "-0.2", note: "toy-model-only" }],
      assumptions: ["Toy mechanism only."],
      uncertainty: ["No calibrated uncertainty model."],
      limitations: ["No wet-lab, preclinical, clinical, safety, or regulatory evidence."],
      nextChecks: ["Independent simulation and expert review."],
      now: "2026-06-08T00:01:00.000Z"
    });

    const written = await writeEvidenceAudit({
      rootPath: root,
      claim: "This simulated candidate cures cancer safely.",
      evidenceRefs: [
        {
          kind: "simulation",
          ref: simulation.entry.simulationId
        }
      ],
      now: "2026-06-08T00:02:00.000Z"
    });
    const report = await writeEvidenceAuditReport({
      rootPath: root,
      claim: "This simulated candidate cures cancer safely.",
      evidenceRefs: [
        {
          kind: "simulation",
          ref: simulation.entry.simulationId
        }
      ],
      now: "2026-06-08T00:03:00.000Z"
    });
    const list = await listEvidenceAudits(root);

    expect(written.path).toContain(join(".truth-harness", "audits"));
    expect(written.audit.claimTypes).toContain("biomedical");
    expect(written.audit.claimTypes).toContain("simulation");
    expect(written.audit.verdict.status).toBe("overclaimed");
    expect(written.audit.reviews[0]?.strength).toBe("computational");
    expect(written.audit.overclaimWarnings.join(" ")).toContain("Biomedical claims require expert review");
    expect(written.audit.requiredNextChecks.join(" ")).toContain("Rewrite the claim");
    expect(report.jsonPath).toContain(join(".truth-harness", "audits"));
    expect(report.markdownPath).toContain(join(".truth-harness", "audits"));
    expect(report.markdown).toContain("# Evidence Audit:");
    expect(report.markdown).toContain("| Verdict | `overclaimed` |");
    expect(report.markdown).toContain("This audit classifies local evidence posture.");
    expect(list).toHaveLength(2);
    expect(list.some((audit) => audit.auditId === written.audit.auditId)).toBe(true);
  });

  it("rejects malformed evidence audits before writing artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Audit Lab", now: "2026-06-08T00:00:00.000Z" });
    const manifestPath = join(root, LOCAL_WORKSPACE_DIR, LOCAL_WORKSPACE_MANIFEST);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.projectId = "";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(
      writeEvidenceAuditReport({
        rootPath: root,
        claim: "This malformed workspace should not mint an evidence audit.",
        now: "2026-06-08T00:02:00.000Z"
      })
    ).rejects.toThrow("Evidence audit failed JSON Schema validation before write");

    const audits = await readdir(join(root, LOCAL_WORKSPACE_DIR, "audits"));
    expect(audits).toEqual([]);
  });

  it("reports missing evidence refs without silently trusting them", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    const audit = await createEvidenceAudit({
      rootPath: root,
      claim: "A missing receipt proves this claim.",
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/missing.json" }]
    });

    expect(audit.verdict.status).toBe("overclaimed");
    expect(audit.evidenceSummary.missing).toBe(1);
    expect(audit.reviews[0]?.status).toBe("missing");
    expect(audit.requiredNextChecks).toContain("Fix or remove missing evidence refs before relying on this claim.");
  });

  it("rejects invalid receipt refs before they can support an audit", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    const legacyReceipt = { ...createReceipt("for all integers n, n^2+n is even") } as Record<string, unknown>;
    delete legacyReceipt.evidenceProfile;
    const receiptPath = join(".truth-harness", "receipts", "legacy-receipt.json");
    await writeFile(join(root, receiptPath), `${JSON.stringify(legacyReceipt, null, 2)}\n`, "utf8");

    const audit = await createEvidenceAudit({
      rootPath: root,
      claim: "For all integers n, n^2+n is even.",
      evidenceRefs: [{ kind: "receipt", ref: receiptPath }]
    });
    const review = audit.reviews[0];

    expect(audit.verdict.status).toBe("unsupported");
    expect(audit.evidenceSummary.missing).toBe(1);
    expect(review?.status).toBe("missing");
    expect(review?.strength).toBe("none");
    expect(review?.summary).toContain("failed receipt schema validation");
    expect(review?.warnings.join(" ")).toContain("Invalid receipt evidence");
    expect(review?.warnings.join(" ")).toContain("$.evidenceProfile");
    expect(audit.requiredNextChecks).toContain("Fix or remove missing evidence refs before relying on this claim.");
  });

  it("resolves expert review records as scoped human review evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Review Audit Lab", now: "2026-06-08T00:00:00.000Z" });
    const review = await writeExpertReview({
      rootPath: root,
      subject: "Cancer pathway evidence packet",
      question: "Does the packet justify a cure claim?",
      kind: "biomedical",
      status: "completed",
      reviewerRole: "oncology domain expert",
      findings: ["The current packet is not enough for efficacy or safety claims."],
      limitations: ["No wet-lab or clinical validation was reviewed."],
      requiredNextChecks: ["Attach wet-lab protocol and independent replication plan."],
      outcomeStatus: "needs-more-evidence",
      outcomeSummary: "The packet needs more evidence before any stronger biomedical claim.",
      now: "2026-06-08T00:01:00.000Z"
    });

    const audit = await createEvidenceAudit({
      rootPath: root,
      claim: "This cancer pathway packet needs more evidence before cure claims.",
      evidenceRefs: [{ kind: "review", ref: review.review.reviewId }],
      now: "2026-06-08T00:02:00.000Z"
    });

    expect(audit.reviews[0]?.kind).toBe("review");
    expect(audit.reviews[0]?.status).toBe("resolved");
    expect(audit.reviews[0]?.summary).toContain("needs more evidence");
    expect(audit.reviews[0]?.warnings.join(" ")).toContain("scoped human-review artifacts");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-audit-"));
  roots.push(root);
  return root;
}

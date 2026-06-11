import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { createLiteratureRecord, listLiteratureRecords, writeLiteratureRecord } from "./literature-record.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("literature records", () => {
  it("requires a local workspace before writing literature evidence", async () => {
    const root = await tempRoot();

    await expect(
      createLiteratureRecord({
        rootPath: root,
        title: "Example paper"
      })
    ).rejects.toThrow("No Theorem workspace found");
  });

  it("writes local literature records with review boundaries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Literature Lab",
      now: "2026-06-08T00:00:00.000Z"
    });

    const result = await writeLiteratureRecord({
      rootPath: root,
      title: "Toy cancer pathway paper",
      kind: "paper",
      status: "annotated",
      authors: ["A. Researcher", "B. Reviewer"],
      venue: "Local Notes Journal",
      year: 2026,
      identifiers: [{ kind: "doi", value: "10.0000/example" }],
      localRefs: ["papers/pathway.md"],
      corpusRefs: ["source:chunk_1234"],
      evidenceRefs: ["source:.theorem-workbench/indexes/local-corpus.json"],
      summary: "A local note about a toy pathway model.",
      keyClaims: ["The paper reports pathway marker changes under toy conditions."],
      methodNotes: ["Toy model only; no wet-lab replication."],
      limitations: ["No clinical endpoint and no safety conclusion."],
      relevance: ["Cancer pathway hypothesis triage."],
      nextChecks: ["Ask oncology expert to review biological plausibility."],
      now: "2026-06-08T01:00:00.000Z"
    });
    const records = await listLiteratureRecords(root);

    expect(result.jsonPath).toContain(join(".theorem-workbench", "literature"));
    expect(result.markdownPath).toContain(join(".theorem-workbench", "literature"));
    expect(result.record.schemaVersion).toBe("theorem.literature.v0");
    expect(result.record.recordId).toMatch(/^lit_[a-f0-9]{16}$/);
    expect(result.record.privacy.mode).toBe("local-only");
    expect(result.record.reviewBoundary.sourceRetrievalIsNotEntailment).toBe(true);
    expect(result.record.reviewBoundary.requiresDomainExpertReview).toBe(true);
    expect(result.record.reviewBoundary.requiredNextChecks).toContain("Ask oncology expert to review biological plausibility.");
    expect(result.record.warnings.join(" ")).toContain("Citation or retrieval is not entailment");
    expect(result.markdown).toContain("## Boundary");
    expect(records).toHaveLength(1);
    expect(records[0]?.recordId).toBe(result.record.recordId);
  });

  it("warns when metadata-only records lack local evidence and limitations", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);

    const record = await createLiteratureRecord({
      rootPath: root,
      title: "Patent-style prior art note",
      kind: "patent",
      status: "unreviewed",
      keyClaims: ["A broad claim appears related to the candidate invention."]
    });

    expect(record.reviewBoundary.requiresPatentLegalReview).toBe(true);
    expect(record.warnings).toContain("No DOI, PMID, arXiv, patent, URL, local-path, or other identifier was recorded.");
    expect(record.warnings).toContain("No local source or corpus refs were attached; reviewers need the actual local evidence, not just metadata.");
    expect(record.warnings).toContain("No source limitations were recorded.");
    expect(record.warnings.join(" ")).toContain("Patent and prior-art records require human patent/legal review");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-literature-"));
  roots.push(root);
  return root;
}

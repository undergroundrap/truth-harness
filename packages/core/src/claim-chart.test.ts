import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createClaimChart, listClaimCharts, writeClaimChart } from "./claim-chart.js";
import { createInventionLogEntry } from "./invention-log.js";
import { initLocalWorkspace } from "./local-workspace.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("claim charts", () => {
  it("requires a local workspace before creating patent artifacts", async () => {
    const root = await tempRoot();

    await expect(
      createClaimChart({
        rootPath: root,
        elements: [{ text: "A local evidence-backed claim element." }]
      })
    ).rejects.toThrow("No Theorem workspace found");
  });

  it("writes local claim-chart JSON and Markdown for human legal review", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Claim Chart Lab",
      now: "2026-06-08T00:00:00.000Z"
    });
    const invention = await createInventionLogEntry({
      rootPath: root,
      title: "Evidence-backed candidate mechanism",
      problem: "Capture patent-review structure without legal conclusions.",
      hypothesis: "A local simulation and source review may suggest a narrow candidate mechanism.",
      evidenceRefs: [
        {
          kind: "source",
          ref: "docs/source-notes.md#chunk_1",
          trust: "source-cited",
          summary: "Local literature note."
        }
      ],
      priorArtNotes: ["Closest known mechanism appears in docs/source-notes.md."],
      now: "2026-06-08T01:00:00.000Z"
    });

    const result = await writeClaimChart({
      rootPath: root,
      entryId: invention.entry.entryId,
      title: "Candidate mechanism claim chart",
      elements: [
        {
          text: "A candidate mechanism with a locally cited pathway rationale.",
          priorArtRefs: ["source:docs/source-notes.md#chunk_1"],
          notes: ["Drafting aid only."]
        }
      ],
      reductionToPracticeRefs: ["simulation:.theorem-workbench/simulations/pathway.json"],
      now: "2026-06-08T02:00:00.000Z"
    });
    const charts = await listClaimCharts(root);

    expect(result.chart.schemaVersion).toBe("theorem.claim-chart.v0");
    expect(result.chart.chartId).toMatch(/^chart_[a-f0-9]{16}$/);
    expect(result.chart.legal.legalConclusion).toBe("not-a-legal-opinion");
    expect(result.chart.legal.patentabilityConclusion).toBe("not-determined");
    expect(result.chart.legal.provisionalDraftReady).toBe(false);
    expect(result.chart.elements[0]?.status).toBe("evidence-referenced");
    expect(result.jsonPath).toContain(join(".theorem-workbench", "patents"));
    expect(result.markdownPath).toContain(join(".theorem-workbench", "patents"));
    expect(await readFile(result.markdownPath, "utf8")).toContain("## Claim Elements");
    expect(charts).toHaveLength(1);
    expect(charts[0]?.chartId).toBe(result.chart.chartId);
  });

  it("marks unsupported claim elements and missing reduction evidence", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    await createInventionLogEntry({
      rootPath: root,
      title: "Unsupported concept",
      hypothesis: "A concept without evidence should not look draft-ready.",
      now: "2026-06-08T01:00:00.000Z"
    });

    const chart = await createClaimChart({
      rootPath: root,
      elements: [{ text: "A broad unsupported claim element." }],
      evidenceRefs: [],
      now: "2026-06-08T02:00:00.000Z"
    });

    expect(chart.elements[0]?.status).toBe("unsupported");
    expect(chart.elements[0]?.warnings[0]).toContain("no support refs");
    expect(chart.validation.reductionToPracticeClaimed).toBe(false);
    expect(chart.legal.warnings.join("\n")).toContain("No reduction-to-practice refs were recorded");
    expect(chart.markdown).toContain("not-a-legal-opinion");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-claim-chart-"));
  roots.push(root);
  return root;
}

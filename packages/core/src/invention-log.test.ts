import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createInventionLogEntry, listInventionLogEntries } from "./invention-log.js";
import { initLocalWorkspace, LOCAL_WORKSPACE_DIR } from "./local-workspace.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("invention log", () => {
  it("requires an initialized local workspace", async () => {
    const root = await tempRoot();

    await expect(
      createInventionLogEntry({
        rootPath: root,
        hypothesis: "A local-only discovery note should not auto-create a project."
      })
    ).rejects.toThrow("No Theorem workspace found");
  });

  it("writes local-only invention logs with evidence refs and validation warnings", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Discovery Lab",
      now: "2026-06-08T00:00:00.000Z"
    });

    const result = await createInventionLogEntry({
      rootPath: root,
      title: "Hair follicle pathway hypothesis",
      problem: "Investigate a plausible hair regrowth target without claiming medical efficacy.",
      hypothesis: "A simulated ligand candidate may modulate a follicle signaling pathway.",
      validationStage: "computational-hypothesis",
      evidenceRefs: [
        {
          kind: "receipt",
          ref: ".theorem-workbench/receipts/pathway-check.json",
          trust: "source-cited",
          summary: "Literature claim receipt."
        }
      ],
      noveltyNotes: ["No novelty conclusion yet; needs prior-art search."],
      priorArtNotes: ["Search patents and PubMed before claim drafting."],
      risks: ["Docking scores can be misleading."],
      nextChecks: ["Run independent simulation adapter and source-backed review."],
      now: "2026-06-08T01:02:03.000Z"
    });

    expect(result.path.replace(/\\/g, "/")).toContain(`${LOCAL_WORKSPACE_DIR}/inventions`);
    expect(result.entry.schemaVersion).toBe("theorem.invention.v0");
    expect(result.entry.privacy.mode).toBe("local-only");
    expect(result.entry.patent.humanReviewRequired).toBe(true);
    expect(result.entry.patent.legalConclusion).toBe("not-a-legal-opinion");
    expect(result.entry.safety.overclaimWarnings).toContain("Do not describe this as a proven discovery yet.");
    expect(JSON.parse(await readFile(result.path, "utf8")).entryId).toBe(result.entry.entryId);
  });

  it("lists invention logs newest first", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });

    await createInventionLogEntry({
      rootPath: root,
      hypothesis: "First hypothesis.",
      now: "2026-06-08T01:00:00.000Z"
    });
    await createInventionLogEntry({
      rootPath: root,
      hypothesis: "Second hypothesis.",
      now: "2026-06-08T02:00:00.000Z"
    });

    const entries = await listInventionLogEntries(root);

    expect(entries.map((entry) => entry.hypothesis)).toEqual(["Second hypothesis.", "First hypothesis."]);
  });

  it("rejects empty hypotheses", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });

    await expect(createInventionLogEntry({ rootPath: root, hypothesis: "   " })).rejects.toThrow(
      "hypothesis is required"
    );
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "theorem-workbench-invention-"));
  roots.push(root);
  return root;
}

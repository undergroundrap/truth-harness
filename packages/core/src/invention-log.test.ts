import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createInventionLogEntry, listInventionLogEntries } from "./invention-log.js";
import { initLocalWorkspace, LOCAL_WORKSPACE_DIR, LOCAL_WORKSPACE_MANIFEST } from "./local-workspace.js";

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
    ).rejects.toThrow("No Truth Harness workspace found");
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
          ref: ".truth-harness/receipts/pathway-check.json",
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
    expect(result.entry.schemaVersion).toBe("truth-harness.invention.v0");
    expect(result.entry.privacy.mode).toBe("local-only");
    expect(result.entry.patent.humanReviewRequired).toBe(true);
    expect(result.entry.patent.legalConclusion).toBe("not-a-legal-opinion");
    expect(result.entry.safety.overclaimWarnings).toContain("Do not describe this as a proven discovery yet.");
    expect(JSON.parse(await readFile(result.path, "utf8")).entryId).toBe(result.entry.entryId);
  });

  it("rejects malformed invention logs before writing artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Discovery Lab",
      now: "2026-06-08T00:00:00.000Z"
    });
    const manifestPath = join(root, LOCAL_WORKSPACE_DIR, LOCAL_WORKSPACE_MANIFEST);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.projectId = "";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(
      createInventionLogEntry({
        rootPath: root,
        hypothesis: "This malformed workspace should not mint invention provenance.",
        noveltyNotes: ["Validation should fail before persistence."],
        priorArtNotes: ["No durable record should be created."],
        risks: ["Malformed project identity."],
        nextChecks: ["Restore a valid workspace identity."],
        now: "2026-06-08T01:30:00.000Z"
      })
    ).rejects.toThrow("Invention log entry failed JSON Schema validation before write");

    const inventions = await readdir(join(root, LOCAL_WORKSPACE_DIR, "inventions"));
    expect(inventions).toEqual([]);
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
  const root = await mkdtemp(join(tmpdir(), "truth-harness-invention-"));
  roots.push(root);
  return root;
}

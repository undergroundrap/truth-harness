import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ingestLocalCorpus } from "./local-corpus.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { createSourceCitationReceipt } from "./source-receipt.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("createSourceCitationReceipt", () => {
  it("creates source-cited receipts from local corpus hits", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await writeFile(
      join(root, "notes.md"),
      "# Verification Notes\n\nReplayable receipts help agents avoid unsupported math claims.",
      "utf8"
    );
    await ingestLocalCorpus({ rootPath: root, paths: ["notes.md"], now: "2026-06-08T01:00:00.000Z" });

    const receipt = await createSourceCitationReceipt({
      rootPath: root,
      claim: "Replayable receipts help agents avoid unsupported math claims.",
      query: "replayable receipts unsupported claims",
      now: "2026-06-08T02:00:00.000Z"
    });

    expect(receipt.trust).toBe("source-cited");
    expect(receipt.summary).toContain("Source-cited");
    expect(receipt.evidenceProfile.kind).toBe("source-citation");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-corpus-lexical-search");
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("Retrieval is not proof");
    expect(receipt.replay).toContain("truth-harness source cite");
    expect(receipt.artifacts.some((artifact) => artifact.kind === "local-corpus-search-result")).toBe(true);
    expect(receipt.graph.nodes.some((node) => node.kind === "source" && node.trust === "source-cited")).toBe(true);
    expect(receipt.findings[0]?.message).toContain("does not prove entailment");
  });

  it("keeps claims unverified when local corpus search has no hits", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await writeFile(join(root, "notes.md"), "# Notes\n\nTopology notes only.", "utf8");
    await ingestLocalCorpus({ rootPath: root, paths: ["notes.md"], now: "2026-06-08T01:00:00.000Z" });

    const receipt = await createSourceCitationReceipt({
      rootPath: root,
      claim: "This document discusses cancer biomarkers.",
      query: "cancer biomarkers",
      now: "2026-06-08T02:00:00.000Z"
    });

    expect(receipt.trust).toBe("unverified");
    expect(receipt.summary).toContain("no local corpus chunks");
    expect(receipt.graph.nodes.some((node) => node.kind === "source")).toBe(false);
    expect(receipt.findings[0]?.level).toBe("warning");
  });

  it("rejects empty claims", async () => {
    const root = await tempRoot();

    await expect(createSourceCitationReceipt({ rootPath: root, claim: " " })).rejects.toThrow(
      "claim is required"
    );
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-source-receipt-"));
  roots.push(root);
  return root;
}

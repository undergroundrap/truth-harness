import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ingestLocalCorpus, LOCAL_CORPUS_INDEX, searchLocalCorpus } from "./local-corpus.js";
import { initLocalWorkspace, LOCAL_WORKSPACE_DIR } from "./local-workspace.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("local corpus", () => {
  it("requires an initialized local workspace", async () => {
    const root = await tempRoot();
    await writeFile(join(root, "notes.md"), "# Notes\n\nA proof receipt is replayable.", "utf8");

    await expect(ingestLocalCorpus({ rootPath: root, paths: ["notes.md"] })).rejects.toThrow(
      "No Truth Harness workspace found"
    );
  });

  it("ingests markdown into a private local index and returns source-cited hits", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await writeFile(
      join(root, "hair.md"),
      "# Hair Follicle Notes\n\nWNT signaling is discussed as a follicle pathway hypothesis.\n\nDocking scores alone do not prove medical efficacy.",
      "utf8"
    );

    const ingest = await ingestLocalCorpus({
      rootPath: root,
      paths: ["hair.md"],
      now: "2026-06-08T01:00:00.000Z"
    });
    const search = await searchLocalCorpus({ rootPath: root, query: "follicle pathway", limit: 1 });

    expect(ingest.indexPath.replace(/\\/g, "/")).toContain(`${LOCAL_WORKSPACE_DIR}/indexes/${LOCAL_CORPUS_INDEX}`);
    expect(ingest.ingestedDocuments[0]?.title).toBe("Hair Follicle Notes");
    expect(search.hits).toHaveLength(1);
    expect(search.hits[0]?.trust).toBe("source-cited");
    expect(search.hits[0]?.path).toBe("hair.md");
    expect(search.hits[0]?.matchedTerms).toContain("follicle");
  });

  it("recursively ingests supported local text files and ignores unsupported files", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await mkdir(join(root, "papers"));
    await writeFile(join(root, "papers", "energy.txt"), "Energy storage benchmark notes.", "utf8");
    await writeFile(join(root, "papers", "image.png"), "not really an image", "utf8");

    const ingest = await ingestLocalCorpus({ rootPath: root, paths: ["papers"], now: "2026-06-08T01:00:00.000Z" });

    expect(ingest.totalDocuments).toBe(1);
    expect(ingest.ingestedDocuments[0]?.path).toBe("papers/energy.txt");
  });

  it("does not ingest the private workspace directory when indexing the project root", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await writeFile(join(root, "public.md"), "# Public Notes\n\nVisible source material.", "utf8");
    await writeFile(
      join(root, LOCAL_WORKSPACE_DIR, "findings", "private.md"),
      "# Private Finding\n\nThis should not become a source chunk.",
      "utf8"
    );

    const ingest = await ingestLocalCorpus({ rootPath: root, paths: ["."], now: "2026-06-08T01:00:00.000Z" });

    expect(ingest.ingestedDocuments.map((document) => document.path)).toEqual(["public.md"]);
  });

  it("replaces a re-ingested document instead of duplicating it", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });
    await writeFile(join(root, "notes.md"), "# Notes\n\nFirst claim about algebra.", "utf8");
    await ingestLocalCorpus({ rootPath: root, paths: ["notes.md"], now: "2026-06-08T01:00:00.000Z" });
    await writeFile(join(root, "notes.md"), "# Notes\n\nSecond claim about topology.", "utf8");

    const ingest = await ingestLocalCorpus({
      rootPath: root,
      paths: ["notes.md"],
      now: "2026-06-08T02:00:00.000Z"
    });
    const search = await searchLocalCorpus({ rootPath: root, query: "algebra topology", limit: 5 });

    expect(ingest.totalDocuments).toBe(1);
    expect(search.hits).toHaveLength(1);
    expect(search.hits[0]?.text).toContain("topology");
    expect(search.hits[0]?.text).not.toContain("algebra");
  });

  it("rejects corpus paths outside the workspace root", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });

    await expect(ingestLocalCorpus({ rootPath: root, paths: [".."] })).rejects.toThrow(
      "Corpus path escapes workspace root"
    );
  });

  it("rejects empty search queries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-08T00:00:00.000Z" });

    await expect(searchLocalCorpus({ rootPath: root, query: " " })).rejects.toThrow(
      "query must contain at least one searchable term"
    );
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-corpus-"));
  roots.push(root);
  return root;
}

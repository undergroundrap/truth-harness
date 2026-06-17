import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import { listReportDrafts, readReportDraft, writeReportDraft } from "./report-draft.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("saved report drafts", () => {
  it("writes, lists, and reads Markdown report drafts with hash verification", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const markdown = "# Reviewer Draft\n\nEvery result is replayable.\n";

    const written = await writeReportDraft({
      rootPath: root,
      title: "Reviewer Draft",
      summary: "Local report draft generated from a receipt.",
      receiptRunId: "run_report_fixture",
      claimId: "claim_report_fixture",
      trust: "exact-computed",
      bundleVerificationIds: ["cver_aaaaaaaaaaaaaaaa", "not-a-cver"],
      markdown,
      source: "test",
      actor: "agent",
      now: "2026-06-16T00:01:00.000Z"
    });

    expect(written.report.schemaVersion).toBe("truth-harness.report-draft.v0");
    expect(written.report.reportId).toMatch(/^report_[a-f0-9]{16}$/u);
    expect(written.report.bundleVerificationIds).toEqual(["cver_aaaaaaaaaaaaaaaa"]);
    expect(written.paths.relativeJson).toContain(".truth-harness/findings/");
    expect(written.paths.relativeMarkdown).toContain(".truth-harness/findings/");
    expect(await readFile(written.paths.markdown, "utf8")).toBe(markdown);

    const listed = await listReportDrafts({ rootPath: root });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      report: {
        reportId: written.report.reportId,
        title: "Reviewer Draft"
      },
      markdownVerified: true,
      markdownStatus: "verified"
    });

    const read = await readReportDraft({ rootPath: root, reportId: written.report.reportId });
    expect(read.markdown).toBe(markdown);
    expect(read.markdownVerified).toBe(true);
    expect(read.report.warnings).toEqual(written.report.warnings);
  });

  it("keeps tampered Markdown readable but marks the draft unverified", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-16T00:00:00.000Z" });
    const written = await writeReportDraft({
      rootPath: root,
      title: "Tamper check",
      markdown: "# Original\n",
      now: "2026-06-16T00:01:00.000Z"
    });

    await writeFile(written.paths.markdown, "# Changed after save\n", "utf8");
    const listed = await listReportDrafts({ rootPath: root });
    const read = await readReportDraft({ rootPath: root, reportId: written.report.reportId });

    expect(listed[0]).toMatchObject({
      markdownVerified: false,
      markdownStatus: "sha-mismatch"
    });
    expect(read.markdownVerified).toBe(false);
    expect(read.report.warnings.join("\n")).toContain("Saved Markdown hash does not match");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-report-draft-"));
  roots.push(root);
  return root;
}

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  createWebUiReviewRecord,
  listWebUiReviews,
  parseWebUiLayoutAuditSummaryJson,
  parseWebUiReviewJson,
  writeWebUiReview
} from "./web-ui-review.js";

describe("web UI review records", () => {
  it("derives status from browser-review checks", () => {
    const passed = createWebUiReviewRecord({
      now: new Date("2026-06-19T00:00:00.000Z"),
      checklist: [
        {
          title: "No visible clipping in the main canvas",
          status: "pass"
        }
      ]
    });
    const warned = createWebUiReviewRecord({
      now: new Date("2026-06-19T00:00:00.000Z"),
      checklist: [
        {
          title: "Right rail still feels dense",
          status: "warn",
          notes: ["Needs visual cleanup before recording."]
        }
      ]
    });

    expect(passed.status).toBe("passed");
    expect(passed.warnings).toEqual([]);
    expect(warned.status).toBe("warning");
    expect(warned.warnings[0]).toContain("Right rail");
  });

  it("writes, parses, and lists durable web UI review findings", async () => {
    const root = await mkdtemp(join(tmpdir(), "truth-harness-web-ui-review-"));
    await initLocalWorkspace(root, { now: "2026-06-19T00:00:00.000Z" });

    const result = await writeWebUiReview({
      rootPath: root,
      now: new Date("2026-06-19T00:00:01.000Z"),
      targetUrl: "http://127.0.0.1:4180/",
      viewport: { width: 1365, height: 768 },
      screenshot: ".truth-harness/findings/ui-review.png",
      checklist: [
        {
          title: "Main workspace, checks, notes, replay, and report tabs remain readable without text clipping.",
          status: "pass",
          notes: ["Reviewed in the in-app browser."]
        },
        {
          title: "Fixed composer does not hide the focused evidence pane.",
          status: "pass"
        }
      ],
      replayCommand: "truth-harness workspace ui-review . --write --pass browser-review"
    });
    const parsed = parseWebUiReviewJson(await readFile(result.jsonPath, "utf8"), result.jsonPath);
    const reviews = await listWebUiReviews(root);

    expect(parsed.schemaVersion).toBe("truth-harness.web-ui-review.v0");
    expect(parsed.reviewId).toBe(result.record.reviewId);
    expect(parsed.status).toBe("passed");
    expect(parsed.localOnly).toBe(true);
    expect(parsed.networkAccess).toBe("none");
    expect(parsed.viewport).toEqual({ width: 1365, height: 768 });
    expect(parsed.artifacts.json).toContain(".truth-harness/findings/");
    expect(parsed.artifacts.screenshot).toBe(".truth-harness/findings/ui-review.png");
    expect(result.markdown).toContain("Truth Harness Web UI Review");
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      reviewId: parsed.reviewId,
      status: "passed",
      layoutAudit: undefined,
      checks: {
        passed: 2,
        warnings: 0,
        failed: 0
      }
    });
  });

  it("attaches browser layout audit summaries and fails closed on layout failures", async () => {
    const root = await mkdtemp(join(tmpdir(), "truth-harness-web-ui-layout-review-"));
    await initLocalWorkspace(root, { now: "2026-06-19T00:00:00.000Z" });
    const layoutAuditSummary = parseWebUiLayoutAuditSummaryJson(
      `\ufeff${JSON.stringify({
        schemaVersion: "truth-harness.web-ui-layout-audit.v0",
        generatedAt: "2026-06-19T00:00:02.000Z",
        viewport: { width: 1280, height: 720 },
        status: "failed",
        summary: {
          surfaces: 9,
          passed: 8,
          warnings: 0,
          failures: 1
        },
        surfaces: [
          {
            surface: "graph",
            status: "failed",
            findings: [
              {
                severity: "fail",
                code: "branch-map-overlap",
                selector: ".git-branch-row",
                detail: "Branch map rows overlap."
              }
            ]
          }
        ]
      })}`,
      ".truth-harness/findings/ui-layout-audit.json"
    );

    const result = await writeWebUiReview({
      rootPath: root,
      now: new Date("2026-06-19T00:00:03.000Z"),
      targetUrl: "http://127.0.0.1:4180/?uiAudit=1",
      layoutAudit: ".truth-harness/findings/ui-layout-audit.json",
      layoutAuditSummary,
      checklist: [
        {
          title: "Browser was opened before saving the review.",
          status: "pass"
        }
      ]
    });
    const parsed = parseWebUiReviewJson(await readFile(result.jsonPath, "utf8"), result.jsonPath);
    const reviews = await listWebUiReviews(root);

    expect(layoutAuditSummary.status).toBe("failed");
    expect(layoutAuditSummary.nonPassingSurfaces).toEqual([
      {
        surface: "graph",
        status: "failed",
        findings: 1,
        findingCodes: ["branch-map-overlap"]
      }
    ]);
    expect(parsed.status).toBe("failed");
    expect(parsed.layoutAudit).toMatchObject({
      status: "failed",
      surfaces: {
        total: 9,
        passed: 8,
        warnings: 0,
        failures: 1
      }
    });
    expect(parsed.artifacts.layoutAudit).toBe(".truth-harness/findings/ui-layout-audit.json");
    expect(parsed.checklist.some((check) => check.status === "fail" && check.title.includes("Browser layout audit failed"))).toBe(true);
    expect(result.markdown).toContain("Browser Layout Audit");
    expect(result.markdown).toContain("branch-map-overlap");
    expect(reviews[0]).toMatchObject({
      reviewId: parsed.reviewId,
      status: "failed",
      layoutAudit: ".truth-harness/findings/ui-layout-audit.json",
      layoutAuditStatus: "failed",
      checks: {
        passed: 1,
        warnings: 0,
        failed: 1
      }
    });
  });
});

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initLocalWorkspace } from "./local-workspace.js";
import {
  createWebUiReviewRecord,
  listWebUiReviews,
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
      checks: {
        passed: 2,
        warnings: 0,
        failed: 0
      }
    });
  });
});

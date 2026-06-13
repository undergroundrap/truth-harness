import { describe, expect, it } from "vitest";
import { createReceipt } from "./receipt.js";
import { createTeachingPacket, isTeachingAudience, renderTeachingPacketMarkdown } from "./teaching-packet.js";
import type { Receipt } from "./types.js";

describe("teaching packets", () => {
  it("creates a professor-ready packet from a receipt without upgrading trust", () => {
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    const packet = createTeachingPacket(receipt, { audience: "college" });

    expect(packet.schemaVersion).toBe("truth-harness.teaching-packet.v0");
    expect(packet.receiptRunId).toBe(receipt.runId);
    expect(packet.trust).toBe("exact-computed");
    expect(packet.proofCheckerBacked).toBe(false);
    expect(packet.replay).toBe(receipt.replay);
    expect(packet.learningGoals.join(" ")).toContain("replay command");
    expect(packet.misconceptionChecks.join(" ")).toContain("denominator");
    expect(packet.boundary.join(" ")).toContain("do not upgrade trust labels");
  });

  it("renders markdown with replay, rubric, and trust boundary", () => {
    const receipt = createReceipt("compute 2 + 2");
    const markdown = renderTeachingPacketMarkdown(createTeachingPacket(receipt, { audience: "middle" }));

    expect(markdown).toContain("# Teaching Packet:");
    expect(markdown).toContain("| Audience | `middle` |");
    expect(markdown).toContain("| Trust | `exact-computed` |");
    expect(markdown).toContain(`| Replay | \`${receipt.replay}\` |`);
    expect(markdown).toContain("## Assessment Rubric");
    expect(markdown).toContain("## Teaching Boundary");
    expect(markdown).toContain("not proof-checker-backed");
  });

  it("escapes raw html in teaching packet markdown", () => {
    const receipt: Receipt = {
      ...createReceipt("compute 2 + 2"),
      problem: "<script>alert(1)</script>",
      summary: "unsafe <b>summary</b>"
    };
    const markdown = renderTeachingPacketMarkdown(createTeachingPacket(receipt));

    expect(markdown).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markdown).toContain("unsafe &lt;b&gt;summary&lt;/b&gt;");
    expect(markdown).not.toContain("<script>alert(1)</script>");
  });

  it("validates teaching audiences", () => {
    expect(isTeachingAudience("college")).toBe(true);
    expect(isTeachingAudience("graduate-school")).toBe(false);
  });
});

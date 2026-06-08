import { describe, expect, it } from "vitest";
import { createReceipt } from "./receipt.js";
import { renderReceipt, renderReceiptHtml, renderReceiptMarkdown } from "./receipt-renderer.js";
import type { Receipt } from "./types.js";

describe("receipt renderers", () => {
  it("renders readable markdown receipts", () => {
    const receipt = createReceipt("compute 2 + 2");
    const markdown = renderReceiptMarkdown(receipt);

    expect(markdown).toContain(`# Theorem Receipt ${receipt.runId}`);
    expect(markdown).toContain("| Trust | `exact-computed` |");
    expect(markdown).toContain("## Evidence Graph");
    expect(markdown).toContain("exact-arithmetic-result");
  });

  it("renders escaped html receipts", () => {
    const receipt: Receipt = {
      ...createReceipt("compute 2 + 2"),
      problem: "<script>alert(1)</script>",
      summary: "unsafe <b>summary</b>"
    };
    const html = renderReceiptHtml(receipt);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("unsafe &lt;b&gt;summary&lt;/b&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("escapes raw html in markdown report prose", () => {
    const receipt: Receipt = {
      ...createReceipt("compute 2 + 2"),
      problem: "<script>alert(1)</script>",
      summary: "unsafe <b>summary</b>"
    };
    const markdown = renderReceiptMarkdown(receipt);

    expect(markdown).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markdown).toContain("unsafe &lt;b&gt;summary&lt;/b&gt;");
    expect(markdown).not.toContain("<script>alert(1)</script>");
  });

  it("dispatches by format", () => {
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");

    expect(renderReceipt(receipt, "markdown")).toContain(receipt.runId);
    expect(renderReceipt(receipt, "html")).toContain("<!doctype html>");
  });
});

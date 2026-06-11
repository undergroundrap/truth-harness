import { describe, expect, it } from "vitest";
import { createReceipt } from "./receipt.js";
import { renderReceiptMarkdown } from "./receipt-renderer.js";
import { parseReceiptJson, ReceiptValidationError, validateReceipt } from "./receipt-validation.js";
import type { Receipt } from "./types.js";

describe("receipt runtime validation", () => {
  it("accepts generated receipts", () => {
    const receipt = createReceipt("compute 2 + 2");
    const parsed = parseReceiptJson(JSON.stringify(receipt), "generated");

    expect(parsed.runId).toBe(receipt.runId);
    expect(validateReceipt(receipt)).toEqual([]);
  });

  it("rejects legacy or corrupted receipts without evidence profiles", () => {
    const corrupted = { ...createReceipt("compute 2 + 2") } as Record<string, unknown>;
    delete corrupted.evidenceProfile;

    expect(() => parseReceiptJson(JSON.stringify(corrupted), "legacy-receipt.json")).toThrow(
      ReceiptValidationError
    );

    try {
      parseReceiptJson(JSON.stringify(corrupted), "legacy-receipt.json");
    } catch (error) {
      expect(error).toBeInstanceOf(ReceiptValidationError);
      expect(error instanceof ReceiptValidationError ? error.issues[0]?.path : "").toBe("$.evidenceProfile");
    }
  });

  it("rejects invalid backend metadata before rendering", () => {
    const corrupted = {
      ...createReceipt("compute 2 + 2"),
      evidenceProfile: {
        ...createReceipt("compute 2 + 2").evidenceProfile,
        backends: [{ id: "local-rational-arithmetic", role: "magic", acceptedProofChecker: false }]
      }
    } as unknown as Receipt;

    expect(() => renderReceiptMarkdown(corrupted)).toThrow(ReceiptValidationError);
  });
});

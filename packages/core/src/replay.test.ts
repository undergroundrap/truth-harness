import { describe, expect, it } from "vitest";
import { createReceipt } from "./receipt.js";
import { replayReceipt } from "./replay.js";

describe("replayReceipt", () => {
  it("replays deterministic receipts", () => {
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    const replay = replayReceipt(receipt);

    expect(replay.passed).toBe(true);
    expect(replay.actualRunId).toBe(receipt.runId);
  });

  it("detects changed expectations", () => {
    const receipt = createReceipt("compute 2 + 2");
    const replay = replayReceipt({
      ...receipt,
      trust: "proved"
    });

    expect(replay.passed).toBe(false);
    expect(replay.differences[0]).toContain("trust changed");
  });
});

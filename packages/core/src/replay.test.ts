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

  it("detects changed privacy expectations", () => {
    const receipt = createReceipt("compute 2 + 2");
    const replay = replayReceipt({
      ...receipt,
      privacy: {
        ...receipt.privacy,
        mode: "external-calls",
        networkAccess: "optional",
        externalDisclosures: [
          {
            service: "example-model",
            purpose: "test disclosure",
            dataClasses: ["problem"],
            userInitiated: true
          }
        ]
      }
    });

    expect(replay.passed).toBe(false);
    expect(replay.differences.some((difference) => difference.includes("privacy changed"))).toBe(true);
  });
});

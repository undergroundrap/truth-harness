import { createReceipt } from "./receipt.js";
import { assertReceipt } from "./receipt-validation.js";
import type { Receipt } from "./types.js";

export interface ReplayResult {
  passed: boolean;
  expectedRunId: string;
  actualRunId: string;
  expectedTrust: string;
  actualTrust: string;
  differences: string[];
  receipt: Receipt;
}

export function replayReceipt(
  expected: Receipt
): ReplayResult {
  assertReceipt(expected);
  const actual = createReceipt(expected.problem);
  const differences: string[] = [];

  if (actual.runId !== expected.runId) {
    differences.push(`runId changed from ${expected.runId} to ${actual.runId}`);
  }

  if (actual.trust !== expected.trust) {
    differences.push(`trust changed from ${expected.trust} to ${actual.trust}`);
  }

  if (actual.summary !== expected.summary) {
    differences.push(`summary changed from ${JSON.stringify(expected.summary)} to ${JSON.stringify(actual.summary)}`);
  }

  if (expected.privacy && JSON.stringify(actual.privacy) !== JSON.stringify(expected.privacy)) {
    differences.push(
      `privacy changed from ${JSON.stringify(expected.privacy)} to ${JSON.stringify(actual.privacy)}`
    );
  }

  return {
    passed: differences.length === 0,
    expectedRunId: expected.runId,
    actualRunId: actual.runId,
    expectedTrust: expected.trust,
    actualTrust: actual.trust,
    differences,
    receipt: actual
  };
}

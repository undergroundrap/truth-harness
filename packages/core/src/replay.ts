import { createReceipt } from "./receipt.js";
import { assertReceipt } from "./receipt-validation.js";
import { stableHash } from "./stable-hash.js";
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
  const actual = createReceipt(expected.problem, { independentCasNow: independentCasTimestamp(expected) });
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

  const expectedEvidence = replayEvidence(expected);
  const actualEvidence = replayEvidence(actual);
  for (const field of Object.keys(expectedEvidence)) {
    if (stableHash(expectedEvidence[field]) !== stableHash(actualEvidence[field])) {
      differences.push(`${field} changed`);
    }
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

function replayEvidence(receipt: Receipt): Record<string, unknown> {
  const evidence = {
    normalizedProblem: receipt.normalizedProblem,
    replay: receipt.replay,
    evidenceProfile: receipt.evidenceProfile,
    graph: {
      ...receipt.graph,
      nodes: receipt.graph.nodes.map(({ createdAt: _createdAt, ...node }) => node)
    },
    artifacts: receipt.artifacts,
    findings: receipt.findings
  };

  // Match saved JSON receipts, which omit optional undefined payload fields.
  return JSON.parse(JSON.stringify(evidence)) as Record<string, unknown>;
}

function independentCasTimestamp(receipt: Receipt): Date | undefined {
  const artifact = receipt.artifacts.find((entry) => entry.kind === "independent-cas-check");
  if (!artifact) return undefined;
  try {
    // This timestamp is display metadata. All checker results are recomputed.
    const raw: unknown = JSON.parse(artifact.content)?.createdAt;
    if (typeof raw !== "string") return undefined;
    const timestamp = new Date(raw);
    return Number.isFinite(timestamp.getTime()) ? timestamp : undefined;
  } catch {
    return undefined;
  }
}

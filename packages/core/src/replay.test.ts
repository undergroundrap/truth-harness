import { describe, expect, it, vi } from "vitest";
import type { ArithmeticTrace } from "./arithmetic-trace.js";
import { createReceipt } from "./receipt.js";
import { parseReceiptJson } from "./receipt-validation.js";
import { replayReceipt } from "./replay.js";
import type { Receipt } from "./types.js";

describe("replayReceipt", () => {
  it("replays deterministic receipts", () => {
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    const replay = replayReceipt(receipt);

    expect(replay.passed).toBe(true);
    expect(replay.actualRunId).toBe(receipt.runId);
  });

  it.each([
    "compute 3 / 4 + 5 / 8",
    "for all integers n, n^2+n is even",
    "for all integers n, n^2+n+1 is even",
    "bound x^2 + 2*x + 1 for x in [0, 2]",
    "dimension check force = mass * acceleration",
    "Unsupported problem with no local adapter"
  ])("replays saved receipts with older timestamps: %s", (problem) => {
    const receipt = createReceipt(problem);
    receipt.createdAt = "2000-01-01T00:00:00.000Z";
    receipt.graph.nodes.forEach((node) => {
      node.createdAt = receipt.createdAt;
    });
    const saved = parseReceiptJson(JSON.stringify(receipt));
    const replay = replayReceipt(saved);

    expect(replay.passed).toBe(true);
    expect(replay.differences).toEqual([]);
    expect(replay.receipt.createdAt).not.toBe(saved.createdAt);
    expect(replay.receipt.graph.nodes[0].createdAt).not.toBe(saved.graph.nodes[0].createdAt);
  });

  it("replays serialized symbolic evidence later with a fresh graph timestamp", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2000-01-01T00:00:00.000Z"));
    try {
      const receipt = createReceipt("symbolic simplify sin(x)^2 + cos(x)^2");
      const saved = parseReceiptJson(JSON.stringify(receipt));
      vi.setSystemTime(new Date("2000-01-02T00:00:00.000Z"));
      const replay = replayReceipt(saved);
      expect(replay.differences).toEqual([]);
      expect(replay.receipt.createdAt).not.toBe(saved.createdAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it("compares structured evidence independently of object key order", () => {
    const receipt = createReceipt("compute 2 + 2");
    receipt.graph.nodes = receipt.graph.nodes.map((node) => ({
      ...node,
      payload: Object.fromEntries(Object.entries(node.payload as Record<string, unknown>).reverse())
    }));
    receipt.evidenceProfile = Object.fromEntries(
      Object.entries(receipt.evidenceProfile).reverse()
    ) as Receipt["evidenceProfile"];
    receipt.artifacts = receipt.artifacts.map(({ content, mimeType, kind, id }) => ({
      content, mimeType, kind, id
    }));

    expect(replayReceipt(receipt).passed).toBe(true);
  });

  it.each<{ name: string; field: string; mutate: (receipt: Receipt) => void }>([
    {
      name: "changed replay instruction",
      field: "replay",
      mutate: (receipt) => { receipt.replay = "truth-harness ask \"compute 1 + 1\" --json"; }
    },
    {
      name: "artifact content",
      field: "artifacts",
      mutate: (receipt) => {
        const artifact = receipt.artifacts.find((entry) => entry.kind === "exact-arithmetic-result")!;
        artifact.content = JSON.stringify({ ...JSON.parse(artifact.content), result: "999" });
      }
    },
    {
      name: "artifact metadata",
      field: "artifacts",
      mutate: (receipt) => { receipt.artifacts[0].kind = "accepted-proof"; }
    },
    {
      name: "removed artifacts",
      field: "artifacts",
      mutate: (receipt) => { receipt.artifacts.pop(); }
    },
    {
      name: "injected artifacts",
      field: "artifacts",
      mutate: (receipt) => { receipt.artifacts.push({ ...receipt.artifacts[0] }); }
    },
    {
      name: "graph node payload",
      field: "graph",
      mutate: (receipt) => {
        const node = receipt.graph.nodes.find((entry) => entry.kind === "computation")!;
        node.payload = { ...(node.payload as Record<string, unknown>), result: "999" };
      }
    },
    {
      name: "graph node trust",
      field: "graph",
      mutate: (receipt) => { receipt.graph.nodes[0].trust = "proved"; }
    },
    {
      name: "timestamp-shaped graph payload evidence",
      field: "graph",
      mutate: (receipt) => {
        const node = receipt.graph.nodes[0];
        node.payload = { ...(node.payload as Record<string, unknown>), createdAt: "forged" };
      }
    },
    {
      name: "graph node artifact references",
      field: "graph",
      mutate: (receipt) => {
        receipt.graph.nodes.find((entry) => entry.kind === "computation")!.artifactRefs = [];
      }
    },
    {
      name: "graph edge target",
      field: "graph",
      mutate: (receipt) => { receipt.graph.edges[0].to = receipt.graph.nodes[0].id; }
    },
    {
      name: "graph edge label",
      field: "graph",
      mutate: (receipt) => { receipt.graph.edges[0].label = "proved-by"; }
    },
    {
      name: "removed graph nodes",
      field: "graph",
      mutate: (receipt) => { receipt.graph.nodes.pop(); }
    },
    {
      name: "removed graph edges",
      field: "graph",
      mutate: (receipt) => { receipt.graph.edges.pop(); }
    },
    {
      name: "arithmetic trace steps",
      field: "artifacts",
      mutate: (receipt) => {
        const artifact = receipt.artifacts.find((entry) => entry.kind === "exact-arithmetic-trace")!;
        const trace = JSON.parse(artifact.content) as ArithmeticTrace;
        trace.steps[0].result = "999";
        artifact.content = JSON.stringify(trace, null, 2);
      }
    },
    {
      name: "trace limitations",
      field: "artifacts",
      mutate: (receipt) => {
        const artifact = receipt.artifacts.find((entry) => entry.kind === "exact-arithmetic-trace")!;
        const trace = JSON.parse(artifact.content) as ArithmeticTrace;
        trace.limitations = [];
        artifact.content = JSON.stringify(trace, null, 2);
      }
    },
    {
      name: "proof-checker policy",
      field: "evidenceProfile",
      mutate: (receipt) => { receipt.evidenceProfile.proofCheckerBacked = true; }
    },
    {
      name: "backend acceptance policy",
      field: "evidenceProfile",
      mutate: (receipt) => { receipt.evidenceProfile.backends[0].acceptedProofChecker = true; }
    },
    {
      name: "replay policy",
      field: "evidenceProfile",
      mutate: (receipt) => { receipt.evidenceProfile.replayable = false; }
    },
    {
      name: "evidence limitations",
      field: "evidenceProfile",
      mutate: (receipt) => { receipt.evidenceProfile.limitations = []; }
    },
    {
      name: "evidence inputs",
      field: "evidenceProfile",
      mutate: (receipt) => { receipt.evidenceProfile.inputs = ["999"]; }
    },
    {
      name: "evidence outputs",
      field: "evidenceProfile",
      mutate: (receipt) => { receipt.evidenceProfile.outputs = ["999"]; }
    },
    {
      name: "findings",
      field: "findings",
      mutate: (receipt) => { receipt.findings[0].message = "Accepted as a formal proof."; }
    },
    {
      name: "normalized problem",
      field: "normalizedProblem",
      mutate: (receipt) => { receipt.normalizedProblem = "compute 999"; }
    }
  ])("detects changed $name with unchanged run ID, trust, and summary", ({ field, mutate }) => {
    const original = createReceipt("compute 3 / 4 + 5 / 8");
    const tampered = parseReceiptJson(JSON.stringify(original));
    mutate(tampered);
    const replay = replayReceipt(tampered);

    expect(replay.actualRunId).toBe(tampered.runId);
    expect(replay.actualTrust).toBe(tampered.trust);
    expect(replay.receipt.summary).toBe(tampered.summary);
    expect(replay.passed).toBe(false);
    expect(replay.differences).toContain(`${field} changed`);
    expect(original.runId).toBe(tampered.runId);
    expect(original.createdAt).toBe(tampered.createdAt);
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

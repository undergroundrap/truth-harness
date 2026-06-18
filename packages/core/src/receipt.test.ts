import { describe, expect, it } from "vitest";
import { createReceipt } from "./receipt.js";

describe("createReceipt", () => {
  it("creates exact arithmetic receipts", () => {
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("11/8");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-rational-arithmetic");
    expect(receipt.evidenceProfile.proofCheckerBacked).toBe(false);
    expect(receipt.graph.nodes.some((node) => node.kind === "computation")).toBe(true);
    expect(receipt.graph.nodes.some((node) => node.kind === "lesson")).toBe(true);
    const traceArtifact = receipt.artifacts.find((artifact) => artifact.kind === "exact-arithmetic-trace");
    expect(traceArtifact).toBeDefined();
    const trace = JSON.parse(traceArtifact?.content ?? "{}") as {
      result?: string;
      steps?: unknown[];
      explanations?: Array<{ audience: string }>;
    };
    expect(trace.result).toBe("11/8");
    expect(trace.steps?.length).toBeGreaterThan(0);
    expect(trace.explanations?.map((view) => view.audience)).toContain("middle-school");
  });

  it("checks concrete LaTeX common-denominator lemmas with exact arithmetic", () => {
    const receipt = createReceipt("\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{6}{8}");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("lcm(4,8) = 8");
    expect(receipt.summary).toContain("3/4 = 3/4");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-rational-arithmetic");
    expect(receipt.evidenceProfile.outputs).toContain("checks=passed");
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("not a formal proof");
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "common-denominator-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      verdict?: string;
      rewrite?: { multiplier?: string };
      checks?: Array<{ id: string; ok: boolean }>;
    };
    expect(payload.verdict).toBe("accepted");
    expect(payload.rewrite?.multiplier).toBe("2");
    expect(payload.checks?.every((check) => check.ok)).toBe(true);
  });

  it("refutes wrong concrete common-denominator lemmas", () => {
    const receipt = createReceipt("\\operatorname{lcm}(4,8) = 8,\\ \\frac{3}{4}=\\frac{7}{8}");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("Refuted common-denominator statement");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["numerator-rewrite=failed", "fraction-equality=failed"])
    );
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("marks MVP receipts as local-only with no external disclosure", () => {
    const receipt = createReceipt("compute 2 + 2");

    expect(receipt.privacy).toEqual({
      mode: "local-only",
      localFirst: true,
      networkAccess: "none",
      dataResidency: "local-workspace",
      externalDisclosures: []
    });
  });

  it("refutes false universal parity claims with a counterexample", () => {
    const receipt = createReceipt("for all integers n, n^2+n+1 is even");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("n=-20");
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("checks polynomial universal parity claims without minting proved", () => {
    const receipt = createReceipt("for all integers n, n^2+n is even");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("Exact modular parity check");
    expect(receipt.summary).toContain("not proof-checker-backed");
    expect(receipt.evidenceProfile.kind).toBe("universal-parity");
    expect(receipt.evidenceProfile.backends.map((backend) => backend.id)).toContain("local-modular-parity-checker");
    expect(receipt.evidenceProfile.proofCheckerBacked).toBe(false);
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("Reserve `proved`");
    expect(
      receipt.graph.nodes.some((node) => node.kind === "computation" && node.trust === "exact-computed")
    ).toBe(true);
    expect(receipt.artifacts.some((artifact) => artifact.kind === "modular-parity-check-certificate")).toBe(true);
    expect(receipt.findings[0]?.message).toContain("reserve `proved`");
  });

  it("does not pretend unsupported finite search is a proof", () => {
    const receipt = createReceipt("for all integers n, 2*(n/1) is even");

    expect(receipt.trust).toBe("unverified");
    expect(receipt.findings[0]?.message).toContain("local parity checker could not certify");
  });

  it("creates dimension-checked receipts for consistent physics formulas", () => {
    const receipt = createReceipt("dimension check force = mass * acceleration");

    expect(receipt.trust).toBe("dimension-checked");
    expect(receipt.summary).toContain("Dimensionally consistent");
    expect(receipt.graph.nodes.some((node) => node.kind === "tool_run" && node.trust === "dimension-checked")).toBe(true);
  });

  it("creates bounded-numeric receipts for interval prompts", () => {
    const receipt = createReceipt("bound x^2 + 2*x + 1 for x in [0, 2]");

    expect(receipt.trust).toBe("bounded-numeric");
    expect(receipt.summary).toContain("[1, 9]");
    expect(receipt.artifacts.some((artifact) => artifact.kind === "interval-bound-result")).toBe(true);
  });

  it("keeps unsafe interval prompts unverified", () => {
    const receipt = createReceipt("bound 1 / x for x in [-1, 1]");

    expect(receipt.trust).toBe("unverified");
    expect(receipt.summary).toContain("contains zero");
  });

  it("refutes dimensionally inconsistent physics formulas", () => {
    const receipt = createReceipt("dimension check force = mass * velocity");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("left is M L T^-2");
    expect(receipt.summary).toContain("right is M L T^-1");
  });

  it("creates symbolic receipts when the SymPy adapter is available", () => {
    const receipt = createReceipt("symbolic simplify sin(x)^2 + cos(x)^2", {
      maximaCommand: "truth-harness-missing-maxima-command"
    });

    if (receipt.trust === "exact-computed") {
      expect(receipt.summary).toContain("1");
      const artifact = receipt.artifacts.find((item) => item.kind === "symbolic-computation-result");
      expect(artifact).toBeDefined();
      const payload = JSON.parse(artifact?.content ?? "{}") as {
        checks?: Array<{ id: string; status: string }>;
        checkStatus?: string;
        independentCasStatus?: string;
        independentCasCheckRef?: string;
      };
      expect(payload.checkStatus).toBe("passed");
      expect(payload.independentCasStatus).toMatch(/^(passed|solver-unavailable|error)$/u);
      expect(payload.independentCasCheckRef).toMatch(/^artifact_/u);
      expect(payload.checks?.map((check) => `${check.id}:${check.status}`)).toEqual([
        "symbolic-equivalence:passed",
        "numeric-sample-equivalence:passed"
      ]);
      expect(receipt.evidenceProfile.outputs.join(" ")).toContain("sanityChecks=passed");
      expect(receipt.evidenceProfile.outputs.join(" ")).toContain("independentCas=maxima:");
      expect(receipt.artifacts.some((item) => item.kind === "independent-cas-check")).toBe(true);
      expect(receipt.findings.map((finding) => finding.message).join(" ")).toContain("same-engine");
      return;
    }

    expect(receipt.trust).toBe("unverified");
    expect(receipt.findings[0]?.message).toContain("SymPy adapter");
  });

  it("upgrades symbolic receipts to cross-checked only when independent Maxima agrees", () => {
    const receipt = createReceipt("symbolic simplify sin(x)^2 + cos(x)^2", {
      maximaCommand: "maxima-test",
      casRunner: (_command, args) => {
        if (args[0] === "--version") {
          return {
            status: 0,
            stdout: "Maxima 5.47.0\n",
            stderr: ""
          };
        }

        return {
          status: 0,
          stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n",
          stderr: ""
        };
      }
    });

    if (receipt.trust === "unverified" && receipt.findings[0]?.message.includes("SymPy adapter")) {
      return;
    }

    expect(receipt.trust).toBe("cross-checked");
    expect(receipt.summary).toContain("Maxima independently agreed");
    expect(receipt.evidenceProfile.backends.map((backend) => backend.id)).toContain("local-maxima-symbolic-subprocess");
    expect(receipt.evidenceProfile.outputs.join(" ")).toContain("independentCas=maxima:passed");
    expect(receipt.findings.map((finding) => finding.message).join(" ")).toContain("supports `cross-checked`, not `proved`");
  });

  it("keeps symbolic receipts unverified when independent Maxima disagrees", () => {
    const receipt = createReceipt("symbolic expand (x + 1)^2", {
      maximaCommand: "maxima-test",
      casRunner: (_command, args) => {
        if (args[0] === "--version") {
          return {
            status: 0,
            stdout: "Maxima 5.47.0\n",
            stderr: ""
          };
        }

        return {
          status: 0,
          stdout: "TRUTH_HARNESS_MAXIMA_STATUS:failed:x\n",
          stderr: ""
        };
      }
    });

    if (receipt.trust === "unverified" && receipt.findings[0]?.message.includes("SymPy adapter")) {
      return;
    }

    expect(receipt.trust).toBe("unverified");
    expect(receipt.summary).toContain("symbolic check failed");
    expect(receipt.evidenceProfile.outputs.join(" ")).toContain("independentCas=maxima:failed");
    expect(receipt.findings.map((finding) => finding.message).join(" ")).toContain("Maxima disagreed");
  });
});

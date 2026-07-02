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

  it("checks concrete LaTeX arithmetic equalities with exact rational traces", () => {
    const receipt = createReceipt("\\frac{3}{4}+\\frac{5}{8} = \\frac{11}{8}");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("both sides equal 11/8");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["left=11/8", "right=11/8", "equality=passed"])
    );
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("not a formal proof");
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "exact-arithmetic-equality-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      verdict?: string;
      left?: { result?: string; trace?: { steps?: unknown[] } };
      right?: { result?: string; trace?: { steps?: unknown[] } };
    };
    expect(payload.verdict).toBe("accepted");
    expect(payload.left?.result).toBe("11/8");
    expect(payload.right?.result).toBe("11/8");
    expect(payload.left?.trace?.steps?.length).toBeGreaterThan(0);
  });

  it("refutes false concrete LaTeX arithmetic equalities", () => {
    const receipt = createReceipt("\\frac{3}{4}+\\frac{5}{8} = \\frac{3}{2}");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("left side is 11/8");
    expect(receipt.summary).toContain("right side is 3/2");
    expect(receipt.evidenceProfile.outputs).toContain("equality=failed");
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("checks bounded one-variable integer solution-set claims with exact enumeration", () => {
    const receipt = createReceipt("The integer constraints x > 0 and x < 3 have exactly the solutions x = 1 and x = 2.");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("x=1, x=2");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-bounded-integer-enumerator");
    expect(receipt.evidenceProfile.outputs).toEqual(expect.arrayContaining(["solutions=x=1, x=2", "checks=passed"]));
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("one-variable integer");
    expect(receipt.graph.nodes.some((node) => node.kind === "computation" && node.trust === "exact-computed")).toBe(true);
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "bounded-integer-solution-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      verdict?: string;
      searchRange?: { lower?: string; upper?: string };
      computedSolutions?: string[];
    };
    expect(payload.verdict).toBe("accepted");
    expect(payload.searchRange).toEqual({ lower: "1", upper: "2" });
    expect(payload.computedSolutions).toEqual(["1", "2"]);
  });

  it("refutes wrong bounded one-variable integer solution-set claims", () => {
    const receipt = createReceipt("The integer constraints x > 0 and x < 3 have exactly the solution x = 1.");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("computed x=1, x=2");
    expect(receipt.summary).toContain("stated x=1");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["computed=x=1, x=2", "stated=x=1", "missing=x=2", "extra=none"])
    );
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("computes Project Euler style finite multiple sums exactly", () => {
    const receipt = createReceipt("Find the sum of all the multiples of 3 or 5 below 1000.");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("233168");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-finite-sum-inclusion-exclusion");
    expect(receipt.evidenceProfile.outputs).toEqual(expect.arrayContaining(["result=233168", "finite-sum=computed"]));
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("positive-integer multiple sums");
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "finite-multiple-sum-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      result?: string;
      verdict?: string;
      inclusionExclusion?: Array<{ lcm?: string; sum?: string; signedContribution?: string }>;
    };
    expect(payload.result).toBe("233168");
    expect(payload.verdict).toBe("computed");
    expect(payload.inclusionExclusion).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lcm: "3", sum: "166833", signedContribution: "166833" }),
        expect.objectContaining({ lcm: "5", sum: "99500", signedContribution: "99500" }),
        expect.objectContaining({ lcm: "15", sum: "33165", signedContribution: "-33165" })
      ])
    );
  });

  it("refutes stated finite multiple sums when the exact inclusion-exclusion result disagrees", () => {
    const receipt = createReceipt("verify sum of multiples of 3 or 5 below 1000 = 233169");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("233168");
    expect(receipt.summary).toContain("233169");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["result=233168", "stated=233169", "finite-sum=failed"])
    );
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("computes Project Euler style even Fibonacci sums exactly", () => {
    const receipt = createReceipt("Find the sum of even Fibonacci terms not exceeding 4000000.");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("4613732");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-fibonacci-even-sum");
    expect(receipt.evidenceProfile.outputs).toEqual(expect.arrayContaining(["result=4613732", "finite-sequence=computed"]));
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "finite-fibonacci-even-sum-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      result?: string;
      verdict?: string;
      evenTerms?: string[];
    };
    expect(payload.result).toBe("4613732");
    expect(payload.verdict).toBe("computed");
    expect(payload.evenTerms).toContain("3524578");
  });

  it("refutes stated even Fibonacci sums when the exact recurrence result disagrees", () => {
    const receipt = createReceipt("verify sum of even Fibonacci terms not exceeding 4000000 = 4613733");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("4613732");
    expect(receipt.summary).toContain("4613733");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["result=4613732", "stated=4613733", "finite-sequence=failed"])
    );
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("computes Project Euler style sum-square differences exactly", () => {
    const receipt = createReceipt(
      "Find the difference between the square of the sum and the sum of squares for the first 100 natural numbers."
    );

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("25164150");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-sum-square-difference");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["difference=25164150", "sum-square-difference=computed"])
    );
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "sum-square-difference-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      difference?: string;
      sum?: string;
      sumOfSquares?: string;
      sumSquared?: string;
    };
    expect(payload.sum).toBe("5050");
    expect(payload.sumOfSquares).toBe("338350");
    expect(payload.sumSquared).toBe("25502500");
    expect(payload.difference).toBe("25164150");
  });

  it("refutes stated sum-square differences when the exact formula result disagrees", () => {
    const receipt = createReceipt(
      "verify difference between square of sum and sum of squares for first 100 natural numbers = 25164151"
    );

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("25164150");
    expect(receipt.summary).toContain("25164151");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["difference=25164150", "stated=25164151", "sum-square-difference=failed"])
    );
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("computes Project Euler style self-power last digits exactly", () => {
    const receipt = createReceipt("Find the last ten digits of the series 1^1 + 2^2 + 3^3 + ... + 1000^1000.");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("9110846700");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-self-power-modular-sum");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["lastDigits=9110846700", "self-power-last-digits=computed"])
    );
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "self-power-last-digits-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      result?: string;
      modulus?: string;
      termsChecked?: string;
      sampledTerms?: Array<{ k?: string; residue?: string }>;
    };
    expect(payload.result).toBe("9110846700");
    expect(payload.modulus).toBe("10000000000");
    expect(payload.termsChecked).toBe("1000");
    expect(payload.sampledTerms).toEqual(expect.arrayContaining([expect.objectContaining({ k: "1000", residue: "0000000000" })]));
  });

  it("refutes wrong self-power last-digit claims", () => {
    const receipt = createReceipt("verify last ten digits of self powers through 1000 = 9110846701");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("9110846700");
    expect(receipt.summary).toContain("9110846701");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["lastDigits=9110846700", "stated=9110846701", "self-power-last-digits=failed"])
    );
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("computes Project Euler style binomial threshold counts exactly", () => {
    const receipt = createReceipt("How many values of n choose r for 1 <= n <= 100 are greater than 1000000?");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("4075");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-binomial-threshold-counter");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["count=4075", "binomial-threshold-count=computed"])
    );
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "binomial-threshold-count-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      count?: string;
      firstExceeding?: { n?: string; r?: string; value?: string };
      perNCounts?: Array<{ n?: string; aboveThreshold?: string }>;
    };
    expect(payload.count).toBe("4075");
    expect(payload.firstExceeding).toEqual({ n: "23", r: "10", value: "1144066" });
    expect(payload.perNCounts).toEqual(expect.arrayContaining([expect.objectContaining({ n: "100", aboveThreshold: "93" })]));
  });

  it("refutes wrong binomial threshold counts", () => {
    const receipt = createReceipt("verify count of n choose r values for 1 <= n <= 100 greater than 1000000 = 4076");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("4075");
    expect(receipt.summary).toContain("4076");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["count=4075", "stated=4076", "binomial-threshold-count=failed"])
    );
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("computes integer-coordinate AABB overlap exactly", () => {
    const receipt = createReceipt("Do AABB A min(0,0) max(4,4) and AABB B min(3,1) max(6,5) overlap?");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("true");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-aabb2-overlap");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["overlap=true", "aabb2-overlap=computed"])
    );
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "aabb2-overlap-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      overlap?: boolean;
      xOverlap?: boolean;
      yOverlap?: boolean;
      convention?: string;
    };
    expect(payload).toMatchObject({
      overlap: true,
      xOverlap: true,
      yOverlap: true,
      convention: "closed-intervals-touching-counts-as-overlap"
    });
  });

  it("refutes wrong AABB overlap claims with an exact geometry certificate", () => {
    const receipt = createReceipt("verify AABB A min(0,0) max(4,4) and AABB B min(5,1) max(7,3) overlap = true");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("false");
    expect(receipt.summary).toContain("true");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["overlap=false", "stated=true", "aabb2-overlap=failed"])
    );
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "aabb2-overlap-certificate");
    const payload = JSON.parse(certificate?.content ?? "{}") as { separatingAxes?: string[] };
    expect(payload.separatingAxes).toEqual(["a.maxX < b.minX"]);
  });

  it("treats touching AABB corners as overlap under the recorded closed-interval convention", () => {
    const receipt = createReceipt("verify AABB A min(0,0) max(4,4) and AABB B min(4,4) max(6,6) overlap = true");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["overlap=true", "stated=true", "aabb2-overlap=passed"])
    );
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("touching edges or corners count as overlap");
  });
  it("computes integer-coordinate segment intersections exactly", () => {
    const receipt = createReceipt("Do segment A from (0,0) to (4,4) and segment B from (0,4) to (4,0) intersect?");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("true");
    expect(receipt.summary).toContain("proper-crossing");
    expect(receipt.evidenceProfile.kind).toBe("exact-arithmetic");
    expect(receipt.evidenceProfile.backends[0]?.id).toBe("local-segment2-intersection");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["intersect=true", "classification=proper-crossing", "segment2-intersection=computed"])
    );
    const certificate = receipt.artifacts.find((artifact) => artifact.kind === "segment2-intersection-certificate");
    expect(certificate).toBeDefined();
    const payload = JSON.parse(certificate?.content ?? "{}") as {
      intersect?: boolean;
      classification?: string;
      orientations?: Array<{ sign?: string }>;
    };
    expect(payload.intersect).toBe(true);
    expect(payload.classification).toBe("proper-crossing");
    expect(payload.orientations?.map((item) => item.sign)).toEqual([
      "counterclockwise",
      "clockwise",
      "clockwise",
      "counterclockwise"
    ]);
  });

  it("refutes wrong segment intersection claims with exact orientation evidence", () => {
    const receipt = createReceipt("verify segment A from (0,0) to (1,1) and segment B from (2,2) to (3,3) intersect = true");

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("false");
    expect(receipt.summary).toContain("collinear-disjoint");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["intersect=false", "stated=true", "classification=collinear-disjoint", "segment2-intersection=failed"])
    );
    expect(receipt.graph.nodes.some((node) => node.kind === "counterexample")).toBe(true);
  });

  it("treats collinear segment overlap as intersection under the recorded closed-segment convention", () => {
    const receipt = createReceipt("verify segment A from (0,0) to (4,0) and segment B from (2,0) to (6,0) intersect = true");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["intersect=true", "stated=true", "classification=collinear-overlap", "segment2-intersection=passed"])
    );
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("endpoint touches and collinear overlaps count as intersection");
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

  it("checks every-integer parity wording with the same modular certificate", () => {
    const receipt = createReceipt("For every integer n, n^2 + n is even.");

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("Exact modular parity check");
    expect(receipt.evidenceProfile.kind).toBe("universal-parity");
    expect(receipt.evidenceProfile.proofCheckerBacked).toBe(false);
    expect(receipt.artifacts.some((artifact) => artifact.kind === "modular-parity-check-certificate")).toBe(true);
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

  it("routes human trig identity claims through symbolic CAS without minting proved", () => {
    const receipt = createReceipt("For real x, sin(x)^2 + cos(x)^2 = 1.", {
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

    expect(receipt.normalizedProblem).toBe("For real x, sin(x)^2 + cos(x)^2 = 1.");
    expect(receipt.trust).toBe("cross-checked");
    expect(receipt.summary).toContain("Maxima independently agreed");
    expect(receipt.evidenceProfile.kind).toBe("symbolic-cas");
    expect(receipt.evidenceProfile.inputs).toEqual(expect.arrayContaining(["simplify", "sin(x)^2 + cos(x)^2"]));
    expect(receipt.evidenceProfile.proofCheckerBacked).toBe(false);
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("not a formal proof");
  });

  it("verifies compiled polynomial identities by checking the residual is zero", () => {
    const receipt = createReceipt("For all real x, (x + 1)^2 = x^2 + 2*x + 1", {
      maximaCommand: "truth-harness-missing-maxima-command"
    });

    if (receipt.trust === "unverified" && receipt.findings[0]?.message.includes("SymPy adapter")) {
      return;
    }

    expect(receipt.trust).toBe("exact-computed");
    expect(receipt.summary).toContain("local sanity checks passed");
    expect(receipt.evidenceProfile.kind).toBe("symbolic-cas");
    expect(receipt.evidenceProfile.inputs).toEqual(
      expect.arrayContaining(["simplify", "((x + 1)^2) - (x^2 + 2*x + 1)", "variable=x"])
    );
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["0", "compilerContract=symbolic.polynomial-identity-residual.v1", "compiledClaim=polynomial-identity", "expectedResult=0", "expectedResultCheck=passed"])
    );
    expect(receipt.evidenceProfile.limitations.join(" ")).toContain("residual (left) - (right) must simplify exactly to 0");
  });

  it("refutes compiled polynomial identities when the residual is nonzero", () => {
    const receipt = createReceipt("For all real x, (x + 1)^2 = x^2 + 2*x + 2", {
      maximaCommand: "truth-harness-missing-maxima-command"
    });

    if (receipt.trust === "unverified" && receipt.findings[0]?.message.includes("SymPy adapter")) {
      return;
    }

    expect(receipt.trust).toBe("refuted");
    expect(receipt.summary).toContain("expected 0");
    expect(receipt.summary).toContain("claim refuted");
    expect(receipt.evidenceProfile.outputs).toEqual(
      expect.arrayContaining(["-1", "compilerContract=symbolic.polynomial-identity-residual.v1", "compiledClaim=polynomial-identity", "expectedResult=0", "expectedResultCheck=failed"])
    );
    expect(receipt.findings.map((finding) => finding.message).join(" ")).toContain("refuted inside this compiler boundary");
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

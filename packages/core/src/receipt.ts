import { checkDimensionEquation, parseDimensionPrompt } from "./dimension.js";
import { evaluateExpression, parseExpression } from "./expression.js";
import { Rational } from "./rational.js";
import { stableHash } from "./stable-hash.js";
import type { Artifact, EvidenceEdge, Finding, GraphNode, NodeKind, Receipt, TrustLabel } from "./types.js";

interface UniversalParityClaim {
  expressionSource: string;
  parity: "even" | "odd";
}

export function createReceipt(problem: string): Receipt {
  const createdAt = new Date().toISOString();
  const normalizedProblem = normalizeProblem(problem);
  const nodes: GraphNode[] = [];
  const edges: EvidenceEdge[] = [];
  const artifacts: Artifact[] = [];
  const findings: Finding[] = [];

  const problemNode = addNode(nodes, createdAt, {
    kind: "problem",
    payload: { problem },
    trust: "unverified",
    summary: "Original user problem.",
    artifactRefs: []
  });

  const normalizedNode = addNode(nodes, createdAt, {
    kind: "normalized_problem",
    payload: { normalizedProblem },
    trust: "unverified",
    summary: "Whitespace-normalized problem statement.",
    artifactRefs: []
  });

  edges.push({ from: problemNode.id, to: normalizedNode.id, label: "normalized-as" });

  const universalParity = parseUniversalParityClaim(normalizedProblem);
  if (universalParity) {
    return completeUniversalParityReceipt({
      problem,
      normalizedProblem,
      createdAt,
      nodes,
      edges,
      artifacts,
      findings,
      normalizedNode,
      claim: universalParity
    });
  }

  const dimensionSource = parseDimensionPrompt(normalizedProblem);
  if (dimensionSource) {
    return completeDimensionReceipt({
      problem,
      normalizedProblem,
      dimensionSource,
      createdAt,
      nodes,
      edges,
      artifacts,
      findings,
      normalizedNode
    });
  }

  const arithmeticSource = parseArithmeticPrompt(normalizedProblem);
  if (arithmeticSource) {
    return completeArithmeticReceipt({
      problem,
      normalizedProblem,
      arithmeticSource,
      createdAt,
      nodes,
      edges,
      artifacts,
      findings,
      normalizedNode
    });
  }

  findings.push({
    level: "warning",
    message: "No local adapter could verify, refute, or compute this problem yet."
  });

  const planNode = addNode(nodes, createdAt, {
    kind: "plan",
    payload: {
      nextAdapters: ["sympy", "lean", "z3", "rag"],
      reason: "The MVP only handles exact arithmetic and universal parity counterexample searches."
    },
    trust: "unverified",
    summary: "Future adapter plan for unsupported problem.",
    artifactRefs: []
  });
  edges.push({ from: normalizedNode.id, to: planNode.id, label: "requires-adapter" });

  return buildReceipt({
    problem,
    normalizedProblem,
    createdAt,
    trust: "unverified",
    summary: "Unsupported by the local MVP adapters; no verified claim returned.",
    nodes,
    edges,
    artifacts,
    findings
  });
}

function completeDimensionReceipt(args: {
  problem: string;
  normalizedProblem: string;
  dimensionSource: string;
  createdAt: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
  normalizedNode: GraphNode;
}): Receipt {
  try {
    const result = checkDimensionEquation(args.dimensionSource);
    const trust: TrustLabel = result.matched ? "dimension-checked" : "refuted";
    const artifact = addArtifact(args.artifacts, {
      kind: "dimension-check-result",
      mimeType: "application/json",
      content: JSON.stringify(
        {
          adapter: "local-dimensional-analysis",
          equation: result.equation,
          lhsDimension: result.lhsText,
          rhsDimension: result.rhsText,
          matched: result.matched,
          identifiers: result.identifiers
        },
        null,
        2
      )
    });

    const claimNode = addNode(args.nodes, args.createdAt, {
      kind: "claim",
      payload: {
        equation: result.equation,
        lhsDimension: result.lhsText,
        rhsDimension: result.rhsText
      },
      trust,
      summary: result.matched
        ? "Dimensional analysis found matching dimensions on both sides."
        : "Dimensional analysis found incompatible dimensions.",
      artifactRefs: [artifact.id]
    });
    args.edges.push({ from: args.normalizedNode.id, to: claimNode.id, label: "claims" });

    const toolNode = addNode(args.nodes, args.createdAt, {
      kind: "tool_run",
      payload: {
        adapter: "local-dimensional-analysis",
        identifiers: result.identifiers
      },
      trust,
      summary: "Checked both sides using a local SI base-dimension table.",
      artifactRefs: [artifact.id]
    });
    args.edges.push({ from: claimNode.id, to: toolNode.id, label: "checked-by" });

    if (!result.matched) {
      const mismatchNode = addNode(args.nodes, args.createdAt, {
        kind: "counterexample",
        payload: {
          kind: "dimension-mismatch",
          lhsDimension: result.lhsText,
          rhsDimension: result.rhsText
        },
        trust: "refuted",
        summary: `Dimension mismatch: left is ${result.lhsText}, right is ${result.rhsText}.`,
        artifactRefs: [artifact.id]
      });
      args.edges.push({ from: toolNode.id, to: mismatchNode.id, label: "found" });

      return buildReceipt({
        problem: args.problem,
        normalizedProblem: args.normalizedProblem,
        createdAt: args.createdAt,
        trust,
        summary: `Refuted by dimensional analysis: left is ${result.lhsText}, right is ${result.rhsText}.`,
        nodes: args.nodes,
        edges: args.edges,
        artifacts: args.artifacts,
        findings: args.findings
      });
    }

    args.findings.push({
      level: "info",
      message: "Dimensional consistency is a necessary physics sanity check, not a proof that the equation is physically true."
    });

    return buildReceipt({
      problem: args.problem,
      normalizedProblem: args.normalizedProblem,
      createdAt: args.createdAt,
      trust,
      summary: `Dimensionally consistent: both sides are ${result.lhsText}. This checks units, not full physical truth.`,
      nodes: args.nodes,
      edges: args.edges,
      artifacts: args.artifacts,
      findings: args.findings
    });
  } catch (error) {
    args.findings.push({
      level: "warning",
      message: error instanceof Error ? error.message : "Dimension check failed for an unknown reason."
    });

    const planNode = addNode(args.nodes, args.createdAt, {
      kind: "plan",
      payload: {
        nextAdapters: ["units", "sympy", "rag"],
        reason: "The local dimensional-analysis adapter could not parse or evaluate this equation."
      },
      trust: "unverified",
      summary: "Dimension check could not be completed.",
      artifactRefs: []
    });
    args.edges.push({ from: args.normalizedNode.id, to: planNode.id, label: "requires-adapter" });

    return buildReceipt({
      problem: args.problem,
      normalizedProblem: args.normalizedProblem,
      createdAt: args.createdAt,
      trust: "unverified",
      summary: "Dimension check could not be completed by the local adapter.",
      nodes: args.nodes,
      edges: args.edges,
      artifacts: args.artifacts,
      findings: args.findings
    });
  }
}

function completeUniversalParityReceipt(args: {
  problem: string;
  normalizedProblem: string;
  createdAt: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
  normalizedNode: GraphNode;
  claim: UniversalParityClaim;
}): Receipt {
  const expression = parseExpression(args.claim.expressionSource);
  const searchRange = { min: -20, max: 20 };
  let counterexample: { n: number; value: string } | undefined;

  for (let n = searchRange.min; n <= searchRange.max; n += 1) {
    const value = evaluateExpression(expression, { n: Rational.integer(n) });
    const satisfied = args.claim.parity === "even" ? value.isEvenInteger() : value.isOddInteger();

    if (!satisfied) {
      counterexample = { n, value: value.toString() };
      break;
    }
  }

  const claimNode = addNode(args.nodes, args.createdAt, {
    kind: "claim",
    payload: {
      quantifier: "for all integers n",
      expression: args.claim.expressionSource,
      predicate: `is ${args.claim.parity}`
    },
    trust: counterexample ? "refuted" : "unverified",
    summary: counterexample
      ? "Universal parity claim refuted by finite counterexample search."
      : "No counterexample found in the finite search range; this is not a proof.",
    artifactRefs: []
  });
  args.edges.push({ from: args.normalizedNode.id, to: claimNode.id, label: "claims" });

  const toolNode = addNode(args.nodes, args.createdAt, {
    kind: "tool_run",
    payload: {
      adapter: "finite-counterexample-search",
      searchRange,
      exactArithmetic: true
    },
    trust: counterexample ? "refuted" : "unverified",
    summary: `Checked n in [${searchRange.min}, ${searchRange.max}] with exact rational arithmetic.`,
    artifactRefs: []
  });
  args.edges.push({ from: claimNode.id, to: toolNode.id, label: "checked-by" });

  if (counterexample) {
    const counterexampleNode = addNode(args.nodes, args.createdAt, {
      kind: "counterexample",
      payload: counterexample,
      trust: "refuted",
      summary: `At n=${counterexample.n}, the expression evaluates to ${counterexample.value}.`,
      artifactRefs: []
    });
    args.edges.push({ from: toolNode.id, to: counterexampleNode.id, label: "found" });

    return buildReceipt({
      problem: args.problem,
      normalizedProblem: args.normalizedProblem,
      createdAt: args.createdAt,
      trust: "refuted",
      summary: `Refuted: n=${counterexample.n} gives ${counterexample.value}, which is not ${args.claim.parity}.`,
      nodes: args.nodes,
      edges: args.edges,
      artifacts: args.artifacts,
      findings: args.findings
    });
  }

  args.findings.push({
    level: "warning",
    message: "Finite search found no counterexample, but Theorem Workbench did not produce a formal proof."
  });

  return buildReceipt({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    createdAt: args.createdAt,
    trust: "unverified",
    summary: "No counterexample found in local finite search; still unverified until a proof adapter checks it.",
    nodes: args.nodes,
    edges: args.edges,
    artifacts: args.artifacts,
    findings: args.findings
  });
}

function completeArithmeticReceipt(args: {
  problem: string;
  normalizedProblem: string;
  arithmeticSource: string;
  createdAt: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
  normalizedNode: GraphNode;
}): Receipt {
  const expression = parseExpression(args.arithmeticSource);
  const result = evaluateExpression(expression).toString();
  const artifact = addArtifact(args.artifacts, {
    kind: "exact-arithmetic-result",
    mimeType: "application/json",
    content: JSON.stringify(
      {
        adapter: "local-rational-arithmetic",
        expression: args.arithmeticSource,
        result
      },
      null,
      2
    )
  });

  const computationNode = addNode(args.nodes, args.createdAt, {
    kind: "computation",
    payload: {
      adapter: "local-rational-arithmetic",
      expression: args.arithmeticSource,
      result
    },
    trust: "exact-computed",
    summary: `Exact arithmetic result is ${result}.`,
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: args.normalizedNode.id, to: computationNode.id, label: "computed-by" });

  return buildReceipt({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    createdAt: args.createdAt,
    trust: "exact-computed",
    summary: `Exact result: ${result}.`,
    nodes: args.nodes,
    edges: args.edges,
    artifacts: args.artifacts,
    findings: args.findings
  });
}

function buildReceipt(args: {
  problem: string;
  normalizedProblem: string;
  createdAt: string;
  trust: TrustLabel;
  summary: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
}): Receipt {
  const runHash = stableHash({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    nodes: args.nodes.map(({ createdAt: _createdAt, ...node }) => node),
    edges: args.edges,
    artifacts: args.artifacts
  }).slice(0, 16);

  return {
    schemaVersion: "theorem.receipt.v0",
    runId: `run_${runHash}`,
    createdAt: args.createdAt,
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    trust: args.trust,
    summary: args.summary,
    replay: `theorem ask ${JSON.stringify(args.problem)} --json`,
    graph: {
      nodes: args.nodes,
      edges: args.edges
    },
    artifacts: args.artifacts,
    findings: args.findings
  };
}

function addNode(
  nodes: GraphNode[],
  createdAt: string,
  input: Omit<GraphNode, "id" | "createdAt">
): GraphNode {
  const id = `node_${stableHash(input).slice(0, 16)}`;
  const node: GraphNode = {
    id,
    createdAt,
    ...input
  };
  nodes.push(node);
  return node;
}

function addArtifact(artifacts: Artifact[], input: Omit<Artifact, "id">): Artifact {
  const artifact: Artifact = {
    id: `artifact_${stableHash(input).slice(0, 16)}`,
    ...input
  };
  artifacts.push(artifact);
  return artifact;
}

function parseUniversalParityClaim(problem: string): UniversalParityClaim | undefined {
  const match = /^for all (?:integer|integers) n,?\s+(.+?)\s+is\s+(even|odd)\.?$/i.exec(problem);
  if (!match) {
    return undefined;
  }

  return {
    expressionSource: match[1].trim(),
    parity: match[2].toLowerCase() as "even" | "odd"
  };
}

function parseArithmeticPrompt(problem: string): string | undefined {
  const computeMatch = /^(?:compute|calculate|evaluate)\s+(.+)$/i.exec(problem);
  const candidate = computeMatch ? computeMatch[1].trim() : problem;

  if (!/^[0-9\s+\-*/^()]+$/.test(candidate)) {
    return undefined;
  }

  return candidate;
}

function normalizeProblem(problem: string): string {
  return problem.trim().replace(/\s+/g, " ");
}

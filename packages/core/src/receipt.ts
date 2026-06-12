import { checkDimensionEquation, parseDimensionPrompt } from "./dimension.js";
import { evaluateExpression, expressionVariables, parseExpression } from "./expression.js";
import { evaluateIntervalPrompt, parseIntervalPrompt, type IntervalPrompt } from "./interval.js";
import { proveUniversalParity } from "./parity-proof.js";
import { Rational } from "./rational.js";
import { createArithmeticTrace } from "./arithmetic-trace.js";
import { checkSymbolicWithMaximaSync, type CasBackendCommandRunner } from "./cas-backend.js";
import { stableHash } from "./stable-hash.js";
import { summarizeSympyCheckStatus } from "./sympy-check.js";
import { parseSymbolicPrompt, runSympySync, type SymbolicPrompt } from "./sympy.js";
import type {
  Artifact,
  EvidenceEdge,
  Finding,
  GraphNode,
  NodeKind,
  PrivacyMetadata,
  Receipt,
  ReceiptEvidenceProfile,
  TrustLabel
} from "./types.js";

interface UniversalParityClaim {
  expressionSource: string;
  parity: "even" | "odd";
}

export interface CreateReceiptOptions {
  maximaCommand?: string;
  casRunner?: CasBackendCommandRunner;
}

export function createReceipt(problem: string, options: CreateReceiptOptions = {}): Receipt {
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

  const symbolicPrompt = parseSymbolicPrompt(normalizedProblem);
  if (symbolicPrompt) {
    return completeSymbolicReceipt({
      problem,
      normalizedProblem,
      symbolicPrompt,
      options,
      createdAt,
      nodes,
      edges,
      artifacts,
      findings,
      normalizedNode
    });
  }

  const intervalPrompt = parseIntervalPrompt(normalizedProblem);
  if (intervalPrompt) {
    return completeIntervalReceipt({
      problem,
      normalizedProblem,
      intervalPrompt,
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
      nextAdapters: ["lean", "z3", "rag"],
      reason: "The MVP handles exact arithmetic, finite counterexample search, modular parity checks, interval bounds, dimensional analysis, and SymPy-backed symbolic prompts."
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
    evidenceProfile: {
      kind: "unsupported",
      backends: [],
      inputs: [normalizedProblem],
      outputs: [],
      replayable: true,
      proofCheckerBacked: false,
      limitations: ["No local adapter accepted this problem yet."]
    },
    nodes,
    edges,
    artifacts,
    findings
  });
}

function completeIntervalReceipt(args: {
  problem: string;
  normalizedProblem: string;
  intervalPrompt: IntervalPrompt;
  createdAt: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
  normalizedNode: GraphNode;
}): Receipt {
  try {
    const result = evaluateIntervalPrompt(args.intervalPrompt);
    const artifact = addArtifact(args.artifacts, {
      kind: "interval-bound-result",
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2)
    });

    const toolNode = addNode(args.nodes, args.createdAt, {
      kind: "tool_run",
      payload: {
        adapter: result.adapter,
        expression: result.expression,
        variable: result.variable,
        input: result.input,
        conservative: result.conservative
      },
      trust: "bounded-numeric",
      summary: "Evaluated a conservative rational interval bound.",
      artifactRefs: [artifact.id]
    });
    args.edges.push({ from: args.normalizedNode.id, to: toolNode.id, label: "bounded-by" });

    const computationNode = addNode(args.nodes, args.createdAt, {
      kind: "computation",
      payload: result,
      trust: "bounded-numeric",
      summary: `Interval output is [${result.output.lower}, ${result.output.upper}].`,
      artifactRefs: [artifact.id]
    });
    args.edges.push({ from: toolNode.id, to: computationNode.id, label: "produced" });

    args.findings.push({
      level: "info",
      message: "Interval arithmetic is conservative: repeated variables can widen bounds, but the true value remains inside the interval under the stated assumptions."
    });

    return buildReceipt({
      problem: args.problem,
      normalizedProblem: args.normalizedProblem,
      createdAt: args.createdAt,
      trust: "bounded-numeric",
      summary: `Bounded interval result: ${result.expression} in [${result.output.lower}, ${result.output.upper}] for ${result.variable} in [${result.input.lower}, ${result.input.upper}].`,
      evidenceProfile: {
        kind: "interval-bound",
        backends: [
          {
            id: "local-rational-interval-arithmetic",
            role: "interval",
            version: "0",
            acceptedProofChecker: false
          }
        ],
        inputs: [`${result.variable} in [${result.input.lower}, ${result.input.upper}]`, result.expression],
        outputs: [`${result.expression} in [${result.output.lower}, ${result.output.upper}]`],
        replayable: true,
        proofCheckerBacked: false,
        limitations: [
          "Interval arithmetic is conservative and may widen repeated variables.",
          "A numeric bound is not a proof of a broader physical, scientific, or safety claim."
        ]
      },
      nodes: args.nodes,
      edges: args.edges,
      artifacts: args.artifacts,
      findings: args.findings
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interval arithmetic failed for an unknown reason.";
    args.findings.push({
      level: "warning",
      message
    });

    const planNode = addNode(args.nodes, args.createdAt, {
      kind: "plan",
      payload: {
        adapter: "local-rational-interval-arithmetic",
        expression: args.intervalPrompt.expressionSource,
        variable: args.intervalPrompt.variable,
        input: {
          lower: args.intervalPrompt.input.lower.toString(),
          upper: args.intervalPrompt.input.upper.toString()
        },
        reason: message,
        nextAdapters: ["arb", "mpmath", "z3"]
      },
      trust: "unverified",
      summary: "Interval bound could not be completed by the local adapter.",
      artifactRefs: []
    });
    args.edges.push({ from: args.normalizedNode.id, to: planNode.id, label: "requires-adapter" });

    return buildReceipt({
      problem: args.problem,
      normalizedProblem: args.normalizedProblem,
      createdAt: args.createdAt,
      trust: "unverified",
      summary: `Interval bound could not be completed: ${message}`,
      evidenceProfile: {
        kind: "interval-bound",
        backends: [
          {
            id: "local-rational-interval-arithmetic",
            role: "interval",
            version: "0",
            acceptedProofChecker: false
          }
        ],
        inputs: [
          `${args.intervalPrompt.variable} in [${args.intervalPrompt.input.lower}, ${args.intervalPrompt.input.upper}]`,
          args.intervalPrompt.expressionSource
        ],
        outputs: [],
        replayable: true,
        proofCheckerBacked: false,
        limitations: [message]
      },
      nodes: args.nodes,
      edges: args.edges,
      artifacts: args.artifacts,
      findings: args.findings
    });
  }
}

function completeSymbolicReceipt(args: {
  problem: string;
  normalizedProblem: string;
  symbolicPrompt: SymbolicPrompt;
  options: CreateReceiptOptions;
  createdAt: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
  normalizedNode: GraphNode;
}): Receipt {
  const result = runSympySync(args.symbolicPrompt);

  if (!result.ok) {
    args.findings.push({
      level: "warning",
      message: `SymPy adapter unavailable or failed: ${result.error}`
    });

    const planNode = addNode(args.nodes, args.createdAt, {
      kind: "plan",
      payload: {
        adapter: "local-sympy-subprocess",
        operation: args.symbolicPrompt.operation,
        expression: args.symbolicPrompt.expression,
        variable: args.symbolicPrompt.variable,
        error: result.error,
        errorType: result.errorType,
        nextAdapters: ["sympy", "sage", "lean"],
        reason: "Symbolic computation needs a local Python environment with SymPy installed."
      },
      trust: "unverified",
      summary: "Symbolic computation could not be completed by the local SymPy adapter.",
      artifactRefs: []
    });
    args.edges.push({ from: args.normalizedNode.id, to: planNode.id, label: "requires-adapter" });

    return buildReceipt({
      problem: args.problem,
      normalizedProblem: args.normalizedProblem,
      createdAt: args.createdAt,
      trust: "unverified",
      summary: `SymPy adapter could not verify this symbolic prompt: ${result.error}`,
      evidenceProfile: {
        kind: "symbolic-cas",
        backends: [
          {
            id: "local-sympy-subprocess",
            role: "cas",
            version: "unavailable",
            acceptedProofChecker: false
          }
        ],
        inputs: [args.symbolicPrompt.operation, args.symbolicPrompt.expression],
        outputs: [],
        replayable: true,
        proofCheckerBacked: false,
        limitations: [`SymPy adapter unavailable or failed: ${result.error}`]
      },
      nodes: args.nodes,
      edges: args.edges,
      artifacts: args.artifacts,
      findings: args.findings
    });
  }

  const checks = result.checks ?? [];
  const checkStatus = summarizeSympyCheckStatus(checks);
  const independentCasCheck = checkSymbolicWithMaximaSync({
    prompt: args.symbolicPrompt,
    result: result.result,
    maximaCommand: args.options.maximaCommand,
    runner: args.options.casRunner
  });
  const independentCasArtifact = addArtifact(args.artifacts, {
    kind: "independent-cas-check",
    mimeType: "application/json",
    content: JSON.stringify(independentCasCheck, null, 2)
  });
  const symbolicTrust: TrustLabel = checkStatus === "failed" || independentCasCheck.status === "failed"
    ? "unverified"
    : independentCasCheck.status === "passed"
      ? "cross-checked"
      : "exact-computed";
  const artifactPayload = {
    adapter: "local-sympy-subprocess",
    operation: result.operation,
    expression: result.expression,
    variable: result.variable,
    result: result.result,
    srepr: result.srepr,
    latex: result.latex,
    checks,
    checkStatus,
    independentCasCheckRef: independentCasArtifact.id,
    independentCasStatus: independentCasCheck.status,
    sympyVersion: result.sympyVersion,
    pythonCommand: result.pythonCommand
  };
  const artifact = addArtifact(args.artifacts, {
    kind: "symbolic-computation-result",
    mimeType: "application/json",
    content: JSON.stringify(artifactPayload, null, 2)
  });

  const toolNode = addNode(args.nodes, args.createdAt, {
    kind: "tool_run",
    payload: {
      adapter: "local-sympy-subprocess",
      operation: result.operation,
      pythonCommand: result.pythonCommand,
      sympyVersion: result.sympyVersion,
      checkStatus
    },
    trust: symbolicTrust,
    summary: `Ran SymPy ${result.operation} in a bounded local subprocess with ${checks.length} local sanity check(s).`,
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: args.normalizedNode.id, to: toolNode.id, label: "checked-by" });

  const computationNode = addNode(args.nodes, args.createdAt, {
    kind: "computation",
    payload: artifactPayload,
    trust: symbolicTrust,
    summary: `Symbolic ${result.operation} result is ${result.result}.`,
    artifactRefs: [artifact.id, independentCasArtifact.id]
  });
  args.edges.push({ from: toolNode.id, to: computationNode.id, label: "produced" });

  const independentCasNode = addNode(args.nodes, args.createdAt, {
    kind: "tool_run",
    payload: independentCasCheck,
    trust: independentCasCheck.trust,
    summary: independentCasSummary(independentCasCheck.status),
    artifactRefs: [independentCasArtifact.id]
  });
  args.edges.push({ from: computationNode.id, to: independentCasNode.id, label: "independently-checked-by" });

  args.findings.push({
    level: checkStatus === "failed" ? "warning" : "info",
    message: `Symbolic CAS output is exact computation, not a formal proof of arbitrary surrounding claims. Local sanity checks: ${checkStatus}.`
  });
  args.findings.push({
    level: "info",
    message: "SymPy sanity checks are same-engine checks using symbolic residuals and deterministic numeric samples; use a second CAS, SMT, or proof checker before stronger claims."
  });
  args.findings.push(independentCasFinding(independentCasCheck.status));

  return buildReceipt({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    createdAt: args.createdAt,
    trust: symbolicTrust,
    summary: checkStatus === "failed" || independentCasCheck.status === "failed"
      ? `SymPy ${result.operation} produced ${result.result}, but a symbolic check failed.`
      : independentCasCheck.status === "passed"
        ? `SymPy ${result.operation} result: ${result.result}; Maxima independently agreed.`
        : `SymPy ${result.operation} result: ${result.result}; local sanity checks ${checkStatus}.`,
    evidenceProfile: {
      kind: "symbolic-cas",
      backends: [
        {
          id: "local-sympy-subprocess",
          role: "cas",
          version: result.sympyVersion,
          environment: { pythonCommand: result.pythonCommand },
          acceptedProofChecker: false
        },
        {
          id: "local-maxima-symbolic-subprocess",
          role: "cas",
          version: independentCasCheck.backend.version ?? "unavailable",
          environment: {
            command: independentCasCheck.backend.command,
            status: independentCasCheck.status
          },
          acceptedProofChecker: false
        }
      ],
      inputs: [result.operation, result.expression, ...(result.variable ? [`variable=${result.variable}`] : [])],
      outputs: [
        result.result,
        `sanityChecks=${checkStatus}`,
        `independentCas=maxima:${independentCasCheck.status}`,
        ...checks.map((check) => `${check.id}:${check.status}`)
      ],
      replayable: true,
      proofCheckerBacked: false,
      limitations: [
        "CAS output is exact computation, not a formal proof of arbitrary surrounding claims.",
        "SymPy sanity checks are same-engine symbolic and numeric checks, not an independent CAS or proof-checker result.",
        independentCasLimitation(independentCasCheck.status)
      ]
    },
    nodes: args.nodes,
    edges: args.edges,
    artifacts: args.artifacts,
    findings: args.findings
  });
}

function independentCasSummary(status: string): string {
  if (status === "passed") {
    return "Maxima independently agreed with the symbolic result.";
  }

  if (status === "failed") {
    return "Maxima disagreed with the symbolic result; the claim remains unverified.";
  }

  if (status === "solver-unavailable") {
    return "Independent CAS cross-check could not run because Maxima is unavailable.";
  }

  return "Independent CAS cross-check could not produce a usable result.";
}

function independentCasFinding(status: string): Finding {
  if (status === "passed") {
    return {
      level: "info",
      message: "Independent CAS cross-check passed: Maxima agreed with the SymPy result. This supports `cross-checked`, not `proved`."
    };
  }

  if (status === "failed") {
    return {
      level: "warning",
      message: "Independent CAS cross-check failed: Maxima disagreed with the SymPy result, so the symbolic claim remains unverified."
    };
  }

  if (status === "solver-unavailable") {
    return {
      level: "info",
      message: "Independent CAS cross-check unavailable: install Maxima or set THEOREM_MAXIMA to enable a second-engine symbolic check."
    };
  }

  return {
    level: "warning",
    message: "Independent CAS cross-check errored before producing a usable agreement result."
  };
}

function independentCasLimitation(status: string): string {
  if (status === "passed") {
    return "Independent Maxima agreement supports `cross-checked`, but CAS agreement is still not proof-checker-backed proof.";
  }

  if (status === "failed") {
    return "Independent Maxima disagreement leaves the symbolic result unverified until resolved by a human, SMT encoding, proof checker, or another trusted tool.";
  }

  if (status === "solver-unavailable") {
    return "Independent CAS cross-check did not run because Maxima was unavailable.";
  }

  return "Independent CAS cross-check did not produce a parseable agreement result.";
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
        evidenceProfile: {
          kind: "dimension-analysis",
          backends: [
            {
              id: "local-dimensional-analysis",
              role: "checker",
              version: "0",
              acceptedProofChecker: false
            }
          ],
          inputs: [`${result.equation.lhs} = ${result.equation.rhs}`],
          outputs: [`left=${result.lhsText}`, `right=${result.rhsText}`],
          replayable: true,
          proofCheckerBacked: false,
          limitations: ["Dimensional mismatch refutes dimensional consistency under the local SI base-dimension table."]
        },
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
      evidenceProfile: {
        kind: "dimension-analysis",
        backends: [
          {
            id: "local-dimensional-analysis",
            role: "checker",
            version: "0",
            acceptedProofChecker: false
          }
        ],
        inputs: [`${result.equation.lhs} = ${result.equation.rhs}`],
        outputs: [`left=${result.lhsText}`, `right=${result.rhsText}`],
        replayable: true,
        proofCheckerBacked: false,
        limitations: ["Dimensional consistency is a necessary sanity check, not proof that the equation or model is physically true."]
      },
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
      evidenceProfile: {
        kind: "dimension-analysis",
        backends: [
          {
            id: "local-dimensional-analysis",
            role: "checker",
            version: "0",
            acceptedProofChecker: false
          }
        ],
        inputs: [args.dimensionSource],
        outputs: [],
        replayable: true,
        proofCheckerBacked: false,
        limitations: ["The local dimensional-analysis adapter could not parse or evaluate this equation."]
      },
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
  const unsupportedVariables = expressionVariables(expression).filter((variable) => variable !== "n");
  if (unsupportedVariables.length > 0) {
    args.findings.push({
      level: "warning",
      message: `Universal parity prompts quantify n, but the expression also used: ${unsupportedVariables.join(", ")}.`
    });

    const planNode = addNode(args.nodes, args.createdAt, {
      kind: "plan",
      payload: {
        quantifier: "for all integers n",
        expression: args.claim.expressionSource,
        unsupportedVariables,
        nextAdapters: ["lean", "z3"],
        reason: "The local universal parity checker only supports expressions over the quantified variable n."
      },
      trust: "unverified",
      summary: "Universal parity claim contains variables outside the quantifier.",
      artifactRefs: []
    });
    args.edges.push({ from: args.normalizedNode.id, to: planNode.id, label: "requires-adapter" });

    return buildReceipt({
      problem: args.problem,
      normalizedProblem: args.normalizedProblem,
      createdAt: args.createdAt,
      trust: "unverified",
      summary: "Universal parity claim contains variables outside the quantified variable n.",
      evidenceProfile: {
        kind: "universal-parity",
        backends: [
          {
            id: "local-modular-parity-checker",
            role: "checker",
            version: "0",
            acceptedProofChecker: false
          }
        ],
        inputs: [args.claim.expressionSource],
        outputs: [],
        replayable: true,
        proofCheckerBacked: false,
        limitations: ["The local parity checker only supports expressions over the quantified variable n."]
      },
      nodes: args.nodes,
      edges: args.edges,
      artifacts: args.artifacts,
      findings: args.findings
    });
  }

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

  const proofResult = counterexample
    ? undefined
    : proveUniversalParity(args.claim.expressionSource, expression, args.claim.parity);
  const claimTrust: TrustLabel = counterexample ? "refuted" : proofResult?.ok ? "exact-computed" : "unverified";
  const claimNode = addNode(args.nodes, args.createdAt, {
    kind: "claim",
    payload: {
      quantifier: "for all integers n",
      expression: args.claim.expressionSource,
      predicate: `is ${args.claim.parity}`
    },
    trust: claimTrust,
    summary: counterexample
      ? "Universal parity claim refuted by finite counterexample search."
      : proofResult?.ok
        ? "Universal parity claim checked by a narrow local modular arithmetic kernel; not proof-checker-backed."
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
      evidenceProfile: {
        kind: "universal-parity",
        backends: [
          {
            id: "finite-counterexample-search",
            role: "counterexample-search",
            version: "0",
            acceptedProofChecker: false
          },
          {
            id: "local-rational-arithmetic",
            role: "arithmetic",
            version: "0",
            acceptedProofChecker: false
          }
        ],
        inputs: [args.claim.expressionSource, `predicate=is ${args.claim.parity}`, `searchRange=${searchRange.min}..${searchRange.max}`],
        outputs: [`n=${counterexample.n}`, `value=${counterexample.value}`],
        replayable: true,
        proofCheckerBacked: false,
        limitations: ["A single exact counterexample refutes the universal parity claim."]
      },
      nodes: args.nodes,
      edges: args.edges,
      artifacts: args.artifacts,
      findings: args.findings
    });
  }

  if (proofResult?.ok) {
    const artifact = addArtifact(args.artifacts, {
      kind: "modular-parity-check-certificate",
      mimeType: "application/json",
      content: JSON.stringify(proofResult, null, 2)
    });

    const proofToolNode = addNode(args.nodes, args.createdAt, {
      kind: "tool_run",
      payload: {
        adapter: proofResult.adapter,
        theorem: proofResult.theorem,
        modulus: proofResult.modulus,
        residues: proofResult.residues
      },
      trust: "exact-computed",
      summary: "Checked both integer residue classes modulo 2 in the local parity kernel.",
      artifactRefs: [artifact.id]
    });
    args.edges.push({ from: claimNode.id, to: proofToolNode.id, label: "checked-by" });

    const certificateNode = addNode(args.nodes, args.createdAt, {
      kind: "computation",
      payload: proofResult,
      trust: "exact-computed",
      summary: proofResult.certificate,
      artifactRefs: [artifact.id]
    });
    args.edges.push({ from: proofToolNode.id, to: certificateNode.id, label: "produced" });

    args.findings.push({
      level: "warning",
      message: "The local parity kernel is intentionally narrow and is not an accepted proof-checking backend. This receipt records an exact modular check; reserve `proved` for Lean, SMT/proof-certificate, or another accepted proof checker."
    });

    return buildReceipt({
      problem: args.problem,
      normalizedProblem: args.normalizedProblem,
      createdAt: args.createdAt,
      trust: "exact-computed",
      summary: `Exact modular parity check: ${args.claim.expressionSource} is ${args.claim.parity} for both residue classes modulo 2; not proof-checker-backed.`,
      evidenceProfile: {
        kind: "universal-parity",
        backends: [
          {
            id: "finite-counterexample-search",
            role: "counterexample-search",
            version: "0",
            acceptedProofChecker: false
          },
          {
            id: proofResult.adapter,
            role: "checker",
            version: "0",
            acceptedProofChecker: false
          }
        ],
        inputs: [args.claim.expressionSource, `predicate=is ${args.claim.parity}`],
        outputs: proofResult.residues.map(
          (residue) => `n mod 2 = ${residue.nMod2}; value mod 2 = ${residue.valueMod2}`
        ),
        replayable: true,
        proofCheckerBacked: false,
        limitations: [
          "The local parity checker is intentionally narrow and not an accepted proof-checking backend.",
          "Reserve `proved` for Lean, SMT/proof-certificate, or another accepted proof checker."
        ]
      },
      nodes: args.nodes,
      edges: args.edges,
      artifacts: args.artifacts,
      findings: args.findings
    });
  }

  args.findings.push({
    level: "warning",
    message: proofResult
      ? `Finite search found no counterexample, but the local parity checker could not certify the claim: ${proofResult.reason}`
      : "Finite search found no counterexample, but Theorem Workbench did not produce proof-checker-backed evidence."
  });

  return buildReceipt({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    createdAt: args.createdAt,
    trust: "unverified",
    summary: proofResult
      ? `No counterexample found in local finite search, but the local parity checker could not certify it: ${proofResult.reason}`
      : "No counterexample found in local finite search; still unverified until a proof adapter checks it.",
    evidenceProfile: {
      kind: "universal-parity",
      backends: [
        {
          id: "finite-counterexample-search",
          role: "counterexample-search",
          version: "0",
          acceptedProofChecker: false
        },
        {
          id: "local-modular-parity-checker",
          role: "checker",
          version: "0",
          acceptedProofChecker: false
        }
      ],
      inputs: [args.claim.expressionSource, `predicate=is ${args.claim.parity}`, `searchRange=${searchRange.min}..${searchRange.max}`],
      outputs: [],
      replayable: true,
      proofCheckerBacked: false,
      limitations: [
        proofResult?.reason ?? "The current adapter did not produce proof-checker-backed evidence.",
        "Finite search without a counterexample is not proof of a universal claim."
      ]
    },
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
  const trace = createArithmeticTrace(args.arithmeticSource, expression);
  const result = trace.result;
  const traceArtifact = addArtifact(args.artifacts, {
    kind: "exact-arithmetic-trace",
    mimeType: "application/json",
    content: JSON.stringify(trace, null, 2)
  });
  const artifact = addArtifact(args.artifacts, {
    kind: "exact-arithmetic-result",
    mimeType: "application/json",
    content: JSON.stringify(
      {
        adapter: "local-rational-arithmetic",
        expression: args.arithmeticSource,
        result,
        traceRef: traceArtifact.id
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
      result,
      traceArtifactRef: traceArtifact.id
    },
    trust: "exact-computed",
    summary: `Exact arithmetic result is ${result}; machine trace has ${trace.steps.length} steps.`,
    artifactRefs: [artifact.id, traceArtifact.id]
  });
  args.edges.push({ from: args.normalizedNode.id, to: computationNode.id, label: "computed-by" });

  const lessonNode = addNode(args.nodes, args.createdAt, {
    kind: "lesson",
    payload: {
      source: "deterministic-arithmetic-trace",
      audiences: trace.explanations.map((view) => view.audience),
      traceArtifactRef: traceArtifact.id,
      caveat: "If an explanation conflicts with the trace, the trace is authoritative."
    },
    trust: "exact-computed",
    summary: "Generated audience-level explanations from the verified arithmetic trace.",
    artifactRefs: [traceArtifact.id]
  });
  args.edges.push({ from: computationNode.id, to: lessonNode.id, label: "explained-by" });

  args.findings.push({
    level: "info",
    message: "Exact arithmetic receipts include a deterministic step trace and audience-level explanations; no model-generated math is needed to explain this calculation."
  });

  return buildReceipt({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    createdAt: args.createdAt,
    trust: "exact-computed",
    summary: `Exact result: ${result}.`,
    evidenceProfile: {
      kind: "exact-arithmetic",
      backends: [
        {
          id: "local-rational-arithmetic",
          role: "arithmetic",
          version: "0",
          acceptedProofChecker: false
        }
      ],
      inputs: [args.arithmeticSource],
      outputs: [result, `traceSteps=${trace.steps.length}`],
      replayable: true,
      proofCheckerBacked: false,
      limitations: [
        "Exact arithmetic covers the parsed numeric expression, not arbitrary surrounding claims.",
        "Educational explanations are generated from the trace and should defer to the machine-readable steps."
      ]
    },
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
  evidenceProfile: ReceiptEvidenceProfile;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
}): Receipt {
  const privacy = createLocalOnlyPrivacyMetadata();
  const runHash = stableHash({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    privacy,
    evidenceProfile: args.evidenceProfile,
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
    privacy,
    evidenceProfile: args.evidenceProfile,
    graph: {
      nodes: args.nodes,
      edges: args.edges
    },
    artifacts: args.artifacts,
    findings: args.findings
  };
}

function createLocalOnlyPrivacyMetadata(): PrivacyMetadata {
  return {
    mode: "local-only",
    localFirst: true,
    networkAccess: "none",
    dataResidency: "local-workspace",
    externalDisclosures: []
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

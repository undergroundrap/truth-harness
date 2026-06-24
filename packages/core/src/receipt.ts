import { checkDimensionEquation, parseDimensionPrompt } from "./dimension.js";
import { evaluateExpression, expressionVariables, parseExpression } from "./expression.js";
import { evaluateIntervalPrompt, parseIntervalPrompt, type IntervalPrompt } from "./interval.js";
import { proveUniversalParity } from "./parity-proof.js";
import { Rational } from "./rational.js";
import { createArithmeticTrace } from "./arithmetic-trace.js";
import { checkSymbolicWithMaximaSync, type CasBackendCommandRunner } from "./cas-backend.js";
import { stableHash } from "./stable-hash.js";
import { compileSymbolicClaim, type CompiledSymbolicClaim } from "./symbolic-claim.js";
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

interface CommonDenominatorClaim {
  source: string;
  lcmArgs: [bigint, bigint];
  statedLcm: bigint;
  originalNumerator: bigint;
  originalDenominator: bigint;
  rewrittenNumerator: bigint;
  rewrittenDenominator: bigint;
}

interface ExactArithmeticEqualityClaim {
  source: string;
  leftSource: string;
  rightSource: string;
}

type IntegerComparisonOperator = ">" | ">=" | "<" | "<=" | "=";

interface IntegerInequality {
  variable: string;
  operator: IntegerComparisonOperator;
  value: bigint;
}

interface BoundedIntegerSolutionClaim {
  source: string;
  variable: string;
  constraints: IntegerInequality[];
  statedSolutions: bigint[];
  searchRange: {
    lower: bigint;
    upper: bigint;
  };
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

  const compiledSymbolicClaim = compileSymbolicClaim(normalizedProblem);
  const symbolicPrompt = parseSymbolicPrompt(normalizedProblem) ?? compiledSymbolicClaim?.prompt;
  if (symbolicPrompt) {
    return completeSymbolicReceipt({
      problem,
      normalizedProblem,
      symbolicPrompt,
      compiledSymbolicClaim,
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

  const commonDenominatorClaim = parseCommonDenominatorClaim(normalizedProblem);
  if (commonDenominatorClaim) {
    return completeCommonDenominatorReceipt({
      problem,
      normalizedProblem,
      claim: commonDenominatorClaim,
      createdAt,
      nodes,
      edges,
      artifacts,
      findings,
      normalizedNode
    });
  }

  const exactArithmeticEquality = parseExactArithmeticEqualityClaim(normalizedProblem);
  if (exactArithmeticEquality) {
    return completeExactArithmeticEqualityReceipt({
      problem,
      normalizedProblem,
      claim: exactArithmeticEquality,
      createdAt,
      nodes,
      edges,
      artifacts,
      findings,
      normalizedNode
    });
  }

  const boundedIntegerSolution = parseBoundedIntegerSolutionClaim(normalizedProblem);
  if (boundedIntegerSolution) {
    return completeBoundedIntegerSolutionReceipt({
      problem,
      normalizedProblem,
      claim: boundedIntegerSolution,
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
      reason: "The MVP handles exact arithmetic, bounded one-variable integer solution checks, finite counterexample search, modular parity checks, interval bounds, dimensional analysis, and SymPy-backed symbolic prompts."
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
  compiledSymbolicClaim?: CompiledSymbolicClaim;
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
  const expectedResultStatus = args.compiledSymbolicClaim
    ? symbolicResultMatchesExpected(result.result, args.compiledSymbolicClaim.expectedResult)
      ? "passed"
      : "failed"
    : "not-applicable";
  const expectedResultMismatched = expectedResultStatus === "failed";
  const expectedResultRefutes =
    expectedResultMismatched && checkStatus !== "failed" && independentCasCheck.status !== "failed";
  const symbolicTrust: TrustLabel = expectedResultRefutes
    ? "refuted"
    : checkStatus === "failed" || independentCasCheck.status === "failed"
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
    compiledSymbolicClaim: args.compiledSymbolicClaim,
    expectedResultStatus,
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
      checkStatus,
      expectedResultStatus
    },
    trust: symbolicTrust,
    summary: expectedResultRefutes && args.compiledSymbolicClaim
      ? `Ran SymPy ${result.operation}; expected ${args.compiledSymbolicClaim.expectedResult} but got ${result.result}.`
      : `Ran SymPy ${result.operation} in a bounded local subprocess with ${checks.length} local sanity check(s).`,
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: args.normalizedNode.id, to: toolNode.id, label: "checked-by" });

  const computationNode = addNode(args.nodes, args.createdAt, {
    kind: "computation",
    payload: artifactPayload,
    trust: symbolicTrust,
    summary: expectedResultRefutes && args.compiledSymbolicClaim
      ? `Symbolic ${result.operation} refuted the compiled claim: expected ${args.compiledSymbolicClaim.expectedResult}, got ${result.result}.`
      : `Symbolic ${result.operation} result is ${result.result}.`,
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
    level: checkStatus === "failed" || expectedResultMismatched ? "warning" : "info",
    message: expectedResultRefutes && args.compiledSymbolicClaim
      ? `Compiled symbolic claim expected ${args.compiledSymbolicClaim.expectedResult}, but the CAS result was ${result.result}; the claim is refuted inside this compiler boundary.`
      : `Symbolic CAS output is exact computation, not a formal proof of arbitrary surrounding claims. Local sanity checks: ${checkStatus}.`
  });
  if (args.compiledSymbolicClaim) {
    args.findings.push({
      level: "info",
      message: `Compiled symbolic claim boundary: ${args.compiledSymbolicClaim.boundarySummary} Expected result check: ${expectedResultStatus}.`
    });
  }
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
    summary: expectedResultRefutes && args.compiledSymbolicClaim
      ? `Compiled symbolic claim expected ${args.compiledSymbolicClaim.expectedResult}, but SymPy ${result.operation} produced ${result.result}; claim refuted inside the symbolic compiler boundary.`
      : checkStatus === "failed" || independentCasCheck.status === "failed"
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
        ...(args.compiledSymbolicClaim
          ? [
              `compiledClaim=${args.compiledSymbolicClaim.claimKind}`,
              `expectedResult=${args.compiledSymbolicClaim.expectedResult}`,
              `expectedResultCheck=${expectedResultStatus}`
            ]
          : []),
        `independentCas=maxima:${independentCasCheck.status}`,
        ...checks.map((check) => `${check.id}:${check.status}`)
      ],
      replayable: true,
      proofCheckerBacked: false,
      limitations: [
        "CAS output is exact computation, not a formal proof of arbitrary surrounding claims.",
        "SymPy sanity checks are same-engine symbolic and numeric checks, not an independent CAS or proof-checker result.",
        ...(args.compiledSymbolicClaim
          ? [`Compiled claim boundary: ${args.compiledSymbolicClaim.boundarySummary}`]
          : []),
        independentCasLimitation(independentCasCheck.status)
      ]
    },
    nodes: args.nodes,
    edges: args.edges,
    artifacts: args.artifacts,
    findings: args.findings
  });
}

function symbolicResultMatchesExpected(result: string, expectedResult: string): boolean {
  return normalizeSymbolicResult(result) === normalizeSymbolicResult(expectedResult);
}

function normalizeSymbolicResult(value: string): string {
  return value.replace(/\s+/gu, "").replace(/^\+/u, "");
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
      message: "Independent CAS cross-check unavailable: install Maxima or set TRUTH_HARNESS_MAXIMA to enable a second-engine symbolic check."
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
        claim: proofResult.claim,
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
      : "Finite search found no counterexample, but Truth Harness did not produce proof-checker-backed evidence."
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

function completeCommonDenominatorReceipt(args: {
  problem: string;
  normalizedProblem: string;
  claim: CommonDenominatorClaim;
  createdAt: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
  normalizedNode: GraphNode;
}): Receipt {
  const computedLcm = lcm(args.claim.lcmArgs[0], args.claim.lcmArgs[1]);
  const sourceFraction = new Rational(args.claim.originalNumerator, args.claim.originalDenominator);
  const rewrittenFraction = new Rational(args.claim.rewrittenNumerator, args.claim.rewrittenDenominator);
  const lcmMatches = computedLcm === args.claim.statedLcm;
  const denominatorMatchesLcm = args.claim.rewrittenDenominator === args.claim.statedLcm;
  const originalDenominatorIsLcmInput =
    args.claim.originalDenominator === args.claim.lcmArgs[0] || args.claim.originalDenominator === args.claim.lcmArgs[1];
  const multiplier = args.claim.originalDenominator !== 0n && args.claim.statedLcm % args.claim.originalDenominator === 0n
    ? args.claim.statedLcm / args.claim.originalDenominator
    : undefined;
  const numeratorRewriteMatches = multiplier !== undefined && args.claim.rewrittenNumerator === args.claim.originalNumerator * multiplier;
  const fractionsEqual = sourceFraction.compare(rewrittenFraction) === 0;
  const valid =
    lcmMatches &&
    denominatorMatchesLcm &&
    originalDenominatorIsLcmInput &&
    numeratorRewriteMatches &&
    fractionsEqual;
  const trust: TrustLabel = valid ? "exact-computed" : "refuted";
  const checks = [
    {
      id: "lcm",
      ok: lcmMatches,
      expected: computedLcm.toString(),
      observed: args.claim.statedLcm.toString()
    },
    {
      id: "denominator-target",
      ok: denominatorMatchesLcm,
      expected: args.claim.statedLcm.toString(),
      observed: args.claim.rewrittenDenominator.toString()
    },
    {
      id: "original-denominator-is-lcm-input",
      ok: originalDenominatorIsLcmInput,
      expected: args.claim.lcmArgs.map((value) => value.toString()).join(","),
      observed: args.claim.originalDenominator.toString()
    },
    {
      id: "numerator-rewrite",
      ok: numeratorRewriteMatches,
      expected: multiplier === undefined ? "integer multiplier required" : (args.claim.originalNumerator * multiplier).toString(),
      observed: args.claim.rewrittenNumerator.toString()
    },
    {
      id: "fraction-equality",
      ok: fractionsEqual,
      expected: sourceFraction.toString(),
      observed: rewrittenFraction.toString()
    }
  ];
  const certificate = {
    schemaVersion: "truth-harness.common-denominator.v0",
    adapter: "local-rational-arithmetic",
    source: args.claim.source,
    lcm: {
      inputs: args.claim.lcmArgs.map((value) => value.toString()),
      computed: computedLcm.toString(),
      stated: args.claim.statedLcm.toString()
    },
    rewrite: {
      from: `${args.claim.originalNumerator.toString()}/${args.claim.originalDenominator.toString()}`,
      to: `${args.claim.rewrittenNumerator.toString()}/${args.claim.rewrittenDenominator.toString()}`,
      multiplier: multiplier?.toString() ?? null
    },
    checks,
    verdict: valid ? "accepted" : "refuted"
  };
  const artifact = addArtifact(args.artifacts, {
    kind: "common-denominator-certificate",
    mimeType: "application/json",
    content: JSON.stringify(certificate, null, 2)
  });

  const toolNode = addNode(args.nodes, args.createdAt, {
    kind: "tool_run",
    payload: {
      adapter: "local-rational-arithmetic",
      operation: "common-denominator-check",
      checkCount: checks.length
    },
    trust,
    summary: "Checked a concrete common-denominator rewrite with exact integer and rational arithmetic.",
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: args.normalizedNode.id, to: toolNode.id, label: "checked-by" });

  const computationNode = addNode(args.nodes, args.createdAt, {
    kind: valid ? "computation" : "counterexample",
    payload: certificate,
    trust,
    summary: valid
      ? `${args.claim.originalNumerator.toString()}/${args.claim.originalDenominator.toString()} rewrites to ${args.claim.rewrittenNumerator.toString()}/${args.claim.rewrittenDenominator.toString()} using denominator ${args.claim.statedLcm.toString()}.`
      : `Concrete arithmetic refuted at least one common-denominator check: ${checks.filter((check) => !check.ok).map((check) => check.id).join(", ")}.`,
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: toolNode.id, to: computationNode.id, label: valid ? "produced" : "refuted" });

  args.findings.push({
    level: valid ? "info" : "warning",
    message: valid
      ? "The common-denominator lemma was checked by exact local arithmetic. This earns exact-computed, not proved."
      : "The common-denominator lemma matched the local checker but failed at least one exact arithmetic check."
  });

  return buildReceipt({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    createdAt: args.createdAt,
    trust,
    summary: valid
      ? `Exact common-denominator result: lcm(${args.claim.lcmArgs[0].toString()},${args.claim.lcmArgs[1].toString()}) = ${computedLcm.toString()} and ${sourceFraction.toString()} = ${rewrittenFraction.toString()}.`
      : `Refuted common-denominator statement: failed checks ${checks.filter((check) => !check.ok).map((check) => check.id).join(", ")}.`,
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
      inputs: [args.claim.source],
      outputs: valid
        ? [`lcm=${computedLcm.toString()}`, `${sourceFraction.toString()}=${rewrittenFraction.toString()}`, "checks=passed"]
        : checks.filter((check) => !check.ok).map((check) => `${check.id}=failed`),
      replayable: true,
      proofCheckerBacked: false,
      limitations: [
        "This adapter only checks a concrete lcm/equivalent-fraction rewrite pattern.",
        "It is exact arithmetic evidence, not a formal proof-checker-backed theorem."
      ]
    },
    nodes: args.nodes,
    edges: args.edges,
    artifacts: args.artifacts,
    findings: args.findings
  });
}

function completeExactArithmeticEqualityReceipt(args: {
  problem: string;
  normalizedProblem: string;
  claim: ExactArithmeticEqualityClaim;
  createdAt: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
  normalizedNode: GraphNode;
}): Receipt {
  const leftExpression = parseExpression(args.claim.leftSource);
  const rightExpression = parseExpression(args.claim.rightSource);
  const leftTrace = createArithmeticTrace(args.claim.leftSource, leftExpression);
  const rightTrace = createArithmeticTrace(args.claim.rightSource, rightExpression);
  const leftValue = rationalFromTraceResult(leftTrace.result);
  const rightValue = rationalFromTraceResult(rightTrace.result);
  const valid = leftValue.compare(rightValue) === 0;
  const trust: TrustLabel = valid ? "exact-computed" : "refuted";
  const certificate = {
    schemaVersion: "truth-harness.exact-arithmetic-equality.v0",
    adapter: "local-rational-arithmetic",
    source: args.claim.source,
    left: {
      expression: args.claim.leftSource,
      result: leftTrace.result,
      trace: leftTrace
    },
    right: {
      expression: args.claim.rightSource,
      result: rightTrace.result,
      trace: rightTrace
    },
    checks: [
      {
        id: "exact-rational-equality",
        ok: valid,
        left: leftValue.toString(),
        right: rightValue.toString()
      }
    ],
    verdict: valid ? "accepted" : "refuted"
  };
  const artifact = addArtifact(args.artifacts, {
    kind: "exact-arithmetic-equality-certificate",
    mimeType: "application/json",
    content: JSON.stringify(certificate, null, 2)
  });

  const toolNode = addNode(args.nodes, args.createdAt, {
    kind: "tool_run",
    payload: {
      adapter: "local-rational-arithmetic",
      operation: "exact-arithmetic-equality",
      leftTraceSteps: leftTrace.steps.length,
      rightTraceSteps: rightTrace.steps.length
    },
    trust,
    summary: "Checked a concrete arithmetic equality with exact rational arithmetic.",
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: args.normalizedNode.id, to: toolNode.id, label: "checked-by" });

  const resultNode = addNode(args.nodes, args.createdAt, {
    kind: valid ? "computation" : "counterexample",
    payload: certificate,
    trust,
    summary: valid
      ? `Both sides reduce exactly to ${leftValue.toString()}.`
      : `Left side reduces to ${leftValue.toString()}, while right side reduces to ${rightValue.toString()}.`,
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: toolNode.id, to: resultNode.id, label: valid ? "produced" : "refuted" });

  args.findings.push({
    level: valid ? "info" : "warning",
    message: valid
      ? "The equality was checked by exact local rational arithmetic. This earns exact-computed, not proved."
      : "The equality matched the exact arithmetic checker and was refuted by evaluating both sides."
  });

  return buildReceipt({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    createdAt: args.createdAt,
    trust,
    summary: valid
      ? `Exact equality result: both sides equal ${leftValue.toString()}.`
      : `Refuted exact equality: left side is ${leftValue.toString()}, right side is ${rightValue.toString()}.`,
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
      inputs: [args.claim.leftSource, args.claim.rightSource],
      outputs: [
        `left=${leftValue.toString()}`,
        `right=${rightValue.toString()}`,
        valid ? "equality=passed" : "equality=failed",
        `leftTraceSteps=${leftTrace.steps.length}`,
        `rightTraceSteps=${rightTrace.steps.length}`
      ],
      replayable: true,
      proofCheckerBacked: false,
      limitations: [
        "This adapter only checks concrete arithmetic equalities parsed by the local rational arithmetic grammar.",
        "Exact arithmetic equality is deterministic computation, not a formal proof-checker-backed theorem."
      ]
    },
    nodes: args.nodes,
    edges: args.edges,
    artifacts: args.artifacts,
    findings: args.findings
  });
}

function completeBoundedIntegerSolutionReceipt(args: {
  problem: string;
  normalizedProblem: string;
  claim: BoundedIntegerSolutionClaim;
  createdAt: string;
  nodes: GraphNode[];
  edges: EvidenceEdge[];
  artifacts: Artifact[];
  findings: Finding[];
  normalizedNode: GraphNode;
}): Receipt {
  const computedSolutions = enumerateBoundedIntegerSolutions(args.claim);
  const statedSolutions = uniqueSortedBigints(args.claim.statedSolutions);
  const missingSolutions = computedSolutions.filter((solution) => !statedSolutions.includes(solution));
  const extraSolutions = statedSolutions.filter((solution) => !computedSolutions.includes(solution));
  const valid = missingSolutions.length === 0 && extraSolutions.length === 0;
  const trust: TrustLabel = valid ? "exact-computed" : "refuted";
  const renderedVariableSolutions = (solutions: bigint[]): string =>
    solutions.length > 0 ? solutions.map((solution) => `${args.claim.variable}=${solution.toString()}`).join(", ") : "none";
  const checks = [
    {
      id: "bounded-domain",
      ok: true,
      expected: "finite explicit integer bounds",
      observed: `${args.claim.variable} in [${args.claim.searchRange.lower.toString()}, ${args.claim.searchRange.upper.toString()}]`
    },
    {
      id: "solution-set",
      ok: valid,
      expected: renderedVariableSolutions(computedSolutions),
      observed: renderedVariableSolutions(statedSolutions)
    }
  ];
  const certificate = {
    schemaVersion: "truth-harness.bounded-integer-solution.v0",
    adapter: "local-bounded-integer-enumerator",
    source: args.claim.source,
    domain: "integers",
    variable: args.claim.variable,
    constraints: args.claim.constraints.map((constraint) => ({
      variable: constraint.variable,
      operator: constraint.operator,
      value: constraint.value.toString()
    })),
    searchRange: {
      lower: args.claim.searchRange.lower.toString(),
      upper: args.claim.searchRange.upper.toString()
    },
    statedSolutions: statedSolutions.map((solution) => solution.toString()),
    computedSolutions: computedSolutions.map((solution) => solution.toString()),
    missingSolutions: missingSolutions.map((solution) => solution.toString()),
    extraSolutions: extraSolutions.map((solution) => solution.toString()),
    checks,
    trace: computedSolutions.map((solution) => `${args.claim.variable}=${solution.toString()} satisfies every constraint.`),
    verdict: valid ? "accepted" : "refuted"
  };
  const artifact = addArtifact(args.artifacts, {
    kind: "bounded-integer-solution-certificate",
    mimeType: "application/json",
    content: JSON.stringify(certificate, null, 2)
  });

  const claimNode = addNode(args.nodes, args.createdAt, {
    kind: "claim",
    payload: {
      domain: "integers",
      variable: args.claim.variable,
      constraints: certificate.constraints,
      statedSolutions: certificate.statedSolutions
    },
    trust,
    summary: valid
      ? "Bounded one-variable integer solution-set claim matched exact enumeration."
      : "Bounded one-variable integer solution-set claim disagreed with exact enumeration.",
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: args.normalizedNode.id, to: claimNode.id, label: "claims" });

  const toolNode = addNode(args.nodes, args.createdAt, {
    kind: "tool_run",
    payload: {
      adapter: "local-bounded-integer-enumerator",
      domain: "integers",
      variable: args.claim.variable,
      searchRange: certificate.searchRange,
      exactArithmetic: true
    },
    trust,
    summary: `Enumerated ${args.claim.variable} in [${args.claim.searchRange.lower.toString()}, ${args.claim.searchRange.upper.toString()}] with exact integer comparisons.`,
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: claimNode.id, to: toolNode.id, label: "checked-by" });

  const resultNode = addNode(args.nodes, args.createdAt, {
    kind: valid ? "computation" : "counterexample",
    payload: certificate,
    trust,
    summary: valid
      ? `Computed exact integer solutions: ${renderedVariableSolutions(computedSolutions)}.`
      : `Computed ${renderedVariableSolutions(computedSolutions)}; stated ${renderedVariableSolutions(statedSolutions)}.`,
    artifactRefs: [artifact.id]
  });
  args.edges.push({ from: toolNode.id, to: resultNode.id, label: valid ? "produced" : "refuted" });

  args.findings.push({
    level: valid ? "info" : "warning",
    message: valid
      ? "The bounded integer solution-set claim was checked by exact finite enumeration. This earns exact-computed, not proved."
      : "The bounded integer solution-set claim is refuted by exact finite enumeration of the stated integer domain."
  });

  return buildReceipt({
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    createdAt: args.createdAt,
    trust,
    summary: valid
      ? `Exact bounded integer result: the solutions are ${renderedVariableSolutions(computedSolutions)}.`
      : `Refuted bounded integer solution claim: computed ${renderedVariableSolutions(computedSolutions)}, stated ${renderedVariableSolutions(statedSolutions)}.`,
    evidenceProfile: {
      kind: "exact-arithmetic",
      backends: [
        {
          id: "local-bounded-integer-enumerator",
          role: "checker",
          version: "0",
          acceptedProofChecker: false
        }
      ],
      inputs: [
        args.claim.source,
        `${args.claim.variable} in [${args.claim.searchRange.lower.toString()}, ${args.claim.searchRange.upper.toString()}]`
      ],
      outputs: valid
        ? [`solutions=${renderedVariableSolutions(computedSolutions)}`, "checks=passed"]
        : [
            `computed=${renderedVariableSolutions(computedSolutions)}`,
            `stated=${renderedVariableSolutions(statedSolutions)}`,
            `missing=${renderedVariableSolutions(missingSolutions)}`,
            `extra=${renderedVariableSolutions(extraSolutions)}`
          ],
      replayable: true,
      proofCheckerBacked: false,
      limitations: [
        "This adapter only checks explicitly bounded, one-variable integer inequality solution-set claims.",
        "Exact finite enumeration is deterministic computation, not an accepted proof-checker-backed theorem."
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
    schemaVersion: "truth-harness.receipt.v0",
    runId: `run_${runHash}`,
    createdAt: args.createdAt,
    problem: args.problem,
    normalizedProblem: args.normalizedProblem,
    trust: args.trust,
    summary: args.summary,
    replay: `truth-harness ask ${JSON.stringify(args.problem)} --json`,
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
  const match = /^for (?:all integers?|every integer) n,?\s+(.+?)\s+is\s+(even|odd)\.?$/i.exec(problem);
  if (!match) {
    return undefined;
  }

  return {
    expressionSource: match[1].trim(),
    parity: match[2].toLowerCase() as "even" | "odd"
  };
}

function parseBoundedIntegerSolutionClaim(problem: string): BoundedIntegerSolutionClaim | undefined {
  const candidate = latexToReadableMath(problem)
    .replace(/^(?:verify|check|show)\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\.$/u, "");
  const match = /^(?:the\s+)?integer constraints (?<constraints>.+?) have exactly (?:the )?solutions? (?<solutions>.+)$/iu.exec(candidate);
  const constraintText = match?.groups?.constraints?.trim();
  const solutionText = match?.groups?.solutions?.trim();
  if (!constraintText || !solutionText) {
    return undefined;
  }

  const constraints = parseIntegerInequalities(constraintText);
  if (!constraints || constraints.length === 0) {
    return undefined;
  }

  const variable = constraints[0]?.variable;
  if (!variable || constraints.some((constraint) => constraint.variable !== variable)) {
    return undefined;
  }

  const statedSolutions = parseIntegerSolutionList(solutionText, variable);
  if (!statedSolutions || statedSolutions.length === 0) {
    return undefined;
  }

  const searchRange = boundedIntegerSearchRange(constraints);
  if (!searchRange) {
    return undefined;
  }

  return {
    source: candidate,
    variable,
    constraints,
    statedSolutions,
    searchRange
  };
}

function parseIntegerInequalities(source: string): IntegerInequality[] | undefined {
  const parts = source
    .split(/\s+(?:and)\s+|,/iu)
    .map((part) => part.trim())
    .filter(Boolean);
  const constraints: IntegerInequality[] = [];

  for (const part of parts) {
    const match = /^([a-z])\s*(<=|>=|<|>|=)\s*(-?\d+)$/iu.exec(part);
    if (!match) {
      return undefined;
    }
    constraints.push({
      variable: match[1].toLowerCase(),
      operator: match[2] as IntegerComparisonOperator,
      value: BigInt(match[3])
    });
  }

  return constraints;
}

function parseIntegerSolutionList(source: string, variable: string): bigint[] | undefined {
  const parts = source
    .replace(/\.$/u, "")
    .split(/\s*(?:,|and)\s*/iu)
    .map((part) => part.trim())
    .filter(Boolean);
  const solutions: bigint[] = [];

  for (const part of parts) {
    const match = /^([a-z])\s*=\s*(-?\d+)$/iu.exec(part);
    if (!match || match[1].toLowerCase() !== variable) {
      return undefined;
    }
    solutions.push(BigInt(match[2]));
  }

  return solutions;
}

function boundedIntegerSearchRange(
  constraints: IntegerInequality[]
): BoundedIntegerSolutionClaim["searchRange"] | undefined {
  let lower: bigint | undefined;
  let upper: bigint | undefined;

  for (const constraint of constraints) {
    if (constraint.operator === ">") {
      lower = maxBigint(lower, constraint.value + 1n);
      continue;
    }
    if (constraint.operator === ">=") {
      lower = maxBigint(lower, constraint.value);
      continue;
    }
    if (constraint.operator === "<") {
      upper = minBigint(upper, constraint.value - 1n);
      continue;
    }
    if (constraint.operator === "<=") {
      upper = minBigint(upper, constraint.value);
      continue;
    }
    lower = maxBigint(lower, constraint.value);
    upper = minBigint(upper, constraint.value);
  }

  if (lower === undefined || upper === undefined) {
    return undefined;
  }

  if (upper - lower > 10000n) {
    return undefined;
  }

  return { lower, upper };
}

function enumerateBoundedIntegerSolutions(claim: BoundedIntegerSolutionClaim): bigint[] {
  const solutions: bigint[] = [];
  for (let value = claim.searchRange.lower; value <= claim.searchRange.upper; value += 1n) {
    if (claim.constraints.every((constraint) => integerConstraintSatisfied(value, constraint))) {
      solutions.push(value);
    }
  }
  return solutions;
}

function integerConstraintSatisfied(value: bigint, constraint: IntegerInequality): boolean {
  switch (constraint.operator) {
    case ">":
      return value > constraint.value;
    case ">=":
      return value >= constraint.value;
    case "<":
      return value < constraint.value;
    case "<=":
      return value <= constraint.value;
    case "=":
      return value === constraint.value;
  }
}

function uniqueSortedBigints(values: bigint[]): bigint[] {
  return Array.from(new Set(values.map((value) => value.toString())))
    .map((value) => BigInt(value))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function maxBigint(current: bigint | undefined, candidate: bigint): bigint {
  return current === undefined || candidate > current ? candidate : current;
}

function minBigint(current: bigint | undefined, candidate: bigint): bigint {
  return current === undefined || candidate < current ? candidate : current;
}

function parseArithmeticPrompt(problem: string): string | undefined {
  const computeMatch = /^(?:compute|calculate|evaluate)\s+(.+)$/i.exec(problem);
  const candidate = computeMatch ? computeMatch[1].trim() : problem;

  if (!/^[0-9\s+\-*/^()]+$/.test(candidate)) {
    return undefined;
  }

  return candidate;
}

function parseCommonDenominatorClaim(problem: string): CommonDenominatorClaim | undefined {
  const candidate = latexToReadableMath(problem)
    .replace(/^(?:verify|check|show)\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const lcmMatch = /\blcm\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*=\s*(-?\d+)/iu.exec(candidate);
  const fractionMatch = /(-?\d+)\s*\/\s*(\d+)\s*=\s*(-?\d+)\s*\/\s*(\d+)/u.exec(candidate);

  if (!lcmMatch || !fractionMatch) {
    return undefined;
  }

  const lcmArgs: [bigint, bigint] = [BigInt(lcmMatch[1]), BigInt(lcmMatch[2])];
  const statedLcm = BigInt(lcmMatch[3]);
  const originalDenominator = BigInt(fractionMatch[2]);
  const rewrittenDenominator = BigInt(fractionMatch[4]);

  if (lcmArgs[0] <= 0n || lcmArgs[1] <= 0n || statedLcm <= 0n || originalDenominator <= 0n || rewrittenDenominator <= 0n) {
    return undefined;
  }

  return {
    source: candidate,
    lcmArgs,
    statedLcm,
    originalNumerator: BigInt(fractionMatch[1]),
    originalDenominator,
    rewrittenNumerator: BigInt(fractionMatch[3]),
    rewrittenDenominator
  };
}

function parseExactArithmeticEqualityClaim(problem: string): ExactArithmeticEqualityClaim | undefined {
  const candidate = latexToReadableMath(problem)
    .replace(/^(?:verify|check|show)\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const parts = candidate.split("=");
  if (parts.length !== 2) {
    return undefined;
  }

  const leftSource = parts[0]?.trim();
  const rightSource = parts[1]?.trim();
  if (!leftSource || !rightSource || !isExactArithmeticExpressionSource(leftSource) || !isExactArithmeticExpressionSource(rightSource)) {
    return undefined;
  }

  return {
    source: candidate,
    leftSource,
    rightSource
  };
}

function isExactArithmeticExpressionSource(value: string): boolean {
  return /^[0-9\s+\-*/^()]+$/u.test(value);
}

function rationalFromTraceResult(value: string): Rational {
  const separator = value.indexOf("/");
  if (separator < 0) {
    return new Rational(value);
  }

  return new Rational(value.slice(0, separator), value.slice(separator + 1));
}

function latexToReadableMath(value: string): string {
  return value
    .replace(/\\operatorname\{([^{}]+)\}/gu, "$1")
    .replace(/\\frac\{(-?\d+)\}\{(-?\d+)\}/gu, "$1/$2")
    .replace(/\\[,;:! ]/gu, " ")
    .replace(/\\/gu, " ");
}

function lcm(left: bigint, right: bigint): bigint {
  return (abs(left) / gcd(abs(left), abs(right))) * abs(right);
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;

  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a === 0n ? 1n : a;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function normalizeProblem(problem: string): string {
  return problem.trim().replace(/\s+/g, " ");
}

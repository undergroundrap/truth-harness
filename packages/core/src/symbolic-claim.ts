import type { SymbolicPrompt } from "./sympy.js";

export type SymbolicClaimKind = "trig-pythagorean-identity" | "polynomial-identity";

export type SymbolicClaimCompilerContractId =
  | "symbolic.trig-pythagorean.v1"
  | "symbolic.polynomial-identity-residual.v1";

export interface SymbolicClaimCompilerContract {
  contractId: SymbolicClaimCompilerContractId;
  claimKind: SymbolicClaimKind;
  label: string;
  supportedClaimShape: string;
  verifierEngine: "sympy";
  verifierOperation: SymbolicPrompt["operation"];
  expectedResult: string;
  expectedResultMeaning: string;
  runNextAction: string;
  refusalBoundary: readonly string[];
}

export interface CompiledSymbolicClaim {
  contractId: SymbolicClaimCompilerContractId;
  contractLabel: string;
  claimKind: SymbolicClaimKind;
  prompt: SymbolicPrompt;
  expectedResult: string;
  expectedResultMeaning: string;
  boundarySummary: string;
  runNextAction: string;
  refusalBoundary: readonly string[];
}

const SYMBOLIC_CLAIM_COMPILER_CONTRACTS = [
  {
    contractId: "symbolic.trig-pythagorean.v1",
    claimKind: "trig-pythagorean-identity",
    label: "Pythagorean trigonometric identity",
    supportedClaimShape: "For real x, sin(x)^2 + cos(x)^2 = 1",
    verifierEngine: "sympy",
    verifierOperation: "simplify",
    expectedResult: "1",
    expectedResultMeaning: "The supported left-hand side simplifies exactly to 1.",
    runNextAction: "truth-harness verify <claim> --write --json",
    refusalBoundary: [
      "Only the sin^2(x)+cos^2(x)=1 identity over a single real variable is recognized.",
      "Altered right-hand sides, other variables, broader trigonometric identities, and theorem-style generalizations stay outside this compiler.",
      "CAS agreement can support exact-computed or cross-checked, but not proved."
    ]
  },
  {
    contractId: "symbolic.polynomial-identity-residual.v1",
    claimKind: "polynomial-identity",
    label: "One-variable polynomial identity residual",
    supportedClaimShape: "For all real x, <polynomial in x> = <polynomial in x>",
    verifierEngine: "sympy",
    verifierOperation: "simplify",
    expectedResult: "0",
    expectedResultMeaning: "The residual (left) - (right) must simplify exactly to 0.",
    runNextAction: "truth-harness verify <claim> --write --json",
    refusalBoundary: [
      "Only one-letter, one-variable polynomial expressions are compiled.",
      "Division, domain exclusions, functions, multiple variables, quantifier changes, and theorem-style claims stay outside this compiler.",
      "A nonzero residual can refute the compiled identity only when local sanity checks do not fail."
    ]
  }
] as const satisfies readonly SymbolicClaimCompilerContract[];

export function listSymbolicClaimCompilerContracts(): SymbolicClaimCompilerContract[] {
  return SYMBOLIC_CLAIM_COMPILER_CONTRACTS.map((contract) => ({
    ...contract,
    refusalBoundary: [...contract.refusalBoundary]
  }));
}

export function compileSymbolicClaim(problem: string): CompiledSymbolicClaim | undefined {
  const readable = readableSymbolicClaim(problem);
  const canonical = canonicalSymbolicClaim(problem);

  if (
    /^(?:forrealx|forallrealx|foreveryrealx)(?:sin\(x\)\^2\+cos\(x\)\^2|cos\(x\)\^2\+sin\(x\)\^2)=1$/u.test(
      canonical
    )
  ) {
    const contract = compilerContract("symbolic.trig-pythagorean.v1");
    return {
      ...compiledContractFields(contract),
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      }
    };
  }

  const polynomialIdentity = parsePolynomialIdentity(readable);
  if (polynomialIdentity) {
    return polynomialIdentity;
  }

  return undefined;
}

export function isCompiledSymbolicClaim(problem: string): boolean {
  return compileSymbolicClaim(problem) !== undefined;
}

function compiledContractFields(contract: SymbolicClaimCompilerContract): Omit<CompiledSymbolicClaim, "prompt"> {
  return {
    contractId: contract.contractId,
    contractLabel: contract.label,
    claimKind: contract.claimKind,
    expectedResult: contract.expectedResult,
    expectedResultMeaning: contract.expectedResultMeaning,
    boundarySummary: `${contract.supportedClaimShape}; ${contract.expectedResultMeaning}`,
    runNextAction: contract.runNextAction,
    refusalBoundary: contract.refusalBoundary
  };
}

function compilerContract(contractId: SymbolicClaimCompilerContractId): SymbolicClaimCompilerContract {
  const contract = SYMBOLIC_CLAIM_COMPILER_CONTRACTS.find((candidate) => candidate.contractId === contractId);
  if (!contract) {
    throw new Error(`Missing symbolic claim compiler contract: ${contractId}`);
  }
  return contract;
}

function parsePolynomialIdentity(problem: string): CompiledSymbolicClaim | undefined {
  const match = /^(?:for\s+(?:all|every)\s+real|for\s+real)\s+([a-z])\s*,?\s+(.+?)\s*=\s*(.+)$/u.exec(
    problem
  );
  if (!match) {
    return undefined;
  }

  const variable = match[1];
  const left = normalizeExpressionSide(match[2] ?? "");
  const right = normalizeExpressionSide(match[3] ?? "");
  if (!variable || !isSafePolynomialExpression(left, variable) || !isSafePolynomialExpression(right, variable)) {
    return undefined;
  }

  const contract = compilerContract("symbolic.polynomial-identity-residual.v1");
  return {
    ...compiledContractFields(contract),
    prompt: {
      operation: "simplify",
      expression: `(${left}) - (${right})`,
      variable
    }
  };
}

function isSafePolynomialExpression(expression: string, variable: string): boolean {
  if (!expression || expression.includes("/") || expression.includes("=") || !/^[a-z0-9+\-*^().\s]+$/u.test(expression)) {
    return false;
  }

  const identifiers = expression.match(/[a-z]+/gu) ?? [];
  return identifiers.every((identifier) => identifier === variable);
}

function normalizeExpressionSide(value: string): string {
  return value.replace(/[,.;:]+$/gu, "").trim();
}

function canonicalSymbolicClaim(problem: string): string {
  return readableSymbolicClaim(problem)
    .toLowerCase()
    .replace(/\bsin\s*\^\s*2\s*\(\s*x\s*\)/gu, "sin(x)^2")
    .replace(/\bcos\s*\^\s*2\s*\(\s*x\s*\)/gu, "cos(x)^2")
    .replace(/\s+/gu, "")
    .replace(/[,.;:]+$/gu, "")
    .replace(/,/gu, "");
}

function readableSymbolicClaim(problem: string): string {
  return latexToReadableMath(problem)
    .toLowerCase()
    .replace(/^(?:show that|verify|check|show)\s+/u, "")
    .replace(/\breal numbers?\b/gu, "real")
    .replace(/\s+/gu, " ")
    .replace(/[,.;:]+$/gu, "")
    .trim();
}

function latexToReadableMath(value: string): string {
  return value
    .replace(/\\operatorname\{([^{}]+)\}/gu, "$1")
    .replace(/\\frac\{(-?\d+)\}\{(-?\d+)\}/gu, "$1/$2")
    .replace(/\\[,;:! ]/gu, " ")
    .replace(/\\/gu, " ");
}

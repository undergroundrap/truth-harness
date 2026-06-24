import type { SymbolicPrompt } from "./sympy.js";

export interface CompiledSymbolicClaim {
  claimKind: "trig-pythagorean-identity" | "polynomial-identity";
  prompt: SymbolicPrompt;
  expectedResult: string;
  boundarySummary: string;
}

export function compileSymbolicClaim(problem: string): CompiledSymbolicClaim | undefined {
  const readable = readableSymbolicClaim(problem);
  const canonical = canonicalSymbolicClaim(problem);

  if (
    /^(?:forrealx|forallrealx|foreveryrealx)(?:sin\(x\)\^2\+cos\(x\)\^2|cos\(x\)\^2\+sin\(x\)\^2)=1$/u.test(
      canonical
    )
  ) {
    return {
      claimKind: "trig-pythagorean-identity",
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      expectedResult: "1",
      boundarySummary: "Pythagorean trigonometric identity over a real variable."
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

  return {
    claimKind: "polynomial-identity",
    prompt: {
      operation: "simplify",
      expression: `(${left}) - (${right})`,
      variable
    },
    expectedResult: "0",
    boundarySummary: "One-variable polynomial identity over a real variable; the residual must simplify to 0."
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

import type { SymbolicPrompt } from "./sympy.js";

export interface CompiledSymbolicClaim {
  claimKind: "trig-pythagorean-identity";
  prompt: SymbolicPrompt;
  expectedResult: string;
  boundarySummary: string;
}

export function compileSymbolicClaim(problem: string): CompiledSymbolicClaim | undefined {
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

  return undefined;
}

export function isCompiledSymbolicClaim(problem: string): boolean {
  return compileSymbolicClaim(problem) !== undefined;
}

function canonicalSymbolicClaim(problem: string): string {
  return latexToReadableMath(problem)
    .toLowerCase()
    .replace(/^(?:show that|verify|check|show)\s+/u, "")
    .replace(/\breal numbers?\b/gu, "real")
    .replace(/\bsin\s*\^\s*2\s*\(\s*x\s*\)/gu, "sin(x)^2")
    .replace(/\bcos\s*\^\s*2\s*\(\s*x\s*\)/gu, "cos(x)^2")
    .replace(/\s+/gu, "")
    .replace(/[,.;:]+$/gu, "")
    .replace(/,/gu, "");
}

function latexToReadableMath(value: string): string {
  return value
    .replace(/\\operatorname\{([^{}]+)\}/gu, "$1")
    .replace(/\\frac\{(-?\d+)\}\{(-?\d+)\}/gu, "$1/$2")
    .replace(/\\[,;:! ]/gu, " ")
    .replace(/\\/gu, " ");
}

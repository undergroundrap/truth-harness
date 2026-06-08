import { evaluateExpression, type Expr } from "./expression.js";

export type ParityPredicate = "even" | "odd";
export type Mod2 = 0 | 1;

export interface ParityResidueCase {
  nMod2: Mod2;
  valueMod2: Mod2;
  satisfiesPredicate: boolean;
}

export interface ParityProofSuccess {
  ok: true;
  adapter: "local-modular-parity-kernel";
  theorem: "universal-integer-parity";
  expression: string;
  predicate: ParityPredicate;
  modulus: 2;
  residues: ParityResidueCase[];
  certificate: string;
}

export interface ParityProofFailure {
  ok: false;
  adapter: "local-modular-parity-kernel";
  expression: string;
  predicate: ParityPredicate;
  reason: string;
  residues?: ParityResidueCase[];
}

export type ParityProofResult = ParityProofSuccess | ParityProofFailure;

export function proveUniversalParity(
  expressionSource: string,
  expression: Expr,
  predicate: ParityPredicate
): ParityProofResult {
  try {
    const target: Mod2 = predicate === "even" ? 0 : 1;
    const residues: ParityResidueCase[] = ([0, 1] as const).map((nMod2) => {
      const valueMod2 = evaluateMod2(expression, nMod2);
      return {
        nMod2,
        valueMod2,
        satisfiesPredicate: valueMod2 === target
      };
    });

    if (!residues.every((residue) => residue.satisfiesPredicate)) {
      return {
        ok: false,
        adapter: "local-modular-parity-kernel",
        expression: expressionSource,
        predicate,
        reason: "At least one residue class modulo 2 does not satisfy the requested parity predicate.",
        residues
      };
    }

    return {
      ok: true,
      adapter: "local-modular-parity-kernel",
      theorem: "universal-integer-parity",
      expression: expressionSource,
      predicate,
      modulus: 2,
      residues,
      certificate:
        "For every integer n, polynomial parity depends only on n mod 2. The checker evaluated the expression in Z/2Z for n=0 and n=1, and every residue matched the requested predicate."
    };
  } catch (error) {
    return {
      ok: false,
      adapter: "local-modular-parity-kernel",
      expression: expressionSource,
      predicate,
      reason: error instanceof Error ? error.message : "Unknown parity proof failure."
    };
  }
}

function evaluateMod2(expression: Expr, nMod2: Mod2): Mod2 {
  switch (expression.type) {
    case "number":
      if (!expression.value.isInteger()) {
        throw new Error("The parity proof kernel only accepts integer literals.");
      }
      return mod2(expression.value.numerator);
    case "variable":
      return nMod2;
    case "unary":
      return evaluateMod2(expression.value, nMod2);
    case "binary": {
      const left = evaluateMod2(expression.left, nMod2);

      if (expression.op === "^") {
        const exponent = constantInteger(expression.right);
        if (exponent < 0n) {
          throw new Error("The parity proof kernel only accepts non-negative integer exponents.");
        }
        if (exponent > 1024n) {
          throw new Error("Exponent too large for the local parity proof kernel.");
        }
        return powMod2(left, exponent);
      }

      if (expression.op === "/") {
        throw new Error("Division is outside the local polynomial parity proof kernel.");
      }

      const right = evaluateMod2(expression.right, nMod2);
      switch (expression.op) {
        case "+":
          return mod2(BigInt(left + right));
        case "-":
          return mod2(BigInt(left - right));
        case "*":
          return mod2(BigInt(left * right));
      }
    }
  }
}

function constantInteger(expression: Expr): bigint {
  if (containsVariable(expression)) {
    throw new Error("The parity proof kernel only accepts constant exponents.");
  }

  const value = evaluateExpression(expression);
  if (!value.isInteger()) {
    throw new Error("The parity proof kernel only accepts integer exponents.");
  }

  return value.numerator;
}

function containsVariable(expression: Expr): boolean {
  switch (expression.type) {
    case "number":
      return false;
    case "variable":
      return true;
    case "unary":
      return containsVariable(expression.value);
    case "binary":
      return containsVariable(expression.left) || containsVariable(expression.right);
  }
}

function powMod2(base: Mod2, exponent: bigint): Mod2 {
  if (exponent === 0n) {
    return 1;
  }

  return base;
}

function mod2(value: bigint): Mod2 {
  const result = value % 2n;
  return result === 0n ? 0 : 1;
}

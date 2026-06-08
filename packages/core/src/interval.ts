import { evaluateExpression, expressionVariables, parseExpression, type Expr } from "./expression.js";
import { Rational } from "./rational.js";

export interface RationalInterval {
  lower: Rational;
  upper: Rational;
}

export interface IntervalPrompt {
  expressionSource: string;
  variable: string;
  input: RationalInterval;
}

export interface IntervalResult {
  adapter: "local-rational-interval-arithmetic";
  expression: string;
  variable: string;
  input: {
    lower: string;
    upper: string;
  };
  output: {
    lower: string;
    upper: string;
  };
  conservative: true;
}

const INTERVAL_PROMPT =
  /^(?:bound|bounds|range|interval)\s+(.+?)\s+for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s*\[\s*([+-]?\d+(?:\s*\/\s*[+-]?\d+)?)\s*,\s*([+-]?\d+(?:\s*\/\s*[+-]?\d+)?)\s*\]\.?$/i;

export function parseIntervalPrompt(problem: string): IntervalPrompt | undefined {
  const match = INTERVAL_PROMPT.exec(problem);
  if (!match) {
    return undefined;
  }

  return {
    expressionSource: match[1].trim(),
    variable: match[2],
    input: interval(parseRational(match[3]), parseRational(match[4]))
  };
}

export function evaluateIntervalPrompt(prompt: IntervalPrompt): IntervalResult {
  const expression = parseExpression(prompt.expressionSource);
  const variables = expressionVariables(expression);
  const unsupportedVariables = variables.filter((variable) => variable !== prompt.variable);

  if (unsupportedVariables.length > 0) {
    throw new Error(`Interval expression has unbound variables: ${unsupportedVariables.join(", ")}`);
  }

  const output = evaluateInterval(expression, prompt.variable, prompt.input);

  return {
    adapter: "local-rational-interval-arithmetic",
    expression: prompt.expressionSource,
    variable: prompt.variable,
    input: serializeInterval(prompt.input),
    output: serializeInterval(output),
    conservative: true
  };
}

export function evaluateInterval(expr: Expr, variable: string, input: RationalInterval): RationalInterval {
  switch (expr.type) {
    case "number":
      return interval(expr.value, expr.value);
    case "variable":
      if (expr.name !== variable) {
        throw new Error(`Interval expression has unbound variable ${expr.name}`);
      }
      return input;
    case "unary":
      return negateInterval(evaluateInterval(expr.value, variable, input));
    case "binary": {
      if (expr.op === "^") {
        const exponent = constantInteger(expr.right);
        return powInterval(evaluateInterval(expr.left, variable, input), exponent);
      }

      const left = evaluateInterval(expr.left, variable, input);
      const right = evaluateInterval(expr.right, variable, input);

      switch (expr.op) {
        case "+":
          return addInterval(left, right);
        case "-":
          return subtractInterval(left, right);
        case "*":
          return multiplyInterval(left, right);
        case "/":
          return divideInterval(left, right);
      }
    }
  }
}

export function formatInterval(value: RationalInterval): string {
  return `[${value.lower.toString()}, ${value.upper.toString()}]`;
}

function interval(lower: Rational, upper: Rational): RationalInterval {
  if (!lower.lessThanOrEqual(upper)) {
    throw new Error(`Invalid interval: lower ${lower.toString()} is greater than upper ${upper.toString()}`);
  }

  return { lower, upper };
}

function addInterval(left: RationalInterval, right: RationalInterval): RationalInterval {
  return interval(left.lower.add(right.lower), left.upper.add(right.upper));
}

function subtractInterval(left: RationalInterval, right: RationalInterval): RationalInterval {
  return interval(left.lower.subtract(right.upper), left.upper.subtract(right.lower));
}

function multiplyInterval(left: RationalInterval, right: RationalInterval): RationalInterval {
  return hull([
    left.lower.multiply(right.lower),
    left.lower.multiply(right.upper),
    left.upper.multiply(right.lower),
    left.upper.multiply(right.upper)
  ]);
}

function divideInterval(left: RationalInterval, right: RationalInterval): RationalInterval {
  if (containsZero(right)) {
    throw new Error("Interval division is undefined because the divisor interval contains zero.");
  }

  return multiplyInterval(left, interval(Rational.integer(1).divide(right.upper), Rational.integer(1).divide(right.lower)));
}

function negateInterval(value: RationalInterval): RationalInterval {
  return interval(value.upper.negate(), value.lower.negate());
}

function powInterval(value: RationalInterval, exponent: bigint): RationalInterval {
  if (exponent < 0n) {
    if (containsZero(value)) {
      throw new Error("Negative powers are undefined for intervals containing zero.");
    }
    return divideInterval(interval(Rational.integer(1), Rational.integer(1)), powInterval(value, -exponent));
  }

  if (exponent > 1024n) {
    throw new Error("Exponent too large for local interval arithmetic.");
  }

  if (exponent === 0n) {
    return interval(Rational.integer(1), Rational.integer(1));
  }

  const lowerPower = value.lower.pow(exponent);
  const upperPower = value.upper.pow(exponent);

  if (exponent % 2n === 1n) {
    return interval(lowerPower, upperPower);
  }

  if (containsZero(value)) {
    return interval(Rational.integer(0), maxRational(lowerPower.abs(), upperPower.abs()));
  }

  return hull([lowerPower, upperPower]);
}

function constantInteger(expr: Expr): bigint {
  if (expressionVariables(expr).length > 0) {
    throw new Error("Interval exponent must be a constant integer.");
  }

  const value = evaluateExpression(expr);
  if (!value.isInteger()) {
    throw new Error("Interval exponent must be an integer.");
  }

  return value.numerator;
}

function containsZero(value: RationalInterval): boolean {
  return value.lower.lessThanOrEqual(Rational.integer(0)) && Rational.integer(0).lessThanOrEqual(value.upper);
}

function hull(values: Rational[]): RationalInterval {
  const [first, ...rest] = values;
  if (!first) {
    throw new Error("Cannot form an interval hull from no values.");
  }

  return interval(minRational(first, ...rest), maxRational(first, ...rest));
}

function minRational(first: Rational, ...rest: Rational[]): Rational {
  return rest.reduce((min, value) => (value.lessThan(min) ? value : min), first);
}

function maxRational(first: Rational, ...rest: Rational[]): Rational {
  return rest.reduce((max, value) => (max.lessThan(value) ? value : max), first);
}

function serializeInterval(value: RationalInterval): { lower: string; upper: string } {
  return {
    lower: value.lower.toString(),
    upper: value.upper.toString()
  };
}

function parseRational(source: string): Rational {
  const normalized = source.replace(/\s+/g, "");
  const [numerator, denominator] = normalized.split("/");
  return new Rational(numerator, denominator ?? "1");
}

import { type Expr } from "./expression.js";
import { Rational } from "./rational.js";

export type ArithmeticTraceOperation = "literal" | "variable" | "negate" | "add" | "subtract" | "multiply" | "divide" | "power";
export type ArithmeticTeachingAudience = "middle-school" | "high-school" | "college" | "expert";

export interface ArithmeticTraceStep {
  id: string;
  expression: string;
  operation: ArithmeticTraceOperation;
  inputStepIds: string[];
  inputValues: string[];
  result: string;
  rule: string;
}

export interface ArithmeticTeachingView {
  audience: ArithmeticTeachingAudience;
  summary: string;
  steps: string[];
  caveats: string[];
}

export interface ArithmeticTrace {
  schemaVersion: "truth-harness.arithmetic-trace.v0";
  adapter: "local-rational-arithmetic";
  expression: string;
  result: string;
  exact: true;
  steps: ArithmeticTraceStep[];
  explanations: ArithmeticTeachingView[];
  limitations: string[];
}

interface TraceState {
  nextStep: number;
  steps: ArithmeticTraceStep[];
}

interface TraceValue {
  stepId: string;
  expression: string;
  value: Rational;
}

type TraceStepInput = Omit<ArithmeticTraceStep, "id" | "result"> & {
  value: Rational;
};

export function createArithmeticTrace(
  expressionSource: string,
  expression: Expr,
  env: Record<string, Rational> = {}
): ArithmeticTrace {
  const state: TraceState = {
    nextStep: 1,
    steps: []
  };
  const result = traceExpression(expression, env, state);

  return {
    schemaVersion: "truth-harness.arithmetic-trace.v0",
    adapter: "local-rational-arithmetic",
    expression: expressionSource,
    result: result.value.toString(),
    exact: true,
    steps: state.steps,
    explanations: createTeachingViews(expressionSource, result.value.toString(), state.steps),
    limitations: [
      "This trace covers the parsed arithmetic expression only, not arbitrary surrounding claims.",
      "Educational explanations are deterministic summaries of the machine trace; the machine trace is the source of truth."
    ]
  };
}

function traceExpression(expr: Expr, env: Record<string, Rational>, state: TraceState): TraceValue {
  switch (expr.type) {
    case "number":
      return pushStep(state, {
        expression: formatExpression(expr),
        operation: "literal",
        inputStepIds: [],
        inputValues: [],
        value: expr.value,
        rule: `Exact integer literal ${expr.value.toString()} normalized as a rational value.`
      });
    case "variable": {
      const value = env[expr.name];
      if (!value) {
        throw new Error(`Expression requires variable ${expr.name}`);
      }

      return pushStep(state, {
        expression: expr.name,
        operation: "variable",
        inputStepIds: [],
        inputValues: [],
        value,
        rule: `Substituted variable ${expr.name} with exact rational value ${value.toString()}.`
      });
    }
    case "unary": {
      const inner = traceExpression(expr.value, env, state);
      const value = inner.value.negate();
      return pushStep(state, {
        expression: formatExpression(expr),
        operation: "negate",
        inputStepIds: [inner.stepId],
        inputValues: [inner.value.toString()],
        value,
        rule: `Exact negation: -(${inner.value.toString()}) = ${value.toString()}.`
      });
    }
    case "binary": {
      const left = traceExpression(expr.left, env, state);
      const right = traceExpression(expr.right, env, state);
      const value = evaluateBinary(expr.op, left.value, right.value);
      return pushStep(state, {
        expression: formatExpression(expr),
        operation: operationFor(expr.op),
        inputStepIds: [left.stepId, right.stepId],
        inputValues: [left.value.toString(), right.value.toString()],
        value,
        rule: ruleFor(expr.op, left.value, right.value, value)
      });
    }
  }
}

function pushStep(state: TraceState, input: TraceStepInput): TraceValue {
  const id = `step_${state.nextStep}`;
  state.nextStep += 1;
  const { value, ...stepInput } = input;
  const step = { id, ...stepInput, result: value.toString() };
  state.steps.push(step);
  return {
    stepId: id,
    expression: input.expression,
    value
  };
}

type BinaryOperator = Extract<Expr, { type: "binary" }>["op"];

function evaluateBinary(op: BinaryOperator, left: Rational, right: Rational): Rational {
  switch (op) {
    case "+":
      return left.add(right);
    case "-":
      return left.subtract(right);
    case "*":
      return left.multiply(right);
    case "/":
      return left.divide(right);
    case "^":
      if (!right.isInteger()) {
        throw new Error("Exponent must be an integer");
      }
      return left.pow(right.numerator);
  }
}

function operationFor(op: BinaryOperator): ArithmeticTraceOperation {
  switch (op) {
    case "+":
      return "add";
    case "-":
      return "subtract";
    case "*":
      return "multiply";
    case "/":
      return "divide";
    case "^":
      return "power";
  }
}

function ruleFor(op: BinaryOperator, left: Rational, right: Rational, result: Rational): string {
  const leftText = left.toString();
  const rightText = right.toString();
  const resultText = result.toString();

  switch (op) {
    case "+":
      return `Exact rational addition: ${leftText} + ${rightText} = ${resultText}.`;
    case "-":
      return `Exact rational subtraction: ${leftText} - ${rightText} = ${resultText}.`;
    case "*":
      return `Exact rational multiplication: ${leftText} * ${rightText} = ${resultText}.`;
    case "/":
      return `Exact rational division with non-zero divisor: ${leftText} / ${rightText} = ${resultText}.`;
    case "^":
      return `Exact rational exponentiation by integer exponent: ${leftText} ^ ${rightText} = ${resultText}.`;
  }
}

function createTeachingViews(expression: string, result: string, steps: ArithmeticTraceStep[]): ArithmeticTeachingView[] {
  const calculationSteps = steps.filter((step) => step.operation !== "literal" && step.operation !== "variable");

  return [
    {
      audience: "middle-school",
      summary: `The engine solved ${expression} by breaking it into small pieces and keeping the fractions exact. The final answer is ${result}.`,
      steps: calculationSteps.map((step) => `${step.id}: ${plainOperation(step)} gives ${step.result}.`),
      caveats: ["This is a verified calculation trace, not a guess from an AI model."]
    },
    {
      audience: "high-school",
      summary: `The trace follows order of operations: parentheses and powers first, then multiplication or division, then addition or subtraction. The final exact value is ${result}.`,
      steps: calculationSteps.map((step) => `${step.id}: evaluate ${step.expression}; ${step.rule}`),
      caveats: ["The calculation is exact rational arithmetic, so fractions are not rounded."]
    },
    {
      audience: "college",
      summary: `The expression was parsed into an arithmetic tree and evaluated over the rational numbers. Each node records its operands, rule, and exact result.`,
      steps: calculationSteps.map((step) => `${step.id}: ${step.operation}(${step.inputValues.join(", ")}) -> ${step.result}`),
      caveats: ["This proves the value of the parsed expression only; it does not prove any broader business, finance, or scientific claim."]
    },
    {
      audience: "expert",
      summary: `Deterministic recursive evaluation over normalized bigint rational pairs produced ${result}.`,
      steps: steps.map(
        (step) =>
          `${step.id}: op=${step.operation}; expr=${step.expression}; inputs=[${step.inputStepIds.join(", ")}]; values=[${step.inputValues.join(", ")}]; result=${step.result}`
      ),
      caveats: ["The adapter is not a proof checker; receipt trust is exact-computed, not proved."]
    }
  ];
}

function plainOperation(step: ArithmeticTraceStep): string {
  switch (step.operation) {
    case "negate":
      return `changing the sign of ${step.inputValues[0]}`;
    case "add":
      return `adding ${step.inputValues.join(" and ")}`;
    case "subtract":
      return `subtracting ${step.inputValues[1]} from ${step.inputValues[0]}`;
    case "multiply":
      return `multiplying ${step.inputValues.join(" and ")}`;
    case "divide":
      return `dividing ${step.inputValues[0]} by ${step.inputValues[1]}`;
    case "power":
      return `raising ${step.inputValues[0]} to the power ${step.inputValues[1]}`;
    case "literal":
    case "variable":
      return `reading ${step.expression}`;
  }
}

function formatExpression(expr: Expr): string {
  switch (expr.type) {
    case "number":
      return expr.value.toString();
    case "variable":
      return expr.name;
    case "unary":
      return `-${formatExpression(expr.value)}`;
    case "binary":
      return `(${formatExpression(expr.left)} ${expr.op} ${formatExpression(expr.right)})`;
  }
}

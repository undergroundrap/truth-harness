import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parseExpression, expressionVariables, type Expr } from "./expression.js";
import { getLocalWorkspaceStatus, type LocalWorkspaceStatus } from "./local-workspace.js";
import {
  writeSmtCheckRecord,
  type SmtBackendCommandRunner,
  type SmtCheckWriteResult
} from "./smt-backend.js";

export type SmtConstraintOperator = "=" | "!=" | ">" | ">=" | "<" | "<=";
export type SmtVariableSort = "Int";

export interface SmtProblemVariable {
  name: string;
  sort: SmtVariableSort;
}

export interface SmtProblemConstraint {
  source: string;
  left: string;
  operator: SmtConstraintOperator;
  right: string;
  variables: string[];
}

export interface SmtProblemInput {
  queryName?: string;
  variables: Array<string | SmtProblemVariable>;
  constraints: string[];
  includeModel?: boolean;
}

export interface SmtProblemBuildResult {
  problemId: string;
  queryName?: string;
  logic: "QF_NIA";
  variables: SmtProblemVariable[];
  constraints: SmtProblemConstraint[];
  sourceText: string;
  warnings: string[];
  limitations: string[];
}

export interface SmtProblemSourceWriteResult {
  problem: SmtProblemBuildResult;
  sourcePath: string;
  sourceRef: string;
}

export interface SmtProblemSolveInput extends SmtProblemInput {
  rootPath: string;
  z3Command?: string;
  timeoutMs?: number;
  now?: Date;
  runner?: SmtBackendCommandRunner;
}

export interface SmtProblemSolveResult {
  problem: SmtProblemBuildResult;
  sourcePath: string;
  sourceRef: string;
  check: SmtCheckWriteResult;
}

export function buildSmtProblem(input: SmtProblemInput): SmtProblemBuildResult {
  const variables = normalizeVariables(input.variables);
  const declaredNames = new Set(variables.map((variable) => variable.name));
  const constraints = input.constraints.map(parseSmtConstraint);

  if (constraints.length === 0) {
    throw new Error("At least one SMT constraint is required.");
  }

  for (const constraint of constraints) {
    for (const variable of constraint.variables) {
      if (!declaredNames.has(variable)) {
        throw new Error(`Constraint references undeclared variable ${JSON.stringify(variable)}.`);
      }
    }
  }

  const queryName = normalizeOptional(input.queryName);
  const includeModel = input.includeModel === true;
  const problemId = `smt_problem_${stableHash({
    queryName,
    variables,
    constraints: constraints.map((constraint) => constraint.source),
    includeModel
  }).slice(0, 16)}`;
  const sourceText = renderSmtLib({
    queryName,
    variables,
    constraints,
    includeModel
  });

  return {
    problemId,
    ...(queryName ? { queryName } : {}),
    logic: "QF_NIA",
    variables,
    constraints,
    sourceText,
    warnings: [
      "This SMT-LIB source was generated from explicit structured constraints, not inferred from arbitrary natural language.",
      "Review the generated constraints before relying on solver output."
    ],
    limitations: [
      "The current SMT builder supports integer variables and integer arithmetic constraints over +, -, and * only.",
      "SMT results are evidence about the encoded constraints, not proof of surrounding informal or scientific claims."
    ]
  };
}

export async function writeSmtProblemSource(
  input: SmtProblemInput & { rootPath: string; now?: Date }
): Promise<SmtProblemSourceWriteResult> {
  const status = await requireLocalWorkspace(input.rootPath);
  const problem = buildSmtProblem(input);
  const smtDir = resolve(status.root, status.manifest.directories.smt);
  const sourcesDir = join(smtDir, "sources");
  await mkdir(sourcesDir, { recursive: true });
  const date = (input.now ?? new Date()).toISOString().slice(0, 10);
  const sourcePath = join(sourcesDir, `${date}-${problem.problemId}.smt2`);
  await writeFile(sourcePath, problem.sourceText, "utf8");

  return {
    problem,
    sourcePath,
    sourceRef: toPortablePath(relative(status.root, sourcePath))
  };
}

export async function solveSmtProblem(input: SmtProblemSolveInput): Promise<SmtProblemSolveResult> {
  const source = await writeSmtProblemSource(input);
  const check = await writeSmtCheckRecord({
    rootPath: input.rootPath,
    sourcePath: source.sourceRef,
    queryName: source.problem.queryName ?? source.problem.problemId,
    z3Command: input.z3Command,
    timeoutMs: input.timeoutMs,
    now: input.now,
    runner: input.runner
  });

  return {
    problem: source.problem,
    sourcePath: source.sourcePath,
    sourceRef: source.sourceRef,
    check
  };
}

export function parseSmtConstraint(source: string): SmtProblemConstraint {
  const trimmed = source.trim();
  const match = /^(.+?)\s*(>=|<=|!=|=|>|<)\s*(.+)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Expected constraint like "x + y >= 0", received ${JSON.stringify(source)}.`);
  }

  const left = match[1]?.trim() ?? "";
  const operator = match[2] as SmtConstraintOperator;
  const right = match[3]?.trim() ?? "";
  if (!left || !right) {
    throw new Error(`Constraint must have expressions on both sides: ${JSON.stringify(source)}.`);
  }

  const leftExpr = parseExpression(left);
  const rightExpr = parseExpression(right);

  return {
    source: trimmed,
    left,
    operator,
    right,
    variables: [...new Set([...expressionVariables(leftExpr), ...expressionVariables(rightExpr)])].sort()
  };
}

function renderSmtLib(args: {
  queryName?: string;
  variables: SmtProblemVariable[];
  constraints: SmtProblemConstraint[];
  includeModel: boolean;
}): string {
  const lines = [
    "; Generated by Truth Harness from explicit local structured constraints.",
    "; Boundary: solver output checks this SMT-LIB encoding, not any broader informal claim."
  ];

  if (args.queryName) {
    lines.push(`; Query: ${args.queryName}`);
  }

  lines.push("", "(set-logic QF_NIA)");

  for (const variable of args.variables) {
    lines.push(`(declare-const ${variable.name} ${variable.sort})`);
  }

  for (const constraint of args.constraints) {
    const left = renderExpression(parseExpression(constraint.left));
    const right = renderExpression(parseExpression(constraint.right));
    const assertion =
      constraint.operator === "!="
        ? `(not (= ${left} ${right}))`
        : `(${constraint.operator} ${left} ${right})`;
    lines.push(`(assert ${assertion})`);
  }

  lines.push("(check-sat)");
  if (args.includeModel) {
    lines.push("(get-model)");
  }

  return `${lines.join("\n")}\n`;
}

function renderExpression(expr: Expr): string {
  switch (expr.type) {
    case "number":
      if (!expr.value.isInteger()) {
        throw new Error("SMT integer constraints require integer constants.");
      }
      return expr.value.numerator.toString();
    case "variable":
      assertValidIdentifier(expr.name);
      return expr.name;
    case "unary":
      return `(- ${renderExpression(expr.value)})`;
    case "binary": {
      const left = renderExpression(expr.left);
      const right = renderExpression(expr.right);
      switch (expr.op) {
        case "+":
        case "-":
        case "*":
          return `(${expr.op} ${left} ${right})`;
        case "/":
          throw new Error("Division is not supported by the current integer SMT builder.");
        case "^":
          throw new Error("Exponentiation is not supported by the current integer SMT builder.");
      }
    }
  }
}

function normalizeVariables(values: Array<string | SmtProblemVariable>): SmtProblemVariable[] {
  if (values.length === 0) {
    throw new Error("At least one integer variable is required.");
  }

  const variables = values.map((value) => {
    const variable = typeof value === "string" ? { name: value, sort: "Int" as const } : value;
    assertValidIdentifier(variable.name);
    if (variable.sort !== "Int") {
      throw new Error(`Unsupported SMT variable sort ${JSON.stringify(variable.sort)}.`);
    }
    return variable;
  });
  const names = new Set<string>();
  for (const variable of variables) {
    if (names.has(variable.name)) {
      throw new Error(`Duplicate SMT variable ${JSON.stringify(variable.name)}.`);
    }
    names.add(variable.name);
  }

  return variables;
}

function assertValidIdentifier(value: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsupported SMT identifier ${JSON.stringify(value)}.`);
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function requireLocalWorkspace(
  rootPath: string
): Promise<LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> }> {
  const status = await getLocalWorkspaceStatus(rootPath);
  if (!status.exists || !status.manifest) {
    throw new Error("No Truth Harness workspace found. Run `truth-harness workspace init` before solving SMT problems.");
  }

  return status as LocalWorkspaceStatus & { manifest: NonNullable<LocalWorkspaceStatus["manifest"]> };
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

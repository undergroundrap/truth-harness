export type BaseDimension = "M" | "L" | "T" | "I" | "Theta" | "N";

export type DimensionVector = Record<BaseDimension, number>;

export interface DimensionCheckResult {
  equation: {
    lhs: string;
    rhs: string;
  };
  lhs: DimensionVector;
  rhs: DimensionVector;
  lhsText: string;
  rhsText: string;
  matched: boolean;
  identifiers: string[];
}

type DimensionExpr =
  | { type: "number" }
  | { type: "identifier"; name: string }
  | { type: "binary"; op: "*" | "/"; left: DimensionExpr; right: DimensionExpr }
  | { type: "power"; value: DimensionExpr; exponent: number };

type Token =
  | { type: "number"; value: string }
  | { type: "ident"; value: string }
  | { type: "op"; value: "*" | "/" | "^" }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "eof" };

const BASES: BaseDimension[] = ["M", "L", "T", "I", "Theta", "N"];

const DIMENSIONS: Record<string, DimensionVector> = {
  dimensionless: vector(),
  scalar: vector(),
  number: vector(),
  one: vector(),

  mass: vector({ M: 1 }),
  m: vector({ M: 1 }),
  M: vector({ M: 1 }),
  kg: vector({ M: 1 }),
  kilogram: vector({ M: 1 }),

  length: vector({ L: 1 }),
  distance: vector({ L: 1 }),
  displacement: vector({ L: 1 }),
  radius: vector({ L: 1 }),
  height: vector({ L: 1 }),
  width: vector({ L: 1 }),
  x: vector({ L: 1 }),
  r: vector({ L: 1 }),
  h: vector({ L: 1 }),
  d: vector({ L: 1 }),
  meter: vector({ L: 1 }),
  metre: vector({ L: 1 }),

  time: vector({ T: 1 }),
  t: vector({ T: 1 }),
  second: vector({ T: 1 }),
  s: vector({ T: 1 }),

  velocity: vector({ L: 1, T: -1 }),
  speed: vector({ L: 1, T: -1 }),
  v: vector({ L: 1, T: -1 }),

  acceleration: vector({ L: 1, T: -2 }),
  accel: vector({ L: 1, T: -2 }),
  a: vector({ L: 1, T: -2 }),

  force: vector({ M: 1, L: 1, T: -2 }),
  F: vector({ M: 1, L: 1, T: -2 }),
  newton: vector({ M: 1, L: 1, T: -2 }),

  area: vector({ L: 2 }),
  A: vector({ L: 2 }),

  volume: vector({ L: 3 }),

  energy: vector({ M: 1, L: 2, T: -2 }),
  work: vector({ M: 1, L: 2, T: -2 }),
  E: vector({ M: 1, L: 2, T: -2 }),
  joule: vector({ M: 1, L: 2, T: -2 }),
  J: vector({ M: 1, L: 2, T: -2 }),

  power: vector({ M: 1, L: 2, T: -3 }),
  P: vector({ M: 1, L: 2, T: -3 }),
  watt: vector({ M: 1, L: 2, T: -3 }),
  W: vector({ M: 1, L: 2, T: -3 }),

  pressure: vector({ M: 1, L: -1, T: -2 }),
  stress: vector({ M: 1, L: -1, T: -2 }),
  pascal: vector({ M: 1, L: -1, T: -2 }),

  momentum: vector({ M: 1, L: 1, T: -1 }),

  density: vector({ M: 1, L: -3 }),
  rho: vector({ M: 1, L: -3 }),

  frequency: vector({ T: -1 }),
  f: vector({ T: -1 }),
  hertz: vector({ T: -1 }),
  Hz: vector({ T: -1 }),

  current: vector({ I: 1 }),
  ampere: vector({ I: 1 }),
  amp: vector({ I: 1 }),
  I: vector({ I: 1 }),

  charge: vector({ I: 1, T: 1 }),
  q: vector({ I: 1, T: 1 }),
  coulomb: vector({ I: 1, T: 1 }),

  voltage: vector({ M: 1, L: 2, T: -3, I: -1 }),
  potential: vector({ M: 1, L: 2, T: -3, I: -1 }),
  volt: vector({ M: 1, L: 2, T: -3, I: -1 }),

  resistance: vector({ M: 1, L: 2, T: -3, I: -2 }),
  ohm: vector({ M: 1, L: 2, T: -3, I: -2 }),

  temperature: vector({ Theta: 1 }),
  temp: vector({ Theta: 1 }),
  kelvin: vector({ Theta: 1 }),
  K: vector({ Theta: 1 }),

  amount: vector({ N: 1 }),
  mole: vector({ N: 1 }),
  mol: vector({ N: 1 })
};

export function parseDimensionPrompt(problem: string): string | undefined {
  const match = /^(?:dimension|unit|units)\s+check\s+(.+?)\s*=\s*(.+)$/i.exec(problem);
  if (!match) {
    return undefined;
  }

  return `${match[1].trim()} = ${match[2].trim()}`;
}

export function checkDimensionEquation(source: string): DimensionCheckResult {
  const parts = source.split("=");
  if (parts.length !== 2) {
    throw new Error("Dimension check requires exactly one equals sign");
  }

  const lhsSource = parts[0].trim();
  const rhsSource = parts[1].trim();
  const lhsExpr = parseDimensionExpression(lhsSource);
  const rhsExpr = parseDimensionExpression(rhsSource);
  const identifiers = [...new Set([...collectIdentifiers(lhsExpr), ...collectIdentifiers(rhsExpr)])].sort();
  const lhs = evaluateDimension(lhsExpr);
  const rhs = evaluateDimension(rhsExpr);

  return {
    equation: {
      lhs: lhsSource,
      rhs: rhsSource
    },
    lhs,
    rhs,
    lhsText: formatDimension(lhs),
    rhsText: formatDimension(rhs),
    matched: sameVector(lhs, rhs),
    identifiers
  };
}

export function formatDimension(dimension: DimensionVector): string {
  const terms = BASES.flatMap((base) => {
    const exponent = dimension[base];
    if (exponent === 0) {
      return [];
    }
    return exponent === 1 ? [base] : [`${base}^${exponent}`];
  });

  return terms.length === 0 ? "1" : terms.join(" ");
}

function parseDimensionExpression(source: string): DimensionExpr {
  const parser = new DimensionParser(tokenize(source));
  const expression = parser.parseMultiplicative();
  parser.expect("eof");
  return expression;
}

function evaluateDimension(expr: DimensionExpr): DimensionVector {
  switch (expr.type) {
    case "number":
      return vector();
    case "identifier": {
      const dimension = DIMENSIONS[expr.name];
      if (!dimension) {
        throw new Error(`Unknown dimension identifier "${expr.name}"`);
      }
      return dimension;
    }
    case "binary": {
      const left = evaluateDimension(expr.left);
      const right = evaluateDimension(expr.right);
      return expr.op === "*" ? addVectors(left, right) : subtractVectors(left, right);
    }
    case "power":
      return multiplyVector(evaluateDimension(expr.value), expr.exponent);
  }
}

function collectIdentifiers(expr: DimensionExpr): string[] {
  switch (expr.type) {
    case "number":
      return [];
    case "identifier":
      return [expr.name];
    case "binary":
      return [...collectIdentifiers(expr.left), ...collectIdentifiers(expr.right)];
    case "power":
      return collectIdentifiers(expr.value);
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char) || (char === "-" && /[0-9]/.test(source[index + 1] ?? ""))) {
      let end = index + 1;
      while (end < source.length && /[0-9.]/.test(source[end])) {
        end += 1;
      }
      tokens.push({ type: "number", value: source.slice(index, end) });
      index = end;
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[a-zA-Z0-9_]/.test(source[end])) {
        end += 1;
      }
      tokens.push({ type: "ident", value: source.slice(index, end) });
      index = end;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "lparen" });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rparen" });
      index += 1;
      continue;
    }

    if (char === "*" || char === "/" || char === "^") {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported dimension character "${char}"`);
  }

  tokens.push({ type: "eof" });
  return tokens;
}

class DimensionParser {
  private cursor = 0;

  constructor(private readonly tokens: Token[]) {}

  parseMultiplicative(): DimensionExpr {
    let left = this.parsePower();

    while (this.peekOp("*") || this.peekOp("/")) {
      const op = (this.advance() as Extract<Token, { type: "op" }>).value as "*" | "/";
      const right = this.parsePower();
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  private parsePower(): DimensionExpr {
    const left = this.parsePrimary();

    if (this.peekOp("^")) {
      this.advance();
      const exponentToken = this.advance();
      if (exponentToken.type !== "number" || !/^-?\d+$/.test(exponentToken.value)) {
        throw new Error("Dimension exponents must be integers");
      }
      return { type: "power", value: left, exponent: Number(exponentToken.value) };
    }

    return left;
  }

  private parsePrimary(): DimensionExpr {
    const token = this.advance();

    if (token.type === "number") {
      return { type: "number" };
    }

    if (token.type === "ident") {
      return { type: "identifier", name: token.value };
    }

    if (token.type === "lparen") {
      const expression = this.parseMultiplicative();
      this.expect("rparen");
      return expression;
    }

    throw new Error(`Expected dimension expression, received ${describeToken(token)}`);
  }

  expect(type: Token["type"]): void {
    const token = this.advance();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, received ${describeToken(token)}`);
    }
  }

  private peek(): Token {
    return this.tokens[this.cursor] ?? { type: "eof" };
  }

  private peekOp(op: Extract<Token, { type: "op" }>["value"]): boolean {
    const token = this.peek();
    return token.type === "op" && token.value === op;
  }

  private advance(): Token {
    return this.tokens[this.cursor++] ?? { type: "eof" };
  }
}

function sameVector(left: DimensionVector, right: DimensionVector): boolean {
  return BASES.every((base) => left[base] === right[base]);
}

function addVectors(left: DimensionVector, right: DimensionVector): DimensionVector {
  return vector(Object.fromEntries(BASES.map((base) => [base, left[base] + right[base]])) as Partial<DimensionVector>);
}

function subtractVectors(left: DimensionVector, right: DimensionVector): DimensionVector {
  return vector(Object.fromEntries(BASES.map((base) => [base, left[base] - right[base]])) as Partial<DimensionVector>);
}

function multiplyVector(input: DimensionVector, factor: number): DimensionVector {
  return vector(Object.fromEntries(BASES.map((base) => [base, input[base] * factor])) as Partial<DimensionVector>);
}

function vector(values: Partial<DimensionVector> = {}): DimensionVector {
  return {
    M: values.M ?? 0,
    L: values.L ?? 0,
    T: values.T ?? 0,
    I: values.I ?? 0,
    Theta: values.Theta ?? 0,
    N: values.N ?? 0
  };
}

function describeToken(token: Token): string {
  if ("value" in token) {
    return `${token.type}(${token.value})`;
  }

  return token.type;
}

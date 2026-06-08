import { Rational } from "./rational.js";

export type Expr =
  | { type: "number"; value: Rational }
  | { type: "variable"; name: "n" }
  | { type: "unary"; op: "-"; value: Expr }
  | { type: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Expr; right: Expr };

type Token =
  | { type: "number"; value: string }
  | { type: "ident"; value: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "eof" };

export function parseExpression(source: string): Expr {
  const parser = new Parser(tokenize(source));
  const expression = parser.parseAdditive();
  parser.expect("eof");
  return expression;
}

export function evaluateExpression(expr: Expr, env: { n?: Rational } = {}): Rational {
  switch (expr.type) {
    case "number":
      return expr.value;
    case "variable":
      if (!env.n) {
        throw new Error("Expression requires variable n");
      }
      return env.n;
    case "unary":
      return evaluateExpression(expr.value, env).negate();
    case "binary": {
      const left = evaluateExpression(expr.left, env);
      const right = evaluateExpression(expr.right, env);

      switch (expr.op) {
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

    if (/[0-9]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[0-9]/.test(source[end])) {
        end += 1;
      }
      tokens.push({ type: "number", value: source.slice(index, end) });
      index = end;
      continue;
    }

    if (/[a-zA-Z]/.test(char)) {
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

    if (char === "+" || char === "-" || char === "*" || char === "/" || char === "^") {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported character "${char}"`);
  }

  tokens.push({ type: "eof" });
  return tokens;
}

class Parser {
  private cursor = 0;

  constructor(private readonly tokens: Token[]) {}

  parseAdditive(): Expr {
    let left = this.parseMultiplicative();

    while (this.peekOp("+") || this.peekOp("-")) {
      const op = (this.advance() as Extract<Token, { type: "op" }>).value as "+" | "-";
      const right = this.parseMultiplicative();
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parsePower();

    while (this.peekOp("*") || this.peekOp("/")) {
      const op = (this.advance() as Extract<Token, { type: "op" }>).value as "*" | "/";
      const right = this.parsePower();
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  private parsePower(): Expr {
    const left = this.parseUnary();

    if (this.matchOp("^")) {
      const right = this.parsePower();
      return { type: "binary", op: "^", left, right };
    }

    return left;
  }

  private parseUnary(): Expr {
    if (this.matchOp("-")) {
      return { type: "unary", op: "-", value: this.parseUnary() };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const token = this.advance();

    if (token.type === "number") {
      return { type: "number", value: Rational.integer(token.value) };
    }

    if (token.type === "ident" && token.value === "n") {
      return { type: "variable", name: "n" };
    }

    if (token.type === "lparen") {
      const expression = this.parseAdditive();
      this.expect("rparen");
      return expression;
    }

    throw new Error(`Expected expression, received ${describeToken(token)}`);
  }

  expect(type: Token["type"]): void {
    const token = this.advance();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, received ${describeToken(token)}`);
    }
  }

  private matchOp(op: Extract<Token, { type: "op" }>["value"]): boolean {
    const token = this.peek();
    if (token.type !== "op" || token.value !== op) {
      return false;
    }

    this.advance();
    return true;
  }

  private advance(): Token {
    return this.tokens[this.cursor++] ?? { type: "eof" };
  }

  private peek(): Token {
    return this.tokens[this.cursor] ?? { type: "eof" };
  }

  private peekOp(op: Extract<Token, { type: "op" }>["value"]): boolean {
    const token = this.peek();
    return token.type === "op" && token.value === op;
  }
}

function describeToken(token: Token): string {
  if ("value" in token) {
    return `${token.type}(${token.value})`;
  }

  return token.type;
}

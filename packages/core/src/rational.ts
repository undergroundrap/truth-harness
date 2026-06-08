export class Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint | number | string, denominator: bigint | number | string = 1n) {
    const rawNumerator = BigInt(numerator);
    const rawDenominator = BigInt(denominator);

    if (rawDenominator === 0n) {
      throw new Error("Division by zero");
    }

    const sign = rawDenominator < 0n ? -1n : 1n;
    const divisor = gcd(abs(rawNumerator), abs(rawDenominator));
    this.numerator = (rawNumerator / divisor) * sign;
    this.denominator = abs(rawDenominator) / divisor;
  }

  static integer(value: bigint | number | string): Rational {
    return new Rational(value);
  }

  add(other: Rational): Rational {
    return new Rational(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator
    );
  }

  subtract(other: Rational): Rational {
    return new Rational(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator
    );
  }

  multiply(other: Rational): Rational {
    return new Rational(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  divide(other: Rational): Rational {
    return new Rational(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  negate(): Rational {
    return new Rational(-this.numerator, this.denominator);
  }

  pow(exponent: bigint): Rational {
    if (abs(exponent) > 1024n) {
      throw new Error("Exponent too large for local exact evaluator");
    }

    if (exponent === 0n) {
      return Rational.integer(1);
    }

    const positive = exponent > 0n ? exponent : -exponent;
    let numerator = 1n;
    let denominator = 1n;

    for (let i = 0n; i < positive; i += 1n) {
      numerator *= this.numerator;
      denominator *= this.denominator;
    }

    return exponent > 0n ? new Rational(numerator, denominator) : new Rational(denominator, numerator);
  }

  isInteger(): boolean {
    return this.denominator === 1n;
  }

  isEvenInteger(): boolean {
    return this.isInteger() && mod(this.numerator, 2n) === 0n;
  }

  isOddInteger(): boolean {
    return this.isInteger() && mod(this.numerator, 2n) === 1n;
  }

  compare(other: Rational): -1 | 0 | 1 {
    const left = this.numerator * other.denominator;
    const right = other.numerator * this.denominator;

    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  }

  lessThan(other: Rational): boolean {
    return this.compare(other) < 0;
  }

  lessThanOrEqual(other: Rational): boolean {
    return this.compare(other) <= 0;
  }

  abs(): Rational {
    return this.numerator < 0n ? this.negate() : this;
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    if (this.denominator === 1n) {
      return this.numerator.toString();
    }

    return `${this.numerator.toString()}/${this.denominator.toString()}`;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  let left = a;
  let right = b;

  while (right !== 0n) {
    const next = left % right;
    left = right;
    right = next;
  }

  return left === 0n ? 1n : left;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function mod(value: bigint, divisor: bigint): bigint {
  const result = value % divisor;
  return result < 0n ? result + divisor : result;
}

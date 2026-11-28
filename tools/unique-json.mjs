export function parseUniqueJson(text, { naturalNumbersOnly = false } = {}) {
  const value = JSON.parse(text);
  // Validate with the native parser first, then inspect member and number
  // tokens that JSON.parse would otherwise normalize before validation.
  const keys = [];
  const tokens = /("(?:\\.|[^"\\])*")(\s*:)?|([{}])|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/gu;
  for (const [, literal, colon, brace, number] of text.matchAll(tokens)) {
    if (brace === "{") keys.push(new Set());
    else if (brace === "}") keys.pop();
    else if (colon) {
      const key = JSON.parse(literal);
      const object = keys.at(-1);
      if (object.has(key)) throw new Error(`Duplicate JSON member: ${key}`);
      object.add(key);
    } else if (number !== undefined && naturalNumbersOnly && !/^(?:0|[1-9]\d*)$/u.test(number)) {
      throw new Error("Expected canonical nonnegative integer literals");
    }
  }
  return value;
}

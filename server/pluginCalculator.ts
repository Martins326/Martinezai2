export function evaluateCalculatorExpression(rawExpression: string): number {
  const expression = rawExpression.trim();

  if (!expression) {
    throw new Error("Enter a mathematical expression first.");
  }

  if (expression.length > 1000) {
    throw new Error("The expression is too long.");
  }

  type Token = {
    type: "number" | "identifier" | "operator";
    value: string;
  };

  const tokens: Token[] = [];

  const tokenPattern =
    /\s+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z_][a-zA-Z_0-9]*|[()+\-*/%^,]/iy;

  let cursor = 0;

  while (cursor < expression.length) {
    tokenPattern.lastIndex = cursor;

    const match = tokenPattern.exec(expression);

    if (!match || match.index !== cursor) {
      throw new Error(
        `Unsupported character near: ${expression.slice(cursor, cursor + 12)}`
      );
    }

    cursor = tokenPattern.lastIndex;

    const value = match[0];

    if (/^\s+$/.test(value)) {
      continue;
    }

    if (/^(?:\d|\.)/.test(value)) {
      tokens.push({
        type: "number",
        value,
      });
    } else if (/^[a-z_]/i.test(value)) {
      tokens.push({
        type: "identifier",
        value: value.toLowerCase(),
      });
    } else {
      tokens.push({
        type: "operator",
        value,
      });
    }

    if (tokens.length > 300) {
      throw new Error("The expression contains too many parts.");
    }
  }

  let position = 0;

  const peek = () => tokens[position];

  const take = () => tokens[position++];

  const consume = (expected: string) => {
    if (peek()?.value !== expected) {
      throw new Error(`Expected '${expected}'.`);
    }

    take();
  };

  const functions: Record<string, (args: number[]) => number> = {
    abs: ([x]) => Math.abs(x),

    sqrt: ([x]) => Math.sqrt(x),

    sin: ([x]) => Math.sin(x),

    cos: ([x]) => Math.cos(x),

    tan: ([x]) => Math.tan(x),

    ln: ([x]) => Math.log(x),

    log: ([x]) => Math.log10(x),

    exp: ([x]) => Math.exp(x),

    floor: ([x]) => Math.floor(x),

    ceil: ([x]) => Math.ceil(x),

    round: ([x, digits = 0]) => {
      const factor = 10 ** digits;

      return Math.round(x * factor) / factor;
    },

    min: (args) => Math.min(...args),

    max: (args) => Math.max(...args),

    pow: ([x, y]) => Math.pow(x, y),
  };

  const parseExpression = (): number => {
    let value = parseTerm();

    while (
      peek()?.value === "+" ||
      peek()?.value === "-"
    ) {
      const operator = take().value;

      const right = parseTerm();

      value =
        operator === "+"
          ? value + right
          : value - right;
    }

    return value;
  };

  const parseTerm = (): number => {
    let value = parseUnary();

    while (
      ["*", "/", "%"].includes(peek()?.value || "")
    ) {
      const operator = take().value;

      const right = parseUnary();

      if (
        (operator === "/" || operator === "%") &&
        right === 0
      ) {
        throw new Error(
          "Division by zero is not allowed."
        );
      }

      if (operator === "*") {
        value *= right;
      } else if (operator === "/") {
        value /= right;
      } else {
        value %= right;
      }
    }

    return value;
  };

  const parseUnary = (): number => {
    if (peek()?.value === "+") {
      take();

      return parseUnary();
    }

    if (peek()?.value === "-") {
      take();

      return -parseUnary();
    }

    return parsePower();
  };

  const parsePower = (): number => {
    const value = parsePrimary();

    if (peek()?.value === "^") {
      take();

      return Math.pow(value, parseUnary());
    }

    return value;
  };

  const parsePrimary = (): number => {
    const token = take();

    if (!token) {
      throw new Error(
        "The expression ended unexpectedly."
      );
    }

    if (token.type === "number") {
      return Number(token.value);
    }

    if (token.value === "(") {
      const value = parseExpression();

      consume(")");

      return value;
    }

    if (token.type === "identifier") {
      if (peek()?.value !== "(") {
        if (token.value === "pi") {
          return Math.PI;
        }

        if (token.value === "e") {
          return Math.E;
        }

        throw new Error(
          `Unknown constant '${token.value}'. Use pi or e.`
        );
      }

      take();

      const args: number[] = [];

      if (peek()?.value !== ")") {
        args.push(parseExpression());

        while (peek()?.value === ",") {
          take();

          args.push(parseExpression());
        }
      }

      consume(")");

      const fn = functions[token.value];

      if (!fn) {
        throw new Error(
          `Unknown function '${token.value}'.`
        );
      }

      if (
        ["min", "max"].includes(token.value) &&
        args.length < 1
      ) {
        throw new Error(
          `${token.value} needs at least one argument.`
        );
      }

      if (
        token.value === "pow" &&
        args.length !== 2
      ) {
        throw new Error(
          "pow needs exactly two arguments."
        );
      }

      if (
        token.value === "round" &&
        (args.length < 1 || args.length > 2)
      ) {
        throw new Error(
          "round needs one argument, or a value and decimal-place count."
        );
      }

      if (
        !["min", "max", "pow", "round"].includes(
          token.value
        ) &&
        args.length !== 1
      ) {
        throw new Error(
          `${token.value} needs exactly one argument.`
        );
      }

      return fn(args);
    }

    throw new Error(
      `Unexpected token '${token.value}'.`
    );
  };

  const result = parseExpression();

  if (position !== tokens.length) {
    throw new Error(
      `Unexpected token '${tokens[position].value}'.`
    );
  }

  if (!Number.isFinite(result)) {
    throw new Error(
      "The result is not a finite number. Check the input and function domains."
    );
  }

  return result;
}
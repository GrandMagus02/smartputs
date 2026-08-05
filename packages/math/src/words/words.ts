import { WordParseError } from "../errors";
import {
  type BinaryOp,
  type FunctionId,
  lexWords,
  type WordOptions,
  type WordToken,
} from "./lex";

export type { WordOptions };

type Node =
  | { kind: "atom"; latex: string }
  | { kind: "group"; body: Node }
  | { kind: "binary"; op: BinaryOp; left: Node; right: Node }
  /** Two operands said next to each other: "two x" is a product. */
  | { kind: "juxtapose"; left: Node; right: Node }
  | { kind: "negate"; body: Node }
  | { kind: "power"; base: Node; exponent: Node }
  | { kind: "postfix"; symbol: "!" | "\\%"; body: Node }
  | { kind: "call"; fn: FunctionId; arg: Node }
  | { kind: "root"; degree: string | null; body: Node };

// The precedence a spoken operator has is the precedence its symbol has: a
// listener who hears "one plus two times three" means the same thing a reader
// means by `1+2\times3`, so there is only one table to be right about.
const RELATION = 2;
const ADDITIVE = 4;
const MULTIPLICATIVE = 5;
/** Juxtaposition binds tighter than a spoken "times": `2x\times3` is `(2x)3`. */
const JUXTAPOSITION = 6;
const POWER = 7;
/** Anything that already reads as a single thing: an atom, a group, a call. */
const TIGHT = 9;

const BINARY_PRECEDENCE: Readonly<Record<BinaryOp, number>> = {
  "=": RELATION,
  "\\ne": RELATION,
  "<": RELATION,
  ">": RELATION,
  "\\leq": RELATION,
  "\\geq": RELATION,
  "+": ADDITIVE,
  "-": ADDITIVE,
  "\\times": MULTIPLICATIVE,
  "/": MULTIPLICATIVE,
  "^": POWER,
};

/**
 * Read an expression said out loud into the LaTeX it means:
 * `"one plus two to the power of three"` is `1+2^3`.
 *
 * This is the door into the rest of the package for input that was spoken or
 * typed as words rather than as notation — the result is ordinary LaTeX, so
 * `evaluate`, `solve` and the rest need to know nothing about words:
 *
 * ```ts
 * math.evaluate(latexFromWords("one plus two in brackets power three")); // 27
 * ```
 *
 * It is the inverse of `describe`, and deliberately reads that function's own
 * output back — "the quantity 2 plus 3, squared" returns `(2+3)^2`.
 *
 * `options.fuzzy` turns on reading through a typo — off by default, so a word
 * it does not know is an error rather than a correction nobody asked for.
 */
export function latexFromWords(words: string, options: WordOptions = {}): string {
  const tokens = lexWords(words, options);
  if (tokens.length === 0) {
    throw new WordParseError(words, "there is nothing in it to read");
  }
  return emit(parse(tokens, words));
}

function parse(tokens: readonly WordToken[], input: string): Node {
  let at = 0;

  const peek = (): WordToken | undefined => tokens[at];
  const next = (): WordToken | undefined => tokens[at++];

  const fail = (detail: string, token?: WordToken): never => {
    throw new WordParseError(input, detail, token?.word ?? null);
  };

  /**
   * The body of a group, and of the sentence as a whole.
   *
   * Brackets said afterwards — "one plus two in brackets", "x plus one all
   * squared" — are the reason this is not simply `expression()`. A speaker who
   * marks a bracket after the fact is marking everything they have said since
   * the last one they opened, so that is what gets wrapped, and parsing then
   * carries on with the group as the left operand of whatever follows.
   */
  const group = (): Node => {
    let node = expression(0);
    while (peek()?.type === "wrap") {
      next();
      // The group is an operand like any other the moment it closes, so it
      // takes its postfixes first — "x plus one all squared" is a square, not
      // a sum with a stray word after it — and only then goes on as the left
      // side of whatever else was said.
      node = expression(0, postfixes({ kind: "group", body: node }));
    }
    return node;
  };

  const expression = (minimum: number, seed?: Node): Node => {
    let left = seed ?? unary();

    for (;;) {
      const token = peek();
      if (token === undefined) break;

      if (token.type === "op") {
        const precedence = BINARY_PRECEDENCE[token.op];
        if (precedence < minimum) break;
        next();
        // `^` is the one right-associative operator: `2^3^2` is `2^(3^2)`.
        const right = expression(token.op === "^" ? precedence : precedence + 1);
        left =
          token.op === "^"
            ? { kind: "power", base: left, exponent: right }
            : { kind: "binary", op: token.op, left, right };
        continue;
      }

      // "two x" is a product; "two three" is a slip of the tongue, and reading
      // it as 2×3 would turn a mistake into a confident wrong answer.
      if (JUXTAPOSITION >= minimum && STARTS_OPERAND.has(token.type)) {
        left = { kind: "juxtapose", left, right: expression(JUXTAPOSITION + 1) };
        continue;
      }

      break;
    }

    return left;
  };

  const unary = (): Node => {
    const token = peek();
    if (token?.type === "op" && token.op === "-") {
      next();
      return { kind: "negate", body: unary() };
    }
    return postfixes();
  };

  const postfixes = (seed?: Node): Node => {
    let node = seed ?? primary();
    for (;;) {
      const token = peek();
      if (token?.type !== "postfix") return node;
      next();
      switch (token.postfix) {
        case "squared":
          node = { kind: "power", base: node, exponent: { kind: "atom", latex: "2" } };
          break;
        case "cubed":
          node = { kind: "power", base: node, exponent: { kind: "atom", latex: "3" } };
          break;
        case "factorial":
          node = { kind: "postfix", symbol: "!", body: node };
          break;
        case "percent":
          node = { kind: "postfix", symbol: "\\%", body: node };
          break;
      }
    }
  };

  const primary = (): Node => {
    const token = next();
    if (token === undefined) {
      return fail("it ends where a number or a symbol was expected");
    }

    switch (token.type) {
      case "number":
      case "symbol":
        return { kind: "atom", latex: token.latex };

      case "open": {
        const body = group();
        const closing = peek();
        if (closing?.type !== "close") return fail("a bracket is never closed", token);
        next();
        return { kind: "group", body };
      }

      // "the quantity x plus one, squared" — the comma is where the quantity
      // ends, exactly as the pause is when it is said out loud. Without one it
      // runs to the end of whatever encloses it.
      case "quantity": {
        const body = group();
        if (peek()?.type === "comma") next();
        return { kind: "group", body };
      }

      // A function takes the operand it is applied to, not the sentence that
      // follows: "the sine of x plus one" is `\sin(x)+1`. The other reading is
      // available, and has to be said — "the sine of the quantity x plus one".
      case "call":
        return { kind: "call", fn: token.fn, arg: expression(JUXTAPOSITION) };

      case "root":
        return { kind: "root", degree: token.degree, body: expression(JUXTAPOSITION) };

      default:
        return fail(`${JSON.stringify(token.word)} has nothing to apply to`, token);
    }
  };

  const parsed = group();
  const rest = peek();
  if (rest !== undefined) {
    return fail(`${JSON.stringify(rest.word)} is not expected there`, rest);
  }
  return parsed;
}

const STARTS_OPERAND = new Set<WordToken["type"]>([
  "symbol",
  "open",
  "quantity",
  "call",
  "root",
]);

function precedenceOf(node: Node): number {
  switch (node.kind) {
    case "binary":
      return BINARY_PRECEDENCE[node.op];
    case "juxtapose":
      return JUXTAPOSITION;
    case "power":
      return POWER;
    // A negation reads as far as an addition does: `-x^2` is a negated square,
    // and `-(x+1)` needs the brackets it is printed with.
    case "negate":
      return ADDITIVE;
    default:
      return TIGHT;
  }
}

function emit(node: Node): string {
  switch (node.kind) {
    case "atom":
      return node.latex;
    case "group":
      return `(${emit(node.body)})`;
    case "binary":
      return binary(node.op, node.left, node.right);
    case "juxtapose":
      return `${within(node.left, JUXTAPOSITION)}${within(node.right, JUXTAPOSITION)}`;
    case "negate":
      return `-${within(node.body, MULTIPLICATIVE)}`;
    case "power":
      return `${within(node.base, TIGHT)}^${exponent(inner(node.exponent))}`;
    case "postfix":
      return `${within(node.body, TIGHT)}${node.symbol}`;
    case "call":
      return node.fn === "abs"
        ? `\\left|${inner(node.arg)}\\right|`
        : `${node.fn}(${inner(node.arg)})`;
    case "root":
      return node.degree === null
        ? `\\sqrt{${inner(node.body)}}`
        : `\\sqrt[${node.degree}]{${inner(node.body)}}`;
  }
}

/**
 * An operand that is about to be printed inside something that already groups
 * it — a `{…}` argument, a `\left|…\right|`, a function's own brackets. The
 * spoken bracket did its job at the parse; printing it again gives
 * `\frac{(x+1)}{2}`, which is the right expression drawn wrong.
 */
function inner(node: Node): string {
  return emit(node.kind === "group" ? node.body : node);
}

/** Brackets an operand that would otherwise be read as part of its neighbour. */
function within(node: Node, minimum: number): string {
  const latex = emit(node);
  return precedenceOf(node) < minimum ? `(${latex})` : latex;
}

function binary(op: BinaryOp, left: Node, right: Node): string {
  // A division is a fraction: the braces already say what the brackets would.
  if (op === "/") return `\\frac{${inner(left)}}{${inner(right)}}`;
  const precedence = BINARY_PRECEDENCE[op];
  return `${within(left, precedence)}${op}${within(right, precedence + 1)}`;
}

/** `2^3` needs no braces; `2^{10}` does, and LaTeX reads 2^1·0 without them. */
function exponent(latex: string): string {
  return latex.length === 1 ? latex : `{${latex}}`;
}

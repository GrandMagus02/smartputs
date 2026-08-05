import { numberFromWords } from "@smartput/number";
import { WordParseError } from "../errors";

/**
 * A word token is already the notation it stands for: `plus` arrives as `+`,
 * `to the power of` as `^`. Resolving the vocabulary here rather than in the
 * parser is what keeps one phrasing from needing its own parser branch — a
 * dozen ways to say "raised to" are a dozen table rows, not a dozen cases.
 */
export type WordToken =
  | { type: "number"; latex: string; word: string }
  | { type: "symbol"; latex: string; word: string }
  | { type: "op"; op: BinaryOp; word: string }
  | { type: "open"; word: string }
  | { type: "close"; word: string }
  | { type: "comma"; word: string }
  /** A group marker said *after* what it groups: "one plus two in brackets". */
  | { type: "wrap"; word: string }
  /** A group marker said *before* what it groups: "the quantity one plus two". */
  | { type: "quantity"; word: string }
  | { type: "postfix"; postfix: Postfix; word: string }
  | { type: "call"; fn: FunctionId; word: string }
  /** `degree` is null for a square root, otherwise the index of the radical. */
  | { type: "root"; degree: string | null; word: string };

export type BinaryOp =
  | "+"
  | "-"
  | "\\times"
  | "/"
  | "^"
  | "="
  | "\\ne"
  | "<"
  | ">"
  | "\\leq"
  | "\\geq";

export type Postfix = "squared" | "cubed" | "factorial" | "percent";

export type FunctionId =
  | "\\sin"
  | "\\cos"
  | "\\tan"
  | "\\arcsin"
  | "\\arccos"
  | "\\arctan"
  | "\\ln"
  | "\\log"
  | "\\exp"
  | "abs";

/**
 * A table row: the token minus the surface text, which only the input knows.
 * Distributed over the union on purpose — a plain `Omit` collapses the members
 * to the keys they share, and every payload (`op`, `fn`, `degree`) is gone.
 */
type Spec = WordToken extends infer T
  ? T extends WordToken
    ? Omit<T, "word">
    : never
  : never;

/**
 * The phrases, longest first at match time. Every entry here is something a
 * person actually says; the table is deliberately generous, because a caller
 * who has to learn which of "to the power of" and "raised to" is the supported
 * one has gained nothing over typing `^`.
 */
const PHRASES: Readonly<Record<string, Spec>> = {
  // Arithmetic.
  plus: { type: "op", op: "+" },
  "added to": { type: "op", op: "+" },
  minus: { type: "op", op: "-" },
  "take away": { type: "op", op: "-" },
  // "negative" is the same symbol; only its position makes it a negation, and
  // the parser is where position is known.
  negative: { type: "op", op: "-" },
  times: { type: "op", op: "\\times" },
  multiplied: { type: "op", op: "\\times" },
  "multiplied by": { type: "op", op: "\\times" },
  divided: { type: "op", op: "/" },
  "divided by": { type: "op", op: "/" },
  over: { type: "op", op: "/" },

  // Powers. "to the" is listed on its own for "two to the n", and loses to the
  // longer phrases that start with it because matching tries longest first.
  power: { type: "op", op: "^" },
  "to the": { type: "op", op: "^" },
  "to the power": { type: "op", op: "^" },
  "to the power of": { type: "op", op: "^" },
  "raised to": { type: "op", op: "^" },
  "raised to the power": { type: "op", op: "^" },
  "raised to the power of": { type: "op", op: "^" },
  "^": { type: "op", op: "^" },

  // Relations.
  equals: { type: "op", op: "=" },
  "equal to": { type: "op", op: "=" },
  "is equal to": { type: "op", op: "=" },
  "=": { type: "op", op: "=" },
  "does not equal": { type: "op", op: "\\ne" },
  "is not equal to": { type: "op", op: "\\ne" },
  "less than": { type: "op", op: "<" },
  "is less than": { type: "op", op: "<" },
  "greater than": { type: "op", op: ">" },
  "is greater than": { type: "op", op: ">" },
  "less than or equal to": { type: "op", op: "\\leq" },
  "is less than or equal to": { type: "op", op: "\\leq" },
  "greater than or equal to": { type: "op", op: "\\geq" },
  "is greater than or equal to": { type: "op", op: "\\geq" },
  "<": { type: "op", op: "<" },
  ">": { type: "op", op: ">" },

  // Grouping said before what it groups.
  "the quantity": { type: "quantity" },
  quantity: { type: "quantity" },
  "open bracket": { type: "open" },
  "open brackets": { type: "open" },
  "open paren": { type: "open" },
  "open parens": { type: "open" },
  "open parenthesis": { type: "open" },
  "open parentheses": { type: "open" },
  "left bracket": { type: "open" },
  "left paren": { type: "open" },
  "(": { type: "open" },
  "close bracket": { type: "close" },
  "close brackets": { type: "close" },
  "close paren": { type: "close" },
  "close parens": { type: "close" },
  "close parenthesis": { type: "close" },
  "close parentheses": { type: "close" },
  "right bracket": { type: "close" },
  "right paren": { type: "close" },
  ")": { type: "close" },

  // Grouping said after what it groups. "all" is the everyday form of it —
  // "x plus one all squared", "x plus one all over two".
  all: { type: "wrap" },
  "in brackets": { type: "wrap" },
  "in bracket": { type: "wrap" },
  "in parens": { type: "wrap" },
  "in parenthesis": { type: "wrap" },
  "in parentheses": { type: "wrap" },
  "all in brackets": { type: "wrap" },
  ",": { type: "comma" },

  // Postfixes.
  squared: { type: "postfix", postfix: "squared" },
  cubed: { type: "postfix", postfix: "cubed" },
  factorial: { type: "postfix", postfix: "factorial" },
  percent: { type: "postfix", postfix: "percent" },
  "per cent": { type: "postfix", postfix: "percent" },
  "%": { type: "postfix", postfix: "percent" },
  "!": { type: "postfix", postfix: "factorial" },

  // Roots. The ordinals match the ones `describe` reads out, so a description
  // of a radical reads back as the same radical.
  "square root": { type: "root", degree: null },
  root: { type: "root", degree: null },
  "second root": { type: "root", degree: null },
  "cube root": { type: "root", degree: "3" },
  "third root": { type: "root", degree: "3" },
  "fourth root": { type: "root", degree: "4" },
  "fifth root": { type: "root", degree: "5" },
  "nth root": { type: "root", degree: "n" },

  // Functions.
  sine: { type: "call", fn: "\\sin" },
  sin: { type: "call", fn: "\\sin" },
  cosine: { type: "call", fn: "\\cos" },
  cos: { type: "call", fn: "\\cos" },
  tangent: { type: "call", fn: "\\tan" },
  tan: { type: "call", fn: "\\tan" },
  "inverse sine": { type: "call", fn: "\\arcsin" },
  arcsine: { type: "call", fn: "\\arcsin" },
  "inverse cosine": { type: "call", fn: "\\arccos" },
  arccosine: { type: "call", fn: "\\arccos" },
  "inverse tangent": { type: "call", fn: "\\arctan" },
  arctangent: { type: "call", fn: "\\arctan" },
  "natural logarithm": { type: "call", fn: "\\ln" },
  "natural log": { type: "call", fn: "\\ln" },
  ln: { type: "call", fn: "\\ln" },
  logarithm: { type: "call", fn: "\\log" },
  log: { type: "call", fn: "\\log" },
  "absolute value": { type: "call", fn: "abs" },

  // Constants.
  pi: { type: "symbol", latex: "\\pi" },
  infinity: { type: "symbol", latex: "\\infty" },
};

const GREEK = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "theta",
  "lambda",
  "mu",
  "sigma",
  "phi",
  "omega",
];

/**
 * Words that carry no mathematics of their own: they are what makes a sentence
 * a sentence. Dropped only after the phrase table has had its turn, so "the"
 * still reaches "the quantity" and "to the power of".
 */
const FILLER = new Set(["the", "of"]);

const LONGEST_PHRASE = Math.max(...Object.keys(PHRASES).map((p) => p.split(" ").length));

/**
 * Everything the reader recognises as one word. A hyphen between two letters
 * joins them ("twenty-two" is one number, not a subtraction), which is why it
 * is rewritten to a space before the scan rather than lexed.
 */
const WORD = /\d+(?:\.\d+)?|\p{L}+|[(),^=<>%!]/gu;

function split(input: string): string[] {
  const joined = input.replace(/(\p{L})[-‐-―](\p{L})/gu, "$1 $2");
  return [...joined.toLowerCase().matchAll(WORD)].map((m) => m[0]);
}

/**
 * Words in, notation out. Nothing here knows about precedence or grouping —
 * this pass only decides what each run of words *is*.
 */
export function lexWords(input: string): WordToken[] {
  const words = split(input);
  const tokens: WordToken[] = [];
  let i = 0;

  while (i < words.length) {
    const phrase = matchPhrase(words, i);
    if (phrase !== null) {
      tokens.push({ ...phrase.spec, word: phrase.word } as WordToken);
      i += phrase.length;
      continue;
    }

    // Numbers are the number package's vocabulary, not this one's: digits,
    // cardinals and a spoken decimal point all arrive already read.
    const number = numberFromWords(words.slice(i));
    if (number !== null) {
      tokens.push({
        type: "number",
        latex: number.text,
        word: words.slice(i, i + number.consumed).join(" "),
      });
      i += number.consumed;
      continue;
    }

    const word = words[i] as string;
    if (FILLER.has(word)) {
      i += 1;
      continue;
    }

    const symbol = matchSymbol(word);
    if (symbol !== null) {
      tokens.push({ type: "symbol", latex: symbol, word });
      i += 1;
      continue;
    }

    throw new WordParseError(
      input,
      `${JSON.stringify(word)} is not a word it knows`,
      word,
    );
  }

  return tokens;
}

function matchPhrase(
  words: string[],
  at: number,
): { spec: Spec; word: string; length: number } | null {
  const most = Math.min(LONGEST_PHRASE, words.length - at);
  // Longest first: "is less than or equal to" must not be read as "less than".
  for (let length = most; length > 0; length -= 1) {
    const word = words.slice(at, at + length).join(" ");
    const spec = PHRASES[word];
    if (spec !== undefined) return { spec, word, length };
  }
  return null;
}

function matchSymbol(word: string): string | null {
  if (GREEK.includes(word)) return `\\${word}`;
  return /^\p{L}$/u.test(word) ? word : null;
}

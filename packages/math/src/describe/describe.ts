import type { ComputeEngine, Expression } from "@cortex-js/compute-engine";
import { spellNumber } from "@smartput/locale-en";
import type { MathJson } from "../types";

/**
 * What each operator is called out loud. Keyed by the notation as it is
 * written — LaTeX (`\times`, `\leq`) and the plain-text spellings people type
 * for the same thing (`*`, `/`) both resolve, because both reach this package
 * from a markdown file.
 *
 * This is the table a UI reads to caption a keypad, and the one a translator
 * replaces wholesale.
 */
export const OPERATOR_WORDS: Readonly<Record<string, string>> = {
  "+": "plus",
  "-": "minus",
  "*": "times",
  "\\times": "times",
  "\\cdot": "times",
  "/": "divided by",
  "\\div": "divided by",
  "\\frac": "fraction",
  "^": "power",
  _: "subscript",
  "\\sqrt": "square root",
  "=": "equals",
  "\\ne": "does not equal",
  "\\neq": "does not equal",
  "<": "less than",
  ">": "greater than",
  "\\leq": "less than or equal to",
  "\\le": "less than or equal to",
  "\\geq": "greater than or equal to",
  "\\ge": "greater than or equal to",
  "\\pm": "plus or minus",
  "!": "factorial",
  "%": "percent",
  "\\%": "percent",
  "\\infty": "infinity",
  "\\pi": "pi",
  "\\sum": "sum",
  "\\prod": "product",
  "\\int": "integral",
  "\\partial": "partial derivative",
  "\\to": "approaches",
  "\\in": "in",
  "\\cup": "union",
  "\\cap": "intersection",
};

/** The word for an operator, or null when there is no word for it. */
export function describeOperator(symbol: string): string | null {
  return OPERATOR_WORDS[symbol] ?? null;
}

/**
 * How the expression should be read, in the shape `Intl` uses: what to vary is
 * named, and each setting has a default that is what the reading was before
 * the setting existed.
 */
export interface DescribeOptions {
  /**
   * `"long"` (the default) reads as a sentence — "the quantity 2 plus 3,
   * squared". `"short"` reads as a caption: no articles, no "of" after a
   * function, and a bracket marked after what it holds rather than before —
   * "2 plus 3 in brackets squared".
   */
  style?: "long" | "short";
  /**
   * `"digits"` (the default) reads 12 as "12"; `"words"` reads it as "twelve".
   * A number with no words for it — one past the scale table — keeps its
   * digits either way.
   */
  numbers?: "digits" | "words";
}

interface Voice {
  short: boolean;
  words: boolean;
}

/**
 * Read an expression out in English: `1+2\times3` is "1 plus 2 times 3".
 *
 * Written for a caption or a screen reader. The vocabulary is the one
 * `latexFromWords` reads back, so an ordinary description — no matrices, no
 * operator this has no phrasing for — returns to the expression it came from.
 * Anything it has no phrasing for still gets read, using the operator's own
 * name, on the grounds that "GCD of 4 and 6" tells a listener more than
 * silence does.
 */
export function describeExpression(
  ce: ComputeEngine,
  expr: Expression,
  options: DescribeOptions = {},
): string {
  const voice: Voice = {
    short: options.style === "short",
    words: options.numbers === "words",
  };
  return phrase(ce, expr.json, voice);
}

function phrase(ce: ComputeEngine, json: MathJson, voice: Voice): string {
  if (!isNode(json)) return atom(ce, json, voice);
  const [operator, ...operands] = json as unknown as [string, ...MathJson[]];
  const parts = operands.map((operand) => phrase(ce, operand, voice));

  switch (operator) {
    case "Add":
      return parts.join(" plus ");
    case "Subtract":
      return parts.join(" minus ");
    case "Multiply":
      return parts.join(" times ");
    // "over" is the short reading of a division, and the one that fits in a
    // caption: "1 over 2" against "1 divided by 2".
    case "Divide":
    case "Rational":
      return parts.join(voice.short ? " over " : " divided by ");
    case "Negate":
      return `negative ${parts[0]}`;
    case "Power":
      return power(parts[0] ?? "", operands[0], operands[1], parts[1] ?? "", voice);
    case "Square":
      return `${parts[0]} squared`;
    case "Sqrt":
      return applied("the square root", parts[0] ?? "", voice);
    case "Root":
      return applied(`the ${ordinal(operands[1])} root`, parts[0] ?? "", voice);
    case "Abs":
      return applied("the absolute value", parts[0] ?? "", voice);
    // Said where it is written, not as a function of what it applies to: "5
    // factorial" is both how it is read and something that reads back.
    case "Factorial":
      return `${parts[0]} factorial`;
    case "Equal":
      return parts.join(" equals ");
    case "NotEqual":
      return parts.join(" does not equal ");
    case "Less":
      return parts.join(copula("less than", voice));
    case "Greater":
      return parts.join(copula("greater than", voice));
    case "LessEqual":
      return parts.join(copula("less than or equal to", voice));
    case "GreaterEqual":
      return parts.join(copula("greater than or equal to", voice));
    // A bracketed part is one thing to a reader, so it is named as one. Which
    // side the marker goes on is the whole difference between the two styles:
    // the long form announces the bracket, the short form closes it.
    case "Delimiter":
      return voice.short ? `${parts[0]} in brackets` : `the quantity ${parts[0]}`;
    case "D":
    case "Derivative":
      return `${article("the derivative", voice)} of ${parts[0]} with respect to ${parts[1]}`;
    case "Integrate":
      return `${article("the integral", voice)} of ${parts[0]}`;
    case "Matrix":
      return matrix(ce, json);
    case "List":
      return list(parts);
    default:
      return named(operator, parts, voice);
  }
}

const NAMED_FUNCTIONS: Readonly<Record<string, string>> = {
  Sin: "the sine",
  Cos: "the cosine",
  Tan: "the tangent",
  Arcsin: "the inverse sine",
  Arccos: "the inverse cosine",
  Arctan: "the inverse tangent",
  Ln: "the natural logarithm",
  Log: "the logarithm",
  Exp: "e to the power",
};

/**
 * A function whose name this knows loses its "of" along with its article —
 * "sine x" is how a caption says it. One it does not know keeps both, because
 * "GCD 4 and 6" is not a reading of anything.
 */
function named(operator: string, parts: readonly string[], voice: Voice): string {
  const known = NAMED_FUNCTIONS[operator];
  if (known === undefined) return `${operator} of ${list(parts)}`;
  return applied(known, list(parts), voice);
}

/** A named thing and what it is applied to: "the sine of x", or "sine x". */
function applied(name: string, argument: string, voice: Voice): string {
  return voice.short ? `${article(name, voice)} ${argument}` : `${name} of ${argument}`;
}

/** The same name without its article, for a style that has no room for one. */
function article(name: string, voice: Voice): string {
  return voice.short ? name.replace(/^the /, "") : name;
}

/** "x is less than 3" reads as a sentence; "x less than 3" as a caption. */
function copula(relation: string, voice: Voice): string {
  return voice.short ? ` ${relation} ` : ` is ${relation} `;
}

/**
 * A power over a compound base has to say where the base ends. Spoken long,
 * that is a pause: "the quantity 2 plus 3, squared" is heard as one thing
 * raised to a power, where the same words without the pause are heard as "the
 * quantity 2, plus 3 squared" — the other expression entirely. Spoken short,
 * the bracket is already said after the base, and a base that never had one
 * gets one rather than a comma a caption would not show.
 */
function power(
  base: string,
  baseJson: MathJson | undefined,
  exponentJson: MathJson | undefined,
  exponent: string,
  voice: Voice,
): string {
  const head = voice.short ? bracketed(base, baseJson) : base + pause(baseJson);
  if (exponentJson === 2) return `${head} squared`;
  if (exponentJson === 3) return `${head} cubed`;
  return `${head} ${voice.short ? "power" : "to the power"} ${exponent}`;
}

function pause(baseJson: MathJson | undefined): string {
  return isCompound(baseJson) ? "," : "";
}

function bracketed(base: string, baseJson: MathJson | undefined): string {
  if (!isCompound(baseJson)) return base;
  // A Delimiter has already read itself out as "… in brackets".
  return isDelimiter(baseJson) ? base : `${base} in brackets`;
}

const COMPOUND_OPERATORS = new Set([
  "Delimiter",
  "Add",
  "Subtract",
  "Multiply",
  "Divide",
  "Rational",
]);

function isCompound(json: MathJson | undefined): boolean {
  if (json === undefined || !isNode(json)) return false;
  return COMPOUND_OPERATORS.has((json as unknown as [string])[0]);
}

function isDelimiter(json: MathJson | undefined): boolean {
  if (json === undefined || !isNode(json)) return false;
  return (json as unknown as [string])[0] === "Delimiter";
}

function ordinal(json: MathJson | undefined): string {
  const ORDINALS = ["zeroth", "first", "second", "third", "fourth", "fifth"];
  return typeof json === "number" ? (ORDINALS[json] ?? `${json}th`) : "nth";
}

/** `1, 2 and 3` — spoken lists need the "and", written ones read as a run-on. */
function list(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * A matrix is read by its shape. Reading out sixteen entries of a 4×4 is not a
 * description, it is a transcription, and the caller already has the LaTeX if
 * that is what they wanted.
 */
function matrix(ce: ComputeEngine, json: MathJson): string {
  const shape = ce.box(json).evaluate().shape;
  const [rows, columns] = shape;
  if (rows === undefined) return "a matrix";
  if (columns === undefined) return `a vector of ${rows} entries`;
  return `a ${rows} by ${columns} matrix`;
}

function atom(ce: ComputeEngine, json: MathJson, voice: Voice): string {
  if (typeof json === "string") return json;
  if (typeof json === "number") {
    return (voice.words ? spellNumber(json) : null) ?? String(json);
  }
  return ce.box(json, { form: "raw" }).latex;
}

function isNode(json: MathJson): boolean {
  return Array.isArray(json) && typeof json[0] === "string";
}

import type { ComputeEngine, Expression } from "@cortex-js/compute-engine";
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
 * Read an expression out in English: `1+2\times3` is "1 plus 2 times 3".
 *
 * Written for a caption or a screen reader, not for round-tripping — the
 * sentence is not parseable back into the expression, and does not try to be.
 * Anything this has no phrasing for still gets read, using the operator's own
 * name, on the grounds that "Gcd of 4 and 6" tells a listener more than
 * silence does.
 */
export function describeExpression(ce: ComputeEngine, expr: Expression): string {
  return phrase(ce, expr.json);
}

function phrase(ce: ComputeEngine, json: MathJson): string {
  if (!isNode(json)) return atom(ce, json);
  const [operator, ...operands] = json as unknown as [string, ...MathJson[]];
  const parts = operands.map((operand) => phrase(ce, operand));

  switch (operator) {
    case "Add":
      return parts.join(" plus ");
    case "Subtract":
      return parts.join(" minus ");
    case "Multiply":
      return parts.join(" times ");
    case "Divide":
    case "Rational":
      return parts.join(" divided by ");
    case "Negate":
      return `negative ${parts[0]}`;
    case "Power":
      return power(parts[0] ?? "", operands[0], operands[1], parts[1] ?? "");
    case "Square":
      return `${parts[0]} squared`;
    case "Sqrt":
      return `the square root of ${parts[0]}`;
    case "Root":
      return `the ${ordinal(operands[1])} root of ${parts[0]}`;
    case "Abs":
      return `the absolute value of ${parts[0]}`;
    case "Equal":
      return parts.join(" equals ");
    case "NotEqual":
      return parts.join(" does not equal ");
    case "Less":
      return parts.join(" is less than ");
    case "Greater":
      return parts.join(" is greater than ");
    case "LessEqual":
      return parts.join(" is less than or equal to ");
    case "GreaterEqual":
      return parts.join(" is greater than or equal to ");
    // A bracketed part is one thing to a reader, so it is named as one. The
    // comma is what keeps "the quantity 2 plus 3, squared" from being heard as
    // "the quantity 2, plus 3 squared".
    case "Delimiter":
      return `the quantity ${parts[0]}`;
    case "D":
    case "Derivative":
      return `the derivative of ${parts[0]} with respect to ${parts[1]}`;
    case "Integrate":
      return `the integral of ${parts[0]}`;
    case "Matrix":
      return matrix(ce, json);
    case "List":
      return list(parts);
    default:
      return `${functionName(operator)} of ${list(parts)}`;
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
  Factorial: "the factorial",
};

function functionName(operator: string): string {
  return NAMED_FUNCTIONS[operator] ?? operator;
}

/**
 * A power over a compound base gets a comma: "the quantity 2 plus 3, squared"
 * is heard as one thing raised to a power, where the same words without the
 * pause are heard as "the quantity 2, plus 3 squared" — the other expression
 * entirely.
 */
function power(
  base: string,
  baseJson: MathJson | undefined,
  exponentJson: MathJson | undefined,
  exponent: string,
): string {
  const pause = isCompound(baseJson) ? "," : "";
  if (exponentJson === 2) return `${base}${pause} squared`;
  if (exponentJson === 3) return `${base}${pause} cubed`;
  return `${base}${pause} to the power ${exponent}`;
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

function atom(ce: ComputeEngine, json: MathJson): string {
  if (typeof json === "string") return json;
  if (typeof json === "number") return String(json);
  return ce.box(json, { form: "raw" }).latex;
}

function isNode(json: MathJson): boolean {
  return Array.isArray(json) && typeof json[0] === "string";
}

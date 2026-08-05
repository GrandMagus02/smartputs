import type { ArithmeticRule } from "../types";

/**
 * MathJSON operator to the rule that operator stands for. Anything absent is
 * reported as a plain "evaluate", which covers the long tail of functions
 * (`\sin`, `\log`, `\gcd`, …) where naming the function adds nothing a reader
 * cannot already see in the step's own LaTeX.
 */
const RULE_BY_OPERATOR: Readonly<Record<string, ArithmeticRule>> = {
  Add: "add",
  Subtract: "subtract",
  Multiply: "multiply",
  Divide: "divide",
  Rational: "divide",
  Power: "power",
  Square: "power",
  Sqrt: "root",
  Root: "root",
  Negate: "negate",
  D: "differentiate",
  Derivative: "differentiate",
  Integrate: "integrate",
};

const TITLE_BY_RULE: Readonly<Record<ArithmeticRule, string>> = {
  add: "Add the terms",
  subtract: "Subtract",
  multiply: "Multiply the factors",
  divide: "Divide",
  power: "Raise to the power",
  root: "Take the root",
  negate: "Negate",
  differentiate: "Differentiate",
  integrate: "Integrate",
  evaluate: "Evaluate",
  substitute: "Substitute the known values",
  simplify: "Simplify",
  expand: "Expand",
  roots: "Read off the solutions",
};

export function ruleForOperator(operator: string): ArithmeticRule {
  return RULE_BY_OPERATOR[operator] ?? "evaluate";
}

/**
 * English for one of this package's own rules. Steps that come from the
 * compute engine's solver arrive with their description already written, and
 * are not looked up here.
 */
export function titleForRule(rule: ArithmeticRule): string {
  return TITLE_BY_RULE[rule];
}

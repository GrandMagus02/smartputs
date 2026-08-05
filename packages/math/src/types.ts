import type { Expression } from "@cortex-js/compute-engine";

/** MathJSON: the serialisable form of an expression tree. */
export type MathJson = Expression["json"];

/**
 * What was done in one step. `rule` is the stable machine name to branch or
 * translate on; `title` is the English sentence for a UI that has no
 * translation of its own.
 */
export type ArithmeticRule =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "power"
  | "root"
  | "negate"
  | "differentiate"
  | "integrate"
  | "evaluate"
  | "substitute"
  | "simplify"
  | "expand"
  | "roots";

/**
 * The rule a step applied. Arithmetic steps use the names above; algebraic
 * ones carry the compute engine's own frozen ids — `solve.linear`,
 * `solve.quadratic-formula`, `derivative.power-rule` — which the library
 * documents as the localisation key for that rule. The open half of the union
 * is what lets those through without this package having to re-declare a list
 * that grows on the other side of the dependency.
 */
export type StepRule = ArithmeticRule | (string & Record<never, never>);

export interface Step {
  readonly rule: StepRule;
  readonly title: string;
  /** The whole expression before this step, as LaTeX. */
  readonly before: string;
  /** The whole expression after this step, as LaTeX. */
  readonly after: string;
  /**
   * The rewrite on its own — `\frac{1}{2}+\frac{1}{3}=\frac{5}{6}` — without
   * the surrounding expression. For a step deep inside a long expression this
   * is the part worth showing; `before`/`after` give it its context. Absent on
   * steps that have no smaller rewrite to point at.
   */
  readonly detail?: string;
}

export interface EvaluateResult {
  /** The LaTeX that was handed in. */
  readonly input: string;
  /** The exact result as LaTeX: `\frac{5}{6}`, not `0.8333`. */
  readonly latex: string;
  /**
   * The result as a decimal, or null when it has no numeric value — an
   * expression with free symbols, or a symbolic result like `x+4`.
   */
  readonly approx: number | null;
  readonly steps: readonly Step[];
}

export interface SolveResult {
  readonly input: string;
  readonly variable: string;
  /** Every solution found, as exact LaTeX. Empty when there is none. */
  readonly solutions: readonly string[];
  readonly steps: readonly Step[];
}

/** Values bound to free symbols before an expression is evaluated. */
export type Bindings = Readonly<Record<string, number | string>>;

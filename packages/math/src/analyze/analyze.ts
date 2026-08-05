import type { ComputeEngine, Expression } from "@cortex-js/compute-engine";
import { solveEquation } from "../solve/solve";
import type { AnalysisResult, Parity, TurningPoint } from "../types";

/**
 * Everything that can be said about a function from its formula alone: where
 * it crosses zero, where it turns and which way, what it does at the origin,
 * and whether it is symmetric.
 *
 * The roots carry the solver's own working in `steps`, so "the roots are -2
 * and 2" can be shown as the quadratic formula that produced them.
 *
 * A question that has no answer for this function is reported as null or an
 * empty list — `\frac{1}{x}` has no value at zero and no root — rather than as
 * an error. Analysis that throws when part of it does not apply cannot be run
 * on an unknown function, which is the only time anyone wants to run it.
 */
export function analyzeFunction(
  ce: ComputeEngine,
  expr: Expression,
  variable: string,
  input: string,
): AnalysisResult {
  const f = ce.box(expr.json);
  const first = ce.box(["D", f.json, variable]).evaluate();
  const second = ce.box(["D", first.json, variable]).evaluate();

  const solved = solveEquation(ce, expr, variable, input);
  // `x^2+1` is solvable over the complex numbers and crosses zero nowhere on a
  // graph. Both facts are worth having, so the real roots — the ones a reader
  // means by "the roots" — are kept apart from the rest.
  const real = solved.solutions.filter((root) => isReal(ce, root));

  return {
    input,
    variable,
    latex: f.latex,
    roots: real,
    complexRoots: solved.solutions.filter((root) => !isReal(ce, root)),
    steps: solved.steps,
    valueAtZero: exactValue(ce, f, variable, 0),
    derivative: first.latex,
    secondDerivative: second.latex,
    turningPoints: turningPoints(ce, f, first, second, variable, input),
    parity: parity(ce, f, variable),
  };
}

/**
 * The turning points, each classified by the sign of the second derivative
 * there — positive is a minimum, negative a maximum, zero neither, which for
 * a smooth function means an inflection.
 */
function turningPoints(
  ce: ComputeEngine,
  f: Expression,
  first: Expression,
  second: Expression,
  variable: string,
  input: string,
): TurningPoint[] {
  const stationary = solveEquation(ce, first, variable, input).solutions;
  const points: TurningPoint[] = [];
  for (const at of stationary) {
    const point = ce.parse(at);
    const value = exactValue(ce, f, variable, point);
    if (value === null) continue;
    const curvature = substitute(ce, second, variable, point);
    points.push({ at, value, kind: classify(curvature) });
  }
  return points.sort((a, b) => numeric(ce, a.at) - numeric(ce, b.at));
}

function classify(curvature: Expression | null): TurningPoint["kind"] {
  if (curvature === null) return "unknown";
  if (curvature.is(0)) return "inflection";
  const sign = curvature.re;
  if (!Number.isFinite(sign)) return "unknown";
  return sign > 0 ? "minimum" : "maximum";
}

/**
 * Even means `f(-x)` is `f(x)`, odd means it is `-f(x)`. Both are decided
 * symbolically: sampling would answer "even" for any function that happens to
 * agree with its mirror image at the points sampled.
 */
function parity(ce: ComputeEngine, f: Expression, variable: string): Parity {
  const mirrored = f.subs({ [variable]: ce.box(["Negate", variable]) }).simplify();
  if (mirrored.isSame(f.simplify())) return "even";
  if (mirrored.isSame(ce.box(["Negate", f.json]).simplify())) return "odd";
  return "neither";
}

/** The exact value at a point, or null where the function is undefined. */
function exactValue(
  ce: ComputeEngine,
  f: Expression,
  variable: string,
  at: number | Expression,
): string | null {
  const value = substitute(ce, f, variable, at);
  return value === null ? null : value.latex;
}

function substitute(
  ce: ComputeEngine,
  f: Expression,
  variable: string,
  at: number | Expression,
): Expression | null {
  const point = typeof at === "number" ? ce.box(at) : at;
  const value = f.subs({ [variable]: point }).evaluate();
  // `\frac{1}{x}` at zero evaluates to complex infinity, which is a value the
  // engine is happy to hand back and a reader would call undefined. Finiteness
  // is checked numerically; the exact form is what gets kept.
  if (!value.isValid || !Number.isFinite(value.N().re)) return null;
  return value;
}

function isReal(ce: ComputeEngine, latex: string): boolean {
  return Number.isFinite(ce.parse(latex).N().re) && ce.parse(latex).N().im === 0;
}

function numeric(ce: ComputeEngine, latex: string): number {
  const value = ce.parse(latex).N().re;
  return Number.isFinite(value) ? value : 0;
}

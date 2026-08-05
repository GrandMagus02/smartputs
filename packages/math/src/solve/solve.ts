import type { ComputeEngine, Expression } from "@cortex-js/compute-engine";
import { MathSolveError } from "../errors";
import { titleForRule } from "../steps/label";
import type { SolveResult, Step } from "../types";

/**
 * Solve for a variable, with the working.
 *
 * The steps are the compute engine's own: `explain('solve')` returns the chain
 * of rules its solver actually fired — move every term to one side, isolate the
 * unknown, apply the quadratic formula, take the inverse sine — each with a
 * frozen machine id and an English description. Those ids are the localisation
 * keys the library documents, so they are passed through as `Step.rule`
 * verbatim rather than re-derived here: a narration written on this side of the
 * boundary would be a guess about what the solver did, and would drift from it
 * the moment the solver learned a new rule.
 *
 * What is added here is the `before`/`after` framing — `explain` reports only
 * the state *after* each step — and a closing step for the equations whose rule
 * chain stops before the answers are on the page.
 */
export function solveEquation(
  ce: ComputeEngine,
  expr: Expression,
  variable: string,
  input: string,
): SolveResult {
  const equation = ce.box(expr.json);
  if (!equation.unknowns.includes(variable)) {
    throw new MathSolveError(input, variable, `it does not contain ${variable}`);
  }

  // A bare expression means "= 0" — the way a root is usually written in a
  // note: `x^2-4`, with the `=0` left implied. The engine's solver wants the
  // equation spelled out.
  const asEquation =
    equation.operator === "Equal" ? equation : ce.box(["Equal", equation, 0]);

  const explanation = asEquation.explain("solve", { variable });
  const steps: Step[] = [];
  let before = explanation.initial.latex;
  for (const step of explanation.steps) {
    const after = step.value.latex;
    steps.push({ rule: step.id, title: step.description, before, after });
    before = after;
  }

  // `solve` answers a *system* with a map of variable to value; a single
  // equation always comes back as a list, and that is the only shape reachable
  // from here — `parseLatex` of one expression cannot produce a system.
  const found = asEquation.solve(variable) as unknown as readonly Expression[] | null;
  const solutions = sortSolutions(found ?? []).map((s) => s.latex);
  const answer = solutionLatex(variable, solutions);
  // `2x+6=0` ends on `x=-3`, which is already the answer; `x+1=x+2` ends on
  // `-1=0`, which is not. Only the second needs the closing step.
  if (steps.at(-1)?.after !== answer) {
    steps.push({ rule: "roots", title: titleForRule("roots"), before, after: answer });
  }

  return { input, variable, solutions, steps };
}

/** Numeric solutions ascending; anything symbolic keeps the engine's order. */
function sortSolutions(solutions: readonly Expression[]): Expression[] {
  const numeric = solutions.filter((s) => Number.isFinite(s.re));
  const symbolic = solutions.filter((s) => !Number.isFinite(s.re));
  numeric.sort((x, y) => (x.re as number) - (y.re as number));
  return [...numeric, ...symbolic];
}

function solutionLatex(variable: string, solutions: readonly string[]): string {
  if (solutions.length === 0) return "\\text{no solution}";
  return solutions.map((solution) => `${variable}=${solution}`).join(",\\ ");
}

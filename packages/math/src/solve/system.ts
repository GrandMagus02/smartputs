import type { ComputeEngine, Expression } from "@cortex-js/compute-engine";
import { MathSolveError } from "../errors";
import { parseLatex } from "../parse";
import { explainedSteps } from "../steps/explained";
import { titleForRule } from "../steps/label";
import type { Step, SystemResult } from "../types";

export interface SystemOptions {
  /**
   * Which unknowns to solve for. Defaults to every symbol the equations
   * mention, in the order they first appear.
   */
  variables?: readonly string[];
}

/**
 * Solve several equations together.
 *
 * The equations can arrive as a list, as one block of lines the way they are
 * written in a note, or as a LaTeX `cases` environment — all three are the
 * same system, and which one a caller has is an accident of where they copied
 * it from.
 *
 * A system with no solution is an answer, not a failure: `consistent` is false
 * and `solutions` is null, with the elimination that got there still in
 * `steps`. Only a system with nothing in it throws.
 */
export function solveSystem(
  ce: ComputeEngine,
  input: string | readonly string[],
  options: SystemOptions,
): SystemResult {
  const equations = splitEquations(input);
  if (equations.length === 0) {
    throw new MathSolveError(asText(input), "?", "it has no equations");
  }

  const parsed = equations.map((equation) => ce.box(parseLatex(ce, equation).json));
  const system = ce.box(["List", ...parsed.map((equation) => equation.json)]);
  const variables = options.variables ?? collectUnknowns(parsed);

  const steps: Step[] = explainSystem(system, variables);

  const found = system.solve([...variables]) as unknown as Record<
    string,
    Expression
  > | null;
  const solutions = found === null ? null : readSolutions(ce, found, variables);
  if (solutions === null) {
    steps.push({
      rule: "roots",
      title: titleForRule("roots"),
      before: steps.at(-1)?.after ?? system.latex,
      after: "\\text{no solution}",
    });
  }

  return {
    input: asText(input),
    equations,
    variables: [...variables],
    consistent: solutions !== null,
    solutions,
    steps,
  };
}

/**
 * The solver narrates the systems it has a strategy for — square ones it can
 * eliminate and back-substitute through. An overdetermined system (three
 * equations, two unknowns) has no such chain, and `explain` says so by
 * throwing. That is not a failure of the request: the answer, solution or
 * contradiction, still comes from `solve` below. So the steps are simply
 * empty, and the caller still gets the verdict.
 */
function explainSystem(system: Expression, variables: readonly string[]): Step[] {
  try {
    const explanation = system.explain("solve", {
      variables: [...variables],
    } as never);
    return explainedSteps(system.latex, explanation.steps);
  } catch {
    return [];
  }
}

/**
 * `\begin{cases}…\end{cases}` and a plain block of lines are both systems as
 * written; `\\` is the row separator inside the first and a line break in the
 * second, so both count as ends of an equation.
 */
function splitEquations(input: string | readonly string[]): string[] {
  const lines = typeof input === "string" ? [input] : input;
  return lines
    .flatMap((line) =>
      line
        .replace(/\\begin\{(cases|aligned|array)\}(\{[^}]*\})?/g, "")
        .replace(/\\end\{(cases|aligned|array)\}/g, "")
        .split(/\n|\\\\/),
    )
    .map((equation) => equation.replaceAll("&", "").trim())
    .filter((equation) => equation.length > 0);
}

function asText(input: string | readonly string[]): string {
  return typeof input === "string" ? input : input.join("\n");
}

/** Every unknown in the system, in the order the equations introduce them. */
function collectUnknowns(equations: readonly Expression[]): string[] {
  const seen: string[] = [];
  for (const equation of equations) {
    for (const unknown of equation.unknowns) {
      if (!seen.includes(unknown)) seen.push(unknown);
    }
  }
  return seen;
}

/**
 * The solver answers a system with a map of unknown to value. It is rebuilt
 * here in the caller's variable order, and as LaTeX, so a caller can print the
 * answers without touching a boxed expression.
 */
function readSolutions(
  ce: ComputeEngine,
  found: Record<string, Expression>,
  variables: readonly string[],
): Record<string, string> {
  const solutions: Record<string, string> = {};
  for (const variable of variables) {
    const value = found[variable];
    if (value === undefined) continue;
    solutions[variable] = ce.box(value.json ?? value).latex;
  }
  return solutions;
}

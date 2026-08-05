import type { Expression } from "@cortex-js/compute-engine";
import type { Step } from "../types";

/** One step as the compute engine's `explain()` reports it. */
export interface ExplainedStep {
  readonly id: string;
  readonly description: string;
  readonly value: Expression;
}

/**
 * Turn the engine's explanation into steps. It reports the state *after* each
 * rule fires; a reader needs both ends, so each step starts where the one
 * before it finished, and the first starts at the expression as given.
 *
 * The ids and descriptions are passed through untouched: they are the
 * library's documented localisation keys, and a rule this package has never
 * heard of still arrives with a usable English sentence attached.
 */
export function explainedSteps(
  initial: string,
  explained: readonly ExplainedStep[],
): Step[] {
  const steps: Step[] = [];
  let before = initial;
  for (const step of explained) {
    const after = step.value.latex;
    steps.push({ rule: step.id, title: step.description, before, after });
    before = after;
  }
  return steps;
}

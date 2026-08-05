import type { ComputeEngine, Expression } from "@cortex-js/compute-engine";
import { loadIntegrationRules } from "@cortex-js/compute-engine/integration-rules";
import { MathSolveError, UnboundSymbolError } from "./errors";
import { createComputeEngine, parseLatex } from "./parse";
import { solveEquation } from "./solve/solve";
import { titleForRule } from "./steps/label";
import { traceEvaluate } from "./steps/trace";
import type { Bindings, EvaluateResult, MathJson, SolveResult, Step } from "./types";

export interface EvaluateOptions {
  /** Values for free symbols, substituted before anything is evaluated. */
  bindings?: Bindings;
  /**
   * Throw UnboundSymbolError instead of returning a symbolic answer. For a
   * caller that wants a number — a spreadsheet cell, a unit conversion —
   * `2x+1` coming back as `2x+1` is a failure wearing a success's clothes.
   */
  requireNumber?: boolean;
}

export interface SolveOptions {
  /** Which symbol to solve for. Inferred when the equation has exactly one. */
  variable?: string;
}

export interface CalculusOptions {
  /** Which symbol to work with respect to. Inferred from a lone symbol. */
  variable?: string;
}

export interface SimplifyResult {
  readonly input: string;
  readonly latex: string;
  readonly steps: readonly Step[];
}

export interface MathEngine {
  evaluate(latex: string, options?: EvaluateOptions): EvaluateResult;
  simplify(latex: string): SimplifyResult;
  solve(latex: string, options?: SolveOptions): SolveResult;
  /** Derivative with respect to `variable`, with the rules that produced it. */
  differentiate(latex: string, options?: CalculusOptions): SimplifyResult;
  /** Antiderivative with respect to `variable`, with the rules it used. */
  integrate(latex: string, options?: CalculusOptions): SimplifyResult;
}

/**
 * A math engine over LaTeX — the notation `$…$` blocks in markdown are written
 * in. Every method takes LaTeX in and gives LaTeX back, so a result can be
 * rendered by whatever already renders the source.
 *
 * Each engine owns its compute engine, and with it the symbol table: bindings
 * handed to one `evaluate` call never reach another engine.
 */
export function createMathEngine(): MathEngine {
  const ce = createComputeEngine();
  return {
    evaluate: (latex, options = {}) => evaluate(ce, latex, options),
    simplify: (latex) => simplify(ce, latex),
    solve: (latex, options = {}) => solve(ce, latex, options),
    differentiate: (latex, options = {}) => calculus(ce, "D", latex, options),
    integrate: (latex, options = {}) => calculus(ce, "Integrate", latex, options),
  };
}

function evaluate(
  ce: ComputeEngine,
  latex: string,
  options: EvaluateOptions,
): EvaluateResult {
  const parsed = parseLatex(ce, latex);
  const steps: Step[] = [];

  const bindings = options.bindings ?? {};
  const substituted = substitute(ce, parsed.json, bindings);
  const after = ce.box(substituted, { form: "raw" }).latex;
  // Compared as LaTeX, never by identity: `parsed.json` builds a fresh tree on
  // every access, so `substituted !== parsed.json` holds even when nothing was
  // substituted, and every evaluation gained a step that changed nothing.
  if (after !== parsed.latex) {
    steps.push({
      rule: "substitute",
      title: titleForRule("substitute"),
      before: parsed.latex,
      after,
      detail: Object.entries(bindings)
        .map(([symbol, value]) => `${symbol}=${value}`)
        .join(",\\ "),
    });
  }

  const traced = traceEvaluate(ce, ce.box(substituted, { form: "raw" }));
  steps.push(...traced.steps);

  const unbound = traced.value.unknowns;
  if (options.requireNumber === true && unbound.length > 0) {
    throw new UnboundSymbolError(latex, [...unbound]);
  }

  const approx = traced.value.N().re;
  return {
    input: latex,
    latex: traced.value.latex,
    approx: Number.isFinite(approx) ? approx : null,
    steps,
  };
}

/**
 * Simplify, with the rule chain the engine actually fired — `expand`,
 * `power-of-product`, and the rest, each with its frozen id.
 *
 * Some simplifications leave no chain behind: canonicalisation folds
 * `\sqrt{16}+x` to `x+4` on the way in, before any rule gets a chance to fire.
 * The result still changed, and a result that changed with nothing to show for
 * it reads as a bug, so that case gets one plain `simplify` step.
 */
function simplify(ce: ComputeEngine, latex: string): SimplifyResult {
  const parsed = parseLatex(ce, latex);
  const explanation = ce.box(parsed.json).explain("simplify");
  const result = explanation.result.latex;

  const steps = explainedSteps(explanation.initial.latex, explanation.steps);
  if (steps.length === 0 && result !== parsed.latex) {
    steps.push({
      rule: "simplify",
      title: titleForRule("simplify"),
      before: parsed.latex,
      after: result,
    });
  }
  return { input: latex, latex: result, steps };
}

function solve(ce: ComputeEngine, latex: string, options: SolveOptions): SolveResult {
  const parsed = parseLatex(ce, latex);
  const variable = options.variable ?? inferVariable(ce, parsed.json, latex);
  return solveEquation(ce, parsed, variable, latex);
}

/**
 * Differentiate or integrate, with the calculus rules the engine fired —
 * `derivative.power-rule`, `derivative.product-rule`, and their integration
 * counterparts.
 *
 * Symbolic integration is the one operation whose rules are not loaded with
 * the library: the Rubi rule set is large enough that the compute engine ships
 * it as a separate entry point and refuses `explain('Integrate')` until it is
 * registered. It is loaded here on first use rather than in
 * `createMathEngine`, so an engine that only ever adds fractions never pays
 * for it.
 */
function calculus(
  ce: ComputeEngine,
  operation: "D" | "Integrate",
  latex: string,
  options: CalculusOptions,
): SimplifyResult {
  const parsed = parseLatex(ce, latex);
  const variable = options.variable ?? inferVariable(ce, parsed.json, latex);
  if (operation === "Integrate") loadIntegrationRulesOnce(ce);

  const explanation = ce.box(parsed.json).explain(operation, { variable });
  return {
    input: latex,
    latex: explanation.result.latex,
    steps: explainedSteps(explanation.initial.latex, explanation.steps),
  };
}

const WITH_INTEGRATION_RULES = new WeakSet<ComputeEngine>();

function loadIntegrationRulesOnce(ce: ComputeEngine): void {
  if (WITH_INTEGRATION_RULES.has(ce)) return;
  // The loader is typed against the engine's interface, which declares
  // `_deadline` as required where the class declares it optional. Same object
  // at runtime; under `exactOptionalPropertyTypes` the two forms do not match,
  // and one cast here is cheaper than relaxing the flag for the package.
  loadIntegrationRules(ce as unknown as Parameters<typeof loadIntegrationRules>[0]);
  WITH_INTEGRATION_RULES.add(ce);
}

/**
 * Turn the engine's explanation into steps. It reports the state *after* each
 * rule; a reader needs both ends, so each step starts where the last one
 * finished.
 */
function explainedSteps(
  initial: string,
  explained: readonly { id: string; description: string; value: Expression }[],
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

/**
 * With one unknown there is nothing to choose. With several, choosing is
 * guessing: `x+y=1` solved "for x" when the writer meant y is a wrong answer
 * delivered without a warning, so ask instead.
 */
function inferVariable(ce: ComputeEngine, json: MathJson, latex: string): string {
  const unknowns = ce.box(json).unknowns;
  const only = unknowns[0];
  if (unknowns.length === 1 && only !== undefined) return only;
  if (unknowns.length === 0) {
    throw new MathSolveError(latex, "?", "it has no unknown to solve for");
  }
  throw new MathSolveError(
    latex,
    "?",
    `it has several unknowns (${unknowns.join(", ")}); pass one as options.variable`,
  );
}

/**
 * Replace bound symbols in the tree as written, rather than going through the
 * compute engine's own substitution, which canonicalises on the way through:
 * `x^2+1` with `x=3` has to read `3^2+1` in the step before it reads `10`.
 */
function substitute(ce: ComputeEngine, json: MathJson, bindings: Bindings): MathJson {
  if (Object.keys(bindings).length === 0) return json;
  const walk = (node: MathJson): MathJson => {
    if (typeof node === "string") {
      const bound = bindings[node];
      if (bound === undefined) return node;
      return typeof bound === "number" ? bound : parseLatex(ce, bound).json;
    }
    if (!Array.isArray(node)) return node;
    const [operator, ...operands] = node as MathJson[];
    return [operator, ...operands.map(walk)] as MathJson;
  };
  return walk(json);
}

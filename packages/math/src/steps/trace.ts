import type { ComputeEngine, Expression } from "@cortex-js/compute-engine";
import type { MathJson, Step } from "../types";
import { ruleForOperator, titleForRule } from "./label";

export interface TraceResult {
  /** The fully evaluated expression. */
  readonly value: Expression;
  readonly steps: readonly Step[];
}

interface TraceContext {
  readonly ce: ComputeEngine;
  readonly steps: Step[];
  /** The working tree, rewritten in place as each step lands. */
  root: MathJson;
}

/**
 * Evaluate an expression innermost-first, recording one step per rewrite that
 * a reader would recognise as a move — `1+2\times3` becomes `1+6`, then `7`.
 *
 * Two rewrites are deliberately *not* reported. Ones that leave the LaTeX
 * unchanged (`\frac{1}{2}` is already `\frac{1}{2}`, whatever the engine calls
 * it internally) and ones that only reorder the terms of a commutative
 * operator (`4+x` to `x+4`). Both are true of the tree and meaningless on the
 * page; emitting them buries the steps that carry the work.
 *
 * The expression is expected to be non-canonical — see `parseLatex`. Handing in
 * a canonical expression is not an error, but the engine will already have done
 * the constant folding, so there is nothing left to narrate.
 */
export function traceEvaluate(ce: ComputeEngine, expr: Expression): TraceResult {
  const ctx: TraceContext = { ce, steps: [], root: expr.json };
  rewrite(ctx, []);
  return { value: ce.box(ctx.root).evaluate(), steps: ctx.steps };
}

function rewrite(ctx: TraceContext, path: number[]): void {
  const node = nodeAt(ctx.root, path);
  if (!isOperatorNode(node)) return;

  // `\left(…\right)` survives the parse as a Delimiter wrapping its content.
  // It is punctuation, not arithmetic: recurse through it, and drop it once
  // what it wrapped has collapsed to a single term, so `(2+3)^2` reads
  // `5^2` rather than `(5)^2`.
  if (node[0] === "Delimiter") {
    rewrite(ctx, [...path, 1]);
    const inner = nodeAt(ctx.root, [...path, 1]);
    if (!isOperatorNode(inner)) commit(ctx, path, inner);
    return;
  }

  for (let i = 1; i < node.length; i++) rewrite(ctx, [...path, i]);

  const current = nodeAt(ctx.root, path);
  if (!isOperatorNode(current)) return;
  const evaluated = ctx.ce.box(current).evaluate();
  if (!isProgress(ctx, current, evaluated.json)) return;

  const before = render(ctx, ctx.root);
  const detailBefore = render(ctx, current);
  commit(ctx, path, evaluated.json);
  const after = render(ctx, ctx.root);
  const rule = ruleForOperator(current[0]);
  ctx.steps.push({
    rule,
    title: titleForRule(rule),
    before,
    after,
    detail: `${detailBefore}=${render(ctx, evaluated.json)}`,
  });
}

/**
 * Did the rewrite move the expression forward on the page? Structural change
 * alone is not enough: the engine normalises `["Divide",1,2]` to
 * `["Rational",1,2]`, which is a different tree that prints identically, and it
 * sorts the operands of commutative operators, which reorders a sum without
 * computing any part of it.
 */
function isProgress(ctx: TraceContext, current: MathJson, next: MathJson): boolean {
  if (render(ctx, current) === render(ctx, next)) return false;
  if (isOperatorNode(current) && isOperatorNode(next) && current[0] === next[0]) {
    if (COMMUTATIVE.has(current[0]) && sameOperands(current, next)) return false;
  }
  return true;
}

const COMMUTATIVE = new Set(["Add", "Multiply"]);

function sameOperands(a: readonly MathJson[], b: readonly MathJson[]): boolean {
  const key = (node: readonly MathJson[]) =>
    JSON.stringify(
      node
        .slice(1)
        .map((op) => JSON.stringify(op))
        .sort(),
    );
  return key(a) === key(b);
}

function render(ctx: TraceContext, json: MathJson): string {
  return ctx.ce.box(json, { form: "raw" }).latex;
}

function commit(ctx: TraceContext, path: number[], value: MathJson): void {
  ctx.root = replaceAt(ctx.root, path, value);
}

/**
 * A function node: `["Add", 1, 2]`. MathJSON types these as readonly tuples,
 * so the walk below goes through `unknown` to index and rebuild them — the
 * alternative is a parallel tree type that would have to track theirs.
 */
function isOperatorNode(json: MathJson): json is readonly [string, ...MathJson[]] {
  return Array.isArray(json) && typeof json[0] === "string";
}

function asArray(json: MathJson): MathJson[] {
  return json as unknown as MathJson[];
}

function nodeAt(root: MathJson, path: readonly number[]): MathJson {
  let node = root;
  for (const index of path) {
    if (!Array.isArray(node)) return node;
    node = asArray(node)[index] as MathJson;
  }
  return node;
}

function replaceAt(root: MathJson, path: readonly number[], value: MathJson): MathJson {
  if (path.length === 0) return value;
  const [index, ...rest] = path as [number, ...number[]];
  const copy = [...asArray(root)];
  copy[index] = replaceAt(copy[index] as MathJson, rest, value);
  return copy as unknown as MathJson;
}

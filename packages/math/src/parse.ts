import type { Expression } from "@cortex-js/compute-engine";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { MathParseError } from "./errors";

export type { ComputeEngine, Expression };

/**
 * One ComputeEngine per math engine instance. The engine caches parsed symbols
 * and assumptions on itself, so sharing a single module-level instance across
 * callers would let one caller's `x := 3` leak into another's expression.
 */
export function createComputeEngine(): ComputeEngine {
  return new ComputeEngine();
}

/**
 * Read LaTeX — the notation markdown files write between `$…$` — into an
 * expression tree.
 *
 * Parsed with `form: "raw"` on purpose. Canonical parsing is what the
 * compute engine does by default, and it folds `\frac12+\frac13` straight to
 * `5/6` *during the parse*: the addition is gone before anything can report it
 * as a step. Step tracing needs the expression as it was written, so
 * canonicalisation is deferred to the point where a value is actually wanted.
 */
export function parseLatex(ce: ComputeEngine, latex: string): Expression {
  const expr = ce.parse(latex, { form: "raw" });
  const errors = expr.errors;
  if (errors.length > 0) throw new MathParseError(latex, errors.map(describeError));
  return expr;
}

/**
 * `["Error", "'expected-closing-delimiter'", ["LatexString", "'{'"]]` is the
 * shape the engine reports; the quotes are part of the payload. Strip them and
 * keep the code plus whatever fragment it points at, which is the part a user
 * can act on.
 */
function describeError(error: Expression): string {
  const [, code, where] = error.json as unknown as unknown[];
  const parts = [unquote(code)];
  const at = where === undefined ? "" : unquote(Array.isArray(where) ? where[1] : where);
  if (at.length > 0) parts.push(`at ${at}`);
  return parts.join(" ");
}

function unquote(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.replace(/^'(.*)'$/, "$1");
}

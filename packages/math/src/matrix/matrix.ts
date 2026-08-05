import type { ComputeEngine, Expression } from "@cortex-js/compute-engine";
import { NotAMatrixError } from "../errors";
import type { MatrixResult } from "../types";

/**
 * Read a matrix and everything that can be said about it on its own:
 * shape, determinant, trace, transpose, inverse.
 *
 * Everything is exact — the inverse of `[[1,2],[3,4]]` has `\frac{3}{2}` in
 * it, not `1.5` — and everything comes back as LaTeX in `pmatrix` form, which
 * is what `matrixLatex` below is for: the engine computes matrices into plain
 * nested lists, and a nested list rendered as `[[1,3],[2,4]]` is not something
 * a reader recognises as the matrix they typed.
 */
export function inspectMatrix(
  ce: ComputeEngine,
  expr: Expression,
  input: string,
): MatrixResult {
  const matrix = ce.box(expr.json).evaluate();
  const [rows, columns] = matrix.shape;
  if (rows === undefined || columns === undefined || !isMatrixNode(matrix)) {
    throw new NotAMatrixError(input);
  }

  const isSquare = rows === columns;
  const determinant = isSquare ? evaluateOn(ce, "Determinant", matrix) : null;
  // A singular matrix has no inverse, and the engine says so by handing back
  // the request unevaluated — `[[1,2],[2,4]]^{-1}`. Echoing that as "the
  // inverse" would be worse than useless, so the determinant decides.
  const isSingular = determinant === null ? null : determinant.is(0);

  return {
    input,
    latex: matrixLatex(ce, matrix),
    rows,
    columns,
    isSquare,
    determinant: determinant?.latex ?? null,
    trace: isSquare ? (evaluateOn(ce, "Trace", matrix)?.latex ?? null) : null,
    transpose: matrixLatex(ce, evaluateOn(ce, "Transpose", matrix) ?? matrix),
    inverse:
      isSingular === false
        ? matrixLatex(ce, evaluateOn(ce, "Inverse", matrix) ?? matrix)
        : null,
    isSingular,
  };
}

function evaluateOn(
  ce: ComputeEngine,
  operator: string,
  matrix: Expression,
): Expression | null {
  const result = ce.box([operator, matrix.json]).evaluate();
  return result.isValid ? result : null;
}

/** Wrap a computed list-of-lists back into a matrix so it renders as one. */
export function matrixLatex(ce: ComputeEngine, value: Expression): string {
  return ce.box(["Matrix", value.json]).latex;
}

/**
 * A `2` has shape `[]`, a list of numbers has shape `[n]`; only something the
 * engine evaluated into rows and columns is a matrix here. `x+1` never gets
 * that far — it stays symbolic, with no shape at all.
 */
export function isMatrixNode(value: Expression): boolean {
  return value.shape.length === 2;
}

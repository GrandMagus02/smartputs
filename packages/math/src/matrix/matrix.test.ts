import { describe, expect, test } from "bun:test";
import { NotAMatrixError } from "../errors";
import { createComputeEngine, parseLatex } from "../parse";
import { inspectMatrix } from "./matrix";

const ce = createComputeEngine();
const inspect = (latex: string) => inspectMatrix(ce, parseLatex(ce, latex), latex);

const SQUARE = "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}";
const SINGULAR = "\\begin{pmatrix}1&2\\\\2&4\\end{pmatrix}";
const WIDE = "\\begin{pmatrix}1&2&3\\\\4&5&6\\end{pmatrix}";
const COLUMN = "\\begin{pmatrix}1\\\\2\\end{pmatrix}";

describe("inspectMatrix", () => {
  test("reports the shape", () => {
    const m = inspect(SQUARE);
    expect([m.rows, m.columns]).toEqual([2, 2]);
    expect(m.isSquare).toBe(true);
  });

  test("computes determinant and trace exactly", () => {
    const m = inspect(SQUARE);
    expect(m.determinant).toBe("-2");
    expect(m.trace).toBe("5");
  });

  test("inverts, keeping the entries exact", () => {
    expect(inspect(SQUARE).inverse).toContain("\\frac{3}{2}");
  });

  test("gives back LaTeX a renderer can show, not a nested list", () => {
    const m = inspect(SQUARE);
    expect(m.transpose).toStartWith("\\begin{pmatrix}");
    expect(m.transpose).toContain("1 & 3");
    expect(m.inverse).toStartWith("\\begin{pmatrix}");
  });

  test("says a singular matrix has no inverse rather than echoing the input", () => {
    const m = inspect(SINGULAR);
    expect(m.determinant).toBe("0");
    expect(m.isSingular).toBe(true);
    expect(m.inverse).toBeNull();
  });

  test("leaves determinant, trace and inverse out for a non-square matrix", () => {
    const m = inspect(WIDE);
    expect([m.rows, m.columns]).toEqual([2, 3]);
    expect(m.isSquare).toBe(false);
    expect(m.determinant).toBeNull();
    expect(m.trace).toBeNull();
    expect(m.inverse).toBeNull();
    expect(m.isSingular).toBeNull();
  });

  test("transposes a non-square matrix into its other shape", () => {
    expect(inspect(WIDE).transpose).toContain("1 & 4");
  });

  test("treats a column vector as a matrix of one column", () => {
    const m = inspect(COLUMN);
    expect([m.rows, m.columns]).toEqual([2, 1]);
  });

  test("refuses an expression that is not a matrix", () => {
    expect(() => inspect("x+1")).toThrow(NotAMatrixError);
    expect(() => inspect("x+1")).toThrow(/not a matrix/);
  });
});

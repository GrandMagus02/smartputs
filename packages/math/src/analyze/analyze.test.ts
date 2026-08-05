import { describe, expect, test } from "bun:test";
import { createComputeEngine, parseLatex } from "../parse";
import { analyzeFunction } from "./analyze";

const ce = createComputeEngine();
const analyze = (latex: string, variable = "x") =>
  analyzeFunction(ce, parseLatex(ce, latex), variable, latex);

describe("analyzeFunction", () => {
  test("finds the roots, sorted", () => {
    expect(analyze("x^2-4").roots).toEqual(["-2", "2"]);
  });

  test("reads the value where the curve crosses the vertical axis", () => {
    expect(analyze("x^2-4").valueAtZero).toBe("-4");
  });

  test("reports both derivatives", () => {
    const result = analyze("x^3-3x");
    expect(result.derivative).toBe("3x^2-3");
    expect(result.secondDerivative).toBe("6x");
  });

  test("classifies the turning points by the second derivative", () => {
    expect(analyze("x^3-3x").turningPoints).toEqual([
      { at: "-1", value: "2", kind: "maximum" },
      { at: "1", value: "-2", kind: "minimum" },
    ]);
  });

  test("calls a turning point with a flat second derivative an inflection", () => {
    expect(analyze("x^3").turningPoints).toEqual([
      { at: "0", value: "0", kind: "inflection" },
    ]);
  });

  test("reports a function with no root as having none, not as a failure", () => {
    const result = analyze("x^2+1");
    expect(result.roots).toEqual([]);
    expect(result.complexRoots).toEqual(["\\imaginaryI", "-\\imaginaryI"]);
    expect(result.turningPoints).toEqual([{ at: "0", value: "1", kind: "minimum" }]);
  });

  test("says whether the function is even or odd", () => {
    expect(analyze("x^2").parity).toBe("even");
    expect(analyze("x^3").parity).toBe("odd");
    expect(analyze("x^2+x").parity).toBe("neither");
  });

  test("keeps the working for the roots", () => {
    const { steps } = analyze("x^2-4");
    expect(steps.map((s) => s.rule)).toContain("solve.quadratic-formula");
  });

  test("falls back to numerical roots where the solver has no exact method", () => {
    // A cubic the solver cannot factor: the roots are ±√3 and 0, and the two
    // irrational ones come back as decimals. Pinned so a future release that
    // solves them exactly shows up here rather than silently.
    const roots = analyze("x^3-3x").roots;
    expect(roots).toHaveLength(3);
    expect(roots[0]).toStartWith("-1.732");
    expect(roots[1]).toBe("0");
  });

  test("works on a function of any named variable", () => {
    expect(analyze("t^2-9", "t").roots).toEqual(["-3", "3"]);
  });

  test("leaves the undefined points out of a value it cannot compute", () => {
    const result = analyze("\\frac{1}{x}");
    expect(result.valueAtZero).toBeNull();
    expect(result.roots).toEqual([]);
  });
});

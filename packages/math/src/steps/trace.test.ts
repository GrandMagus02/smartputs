import { describe, expect, test } from "bun:test";
import { createComputeEngine, parseLatex } from "../parse";
import { traceEvaluate } from "./trace";

const ce = createComputeEngine();
const trace = (latex: string) => traceEvaluate(ce, parseLatex(ce, latex));

describe("traceEvaluate", () => {
  test("evaluates the inner expression first and shows the whole line each time", () => {
    const { steps, value } = trace("1+2\\times3");
    expect(steps.map((s) => [s.rule, s.before, s.after])).toEqual([
      ["multiply", "1+2\\times3", "1+6"],
      ["add", "1+6", "7"],
    ]);
    expect(value.latex).toBe("7");
  });

  test("keeps arithmetic exact rather than dropping to floating point", () => {
    const { steps, value } = trace("\\frac{1}{2}+\\frac{1}{3}");
    expect(value.latex).toBe("\\frac{5}{6}");
    expect(steps).toHaveLength(1);
    expect(steps[0]?.detail).toBe("\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}");
  });

  test("emits no step for a part that was already in its final form", () => {
    expect(trace("\\frac{1}{2}").steps).toEqual([]);
  });

  test("does not report a step for terms the engine merely reordered", () => {
    const { steps, value } = trace("\\sqrt{16}+x");
    expect(steps.map((s) => s.rule)).toEqual(["root"]);
    expect(value.latex).toBe("x+4");
  });

  test("labels the rule by the operator that was applied", () => {
    expect(trace("2^{10}").steps.map((s) => s.rule)).toEqual(["power"]);
    expect(trace("\\frac{d}{dx}(x^3)").steps.map((s) => s.rule)).toEqual([
      "differentiate",
    ]);
    expect(trace("\\int_0^1 x^2 dx").steps.map((s) => s.rule)).toEqual(["integrate"]);
  });

  test("carries a human title alongside the machine rule", () => {
    expect(trace("2^{10}").steps[0]?.title).toBe("Raise to the power");
  });

  test("leaves an expression with free symbols symbolic instead of failing", () => {
    const { value, steps } = trace("x^2+1");
    expect(value.latex).toBe("x^2+1");
    expect(steps).toEqual([]);
  });
});

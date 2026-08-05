import { describe, expect, test } from "bun:test";
import { MathSolveError } from "../errors";
import { createComputeEngine, parseLatex } from "../parse";
import { solveEquation } from "./solve";

const ce = createComputeEngine();
const solve = (latex: string, variable = "x") =>
  solveEquation(ce, parseLatex(ce, latex), variable, latex);

describe("solveEquation", () => {
  test("solves a linear equation and names the rule that isolated the unknown", () => {
    const { solutions, steps } = solve("2x+6=0");
    expect(solutions).toEqual(["-3"]);
    expect(steps.map((s) => s.rule)).toEqual(["solve.linear"]);
    expect(steps[0]?.before).toBe("2x+6=0");
    expect(steps[0]?.after).toBe("x=-3");
    expect(steps[0]?.title).toContain("Isolate the unknown");
  });

  test("moves the right-hand side over before isolating", () => {
    const { solutions, steps } = solve("3x+2=11");
    expect(solutions).toEqual(["3"]);
    expect(steps.map((s) => s.rule)).toEqual(["solve.move-terms", "solve.linear"]);
    expect(steps[0]?.after).toBe("3x-9=0");
    // Each step starts where the one before it ended.
    expect(steps[1]?.before).toBe("3x-9=0");
  });

  test("solves a quadratic through the formula", () => {
    const { solutions, steps } = solve("x^2-5x+6=0");
    expect(solutions).toEqual(["2", "3"]);
    // The formula step prints its two roots as a cases block, in the order the
    // solver found them; the closing step restates them sorted.
    expect(steps.map((s) => s.rule)).toEqual(["solve.quadratic-formula", "roots"]);
    expect(steps[0]?.after).toContain("x=3");
    expect(steps.at(-1)?.after).toBe("x=2,\\ x=3");
  });

  test("treats a bare expression as that expression set equal to zero", () => {
    expect(solve("x^2-4").solutions).toEqual(["-2", "2"]);
  });

  test("narrates equations no algebraic rearrangement covers", () => {
    const { solutions, steps } = solve("\\sin(x)=1");
    expect(solutions).toEqual(["\\frac{\\pi}{2}"]);
    expect(steps.map((s) => s.rule)).toContain("solve.sine");
  });

  test("refuses a variable the equation never mentions", () => {
    expect(() => solve("2y+1=0", "x")).toThrow(MathSolveError);
    expect(() => solve("2y+1=0", "x")).toThrow(/does not contain/);
  });

  test("says there is no solution rather than trailing off", () => {
    const { solutions, steps } = solve("x+1=x+2");
    expect(solutions).toEqual([]);
    expect(steps.at(-1)?.rule).toBe("roots");
    expect(steps.at(-1)?.after).toBe("\\text{no solution}");
  });

  test("does not repeat the solutions as a step when a rule already showed them", () => {
    expect(solve("2x+6=0").steps.filter((s) => s.rule === "roots")).toEqual([]);
  });
});

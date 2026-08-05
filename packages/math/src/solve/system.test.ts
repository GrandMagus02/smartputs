import { describe, expect, test } from "bun:test";
import { MathSolveError } from "../errors";
import { createComputeEngine } from "../parse";
import { solveSystem } from "./system";

const ce = createComputeEngine();

describe("solveSystem", () => {
  test("solves a system and reports each unknown", () => {
    const result = solveSystem(ce, ["x+y=2", "x-y=0"], {});
    expect(result.consistent).toBe(true);
    expect(result.solutions).toEqual({ x: "1", y: "1" });
    expect(result.variables).toEqual(["x", "y"]);
  });

  test("shows the elimination and the back-substitution", () => {
    const { steps } = solveSystem(ce, ["x+y=2", "x-y=0"], {});
    expect(steps.map((s) => s.rule)).toContain("solve.system.eliminate");
    expect(steps[0]?.before).toContain("\\begin{cases}");
  });

  test("reports a contradictory system as such instead of throwing", () => {
    const result = solveSystem(ce, ["x+y=2", "x+3=4", "y+1=8"], {});
    expect(result.consistent).toBe(false);
    expect(result.solutions).toBeNull();
    expect(result.steps.at(-1)?.after).toBe("\\text{no solution}");
  });

  test("reads a system written as one block of lines", () => {
    const result = solveSystem(ce, "x+y=2\nx-y=0", {});
    expect(result.solutions).toEqual({ x: "1", y: "1" });
    expect(result.equations).toEqual(["x+y=2", "x-y=0"]);
  });

  test("reads a system written as a LaTeX cases environment", () => {
    const result = solveSystem(ce, "\\begin{cases}x+y=2\\\\x-y=0\\end{cases}", {});
    expect(result.solutions).toEqual({ x: "1", y: "1" });
  });

  test("collects the unknowns across every equation, in order", () => {
    expect(solveSystem(ce, ["y+z=3", "y-z=1"], {}).variables).toEqual(["y", "z"]);
  });

  test("takes the unknowns when told which ones", () => {
    const result = solveSystem(ce, ["x+y=2", "x-y=0"], { variables: ["y", "x"] });
    expect(result.variables).toEqual(["y", "x"]);
    expect(result.solutions).toEqual({ y: "1", x: "1" });
  });

  test("refuses an empty system", () => {
    expect(() => solveSystem(ce, [], {})).toThrow(MathSolveError);
    expect(() => solveSystem(ce, "  ", {})).toThrow(/no equations/);
  });
});

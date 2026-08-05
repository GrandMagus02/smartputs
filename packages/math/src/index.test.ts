import { describe, expect, test } from "bun:test";
import * as math from "./index";

describe("public surface", () => {
  test("exports the engine factory and the error classes", () => {
    expect(Object.keys(math).sort()).toEqual([
      "MathError",
      "MathParseError",
      "MathSolveError",
      "NotAMatrixError",
      "OPERATOR_WORDS",
      "UnboundSymbolError",
      "WordParseError",
      "createMathEngine",
      "describeOperator",
      "latexFromWords",
      "ruleForOperator",
      "titleForRule",
    ]);
  });

  test("an expression said in words reaches the engine through the entry point", () => {
    const latex = math.latexFromWords("one plus two in brackets power three");
    expect(math.createMathEngine().evaluate(latex).latex).toBe("27");
  });

  test("the operator words are reachable without an engine", () => {
    expect(math.describeOperator("^")).toBe("power");
    expect(math.OPERATOR_WORDS["+"]).toBe("plus");
  });

  test("an engine built from the entry point solves end to end", () => {
    expect(math.createMathEngine().solve("x^2-9=0").solutions).toEqual(["-3", "3"]);
  });
});

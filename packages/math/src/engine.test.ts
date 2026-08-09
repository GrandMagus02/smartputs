import { describe, expect, test } from "bun:test";
import { createMathEngine } from "./engine";
import { MathParseError, MathSolveError, UnboundSymbolError } from "./errors";

const math = createMathEngine();

describe("evaluate", () => {
  test("answers exactly, and separately as a decimal", () => {
    const result = math.evaluate("\\frac{1}{2}+\\frac{1}{3}");
    expect(result.latex).toBe("\\frac{5}{6}");
    expect(result.approx).toBeCloseTo(0.8333333333, 9);
    expect(result.input).toBe("\\frac{1}{2}+\\frac{1}{3}");
  });

  test("shows the working", () => {
    expect(math.evaluate("1+2\\times3").steps.map((s) => s.after)).toEqual(["1+6", "7"]);
  });

  test("substitutes bound symbols first, as its own step", () => {
    const result = math.evaluate("x^2+1", { bindings: { x: 3 } });
    expect(result.latex).toBe("10");
    expect(result.steps[0]?.rule).toBe("substitute");
    expect(result.steps[0]?.after).toBe("3^2+1");
  });

  test("stays symbolic when a symbol is left unbound", () => {
    const result = math.evaluate("2x+3x");
    expect(result.latex).toBe("5x");
    expect(result.approx).toBeNull();
  });

  test("requires every symbol to be bound when a number is demanded", () => {
    expect(() => math.evaluate("2x+1", { requireNumber: true })).toThrow(
      UnboundSymbolError,
    );
    expect(() => math.evaluate("2x+1", { requireNumber: true })).toThrow(/x/);
  });

  test("rejects LaTeX it cannot read", () => {
    expect(() => math.evaluate("\\frac{1}{")).toThrow(MathParseError);
  });
});

describe("simplify", () => {
  test("collects like terms and names the rule it used", () => {
    const result = math.simplify("2x+3x");
    expect(result.latex).toBe("5x");
    expect(result.steps.map((s) => [s.rule, s.after])).toEqual([["expand", "5x"]]);
  });

  test("falls back to one plain step when the rule chain is empty", () => {
    const result = math.simplify("\\sqrt{16}+x");
    expect(result.latex).toBe("x+4");
    expect(result.steps.map((s) => [s.rule, s.before, s.after])).toEqual([
      ["simplify", "\\sqrt{16}+x", "x+4"],
    ]);
  });

  test("reports no step when there is nothing to do", () => {
    expect(math.simplify("x+1").steps).toEqual([]);
  });
});

describe("differentiate", () => {
  test("differentiates and names the rule it applied", () => {
    const result = math.differentiate("x^3");
    expect(result.latex).toBe("3x^2");
    expect(result.steps.map((s) => s.rule)).toEqual(["derivative.power-rule"]);
    expect(result.steps[0]?.after).toBe("3x^2");
  });

  test("takes the variable when there is more than one symbol", () => {
    expect(math.differentiate("ax^2", { variable: "x" }).latex).toBe("2ax");
  });
});

describe("integrate", () => {
  /**
   * Thirty seconds, against bun's default five, and the name of the test is the
   * reason: this is the call that makes `@cortex-js/compute-engine` load its
   * integration rules, and it is the only test in the repo that pays a
   * third-party lazy load rather than running the repo's own code.
   *
   * It is not slow on its own — around 700 ms in `bun test packages/math`. It is
   * slow under `bun run check`, where 152 files are running and this one landed
   * at 5429 ms against the 5000 ms default: a flake that failed the whole check
   * and passed on the retry, which is the worst kind of red. The timeout is
   * raised rather than the load being warmed in a `beforeAll`, because "the
   * rules are loaded on demand" is the thing the test is asserting and warming
   * it would assert nothing.
   */
  test("integrates, with the integration rules loaded on demand", () => {
    const result = math.integrate("x^2");
    expect(result.latex).toBe("\\frac{x^3}{3}");
    expect(result.steps.length).toBeGreaterThan(0);
  }, 30_000);

  test("evaluates a definite integral to an exact value", () => {
    expect(math.evaluate("\\int_0^1 x^2 dx").latex).toBe("\\frac{1}{3}");
  });
});

describe("solve", () => {
  test("infers the variable when the equation has exactly one", () => {
    expect(math.solve("2y+1=0").variable).toBe("y");
    expect(math.solve("2y+1=0").solutions).toEqual(["\\frac{-1}{2}"]);
  });

  test("takes the variable when told which one", () => {
    expect(math.solve("ax+b=0", { variable: "x" }).solutions).toEqual(["\\frac{-b}{a}"]);
  });

  test("refuses to guess between several unknowns", () => {
    expect(() => math.solve("x+y=1")).toThrow(MathSolveError);
    expect(() => math.solve("x+y=1")).toThrow(/x, y/);
  });
});

describe("analyze", () => {
  test("answers the usual questions about a function at once", () => {
    const result = math.analyze("x^2-4");
    expect(result.roots).toEqual(["-2", "2"]);
    expect(result.derivative).toBe("2x");
    expect(result.turningPoints).toEqual([{ at: "0", value: "-4", kind: "minimum" }]);
    expect(result.parity).toBe("even");
  });

  test("infers the variable, and takes one when told", () => {
    expect(math.analyze("t^2-9").variable).toBe("t");
    expect(math.analyze("ax^2-a", { variable: "x" }).roots).toEqual(["-1", "1"]);
  });
});

describe("solveSystem", () => {
  test("solves several equations together", () => {
    const result = math.solveSystem("x+y=2\nx-y=0");
    expect(result.solutions).toEqual({ x: "1", y: "1" });
    expect(result.consistent).toBe(true);
  });

  test("reports a contradictory system without throwing", () => {
    const result = math.solveSystem(["x+y=2", "x+3=4", "y+1=8"]);
    expect(result.consistent).toBe(false);
    expect(result.solutions).toBeNull();
  });
});

describe("matrix", () => {
  test("reports what can be said about a matrix", () => {
    const result = math.matrix("\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}");
    expect(result.determinant).toBe("-2");
    expect(result.inverse).toStartWith("\\begin{pmatrix}");
  });

  test("evaluates matrix arithmetic back into matrix notation", () => {
    const product = math.evaluate(
      "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\cdot\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}",
    );
    expect(product.latex).toStartWith("\\begin{pmatrix}");
    expect(product.latex).toContain("3 & 4");
  });
});

describe("describe", () => {
  test("reads an expression out in English", () => {
    expect(math.describe("x^2+1")).toBe("x squared plus 1");
  });

  test("takes the reading options through to the description", () => {
    expect(math.describe("x^2+1", { numbers: "words" })).toBe("x squared plus one");
    expect(math.describe("(2+3)^2", { style: "short" })).toBe(
      "2 plus 3 in brackets squared",
    );
  });
});

describe("engine isolation", () => {
  test("one engine's bindings do not leak into another's", () => {
    const first = createMathEngine();
    first.evaluate("x+1", { bindings: { x: 41 } });
    expect(createMathEngine().evaluate("x+1").latex).toBe("x+1");
  });
});

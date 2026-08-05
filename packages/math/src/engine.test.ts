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
  test("integrates, with the integration rules loaded on demand", () => {
    const result = math.integrate("x^2");
    expect(result.latex).toBe("\\frac{x^3}{3}");
    expect(result.steps.length).toBeGreaterThan(0);
  });

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

describe("engine isolation", () => {
  test("one engine's bindings do not leak into another's", () => {
    const first = createMathEngine();
    first.evaluate("x+1", { bindings: { x: 41 } });
    expect(createMathEngine().evaluate("x+1").latex).toBe("x+1");
  });
});

import { describe, expect, test } from "bun:test";
import { SmartputError } from "@smartput/core";
import { MathParseError } from "./errors";
import { createComputeEngine, parseLatex } from "./parse";

const ce = createComputeEngine();

describe("parseLatex", () => {
  test("keeps the written structure instead of folding it to a value", () => {
    expect(parseLatex(ce, "\\frac{1}{2}+\\frac{1}{3}").json).toEqual([
      "Add",
      ["Divide", 1, 2],
      ["Divide", 1, 3],
    ]);
  });

  test("accepts LaTeX operators markdown math uses", () => {
    expect(parseLatex(ce, "2 \\cdot 3 \\times 4").operator).toBe("Multiply");
    expect(parseLatex(ce, "x^{2} + \\sqrt{9}").operator).toBe("Add");
  });

  test("throws MathParseError naming the LaTeX that failed", () => {
    expect(() => parseLatex(ce, "\\frac{1}{")).toThrow(MathParseError);
    expect(() => parseLatex(ce, "\\frac{1}{")).toThrow(/expected-closing-delimiter/);
  });

  test("MathParseError is a SmartputError so one guard catches both packages", () => {
    try {
      parseLatex(ce, "\\frac{1}{");
      throw new Error("expected parseLatex to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SmartputError);
      expect((error as MathParseError).input).toBe("\\frac{1}{");
    }
  });
});

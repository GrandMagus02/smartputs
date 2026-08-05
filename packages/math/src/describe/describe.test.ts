import { describe, expect, test } from "bun:test";
import { createComputeEngine, parseLatex } from "../parse";
import { describeExpression, describeOperator, OPERATOR_WORDS } from "./describe";

const ce = createComputeEngine();
const say = (latex: string) => describeExpression(ce, parseLatex(ce, latex));

describe("describeOperator", () => {
  test("names the symbols a reader would otherwise have to sound out", () => {
    expect(describeOperator("+")).toBe("plus");
    expect(describeOperator("^")).toBe("power");
    expect(describeOperator("\\times")).toBe("times");
    expect(describeOperator("\\frac")).toBe("fraction");
    expect(describeOperator("\\sqrt")).toBe("square root");
    expect(describeOperator("=")).toBe("equals");
    expect(describeOperator("\\leq")).toBe("less than or equal to");
  });

  test("answers for the plain-text spellings of the same operators", () => {
    expect(describeOperator("*")).toBe("times");
    expect(describeOperator("/")).toBe("divided by");
  });

  test("returns null for a symbol it has no word for", () => {
    expect(describeOperator("\\bowtie")).toBeNull();
  });

  test("exposes the table so a UI can list or translate it", () => {
    expect(OPERATOR_WORDS["-"]).toBe("minus");
  });
});

describe("describeExpression", () => {
  test("reads arithmetic in the order it is written", () => {
    expect(say("1+2\\times3")).toBe("1 plus 2 times 3");
    expect(say("5-3")).toBe("5 minus 3");
  });

  test("reads a fraction as a division", () => {
    expect(say("\\frac{1}{2}")).toBe("1 divided by 2");
  });

  test("uses the short names for the powers that have them", () => {
    expect(say("x^2")).toBe("x squared");
    expect(say("x^3")).toBe("x cubed");
    expect(say("2^{10}")).toBe("2 to the power 10");
  });

  test("names roots and functions", () => {
    expect(say("\\sqrt{16}")).toBe("the square root of 16");
    expect(say("\\sin(x)")).toBe("the sine of x");
  });

  test("keeps a bracketed part together", () => {
    expect(say("(2+3)^2")).toBe("the quantity 2 plus 3, squared");
  });

  test("reads an equation as both sides of an equals", () => {
    expect(say("x+1=4")).toBe("x plus 1 equals 4");
  });

  test("describes a matrix by its shape", () => {
    expect(say("\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}")).toBe("a 2 by 2 matrix");
  });

  test("falls back to the operator's own name rather than going silent", () => {
    expect(say("\\gcd(4,6)")).toBe("GCD of 4 and 6");
  });

  test("reads a factorial where it is written, so it reads back", () => {
    expect(say("5!")).toBe("5 factorial");
  });
});

describe("describeExpression, in the short style", () => {
  const brief = (latex: string) =>
    describeExpression(ce, parseLatex(ce, latex), { style: "short" });

  test("drops the articles a caption has no room for", () => {
    expect(brief("\\sqrt{16}")).toBe("square root 16");
    expect(brief("\\sin(x)")).toBe("sine x");
    expect(brief("|x|")).toBe("absolute value x");
  });

  test("marks a bracketed part after it rather than before it", () => {
    expect(brief("(2+3)^2")).toBe("2 plus 3 in brackets squared");
  });

  test("uses the short word for each operator", () => {
    expect(brief("\\frac{1}{2}")).toBe("1 over 2");
    expect(brief("2^{10}")).toBe("2 power 10");
    expect(brief("x<3")).toBe("x less than 3");
  });

  test("leaves alone what is already short", () => {
    expect(brief("1+2\\times3")).toBe("1 plus 2 times 3");
    expect(brief("x^2")).toBe("x squared");
  });
});

describe("describeExpression, with numbers in words", () => {
  const spelled = (latex: string) =>
    describeExpression(ce, parseLatex(ce, latex), { numbers: "words" });

  test("spells the numbers out", () => {
    expect(spelled("1+2")).toBe("one plus two");
    expect(spelled("105")).toBe("one hundred and five");
    expect(spelled("3.5+1")).toBe("three point five plus one");
  });

  test("spells them wherever they appear, exponents included", () => {
    expect(spelled("2^{10}")).toBe("two to the power ten");
    expect(spelled("\\frac{1}{2}")).toBe("one divided by two");
  });

  test("leaves the digits alone when it has no words for them", () => {
    expect(spelled("1000000000000000+1")).toBe("1000000000000000 plus one");
  });

  test("combines with the short style", () => {
    const both = describeExpression(ce, parseLatex(ce, "(2+3)^2"), {
      style: "short",
      numbers: "words",
    });
    expect(both).toBe("two plus three in brackets squared");
  });
});

import { describe, expect, test } from "bun:test";
import { describeExpression } from "../describe/describe";
import { WordParseError } from "../errors";
import { createComputeEngine, parseLatex } from "../parse";
import { latexFromWords } from "./words";

const ce = createComputeEngine();
const value = (words: string) =>
  ce.box(parseLatex(ce, latexFromWords(words)).json).evaluate().latex;

describe("latexFromWords", () => {
  test("reads the operator words as their symbols", () => {
    expect(latexFromWords("one plus two")).toBe("1+2");
    expect(latexFromWords("five minus three")).toBe("5-3");
    expect(latexFromWords("two times three")).toBe("2\\times3");
    expect(latexFromWords("six divided by two")).toBe("\\frac{6}{2}");
    expect(latexFromWords("six over two")).toBe("\\frac{6}{2}");
  });

  test("takes digits and spelled-out numbers in the same sentence", () => {
    expect(latexFromWords("one plus 2")).toBe("1+2");
    expect(latexFromWords("twenty two plus one hundred and five")).toBe("22+105");
    expect(latexFromWords("twenty-two plus 3")).toBe("22+3");
    expect(latexFromWords("three point five plus one")).toBe("3.5+1");
  });

  test("applies the precedence the symbols would have", () => {
    expect(latexFromWords("one plus two times three")).toBe("1+2\\times3");
    expect(value("one plus two times three")).toBe("7");
  });

  test("reads the power words", () => {
    expect(latexFromWords("one plus two power 3")).toBe("1+2^3");
    expect(latexFromWords("one plus two to the power of three")).toBe("1+2^3");
    expect(latexFromWords("one plus two to the power three")).toBe("1+2^3");
    expect(latexFromWords("two raised to the power of ten")).toBe("2^{10}");
    expect(latexFromWords("two to the n")).toBe("2^n");
  });

  test("binds a power tighter than the arithmetic around it", () => {
    expect(value("one plus two power 3")).toBe("9");
  });

  test("reads squared and cubed as the powers they are", () => {
    expect(latexFromWords("x squared plus one")).toBe("x^2+1");
    expect(latexFromWords("three cubed")).toBe("3^3");
  });

  test("groups what came before it when brackets are said afterwards", () => {
    expect(latexFromWords("one plus two in brackets power three")).toBe("(1+2)^3");
    expect(latexFromWords("one plus two in parentheses")).toBe("(1+2)");
    expect(value("one plus two in brackets power three")).toBe("27");
  });

  test("groups what is said between them when brackets are said around it", () => {
    expect(latexFromWords("four times open bracket one plus two close bracket")).toBe(
      "4\\times(1+2)",
    );
    expect(latexFromWords("open paren one plus two close paren squared")).toBe("(1+2)^2");
  });

  test("groups on the quantity, which a comma closes", () => {
    expect(latexFromWords("the quantity two plus three, squared")).toBe("(2+3)^2");
    expect(latexFromWords("four times the quantity one plus two")).toBe("4\\times(1+2)");
  });

  test("reads a negative as a negation, not as a subtraction", () => {
    expect(latexFromWords("negative three plus one")).toBe("-3+1");
    expect(latexFromWords("minus x")).toBe("-x");
  });

  test("reads roots", () => {
    expect(latexFromWords("the square root of nine")).toBe("\\sqrt{9}");
    expect(latexFromWords("the cube root of eight")).toBe("\\sqrt[3]{8}");
    expect(latexFromWords("the third root of x")).toBe("\\sqrt[3]{x}");
  });

  test("reads the named functions", () => {
    expect(latexFromWords("the sine of x")).toBe("\\sin(x)");
    expect(latexFromWords("the natural logarithm of x")).toBe("\\ln(x)");
    expect(latexFromWords("the absolute value of negative three")).toBe(
      "\\left|-3\\right|",
    );
  });

  test("binds a function to the operand it is applied to, not to the sum", () => {
    expect(latexFromWords("the sine of x plus one")).toBe("\\sin(x)+1");
    expect(latexFromWords("the sine of the quantity x plus one")).toBe("\\sin(x+1)");
  });

  test("reads the relations, so an equation can be spoken", () => {
    expect(latexFromWords("x squared minus 4 equals zero")).toBe("x^2-4=0");
    expect(latexFromWords("x is less than or equal to three")).toBe("x\\leq3");
    expect(latexFromWords("x does not equal one")).toBe("x\\ne1");
  });

  test("multiplies a number said against a symbol", () => {
    expect(latexFromWords("two x plus one")).toBe("2x+1");
    expect(latexFromWords("three x squared")).toBe("3x^2");
  });

  test("reads the constants by name", () => {
    expect(latexFromWords("two times pi")).toBe("2\\times\\pi");
    expect(latexFromWords("x plus infinity")).toBe("x+\\infty");
  });

  test("reads factorial and percent as the postfixes they are", () => {
    expect(latexFromWords("five factorial")).toBe("5!");
    expect(latexFromWords("fifty percent")).toBe("50\\%");
  });

  test("is not troubled by case or a trailing full stop", () => {
    expect(latexFromWords("One Plus Two.")).toBe("1+2");
  });

  test("reads back what describe reads out", () => {
    const roundTrip = (latex: string) =>
      latexFromWords(describeExpression(ce, parseLatex(ce, latex)));
    expect(roundTrip("1+2\\times3")).toBe("1+2\\times3");
    expect(roundTrip("x^2+1")).toBe("x^2+1");
    expect(roundTrip("(2+3)^2")).toBe("(2+3)^2");
  });

  test("names the word it could not read", () => {
    expect(() => latexFromWords("one plus banana")).toThrow(WordParseError);
    expect(() => latexFromWords("one plus banana")).toThrow(/banana/);
  });

  test("refuses an operator with nothing after it", () => {
    expect(() => latexFromWords("one plus")).toThrow(WordParseError);
  });

  test("refuses empty input rather than returning empty LaTeX", () => {
    expect(() => latexFromWords("   ")).toThrow(WordParseError);
  });

  test("refuses a bracket that is never closed", () => {
    expect(() => latexFromWords("open bracket one plus two")).toThrow(WordParseError);
  });

  test("groups on all, the everyday word for it", () => {
    expect(latexFromWords("x plus one all squared")).toBe("(x+1)^2");
    expect(latexFromWords("x plus one all over two")).toBe("\\frac{x+1}{2}");
  });

  test("refuses two numbers said in a row rather than multiplying them", () => {
    expect(() => latexFromWords("one plus 2 3")).toThrow(WordParseError);
  });

  // Spelled-out numbers are core's numeral parser, not a second table, so a
  // run of cardinals adds up the way it does everywhere else in the repo:
  // "twenty two" is 22 and "two three" is 5 for the same reason.
  test("reads a run of cardinals the way the rest of the repo reads one", () => {
    expect(latexFromWords("two three")).toBe("5");
  });

  test("carries the word it stopped at, for a caller that wants to point at it", () => {
    try {
      latexFromWords("one plus banana");
      expect.unreachable();
    } catch (error) {
      expect((error as WordParseError).word).toBe("banana");
      expect((error as WordParseError).input).toBe("one plus banana");
    }
  });
});

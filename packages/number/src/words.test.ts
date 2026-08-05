import { describe, expect, test } from "bun:test";
import { numberFromWords, spellNumber } from "./words";

describe("numberFromWords", () => {
  const read = (words: string) => numberFromWords(words.split(" "));

  test("reads a cardinal, however many words it takes", () => {
    expect(read("seven")?.text).toBe("7");
    expect(read("twenty two")?.text).toBe("22");
    expect(read("one hundred and five")?.text).toBe("105");
  });

  test("reads digits as readily as words", () => {
    expect(read("105")?.text).toBe("105");
    expect(read("3.5")?.text).toBe("3.5");
  });

  test("reads a spoken decimal point", () => {
    expect(read("three point five")?.text).toBe("3.5");
    expect(read("zero point two five")?.text).toBe("0.25");
  });

  test("claims only the words that are the number", () => {
    expect(read("two plus three")?.consumed).toBe(1);
    expect(read("twenty two kilometres")?.consumed).toBe(2);
    // A "point" with nothing spellable after it belongs to the sentence.
    expect(read("three point onwards")?.consumed).toBe(1);
  });

  test("gives a value, not only the digits", () => {
    expect(read("one hundred and five")?.value.toNumber()).toBe(105);
  });

  test("returns null when the run does not start with a number", () => {
    expect(read("plus two")).toBeNull();
    expect(numberFromWords([])).toBeNull();
  });

  test("reads back every number it spells", () => {
    for (const value of [0, 7, 22, 105, 1234, 1_000_005, 3.5]) {
      const words = spellNumber(value) as string;
      expect(numberFromWords(words.split(" "))?.value.toNumber()).toBe(value);
    }
  });
});

describe("spellNumber", () => {
  test("spells the numbers below twenty, which have names of their own", () => {
    expect(spellNumber(0)).toBe("zero");
    expect(spellNumber(7)).toBe("seven");
    expect(spellNumber(13)).toBe("thirteen");
  });

  test("hyphenates a compound ten, as English writes it", () => {
    expect(spellNumber(20)).toBe("twenty");
    expect(spellNumber(22)).toBe("twenty-two");
    expect(spellNumber(99)).toBe("ninety-nine");
  });

  test("joins the tail of a hundred with an and", () => {
    expect(spellNumber(100)).toBe("one hundred");
    expect(spellNumber(105)).toBe("one hundred and five");
    expect(spellNumber(342)).toBe("three hundred and forty-two");
  });

  test("spells the scale words", () => {
    expect(spellNumber(1000)).toBe("one thousand");
    expect(spellNumber(1234)).toBe("one thousand two hundred and thirty-four");
    expect(spellNumber(1_000_005)).toBe("one million and five");
    expect(spellNumber(2_000_000_000)).toBe("two billion");
  });

  test("says a negative number as a negative", () => {
    expect(spellNumber(-3)).toBe("negative three");
  });

  test("says a decimal digit by digit after the point, as it is read", () => {
    expect(spellNumber(3.5)).toBe("three point five");
    expect(spellNumber(0.25)).toBe("zero point two five");
  });

  test("gives up rather than inventing a word for what it cannot spell", () => {
    expect(spellNumber(1e21)).toBeNull();
    expect(spellNumber(Number.NaN)).toBeNull();
    expect(spellNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

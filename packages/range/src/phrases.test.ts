import { describe, expect, test } from "bun:test";
import { claimAt, parseSlice } from "./phrases";
import { BackwardsRangeError, ZeroIndexError } from "./slice";

const parse = (text: string) => parseSlice(text);

describe("counting from an end", () => {
  test("a count of items", () => {
    expect(parse("first three")).toEqual({ start: 0, end: 2 });
    expect(parse("first 3")).toEqual({ start: 0, end: 2 });
    expect(parse("last three")).toEqual({ start: -3, end: -1 });
    expect(parse("last 3")).toEqual({ start: -3, end: -1 });
  });

  test("a bare anchor is one item", () => {
    expect(parse("first")).toEqual({ start: 0, end: 0 });
    expect(parse("last")).toEqual({ start: -1, end: -1 });
  });

  test("top and bottom are the same two selections", () => {
    expect(parse("top 5")).toEqual(parse("first 5"));
    expect(parse("bottom 5")).toEqual(parse("last 5"));
  });

  test("the count may be spelled out at any size", () => {
    expect(parse("first one hundred")).toEqual({ start: 0, end: 99 });
    expect(parse("last twenty-two")).toEqual({ start: -22, end: -1 });
  });

  test("case does not matter", () => {
    expect(parse("First Three")).toEqual({ start: 0, end: 2 });
  });

  // The word after the anchor is not a count, so the anchor claims only itself
  // — which is what leaves "last week" to `@smartput/date-range`.
  test("a non-count after the anchor is not claimed", () => {
    expect(claimAt("last week", 0)).toMatchObject({ length: 4 });
    expect(parse("last week")).toBeNull();
  });

  test("a fractional count is not a count", () => {
    expect(claimAt("first 2.5", 0)).toMatchObject({ length: 5 });
  });

  test("ordinals are deliberately not vocabulary", () => {
    expect(parse("second")).toBeNull();
    expect(parse("third")).toBeNull();
  });
});

describe("two written endpoints", () => {
  test("positions are written from one and stored from zero", () => {
    expect(parse("from 6 to 9")).toEqual({ start: 5, end: 8 });
    expect(parse("6 to 9")).toEqual({ start: 5, end: 8 });
  });

  test("every closer means the same thing", () => {
    for (const closer of ["to", "until", "till", "through"]) {
      expect(parse(`from 2 ${closer} 4`)).toEqual({ start: 1, end: 3 });
    }
  });

  test("the dash form, which the engine's matcher withholds", () => {
    expect(parse("4-5")).toEqual({ start: 3, end: 4 });
    expect(parse("4 - 5")).toEqual({ start: 3, end: 4 });
    expect(claimAt("4-5", 0)).toBeNull();
    expect(claimAt("4-5", 0, { dash: true })).toMatchObject({ length: 3 });
  });

  test("negatives pass through untouched, at either end", () => {
    expect(parse("from -3 to -1")).toEqual({ start: -3, end: -1 });
    expect(parse("from 2 to -1")).toEqual({ start: 1, end: -1 });
  });

  // The minus sign of "-3 to -1" sits at offset 0, and a closer there is no
  // closer at all — otherwise the left endpoint would be the empty string.
  test("a leading minus is a sign, not a closer", () => {
    expect(parse("-3 to -1")).toEqual({ start: -3, end: -1 });
  });

  test("an unclosed range is not a range", () => {
    expect(parse("from 6")).toBeNull();
    expect(parse("from 6 to")).toBeNull();
  });

  test("a left endpoint has to be consumed whole", () => {
    expect(parse("from noise 6 to 9")).toBeNull();
  });
});

describe("interval notation", () => {
  test("both separators, because both are written", () => {
    expect(parse("(1,5]")).toEqual({ start: 1, end: 4 });
    expect(parse("(1;5]")).toEqual({ start: 1, end: 4 });
  });

  test("an open end moves inwards by one written position", () => {
    expect(parse("[1,5]")).toEqual({ start: 0, end: 4 });
    expect(parse("(1,5]")).toEqual(parse("[2,5]"));
    expect(parse("[1,5)")).toEqual(parse("[1,4]"));
    expect(parse("(1,5)")).toEqual(parse("[2,4]"));
  });

  test("a negative end stays negative through the adjustment", () => {
    expect(parse("[1,-1]")).toEqual({ start: 0, end: -1 });
    expect(parse("[1,-1)")).toEqual({ start: 0, end: -2 });
  });

  test("spacing inside the brackets is free", () => {
    expect(parse("[ 1 , 5 ]")).toEqual({ start: 0, end: 4 });
  });

  /**
   * The claimable end stops at the last digit when the closing bracket is `]`,
   * because core's lexer drops that character and `foldLiterals` throws away
   * any claim that does not end where a token ends. `consumed` still counts it,
   * which is what lets the standalone parser insist on full coverage.
   */
  test("a `]` is consumed but not claimed; a `)` is both", () => {
    expect(claimAt("[1,5]", 0)).toMatchObject({ length: 4, consumed: 5 });
    expect(claimAt("[1,5)", 0)).toMatchObject({ length: 5, consumed: 5 });
    expect(claimAt("(1;5]", 0)).toMatchObject({ length: 4, consumed: 5 });
  });

  // `[` lexes as nothing, so the engine offers the offset after it and the
  // claim has to find the bracket by looking behind.
  test("an opening `[` is found from the offset after it", () => {
    expect(claimAt("[1,5]", 1)).toMatchObject({ length: 3, consumed: 4 });
    expect(claimAt("x1,5]", 1)).toBeNull();
  });
});

describe("what is not a selection", () => {
  test.each(["", "   ", "nonsense", "10 m", "3.5", "hello world"])("%p", (text) => {
    expect(parse(text)).toBeNull();
  });

  test("a partial claim is not a parse", () => {
    expect(parse("first three items")).toBeNull();
    expect(claimAt("first three items", 0)).toMatchObject({ length: 11 });
  });
});

describe("errors", () => {
  test("a backwards pair", () => {
    expect(() => parse("9 to 6")).toThrow(BackwardsRangeError);
    expect(() => parse("[5,2]")).toThrow(BackwardsRangeError);
  });

  test("position zero, under the default origin", () => {
    expect(() => parse("0 to 5")).toThrow(ZeroIndexError);
    expect(() => parse("[0,5]")).toThrow(ZeroIndexError);
  });

  test("under origin 0 there is no position zero to complain about", () => {
    expect(parseSlice("0 to 5", { origin: 0 })).toEqual({ start: 0, end: 5 });
    expect(parseSlice("from 6 to 9", { origin: 0 })).toEqual({ start: 6, end: 9 });
    // A count is a count of items either way: an origin shifts positions, and
    // "first three" names no position at all.
    expect(parseSlice("first three", { origin: 0 })).toEqual({ start: 0, end: 2 });
  });
});

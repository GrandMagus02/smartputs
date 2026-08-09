import { describe, expect, test } from "bun:test";
import { Range } from "./class";
import { BackwardsRangeError, wrapSlice, ZeroIndexError } from "./slice";

const LIST = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

describe("Range.parse", () => {
  test.each([
    ["first three", 0, 2],
    ["last three", -3, -1],
    ["from 6 to 9", 5, 8],
    ["4-5", 3, 4],
    ["(1;5]", 1, 4],
    ["(1,5]", 1, 4],
  ])("%p is [%p, %p]", (text, start, end) => {
    expect(Range.parse(text)).toEqual(new Range(start, end));
  });

  // "Is this a range?" is asked of every keystroke, and an exception is a poor
  // way to answer no. A range that is *wrong* still throws.
  test("a string that is not a selection is null, not a throw", () => {
    expect(Range.parse("hello")).toBeNull();
    expect(Range.parse("")).toBeNull();
  });

  test("a selection that is wrong still throws", () => {
    expect(() => Range.parse("9 to 6")).toThrow(BackwardsRangeError);
    expect(() => Range.parse("0 to 5")).toThrow(ZeroIndexError);
  });
});

describe("applying it to a list", () => {
  test("slice returns the items", () => {
    expect(Range.parse("first three")?.slice(LIST)).toEqual(["a", "b", "c"]);
    expect(Range.parse("last three")?.slice(LIST)).toEqual(["h", "i", "j"]);
    expect(Range.parse("from 6 to 9")?.slice(LIST)).toEqual(["f", "g", "h", "i"]);
    expect(Range.parse("(1;5]")?.slice(LIST)).toEqual(["b", "c", "d", "e"]);
  });

  test("resolve returns the absolute bounds", () => {
    expect(Range.parse("last three")?.resolve(10)).toEqual({
      start: 7,
      end: 9,
      count: 3,
    });
  });

  test("indices lists the positions", () => {
    expect(Range.last(3).indices(10)).toEqual([7, 8, 9]);
    expect(Range.all().indices(3)).toEqual([0, 1, 2]);
  });
});

describe("the object itself", () => {
  test("is frozen and integer-only", () => {
    const r = new Range(0, 2);
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => new Range(0, 1.5)).toThrow(TypeError);
  });

  test("count is null exactly when the list decides it", () => {
    expect(new Range(0, 2).count).toBe(3);
    expect(new Range(-3, -1).count).toBe(3);
    expect(new Range(0, -1).count).toBeNull();
  });

  test("fromEnd says whether a length is needed to place it", () => {
    expect(new Range(0, 2).fromEnd).toBe(false);
    expect(new Range(-3, -1).fromEnd).toBe(true);
  });

  test("the constructors say what they select", () => {
    expect(Range.first(3)).toEqual(new Range(0, 2));
    expect(Range.last(3)).toEqual(new Range(-3, -1));
    expect(Range.first()).toEqual(new Range(0, 0));
    expect(Range.all().slice(LIST)).toEqual(LIST);
  });

  test("round-trips through a Value", () => {
    const r = new Range(-3, -1);
    expect(Range.from(r.toValue())).toEqual(r);
    expect(Range.from(wrapSlice({ start: 5, end: 8 }))).toEqual(new Range(5, 8));
  });

  test("prints and serialises as the pair", () => {
    expect(String(new Range(0, 2))).toBe("[0, 2]");
    expect(JSON.stringify(new Range(-3, -1))).toBe('{"start":-3,"end":-1}');
  });

  test("equals compares both ends", () => {
    expect(new Range(0, 2).equals(new Range(0, 2))).toBe(true);
    expect(new Range(0, 2).equals(new Range(0, 3))).toBe(false);
  });
});

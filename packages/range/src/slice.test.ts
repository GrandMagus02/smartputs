import { describe, expect, test } from "bun:test";
import {
  assertOrdered,
  BackwardsRangeError,
  formatSlice,
  resolveSlice,
  sliceItems,
  unwrapSlice,
  wrapSlice,
} from "./slice";

const LIST = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

describe("resolveSlice", () => {
  test("a forward slice is absolute already", () => {
    expect(resolveSlice({ start: 0, end: 2 }, 10)).toEqual({
      start: 0,
      end: 2,
      count: 3,
    });
  });

  test("a negative end counts back from the last item", () => {
    expect(resolveSlice({ start: -3, end: -1 }, 10)).toEqual({
      start: 7,
      end: 9,
      count: 3,
    });
  });

  test("mixed signs mean everything", () => {
    expect(resolveSlice({ start: 0, end: -1 }, 4)).toEqual({
      start: 0,
      end: 3,
      count: 4,
    });
  });

  // "first ten" over three items is the answer "all three", not a mistake — a
  // launcher that threw here would fail on every short result set.
  test("a selection longer than the list is clamped, not rejected", () => {
    expect(resolveSlice({ start: 0, end: 9 }, 3)).toEqual({ start: 0, end: 2, count: 3 });
    expect(resolveSlice({ start: -9, end: -1 }, 3)).toEqual({
      start: 0,
      end: 2,
      count: 3,
    });
  });

  test("a selection past the end of the list is empty", () => {
    expect(resolveSlice({ start: 19, end: 29 }, 3).count).toBe(0);
    expect(resolveSlice({ start: 0, end: 2 }, 0).count).toBe(0);
  });

  // Undecidable without a length, so `assertOrdered` lets it through and this
  // is where it lands: no items, rather than an error about the phrase.
  test("a backwards pair that only a length can detect resolves to nothing", () => {
    expect(resolveSlice({ start: -1, end: 0 }, 10).count).toBe(0);
  });

  test("a negative length is a caller bug", () => {
    expect(() => resolveSlice({ start: 0, end: 1 }, -1)).toThrow(RangeError);
  });
});

describe("sliceItems", () => {
  test("selects the items the positions name", () => {
    expect(sliceItems(LIST, { start: 0, end: 2 })).toEqual(["a", "b", "c"]);
    expect(sliceItems(LIST, { start: -3, end: -1 })).toEqual(["h", "i", "j"]);
    expect(sliceItems(LIST, { start: 5, end: 8 })).toEqual(["f", "g", "h", "i"]);
  });

  test("a missing selection is an empty list, not a throw", () => {
    expect(sliceItems(LIST, { start: 50, end: 60 })).toEqual([]);
    expect(sliceItems([], { start: 0, end: 2 })).toEqual([]);
  });
});

describe("assertOrdered", () => {
  test("a backwards pair of the same sign is an error", () => {
    expect(() => assertOrdered("9 to 6", { start: 8, end: 5 })).toThrow(
      BackwardsRangeError,
    );
    expect(() => assertOrdered("-1 to -3", { start: -1, end: -3 })).toThrow(
      BackwardsRangeError,
    );
  });

  test("an empty range is a mistake too", () => {
    expect(() => assertOrdered("x", { start: 4, end: 3 })).toThrow(BackwardsRangeError);
    expect(() => assertOrdered("x", { start: 4, end: 4 })).not.toThrow();
  });

  // Whether `[0, -1]` is backwards is a fact about the list, not the phrase.
  test("mixed signs are never rejected here", () => {
    expect(() => assertOrdered("x", { start: 0, end: -1 })).not.toThrow();
    expect(() => assertOrdered("x", { start: -1, end: 0 })).not.toThrow();
  });

  test("the error names both ends", () => {
    try {
      assertOrdered("9 to 6", { start: 8, end: 5 });
      throw new Error("unreachable");
    } catch (e) {
      const error = e as BackwardsRangeError;
      expect(error.name).toBe("BackwardsRangeError");
      expect(error.start).toBe(8);
      expect(error.end).toBe(5);
      expect(error.input).toBe("9 to 6");
    }
  });
});

describe("the Value", () => {
  test("canonical is the start, so ordering works without knowing what this is", () => {
    expect(wrapSlice({ start: 5, end: 8 }).canonical.toString()).toBe("5");
    expect(wrapSlice({ start: -3, end: -1 }).canonical.toString()).toBe("-3");
  });

  test("round-trips through JSON, which is what @smartput/http needs", () => {
    const value = wrapSlice({ start: -3, end: -1 });
    expect(JSON.parse(JSON.stringify(value.meta))).toEqual({ start: -3, end: -1 });
  });

  test("unwrap guards rather than asserts", () => {
    expect(unwrapSlice(wrapSlice({ start: 1, end: 2 }))).toEqual({ start: 1, end: 2 });
    expect(() =>
      unwrapSlice({
        kind: "length",
        unit: "m",
        canonical: wrapSlice({ start: 0, end: 0 }).canonical,
      }),
    ).toThrow(TypeError);
  });

  test("formats as the notation the docs use", () => {
    expect(formatSlice({ start: 0, end: 2 })).toBe("[0, 2]");
    expect(formatSlice({ start: -3, end: -1 })).toBe("[-3, -1]");
  });
});

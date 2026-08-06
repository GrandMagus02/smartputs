import { expect, test } from "bun:test";
import { editDistance, nearestWord } from "./distance";

test("a transposition is one slip, not the two plain Levenshtein charges", () => {
  // The whole reason this implementation is not plain Levenshtein: "kilogrma"
  // is one pair of letters typed the wrong way round, and pricing it at two
  // puts it outside the tolerance a short word gets at all.
  expect(editDistance("kilogrma", "kilogram", 3)).toBeLessThan(1.5);
  expect(nearestWord("kilogrma", ["kilogram", "kilobyte"])).toBe("kilogram");
});

test("two words equally near are refused, not guessed between", () => {
  // Same slip on both sides — one letter typed wrong — so the weighting has
  // nothing to separate them with, and a coin toss in an expression comes back
  // as a number nobody checks.
  expect(nearestWord("cat", ["bat", "hat"])).toBeNull();
});

test("a single-character word is left alone", () => {
  expect(nearestWord("x", ["y", "z"])).toBeNull();
  expect(nearestWord("m", ["km"])).toBeNull();
});

test("the cap stops the scan rather than finishing a distance nobody wants", () => {
  // Nothing about these two words is within 2, and the answer says so without
  // reporting how far apart they actually are: the caller only ever asks which
  // candidate is nearest.
  expect(editDistance("abcdef", "uvwxyz", 2)).toBe(3);
  // A length difference alone is enough to answer, before any row is filled.
  expect(editDistance("a", "abcdefgh", 2)).toBe(3);
});

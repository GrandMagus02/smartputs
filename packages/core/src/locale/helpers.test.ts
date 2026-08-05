import { expect, test } from "bun:test";
import { cardinalNumerals, identity, suffixStripper, tableAnalyzer } from "./helpers";

const ctx = { locale: "uk" };

test("identity returns the surface form at weight 0", () => {
  expect(identity()("кілограмів", ctx)).toEqual([{ form: "кілограмів", weight: 0 }]);
});

test("suffixStripper offers each strippable suffix at a penalty", () => {
  const a = suffixStripper({ suffixes: ["ів", "и"], minStem: 3, weight: -2 });
  expect(a("кілограмів", ctx)).toEqual([{ form: "кілограм", weight: -2 }]);
});

test("suffixStripper respects minStem", () => {
  const a = suffixStripper({ suffixes: ["ів"], minStem: 10, weight: -2 });
  expect(a("кілограмів", ctx)).toEqual([]);
});

test("suffixStripper never returns an empty stem", () => {
  const a = suffixStripper({ suffixes: ["ів"], minStem: 1, weight: -2 });
  expect(a("ів", ctx)).toEqual([]);
});

test("tableAnalyzer maps known irregulars", () => {
  const a = tableAnalyzer({ кіло: "кілограм" }, -1);
  expect(a("кіло", ctx)).toEqual([{ form: "кілограм", weight: -1 }]);
  expect(a("метр", ctx)).toEqual([]);
});

const cardinals = cardinalNumerals({
  units: { zero: 0, one: 1, two: 2, five: 5, nineteen: 19 },
  tens: { twenty: 20, thirty: 30 },
  scales: { hundred: 100, thousand: 1000, million: 1_000_000 },
  connectors: ["and"],
});

const claimed = (words: string[]) => {
  const m = cardinals(words);
  return m === null ? null : [m.value.toString(), m.consumed];
};

test("cardinalNumerals reads a single word", () => {
  expect(claimed(["one"])).toEqual(["1", 1]);
});

test("cardinalNumerals reads zero", () => {
  expect(claimed(["zero"])).toEqual(["0", 1]);
});

test("cardinalNumerals adds a tens word to a units word", () => {
  expect(claimed(["twenty", "two"])).toEqual(["22", 2]);
});

test("cardinalNumerals multiplies by a scale word", () => {
  expect(claimed(["two", "hundred"])).toEqual(["200", 2]);
});

test("cardinalNumerals treats a leading scale word as one of them", () => {
  expect(claimed(["hundred"])).toEqual(["100", 1]);
});

test("cardinalNumerals accumulates across a thousands boundary", () => {
  expect(claimed(["one", "thousand", "thirty", "two"])).toEqual(["1032", 4]);
});

test("cardinalNumerals skips a connector between claimed words", () => {
  expect(claimed(["two", "hundred", "and", "five"])).toEqual(["205", 4]);
});

test("cardinalNumerals never claims a trailing connector", () => {
  expect(claimed(["five", "and", "kg"])).toEqual(["5", 1]);
});

test("cardinalNumerals stops at the first unknown word", () => {
  expect(claimed(["twenty", "two", "km", "five"])).toEqual(["22", 2]);
});

test("cardinalNumerals matches case-insensitively", () => {
  expect(claimed(["One", "MILLION"])).toEqual(["1000000", 2]);
});

test("cardinalNumerals returns null when it claims nothing", () => {
  expect(cardinals(["km"])).toBeNull();
  expect(cardinals([])).toBeNull();
});

test("cardinalNumerals will not claim a leading connector", () => {
  expect(cardinals(["and", "five"])).toBeNull();
});

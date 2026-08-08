import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { Decimal } from "../decimal";
import type { AnalyzeCtx } from "../types";
import {
  cardinalNumerals,
  cardinalSpeller,
  identity,
  suffixStripper,
  tableAnalyzer,
} from "./helpers";

/**
 * The degenerate run every analyzer sees when nothing calls it from a
 * sentence: the word alone, at index 0, which is what `createAnalyzerChain`
 * builds for a caller that supplies no position. None of the three analyzers
 * below reads it — that is the point of Task 19's widening — but `AnalyzeCtx`
 * requires it, so an analyzer written against the run never has to ask
 * whether there is one.
 */
const ctx = (surface: string): AnalyzeCtx => ({
  locale: "uk",
  words: [surface],
  index: 0,
});

test("identity returns the surface form at weight 0", () => {
  expect(identity()("кілограмів", ctx("кілограмів"))).toEqual([
    { form: "кілограмів", weight: 0 },
  ]);
});

test("suffixStripper offers each strippable suffix at a penalty", () => {
  const a = suffixStripper({ suffixes: ["ів", "и"], minStem: 3, weight: -2 });
  expect(a("кілограмів", ctx("кілограмів"))).toEqual([{ form: "кілограм", weight: -2 }]);
});

test("suffixStripper respects minStem", () => {
  const a = suffixStripper({ suffixes: ["ів"], minStem: 10, weight: -2 });
  expect(a("кілограмів", ctx("кілограмів"))).toEqual([]);
});

test("suffixStripper never returns an empty stem", () => {
  const a = suffixStripper({ suffixes: ["ів"], minStem: 1, weight: -2 });
  expect(a("ів", ctx("ів"))).toEqual([]);
});

test("tableAnalyzer maps known irregulars", () => {
  const a = tableAnalyzer({ кіло: "кілограм" }, -1);
  expect(a("кіло", ctx("кіло"))).toEqual([{ form: "кілограм", weight: -1 }]);
  expect(a("метр", ctx("метр"))).toEqual([]);
});

const TABLES = {
  units: { zero: 0, one: 1, two: 2, five: 5, nineteen: 19 },
  tens: { twenty: 20, thirty: 30 },
  scales: { hundred: 100, thousand: 1000, million: 1_000_000 },
  connectors: ["and"],
};

const cardinals = cardinalNumerals(TABLES);

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

// --- cardinalSpeller: the inverse, over the same TABLES ------------------

const speller = cardinalSpeller(TABLES);

test("cardinalSpeller spells zero and a direct units word", () => {
  expect(speller(new Decimal(0))).toBe("zero");
  expect(speller(new Decimal(1))).toBe("one");
  expect(speller(new Decimal(19))).toBe("nineteen");
});

test("cardinalSpeller composes a tens word with a units word", () => {
  expect(speller(new Decimal(30))).toBe("thirty");
  expect(speller(new Decimal(32))).toBe("thirty two");
});

test("cardinalSpeller spells a bare scale as one of it", () => {
  expect(speller(new Decimal(100))).toBe("one hundred");
  expect(speller(new Decimal(1000))).toBe("one thousand");
});

test("cardinalSpeller joins a hundred and a sub-100 remainder with the connector", () => {
  expect(speller(new Decimal(205))).toBe("two hundred and five");
});

test("cardinalSpeller accumulates across a thousands boundary", () => {
  expect(speller(new Decimal(1032))).toBe("one thousand thirty two");
});

test("cardinalSpeller round-trips through cardinalNumerals for a spread of magnitudes", () => {
  // The inverse relationship stated as a property, not just spot-checked
  // strings: spelling `n` and re-parsing the words the speller produced
  // reproduces `n` exactly, for every value below that both TABLES.units and
  // TABLES.tens can actually name (see the "declines a table gap" test below
  // for what happens outside that set).
  for (const n of [0, 1, 2, 5, 19, 20, 22, 30, 32, 100, 205, 1000, 1032]) {
    const spelled = speller(new Decimal(n));
    expect(spelled).not.toBeNull();
    const words = (spelled as string).split(" ");
    const parsed = cardinals(words);
    expect(parsed).not.toBeNull();
    expect(parsed?.consumed).toBe(words.length);
    expect(parsed?.value.toString()).toBe(String(n));
  }
});

test("cardinalSpeller declines a table gap rather than returning a partial spelling", () => {
  // TABLES.units has no word for 3 (or 4, 6, 7, 8, 9, 10-18) — a deliberately
  // incomplete fixture, not a real locale. Any lookup a real locale's tables
  // are missing fails the whole value closed to `null`, never a spelling
  // that silently drops or garbles the digit it couldn't find a word for.
  expect(speller(new Decimal(3))).toBeNull();
});

test("cardinalSpeller derives the units/tens boundary from the table, not a hardcoded 20", () => {
  // A table shaped nothing like `en`'s: `tens` starts at 10, not 20.
  // `cardinalNumerals` merges `units`/`tens` into one flat `addends` map with
  // no boundary assumption at all, so it reads "ten five" as 15 without
  // trouble — a speller that hardcoded 20 as the units/tens split would
  // decline 15 even though the very table it was given can name it.
  const lowTens = cardinalSpeller({
    units: { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 },
    tens: { ten: 10, twenty: 20 },
    scales: {},
  });
  expect(lowTens(new Decimal(15))).toBe("ten five");
  expect(lowTens(new Decimal(10))).toBe("ten");
  // Still declines below the table's actual boundary (nothing names 7-9 here
  // beyond a direct `units` entry, and there is none for those digits).
  expect(lowTens(new Decimal(7))).toBeNull();
});

test("cardinalSpeller declines a non-integer — the tables have no fractional grammar", () => {
  expect(speller(new Decimal("2.5"))).toBeNull();
});

test("cardinalSpeller declines a negative value — sign is not part of the numeral fold", () => {
  // Reachable only by calling the helper directly: `Printer` never asks it to
  // spell a negative magnitude, because this engine's AST always keeps a
  // negation in its own `UnaryNode`, wrapping a non-negative operand.
  expect(speller(new Decimal(-5))).toBeNull();
});

test("cardinalSpeller spells a magnitude below 1000x its largest scale, declines at that ceiling", () => {
  // TABLES' largest scale is a million, so the ceiling is 1000 * 1,000,000 =
  // 1,000,000,000 — ruled out here specifically because the value is exactly
  // at that boundary (the top-level check fires before any word is looked
  // up), not because of a table gap like the digit-3 case above.
  expect(speller(new Decimal(500_000_000))).toBe("five hundred million");
  expect(speller(new Decimal(1_000_000_000))).toBeNull();
});

test("cardinalSpeller (en): spells the design doc's own done-when numbers", () => {
  expect(en.spell?.(new Decimal(30))).toBe("thirty");
  expect(en.spell?.(new Decimal(15))).toBe("fifteen");
});

test("cardinalSpeller (en): non-integer, negative and just-below/at-ceiling magnitudes", () => {
  const spell = en.spell;
  expect(spell).toBeDefined();
  if (spell === undefined) throw new Error("unreachable — asserted above");
  expect(spell(new Decimal("1.5"))).toBeNull();
  expect(spell(new Decimal(-30))).toBeNull();
  // en's largest scale is a trillion, so the ceiling is 10^15.
  expect(spell(new Decimal("999999999999999"))).not.toBeNull();
  expect(spell(new Decimal("1000000000000000"))).toBeNull();
});

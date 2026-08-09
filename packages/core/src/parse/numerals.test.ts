import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { Decimal } from "../decimal";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import type { Locale, NumeralParser, Weights } from "../types";
import { lex, type Token } from "./lex";
import { normalize } from "./normalize";
import { foldNumerals } from "./numerals";

const en = composeLocale(english);

const fold = (input: string) => foldNumerals(lex(normalize(input).text, en), en);

/** Compact shape for assertions: type, surface-ish text, span. */
const shape = (input: string) =>
  fold(input).map((t) => [
    t.type,
    t.type === "number" ? t.value.toString() : t.type === "word" ? t.text : "",
    t.start,
    t.end,
  ]);

test("a single numeral word becomes a number token", () => {
  expect(shape("one kg")).toEqual([
    ["number", "1", 0, 3],
    ["word", "kg", 4, 6],
  ]);
});

test("a multi-word numeral collapses into one token spanning it", () => {
  expect(shape("one thousand thirty two")).toEqual([["number", "1032", 0, 23]]);
});

test("a connector inside a numeral is absorbed", () => {
  expect(shape("two hundred and five g")).toEqual([
    ["number", "205", 0, 20],
    ["word", "g", 21, 22],
  ]);
});

test("a hyphen joining two numeral words is absorbed", () => {
  expect(shape("twenty-two km")).toEqual([
    ["number", "22", 0, 10],
    ["word", "km", 11, 13],
  ]);
});

test("a spaced dash between numeral words stays subtraction", () => {
  expect(shape("twenty - two")).toEqual([
    ["number", "20", 0, 6],
    ["op", "", 7, 8],
    ["number", "2", 9, 12],
  ]);
});

test("a scale word directly after digits multiplies them", () => {
  expect(shape("1.5 million km")).toEqual([
    ["number", "1500000", 0, 11],
    ["word", "km", 12, 14],
  ]);
});

test("a non-scale numeral after digits is left alone", () => {
  expect(shape("5 one")).toEqual([
    ["number", "5", 0, 1],
    ["number", "1", 2, 5],
  ]);
});

test("unit words are untouched", () => {
  expect(shape("10 km")).toEqual([
    ["number", "10", 0, 2],
    ["word", "km", 3, 5],
  ]);
});

test("a numeral run stops at a unit word and resumes after it", () => {
  expect(shape("ten km five km")).toEqual([
    ["number", "10", 0, 3],
    ["word", "km", 4, 6],
    ["number", "5", 7, 11],
    ["word", "km", 12, 14],
  ]);
});

test("a locale without numerals is passed through unchanged", () => {
  const { numerals: _drop, ...language } = english;
  const bare = composeLocale(language);
  const tokens = lex(normalize("one kg").text, bare);
  expect(foldNumerals(tokens, bare)).toBe(tokens);
});

test("a fully spelled six-digit number folds to a single token", () => {
  expect(shape("nine hundred ninety nine thousand nine hundred ninety nine")).toEqual([
    ["number", "999999", 0, 58],
  ]);
});

// --- many languages, one run ---------------------------------------------
//
// The built-in pair cannot exercise any of this. Measured: `ukrainian
// .numerals(["twenty", "two"])` is null and `english.numerals(["двадцять",
// "два"])` is null, so en and uk never compete for the same run — they simply
// take turns. Every case below is therefore built from tiny purpose-made
// languages, which is the only way to reach the longest-claim comparison and
// the tie-break at all.

const tiny = (id: string, numerals: NumeralParser) =>
  composeLocale(
    defineLanguage({
      id,
      numberFormat: "intl",
      keywords: {},
      numerals,
      selectForm: () => "other",
    }),
  );

const claims = (table: Record<string, [string, number]>) =>
  ((words) => {
    for (const [phrase, [, value]] of Object.entries(table)) {
      const parts = phrase.split(" ");
      if (parts.every((p, k) => words[k] === p)) {
        return { value: new Decimal(value), consumed: parts.length };
      }
    }
    return null;
  }) satisfies NumeralParser;

/**
 * "zz" alone is 7. Its id sorts *first*, deliberately: with the shorter claim
 * also the preferred one, a fold that stopped at the first claimant instead of
 * the longest would answer 7 and the test below would not notice. (It did not,
 * the first time these ids were written the other way round.)
 */
const short = tiny("ab", claims({ zz: ["zz", 7] }));
/** "zz yy" together is 40 — a longer claim over the same first word. */
const long = tiny("yo", claims({ "zz yy": ["zz yy", 40] }));

const numberOf = (tokens: Token[]) => {
  const first = tokens[0];
  return first?.type === "number" ? first.value.toString() : null;
};

const foldWith = (input: string, locales: Locale[], weights?: Weights) =>
  foldNumerals(
    lex(normalize(input).text, locales[0] as Locale),
    locales,
    weights === undefined ? undefined : [weights],
  );

test("the longest claim wins across languages, whichever order they were installed", () => {
  expect(numberOf(foldWith("zz yy", [short, long]))).toBe("40");
  expect(numberOf(foldWith("zz yy", [long, short]))).toBe("40");
  // And a weight does not buy the shorter claim the run: understanding more of
  // the input is not a preference, so the two axes never trade against each
  // other. Only a tie in `consumed` reaches the weight at all.
  expect(numberOf(foldWith("zz yy", [short, long], { "locale:ab": 100 }))).toBe("40");
  // The shorter language still gets the words the longer one cannot read.
  expect(numberOf(foldWith("zz", [long, short]))).toBe("7");
});

test("a tie in consumed is broken by locale weight, then by id ascending", () => {
  const aa = tiny("aa", claims({ zz: ["zz", 7] }));
  const bb = tiny("bb", claims({ zz: ["zz", 9] }));

  // Deterministic and insertion-order-independent: the same answer twice in a
  // row, and the same answer with the array reversed. A tie-break that reads
  // as deterministic but falls out of Map insertion order fails here.
  expect(numberOf(foldWith("zz", [aa, bb]))).toBe("7");
  expect(numberOf(foldWith("zz", [aa, bb]))).toBe("7");
  expect(numberOf(foldWith("zz", [bb, aa]))).toBe("7");

  // Preference second: a `locale:` weight moves it, and moves it back.
  expect(numberOf(foldWith("zz", [aa, bb], { "locale:bb": 1 }))).toBe("9");
  expect(numberOf(foldWith("zz", [bb, aa], { "locale:bb": 1 }))).toBe("9");
  expect(numberOf(foldWith("zz", [bb, aa], { "locale:aa": 1 }))).toBe("7");
  // A weight on the loser that does not outweigh the winner leaves it alone.
  expect(numberOf(foldWith("zz", [aa, bb], { "locale:aa": 2, "locale:bb": 1 }))).toBe(
    "7",
  );
});

test("the digit-plus-scale-word path is many-language too", () => {
  const scale = tiny("zu", claims({ gaz: ["gaz", 1000] }));
  expect(numberOf(foldWith("1.5 gaz", [en, scale]))).toBe("1500");
});

test("no installed language declaring numerals still returns the same array", () => {
  const { numerals: _drop, ...language } = english;
  const bare = composeLocale(language);
  const tokens = lex(normalize("one kg").text, bare);
  expect(foldNumerals(tokens, [bare, composeLocale({ ...language, id: "xh" })])).toBe(
    tokens,
  );
});

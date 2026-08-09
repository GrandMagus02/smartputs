import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { createEngine } from "../engine";
import { NoCandidateError } from "../errors";
import type { AnalyzeCtx } from "../types";
import { composeLocale } from "./compose";
import { compoundSplitter } from "./compound-splitter";
import { defineLanguage } from "./define";
import { identity } from "./helpers";
import { defineVocabulary } from "./vocabulary";

/**
 * The degenerate run, as `helpers.test.ts` builds it: `compoundSplitter` reads
 * nothing but the surface, so the run is here only because `AnalyzeCtx`
 * requires one. `locale: "de"` because every word below is German.
 */
const ctx = (surface: string): AnalyzeCtx => ({
  locale: "de",
  words: [surface],
  index: 0,
});

/** A length vocabulary the size a real German one would start at. */
const LENGTHS = ["meter", "zentimeter", "kilometer"];

test("compoundSplitter offers the last part of a compound at a penalty", () => {
  const split = compoundSplitter({ vocabulary: LENGTHS, minPart: 3 });
  expect(split("Bandmeter", ctx("Bandmeter"))).toEqual([{ form: "meter", weight: -3 }]);
});

/**
 * The case question, answered by measurement rather than by assumption: the
 * resolver hands an analyzer `word.text` — the token exactly as typed — and
 * folds only what comes back out (`candidates.ts`, `fold(analyzed.form)`). So
 * a German noun arrives capitalised, always, and a splitter that matched its
 * vocabulary case-sensitively would claim nothing a German ever wrote.
 */
test("compoundSplitter matches its vocabulary case-insensitively", () => {
  const split = compoundSplitter({ vocabulary: LENGTHS, minPart: 3 });
  expect(split("Zentimeter", ctx("Zentimeter"))).toEqual([{ form: "meter", weight: -3 }]);
  expect(split("ZENTIMETER", ctx("ZENTIMETER"))).toEqual([{ form: "meter", weight: -3 }]);
  // And a vocabulary written the way German writes its nouns folds too.
  const capitalised = compoundSplitter({ vocabulary: ["Meter"], minPart: 3 });
  expect(capitalised("Bandmeter", ctx("Bandmeter"))).toEqual([
    { form: "meter", weight: -3 },
  ]);
});

test("compoundSplitter takes the weight it is given", () => {
  const split = compoundSplitter({ vocabulary: LENGTHS, minPart: 3, weight: -7 });
  expect(split("Bandmeter", ctx("Bandmeter"))).toEqual([{ form: "meter", weight: -7 }]);
});

/**
 * `minPart` guards both parts, not just the one that is emitted. A one-letter
 * head is not a morpheme, and a word that merely *ends* in a short vocabulary
 * entry is not a compound of it.
 */
test("compoundSplitter refuses a head shorter than minPart", () => {
  const split = compoundSplitter({ vocabulary: LENGTHS, minPart: 6 });
  // "zenti" is five letters, so at minPart 6 this is one word, not two.
  expect(split("Zentimeter", ctx("Zentimeter"))).toEqual([]);
  expect(
    compoundSplitter({ vocabulary: LENGTHS, minPart: 5 })("Zentimeter", ctx("")),
  ).toEqual([{ form: "meter", weight: -3 }]);
});

test("compoundSplitter refuses a tail shorter than minPart", () => {
  const split = compoundSplitter({ vocabulary: ["fu"], minPart: 3 });
  expect(split("Bandfu", ctx("Bandfu"))).toEqual([]);
});

/**
 * The word that is *only* the vocabulary entry is not a compound of itself.
 * `identity()` already offers it at weight 0; offering it again at a penalty
 * would add nothing (the chain keeps the higher weight) and would let a
 * `minPart` of 0 quietly turn the splitter into a second identity.
 */
test("compoundSplitter never claims a bare vocabulary word", () => {
  const split = compoundSplitter({ vocabulary: LENGTHS, minPart: 0 });
  expect(split("meter", ctx("meter"))).toEqual([]);
  expect(split("Meter", ctx("Meter"))).toEqual([]);
});

/**
 * The refusal Task 21's smoke test rests on. "Zentrum" shares five letters
 * with "Zentimeter" and is a different word in a different dimension; nothing
 * it ends in is a length, so the splitter must come back empty rather than
 * find a reading in the prefix it happens to share.
 */
test("compoundSplitter does not claim a word that merely starts the same way", () => {
  const split = compoundSplitter({ vocabulary: LENGTHS, minPart: 3 });
  expect(split("Zentrum", ctx("Zentrum"))).toEqual([]);
});

/**
 * Every split that satisfies both guards, longest tail first, because a
 * shorter tail discards more of the word and is the weaker reading of the two.
 * The resolver, not the helper, decides between them — it has the alias index
 * and the weight layers, and the helper has neither.
 */
test("compoundSplitter offers every split it can make, longest tail first", () => {
  const split = compoundSplitter({ vocabulary: ["meter", "zentimeter"], minPart: 3 });
  expect(split("Quadratzentimeter", ctx("Quadratzentimeter"))).toEqual([
    { form: "zentimeter", weight: -3 },
    { form: "meter", weight: -3 },
  ]);
});

test("compoundSplitter accepts a Set as readily as an array", () => {
  const split = compoundSplitter({ vocabulary: new Set(LENGTHS), minPart: 3 });
  expect(split("Bandmeter", ctx("Bandmeter"))).toEqual([{ form: "meter", weight: -3 }]);
});

test("compoundSplitter holds nothing between calls", () => {
  const split = compoundSplitter({ vocabulary: LENGTHS, minPart: 3 });
  const first = split("Bandmeter", ctx("Bandmeter"));
  expect(split("Zentrum", ctx("Zentrum"))).toEqual([]);
  expect(split("Bandmeter", ctx("Bandmeter"))).toEqual(first);
});

// --- through a real engine ---------------------------------------------

/**
 * The minimal German this helper exists for: three length words, and the
 * splitter behind `identity()` so an exact alias always outranks a split.
 *
 * It is deliberately *not* a shipped package — spec §13 puts any language
 * beyond `en`/`uk` out of scope — and it is here rather than only in Task 21
 * because a helper that passes its own unit tests and moves no real answer is
 * the failure mode P3 and P4 both shipped.
 */
const german = defineLanguage({
  id: "de",
  numberFormat: "intl",
  analyze: [identity(), compoundSplitter({ vocabulary: LENGTHS, minPart: 3 })],
  keywords: { in: ["in"] },
  selectForm: () => "other",
});

const GERMAN_LENGTH = defineVocabulary({
  locale: "de",
  kind: "length",
  units: {
    m: { aliases: ["meter"], symbol: "m", forms: { other: "Meter" } },
    cm: { aliases: ["zentimeter"], symbol: "cm", forms: { other: "Zentimeter" } },
    km: { aliases: ["kilometer"], symbol: "km", forms: { other: "Kilometer" } },
  },
});

// English first, so English is the format locale: the reading is German, the
// writing is not, which is exactly the many-to-one split spec §9 specifies.
const engine = createEngine({
  locales: [composeLocale(english, BUILTIN_EN), composeLocale(german, [GERMAN_LENGTH])],
  kinds: BUILTIN_KINDS,
});

/**
 * The reading the whole helper is for, measured through the real engine rather
 * than asserted about the analyzer: the alias German listed wins, at weight 0,
 * over the `meter` the splitter finds inside the same word at -3. A helper
 * whose penalty were a boost would answer 10 metres here and every unit test
 * above would still be green.
 */
test("a German engine reads Zentimeter as centimetres, not metres", () => {
  const result = engine.evaluate("10 Zentimeter");
  expect(result.value.unit).toBe("cm");
  expect(result.formatted).toBe("10 centimetres");
});

test("the split is what reaches a compound no vocabulary lists", () => {
  const result = engine.evaluate("10 Bandmeter");
  expect(result.value.unit).toBe("m");
});

/**
 * The same penalty, seen from the other side: "Kilometer" contains "meter",
 * and a splitter that outranked the exact alias would silently answer in the
 * wrong unit for every prefixed length word German has.
 */
test("an exact alias outranks the split inside it", () => {
  expect(engine.evaluate("10 Kilometer").value.unit).toBe("km");
  expect(engine.evaluate("10 Meter").value.unit).toBe("m");
});

/**
 * And the refusal, end to end. "Zentrum" is a town square; there is no reading
 * of it as a length, and the engine must say so rather than answer 10 of
 * something.
 */
test("a German engine finds no length in Zentrum", () => {
  expect(() => engine.evaluate("10 Zentrum")).toThrow(NoCandidateError);
});

/**
 * Installing German must not move what English already answered. The splitter
 * runs on every word the engine sees, including English ones, and a helper
 * that claimed English compounds would be a regression no German test could
 * catch.
 */
test("installing the splitter moves no English reading", () => {
  expect(engine.evaluate("10 kilometers").formatted).toBe("10 kilometres");
  expect(engine.evaluate("10 metres").formatted).toBe("10 metres");
  expect(engine.evaluate("2 kg in grams").formatted).toBe("2,000 grams");
});

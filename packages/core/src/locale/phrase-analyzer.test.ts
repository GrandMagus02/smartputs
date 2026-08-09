import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { createEngine } from "../engine";
import { NoCandidateError } from "../errors";
import type { AnalyzeCtx } from "../types";
import { createAnalyzerChain } from "./analyze";
import { composeLocale } from "./compose";
import { defineLanguage } from "./define";
import { identity } from "./helpers";
import { phraseAnalyzer } from "./phrase-analyzer";

/**
 * The run an analyzer is asked about, written the way `createAnalyzerChain`
 * builds it: the words the writer put next to each other, and which of them
 * this call is about. `words[index]` is always the surface — the chain
 * guarantees it — so these two arguments are one fact stated twice, and the
 * helper below keeps the tests from restating it by hand.
 */
const at = (words: string[], index: number): [string, AnalyzeCtx] => [
  words[index] as string,
  { locale: "en", words, index },
];

const AREA = { "square metres": "m2", "cubic metres": "m3" };

test("a phrase claims its last word", () => {
  const a = phraseAnalyzer(AREA);
  expect(a(...at(["square", "metres"], 1))).toEqual([{ form: "m2", weight: 1 }]);
});

/**
 * Backwards from the word being analyzed, not forwards from the start of the
 * run: the phrase is what stands *behind* this word, and everything in front
 * of it is somebody else's business. A run is whatever the writer wrote
 * adjacent — "twenty square metres" is three words once `lex` has recorded it
 * (the numeral fold that eats "twenty" runs afterwards) — so a phrase that
 * only ever matched a whole run would match almost nothing real.
 */
test("a phrase in the middle of a longer run still matches", () => {
  const a = phraseAnalyzer(AREA);
  expect(a(...at(["twenty", "square", "metres"], 2))).toEqual([
    { form: "m2", weight: 1 },
  ]);
});

/**
 * A phrase longer than the text in front of the word must refuse it: not
 * throw, and not match the short window that is all the run has left. The
 * writer of "metres wide" did not write "square metres", and a helper that
 * read a two-word phrase off a one-word history would say they had.
 */
test("a phrase that runs off the start of the run does not match", () => {
  const a = phraseAnalyzer(AREA);
  expect(a(...at(["metres"], 0))).toEqual([]);
  expect(a(...at(["metres", "wide"], 0))).toEqual([]);
});

/**
 * Two phrases ending at the same word, one a suffix of the other. Only the
 * longer is returned — not both — because they name *different units* (`m` and
 * `m2`) and returning both at one weight would hand the solver a tie between a
 * length and an area, decided by nothing but candidate order. "The longest
 * phrase ending at this word wins" is a decision made here, where the evidence
 * is, rather than deferred to a ranking that cannot see it.
 */
test("the longest phrase ending at this word wins, and only it", () => {
  const a = phraseAnalyzer({ metres: "m", "square metres": "m2" });
  expect(a(...at(["square", "metres"], 1))).toEqual([{ form: "m2", weight: 1 }]);
  // And the shorter one still matches where the longer one cannot.
  expect(a(...at(["ten", "metres"], 1))).toEqual([{ form: "m", weight: 1 }]);
});

/**
 * A one-word key is a phrase of length one and is claimed as such, which makes
 * this `tableAnalyzer` with a boost instead of a penalty. Deliberate: refusing
 * it would be a carve-out with nothing behind it, and a language listing
 * "square metres" beside "sqm" should not have to reach for a second helper to
 * say the second one.
 */
test("a one-word phrase matches a word standing alone", () => {
  const a = phraseAnalyzer({ sqm: "m2" });
  expect(a(...at(["sqm"], 0))).toEqual([{ form: "m2", weight: 1 }]);
});

/**
 * What it must not claim, and the case that motivates matching backwards at
 * all: "square" is *in* the phrase but is not the word the phrase is about.
 * The reading belongs to the last word — the one the writer's unit actually
 * sits on — and claiming it at the first would mean "5 square" naming an area
 * with the "metres" still unread.
 */
test("a word inside a phrase but not at its end claims nothing", () => {
  const a = phraseAnalyzer(AREA);
  expect(a(...at(["square", "metres"], 0))).toEqual([]);
  // The same two words in the other order are not the phrase.
  expect(a(...at(["metres", "square"], 1))).toEqual([]);
});

/** A phrase's words must be adjacent and in order, not merely present. */
test("a phrase whose words are separated does not match", () => {
  const a = phraseAnalyzer(AREA);
  expect(a(...at(["square", "and", "metres"], 2))).toEqual([]);
});

/**
 * The vacuous claim: a phrase with no words in it matches at *every* word of
 * *every* run, so every surface in the language would read as whatever that
 * entry named, at a boost, with nothing thrown. Today's implementation refuses
 * it twice over — the key is dropped at construction, and a phrase with no
 * last word could not be looked up anyway — and this is pinned against the
 * helper rather than against either of those, because both are how it happens
 * to be written and this is what it promises.
 */
test("an empty key claims nothing", () => {
  const a = phraseAnalyzer({ "": "m2", "   ": "m3" });
  expect(a(...at(["metres"], 0))).toEqual([]);
  expect(a(...at(["square", "metres"], 1))).toEqual([]);
});

/**
 * The other half of the same guard, and the half that has to do work: a run
 * never contains an empty word, so a key split naively on spaces would leave a
 * double-space typo matching nothing at all, silently, for as long as nobody
 * looked at the table character by character.
 */
test("extra whitespace inside a key is not a word", () => {
  const a = phraseAnalyzer({ "square  metres": "m2" });
  expect(a(...at(["square", "metres"], 1))).toEqual([{ form: "m2", weight: 1 }]);
});

test("the weight is the caller's, and it reaches the form", () => {
  const a = phraseAnalyzer(AREA, 7);
  expect(a(...at(["square", "metres"], 1))).toEqual([{ form: "m2", weight: 7 }]);
});

/**
 * Holds no state between calls: the chain memoizes, the helper does not. The
 * same analyzer answering about three different runs must answer about each of
 * them, not about the first one three times.
 */
test("one analyzer answers about every run it is given", () => {
  const a = phraseAnalyzer(AREA);
  expect(a(...at(["square", "metres"], 1))).toEqual([{ form: "m2", weight: 1 }]);
  expect(a(...at(["cubic", "metres"], 1))).toEqual([{ form: "m3", weight: 1 }]);
  expect(a(...at(["metres"], 0))).toEqual([]);
  expect(a(...at(["square", "metres"], 1))).toEqual([{ form: "m2", weight: 1 }]);
});

test("through the chain, the phrase reading outranks the bare word", () => {
  const chain = createAnalyzerChain(
    defineLanguage({ ...english, analyze: [identity(), phraseAnalyzer(AREA)] }),
  );
  expect(chain("metres", { words: ["square", "metres"], index: 1 })).toEqual([
    { form: "m2", weight: 1 },
    { form: "metres", weight: 0 },
  ]);
  expect(chain("metres")).toEqual([{ form: "metres", weight: 0 }]);
});

const engineWith = (table: Record<string, string>) =>
  createEngine({
    locales: [
      composeLocale(
        defineLanguage({ ...english, analyze: [identity(), phraseAnalyzer(table)] }),
        BUILTIN_EN,
      ),
    ],
    kinds: BUILTIN_KINDS,
  });

/**
 * The real engine, real vocabulary, real input — the only measurement that
 * proves the run arrives here at all, since between `lex` recording it and
 * this analyzer reading it sit three fold passes and a resolver.
 *
 * The phrase is nonsense as English and the unit it names is real: no built-in
 * vocabulary ships a multi-word alias, so a phrase that reads as English would
 * have to be invented in the vocabulary too, and the test would then be about
 * the vocabulary. This one is about the wiring. "twenty two kg" is a run of
 * three words because runs are recorded before the numeral fold eats the first
 * two, which is exactly the shape a real phrase has.
 *
 * It also measures the default weight where it matters. `identity` reaches
 * mass:kg at 0 and the phrase reaches mass:g at +1; both are candidates, and
 * the engine answers grams. A default penalty — `tableAnalyzer`'s -1, the
 * obvious thing to copy — would have inverted this and made every phrase lose
 * to the bare word it was written to override.
 */
test("a phrase reading changes what a real engine answers", () => {
  const engine = engineWith({ "twenty two kg": "g" });
  expect(engine.evaluate("twenty two kg").formatted).toBe("22 grams");
  // Same word, same count, no run: the phrase declines and "kg" is a kilogram.
  expect(engine.evaluate("22 kg").formatted).toBe("22 kilograms");
  expect(engine.evaluate("kg").formatted).toBe("1 kilogram");
});

/**
 * The limit this helper cannot lift, pinned rather than described, so that the
 * day the parser learns to consume several words this test fails and is
 * rewritten instead of quietly staying true.
 *
 * `phraseAnalyzer` gives "metres" in "10 square metres" the reading `m2` — the
 * chain test above measures exactly that — and the engine still throws, on the
 * word before it. `pratt` reads one word per quantity: it asks the resolver
 * about "square", gets nothing (nobody's alias, and the phrase does not end
 * there), and raises `NoCandidateError` before "metres" is ever looked at.
 * Claiming the phrase at its *first* word does not rescue it either — that was
 * measured, and it parses "10 square" as a quantity and then fails on the
 * leftover "metres" with `UnitParseError`, which is a worse answer, not a
 * better one. A multi-word quantity needs a parser change; no analyzer can
 * reach it.
 */
test("a written-out phrase still needs a parser that consumes several words", () => {
  const engine = engineWith(AREA);
  expect(() => engine.evaluate("10 square metres")).toThrow(NoCandidateError);
  expect(() => engine.evaluate("1 m2 in square metres")).toThrow(NoCandidateError);
  // The reading is there; the parser is what cannot spend it.
  const chain = createAnalyzerChain(
    defineLanguage({ ...english, analyze: [identity(), phraseAnalyzer(AREA)] }),
  );
  expect(chain("metres", { words: ["square", "metres"], index: 1 })[0]).toEqual({
    form: "m2",
    weight: 1,
  });
});

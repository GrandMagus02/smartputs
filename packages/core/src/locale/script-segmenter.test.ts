import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { createEngine } from "../engine";
import { NoCandidateError } from "../errors";
import { lex } from "../parse/lex";
import type { Language } from "../types";
import { composeLocale } from "./compose";
import { defineLanguage } from "./define";
import { scriptSegmenter } from "./script-segmenter";
import { defineVocabulary } from "./vocabulary";

/** The three scripts a Japanese `Language` would declare. */
const JAPANESE = ["Han", "Hiragana", "Katakana"] as const;

/**
 * What `lex`'s `defaultSegment` does, copied verbatim from `parse/lex.ts`, so
 * that every claim below about "more than the default" is measured against the
 * default rather than asserted about it. If `lex` ever changes its default,
 * this copy stops matching and the tests that compare the two stop meaning
 * what they say — which is the point of keeping it here rather than exporting
 * the real one.
 */
const defaultSegment = (run: string, localeId: string): string[] => {
  const segmenter = new Intl.Segmenter(localeId, { granularity: "word" });
  return [...segmenter.segment(run)].filter((s) => s.isWordLike).map((s) => s.segment);
};

// --- the happy cases ---

test("a CJK run splits into words", () => {
  const segment = scriptSegmenter({ script: JAPANESE });
  expect(segment("キログラムをグラム")).toEqual(["キログラム", "を", "グラム"]);
});

test("a Thai run splits into words", () => {
  const segment = scriptSegmenter({ script: "Thai" });
  expect(segment("กิโลเมตรต่อชั่วโมง")).toEqual(["กิโลเมตร", "ต่อ", "ชั่วโมง"]);
});

test("a Latin run passes through unchanged", () => {
  const segment = scriptSegmenter({ script: JAPANESE });
  expect(segment("kilograms")).toEqual(["kilograms"]);
  expect(segment("kg")).toEqual(["kg"]);
});

test("a run of the declared script that is one word stays one word", () => {
  const segment = scriptSegmenter({ script: JAPANESE });
  expect(segment("キログラム")).toEqual(["キログラム"]);
});

// --- what it refuses to claim ---

/**
 * The guard, and the reason `script` is a parameter at all. `Intl.Segmenter`
 * breaks Japanese whatever locale tag it was built with — measured in the
 * second half of this test — so a helper that always deferred to it would make
 * `script` decoration. It does not: a Thai language declares Thai, and the
 * Japanese run it was never asked about comes back whole.
 */
test("a run with none of the declared scripts is returned whole", () => {
  const thai = scriptSegmenter({ script: "Thai" });
  expect(thai("キログラムをグラム")).toEqual(["キログラムをグラム"]);
  // Not vacuous: ICU would have split it, under any tag.
  expect(defaultSegment("キログラムをグラム", "th")).toEqual([
    "キログラム",
    "を",
    "グラム",
  ]);
});

test("a mixed run is segmented as soon as one declared character appears", () => {
  const segment = scriptSegmenter({ script: JAPANESE });
  expect(segment("キロkg")).toEqual(["キロ", "kg"]);
});

test("an unknown script name fails when the language is built, not when it is read", () => {
  // `Jpan` is the obvious wrong guess: it is a valid ISO 15924 code and not a
  // Unicode script property value.
  expect(() => scriptSegmenter({ script: "Jpan" })).toThrow(/Jpan/);
  expect(() => scriptSegmenter({ script: [] })).toThrow(/at least one/);
});

// --- what it keeps that the default drops ---

/**
 * `defaultSegment` filters on `isWordLike`, which is a filter and therefore a
 * loss: the segments it rejects do not come back. Over the 132,243 characters
 * `\p{L}` accepts below U+30000, 351 are not `isWordLike` when segmented
 * alone, and `lex` admits every one of them into a letter run. U+3005, the
 * ideographic iteration mark, is the one a Japanese language would actually
 * meet.
 *
 * The loss is not merely a missing word. `lex` appends a run's trailing digits
 * to the *last* word segmentation returned, so a dropped final segment moves
 * the digits onto the wrong word, and every following token's span is computed
 * from an offset that skipped characters.
 */
test("a letter the default drops is kept", () => {
  const segment = scriptSegmenter({ script: JAPANESE });
  expect(defaultSegment("々", "ja")).toEqual([]);
  expect(segment("々")).toEqual(["々"]);
});

test("every letter of a run survives", () => {
  const segment = scriptSegmenter({ script: JAPANESE });
  for (const run of ["キログラムをグラム", "人々の", "キロ々グラム", "ｷﾛｸﾞﾗﾑをｸﾞﾗﾑ"]) {
    expect(segment(run).join("")).toBe(run);
  }
});

/**
 * Script *extensions*, not script. U+30FC (the prolonged sound mark, in every
 * long katakana loanword — メートル's neighbour ー) has `Script=Common`, so a
 * `\p{Script=Katakana}` guard would not recognise a run made of it and would
 * hand the whole thing back unsegmented.
 */
test("the guard recognises characters whose script is Common but whose extensions are not", () => {
  expect(/\p{Script=Katakana}/u.test("ー")).toBe(false);
  const segment = scriptSegmenter({ script: "Katakana" });
  expect(segment("ーー")).toEqual(["ーー"]);
});

test("the segmenter never returns nothing", () => {
  // A Thai digit: in the declared script, so the guard lets it through, and
  // not a letter, so the filter has nothing to keep.
  expect(scriptSegmenter({ script: "Thai" })("๑")).toEqual(["๑"]);
});

test("the segmenter holds no state between calls", () => {
  const segment = scriptSegmenter({ script: JAPANESE });
  const once = segment("キログラムをグラム");
  expect(segment("kilograms")).toEqual(["kilograms"]);
  expect(segment("キログラムをグラム")).toEqual(once);
});

// --- through the real lexer and the real engine ---

type Segment = NonNullable<Language["segment"]>;

const japanese = (segment: Segment): Language =>
  defineLanguage({
    id: "ja",
    numberFormat: "intl",
    segment,
    keywords: { in: ["を"] },
    selectForm: () => "other",
    // Japanese sets the unit tight against the number, and `form` is the word
    // — `parts.unit` is the unit *id*, which is English by construction.
    renderQuantity: ({ number, form }) => `${number}${form ?? ""}`,
  });

const massJa = defineVocabulary({
  locale: "ja",
  kind: "mass",
  units: {
    kg: { aliases: ["キログラム"], forms: { other: "キログラム" } },
    g: { aliases: ["グラム"], forms: { other: "グラム" } },
  },
});

const engineWith = (segment: Segment) =>
  createEngine({
    locales: [composeLocale(japanese(segment), [massJa])],
    kinds: BUILTIN_KINDS,
  });

/**
 * The case `lex`'s own comment describes: "Segmentation still runs over the
 * letters alone -- Intl.Segmenter would keep `m2` whole, but a locale
 * `segment` hook returning substrings of its input cannot be asked to." The
 * hook is handed `"m"`, never `"m2"`, and `lex` puts the digits back on the
 * last word it returned. A helper that answered with anything but substrings
 * of its argument, in order, would desynchronise `lex`'s `indexOf` walk and
 * silently mis-span every token after it.
 */
test("the hook is handed the letters alone and lex puts the digits back", () => {
  const seen: string[] = [];
  const inner = scriptSegmenter({ script: JAPANESE });
  const locale = composeLocale(
    japanese((run) => {
      seen.push(run);
      return inner(run);
    }),
    [massJa],
  );

  const words = lex("1 m2", locale).filter((t) => t.type === "word");
  expect(seen).toEqual(["m"]);
  expect(words.map((t) => ("text" in t ? t.text : ""))).toEqual(["m2"]);
});

/**
 * The seam, exercised where it actually lives. A Japanese conversion is one
 * unbroken letter run — `lex` cuts on spaces and there are none — so the unit,
 * the connective and the target arrive at `segment` together or not at all.
 *
 * The second half is the measurement that makes the first half mean something.
 * The same engine, the same input, the same helper, one option changed: a
 * language that declared Thai does not split Japanese, so `キログラムをグラム`
 * reaches the resolver as a single word nobody has an alias for. Without this
 * pair the first assertion would pass on a hook that ignored `script`
 * entirely.
 */
test("a real engine reads a Japanese conversion through the helper", () => {
  const engine = engineWith(scriptSegmenter({ script: JAPANESE }));
  expect(engine.evaluate("5キログラムをグラム").formatted).toBe("5,000グラム");

  const misdeclared = engineWith(scriptSegmenter({ script: "Thai" }));
  expect(() => misdeclared.evaluate("5キログラムをグラム")).toThrow(NoCandidateError);
  // And the message names the whole run: it reached the resolver unbroken, as
  // one unit nobody has a word for, which is the failure this helper prevents.
  expect(() => misdeclared.evaluate("5キログラムをグラム")).toThrow(/キログラムをグラム/);
});

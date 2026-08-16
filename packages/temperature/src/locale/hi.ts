import { aliasesFor } from "@smartput/kind/aliases";
import type { Vocabulary } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "../units";

const alias = (unit: TemperatureUnit) => aliasesFor(TEMPERATURE_UNITS, unit);
const deltaAlias = (unit: TempDeltaUnit) => aliasesFor(TEMPDELTA_UNITS, unit);

/**
 * The Devanagari spellings, in one object for the same reason `units.ts` keeps
 * one `ALIAS` map: both kinds must answer to the identical words, and two
 * hand-kept lists are a place for them to drift apart.
 *
 * The scale names are what a reader types when they clip the full phrase down to
 * one token, and the full phrase is always two tokens in Hindi — "२० डिग्री
 * सेल्सियस" is *degree* + the scale name. A word token ends at a space, so only
 * the scale name can ever be an alias; see the vocabulary's own comment below
 * for what that costs and why it is right.
 *
 * Every entry is written with the nukta **decomposed** where it has one. फ़
 * (U+095E) is a Unicode composition exclusion, so NFKC — which `normalize()`
 * applies before a word reaches the resolver — splits it into फ + U+093C. A
 * precomposed alias would test green against this table and be unreachable
 * through the engine. `hi.test.ts` asserts NFKC-stability over every alias, which
 * is what stops that from being a silent failure. The nukta's *absence* is a
 * different problem and no normalization fixes it, so फारेनहाइट is declared
 * beside फ़ारेनहाइट: the two are different letters, and there is no way to know
 * which one a keyboard produced.
 *
 * One word a Hindi speaker genuinely writes is deliberately **not** here, and the
 * absence is asserted in `hi.test.ts` rather than left in a comment: **डिग्री**
 * ("degree"), which is the counted noun of every Hindi temperature phrase. It is
 * also Hindi for the *angular* degree — the unit `@smartput/angle` registers — so
 * claiming it here would make "90 डिग्री" a temperature candidate in every
 * composed engine, and it would be the wrong candidate for the commoner reading.
 * The phrase it belongs to is two tokens in any case, so no alias could carry it.
 */
const HINDI: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  // सेल्सियस is the transliteration a Hindi textbook and a Hindi weather report
  // both set; सेल्सीयस writes the same syllable with a long ी and is what a
  // second keyboard layout produces. सेंटीग्रेड is "centigrade", which Hindi
  // borrowed whole and still uses in school physics — the same synonym pair the
  // Latin `ALIAS` map records with "celsius" and "centigrade".
  c: ["सेल्सियस", "सेल्सीयस", "सेंटीग्रेड"],
  // Nukta-bearing form first (it is the correct spelling), nukta-less second.
  f: ["फ़ारेनहाइट", "फारेनहाइट"],
  // The one countable noun of the three: a kelvin is a unit in its own right
  // rather than a degree named after somebody, so it takes an ordinary oblique
  // plural — "300 केल्विनों में" — which is exactly the form the `in`
  // postpositions put a unit into. `hindi`'s suffix stripper does recover it, at
  // `weight: -2`; listing it means the form is read at full weight instead of
  // through a penalised guess.
  k: ["केल्विन", "केल्विनों"],
};

/**
 * Hindi words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`,
 * `uk.ts` and `ar.ts` next door, because one package defines two kinds and a
 * `Vocabulary` names exactly one of them.
 *
 * **No `forms` on any of the six entries, and the decision was re-taken rather
 * than copied.** `en`'s argument is that the written form people use is the
 * symbol — "20°C", not "20 degrees celsius" — and the question for Hindi is
 * whether anything about this language overturns it. Two things could have, and
 * neither does:
 *
 *   - **The spelled form is two tokens in every register.** Hindi says "२०
 *     डिग्री सेल्सियस", with डिग्री the counted noun and the scale name behind
 *     it, exactly as Arabic says "٢٠ درجة مئوية". A word token ends at a space,
 *     so a printer emitting the spelled form would be emitting a string the
 *     parser cannot read back — and `assertLocaleContract` checks precisely that
 *     every printable surface reads back. The one word that could have carried
 *     the phrase, डिग्री, is the angular degree and is not this kind's to claim.
 *   - **The two categories would hold one string twice.** सेल्सियस, फ़ारेनहाइट
 *     and केल्विन are consonant-final masculine loanwords whose direct plural is
 *     the same word as their singular — "५ केल्विन", never "केल्विनें" — so
 *     `one` and `other` would differ in nothing. What Hindi *does* inflect is the
 *     oblique plural (केल्विनों), and that is a form the reader needs and the
 *     printer never does, which is why it is an alias above and not a form here.
 *
 * So `hindi.selectForm` is never called for these units: a unit with no `forms`
 * never reaches the table lookup. `hi.test.ts` says that rather than
 * manufacturing an assertion that looks like the grammar is being exercised, and
 * it pins the key set separately — including the row a table ported from `en`
 * would get wrong, since Hindi's `one` is CLDR's `i = 0 or n = 1` and covers 0
 * and every fraction below 1 where English's does not.
 *
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six entries: the renderer's no-symbol branch joins number
 * and unit *with* a space, so a unit that forgot its symbol would silently move a
 * byte rather than fail.
 *
 * **The three symbols stay Latin**, and that is a decision rather than an
 * oversight. °C, °F and K are what Hindi scientific and press typography sets,
 * Latin letters and all — a Hindi weather page writes "२५°C". The Devanagari
 * clipping सें (for सेंटीग्रेड) exists in older print and is unreachable anyway:
 * `lex` throws "°" away as an unrecognized character, and a two-letter Devanagari
 * abbreviation sits below the suffix stripper's `minStem: 3` floor with nothing
 * to gain from it. Keeping the symbols Latin also keeps `hindi.renderQuantity` on
 * its tight branch — it spaces a Devanagari symbol from the number and closes up
 * a Latin one — so this kind prints "20°C" exactly as English does, and unlike
 * Arabic, which spaces every symbol.
 *
 * **Devanagari digits do not parse**, which is inherited and left alone:
 * `@smartput/core/locale/hi` documents why "२०" reaches the lexer as an
 * unrecognized character and is skipped, and that closing it means a
 * digit-folding pass in `normalize()`. Every number in `hi.test.ts` is therefore
 * written with Latin digits, which is also what a Hindi keyboard produces.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Hindi
 * engine and the micro path (`parseTemperature`) cannot drift from it. The Hindi
 * spellings are appended from the one `HINDI` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is
 * also what lets "20 C जोड़ 5 F" read its right operand as a difference.
 * Deriving both lists from the same two sources keeps them equal by construction
 * instead of by proofreading.
 *
 * Like `en`, this file names both kinds by **id string** and imports neither,
 * which is what lets `@smartput/temperature/locale/hi` be imported without
 * linking the ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureHi: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "hi",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...HINDI.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...HINDI.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...HINDI.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "hi",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...HINDI.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...HINDI.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...HINDI.k], symbol: "K" },
    },
  }),
];

export default temperatureHi;

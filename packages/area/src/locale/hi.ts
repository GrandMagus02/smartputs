import { aliasesFor, defineVocabulary } from "@smartput/core";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Hindi words for the area units — the same five units `en` next door names,
 * and the same per-unit decision about whether a unit has words at all.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi in
 * Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are a
 * second numbering system that `@smartput/core/locale/hi` reports as
 * unreachable; nothing a word list could do would change that.
 *
 * **Two `forms` keys, and both hold the same word.** `hindi.selectForm` returns
 * CLDR's `"one" | "other"` and nothing else, with no case axis crossed with it —
 * the direct and oblique *singular* of a consonant-final masculine loanword are
 * the same word, so an axis would double every table in the repo to record one
 * cell, and the oblique plural (एकड़ों) is read by `hindi`'s suffix stripper
 * instead. Then the plural collapses too, for a reason specific to counting: a
 * Hindi measure noun stays in the direct singular after a numeral. "पाँच एकड़"
 * is five acres and "पाँच एकड़ें" is not Hindi. Both units that have words here
 * are consonant-final masculines, so both rows are one string on both of them,
 * and repeating it is the correct table rather than a half-finished one.
 *
 * The boundary is still not English's, and that is worth stating even where it
 * cannot be seen: Hindi's `one` is CLDR's `i = 0 or n = 1`, so 0 and 0.5 take
 * `one` while 1.5 and 2 take `other`, where English puts 0 in `other`. It is
 * invisible in this kind precisely because the rows agree; `@smartput/angle` and
 * `@smartput/length` each have one unit where it is not, and `hi.test.ts` here
 * asserts the key set against `selectForm` rather than against the words, so
 * that a later unit which does inflect finds the contract already stated.
 *
 * **मी², सेमी² and किमी² carry no `forms`, exactly as `en`, `uk` and `ar` carry
 * none.** The reason is the same in all four languages: "वर्ग मीटर" is two
 * words, `lex` ends a word token at the space, and the printer's spelled path
 * only ever emits something the parser can read back — so a form here would hand
 * completion text that fails to evaluate. The solid compound वर्गमीटर *is* one
 * token and is listed as an alias, because people write it that way and the
 * reader should accept it; it is not promoted to a form, because the spaced
 * spelling is the commoner one and a printer that emits the rarer spelling to
 * dodge a lexer limitation is choosing its words for the wrong reason.
 *
 * They render through their symbol instead, which `hindi.renderQuantity` sets
 * off from the number with a space ("3 मी²") because the stem is Devanagari; a
 * Latin symbol in the same position stays tight. Both the superscript and the
 * plain-digit spelling are listed for each, and both have to be: `normalize()`
 * runs NFKC, which folds ² to a plain 2 before the lexer ever sees it, while
 * `assertLocaleContract` looks the *symbol* up in the alias index unfolded. One
 * spelling would fail one of the two paths.
 *
 * **Symbols are Devanagari where Hindi abbreviates and spelled out where it does
 * not.** मी, सेमी and किमी are the dotless abbreviations a tape measure and a
 * road sign carry — Hindi prints them with full stops (मी., से.मी.) and a full
 * stop is not a letter, so `lex` would end the word token at the first dot. हेक्टेयर
 * and एकड़ have no Hindi abbreviation at all and take the spelled nominative
 * singular, the same choice `en` makes for `acre`. R8 wants an explicit symbol
 * on every unit, not an invented one.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in a Hindi engine and the
 * micro path (`parseArea`) cannot drift from it.
 *
 * Like `en`, this file names `area` by id string and never imports the kind,
 * which is what lets `@smartput/area/locale/hi` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "area",
  units: {
    m2: {
      aliases: [...alias("m2"), "मी2", "मी²", "वर्गमीटर"],
      symbol: "मी²",
    },
    cm2: {
      aliases: [...alias("cm2"), "सेमी2", "सेमी²", "वर्गसेंटीमीटर"],
      symbol: "सेमी²",
    },
    km2: {
      aliases: [...alias("km2"), "किमी2", "किमी²", "वर्गकिलोमीटर"],
      symbol: "किमी²",
    },
    // हेक्टर is the shorter transliteration, closer to the English vowel, and is
    // what a revenue record is as likely to carry as हेक्टेयर. Both are read and
    // the fuller one is written.
    hectare: {
      aliases: [...alias("hectare"), "हेक्टेयर", "हेक्टर"],
      symbol: "हेक्टेयर",
      forms: { one: "हेक्टेयर", other: "हेक्टेयर" },
    },
    // एकड़'s nukta is written here in the decomposed form NFKC produces
    // (ड + U+093C): ड़ is a Unicode composition *exclusion*, so a precomposed
    // U+095C would test green against this object and be unreachable through
    // `normalize()`. एकड without the nukta is ordinary Devanagari that a great
    // many people type, and no normalization will ever join it to the
    // nukta-bearing form, so it is listed beside it.
    //
    // बीघा is deliberately NOT listed. It is a real Indian land measure with a
    // name of its own, and its size varies by state — roughly a quarter of an
    // acre in Bengal and two-thirds of one in Uttar Pradesh — so claiming it here
    // would silently answer a different question by a factor that depends on
    // where the reader lives. The same reasoning keeps فدان out of
    // `@smartput/area/locale/ar`.
    acre: {
      aliases: [...alias("acre"), "एकड़", "एकड"],
      symbol: "एकड़",
      forms: { one: "एकड़", other: "एकड़" },
    },
  },
});

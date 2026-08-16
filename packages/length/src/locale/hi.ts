import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk`, `ar` and `ja` next door make, kept here for
 * only the second of their two reasons — and that reason is enough on its own.
 *
 * Hindi's own conversion words are the postpositions में, को and से
 * (`@smartput/core/locale/hi`), so `in` is *not* a keyword token in an engine
 * that speaks only Hindi, and the first half of the English argument does not
 * apply. The second half does, and it is locale-blind by construction:
 * `registry.aliasIndex` is one flat map that `MatchCtx.isUnitAlias` reads
 * without consulting a locale, so a Hindi entry for `in` would put the word back
 * in front of `@smartput/datetime`'s accept-gate — which refuses any phrase
 * whose words are *all* unit aliases — for any engine that also speaks English,
 * and make "in 3 days" an all-units phrase again.
 *
 * A Hindi reader types इंच, so the omission costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Hindi words for the length units — the same eight units `en` next door names,
 * and all eight have words: Hindi writes every one of them out.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi in
 * Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are a
 * second numbering system that `@smartput/core/locale/hi` reports as
 * unreachable; nothing a word list could do would change that.
 *
 * **Two `forms` keys, and on seven of the eight units they hold the same
 * string.** `hindi.selectForm` returns CLDR's `"one" | "other"` and nothing
 * else, with no case axis crossed with it — Hindi's unit nouns are
 * consonant-final masculine loanwords whose direct and oblique *singular* are
 * the same word, so an axis would double every table in the repo to record one
 * cell, and the oblique plural (मीटरों) is read by `hindi`'s suffix stripper
 * instead. Then the plural collapses too: a Hindi measure noun stays in the
 * direct singular after a numeral, so "पाँच मीटर" is five metres and "पाँच
 * मीटरें" is not Hindi at all. The numeral carries the count and the noun does
 * not repeat it.
 *
 * **फुट is the exception, and it is the reason this kind is worth reading.**
 * Hindi borrowed both members of English's suppletive pair and uses them as a
 * genuine singular and plural: एक फुट, but पाँच फीट, and "छह फीट लंबा" is how
 * anyone's height is written. That is not a suffix any stripper could produce
 * and not a rule any other unit here follows — it is one lexical pair, borrowed
 * whole. It is also the row that makes Hindi's plural *boundary* visible rather
 * than merely documented: `one` here is CLDR's `i = 0 or n = 1`, so 0 and 0.5
 * take फुट ("आधा फुट") while 1.5 takes फीट ("डेढ़ फीट"), and English — which
 * puts 0 in `other` — would have printed the plural for zero. `hi.test.ts` pins
 * all four of those counts on this unit, because on the other seven the two rows
 * agree and the boundary cannot be seen at all.
 *
 * **Symbols are the dotless Devanagari abbreviations.** Hindi prints them with
 * full stops — मि.मी., से.मी., कि.मी. — and a full stop is not a letter, so
 * `lex` would end the word token at the first dot and no alias could claim the
 * rest. The dotless spellings मिमी, सेमी, मी and किमी are themselves what a road
 * sign and a tape measure carry, and they are what the engine can read back, so
 * they are what R8's explicit symbol is here. इंच, फुट, गज़ and मील have no
 * Hindi abbreviation at all and take the spelled nominative singular, which is
 * the same choice `en` makes for units it writes out; R8 wants an explicit
 * symbol, not an invented one. `hindi.renderQuantity` sets a Devanagari symbol
 * off from the number with a space ("5 सेमी") and leaves a Latin one tight
 * ("5cm"), branching on the script of the symbol rather than on the language,
 * because this file mixes both registers.
 *
 * Every string this file *prints* is also a string it reads. That is a rule
 * about the penalised path rather than about coverage: `hindi`'s stripper would
 * recover a printed मीटरों at `weight: -2`, and a word the printer emits should
 * never come back through a guess.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a Hindi engine and the
 * micro path (`parseLength`) cannot drift from it.
 *
 * Like `en`, this file names `length` by id string and never imports the kind,
 * which is what lets `@smartput/length/locale/hi` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "length",
  units: {
    // मिलिमीटर with a short i is the spelling a phonetic keyboard produces and
    // मिलीमीटर with a long one is what a dictionary prints. They differ in a
    // matra rather than in an ending, so neither NFKC nor the suffix stripper
    // joins them; both are read and one is printed. The same pair recurs on
    // सेंटीमीटर below.
    mm: {
      aliases: [...alias("mm"), "मिलीमीटर", "मिलिमीटर", "मिमी"],
      symbol: "मिमी",
      forms: { one: "मिलीमीटर", other: "मिलीमीटर" },
    },
    // सेण्टीमीटर is the older orthography, with the conjunct ण्ट where modern
    // typesetting writes the anusvara — a spelling still in school textbooks and
    // still typed by people who learned from them.
    cm: {
      aliases: [...alias("cm"), "सेंटीमीटर", "सेंटिमीटर", "सेण्टीमीटर", "सेमी"],
      symbol: "सेमी",
      forms: { one: "सेंटीमीटर", other: "सेंटीमीटर" },
    },
    m: {
      aliases: [...alias("m"), "मीटर", "मी"],
      symbol: "मी",
      forms: { one: "मीटर", other: "मीटर" },
    },
    km: {
      aliases: [...alias("km"), "किलोमीटर", "किलोमिटर", "किमी"],
      symbol: "किमी",
      forms: { one: "किलोमीटर", other: "किलोमीटर" },
    },
    in: {
      aliases: [...alias("in"), "इंच"],
      symbol: "इंच",
      forms: { one: "इंच", other: "इंच" },
    },
    // The one genuinely inflecting row in the kind. फ़ुट/फ़ीट with the nukta mark
    // the /f/ of the loanword; most Hindi typing omits it and no normalization
    // will ever join the two spellings, so all four are read and the two
    // nukta-less ones are printed — which is what a Hindi newspaper prints.
    ft: {
      aliases: [...alias("ft"), "फुट", "फीट", "फ़ुट", "फ़ीट"],
      symbol: "फुट",
      forms: { one: "फुट", other: "फीट" },
    },
    // गज़ is the Persian loan, and its nukta is written here in the decomposed
    // form NFKC produces (ज + U+093C): ज़ is a Unicode composition *exclusion*,
    // so a precomposed U+095B would test green against this object and be
    // unreachable through `normalize()`. गज without the nukta is ordinary
    // Devanagari a great many people type, and is listed beside it.
    yd: {
      aliases: [...alias("yd"), "गज़", "गज"],
      symbol: "गज़",
      forms: { one: "गज़", other: "गज़" },
    },
    mi: {
      aliases: [...alias("mi"), "मील"],
      symbol: "मील",
      forms: { one: "मील", other: "मील" },
    },
  },
});

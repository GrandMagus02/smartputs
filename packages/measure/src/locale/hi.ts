import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Hindi words for the typographic units — the same six units `en` next door
 * names, and all six have words: Hindi writes every one of them out.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi in
 * Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are a
 * second numbering system that `@smartput/core/locale/hi` reports as
 * unreachable; nothing a word list could do would change that.
 *
 * **Two `forms` keys, and both hold the same word on every unit.**
 * `hindi.selectForm` returns CLDR's `"one" | "other"` and nothing else, with no
 * case axis crossed with it — the direct and oblique *singular* of a
 * consonant-final masculine loanword are the same word, so an axis would double
 * every table in the repo to record one cell, and the oblique plural (पिक्सेलों)
 * is read by `hindi`'s suffix stripper instead. Then the plural collapses too,
 * for a reason specific to counting: a Hindi measure noun stays in the direct
 * singular after a numeral. "बारह पॉइंट" is twelve points; "बारह पॉइंटें" is not
 * Hindi.
 *
 * **पाइका is the row worth arguing about, and it does not inflect.**
 * `@smartput/angle/locale/hi` prints फेरा/फेरे — a genuine singular and plural —
 * on the reasoning that a masculine ा-final *Hindi* noun takes -े in the direct
 * plural. पाइका ends in the same vowel and is the same gender and stays one
 * word, because ा-final *loanwords* are the unmarked class: Hindi inflects
 * कमरा → कमरे and leaves डेटा and पाइका alone, and a technical borrowing that
 * appears in a typesetting manual is as far from the nativised end of that scale
 * as a word gets. The rule is about how thoroughly a word has been absorbed, not
 * about how it ends, which is why these two files disagree and are both right.
 *
 * The plural boundary is still not English's, and that is worth stating even
 * where it cannot be seen: Hindi's `one` is CLDR's `i = 0 or n = 1`, so 0 and
 * 0.5 take `one` while 1.5 and 2 take `other`, where English puts 0 in `other`.
 * `hi.test.ts` asserts the key set against `selectForm` rather than against the
 * words, so a later unit that does inflect finds the contract already stated.
 *
 * **Symbols are Devanagari where Hindi abbreviates and spelled out where it does
 * not.** मिमी and सेमी are the dotless abbreviations a ruler carries — Hindi
 * prints them with full stops (मि.मी., से.मी.) and a full stop is not a letter,
 * so `lex` would end the word token at the first dot. इंच, पॉइंट, पाइका and
 * पिक्सेल have no Hindi abbreviation at all: the short forms in circulation are
 * the Latin `pt`, `pc` and `px`, which `units.ts` already registers as aliases
 * and which are therefore read here without being claimed as Hindi. Each takes
 * the spelled nominative singular instead, the same choice `en` makes for units
 * it writes out. R8 wants an explicit symbol on every unit, not an invented one.
 *
 * `hindi.renderQuantity` sets a Devanagari symbol off from the number with a
 * space ("12 पॉइंट") and leaves a Latin one tight ("12pt"), branching on the
 * script of the symbol rather than on the language, because this file mixes both
 * registers across its units.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "12 pt" keeps working in a Hindi engine and
 * the micro path (`parseMeasure`) cannot drift from it.
 *
 * A caller who wants these words in an engine has to ask for them by name.
 * `measure` is outside `BUILTIN_KINDS` — its `mm`/`cm` aliases collide with
 * `length`, and in Hindi its मिमी/सेमी collide with
 * `@smartput/length/locale/hi`'s in exactly the same way — so it is absent from
 * `@smartput/kinds/locale/hi` for the same reason the kind is absent from the
 * roster.
 *
 * Like `en`, this file names `measure` by id string and never imports the kind,
 * which is what lets `@smartput/measure/locale/hi` be imported without the ratio
 * table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "measure",
  units: {
    inch: {
      aliases: [...alias("inch"), "इंच"],
      symbol: "इंच",
      forms: { one: "इंच", other: "इंच" },
    },
    // मिलिमीटर with a short i is the spelling a phonetic keyboard produces and
    // मिलीमीटर with a long one is what a dictionary prints. They differ in a
    // matra rather than in an ending, so neither NFKC nor the suffix stripper
    // joins them; both are read and one is printed. The same pair recurs on
    // सेंटीमीटर below, and both entries match
    // `@smartput/length/locale/hi` word for word — the two kinds disagree about
    // the ratio's canonical, never about the noun.
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
    // प्वाइंट is the other transliteration of the English diphthong, both current
    // in print. बिंदु is the native Hindi word for a dot and is what a
    // Sanskritised typography glossary uses for the unit; it is read and not
    // printed, because outside such a glossary बिंदु is a dot rather than 1/72
    // of an inch and printing it would be answering a wider question than was
    // asked.
    pt: {
      aliases: [...alias("pt"), "पॉइंट", "प्वाइंट", "बिंदु"],
      symbol: "पॉइंट",
      forms: { one: "पॉइंट", other: "पॉइंट" },
    },
    pc: {
      aliases: [...alias("pc"), "पाइका"],
      symbol: "पाइका",
      forms: { one: "पाइका", other: "पाइका" },
    },
    // पिक्सल drops the schwa the fuller पिक्सेल writes out — the same word at two
    // speeds, and both are typed.
    px: {
      aliases: [...alias("px"), "पिक्सेल", "पिक्सल"],
      symbol: "पिक्सेल",
      forms: { one: "पिक्सेल", other: "पिक्सेल" },
    },
  },
});

import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Hindi words for the power units.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi
 * in Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are
 * a second numbering system this vocabulary cannot reach — a decision
 * `@smartput/core/locale/hi` documents and reports, not one a word list could
 * take.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind — that is what lets this file be imported without linking
 * the ratio table), `aliases` derived from `units.ts` rather than retyped, and
 * an explicit `symbol` on every unit (ruling R8).
 *
 * **Two `forms` keys, and on all five units they hold the same string.**
 * `hindi.selectForm` returns CLDR's `"one" | "other"` and nothing else, and both
 * rows carry one word here for two reasons stacked on each other: वाट and its
 * prefixed relatives are consonant-final masculine borrowings, whose direct
 * plural is spelled exactly like the singular, and a Hindi measure noun stays in
 * the direct singular after a numeral anyway ("पाँच किलोवाट", never "पाँच
 * किलोवाटें"). That is a full table, not a half-finished one.
 * `@smartput/duration/locale/hi` is where the rows genuinely differ — घंटा is
 * ā-final masculine and pluralises to घंटे — which is why this file states its
 * reason rather than assuming Hindi never marks a plural.
 *
 * The boundary is not English's: Hindi's `one` is CLDR's `i = 0 or n = 1`, so 0,
 * 0.5 and 1 all take `one` while 1.5 and 2 take `other`, where English puts 0 in
 * `other`. Invisible while the rows agree, and pinned in `hi.test.ts` anyway.
 *
 * **Symbols are the spelled singulars.** Hindi abbreviates these with full stops
 * (वा., कि.वा.) and a full stop is not a letter, so `lex` ends the word token at
 * the first dot and no alias could claim the rest — the same wall
 * `@smartput/mass/locale/hi` hits with कि.ग्रा., and here without that file's
 * escape hatch, because no dotless remnant of these is in circulation. R8 asks
 * for the abbreviation a language actually uses or else the spelled nominative
 * singular, never an invented one, so the nouns themselves ship. It costs
 * little: every unit here has `forms`, and a form outranks a symbol in the
 * renderer's label precedence, so these are what `Printer`'s `symbols: true`
 * mode emits rather than what `formatValue` does.
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "5 kw" keeps working in a Hindi engine and the micro path (`parsePower`)
 * cannot drift from it. `mw` is the megawatt here exactly as it is there — the
 * milliwatt has no spelling in this repo at all, for the case-folding reason
 * `units.ts` records, and no Hindi word could give it one.
 *
 * The kilowatt matters beyond this package: `@smartput/energy/locale/hi` prints
 * its watt-hour family as "किलोवाट·घंटा", where U+00B7 lexes as `*` and the
 * energy kind's `* | power | duration` signature multiplies the two operands
 * back into joules. That symbol only re-reads because किलोवाट is an alias here,
 * so the two files are wired together by this list rather than by an import.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "power",
  units: {
    w: {
      aliases: [...alias("w"), "वाट"],
      symbol: "वाट",
      forms: { one: "वाट", other: "वाट" },
    },
    kw: {
      aliases: [...alias("kw"), "किलोवाट"],
      symbol: "किलोवाट",
      forms: { one: "किलोवाट", other: "किलोवाट" },
    },
    mw: {
      aliases: [...alias("mw"), "मेगावाट"],
      symbol: "मेगावाट",
      forms: { one: "मेगावाट", other: "मेगावाट" },
    },
    // गीगा with a long ī is the dictionary spelling and गिगा with a short one is
    // what a phonetic keyboard produces. Neither NFKC nor `hindi`'s suffix
    // stripper joins them — they differ in a matra, not in an ending — so both
    // are listed and one is printed.
    gw: {
      aliases: [...alias("gw"), "गीगावाट", "गिगावाट"],
      symbol: "गीगावाट",
      forms: { one: "गीगावाट", other: "गीगावाट" },
    },
    // अश्वशक्ति is a real Hindi compound — अश्व "horse" + शक्ति "power" — and not
    // a transliteration, which makes it the only unit in this file whose Hindi
    // name is older than the borrowing. It is feminine and ī-final, so its
    // grammatical plural would be अश्वशक्तियाँ; that form is not listed, because
    // it is not a word anyone writes after a numeral and a vocabulary lists what
    // a reader is expected to type. The measure-noun rule outranks the gender
    // rule here as it does for `energy`'s कैलोरी.
    //
    // हॉर्सपावर is the borrowing an Indian car listing prints and एचपी the
    // initialism beside it; both are read and neither is printed, because the
    // Hindi compound is the written register and choosing a borrowing for output
    // would be this file editorialising. बीएचपी — brake horsepower — is
    // deliberately absent: it is a different measurement, not a second spelling
    // of this one.
    hp: {
      aliases: [...alias("hp"), "अश्वशक्ति", "हॉर्सपावर", "एचपी"],
      symbol: "अश्वशक्ति",
      forms: { one: "अश्वशक्ति", other: "अश्वशक्ति" },
    },
  },
});

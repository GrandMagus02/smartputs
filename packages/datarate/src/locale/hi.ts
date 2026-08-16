import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Hindi words for the datarate units.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi
 * in Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are
 * a second numbering system this vocabulary cannot reach — a decision
 * `@smartput/core/locale/hi` documents and reports, not one a word list could
 * take.
 *
 * The shape is `en.ts`'s, unit for unit: the same `kind` id string (never an
 * import of the kind — that is what lets this file be imported without linking
 * the ratio table, and `composeLocale` is where the two halves meet), `aliases`
 * derived from `units.ts` rather than retyped, and an explicit `symbol` on every
 * unit (ruling R8).
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and every
 * translation of it restates. Hindi writes a rate as "मेगाबिट प्रति सेकंड" —
 * three words, and `parse/lex.ts` ends a word token at the space, so the
 * spelled-out name arrives as three tokens and no single alias can claim it. It
 * is not the trap Arabic hits (there the middle word في is the `in` keyword, so
 * the phrase lexes as a *conversion*); प्रति is claimed by nothing and simply
 * arrives as a stray word the parser cannot use. Either way there is no single
 * Hindi token meaning "megabits per second" to put in a table, and a `forms`
 * table here would be two rows of prose no input could reach.
 *
 * **What Hindi has that Russian, Ukrainian and Arabic do not is a one-token
 * spelling of the rate itself**, and that is what the symbols are. एमबीपीएस is
 * the Latin initialism MBPS transliterated letter by letter into Devanagari, and
 * it is what an Indian broadband advertisement prints: "100 एमबीपीएस तक की
 * स्पीड". Every other non-Latin vocabulary in this package had to give the "per
 * second" up and ship the bare noun — "Мбит", "ميغابت", a *count of megabits*
 * standing in for a rate — because their scripts have no such transliteration in
 * circulation. Hindi does, it is one run of letters with no operator character
 * and no space in it, so it lexes as a single unit word and re-reads as the unit
 * that printed it. The elision every sibling file apologises for is not needed
 * here.
 *
 * The bare nouns are still listed, because recognition is many-to-one while
 * generation stays the one symbol: बिट, किलोबिट, मेगाबिट, गीगाबिट and टेराबिट
 * are what a Hindi technical article writes when the "प्रति सेकंड" is carried by
 * the sentence around it. They are read; only the initialism is printed.
 *
 * Unlike `@smartput/speed`'s Hindi file, the head noun costs nothing here. बिट is
 * not a length or a mass — no other kind in this repo claims it — so listing it
 * cannot give an input a second reading in the `@smartput/kinds` barrel the way
 * claiming मीटर for `kph` would.
 *
 * **Symbols print with a space.** `hindi.renderQuantity` branches on the script
 * of the symbol rather than on the language: a Devanagari abbreviation is set off
 * from the number ("100 एमबीपीएस"), a Latin one is not ("100mbps"), because a
 * real Hindi vocabulary mixes both registers across its units and this one is
 * Devanagari throughout.
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "5 mbps" keeps working in a Hindi engine and the micro path (`parseDatarate`)
 * cannot drift from it.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "datarate",
  units: {
    // बिट is the bit and बाइट is the byte — one matra apart in Devanagari and a
    // factor of eight apart in meaning. The byte spellings belong to
    // `@smartput/datasize` and deliberately appear nowhere here; the factor
    // between the two kinds is written out in `index.ts`'s bridge signatures,
    // not hidden in a word list.
    //
    // बिट्स is the English plural borrowed whole, which Hindi technical prose
    // writes as readily as the bare noun. It is read and never printed: a Hindi
    // measure noun after a numeral stays uninflected, so the plural is a
    // borrowing rather than a form this vocabulary would generate.
    bps: {
      aliases: [...alias("bps"), "बिट", "बिट्स", "बीपीएस"],
      symbol: "बीपीएस",
    },
    kbps: {
      aliases: [...alias("kbps"), "किलोबिट", "केबीपीएस"],
      symbol: "केबीपीएस",
    },
    mbps: {
      aliases: [...alias("mbps"), "मेगाबिट", "एमबीपीएस"],
      symbol: "एमबीपीएस",
    },
    // गीगा with a long ī is the dictionary spelling and गिगा with a short one is
    // what a phonetic keyboard produces. Neither NFKC nor `hindi`'s suffix
    // stripper joins them — they differ in a matra, not in an ending — so both
    // are listed and one is printed. The same pair `@smartput/mass/locale/hi`
    // lists for मिलीग्राम/मिलिग्राम.
    gbps: {
      aliases: [...alias("gbps"), "गीगाबिट", "गिगाबिट", "जीबीपीएस"],
      symbol: "जीबीपीएस",
    },
    tbps: {
      aliases: [...alias("tbps"), "टेराबिट", "टीबीपीएस"],
      symbol: "टीबीपीएस",
    },
  },
});

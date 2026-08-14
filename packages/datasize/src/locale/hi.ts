import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Hindi words for the datasize units.
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
 * **Two `forms` keys, and on every unit they hold the same string.**
 * `hindi.selectForm` returns CLDR's `"one" | "other"` and nothing else — no case
 * axis crossed with the plural the way `uk` and `ru` have one, because Hindi's
 * unit nouns are consonant-final masculine loanwords whose direct and oblique
 * *singular* are the same word. Then the plural collapses too, for a second
 * reason specific to counting: a Hindi measure noun stays in the direct singular
 * after a numeral. "पाँच मेगाबाइट", never "पाँच मेगाबाइटें" — the numeral carries
 * the count and the noun does not repeat it. So the two rows agree on all nine
 * units, and repeating the word is the correct table rather than a
 * half-finished one. (`duration`'s घंटा/घंटे is the counter-example in this
 * phase: a ā-final masculine noun *does* mark its plural, and there the two rows
 * are two words.)
 *
 * **What differs from English is the boundary, not the words.** Hindi's `one` is
 * CLDR's `i = 0 or n = 1`, so 0, 0.5 and 1 all take `one` while 1.5 and 2 take
 * `other` — English puts 0 in `other`. A table ported from `en` by translating
 * two strings in place reads correctly and prints the wrong row for zero, which
 * is invisible here only because the two rows agree; `hi.test.ts` pins the
 * boundary anyway, because the day a unit's rows stop agreeing is the day it
 * stops being invisible.
 *
 * **Symbols are the Devanagari initialisms, and they are not a transcription
 * exercise.** केबी, एमबी, जीबी and टीबी are how the Latin initialisms are
 * written in Hindi and they are everywhere — a mobile data pack is sold as "1.5
 * जीबी प्रतिदिन", not as "1.5 GB". They are one run of letters with no operator
 * character and no space, so each lexes as a single unit word, and each is
 * listed among its unit's aliases so a printed symbol reads back.
 *
 * The four binary units get no initialism, because Hindi has none for them:
 * किबी and मिबी are not written by anyone, and R8 asks for the abbreviation a
 * language actually uses or else the spelled nominative singular — never an
 * invented one. So किबिबाइट, मेबिबाइट, गिबिबाइट and टेबिबाइट carry their own
 * spelled names as symbols, the same second branch `@smartput/mass/locale/hi`
 * takes for औंस and पाउंड.
 *
 * `hindi.renderQuantity` sets a Devanagari symbol off from the number with a
 * space and leaves a Latin one tight, branching on the script of the symbol
 * rather than on the language. It rarely shows here: every unit has `forms`, and
 * a form outranks a symbol in the renderer's label precedence, so the symbols
 * are what `Printer`'s `symbols: true` mode emits rather than what `formatValue`
 * does.
 *
 * **The decimal and binary spellings must never fold together.** `kb` is 1000
 * bytes and `kib` is 1024, and किलोबाइट and किबिबाइट are as different in Hindi
 * as kilobyte and kibibyte are in English. They differ by more than an ending,
 * so no analyzer can join them; the risk is a translator listing one as an alias
 * of the other, which `assertLocaleContract` catches as a rival claim.
 *
 * The Latin aliases are **reused** through `aliasesFor` rather than retyped, so
 * "2 gb" keeps working in a Hindi engine and the micro path (`parseDatasize`)
 * cannot drift from it.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "datasize",
  units: {
    // बाइट is the byte and बिट is the bit — one matra apart in Devanagari and a
    // factor of eight apart in meaning. The bit spellings belong to
    // `@smartput/datarate` and appear nowhere here.
    //
    // बाइट्स is the English plural borrowed whole, which Hindi technical prose
    // writes as readily as the bare noun. Read, never printed: the measure-noun
    // rule above is what this vocabulary generates by.
    b: {
      aliases: [...alias("b"), "बाइट", "बाइट्स"],
      symbol: "बाइट",
      forms: { one: "बाइट", other: "बाइट" },
    },
    kb: {
      aliases: [...alias("kb"), "किलोबाइट", "केबी"],
      symbol: "केबी",
      forms: { one: "किलोबाइट", other: "किलोबाइट" },
    },
    mb: {
      aliases: [...alias("mb"), "मेगाबाइट", "एमबी"],
      symbol: "एमबी",
      forms: { one: "मेगाबाइट", other: "मेगाबाइट" },
    },
    // गीगा with a long ī is the dictionary spelling and गिगा with a short one is
    // what a phonetic keyboard produces. Neither NFKC nor `hindi`'s suffix
    // stripper joins them — they differ in a matra, not in an ending — so both
    // are listed and one is printed.
    gb: {
      aliases: [...alias("gb"), "गीगाबाइट", "गिगाबाइट", "जीबी"],
      symbol: "जीबी",
      forms: { one: "गीगाबाइट", other: "गीगाबाइट" },
    },
    tb: {
      aliases: [...alias("tb"), "टेराबाइट", "टीबी"],
      symbol: "टीबी",
      forms: { one: "टेराबाइट", other: "टेराबाइट" },
    },
    // The binary four. Their Hindi names are transliterations of the IEC ones
    // and nothing else — there is no indigenous Hindi word for a kibibyte, and
    // inventing one would put a spelling nobody writes into an index that any
    // engine consults. The transliterations are at least what a Hindi standards
    // document prints when it has to name them at all.
    kib: {
      aliases: [...alias("kib"), "किबिबाइट"],
      symbol: "किबिबाइट",
      forms: { one: "किबिबाइट", other: "किबिबाइट" },
    },
    mib: {
      aliases: [...alias("mib"), "मेबिबाइट"],
      symbol: "मेबिबाइट",
      forms: { one: "मेबिबाइट", other: "मेबिबाइट" },
    },
    gib: {
      aliases: [...alias("gib"), "गिबिबाइट"],
      symbol: "गिबिबाइट",
      forms: { one: "गिबिबाइट", other: "गिबिबाइट" },
    },
    tib: {
      aliases: [...alias("tib"), "टेबिबाइट"],
      symbol: "टेबिबाइट",
      forms: { one: "टेबिबाइट", other: "टेबिबाइट" },
    },
  },
});

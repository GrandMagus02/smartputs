import { aliasesFor, defineVocabulary } from "@smartput/core";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Hindi words for the mass units — the same six units `en` next door names, and
 * the same per-unit decision: all six are nouns a Hindi speaker writes out, so
 * all six carry `forms`.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi in
 * Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are a
 * second numbering system and this vocabulary does not reach them — that is a
 * decision `@smartput/core/locale/hi` documents and reports, not one a word list
 * could take.
 *
 * **Two `forms` keys, and on five of the six units they hold the same string.**
 * `hindi.selectForm` returns CLDR's `"one" | "other"` and nothing else: no case
 * axis crossed with the plural the way `uk` and `ru` have one, because Hindi's
 * unit nouns are consonant-final masculine loanwords whose direct and oblique
 * *singular* are the same word. Then the plural collapses too, for a second
 * reason that is specific to counting: a Hindi measure noun stays in the direct
 * singular after a numeral. "पाँच किलोग्राम", never "पाँच किलोग्रामें" — the
 * numeral carries the count and the noun does not repeat it. So `one` and
 * `other` are one word on मिलीग्राम, ग्राम, किलोग्राम, टन and पाउंड, and
 * repeating it is the correct table rather than a half-finished one.
 *
 * औंस is the one unit here that could have gone the other way and did not; see
 * its own note.
 *
 * **What differs from English is the boundary, not the words.**
 * Hindi's `one` is CLDR's `i = 0 or n = 1`, so 0, 0.5 and 1 all take `one` while
 * 1.5 and 2 take `other` — English puts 0 in `other`. A table ported from `en`
 * by translating two strings in place reads correctly and prints the wrong row
 * for zero, which is invisible here only because the two rows agree; the day a
 * unit's rows stop agreeing it stops being invisible. `hi.test.ts` pins the
 * boundary against this vocabulary rather than trusting the language's own test
 * to have covered it.
 *
 * **The oblique plural is read and never written.** "पच्चीस किलोग्रामों में" is
 * what a plural unit noun becomes in front of a postposition, and the
 * postposition is exactly where `hindi.keywords.in` (में/को/से) puts it. It is
 * not listed below: `hindi`'s analyzer chain strips ों at `weight: -2`, and the
 * point of the penalty is that an exactly listed alias outranks a stripped one.
 * The rule of thumb that governs the lists below is the other direction — every
 * string this file *prints* is also a string it reads, because a word the
 * printer emits should never come back through the penalised path.
 *
 * **Symbols are the dotless Devanagari abbreviations.** Hindi writes them with
 * full stops in print — कि.ग्रा., मि.ग्रा., ग्रा. — and a full stop is not a
 * letter, so `lex` would end the word token at the first dot and no alias could
 * claim the rest. The dotless spellings किग्रा, मिग्रा and ग्रा are themselves in
 * wide use (a shop sign, a nutrition label) and are what the engine can read
 * back, so they are what R8's explicit symbol is. औंस and पाउंड have no accepted
 * Hindi abbreviation at all and take the spelled nominative singular, which is
 * the same choice `en` makes for units it writes out; R8 wants an explicit
 * symbol, not an invented one. `hindi.renderQuantity` sets a Devanagari symbol
 * off from the number with a space ("500 मिग्रा") and leaves a Latin one tight
 * ("500mg"), branching on the script of the symbol rather than on the language,
 * because this file mixes both registers.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Hindi engine and the
 * micro path (`parseMass`) cannot drift from it.
 *
 * Like `en`, this file names `mass` by id string and never imports the kind,
 * which is what lets `@smartput/mass/locale/hi` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "mass",
  units: {
    // मिलिग्राम with a short i is the spelling a phonetic keyboard produces and
    // मिलीग्राम with a long one is the spelling a dictionary prints. Neither
    // normalization nor the suffix stripper joins them — they differ in a matra,
    // not an ending — so both are listed and one is printed.
    mg: {
      aliases: [...alias("mg"), "मिलीग्राम", "मिलिग्राम", "मिग्रा"],
      symbol: "मिग्रा",
      forms: { one: "मिलीग्राम", other: "मिलीग्राम" },
    },
    g: {
      aliases: [...alias("g"), "ग्राम", "ग्रा"],
      symbol: "ग्रा",
      forms: { one: "ग्राम", other: "ग्राम" },
    },
    // किलो is the colloquial clipping and is what a market in India actually
    // says; it is listed for the same reason `units.ts` lists "kilo". It is not
    // printed, because the clipping is speech and किलोग्राम is writing.
    kg: {
      aliases: [...alias("kg"), "किलोग्राम", "किलोग्रम", "किग्रा", "किलो"],
      symbol: "किग्रा",
      forms: { one: "किलोग्राम", other: "किलोग्राम" },
    },
    // मीट्रिक टन is the fuller name and is deliberately absent: `lex` ends a word
    // token at the space, so it arrives as two tokens and no single alias can
    // claim it. टन alone is unambiguous in Hindi — the long and short tons have
    // no Hindi names to be confused with.
    t: {
      aliases: [...alias("t"), "टन"],
      symbol: "टन",
      forms: { one: "टन", other: "टन" },
    },
    // The one unit here with a plural worth discussing. औंस is a feminine
    // consonant-final loanword, and feminine consonant-final nouns *do* mark the
    // direct plural (रात → रातें, and `hindi`'s stripper knows ें for exactly
    // that reason). But औंसें is not a form anyone writes after a numeral: the
    // measure-noun rule wins over the gender rule, and "पाँच औंस" is what a
    // recipe prints. So the two rows agree here as well, and औंसें is listed as
    // an alias — read, never written — so that a reader who does inflect it is
    // understood without the vocabulary claiming the form is idiomatic.
    //
    // आउंस is the alternate transliteration, closer to the English vowel.
    oz: {
      aliases: [...alias("oz"), "औंस", "औंसें", "आउंस"],
      symbol: "औंस",
      forms: { one: "औंस", other: "औंस" },
    },
    // पौंड and पाउंड are one word with two transliterations of the English
    // diphthong, both current in print, and there is no way to know which one a
    // writer reached for.
    lb: {
      aliases: [...alias("lb"), "पाउंड", "पौंड"],
      symbol: "पाउंड",
      forms: { one: "पाउंड", other: "पाउंड" },
    },
  },
});

import { aliasesFor, defineVocabulary } from "@smartput/core";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Hindi words for the volume units — the same five units `en` next door names,
 * and the same per-unit decision about whether a unit has words at all.
 *
 * `hi` is the bare tag and means what CLDR means by it: modern standard Hindi in
 * Devanagari, with the `latn` numbering system. Devanagari digits (१२३) are a
 * second numbering system that `@smartput/core/locale/hi` reports as
 * unreachable; nothing a word list could do would change that.
 *
 * **Two `forms` keys, and both hold the same word on all four units that have
 * words.** `hindi.selectForm` returns CLDR's `"one" | "other"` and nothing else,
 * with no case axis crossed with it — the direct and oblique *singular* of a
 * consonant-final masculine loanword are the same word, so an axis would double
 * every table in the repo to record one cell, and the oblique plural (लीटरों) is
 * read by `hindi`'s suffix stripper instead. Then the plural collapses too, for
 * a reason specific to counting: a Hindi measure noun stays in the direct
 * singular after a numeral. "पाँच लीटर" is five litres and "पाँच लीटरें" is not
 * Hindi. Every unit named here is a consonant-final masculine borrowing, which
 * is the shape that makes the direct singular and the direct plural one word, so
 * repeating it is the correct table rather than a half-finished one.
 *
 * The boundary is still not English's, and that is worth stating even where it
 * cannot be seen: Hindi's `one` is CLDR's `i = 0 or n = 1`, so 0 and 0.5 take
 * `one` while 1.5 and 2 take `other`, where English puts 0 in `other`. Half a
 * litre is the commonest volume anyone writes, so this is not a corner of the
 * rule — it is the ordinary case, and it is singular. `@smartput/angle` and
 * `@smartput/length` each have one unit where the two rows differ and the
 * boundary is visible; here `hi.test.ts` asserts the key set against
 * `selectForm` rather than against the words, so a later unit that does inflect
 * finds the contract already stated.
 *
 * **`m3` carries no `forms`, exactly as `en`, `uk` and `ar` carry none.** "घन
 * मीटर" is two words, `lex` ends a word token at the space, and the printer's
 * spelled path only ever emits something the parser can read back — so a form
 * here would hand completion text that fails to evaluate. The solid compound
 * घनमीटर *is* one token and is listed as an alias, because people write it that
 * way and the reader should accept it; it is not promoted to a form, because the
 * spaced spelling is the commoner one and a printer that emits the rarer
 * spelling to dodge a lexer limitation is choosing its words for the wrong
 * reason. It renders through मी³ instead, which `hindi.renderQuantity` sets off
 * from the number with a space ("3 मी³") because the stem is Devanagari; a Latin
 * symbol in the same position stays tight. Both the superscript and the
 * plain-digit spelling are listed, and both have to be: `normalize()` runs NFKC,
 * which folds ³ to a plain 3 before the lexer ever sees it, while
 * `assertLocaleContract` looks the *symbol* up in the alias index unfolded. One
 * spelling would fail one of the two paths.
 *
 * **Symbols are Devanagari where Hindi abbreviates and spelled out where it does
 * not.** ली and मिली are the dotless abbreviations a bottle and a syringe carry
 * — Hindi prints them with full stops (ली., मि.ली.) and a full stop is not a
 * letter, so `lex` would end the word token at the first dot. गैलन and पाइंट
 * have no Hindi abbreviation at all and take the spelled nominative singular,
 * the same choice `en` makes for `pint`. R8 wants an explicit symbol on every
 * unit, not an invented one.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Hindi engine and the
 * micro path (`parseVolume`) cannot drift from it.
 *
 * Like `en`, this file names `volume` by id string and never imports the kind,
 * which is what lets `@smartput/volume/locale/hi` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l"), "लीटर", "ली"],
      symbol: "ली",
      forms: { one: "लीटर", other: "लीटर" },
    },
    // मिलिलीटर with a short i is the spelling a phonetic keyboard produces and
    // मिलीलीटर with a long one is what a dictionary prints. They differ in a
    // matra rather than in an ending, so neither NFKC nor the suffix stripper
    // joins them; both are read and one is printed.
    ml: {
      aliases: [...alias("ml"), "मिलीलीटर", "मिलिलीटर", "मिली"],
      symbol: "मिली",
      forms: { one: "मिलीलीटर", other: "मिलीलीटर" },
    },
    m3: {
      aliases: [...alias("m3"), "मी3", "मी³", "घनमीटर"],
      symbol: "मी³",
    },
    gal: {
      aliases: [...alias("gal"), "गैलन"],
      symbol: "गैलन",
      forms: { one: "गैलन", other: "गैलन" },
    },
    // पिंट is the shorter transliteration, closer to the English vowel, and is
    // what a translated recipe is as likely to carry as पाइंट. Both are read and
    // the fuller one is written.
    pint: {
      aliases: [...alias("pint"), "पाइंट", "पिंट"],
      symbol: "पाइंट",
      forms: { one: "पाइंट", other: "पाइंट" },
    },
  },
});

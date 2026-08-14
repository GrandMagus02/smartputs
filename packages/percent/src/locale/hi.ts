import { aliasesFor, defineVocabulary } from "@smartput/core";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Hindi words for the percent unit — the same one unit `en` next door names, and
 * the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a Hindi engine and
 * the micro path (`parsePercent`) cannot drift from it. The Devanagari spellings
 * are appended on top.
 *
 * **Two words, from two layers of the language, and both are single tokens.**
 * प्रतिशत is the Sanskritic compound प्रति ("per") + शत ("hundred"), and it is
 * what a textbook, a newspaper headline and a government form all write.
 * फ़ीसदी is the Perso-Arabic word for the same thing (فیصدی), and it is at least
 * as common in speech and in the register a search box gets typed in. Neither is
 * a phrase: unlike Arabic's "في المئة" — where the "per" half is a separate word
 * and collides with that language's `in` keyword — Hindi writes both of these
 * closed up, so both are claimable as aliases and neither can be mistaken for a
 * conversion.
 *
 * **प्रति on its own is deliberately not claimed.** It is the productive
 * preposition "per" ("प्रति व्यक्ति", "प्रति किलो") and one of the commonest
 * words in the language; claiming it would make "20 प्रति" a percentage and,
 * worse, would put a bare preposition into the alias index of every composed
 * engine. The compound is the unit; the preposition is grammar.
 *
 * **The nukta is written decomposed, and this is the one orthographic trap in
 * the file.** फ़ (U+095E) is a Unicode composition *exclusion*: NFKC — which
 * `normalize()` applies before a word ever reaches the resolver — decomposes it
 * into फ + U+093C. An alias written with the precomposed character would test
 * green against the table and be unreachable through the engine, so फ़ीसदी is
 * written in the decomposed form here and `hi.test.ts` asserts every alias is
 * NFKC-stable. That handles the *encoding* of the nukta; it does not handle its
 * *absence*, which no normalization ever will, so the nukta-less फीसदी that a
 * great many keyboards produce is declared as its own alias beside it. This is
 * the same pairing `@smartput/core/locale/hi-cardinals.ts` makes for हज़ार and
 * हजार, for the same reason.
 *
 * **No `forms`, and the reason is `en`'s rather than a grammatical one.** The
 * written form of this unit is the symbol: "20 प्रतिशत" parses — that is what
 * the aliases are for — but rendering every percentage as a word would make
 * every result in every locale read as prose, and "20%" is already the string a
 * user types. Hindi adds a second reason that costs nothing to state: प्रतिशत is
 * a masculine consonant-final noun whose direct plural is the same word, so
 * `one` and `other` would hold one string twice. `hindi.selectForm`'s two
 * categories are still worth naming here, because its `one` is CLDR's `i = 0 or
 * n = 1` and therefore covers 0 and every fraction below 1 — a boundary English
 * does not have — and this kind is where a fractional count is commonest.
 * `hi.test.ts` pins the keys even though no table indexes them.
 *
 * `symbol` is explicit all the same (ruling R8), and one visible consequence of
 * `hindi.renderQuantity` shows up here: it branches on the *script of the
 * symbol*, spacing a Devanagari abbreviation off from the number ("5 किग्रा")
 * and closing up a Latin one. "%" is Latin, so a Hindi percentage prints "20%",
 * tight, exactly as English does — and unlike Arabic, which spaces every symbol
 * and prints "20 %". `hi.test.ts` pins the exact string so nobody has to guess
 * whether the space was intended to be there.
 *
 * का is what Hindi uses for `of` ("50 का 20%") and it is deliberately not a
 * keyword: it puts the base first and the percentage second, where this engine's
 * `of` wants them the other way round, and a keyword table cannot swap operands.
 * That is reported in `@smartput/core/locale/hi` rather than faked, and it is
 * why the percentage arithmetic pinned below is written with the operator nouns.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the
 * kind, which is what lets `@smartput/percent/locale/hi` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "percent",
  units: {
    "%": {
      aliases: [
        ...alias("%"),
        // The Sanskritic compound: प्रति ("per") + शत ("hundred"), written
        // closed up, which is what makes it claimable at all.
        "प्रतिशत",
        // The Perso-Arabic word for the same thing, nukta-bearing form first
        // (it is the correct spelling) and nukta-less second (it is what a
        // great many keyboards produce, and no normalization joins the two).
        "फ़ीसदी",
        "फीसदी",
      ],
      symbol: "%",
    },
  },
});

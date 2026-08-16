import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Japanese words for the power units.
 *
 * `ja` is the bare tag, modern standard Japanese in its ordinary mixed
 * orthography. The kind next door names no language at all — five ratios, five
 * unit ids, the magnitude bands `typical` records — and this file names `power`
 * by **id string** rather than importing it, so `@smartput/power/locale/ja`
 * links no ratio table. `composeLocale` is where the two halves meet.
 *
 * **No unit declares `forms`, and the two units at the ends of this table reach
 * that answer by opposite routes.**
 *
 * The watt family reaches it through ICU. Japanese is unspaced, so
 * `japanese.segment` hands every letter run to `Intl.Segmenter`, and its
 * Japanese dictionary breaks some katakana compounds and not others:
 *
 * ```
 * ワット     → ["ワット"]          キロワット → ["キロワット"]
 * メガワット → ["メガワット"]       ギガワット → ["ギガ", "ワット"]
 * ```
 *
 * 「1.5ギガワット」 would print and then reach the resolver as ギガ + ワット —
 * two tokens, of which the first is nobody's unit, and the second would read as
 * 1.5 *watts* if anything read it at all. The rule this repo's `ja`
 * vocabularies follow is by family rather than by unit: a family spells itself
 * out only when every member of it survives, and this one does not. So all four
 * print the SI symbol — "W", "kW", "MW", "GW" — which is what a Japanese
 * nameplate or grid report prints anyway, and the three readable katakana
 * spellings stay in `aliases`, where 「60ワット」 and 「500キロワット」 are
 * understood but never emitted. ギガワット is absent from `aliases` too: an
 * alias the lexer can never hand to the index is dead weight rather than
 * documentation, and `ja.test.ts` re-runs the measurement so that an ICU
 * dictionary which later learns the word surfaces as a failing test.
 *
 * `hp` reaches the same answer from the other side. Japanese says 「馬力」 —
 * literally horse-power, two kanji — and that string is at once the word, the
 * abbreviation and what a spec sheet prints; there is no longer form to spell
 * out and nothing to shorten. R8's `symbol` therefore carries both jobs, and a
 * `forms` table would be the same string written a second time, with the same
 * output, since `japanese.renderQuantity` puts no space between a number and its
 * label on any branch. 「150馬力」 is what comes out, tight, and 馬力 comes back
 * from the segmenter whole so it reads straight back in.
 *
 * That is the trade `uk.ts` had to argue itself into and Japanese gets for free:
 * Ukrainian's 「кінська сила」 is two inflected words that the lexer splits, so
 * that file had to abandon a beautiful `forms` table for the contraction "кс".
 * Japanese never had a phrase to lose. The Latin "hp" stays readable through
 * `aliasesFor`, and the German-derived "PS" is deliberately not listed — it is
 * common on Japanese car spec sheets, but it is two letters that fold to the
 * same key as nothing here and would be a coinage rather than a reading of what
 * `units.ts` already declares.
 *
 * **One form key, for the record.** `japanese.selectForm` returns the constant
 * `"other"` for every count and every slot — Japanese nouns do not inflect for
 * number, and `Intl.PluralRules("ja")` declares the single category `other` — so
 * a `ja` table for this kind would have been one row per unit rather than
 * English's two or Ukrainian's eight. It has none only because there is nothing
 * for the row to hold.
 *
 * **Aliases** reuse the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, which keeps the micro path (`parsePower`) and the
 * engine path agreeing by construction, and append the Japanese ones. Nobody
 * switches input mode to type a unit: 「60ワット」 and "60 w" are the same
 * sentence and a `ja` engine has to take both.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "power",
  units: {
    w: { aliases: [...alias("w"), "ワット"], symbol: "W" },
    kw: { aliases: [...alias("kw"), "キロワット"], symbol: "kW" },
    mw: { aliases: [...alias("mw"), "メガワット"], symbol: "MW" },
    gw: { aliases: alias("gw"), symbol: "GW" },
    hp: { aliases: [...alias("hp"), "馬力"], symbol: "馬力" },
  },
});

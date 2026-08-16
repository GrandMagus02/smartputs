import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Korean words for the power units.
 *
 * `ko` is the bare tag, modern standard Korean in South Korean orthography. The
 * kind next door names no language at all — five ratios, five unit ids, the
 * magnitude bands `typical` records — and this file names `power` by **id
 * string** rather than importing it, so `@smartput/power/locale/ko` links no
 * ratio table. `composeLocale` is where the two halves meet.
 *
 * **One form key.** `korean.selectForm` returns the constant `"other"` for every
 * count and every slot: Korean marks number nowhere on a noun — 일 와트 and 오
 * 와트 differ in the numeral and nowhere else — and CLDR agrees,
 * `Intl.PluralRules("ko")` declaring the single category `other`. A table
 * translated from `en.ts` needs no key renamed; it needs its `"one"` row
 * deleted.
 *
 * **The whole watt family spells itself out, and this is where Korean parts
 * company with `ja.ts` next door.** That file's watt family prints "W", "kW",
 * "MW", "GW" for one reason and one only: Japanese is unspaced, so `lex` hands
 * each letter run to `Intl.Segmenter`, and ICU's dictionary cuts ギガワット into
 * ギガ + ワット while returning the other three whole — and the family rule this
 * repo follows is that a family spells itself out only when every member of it
 * survives. Korean has been spaced since 1896, `korean.segment` is undefined,
 * and `lex` has already cut at every space, so 기가와트 arrives as one token
 * because a Korean writer wrote it as one word. Every member survives, no
 * dictionary can veto a row, and 「60와트 전구」 and 「1.5기가와트 원전」 are how
 * Korean writes these quantities in running text. So the family prints Hangul,
 * where its Japanese twin could not.
 *
 * The SI symbols are still recorded, because R8 wants every unit's written
 * abbreviation on the unit and because a Korean nameplate genuinely prints "kW".
 * They do not reach output — a `forms` entry outranks a `symbol` in
 * `renderQuantity` — and they stay readable through `aliasesFor`.
 *
 * **`hp` is the one unit whose word *is* its abbreviation.** Korean says 마력,
 * literally horse-power, and that string is at once the word, the shortening and
 * what a spec sheet prints; there is nothing longer to spell out and nothing to
 * shorten. So R8's `symbol` carries both jobs and no `forms` row is declared:
 * the row would hold the same string a second time, the output would be
 * identical either way (`korean.renderQuantity` puts nothing between a number
 * and its label on any branch), and a second place for one word to be edited
 * wrong is all it would add. 「150마력」 is what comes out.
 *
 * That is the trade `uk.ts` had to argue itself into and Korean, like Japanese,
 * gets for free: Ukrainian's 「кінська сила」 is two inflected words the lexer
 * splits, so that file had to abandon a `forms` table for the contraction "кс".
 * Korean never had a phrase to lose. The Latin "hp" stays readable through
 * `aliasesFor`, and the German-derived "PS" — which is common on Korean car spec
 * sheets — is deliberately not listed: it is a coinage over what `units.ts`
 * declares rather than a reading of it, the same call `ja.ts` makes.
 *
 * **Aliases** reuse the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, which keeps the micro path (`parsePower`) and the
 * engine path agreeing by construction, and append the Korean ones. Nobody
 * switches input mode to type a unit: 「60와트」 and "60 w" are the same
 * sentence and a `ko` engine has to take both.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "power",
  units: {
    w: { aliases: [...alias("w"), "와트"], symbol: "W", forms: { other: "와트" } },
    kw: {
      aliases: [...alias("kw"), "킬로와트"],
      symbol: "kW",
      forms: { other: "킬로와트" },
    },
    mw: {
      aliases: [...alias("mw"), "메가와트"],
      symbol: "MW",
      forms: { other: "메가와트" },
    },
    gw: {
      aliases: [...alias("gw"), "기가와트"],
      symbol: "GW",
      forms: { other: "기가와트" },
    },
    // The word and the abbreviation are one string, so `symbol` carries both and
    // a `forms` row would only be that string written twice.
    hp: { aliases: [...alias("hp"), "마력"], symbol: "마력" },
  },
});

import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Turkish words for the percent unit — and there are none to add, which is the
 * finding this file exists to record rather than a translation left half done.
 *
 * `@smartput/percent/locale/zh` is the only sibling in the same position, and
 * Turkish arrives there by the same road from the opposite side of Eurasia.
 * **The Turkish word for this unit is *yüzde*, and it stands in front of the
 * number: "yüzde 20", never "20 yüzde".** An alias in this engine is a label a
 * count is followed by — `lex` reads `<number> <word>` and the resolver looks the
 * word up — so a unit word that precedes its count has no seam to enter through,
 * exactly as Chinese 百分之 has none. Listing *yüzde* anyway would buy nothing
 * readable and would make one impossible word order the only one that parses.
 *
 * The word is worth spelling out because its shape *is* the argument: *yüzde* is
 * the **locative** of *yüz*, "hundred" — literally "in the hundred", the same
 * figure Latin *per centum* draws — so it is a case-marked numeral standing
 * before the count, not a noun standing after it. `@smartput/core/locale/tr`'s
 * suffix stripper would even take the `-de` back off and land on *yüz*, which is
 * a scale word in `CARDINALS` worth 100. That is the correct reading of the
 * morphology and the wrong reading of the input, and it is one more reason the
 * word is left where it is.
 *
 * **Two more Turkish words are declined, each for a reason of its own.** *Puan*
 * is the percentage **point** and is a different quantity: a rate moving from 2 %
 * to 3 % rises by one point and by fifty percent, so claiming it would answer a
 * question nobody asked. *Yüzdelik* is the name of the ratio — Turkish for
 * "percentage", the way English "percentage", Dutch *percentage* and Chinese
 * 百分比 are — and nobody writes "20 yüzdelik".
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a Turkish engine and
 * the micro path (`parsePercent`) cannot drift from it. `%` itself is what a
 * Turkish keyboard produces and what Turkish writing uses, so the generated half
 * is not merely a fallback here — it is the whole of what a user types.
 *
 * **The one thing this package cannot fix, stated rather than hidden: Turkish
 * writes the sign in front of the number.** "%20" is the standard Turkish
 * spelling — `Intl.NumberFormat("tr", { style: "percent" })` agrees — and this
 * engine prints "20 %", because `defaultRenderQuantity` puts the number first and
 * `turkish.renderQuantity` overrides only the *gap* (SI's space, the same change
 * German makes), not the order. A `Vocabulary` has no field that could move it;
 * the repair would be a `renderQuantity` in `@smartput/core/locale/tr` that
 * assembles `${symbol}${number}` for this kind, which is that file's decision and
 * not this one's. It was not taken there for a reason worth recording here: the
 * engine cannot **read** "%20" back — `lex` emits the "%" word token and then a
 * number, which is a label in front of a count and not a phrase this grammar has
 * — so printing it would give this kind an output it could not re-read, and
 * "20 %" is the round-trippable spelling. `tr.test.ts` pins both halves.
 *
 * **No `forms`, exactly as `en`, `uk`, `nl`, `zh` and `id` carry none, and for
 * `en`'s reason** — the written form of this unit is the symbol, and a `forms`
 * table would spell every percentage anywhere in the engine's output as a word.
 * Under `tr` the table being left out is **one row**, since `turkish.selectForm`
 * returns the constant `"other"` for every count and every slot: a counted
 * Turkish noun is bare, "1 kilogram" and "5 kilogram" alike. So this is among the
 * cheapest places in the repo a `forms` table could have been shipped, and there
 * is no Turkish word to put in the one cell anyway.
 *
 * `symbol` is explicit all the same (ruling R8), and Turkish sets it off from the
 * number by a space — "20 %" — which is `turkish.renderQuantity`'s doing and is
 * also TSE's typography, the same convention German follows.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the
 * kind, which is what lets `@smartput/percent/locale/tr` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "percent",
  units: {
    "%": { aliases: alias("%"), symbol: "%" },
  },
});

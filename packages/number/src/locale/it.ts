import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Italian words for the number "units" — and, as in `en`, `uk` and `es` next
 * door, there are none to add: a bare count is not a quantity of anything, in
 * any of the four languages.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the Italian table unchanged. It is not a
 * word an Italian reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7,25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction. Under `it` it
 * is live on the engine path the way it is under `es`, and unlike under `en`
 * where English's own cardinal parser eats the word "one" first; `it.test.ts`
 * pins that difference rather than leaving it to be rediscovered.
 *
 * **No Italian spelling is appended, and that is the decision this file makes.**
 * The candidates are "uno"/"un"/"una" and "unità", and they are refused for
 * reasons that are worth telling apart, because only one of the two is a
 * question about reachability:
 *
 *   - "uno", "un" and "una" are the cardinal *numeral* 1, and `italian.numerals`
 *     already claims all three — `it-cardinals.ts` declares them as three
 *     spellings of the same value, the apocopated "un" being the form Italian
 *     puts in front of a noun ("un metro", "un milione") and "una" its feminine.
 *     `foldNumerals` reads them as the value 1 before any alias index is
 *     consulted, exactly as Spanish's "uno" and Ukrainian's "один" are read. An
 *     entry here would be a word the engine can never reach, and
 *     `assertLocaleContract` would pass it happily, because an alias resolving
 *     back through the index is all it can check.
 *   - "unità" is a *reachable* word and is still refused, which makes it the
 *     lexical judgement rather than the mechanical one. Italian's welded-numeral
 *     parser must consume a whole token or claim nothing, and "unità" has no
 *     remainder it can read — `it-cardinals.ts` pins it among the nouns that
 *     survive `foldNumerals` untouched — so listing it here would work. It is
 *     left out because it is the mathematical unit, "l'unità" in a textbook, and
 *     not a thing anyone counts five of. Listing it would tell the next
 *     translator that "unit noun" is a category this kind has. It does not.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. `formatValue` returns
 * the bare number text on `NUMBER_KIND` before any symbol is read anyway.
 *
 * There are no `forms`. Italian would owe only the two rows
 * `italian.selectForm` can produce — `one` and `other`, the English shape, with
 * CLDR's `many` folded into `other` by the language itself — so the cost of
 * inventing a table here is two fabrications rather than Ukrainian's eight; the
 * argument against it is the same either way, and nothing reaches a `forms`
 * table on this kind in any case, since the printer short-circuits on
 * `NUMBER_KIND`.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "it",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

import { aliasesFor, defineVocabulary } from "@smartput/core";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * French words for the number "units" — and, as in `en`, `uk`, `es` and `it`
 * next door, there are none to add: a bare count is not a quantity of anything,
 * in any of the five languages.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the French table unchanged. It is not a
 * word a French reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7,25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction. Under `fr` it
 * is live on the engine path the way it is under `es` and `it`, and unlike under
 * `en` where English's own cardinal parser eats the word "one" first;
 * `fr.test.ts` pins that difference rather than leaving it to be rediscovered.
 *
 * **No French spelling is appended, and that is the decision this file makes.**
 * The candidates are "un"/"une" and "unité", and they are refused for reasons
 * worth telling apart, because only one of the two is a question about
 * reachability:
 *
 *   - "un" and "une" are the cardinal *numeral* 1, and `french.numerals` already
 *     claims both — `fr-cardinals.ts` declares them as the masculine and the
 *     feminine spelling of the same value, the feminine being what French puts
 *     in front of a feminine noun ("une tonne", "vingt et une minutes").
 *     `foldNumerals` reads them as the value 1 before any alias index is
 *     consulted, exactly as Italian's "uno"/"un"/"una" and Ukrainian's "один"
 *     are read. An entry here would be a word the engine can never reach, and
 *     `assertLocaleContract` would pass it happily, because an alias resolving
 *     back through the index is all it can check.
 *   - "unité" is a *reachable* word and is still refused, which makes it the
 *     lexical judgement rather than the mechanical one. French's numeral fold
 *     matches whole words against its four tables, and "unité" is in none of
 *     them, so listing it here would work. It is left out because it is the
 *     mathematical unit, "l'unité" in a textbook, and not a thing anyone counts
 *     five of. Listing it would tell the next translator that "unit noun" is a
 *     category this kind has. It does not.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. `formatValue` returns
 * the bare number text on `NUMBER_KIND` before any symbol is read anyway — which
 * is also why `french.renderQuantity`'s space before the label never appears on
 * this kind, where every other kind in the repo gains one.
 *
 * There are no `forms`. French would owe only the two rows `french.selectForm`
 * can produce — `one` and `other`, with CLDR's `many` folded into `other` by the
 * language itself — so the cost of inventing a table here is two fabrications
 * rather than Ukrainian's eight; the argument against it is the same either way,
 * and nothing reaches a `forms` table on this kind in any case, since the printer
 * short-circuits on `NUMBER_KIND`.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

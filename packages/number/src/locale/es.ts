import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Spanish words for the number "units" — and, as in `en` and `uk` next door,
 * there are none to add: a bare count is not a quantity of anything, in any of
 * the three languages.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the Spanish table unchanged. It is not a
 * word a Spanish reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7,25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction. Under `es`
 * it is live on the engine path the way it is under `uk`, and unlike under `en`
 * where English's own cardinal parser eats the word "one" first; `es.test.ts`
 * pins that difference rather than leaving it to be rediscovered.
 *
 * **No Spanish spelling is appended, and that is the decision this file makes.**
 * The candidate words are "uno"/"una" and "unidad", and both are refused for
 * reasons that differ:
 *
 *   - "uno"/"una"/"un" are the cardinal *numeral* 1, and `spanish.numerals`
 *     already claims all three through `CARDINALS` — "uno" reads as the value 1
 *     before any alias index is consulted, exactly as Ukrainian's "один" does.
 *     An entry here would be a word the engine never reaches, and
 *     `assertLocaleContract` would pass it happily, because an alias resolving
 *     back through the index is all it can check.
 *   - "unidad" is the mathematical unit — "la unidad" in a textbook — not a
 *     thing anyone counts five of. Listing it would tell the next translator
 *     that "unit noun" is a category this kind has. It does not.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. `formatValue` returns
 * the bare number text on `NUMBER_KIND` before any symbol is read anyway.
 *
 * There are no `forms`. Spanish would owe only the two rows `spanish.selectForm`
 * can produce — `one` and `other`, the English shape — so the cost of inventing
 * a table here is two fabrications rather than Ukrainian's eight; the argument
 * against it is the same either way, and nothing reaches a `forms` table on this
 * kind in any case, since the printer short-circuits on `NUMBER_KIND`.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "es",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

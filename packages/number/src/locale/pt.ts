import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Portuguese words for the number "units" — and, as in `en`, `uk`, `es` and `de`
 * next door, there are none to add: a bare count is not a quantity of anything,
 * in any of the five languages.
 *
 * **Brazilian, under the bare `pt` tag**, which is this project's ruling and also
 * what the platform does — `Intl.NumberFormat("pt")` resolves to the Brazilian
 * defaults, "." between the thousands and "," before the decimals. That matters
 * more here than in any other package in the phase: this kind's whole output *is*
 * the number, so the separators are the only thing a Portuguese engine changes
 * about it. `pt.test.ts` pins them, including the trap they set.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the Portuguese table unchanged. It is not
 * a word a Portuguese reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7,25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction. Under `pt` it
 * is live on the engine path the way it is under `uk`, `es` and `de`, and unlike
 * under `en` where English's own cardinal parser eats the word "one" first.
 *
 * There is a second reason it survives here that the other three did not have to
 * think about, and `pt.test.ts` measures it rather than assuming it: `pt`'s
 * analyzer chain is the widest in the project — a `suffixStripper` over
 * `["s","es"]` *and* a `pluralReplacer` over ten rewriting plural classes — and
 * "one" is untouched by every row of both. It ends in "e", which is not a plural
 * ending in Portuguese, so nothing folds it onto a different string.
 *
 * **No Portuguese spelling is appended, and that is the decision this file
 * makes.** The candidates are "um"/"uma" and "unidade", and both families are
 * refused for reasons that differ:
 *
 *   - "um" and "uma" are the cardinal *numeral* 1, and `portuguese.numerals`
 *     already claims both through `CARDINALS` (the feminine "uma" is a
 *     read-only variant there, declared after the masculine so the speller
 *     writes "um"). The numeral parser answers before any alias index is
 *     consulted, exactly as Ukrainian's "один", Spanish's "uno" and German's
 *     "eins" do, so an entry here would be a word the engine never reaches — and
 *     `assertLocaleContract` would pass it happily, because an alias resolving
 *     back through the index is all it can check.
 *   - "unidade" is the mathematical unit — "a unidade" in a textbook — not a
 *     thing anyone counts five of. Listing it would tell the next translator that
 *     "unit noun" is a category this kind has. It does not.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. `formatValue` returns
 * the bare number text on `NUMBER_KIND` before any symbol is read anyway, and
 * `portuguese` declares no `renderQuantity` override, so the default template is
 * what would have been reached.
 *
 * There are no `forms`. Portuguese would owe exactly the two rows
 * `portuguese.selectForm` can produce — `one` and `other`, the English shape,
 * since Portuguese nouns inflect for number and not for case — so the cost of
 * inventing a table here is two fabrications rather than Ukrainian's eight; the
 * argument against it is the same either way, and nothing reaches a `forms` table
 * on this kind in any case, since the printer short-circuits on `NUMBER_KIND`.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * German words for the number "units" — and, as in `en`, `uk` and `es` next
 * door, there are none to add: a bare count is not a quantity of anything, in
 * any of the four languages.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the German table unchanged. It is not a
 * word a German reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7,25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction. Under `de` it
 * is live on the engine path the way it is under `uk` and `es`, and unlike under
 * `en` where English's own cardinal parser eats the word "one" first;
 * `de.test.ts` pins that difference rather than leaving it to be rediscovered.
 *
 * **No German spelling is appended, and that is the decision this file makes.**
 * The candidates are "eins"/"ein"/"eine" and "Einheit", and both families are
 * refused for reasons that differ:
 *
 *   - "eins", "ein" and "eine" are the cardinal *numeral* 1, and
 *     `german.numerals` already claims all three — `de-cardinals.ts` puts "ein"
 *     in its `ones` table (the form that enters a compound: *einundzwanzig*,
 *     *einhundert*) and "eins"/"eine" in `standalone`. The numeral parser answers
 *     before any alias index is consulted, exactly as Ukrainian's "один" and
 *     Spanish's "uno" do, so an entry here would be a word the engine never
 *     reaches — and `assertLocaleContract` would pass it happily, because an
 *     alias resolving back through the index is all it can check.
 *   - "Einheit" is the mathematical unit — "die Einheit" in a textbook — not a
 *     thing anyone counts five of. Listing it would tell the next translator
 *     that "unit noun" is a category this kind has. It does not.
 *
 * There is a third German-only candidate and it is refused for a third reason:
 * `german.analyze` runs a `compoundSplitter`, so one might expect a head to be
 * declared here for the numbers people compound on. `COMPOUND_HEADS` in
 * `@smartput/core/locale/de` is morphology and lives in the language, not in a
 * vocabulary — and it lists no numeral, because a German numeral compound
 * (*zweitausend*) is decomposed by `de-cardinals.ts`'s own single-token parser
 * rather than by the alias index. Nothing about that reaches this file.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. That branch matters
 * more under German than under any language before it — `german.renderQuantity`
 * overrides the default to *space* a symbol off the number, per DIN 1301-1 — but
 * `formatValue` returns the bare number text on `NUMBER_KIND` before any symbol
 * is read, so the override never gets to put a space after a German count.
 * `de.test.ts` asserts that, because it is the one way this kind could have
 * acquired a stray byte from the new language.
 *
 * There are no `forms`. German would owe exactly the four keys
 * `german.selectForm` can produce — `nom-one`, `nom-other`, `dat-one`,
 * `dat-other` — so the cost of inventing a table here is four fabrications
 * rather than Ukrainian's eight; the argument against it is the same either way,
 * and nothing reaches a `forms` table on this kind in any case, since the
 * printer short-circuits on `NUMBER_KIND`.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "de",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

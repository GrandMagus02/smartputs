import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Dutch words for the number "units" — and, as in `en`, `uk`, `es` and `de` next
 * door, there are none to add: a bare count is not a quantity of anything, in
 * any of those languages or in this one.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the Dutch table unchanged. It is not a
 * word a Dutch reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7,25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction. Under `nl` it
 * is live on the engine path exactly as it is under `de`, `uk` and `es`, and
 * unlike under `en` where English's own cardinal parser eats the word "one"
 * first. Nothing in Dutch reaches it either: `dutch.analyze`'s suffix stripper
 * takes off `s`, `'s` and `n`, and "one" ends in none of the three, while
 * `compoundSplitter`'s `minPart: 3` leaves a three-letter word with no legal cut
 * at all. `nl.test.ts` pins that difference rather than leaving it to be
 * rediscovered.
 *
 * **No Dutch spelling is appended, and that is the decision this file makes.**
 * The candidates are "een"/"één" and "eenheid", and the two families are refused
 * for reasons that differ:
 *
 *   - "een" and "één" are the cardinal *numeral* 1, and `dutch.numerals` already
 *     claims both — `nl-cardinals.ts` puts plain "een" in its `ones` table (the
 *     form that enters a compound: *eenentwintig*, *eenhonderd*) and the accented
 *     "één" in `standalone`, because Dutch spells a bare 1 with the Taalunie
 *     accents to tell the numeral apart from the homographic indefinite article.
 *     The numeral parser answers before any alias index is consulted, exactly as
 *     German's "ein"/"eins" and Ukrainian's "один" do, so an entry here would be
 *     a word the engine never reaches — and `assertLocaleContract` would pass it
 *     happily, because an alias resolving back through the index is all it can
 *     check.
 *   - "eenheid" is the mathematical unit — "de eenheid" in a textbook — not a
 *     thing anyone counts five of. Listing it would tell the next translator that
 *     "unit noun" is a category this kind has. It does not.
 *
 * There is a third Dutch-only candidate and it is refused for a third reason:
 * `dutch.analyze` runs a `compoundSplitter`, so one might expect a head to be
 * declared here for the numbers people compound on — *tweeduizend* really is one
 * token. `COMPOUND_HEADS` in `@smartput/core/locale/nl` is morphology and lives
 * in the language, not in a vocabulary, and it lists no numeral, because a Dutch
 * numeral compound is decomposed by `nl-cardinals.ts`'s own single-token reader
 * rather than by the alias index. Nothing about that reaches this file.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. That branch matters
 * under Dutch for the same reason it matters under German — `dutch.renderQuantity`
 * overrides the default template to *space* a symbol off the number, following SI
 * — but `formatValue` returns the bare number text on `NUMBER_KIND` before any
 * symbol is read, so the override never gets to put a space after a Dutch count.
 * `nl.test.ts` asserts that, because it is the one way this kind could have
 * acquired a stray byte from the new language.
 *
 * There are no `forms`. Dutch would owe exactly the two keys `dutch.selectForm`
 * can produce — `one` and `other`, English's shape rather than German's four,
 * since modern Dutch has no case marking left on common nouns — so the cost of
 * inventing a table here is two fabrications rather than four. The argument
 * against it is the same either way, and nothing reaches a `forms` table on this
 * kind in any case, since the printer short-circuits on `NUMBER_KIND`.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

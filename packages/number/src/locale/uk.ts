import { aliasesFor, defineVocabulary } from "@smartput/core";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Ukrainian words for the number "units" — and the point of this file is that
 * there are none, for the same reason `en.ts` has none: a bare count is not a
 * quantity of anything, in either language.
 *
 * Every sibling row in this phase grew when it was translated: a unit noun like
 * "кілограм" needs a list of inflections on the way in and all eight of
 * `selectForm`'s `` `${case}-${category}` `` keys on the way out, because
 * Ukrainian wants case *and* number where English wanted only number. This row
 * did not grow by a single word, and that is the useful result — a second
 * grammatical axis costs nothing where there is nothing to inflect.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the Ukrainian table unchanged. It is not
 * a word a Ukrainian reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7,25one" — and strict `parseNumber` has to read that
 * back, in any locale, so the alias is locale-free by construction.
 *
 * **No Cyrillic spelling is appended, and that is deliberate.** Ukrainian has
 * no noun for a bare number to append one of: "один"/"одна"/"одне" are the
 * cardinal *numeral* 1, and `ukrainian.numerals` already claims all three
 * through `CARDINALS` — measured, not assumed, with them added to this table:
 * the numeral parser still wins every time ("один" reads as the value 1, "5
 * один" does not parse at all). So a Cyrillic entry here would be a word the
 * engine never reaches, and `assertLocaleContract` would pass it happily,
 * because an alias resolving back through the index is all it can check. The
 * cost of adding one is not a bug; it is telling the next translator that
 * "unit noun" is a category this kind has. It does not. "одиниця" is the
 * mathematical unit, not a thing you count 5 of.
 *
 * One real difference from `en` falls out of that, and `uk.test.ts` pins it
 * rather than papering over it: English's self-alias is inert on the engine
 * path only because English's *own* cardinal parser eats "one" first, so
 * `1one` reads as two adjacent numbers and throws. Nothing in Ukrainian claims
 * the Latin "one", so under this locale `1one` resolves through the alias and
 * evaluates to 1. That is the facade's round-trip string being readable, which
 * is what the alias exists for; `en.test.ts` asserts the throw, this file's
 * test asserts the parse, and both are the same alias doing its job.
 *
 * `symbol` is the empty string, deliberately and not by omission — R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. `formatValue` returns
 * the bare number text on `NUMBER_KIND` before any symbol is read anyway.
 *
 * There are no `forms`, which in Ukrainian is a stronger statement than it was
 * in English: a unit noun here would owe all eight of `selectForm`'s keys,
 * including the fractional genitive singular ("1,5 кілограма") and the locative
 * a conversion target lands on ("в грамах"). Inventing
 * "одиниця"/"одиниці"/"одиниць" to fill them would be eight fabrications
 * standing in for a word nobody writes. Nothing reaches a `forms` table on this
 * kind in any case: the printer short-circuits on `NUMBER_KIND`, so even the
 * `conversion-target` slot — the one row the old one-dimensional `display`
 * model could not express — prints no word at all here.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

import { aliasesFor, defineVocabulary } from "@smartput/core";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Russian words for the number "units" — and, exactly as in `en` and `uk`, there
 * are none, because a bare count is not a quantity of anything in any of the
 * three languages.
 *
 * Russian is `uk`'s structural twin: `russian.selectForm` keys on
 * `` `${case}-${category}` ``, so every sibling vocabulary in this phase owes
 * eight cells per unit where English owed two — the fractional genitive singular
 * ("1,5 килограмма") and the prepositional a conversion target lands on ("в
 * граммах") among them. This row owes none of them, and that is the useful
 * result rather than a gap: a second grammatical axis costs nothing where there
 * is nothing to inflect.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the Russian table unchanged. It is not a
 * word a Russian reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7,25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction.
 *
 * **No Cyrillic spelling is appended, and that is deliberate.** Russian has no
 * noun for a bare number to append one of. "один"/"одна"/"одно" are the cardinal
 * *numeral* 1, and `russian.numerals` already claims them through `CARDINALS`
 * (`ru-cardinals.ts` derives the parse table from the very tables
 * `russianSpeller` spells from), so a Cyrillic entry here would be a word the
 * engine never reaches: the numeral parser runs first and wins. "единица" is the
 * mathematical unit — the *digit* one, the thing on a die — not a thing you
 * count five of, and "штука" is a word for counting discrete objects that this
 * kind is precisely not about ("5 штук" says five *items*, and the kind holds no
 * item). Writing either one would tell the next translator that "unit noun" is a
 * category this kind has. It does not.
 *
 * `assertLocaleContract` would pass an invented word happily — an alias
 * resolving back through the index is all it can check — which is why the
 * absence is argued here and pinned in `ru.test.ts` rather than left to a
 * helper.
 *
 * `symbol` is the empty string, deliberately and not by omission — R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. `formatValue` returns
 * the bare number text on `NUMBER_KIND` before any symbol is read anyway.
 *
 * There are no `forms`, which in Russian is the stronger statement it is in
 * Ukrainian: a unit noun here would owe all eight of `selectForm`'s keys,
 * including the fractional genitive singular and the prepositional plural.
 * Filling them with cells of "единица" would be eight fabrications standing in
 * for a word nobody writes, and nothing reaches a `forms` table on this kind in
 * any case — the printer short-circuits on `NUMBER_KIND`, so even the
 * `conversion-target` slot prints no word at all here.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

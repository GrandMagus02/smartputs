import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Polish words for the number "units" — and, exactly as in `en`, `uk` and `ru`,
 * there are none, because a bare count is not a quantity of anything in any of
 * the four languages.
 *
 * Polish is the third two-axis language in this phase: `polish.selectForm` keys
 * on `` `${case}-${category}` `` and can produce eight keys, so every sibling
 * vocabulary owes eight cells per unit where English owed two — the fractional
 * genitive singular ("1,5 kilograma") and the locative plural a conversion
 * target lands on ("w gramach") among them. This row owes none of them, and that
 * is the useful result rather than a gap: a second grammatical axis costs
 * nothing where there is nothing to inflect.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the Polish table unchanged. It is not a
 * word a Polish reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7,25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction. Nothing in
 * Polish claims the English "one", so unlike under `en` — where the cardinal
 * parser eats the word before the alias index is consulted — the self-alias is
 * live here, which `pl.test.ts` pins.
 *
 * **No Polish spelling is appended, and that is deliberate.** Polish has no noun
 * for a bare number to append one of. "jeden"/"jedna"/"jedno" are the cardinal
 * *numeral* 1, and `polish.numerals` already claims all three through
 * `CARDINALS.ones` — `pl-cardinals.ts` derives its parse table from the very
 * tables `polishSpeller` spells from — so a Polish entry here would be a word
 * the engine never reaches: the numeral parser runs first and wins. The two
 * nouns a translator would reach for next are both about something else.
 * "jedynka" is the *figure* one — the glyph, the tram line, the top mark on a
 * Polish school report — and "jednostka" is the mathematical unit or a military
 * one, not a thing you count five of. Writing either would tell the next
 * translator that "unit noun" is a category this kind has. It does not.
 *
 * `assertLocaleContract` would pass an invented word happily — an alias
 * resolving back through the index is all it can check — which is why the
 * absence is argued here and pinned in `pl.test.ts` rather than left to a
 * helper.
 *
 * `symbol` is the empty string, deliberately and not by omission — R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. `formatValue` returns
 * the bare number text on `NUMBER_KIND` before any symbol is read anyway.
 *
 * There are no `forms`, which in Polish is the stronger statement it is in
 * Ukrainian and Russian: a unit noun here would owe all eight of `selectForm`'s
 * keys, and two of them hold words a plural-only model has no cell for at all —
 * `nom-other`, reached only by a fraction, and `loc-other`, reached only by a
 * count-free conversion target. Filling them with cells of "jednostka" would be
 * eight fabrications standing in for a word nobody writes, and nothing reaches a
 * `forms` table on this kind in any case: the printer short-circuits on
 * `NUMBER_KIND`, so even the `conversion-target` slot prints no word at all
 * here.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

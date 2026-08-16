import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Arabic words for the number "units" — and, exactly as in `en`, `uk` and `ru`,
 * there are none, because a bare count is not a quantity of anything in any of
 * the four languages.
 *
 * Arabic is the hardest language shipped here, and this row is the one place in
 * the whole phase where that costs nothing, so it is worth stating what it would
 * have cost. `arabic.selectForm` returns exactly the six CLDR categories on one
 * axis — `zero`, `one`, `two`, `few`, `many`, `other` — where English returns two
 * and Ukrainian eight. The `two` row is a **dual**, a suffixed form of the noun
 * meaning precisely two of the thing (كيلوغرام → كيلوغرامان), and no other
 * language in this repo has one at all; the `many` row is not a plural either but
 * an accusative *singular* with tanwīn (١١ كيلوغرامًا, the tamyīz). A unit noun
 * here would owe all six cells. This one owes none of them, and that is the
 * useful result rather than a gap: a six-category grammar costs nothing where
 * there is nothing to inflect.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays in the Arabic table unchanged. It is not a
 * word an Arabic reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7.25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction.
 *
 * **No Arabic spelling is appended, and that is deliberate.** Arabic has no noun
 * for a bare number to append one of. واحد/واحدة is the cardinal *numeral* 1, and
 * `arabic.numerals` already claims both through `CARDINALS` (`ar-cardinals.ts`
 * derives the parse table from the very tables `arabicSpeller` spells from), so
 * an Arabic entry here would be a word the engine never reaches: the numeral
 * parser runs first and wins. وحدة is the mathematical *unit* — the one on a
 * ruler, the one in "وحدة قياس" — not a thing you count five of, and عدد is
 * "number" the abstract noun, which is the name of this kind rather than a unit
 * of it. Writing either one would tell the next translator that "unit noun" is a
 * category this kind has. It does not.
 *
 * `assertLocaleContract` would pass an invented word happily — an alias resolving
 * back through the index is all it can check — which is why the absence is argued
 * here and pinned in `ar.test.ts` rather than left to a helper.
 *
 * **Digits.** `@smartput/core/locale/ar` pins `numberFormat: { group: ",",
 * decimal: "." }` — the `latn` numbering system, transcribed rather than read
 * from `Intl`, and the only such field in the repo. This kind is where that
 * decision is most visible, because this kind's whole output *is* the number:
 * "1.5" and "2,000" are what an Arabic engine prints. The reason is not a
 * disagreement with CLDR but that the engine can only *emit* Latin digits —
 * `Decimal.toFixed()` is ASCII, `parseNumber` tests `/^-?\d*\.?\d+$/` where `\d`
 * is ASCII even under `/u`, and `lex`'s `isDigit` is a `"0"…"9"` range check — so
 * `arab` separators would have produced the hybrid `1٬234٫5` and would not have
 * bought Arabic-Indic *input* either. `ar.test.ts` pins the resulting gap
 * directly: "٥" does not parse, in this kind least of all.
 *
 * **Right-to-left is not this file's problem.** A JavaScript string is in
 * *logical* order, and this kind prints digits and nothing else, so there is not
 * even a label for a well-meaning reader to want reversed. Nothing here is
 * reversed and nothing here should be.
 *
 * `symbol` is the empty string, deliberately and not by omission — R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is what `toLexeme` computed here. `formatValue` returns
 * the bare number text on `NUMBER_KIND` before any symbol is read anyway.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "ar",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

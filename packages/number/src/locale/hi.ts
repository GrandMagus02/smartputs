import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Hindi words for the number "units" — and, exactly as in `en`, `uk`, `ru` and
 * `ar`, there are none, because a bare count is not a quantity of anything in
 * any of those languages either.
 *
 * `hindi.selectForm` returns CLDR's two categories, `one` and `other`, so a unit
 * noun here would owe two cells rather than Arabic's six or Ukrainian's eight.
 * It owes neither, and the argument is the one every sibling file makes: Hindi
 * has no noun for a bare number to append. एक is the *numeral* 1 and
 * `hindi.numerals` already claims it through `CARDINALS` — the numeral fold runs
 * before the alias index is consulted, so an एक written here would be a word the
 * engine can never reach. इकाई is the mathematical *unit*, the one on a ruler,
 * not a thing five of which you count; संख्या is "number" the abstract noun,
 * which is the name of this kind rather than a unit of it. Writing either would
 * tell the next translator that "unit noun" is a category this kind has. It does
 * not.
 *
 * `alias("one")` derives to `["one"]` from `NUMBER_UNITS`, reused rather than
 * retyped, and it stays in the Hindi table unchanged. It is not a word a Hindi
 * reader types; it is machinery. `formatNumber` emits `` `${raw}${unit}` `` —
 * "7.25one" — and strict `parseNumber` has to read that back in any locale, so
 * the alias is locale-free by construction. Under `en` the cardinal parser
 * claims the word "one" before the index ever sees it and `1one` throws; nothing
 * in Hindi claims a Latin word, so here the self-alias is live, which is
 * `hi.test.ts`'s job to pin.
 *
 * **This is the kind where Hindi's grouping shows, because here the number *is*
 * the whole output.** `Intl.NumberFormat("hi")` uses the Indian system — the
 * first group from the right is three digits and every group after it is two, so
 * a lakh is 1,00,000 and a crore 1,00,00,000 — while `formatNumber` inserts the
 * separator with a fixed `/\B(?=(\d{3})+(?!\d))/g`. There is no field on
 * `NumberFormatSpec` that could say otherwise: it carries a `group` character
 * and a `decimal` character and no grouping *rule*, which is why
 * `@smartput/core/locale/hi` reports the gap rather than working around it. So
 * this kind prints "1,00,000" as "100,000", and `hi.test.ts` pins both strings
 * side by side.
 *
 * What survives untouched is the round trip, and it is worth separating from the
 * fidelity question: `parseNumber` strips *every* occurrence of the group
 * character wherever it falls and never counts digits between them, so the
 * reader is grouping-agnostic by construction and reads both "100,000" (what
 * this engine writes) and "1,00,000" (what a Hindi page writes) as the same
 * value. `hi.test.ts` asserts both.
 *
 * **Devanagari digits are unreadable, and this kind is where that costs most.**
 * "१२३" is a real way to write 123, but CLDR's default numbering system for the
 * bare `hi` tag is `latn`, NFKC does not fold १ onto 1, and `lex` decides
 * digit-ness with an ASCII range test while १ is `\p{Nd}` — so it is skipped as
 * an unrecognized character before `numerals` or `analyze` could see it. In a
 * kind whose entire value is the number, that leaves nothing to parse at all.
 * Closing it means a digit-folding pass in `normalize()`, which is core's and
 * not a word list's; do not "fix" it by putting digits in `aliases`.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit precisely so the renderer's no-symbol branch
 * stays unreachable, and `""` is the value `toLexeme` computed here.
 * `formatValue` returns the bare number text on `NUMBER_KIND` before any symbol
 * is read anyway.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "hi",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

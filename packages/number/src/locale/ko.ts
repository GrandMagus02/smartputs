import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Korean words for the number "units" — and, as in every sibling row of this
 * phase, the useful result is that there are none. What differs is the reason,
 * and Korean's is its own.
 *
 * `en` reached the conclusion because a bare count is not a quantity of
 * anything. `uk` reached it again after checking that a second grammatical axis
 * had nothing here to inflect. `ja` reached it a third way, through the counter.
 * Korean reaches it a fourth, and the fourth is the sharpest of the four because
 * the language keeps **two complete sets of numbers** and neither of them
 * belongs to a bare count:
 *
 *   - The **native** set (하나, 둘, 셋, 넷 …) is the counting set, and it is
 *     never used alone with a noun-shaped unit. It takes a *counter* — 개 for
 *     objects, 명 for people, 마리 for animals, 시 for the hour — and which
 *     counter is right depends on what is being counted, not on the number. A
 *     bare count has no noun behind it, so no counter belongs to it, and picking
 *     the commonest (개) would assert that every count in this engine is a count
 *     of discrete objects. This is `ja`'s argument, and it holds in Korean for
 *     the identical reason.
 *   - The **Sino-Korean** set (일, 이, 삼 …) is the one measurement units take —
 *     오 킬로그램, 십 미터 — and it is what `koreanNumerals` reads. But it is a
 *     numeral, not a noun: there is no Sino-Korean word meaning "one unit of
 *     nothing in particular" for this table to hold. 수 and 숫자 are the abstract
 *     nouns for "number" and are not things anybody counts five of, exactly as
 *     Ukrainian's "одиниця" and German's "Einheit" are not.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays here untranslated. It is not a word a Korean
 * reader types; it is machinery. `formatNumber` emits `` `${raw}${unit}` `` —
 * "7.25one" — and strict `parseNumber` has to read that back in any locale, so
 * the alias is locale-free by construction. It is also *live* under `ko` where it
 * is dead under `en`: English's cardinal parser claims the word "one" before the
 * alias index is consulted, and `koreanNumerals` reads Hangul syllables only, so
 * nothing in this language shadows it.
 *
 * **No Hangul numeral is listed as an alias, and that is a measurement rather
 * than a preference.** 일 is claimed by `korean.numerals` before any index is
 * consulted, in exactly the way `ukrainian.numerals` claims "один" and
 * `japanese.numerals` claims 一: an entry here would be a word the engine can
 * never reach, and `assertLocaleContract` would pass it happily, because an
 * alias resolving back through the index is all it can check. 영 is the same
 * case at the other end of the table.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is the value `toLexeme` computed here. It matters a
 * little more under `ko` than under `en`, for `ja`'s reason: `korean.renderQuantity`
 * closes the gap on *every* branch, so a symbol that went missing would degrade to
 * the bare unit key and print "7.25one" rather than move a space.
 *
 * There are no `forms`. Under `ko` that is a one-row table being left out rather
 * than eight — `korean.selectForm` returns the constant `"other"` for every count
 * and every slot, because a Korean noun does not mark number at all — and the row
 * would still be a fabrication: nothing renders a word for this unit, since
 * `formatValue` returns the bare number text on `NUMBER_KIND` before any word or
 * symbol is read.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

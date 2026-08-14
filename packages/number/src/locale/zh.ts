import { aliasesFor, defineVocabulary } from "@smartput/core";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Chinese words for the number "units" — and, as in every sibling row of this
 * phase, the interesting result is that there are none.
 *
 * `zh` is the bare tag and means what CLDR means by it: Simplified Chinese,
 * mainland conventions — the same reading `core/locale/zh.ts` takes, and the
 * reason there is no `zh-Hans.ts` beside this file.
 *
 * `en` reached the no-words conclusion because a bare count is not a quantity of
 * anything; `uk` reached it again after checking that a second grammatical axis
 * had nothing here to inflect; `ja` reached it a third way, through the counter
 * that a bare number has no noun to choose. Chinese reaches it the same way
 * Japanese does and one step earlier, because the *measure word* (量词) is the
 * construction Japanese borrowed: 五个, 五张, 五本, 五头 all say "five", and which
 * one is correct depends on what is being counted rather than on the number. A
 * number with no noun behind it has no measure word to take, and picking 个 —
 * the general one — would assert that every bare count in this engine counts
 * discrete objects. 数 and 数字 are the abstract nouns for "number" and "digit",
 * which is what English "number" and Ukrainian "одиниця" are, and nobody counts
 * five of those either.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays here untranslated. It is not a word a Chinese
 * reader types; it is machinery. `formatNumber` emits `` `${raw}${unit}` `` —
 * "7.25one" — and strict `parseNumber` has to read that back in any locale, so
 * the alias is locale-free by construction. It is also *live* under `zh` where it
 * is dead under `en`: English's cardinal parser claims the word "one" before the
 * alias index is consulted, while `chineseNumerals` reads Han characters only, so
 * nothing in this language shadows it. `chinese.segment` leaves the run whole for
 * the same reason it leaves "kilograms" whole — `scriptSegmenter` returns a run
 * with no Han in it untouched — so "1one" reaches the resolver as one word.
 *
 * **No Han numeral is listed as an alias, and that is a measurement rather than a
 * preference.** 一 is claimed by `chinese.numerals` before any index is consulted,
 * exactly as `japaneseNumerals` claims 一 and `ukrainian.numerals` claims "один":
 * an entry here would be a word the engine can never reach, and
 * `assertLocaleContract` would pass it happily, because an alias resolving back
 * through the index is all it can check. 两 is the sharper version of the same
 * fact — the counting two, the one that stands in front of a measure word — and
 * `zh-cardinals.ts` records the trade it cost (the tael) when it declared it.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is the value `toLexeme` computed here. It matters a
 * little more under `zh` than under `en`, for the reason it matters under `ja`:
 * `chinese.renderQuantity` closes the gap on *every* branch, so a symbol that
 * went missing would degrade to the bare unit key and print "7.25one" rather than
 * move a space.
 *
 * There are no `forms`. Under `zh` that is a one-row table being left out rather
 * than eight — `chinese.selectForm` returns the constant `"other"` for every count
 * and every slot, because Chinese marks number nowhere on a noun — and the row
 * would still be a fabrication: nothing renders a word for this unit, since
 * `formatValue` returns the bare number text on `NUMBER_KIND` before any word or
 * symbol is read.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { NUMBER_UNITS, type NumberUnit } from "../units";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

/**
 * Japanese words for the number "units" — and, as in every sibling row of this
 * phase, the interesting result is that there are none.
 *
 * `en` reached that conclusion because a bare count is not a quantity of
 * anything; `uk` reached it again after checking that a second grammatical axis
 * had nothing here to inflect. Japanese reaches it a third way, and the reason
 * is the one thing this language has that neither of the others does: a
 * **counter**. Japanese never says "5 of the unit one" — it says 五つ, 五個,
 * 五人, 五本, and which of those is correct depends on *what is being counted*,
 * not on the number. A counter is bound to the noun, so there is no counter that
 * belongs to "a number with no noun behind it", and picking one (個 is the
 * commonest) would be asserting that every bare count in this engine is a count
 * of small round objects. 数 ("number") is the abstract noun for the concept and
 * not a thing anyone counts five of, exactly as Ukrainian's "одиниця" and
 * German's "Einheit" are not.
 *
 * `alias("one")` is the Latin self-alias derived from `NUMBER_UNITS`, reused
 * rather than retyped, and it stays here untranslated. It is not a word a
 * Japanese reader types; it is machinery. `formatNumber` emits
 * `` `${raw}${unit}` `` — "7.25one" — and strict `parseNumber` has to read that
 * back in any locale, so the alias is locale-free by construction. It is also
 * *live* under `ja` where it is dead under `en`: English's cardinal parser
 * claims the word "one" before the alias index is consulted, and
 * `japaneseNumerals` reads kanji characters only, so nothing in this language
 * shadows it. `japanese.segment` leaves the run whole for the same reason it
 * leaves "kilograms" whole — a run with no Han, Hiragana or Katakana in it is
 * returned unbroken — so "1one" reaches the resolver as one word.
 *
 * **No kanji numeral is listed as an alias, and that is a measurement rather
 * than a preference.** 一 is claimed by `japanese.numerals` before any index is
 * consulted, in exactly the way `ukrainian.numerals` claims "один": an entry
 * here would be a word the engine can never reach, and `assertLocaleContract`
 * would pass it happily, because an alias resolving back through the index is
 * all it can check.
 *
 * `symbol` is the empty string, deliberately and not by omission: R8 wants an
 * explicit symbol on every unit so the renderer's no-symbol branch stays
 * unreachable, and `""` is the value `toLexeme` computed here. It matters a
 * little more under `ja` than elsewhere, because `japanese.renderQuantity`
 * closes the gap on *every* branch — a symbol that went missing would degrade to
 * the bare unit key and print "7.25one" rather than moving a space.
 *
 * There are no `forms`. Under `ja` that is a one-row table being left out rather
 * than eight — `japanese.selectForm` returns the constant `"other"` for every
 * count and every slot — and the row would still be a fabrication: nothing
 * renders a word for this unit, since `formatValue` returns the bare number text
 * on `NUMBER_KIND` before any word or symbol is read.
 *
 * The kind next door names no language at all — it is a ratio of 1 and an id.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "number",
  units: {
    one: { aliases: alias("one"), symbol: "" },
  },
});

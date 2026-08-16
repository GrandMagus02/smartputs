import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Korean words for the speed units.
 *
 * `ko` is the bare tag, modern standard Korean in South Korean orthography.
 * Shaped exactly like `en.ts` next door, down to naming `speed` by **id string**
 * rather than importing the kind — that is what lets this file be imported
 * without linking the ratio table, and `composeLocale` is where the two halves
 * meet, at the integrator's own wiring.
 *
 * **One form key.** `korean.selectForm` returns the constant `"other"` for every
 * count and every slot: Korean marks number nowhere on a noun, and CLDR agrees
 * (`Intl.PluralRules("ko")` declares the single category `other`). 「20노트」
 * covers 1, 20 and 1.5 alike, where English needs "knot" beside "knots" and
 * Ukrainian needs four nominative rows and four locative ones.
 *
 * **Three of the four units keep the decision `en.ts` made, and Korean has three
 * separate reasons for it — none of which is the segmenter.** This is the file
 * where that matters most, because `ja.ts` beside it reaches the same table by
 * an ICU measurement that simply does not apply here: Korean is spaced,
 * `korean.segment` is undefined, and `lex` has already cut at every space, so no
 * dictionary is consulted and none can veto a row. What rules these three out is
 * Korean itself.
 *
 * 1. **The written-out form is a phrase.** 「미터 매 초」 and 「킬로미터 매 시」
 *    are three words with spaces in them, and a unit word is one token — the
 *    same refusal `en.ts` records for "metres per second".
 * 2. **The idiomatic form is a prefix, on the wrong side of the number.** What a
 *    Korean actually says for a road speed is 「시속 100킬로미터」 — "hourly-speed
 *    100 km" — and 초속 is its per-second twin. Both arrive *before* the number,
 *    where a unit label can never be read, since `lex` binds a unit word to the
 *    number on its left. A vocabulary entry cannot move a word to the other side
 *    of its own quantity. This is exactly the trap 「時速」 sets in Japanese, and
 *    it is worth recording rather than leaving as an apparent omission.
 * 3. **The slash-free heads belong to another kind.** 미터, 킬로미터 and 마일 are
 *    `@smartput/length`'s words. The alias index is one flat map with no kind in
 *    the key, so claiming 킬로미터 here would give 「5킬로미터」 two readings in
 *    any engine that installs both kinds — which is exactly what the
 *    `@smartput/kinds` barrel does. So these three units carry **no Korean alias
 *    at all**, where every other `ko` vocabulary in this repo adds several. What
 *    Korean gets instead is the kind's own bridge: 「100 km / 시간」 divides a
 *    length by a duration and lands in `speed` through the `ops` signature in
 *    `index.ts`, which is how the compound is actually computed.
 *
 * **The symbols are the ones Korea writes, slashes and all.** 「m/s」 and
 * 「km/h」 are what a Korean physics textbook and a Korean speedometer print;
 * "kph" is not Korean, and inventing a slash-free spelling to make the round trip
 * easy would put a string nobody writes into the vocabulary. The slash is an
 * operator to `lex`, so these symbols re-read as arithmetic rather than by lookup
 * — 「100km/h」 is a length over a duration, which `speed.ops` answers — the same
 * route English's own "m/s" has always taken. `assertLocaleContract` knows to
 * leave an operator-bearing symbol to an evaluation test rather than to the alias
 * index, and `ko.test.ts` is that test.
 *
 * **`knot` is the exception here as it is in English**, and for the same reason:
 * one word, so the lexer takes it whole and it can be printed as well as read.
 * 노트 is what a Korean marine or aviation report writes, and 「20노트」 comes out
 * tight against the number because `korean.renderQuantity` closes the gap on
 * every branch. It shares its spelling with the loanword for a notebook, which is
 * harmless in both directions: 노트 the notebook is counted with 권, never bare
 * after a number, so 「20노트」 is unambiguous exactly where a printer puts it.
 * The symbol stays the international "kt", which Korean charts use; it never
 * reaches output, because a form outranks a symbol in `renderQuantity`, and it is
 * recorded because R8 wants every unit's written abbreviation on the unit.
 *
 * The Latin aliases are reused from `units.ts` rather than retyped, the same as
 * `en.ts` does, which keeps the micro path (`parseSpeed`) and the engine path
 * agreeing by construction.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      aliases: [...alias("knot"), "노트"],
      symbol: "kt",
      forms: { other: "노트" },
    },
  },
});

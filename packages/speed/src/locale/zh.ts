import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Chinese words for the speed units.
 *
 * `zh` is the bare tag and means what CLDR means by it — Simplified Chinese,
 * mainland conventions. Shaped exactly like `en.ts` next door, down to naming
 * `speed` by **id string** rather than importing the kind — that is what lets
 * this file be imported without linking the ratio table, and `composeLocale` is
 * where the two halves meet, at the integrator's own wiring.
 *
 * **One form key.** `chinese.selectForm` returns the constant `"other"` for every
 * count and every slot: Chinese marks number nowhere on a noun — 一节 and 二十节
 * differ in the numeral and nowhere else — and CLDR agrees
 * (`Intl.PluralRules("zh")` declares the single category `other`). A one-row
 * `forms` table is the correct and finished answer for this language, not a stub
 * anyone should come back and fill in.
 *
 * **Three of the four units keep the decision `en.ts` made, and Chinese has four
 * separate reasons for it.**
 *
 * The first is `en.ts`'s own: a speed is a compound. Chinese writes it 米每秒 and
 * 公里每小时, where 每 ("per") joins two nouns that a `forms` table would have to
 * print inside one unit token; a unit word is a run of letters plus trailing
 * digits (`parse/lex.ts`), so it cannot be.
 *
 * The second is measured. Chinese is unspaced, so `chinese.segment` hands every
 * letter run to `Intl.Segmenter`, and ICU cuts each compound at exactly the join:
 * 米每秒 → 米 | 每秒, 公里每小时 → 公里 | 每 | 小时, 英里每小时 → 英里 | 每 |
 * 小时. The compound could not survive a round trip even if the lexer took a
 * multi-word unit.
 *
 * The third is the one `uk.ts` discovered and it is why these three units carry
 * **no Chinese alias at all**, where every other `zh` vocabulary in this repo
 * adds at least one. The 每-free heads a reader would otherwise reach for — 米,
 * 公里, 千米, 英里 — are already `@smartput/length`'s words. The alias index is
 * one flat map with no kind in the key, so claiming 公里 here would give 「5公里」
 * two readings in any engine that installs both kinds, which is exactly what the
 * `@smartput/kinds` barrel does. What Chinese gets instead is the kind's own
 * bridge: 「100 km / 小时」 divides a length by a duration and lands in `speed`
 * through the `ops` signature in `index.ts`, which is how the compound is
 * actually computed.
 *
 * 时速 is left out for a fourth reason, particular to Chinese word order and
 * worth recording because it looks like an omission. It is the ordinary way to
 * say a road speed — 「时速100公里」, "hourly-speed 100 km" — it survives the
 * segmenter whole, and it is still unusable, because it is a *prefix*: it arrives
 * before the number, where a unit label can never be read, since `lex` binds a
 * unit word to the number on its left. A vocabulary entry cannot move a word to
 * the other side of its own quantity. Japanese 「時速」 is the identical
 * construction and `ja.ts` records the identical refusal.
 *
 * 码 is refused for a different reason and it is the sharpest trap in this file.
 * Mainland driving slang says 「开到80码」 for eighty *kilometres* per hour — but
 * 码 is the yard (`@smartput/length` again), the code, the stack of things, and a
 * measure word besides. A slang reading of one of the commonest characters in
 * technical Chinese, which also happens to be a real unit of a different kind, is
 * the worst possible alias.
 *
 * **The symbols are the ones China writes, slashes and all.** 「m/s」 and 「km/h」
 * are what a Chinese physics textbook and a Chinese speedometer print; "kph" is
 * not Chinese at all, and inventing a slash-free spelling to make the round trip
 * easy would put a string nobody writes into the vocabulary. The slash is an
 * operator to `lex`, so these symbols re-read as arithmetic rather than by lookup
 * — 「100km/h」 is a length over a duration, which `speed.ops` answers — the same
 * route English's own "m/s" has always taken. `assertLocaleContract` knows to
 * leave an operator-bearing symbol to an evaluation test rather than to the alias
 * index, and `zh.test.ts` is that test.
 *
 * **`knot` is the exception here as it is in English**, and for the same reason:
 * one word, so it survives both the lexer and ICU (节 → ["节"]), so it declares a
 * form. One form and not two — 「20节」 covers 1, 20 and 1.5 alike, where English
 * needs "knot" beside "knots" and Ukrainian needs four nominative rows and four
 * locative ones. 节 is one character and carries a dozen other senses in general
 * Chinese (a joint, a festival, a section), and it is claimed anyway: standing
 * immediately after a number, which is the only position `lex` will read it in,
 * it is the marine knot, and Chinese naval and shipping writing uses nothing else.
 * The symbol stays the international "kt", which Chinese aviation and marine
 * charts use; it never reaches output, because a form outranks a symbol in
 * `renderQuantity`, and it is recorded because R8 wants every unit's written
 * abbreviation on the unit.
 *
 * The Latin aliases are reused from `units.ts` rather than retyped, the same as
 * `en.ts` does, which keeps the micro path (`parseSpeed`) and the engine path
 * agreeing by construction.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      aliases: [...alias("knot"), "节"],
      symbol: "kt",
      forms: { other: "节" },
    },
  },
});

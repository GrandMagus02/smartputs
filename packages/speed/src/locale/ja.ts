import { aliasesFor, defineVocabulary } from "@smartput/core";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Japanese words for the speed units.
 *
 * `ja` is the bare tag, modern standard Japanese in its ordinary mixed
 * orthography. Shaped exactly like `en.ts` next door, down to naming `speed` by
 * **id string** rather than importing the kind — that is what lets this file be
 * imported without linking the ratio table, and `composeLocale` is where the two
 * halves meet, at the integrator's own wiring.
 *
 * **Three of the four units keep the decision `en.ts` made, and Japanese has
 * three separate reasons for it.**
 *
 * The first is `en.ts`'s own: a speed is a compound. Japanese writes it
 * 「メートル毎秒」 and 「キロメートル毎時」, where 毎秒 and 毎時 ("per second",
 * "per hour") are words of their own that a `forms` table would have to print
 * inside one unit token and the lexer would have to take back as one. It cannot.
 *
 * The second is measured. `japanese.segment` hands every letter run to
 * `Intl.Segmenter`, and ICU cuts each of those compounds at exactly the join —
 * メートル毎秒 → ["メートル", "毎秒"], キロメートル毎時 → ["キロメートル",
 * "毎時"], マイル毎時 → ["マイル", "毎時"] — so the compound could not survive
 * a round trip even if the lexer took spaces inside a unit word.
 *
 * The third is the one `uk.ts` discovered and it is why these three units have
 * **no Japanese alias at all**, where every other `ja` vocabulary in this repo
 * adds several. The slash-free heads a reader would otherwise reach for —
 * メートル, キロメートル, マイル — are already `@smartput/length`'s words. The
 * alias index is one flat map with no kind in the key, so claiming
 * キロメートル here would give 「5キロメートル」 two readings in any engine that
 * installs both kinds, which is exactly what the `@smartput/kinds` barrel does.
 * What Japanese gets instead is the kind's own bridge: 「100 km / 時間」 divides
 * a length by a duration and lands in `speed` through the `ops` signature in
 * `index.ts`, which is how the compound is actually computed.
 *
 * 「時速」 is left out for a fourth reason, particular to Japanese word order and
 * worth recording because it looks like an omission. It is the ordinary way to
 * say a road speed — 「時速100キロ」, "hourly-speed 100 km" — and it is a
 * *prefix*: it arrives before the number, where a unit label can never be read,
 * since `lex` binds a unit word to the number on its left. A vocabulary entry
 * cannot move a word to the other side of its quantity.
 *
 * **The symbols are the ones Japan writes, slashes and all.** 「m/s」 and
 * 「km/h」 are what a Japanese physics textbook and a Japanese speedometer
 * print; "kph" is not Japanese at all, and inventing a slash-free spelling to
 * make the round trip easy would put a string nobody writes into the vocabulary.
 * The slash is an operator to `lex`, so these symbols re-read as arithmetic
 * rather than by lookup — 「100km/h」 is a length over a duration, which
 * `speed.ops` answers — the same route English's own "m/s" has always taken.
 * `assertLocaleContract` knows to leave an operator-bearing symbol to an
 * evaluation test rather than to the alias index, and `ja.test.ts` is that test.
 *
 * **`knot` is the exception here as it is in English**, and for the same reason:
 * one word, so it survives both the lexer and ICU (ノット → ["ノット"]), so it
 * declares a form. One form and not two — `japanese.selectForm` returns the
 * constant `"other"` for every count and every slot, because Japanese nouns do
 * not inflect for number and `Intl.PluralRules("ja")` declares the single
 * category `other`. 「20ノット」 covers 1, 20 and 1.5 alike, where English needs
 * "knot" beside "knots" and Ukrainian needs four nominative rows and four
 * locative ones. The symbol stays the international "kt", which Japanese
 * aviation and marine charts use; it never reaches output, because a form
 * outranks a symbol in `renderQuantity`, and it is recorded because R8 wants
 * every unit's written abbreviation on the unit.
 *
 * The Latin aliases are reused from `units.ts` rather than retyped, the same as
 * `en.ts` does, which keeps the micro path (`parseSpeed`) and the engine path
 * agreeing by construction.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      aliases: [...alias("knot"), "ノット"],
      symbol: "kt",
      forms: { other: "ノット" },
    },
  },
});

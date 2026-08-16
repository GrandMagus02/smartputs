import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Ukrainian words for the speed units.
 *
 * Shaped exactly like `en.ts` next door, down to naming `speed` by **id
 * string** rather than importing the kind — that is what lets this file be
 * imported without linking the ratio table, and `composeLocale` is where the
 * two halves meet, at the integrator's own wiring.
 *
 * **Three of the four units keep the decision `en.ts` made, and Ukrainian
 * makes its reason sharper.** A speed is a compound in both languages, and the
 * Ukrainian compound is written with a slash — "м/с", "км/год", "миль/год" — or
 * spelled out as three words, "кілометрів на годину". `parse/lex.ts` builds a
 * unit word out of letters plus trailing digits, so neither shape can lex back
 * as one token, and a `forms` table for them would be eight keys of prose no
 * input could ever reach. Absent forms keep `formatValue` on the symbol, so a
 * Ukrainian speed prints "100км/год" — the same tight shape English prints
 * "100kph" through.
 *
 * **The same fact is why those three add no Cyrillic alias**, which every other
 * `uk` vocabulary in this repo does. Here the Ukrainian spelling *is* the
 * slash-bearing symbol, and the slash-free heads a reader would otherwise reach
 * for — "метрів", "кілометрів", "миль" — are already `@smartput/length`'s
 * words. Claiming them here would give "5 кілометрів" two readings in any
 * engine that installs both kinds, which is precisely what the
 * `@smartput/kinds` barrel installs; the alias index is one flat map, so that
 * collision would not stay inside this package. What Ukrainian gets instead is
 * the kind's own bridge: "100 км / год" divides a length by a duration and
 * lands in `speed` through the `ops` signature in `index.ts`, which is how the
 * compound is actually written. `uk.test.ts` asserts that path rather than
 * leaving this paragraph to be taken on trust.
 *
 * **`knot` is the exception here as it is in English**, and for the same
 * reason: one word, so it parses back, so it declares forms — eight of them
 * rather than English's two, because Ukrainian chooses a unit word by case as
 * well as by number. `вузол` is masculine with a fleeting `о` that drops in
 * every form but the nominative singular: `вузол`, then `вузла`, `вузли`,
 * `вузлів`, `вузлах`. All four nominative rows are different strings, and the
 * one worth naming is `nom-other` — the CLDR category a fraction lands in,
 * which Ukrainian fills with the genitive *singular*: "1,5 вузла", never
 * "1,5 вузлів". The locative four are what `в` governs: "в 5 вузлах".
 *
 * **Symbols.** Ukrainian writes all three compounds itself, and the hour in
 * them is "год" and never "г" — "г" is the gram. `knot` carries "вуз", the
 * Ukrainian abbreviation, where English carries "kt"; because `knot` declares
 * forms that symbol never reaches output, and it is recorded because ruling R8
 * wants every unit's written abbreviation on the unit and because the
 * renderer's no-symbol branch joins number and unit with no space at all, so a
 * unit that forgot its symbol would move a byte rather than fail.
 *
 * The Latin aliases are reused from `units.ts` rather than retyped, the same as
 * `en.ts` does: a Ukrainian speaker types "100 kph" as readily as a conversion
 * into it, and deriving them keeps the micro path (`parseSpeed`) and the engine
 * path agreeing by construction.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "м/с" },
    kph: { aliases: alias("kph"), symbol: "км/год" },
    mph: { aliases: alias("mph"), symbol: "миль/год" },
    knot: {
      // Every cell of the paradigm a reader might type, not a stem list: the
      // vocabulary is what the language's suffix stripper falls back *from*.
      // "вуз" is the abbreviation, and it is short enough that the stripper's
      // `minStem: 3` would never have reached it.
      aliases: [
        ...alias("knot"),
        "вуз",
        "вузол",
        "вузла",
        "вузлу",
        "вузлі",
        "вузли",
        "вузлів",
        "вузлам",
        "вузлах",
        "вузлом",
        "вузлами",
      ],
      symbol: "вуз",
      forms: {
        "nom-one": "вузол",
        "nom-few": "вузли",
        "nom-many": "вузлів",
        "nom-other": "вузла",
        "loc-one": "вузлі",
        "loc-few": "вузлах",
        "loc-many": "вузлах",
        "loc-other": "вузлах",
      },
    },
  },
});

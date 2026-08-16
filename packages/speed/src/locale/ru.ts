import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Russian words for the speed units.
 *
 * Shaped exactly like `en.ts` next door, down to naming `speed` by **id string**
 * rather than importing the kind — that is what lets this file be imported
 * without linking the ratio table, and `composeLocale` is where the two halves
 * meet, at the integrator's own wiring.
 *
 * **Three of the four units keep the decision `en.ts` made.** A speed is a
 * compound in every language here, and the Russian compound is written with a
 * slash — "м/с", "км/ч", "миль/ч" — or spelled out as three words, "километров
 * в час". `parse/lex.ts` builds a unit word out of letters plus trailing digits,
 * so neither shape can lex back as one token, and a `forms` table for them would
 * be eight keys of prose no input could ever reach. Absent forms keep
 * `formatValue` on the symbol, so a Russian speed prints "100км/ч" — the same
 * tight shape English prints "100kph" through.
 *
 * **The same fact is why those three add no Cyrillic alias**, which every other
 * `ru` vocabulary in this repo does. Here the Russian spelling *is* the
 * slash-bearing symbol, and the slash-free heads a reader would otherwise reach
 * for — "метров", "километров", "миль" — are already `@smartput/length`'s words.
 * Claiming them here would give "5 километров" two readings in any engine that
 * installs both kinds, which is precisely what the `@smartput/kinds` barrel
 * installs; the alias index is one flat map with no kind in the key, so that
 * collision would not stay inside this package. What Russian gets instead is the
 * kind's own bridge: "100 км / ч" divides a length by a duration and lands in
 * `speed` through the `ops` signature in `index.ts`, which is how the compound is
 * actually written.
 *
 * Note that the Russian spelled-out compound is "километров **в** час", not
 * Ukrainian's "кілометрів **на** годину" — and "в" is core's conversion keyword.
 * That is a second, independent reason the phrase could never have been an alias
 * here: even if the lexer joined word tokens, the middle one would arrive as an
 * operator.
 *
 * **`knot` is the exception here as it is in English**, and for the same reason:
 * one word, so it parses back, so it declares forms — eight of them rather than
 * English's two, because Russian chooses a unit word by case as well as by
 * number. `узел` is masculine with a fleeting `е` that drops in every form but
 * the nominative singular: `узел`, then `узла`, `узлы`, `узлов`, `узлах`. The
 * two rows worth naming are `nom-few` — "2 узла", a genitive **singular** where
 * Ukrainian writes the nominative plural "2 вузли" — and `nom-other`, the CLDR
 * category a fraction lands in, which Russian fills with that same genitive
 * singular: "1,5 узла", never "1,5 узлов". The locative four are what "в"
 * governs: "в 5 узлах". The key is labelled `loc` rather than the accurate
 * Russian `prep` by a deliberate borrowing from `uk`, argued in
 * `@smartput/core/locale/ru`.
 *
 * **Symbols.** Russian writes all three compounds itself, and the hour in them
 * is "ч" — the GOST symbol, and not "час", which is the word. `knot` carries
 * "уз", the Russian abbreviation, where English carries "kt"; because `knot`
 * declares forms that symbol never reaches output, and it is recorded because
 * ruling R8 wants every unit's written abbreviation on the unit and because the
 * renderer's no-symbol branch joins number and unit with no space at all, so a
 * unit that forgot its symbol would move a byte rather than fail.
 *
 * The Latin aliases are reused from `units.ts` rather than retyped, the same as
 * `en.ts` does: a Russian speaker types "100 kph" as readily as a conversion into
 * it, and deriving them keeps the micro path (`parseSpeed`) and the engine path
 * agreeing by construction.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "м/с" },
    kph: { aliases: alias("kph"), symbol: "км/ч" },
    mph: { aliases: alias("mph"), symbol: "миль/ч" },
    knot: {
      // Every cell of the paradigm a reader might type, not a stem list: the
      // vocabulary is what the language's suffix stripper falls back *from*.
      // "уз" is the abbreviation, and it is short enough that the stripper's
      // `minStem: 3` would never have reached it.
      aliases: [
        ...alias("knot"),
        "уз",
        "узел",
        "узла",
        "узлу",
        "узле",
        "узлом",
        "узлы",
        "узлов",
        "узлам",
        "узлах",
        "узлами",
      ],
      symbol: "уз",
      forms: {
        "nom-one": "узел",
        "nom-few": "узла",
        "nom-many": "узлов",
        "nom-other": "узла",
        "loc-one": "узле",
        "loc-few": "узлах",
        "loc-many": "узлах",
        "loc-other": "узлах",
      },
    },
  },
});

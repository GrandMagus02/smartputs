import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Polish words for the speed units.
 *
 * Shaped exactly like `en.ts` next door, down to naming `speed` by **id string**
 * rather than importing the kind — that is what lets this file be imported
 * without linking the ratio table, and `composeLocale` is where the two halves
 * meet, at the integrator's own wiring.
 *
 * **Three of the four units keep the decision `en.ts` made.** A speed is a
 * compound in every language here, and the Polish compound is written with a
 * slash — "m/s", "km/h" — or spelled out as three words, "kilometrów na
 * godzinę". `parse/lex.ts` builds a unit word out of letters plus trailing
 * digits, so neither shape can lex back as one token, and a `forms` table for
 * them would be eight keys of prose no input could ever reach. Absent forms keep
 * `formatValue` on the symbol, so a Polish speed prints "100 km/h" — spaced
 * rather than tight, because `polish.renderQuantity` sets a symbol off from its
 * number as PN-EN ISO 80000 asks.
 *
 * Note that the middle word of the spelled-out phrase is "na", which this
 * language declares under `in`. That is a second, independent reason the phrase
 * could never have been an alias: even if the lexer joined word tokens, the
 * middle one would arrive as a conversion operator. Ukrainian's "на годину" pays
 * the same price; Russian's "в час" pays it with a different word.
 *
 * **The same fact is why those three add no Polish alias**, which every other
 * inflecting vocabulary in this repo does. Here the Polish spelling *is* the
 * slash-bearing symbol, and the slash-free heads a reader would otherwise reach
 * for — "metrów", "kilometrów", "mil" — are already `@smartput/length`'s words.
 * Claiming them here would give "5 kilometrów" two readings in any engine that
 * installs both kinds, which is precisely what the `@smartput/kinds` barrel
 * installs; the alias index is one flat map with no kind in the key, so that
 * collision would not stay inside this package. What Polish gets instead is the
 * kind's own bridge: "100 km / h" divides a length by a duration and lands in
 * `speed` through the `ops` signature in `index.ts`, which is how the compound
 * is actually written.
 *
 * **`mph` keeps the Latin symbol**, and that is a departure from `ru.ts`, which
 * prints "миль/ч". Polish has no settled native abbreviation for the imperial
 * mile per hour — "mil/h" is a back-formation nobody prints, and it would carry
 * a slash and so be unreadable anyway — while "mph" is what the Polish motoring
 * press writes verbatim. It is already a derived alias, so unlike the other two
 * compounds this one's printed symbol parses straight back.
 *
 * **`knot` is the exception here as it is in English**, and for the same reason:
 * one word, so it parses back, so it declares forms — eight of them rather than
 * English's two, because Polish chooses a unit word by case as well as by
 * number. `węzeł` is masculine with a fleeting `e` that drops in every form but
 * the nominative singular: `węzeł`, then `węzła`, `węzły`, `węzłów`, `węzłach`.
 * Three rows are worth naming:
 *
 *   `nom-few`   "2 węzły"   a real nominative **plural**, where Russian writes
 *                           the genitive singular "2 узла" in the same cell.
 *   `nom-many`  "5 węzłów"  the genitive plural — with the -ów ending on, and
 *                           reaching **21**: "dwadzieścia jeden węzłów", where
 *                           both Slavic neighbours agree 21 with the singular.
 *   `nom-other` "1,5 węzła" the fractional row, a genitive **singular**, and the
 *                           only cell no integer count can reach.
 *
 * `loc-one` is "węźle" — the locative softens `zł` to `źl`, so it shares no
 * suffix boundary with "węzeł" and no ending table could have produced it. It is
 * listed as an alias for exactly that reason, and `pl.test.ts` asserts the
 * containment. The locative four are what "w" governs: "w 5 węzłach".
 *
 * **Symbols.** Polish writes "m/s" and "km/h" itself; the hour in the second is
 * "h", the SI symbol, and not "godz", which is a contraction of the word.
 * `knot` carries "kn", the international abbreviation Polish sailing and
 * aviation both use; because `knot` declares forms that symbol never reaches
 * output, and it is recorded because ruling R8 wants every unit's written
 * abbreviation on the unit. The single-letter Polish "w." for węzeł is not it:
 * it carries a dot, which ends a word token, and dotless it would be the watt.
 *
 * The Latin aliases are reused from `units.ts` rather than retyped, the same as
 * `en.ts` does: a Polish speaker types "100 kmh" as readily as a conversion into
 * it, and deriving them keeps the micro path (`parseSpeed`) and the engine path
 * agreeing by construction.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      // Every cell of the paradigm a reader might type, not a stem list: the
      // vocabulary is what the language's suffix stripper falls back *from*.
      // "kn" is the abbreviation, and it is two letters — below the stripper's
      // `minStem: 3` — so nothing would have recovered it.
      aliases: [
        ...alias("knot"),
        "kn",
        "węzeł",
        "węzła",
        "węzłowi",
        "węźle",
        "węzłem",
        "węzły",
        "węzłów",
        "węzłom",
        "węzłach",
        "węzłami",
        // The diacritic-free spellings, and this is the only unit in the Polish
        // translation that needs them. Every other Polish word this repo prints
        // carries at most one diacritic, so a reader on an ASCII keyboard is one
        // edit away from it and the fuzzy pass rescues them ("kilogramow" reads
        // as "kilogramów", "dzula" as "dżula"). `węzeł` carries two and its
        // genitive plural `węzłów` carries three — ę, ł and ó — which is past
        // what a correction will apply, so "5 wezlow" was simply an unknown
        // unit. Listing the stripped forms is the same answer
        // `@smartput/length/locale/de` gives for "fuss" beside "fuß", and it
        // collides with nothing: no other unit in any installed kind spells
        // these. They read and are never printed — no `forms` cell holds one —
        // so the output stays the properly spelled Polish.
        "wezel",
        "wezla",
        "wezlowi",
        "wezle",
        "wezlem",
        "wezly",
        "wezlow",
        "wezlom",
        "wezlach",
        "wezlami",
      ],
      symbol: "kn",
      forms: {
        "nom-one": "węzeł",
        "nom-few": "węzły",
        "nom-many": "węzłów",
        "nom-other": "węzła",
        "loc-one": "węźle",
        "loc-few": "węzłach",
        "loc-many": "węzłach",
        "loc-other": "węzłach",
      },
    },
  },
});

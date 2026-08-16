import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Spanish words for the speed units.
 *
 * The bare `es` tag, matching the language in `@smartput/core/locale/es`: CLDR's
 * default content for Spanish, which is Spain's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a
 * flag here.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `speed` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the bridge signature, and
 * `composeLocale` is where the two halves meet, at the integrator's own wiring.
 * `aliases` derives the Latin set from `units.ts` rather than retyping it, so
 * the micro path (`parseSpeed`) and the engine path agree by construction — the
 * cross-path test in `validate.test.ts` depends on exactly that.
 *
 * **Three of the four units keep the decision `en.ts` made, and Spanish states
 * its reason in the orthography itself.** A speed is a compound in every
 * language here, and Spanish writes it with the solidus — "m/s", "km/h",
 * "mi/h" — or spells it out as four words, "kilómetros por hora", whose second
 * word is already this language's `times` keyword. `parse/lex.ts` builds a unit
 * word out of letters plus trailing digits, so neither shape can lex back as
 * one token and a `forms` table for them would be prose no input could reach.
 * Absent forms keep `formatValue` on the symbol, so a Spanish speed prints
 * "100km/h" — the same tight shape English prints "100kph" and Ukrainian
 * "100км/год" through.
 *
 * **The symbols are the Spanish compounds rather than English's contractions**,
 * and unlike `@smartput/datarate`'s "Mbps" that is affordable here, because the
 * arithmetic those slashes describe is *true*: "km/h" lexes as a length divided
 * by a duration, and this kind's own `ops` entry names both operands by id
 * string and returns a speed. So "100km/h" reads back as the same quantity in
 * any engine that installs `length` and `duration` beside this one — the route
 * English's "m/s" has always taken, where the symbol is likewise no alias. What
 * it costs is that a speed-only engine cannot re-read its own printed output
 * for these three, which is exactly the trade `uk.ts` records; `es.test.ts`
 * asserts the bridged path rather than leaving this paragraph to be trusted.
 * "mph" was the alternative for the imperial row and was rejected for being an
 * English contraction in a Spanish sentence, spelled the one way that does
 * *not* decompose.
 *
 * **The same fact is why those three add no Spanish alias.** The slash-free
 * heads a reader would otherwise reach for — "metros", "kilómetros", "millas" —
 * are already `@smartput/length`'s words, and the alias index is one flat map
 * with no kind in the key, so claiming them here would give "5 kilómetros" two
 * readings in any engine installing both kinds, which is what the
 * `@smartput/kinds` barrel does. The bridge above is what Spanish gets instead,
 * and it is how the compound is actually written anyway.
 *
 * **`nudo` is the exception here as `knot` is in English**, and for the same
 * reason: one word, so it parses back, so it declares forms. Masculine, regular
 * -s plural, and the two rows are genuinely two strings where English's
 * "horsepower" needed two identical ones. Its symbol is "kn" — the ISO and
 * maritime abbreviation, which Spanish writes unchanged — rather than English's
 * "kt"; because `nudo` declares forms that symbol never reaches output, and it
 * is recorded because ruling R8 wants every unit's written abbreviation on the
 * unit and because the renderer's no-symbol branch joins number and unit with
 * no space at all, so a unit that forgot its symbol would move a byte rather
 * than fail. It is listed in `aliases` too, since a symbol the printer can emit
 * must be one the parser reads back by declaration.
 */
export default defineVocabulary({
  locale: "es",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mi/h" },
    knot: {
      aliases: [...alias("knot"), "kn", "nudo", "nudos"],
      symbol: "kn",
      forms: { one: "nudo", other: "nudos" },
    },
  },
});

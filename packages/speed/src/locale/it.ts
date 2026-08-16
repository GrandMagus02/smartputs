import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Italian words for the speed units.
 *
 * The bare `it` tag, matching the language in `@smartput/core/locale/it`: CLDR's
 * default content for Italian, which is Italy's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a flag
 * here.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `speed` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the bridge signature, and
 * `composeLocale` is where the two halves meet, at the integrator's own wiring.
 * `aliases` derives the Latin set from `units.ts` rather than retyping it, so the
 * micro path (`parseSpeed`) and the engine path agree by construction — the
 * cross-path test in `validate.test.ts` depends on exactly that.
 *
 * **Three of the four units keep the decision `en.ts` made, and Italian states
 * its reason in the orthography.** A speed is a compound in every language here,
 * and Italian writes it with the solidus — "m/s", "km/h" — or spells it out as
 * four words, "chilometri all'ora", whose apostrophe and space both end a token.
 * `parse/lex.ts` builds a unit word out of letters plus trailing digits, so
 * neither shape can lex back as one token and a `forms` table for them would be
 * prose no input could reach. Absent forms keep `formatValue` on the symbol, so
 * an Italian speed prints "100km/h" — the same tight shape English prints
 * "100kph" and Ukrainian "100км/год" through.
 *
 * **The metric symbols are the Italian compounds rather than English's
 * contractions**, and unlike `@smartput/datarate`'s "Mbps" that is affordable
 * here, because the arithmetic those slashes describe is *true*: "km/h" lexes as
 * a length divided by a duration, and this kind's own `ops` entry names both
 * operands by id string and returns a speed. So "100km/h" reads back as the same
 * quantity in any engine that installs `length` and `duration` beside this one —
 * the route English's "m/s" has always taken, where the symbol is likewise no
 * alias. What it costs is that a speed-only engine cannot re-read its own printed
 * output for those two, which is the trade `uk.ts` and `es.ts` both record;
 * `it.test.ts` asserts the bridged path rather than leaving this paragraph to be
 * trusted.
 *
 * **`mph` is where Italian parts company with the Spanish file, and the reason is
 * that Italy does not use this unit.** Spanish chose "mi/h" so the imperial row
 * would decompose like the metric two. Italian keeps "mph", because the only
 * Italian sentences that contain a mile per hour are ones reporting a British or
 * American figure, and those print the English contraction: an Italian car
 * magazine writes "260 mph", never "260 mi/h". The asymmetry with the two rows
 * above is therefore the truth about the language rather than an oversight — and
 * it happens to buy the one property the others lack, since "mph" is a single
 * letter run that `units.ts` already declares as an alias, so this row round-trips
 * in a speed-only engine. The bridged reading still works too ("60 miglia / ora"
 * reaches the same value), so nothing is lost by preferring the borrowed
 * contraction.
 *
 * **The same bridge is why the metric two add no Italian alias.** The slash-free
 * heads a reader would otherwise reach for — "metri", "chilometri", "miglia" —
 * are already `@smartput/length`'s words, and the alias index is one flat map
 * with no kind in the key, so claiming them here would give "5 chilometri" two
 * readings in any engine installing both kinds, which is what the
 * `@smartput/kinds` barrel does.
 *
 * **`nodo` is the exception here as `knot` is in English**, and for the same
 * reason: one word, so it parses back, so it declares forms. Masculine, ordinary
 * -o → -i plural, and the two rows are genuinely two strings where the invariant
 * loanwords of `@smartput/power/locale/it` needed two identical ones. Its symbol
 * is "kn" — the ISO and maritime abbreviation, which Italian writes unchanged —
 * rather than English's "kt"; because `nodo` declares forms that symbol never
 * reaches output, and it is recorded because ruling R8 wants every unit's written
 * abbreviation on the unit and because the renderer's no-symbol branch joins
 * number and unit with no space at all, so a unit that forgot its symbol would
 * move a byte rather than fail. It is listed in `aliases` too, since a symbol the
 * printer can emit must be one the parser reads back by declaration.
 */
export default defineVocabulary({
  locale: "it",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      aliases: [...alias("knot"), "kn", "nodo", "nodi"],
      symbol: "kn",
      forms: { one: "nodo", other: "nodi" },
    },
  },
});

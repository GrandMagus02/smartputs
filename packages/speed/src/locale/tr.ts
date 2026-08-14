import { aliasesFor, defineVocabulary } from "@smartput/core";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Turkish words for the speed units.
 *
 * The bare `tr` tag, matching the language in `@smartput/core/locale/tr`. Shaped
 * exactly like `en.ts` next door, down to naming `speed` by **id string** rather
 * than importing the kind — that is what lets this file be imported without
 * linking the ratio table or the bridge signature, and `composeLocale` is where
 * the two halves meet, at the integrator's own wiring. `aliases` derives the
 * Latin set from `units.ts` rather than retyping it, so the micro path
 * (`parseSpeed`) and the engine path agree by construction.
 *
 * **Three of the four units keep the decision `en.ts` made, and Turkish reaches
 * it despite having the easiest grammar in this repo.** `turkish.selectForm`
 * returns the single key `"other"` — a counted noun is bare here — so a `forms`
 * table would cost exactly one row per unit and no translator would have to
 * think about number at all. It is still impossible for these three, because the
 * obstacle is not grammar but the token: Turkish writes a speed as "m/s",
 * "km/sa" and "mil/sa", or spells it out as "saatte kilometre", and
 * `parse/lex.ts` builds a unit word out of letters plus trailing digits — so a
 * slash or a space ends the token either way. A one-row table of prose no input
 * could reach is still a table of prose no input could reach. Absent forms keep
 * `formatValue` on the symbol, which `turkish.renderQuantity` sets off from the
 * number with a space as TSE requires: "100 km/sa", where English prints
 * "100kph" tight.
 *
 * **The same fact is why those three add no Turkish alias.** The Turkish
 * spelling *is* the slash-bearing symbol, and the slash-free heads a reader
 * would otherwise reach for — "metre", "kilometre", "mil" — are already
 * `@smartput/length`'s words. Claiming them here would give "5 kilometre" two
 * readings in any engine that installs both kinds, which is exactly what the
 * `@smartput/kinds` barrel installs; the alias index is one flat map with no
 * kind in its key, so that collision would not stay inside this package. What
 * Turkish gets instead is the kind's own bridge: "100 km / sa" divides a length
 * by a duration and lands in `speed` through the `ops` signature in `index.ts`,
 * which is how the compound is actually written. `sa` is `@smartput/duration`'s
 * Turkish symbol for the hour, so the two packages meet at the slash without
 * either one naming the other.
 *
 * **`knot` is the exception here as it is in English**, and for the same reason:
 * one word, so it parses back, so it declares a form. Turkish borrows the unit
 * whole — "knot" is what a Turkish weather bulletin says and writes, where the
 * descriptive "deniz mili/saat" is a definition rather than a name — and the
 * borrowing is invariant after a numeral like every other counted noun here:
 * "5 knot", "1,5 knot". The word is already an alias in `units.ts`, so the one
 * row this language needs round-trips by construction.
 *
 * **Symbols.** Turkish writes the hour in a compound as "sa" and never "s" —
 * "s" is the second — so kph is "km/sa" and mph is "mil/sa", each carrying the
 * "/" that makes it arithmetic rather than a lookup. `knot` carries "kn", the
 * international maritime abbreviation Turkish uses unchanged, listed in
 * `aliases` so the symbol reads back even though the declared form means it
 * never reaches ordinary output. R8 wants every unit's written abbreviation on
 * the unit, and the renderer's no-symbol branch joins number and label with no
 * space at all, so a unit that forgot its symbol would move a byte rather than
 * fail.
 *
 * **Case endings are left to the language.** "knota çevir" takes the back-vowel
 * dative and "knotta" the locative hardened after a voiceless `t`;
 * `turkish`'s suffix stripper enumerates every harmonic variant so a vocabulary
 * does not have to, and `minStem: 3` clears a four-letter stem with room to
 * spare.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/sa" },
    mph: { aliases: alias("mph"), symbol: "mil/sa" },
    knot: {
      aliases: [...alias("knot"), "kn"],
      symbol: "kn",
      forms: { other: "knot" },
    },
  },
});

import { aliasesFor, defineVocabulary } from "@smartput/core";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * French words for the speed units.
 *
 * The bare `fr` tag, matching the language in `@smartput/core/locale/fr`: CLDR's
 * default content for French, which is metropolitan France's — group U+202F
 * NARROW NO-BREAK SPACE, decimal ",". A regional variant would be a `Language`
 * with an id of its own rather than a flag here.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `speed` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the bridge signature, and
 * `composeLocale` is where the two halves meet, at the integrator's own wiring.
 * `aliases` derives the Latin set from `units.ts` rather than retyping it, so
 * the micro path (`parseSpeed`) and the engine path agree by construction — the
 * cross-path test in `validate.test.ts` depends on exactly that.
 *
 * **Three of the four units keep the decision `en.ts` made, and French states
 * its reason twice over.** A speed is a compound in every language here, and
 * French writes it with the solidus — "m/s", "km/h", "mi/h" — or spells it as
 * four words, "kilomètres par heure", whose second word is already this
 * language's `by` keyword (`french.keywords.by` is `["par"]`, because "multiplié
 * par 5" is the phrasal times). `parse/lex.ts` builds a unit word out of letters
 * plus trailing digits, so neither shape can lex back as one token, and a
 * `forms` table for them would be prose whose own middle token the fold reads as
 * an operator. Absent forms keep `formatValue` on the symbol.
 *
 * **The symbols are the French compounds rather than English's contractions**,
 * and unlike `@smartput/datarate`'s "Mbps" that is affordable here, because the
 * arithmetic those slashes describe is *true*: "km/h" lexes as a length divided
 * by a duration, and this kind's own `ops` entry names both operands by id
 * string and returns a speed. So "100 km/h" reads back as the same quantity in
 * any engine that installs `length` and `duration` beside this one — the route
 * English's "m/s" has always taken, where the symbol is likewise no alias. What
 * it costs is that a speed-only engine cannot re-read its own printed output for
 * these three, which is exactly the trade `uk.ts` and `es.ts` record;
 * `fr.test.ts` asserts the bridged path rather than leaving this paragraph to be
 * trusted. "kmh" and "mph" were the alternatives for the metric and imperial
 * rows and were rejected for being English contractions in a French sentence,
 * spelled the one way that does *not* decompose.
 *
 * **The same fact is why those three add no French alias.** The slash-free heads
 * a reader would otherwise reach for — "mètres", "kilomètres", "milles" — are
 * already `@smartput/length`'s words, and the alias index is one flat map with
 * no kind in the key, so claiming them here would give "5 kilomètres" two
 * readings in any engine installing both kinds, which is what the
 * `@smartput/kinds` barrel does. The bridge above is what French gets instead,
 * and it is how the compound is actually written anyway.
 *
 * **`nœud` is the exception here as `knot` is in English**, and for the same
 * reason: one word, so it parses back, so it declares forms. Masculine, regular
 * -s plural, and it prints with the ligature because that is how French spells
 * it. Two things about that ligature are worth writing down, because both are
 * easy to get wrong from outside French:
 *
 * - **U+0153 survives NFKC.** The ligature œ has no compatibility
 *   decomposition, so `normalize()` leaves it exactly as typed and "noeud" is a
 *   *different string* from "nœud" — it reaches nothing unless it is listed.
 *   Both spellings are therefore declared, in both numbers, the same move the
 *   Spanish files make for their accents. Only the ligature is ever printed.
 * - **The lexer already takes it.** `lex` builds a word out of `\p{L}`, and
 *   U+0153 is a letter, so "nœuds" is one token and needs nothing from the
 *   language.
 *
 * Its symbol is **"nd"** — the abbreviation French maritime and meteorological
 * writing uses, where English writes "kt" and ISO writes "kn". All three read
 * ("kt" arrives from `units.ts`, "kn" is listed beside "nd"), because
 * recognition is many-to-one (I6); only "nd" would ever be printed, and in
 * practice not even that, since this unit declares `forms` and the renderer
 * reaches for the word. It is recorded because ruling R8 wants every unit's
 * written abbreviation on the unit, and it is listed in `aliases` because a
 * symbol the printer can emit must be one the parser reads back by declaration.
 *
 * A word that is deliberately *not* here: **"mille"**, the French nautical mile.
 * `frenchNumerals` claims "mille" as the cardinal 1000, so "5 mille" is the
 * number five thousand before any unit is looked up, and an alias spelled that
 * way could never be reached. "mille marin" is the unambiguous name and is two
 * words, which no unit token can be (the limit `phrase-analyzer.ts` documents).
 * The unit `units.ts` calls `knot` is the same quantity per hour rather than the
 * distance, so nothing is lost here — the distance belongs to `@smartput/length`,
 * and this note is for whoever writes that file.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mi/h" },
    knot: {
      aliases: [...alias("knot"), "nd", "kn", "nœud", "nœuds", "noeud", "noeuds"],
      symbol: "nd",
      forms: { one: "nœud", other: "nœuds" },
    },
  },
});

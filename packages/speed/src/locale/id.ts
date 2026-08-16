import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Indonesian words for the speed units.
 *
 * The bare `id` tag, matching the language in `@smartput/core/locale/id`. Shaped
 * exactly like `en.ts`, `nl.ts` and `uk.ts` beside it, down to naming `speed` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the bridge signature, and
 * `composeLocale` is where the two halves meet. The Latin aliases are reused
 * from `units.ts` rather than retyped — an Indonesian driver reads "kmh" off a
 * dashboard as readily as a conversion into it — which keeps the micro path
 * `parseSpeed` and the engine path agreeing by construction.
 *
 * **Three of the four units keep the decision `en.ts` made, and Indonesian has
 * no way out of it at all.** A Germanic language's escape from an English
 * compound is to close it up, which is how `@smartput/energy/locale/nl` gets to
 * print *kilowattuur*; Dutch still could not use it here, because a speed is the
 * one compound it writes open. Indonesian never had the escape to begin with: it
 * does not glue nouns, and its name for this quantity is "kilometer per jam" —
 * three words, with *per* a borrowed preposition standing between two free
 * nouns. `parse/lex.ts` builds a unit word out of letters plus trailing digits,
 * so a space ends the token however the phrase is spelled, and a `forms` table
 * for those three would be a row of prose no input could reach. Rule 6 is
 * satisfied by an empty key set, never by an unreachable one. Absent forms keep
 * `formatValue` on the symbol.
 *
 * **The symbols keep their slash, and that is deliberate.** "m/s" and "km/jam"
 * are what Indonesian writes — an Indonesian road sign and speedometer both say
 * *km/jam* — and they re-read not as a lookup but as arithmetic: "/" lexes as
 * division, and this kind's own `/ | length | duration` signature in `index.ts`
 * computes a speed out of it. That is exactly how English's "m/s" has always
 * round-tripped and how Ukrainian's "км/год" does. `id.test.ts` asserts the
 * bridge rather than leaving this paragraph to be taken on trust.
 *
 * **`km/jam` rather than `km/h`, and the choice has a dependency worth stating.**
 * Indonesian spells the hour *jam*, and `@smartput/duration/locale/id` is what
 * makes that string a duration alias. So this symbol reads back only in an
 * engine that installs the Indonesian duration vocabulary beside this one, where
 * "km/h" would have read back through `units.ts`'s language-neutral `h`. Taking
 * the dependency is the right trade and the same one `nl.ts` takes for "km/u":
 * `h` is the spelling an Indonesian text uses when it is being SI, *jam* is the
 * one it uses when it is being Indonesian, and printing the second while still
 * reading the first costs nothing — "100 km/h" goes through the same bridge, and
 * the test pins both.
 *
 * `mph` needs no such route: Indonesian borrowed the English abbreviation whole
 * for the imperial unit — an Indonesian news item writes "60 mph" and never
 * "60 mil/jam" — so it is a single letter run, already a derived alias, and the
 * one of the three that round-trips in a speed-only engine.
 *
 * **The same fact is why those three add no Indonesian alias.** Here the
 * Indonesian spelling *is* the slash-bearing symbol, and the slash-free heads a
 * reader would otherwise reach for — *meter*, *kilometer*, *mil* — are already
 * `@smartput/length`'s words. The alias index is one flat map with no kind in
 * the key, so claiming "kilometer" here would give "5 kilometer" a second
 * reading in any engine that installs both kinds, which is what the
 * `@smartput/kinds` barrel does.
 *
 * **`knot` is the exception, as it is in English, and for a plainer reason than
 * either.** It is one word, so it parses back, so it declares a form — and in
 * Indonesian it is *also* one word in the sense that matters: the noun was
 * borrowed unmodified, spelled "knot", and it does not inflect, because nothing
 * in this language inflects. `indonesian.selectForm` returns the constant
 * `"other"` for every count and every slot, so where `nl.ts` has to write two
 * rows, *knoop* beside *knopen*, this writes one row and one word for every
 * reader who will ever ask. `kn` is the international abbreviation and is what
 * an Indonesian marine forecast writes; it is recorded as the symbol because R8
 * wants the unit's written abbreviation on the unit, and listed in `aliases`
 * because `symbol` is a display field `buildRegistry` never indexes.
 *
 * The three symbol-only units print tight — "100km/jam", not "100 km/jam" —
 * because `defaultRenderQuantity` sets a symbol against the number and
 * `@smartput/core/locale/id` declines a `renderQuantity` of its own, on the
 * reasoning that every translated Indonesian unit carries a `forms` row and
 * therefore takes the spacing word branch. This package is the sharpest
 * counter-example to that reasoning, and the repair belongs in the language file
 * rather than in three vocabularies each guessing at a space.
 */
export default defineVocabulary({
  locale: "id",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/jam" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      aliases: [...alias("knot"), "kn"],
      symbol: "kn",
      forms: { other: "knot" },
    },
  },
});

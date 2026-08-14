import { aliasesFor, defineVocabulary } from "@smartput/core";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * Dutch words for the speed units.
 *
 * The bare `nl` tag, matching the language in `@smartput/core/locale/nl`: CLDR's
 * default content for Dutch, which is the Netherlands'. Shaped exactly like
 * `en.ts`, `de.ts` and `uk.ts` beside it, down to naming `speed` by **id
 * string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table or the bridge signature, and
 * `composeLocale` is where the two halves meet. The Latin aliases are reused
 * from `units.ts` rather than retyped — a Dutch speaker types "100 kmh" as
 * readily as a conversion into it — which keeps the micro path (`parseSpeed`)
 * and the engine path agreeing by construction.
 *
 * **Three of the four units keep the decision `en.ts` made, and Dutch gets no
 * escape from it.** A Germanic language's usual way out of an English compound
 * is to close it up — `kilowattuur` is one word where "kilowatt hour" is two,
 * and `@smartput/energy/locale/nl` prints exactly that — but a speed is the one
 * compound Dutch writes *open*: "kilometer per uur", three words, or the solidus
 * abbreviation "km/u". `parse/lex.ts` builds a unit word out of letters plus
 * trailing digits, so a space ends the token and "/" is an operator; neither
 * shape can lex back as one unit word, and a `forms` table for those three would
 * be two keys of prose no input could reach. Absent forms keep `formatValue` on
 * the symbol.
 *
 * **The symbols keep their slash, and that is deliberate.** "m/s" and "km/u" are
 * what Dutch writes, and they re-read not as a lookup but as arithmetic: "/"
 * lexes as division, and this kind's own `/ | length | duration` signature in
 * `index.ts` computes a speed out of it. That is exactly how English's "m/s" has
 * always round-tripped and how Ukrainian's "км/год" does. `nl.test.ts` asserts
 * the bridge rather than leaving this paragraph to be taken on trust.
 *
 * **`km/u` rather than `km/h`, and the choice has a dependency worth stating.**
 * Dutch spells the hour `u` — "om 14 u 30", "120 km/u" — where German and SI
 * write `h`, and `@smartput/duration/locale/nl` is what makes that `u` a
 * duration alias. So this symbol reads back only in an engine that installs the
 * Dutch duration vocabulary beside this one, where "km/h" would have read back
 * through `units.ts`'s language-neutral `h`. Taking the dependency is the right
 * trade: `h` is the spelling a Dutch text uses when it is being SI, `u` is the
 * one it uses when it is being Dutch, and printing the second while still
 * reading the first costs nothing — "100 km/h" goes through the same bridge, and
 * the test pins both.
 *
 * `mph` needs no such route: Dutch borrowed the English abbreviation whole for
 * the imperial unit — a Dutch news item writes "60 mph" and never "60 mijl/u" —
 * so it is a single letter run, already a derived alias, and the one of the
 * three that round-trips in a speed-only engine.
 *
 * **The same fact is why those three add no Dutch alias**, which every other
 * Dutch vocabulary in this repo does. Here the Dutch spelling *is* the
 * slash-bearing symbol, and the slash-free heads a reader would otherwise reach
 * for — `meter`, `kilometer`, `mijl` — are already `@smartput/length`'s words.
 * The alias index is one flat map with no kind in the key, so claiming
 * "kilometer" here would give "5 kilometer" a second reading in any engine that
 * installs both kinds, which is what the `@smartput/kinds` barrel does. Worse in
 * Dutch than in Ukrainian, in fact, for the reason `de.ts` gives about German:
 * `dutch`'s `compoundSplitter` cuts every unlisted compound at its head, so a
 * `meter` claimed by two kinds would put every `-meter` compound in the language
 * into both of them.
 *
 * **`knoop` is the exception here as `knot` is in English**, and for the same
 * reason: one word, so it parses back, so it declares forms. It is also the
 * place Dutch and German visibly disagree. German's `Knoten` is an `-en`
 * masculine and invariant across all four of its keys; Dutch's `knoop` takes a
 * plain `-en` plural with open-syllable shortening — *knoop* → *knopen*, the
 * doubled vowel going single as the syllable opens — so the two rows here are
 * two different strings. That shortening is also why the plural is listed
 * explicitly: `dutch` refuses to strip `en` precisely because the stem it would
 * leave ("knop") is a different word, in this case a button.
 *
 * The noun is homographic with *knoop* "button, knot in a rope", which costs
 * nothing: the alias index is consulted only where a unit label may stand, and a
 * button is never written after a numeral in a measurement.
 *
 * `kn` is the international abbreviation and is what Dutch writes; it is
 * recorded as the symbol because ruling R8 wants every unit's written
 * abbreviation on the unit, and listed in `aliases` because `symbol` is a
 * display field that `buildRegistry` never indexes. It is two letters and
 * therefore below `suffixStripper`'s `minStem: 3`, so nothing would have
 * recovered it.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/u" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      aliases: [...alias("knot"), "kn", "knoop", "knopen"],
      symbol: "kn",
      forms: { one: "knoop", other: "knopen" },
    },
  },
});

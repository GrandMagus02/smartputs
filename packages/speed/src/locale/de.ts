import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * German words for the speed units.
 *
 * The bare `de` tag, matching the language in `@smartput/core/locale/de`: CLDR's
 * default content for German, which is Germany's. Shaped exactly like `en.ts`
 * and `uk.ts` next door, down to naming `speed` by **id string** rather than
 * importing the kind — that is what lets this file be imported without linking
 * the ratio table or the bridge signature, and `composeLocale` is where the two
 * halves meet.
 *
 * **Three of the four units keep the decision `en.ts` made, and German gets no
 * escape from it.** German's usual way out of an English compound is to close it
 * up — `Kilowattstunde` is one word where "kilowatt hour" is two, and
 * `@smartput/energy/locale/de` prints exactly that — but a speed is the one
 * compound German writes *open*: "Kilometer pro Stunde", three words, or the
 * solidus abbreviation "km/h". `parse/lex.ts` builds a unit word out of letters
 * plus trailing digits, so a space ends the token and "/" is an operator; neither
 * shape can lex back as one unit word, and a `forms` table for those three would
 * be four keys of prose no input could reach. Absent forms keep `formatValue` on
 * the symbol.
 *
 * **The symbols keep their slash, and that is deliberate.** "m/s" and "km/h" are
 * what German writes — DIN and SI both — and they re-read not as a lookup but as
 * arithmetic: "/" lexes as division, and this kind's own `/ | length | duration`
 * signature in `index.ts` computes a speed out of it. That is exactly how
 * English's "m/s" has always round-tripped and how Ukrainian's "км/год" does.
 * `de.test.ts` asserts the bridge rather than leaving this paragraph to be taken
 * on trust. `mph` needs no such route: German borrowed the English abbreviation
 * whole for the imperial unit, so it is a single letter run and already a
 * derived alias.
 *
 * **The same fact is why those three add no German alias**, which every other
 * German vocabulary in this repo does. Here the German spelling *is* the
 * slash-bearing symbol, and the slash-free heads a reader would otherwise reach
 * for — `Meter`, `Kilometer`, `Meilen` — are already `@smartput/length`'s words.
 * The alias index is one flat map with no kind in the key, so claiming
 * "kilometer" here would give "5 Kilometer" a second reading in any engine that
 * installs both kinds, which is precisely what the `@smartput/kinds` barrel
 * installs. Worse in German than in Ukrainian, in fact: `german`'s
 * `compoundSplitter` cuts every unlisted compound at its head, so a `kilometer`
 * claimed by two kinds would put every `-meter` compound in the language into
 * both of them.
 *
 * **`knot` is the exception here as it is in English and Ukrainian**, and for the
 * same reason: one word, so it parses back, so it declares forms. German's are
 * four keys — `german.selectForm` answers `` `${case}-${category}` `` over
 * {nom, dat} × {one, other} — and all four hold `Knoten`. That is not a table
 * that stopped halfway. `der Knoten` is an `-en` masculine: its plural is
 * identical to its singular, and its dative plural has nowhere to add the German
 * `-n` to, since the word already ends in one. Compare `@smartput/duration`'s
 * `Tag`, whose four keys hold three different words, and `Meile`, whose plural
 * *is* marked — invariance is a property of the noun class, and this noun has
 * it.
 *
 * `kn` is the international abbreviation and is what German writes; it is
 * recorded as the symbol because ruling R8 wants every unit's written
 * abbreviation on the unit, and listed in `aliases` because `symbol` is a
 * display field that `buildRegistry` never indexes. It is two letters and
 * therefore below `suffixStripper`'s `minStem: 3`, so nothing would have
 * recovered it.
 *
 * The Latin aliases are reused from `units.ts` rather than retyped, the same as
 * `en.ts` does: a German speaker types "100 kmh" as readily as a conversion into
 * it, and deriving them keeps the micro path (`parseSpeed`) and the engine path
 * agreeing by construction.
 */
export default defineVocabulary({
  locale: "de",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      aliases: [...alias("knot"), "kn", "knoten"],
      symbol: "kn",
      forms: {
        "nom-one": "Knoten",
        "nom-other": "Knoten",
        "dat-one": "Knoten",
        "dat-other": "Knoten",
      },
    },
  },
});

import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Italian words for the duration units.
 *
 * The bare `it` tag, matching the language in `@smartput/core/locale/it`: CLDR's
 * default content for Italian, which is Italy's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a
 * flag here, and none of these six words varies by region.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `duration`
 * by **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table, and it is the seam `composeLocale`
 * closes. `aliases` derives the Latin set from `units.ts` rather than retyping
 * it, so the micro path (`parseDuration`) and the engine path agree by
 * construction — including the ambiguity that `"m"` is minutes here and metres in
 * `length`, which is the solver's to rank and not this file's to remove.
 *
 * **This is the kind where Italian inflection is finally visible**, and it shows
 * all three of the classes `it.ts`'s `pluralFold` describes in six rows:
 *
 *   secondo  → secondi   masculine -o → -i, the ordinary class
 *   minuto   → minuti    the same
 *   giorno   → giorni    the same
 *   ora      → ore       feminine -a → -e
 *   settimana→ settimane the same feminine class
 *
 * Every one of those plurals is *listed*, not left to the analyzer. The fold is
 * what a vocabulary falls back **from**: it carries a `-2` penalty and offers
 * three candidate lemmas for a word ending in -i, only one of which is ever a
 * word, so a form reachable only through it reads back by accident. Rule 5 wants
 * every printed form to be a form the table reads outright, and both rows of
 * every unit below are printed.
 *
 * **The day's symbol is "d" and not "g", and that is a cross-package ruling
 * rather than a preference.** Italian does abbreviate *giorno* as "g" in
 * everyday writing ("consegna in 3 g"), and UNI/SI writes "d" — but the alias
 * index is one flat map with no kind in its key, so a "g" registered here would
 * sit on the same key as `@smartput/mass`'s gram in any engine installing both,
 * which the `@smartput/kinds` barrel does. Between an abbreviation with a rival
 * and one without, the one without wins, and Italian writes "d" too. "g" is
 * therefore neither symbol nor alias here.
 *
 * **The week's symbol drops a full stop for a mechanical reason.** Italian
 * writes the week as "sett.", and that stop cannot ride inside a unit token: it
 * is this language's *group separator* (`Intl.NumberFormat("it")` gives group
 * "."), so "2sett." would print a character the number lexer claims and the alias
 * index cannot. The dotless contraction "sett" is one letter run, one token, and
 * it is listed in `aliases` so the round trip closes — the same trade
 * `@smartput/power/locale/uk` makes for "к.с." → "кс" and `locale/es` here makes
 * for "sem.", and for the same mechanical reason rather than an opinion about
 * orthography.
 *
 * **No accented spelling needs a bare twin.** The Spanish file next door lists
 * "dia" beside "día" because NFKC leaves a precomposed í intact and a keyboard
 * without accents would otherwise reach nothing. Italian's duration words carry
 * no diacritic at all — the accent Italian does use falls on words this kind does
 * not have ("età", "unità") — so there is nothing to double up.
 */
export default defineVocabulary({
  locale: "it",
  kind: "duration",
  units: {
    ms: {
      aliases: [...alias("ms"), "millisecondo", "millisecondi"],
      symbol: "ms",
      forms: { one: "millisecondo", other: "millisecondi" },
    },
    s: {
      // "sec" is the clipped form an Italian writer uses as readily as the
      // symbol, and no analyzer derives it: `pluralFold` substitutes a final
      // vowel and "sec" has none, so without this line the clipping reaches
      // nothing.
      aliases: [...alias("s"), "sec", "secondo", "secondi"],
      symbol: "s",
      forms: { one: "secondo", other: "secondi" },
    },
    min: {
      aliases: [...alias("min"), "minuto", "minuti"],
      symbol: "min",
      forms: { one: "minuto", other: "minuti" },
    },
    h: {
      // "hr"/"hrs" arrive from `units.ts`; the Italian contraction is "h" alone,
      // which is already there too. "ora" and "ore" are the feminine pair — and
      // "ora" is also the ordinary adverb "now", which costs nothing here: a
      // `Candidate` carries its kind, so a word claimed by two readings is two
      // candidates the solver ranks rather than one entry overwriting another.
      aliases: [...alias("h"), "ora", "ore"],
      symbol: "h",
      forms: { one: "ora", other: "ore" },
    },
    d: {
      aliases: [...alias("d"), "giorno", "giorni"],
      symbol: "d",
      forms: { one: "giorno", other: "giorni" },
    },
    wk: {
      aliases: [...alias("wk"), "sett", "settimana", "settimane"],
      symbol: "sett",
      forms: { one: "settimana", other: "settimane" },
    },
  },
});

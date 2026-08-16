import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Italian words for the tempo units.
 *
 * The bare `it` tag, matching the language in `@smartput/core/locale/it`: CLDR's
 * default content for Italian, which is Italy's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a flag
 * here.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `tempo` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the two ratios or the reciprocal bridge to `duration`,
 * and `composeLocale` is where the two halves meet. `aliases` derives the Latin
 * set from `units.ts` rather than retyping it — an Italian musician types "120
 * bpm" as readily as anyone — so the micro path (`parseTempo`) and the engine
 * path agree by construction.
 *
 * **`bpm` keeps no `forms`, for the reason `en.ts` records and one more.** The
 * Italian expansion is "battiti per minuto": three words, and the middle one is
 * already this language's `times` keyword, so a `forms` table here would not
 * merely be prose the lexer cannot reach — its own second token would be read as
 * multiplication. Absent forms keep the renderer on the symbol, so an Italian
 * tempo prints "120bpm", the same tight shape English prints "120bpm" and
 * Ukrainian "120бпм" through.
 *
 * **And, unlike Spanish, Italian adds no second abbreviation.** `locale/es`
 * registers "ppm" beside "bpm" because *pulsaciones por minuto* has a
 * circulating initialism of its own. The Italian expansion abbreviates to the
 * same three letters an Italian would already have typed — a metronome sold in
 * Milan prints BPM, and so does every Italian sequencer, score editor and DJ
 * forum — so there is nothing to add. Inventing "bpm"'s Italian twin would put a
 * word in the index that no input contains.
 *
 * **`hz` is where Italian and Spanish diverge outright, and Italian is the duller
 * of the two.** Spanish coined *hercio* and prints it, so its two rows hold two
 * strings. Italian never coined anything: the unit is *hertz*, borrowed whole,
 * consonant-final and therefore invariant — "un hertz", "due hertz" — because the
 * native plural *substitutes* a final vowel and there is none here to substitute.
 * So both rows hold one string, exactly as `en.ts`'s do and for a related reason
 * (English's "hertz" is its own plural; Italian's is invariant because it is
 * foreign). Both rows are still declared rather than one: an absent `other` would
 * fall back to the symbol, printing "2Hz" beside "1 hertz", one value formatted
 * two ways. The word is already an alias `units.ts` declares, so it reads back
 * with nothing added.
 *
 * The symbol is "Hz", the SI symbol Italian writes unchanged: the registry folds
 * case before indexing, so it and the derived alias "hz" are one key and it reads
 * back as its own unit.
 */
export default defineVocabulary({
  locale: "it",
  kind: "tempo",
  units: {
    bpm: {
      aliases: alias("bpm"),
      symbol: "bpm",
    },
    hz: {
      aliases: alias("hz"),
      symbol: "Hz",
      forms: { one: "hertz", other: "hertz" },
    },
  },
});

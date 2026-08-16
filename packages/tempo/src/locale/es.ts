import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Spanish words for the tempo units.
 *
 * The bare `es` tag, matching the language in `@smartput/core/locale/es`: CLDR's
 * default content for Spanish, which is Spain's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a
 * flag here.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `tempo` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the two ratios or the reciprocal bridge to
 * `duration`, and `composeLocale` is where the two halves meet. `aliases`
 * derives the Latin set from `units.ts` rather than retyping it — a Spanish
 * speaker types "120 bpm" as readily as any translation of it — so the micro
 * path (`parseTempo`) and the engine path agree by construction.
 *
 * **`bpm` keeps no `forms`, for the reason `en.ts` records and one more.** The
 * Spanish expansion is "pulsaciones por minuto": three words, and the middle one
 * is already this language's `times` keyword, so a `forms` table here would not
 * merely be prose the lexer cannot reach — its own second token would be read as
 * multiplication. Absent forms keep the renderer on the symbol, so a Spanish
 * tempo prints "120bpm", the same tight shape English prints "120bpm" and
 * Ukrainian "120бпм" through.
 *
 * The symbol stays "bpm" rather than becoming "ppm", and that is a claim about
 * usage rather than about mechanics — both are single letter runs and either
 * would lex. "BPM" is what Spanish music software, Spanish DJ threads and
 * Spanish sheet-music editors write, borrowed whole from English the way this
 * whole register is; "ppm" is the abbreviation of the Spanish expansion, which
 * is read (a metronome sold in Spain prints it) and rarely written for tempo.
 * So "ppm" is listed as an alias — recognition is many-to-one (I6) — and
 * generation stays on the borrowed one. `@smartput/power/locale/uk` made the
 * opposite call for the opposite reason: there the Latin abbreviation was the
 * only spelling a Ukrainian could type, and here the Spanish one is the spare.
 *
 * **`hz` is where two rows earn their keep.** English needed two *identical*
 * categories, because "hertz" is its own plural; Spanish inflects, so `one` and
 * `other` are genuinely different strings — "1 hercio", "2 hercios". `hercio` is
 * the RAE's Hispanicised spelling, masculine, with the regular -s plural after
 * a vowel; `hertz` (invariant, from `units.ts`) and `hertzio`/`hertzios` are
 * listed beside it because both circulate in Spanish technical prose, and only
 * the RAE's word is ever printed. The symbol is "Hz", the SI symbol Spanish
 * writes unchanged: the registry folds case before indexing, so it and the
 * derived alias "hz" are one key and it reads back as its own unit.
 */
export default defineVocabulary({
  locale: "es",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [...alias("bpm"), "ppm"],
      symbol: "bpm",
    },
    hz: {
      aliases: [...alias("hz"), "hercio", "hercios", "hertzio", "hertzios"],
      symbol: "Hz",
      forms: { one: "hercio", other: "hercios" },
    },
  },
});

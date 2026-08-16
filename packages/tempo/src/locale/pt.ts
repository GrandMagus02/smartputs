import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Portuguese words for the tempo units.
 *
 * The bare `pt` tag, matching the language in `@smartput/core/locale/pt`: this
 * project's ruling is that `pt` means the Brazilian default, which is what the
 * platform resolves it to as well — group ".", decimal ",". Neither word below
 * varies by region.
 *
 * Shaped exactly like `en.ts`, `es.ts` and `uk.ts` beside it, down to naming
 * `tempo` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the two ratios or the reciprocal bridge
 * to `duration`, and `composeLocale` is where the two halves meet. `aliases`
 * derives the Latin set from `units.ts` rather than retyping it — a Portuguese
 * speaker types "120 bpm" as readily as any translation of it — so the micro
 * path (`parseTempo`) and the engine path agree by construction.
 *
 * **`bpm` keeps no `forms`, for the reason `en.ts` records and one more.** The
 * Portuguese expansion is "batidas por minuto" (or "batimentos por minuto", in
 * the clinical register): three words, and the middle one is already this
 * language's `times` keyword, so a `forms` table here would not merely be prose
 * the lexer cannot reach — its own second token would be read as multiplication.
 * Absent forms keep the renderer on the symbol, so a Portuguese tempo prints
 * "120bpm", the same tight shape English prints "120bpm" and Ukrainian "120бпм"
 * through.
 *
 * **And this file adds no alias for it at all**, which is the one pleasant
 * accident in the seven kinds. Spanish had to list "ppm" beside "bpm", because
 * its expansion ("pulsaciones por minuto") abbreviates to different letters than
 * the borrowed English one and both circulate. Portuguese's expansion
 * abbreviates to the *same* three letters — b, p, m — whichever of the two
 * registers it is written in, so the borrowed abbreviation and the native one
 * are the same string and `units.ts` already declares it. Nothing is omitted
 * here; there is simply nothing to add.
 *
 * **`hz` is where Portuguese refuses the move Spanish made.** Spanish
 * Hispanicises the eponym to `hercio` and gets two genuinely different rows out
 * of it ("1 hercio", "2 hercios"); Portuguese keeps "hertz", the physicist's
 * name, and leaves it invariant in both numbers — "1 hertz", "60 hertz" — as it
 * leaves every eponym that ends in a consonant cluster no Portuguese plural
 * ending fits. So the two rows carry the same string, exactly as `en.ts`'s do,
 * and they are present rather than omitted for the reason `en.ts` gives: an
 * absent `other` would fall back to the symbol, and one value would then be
 * formatted two different ways depending on its count. `hertz` is already an
 * alias `units.ts` declares, so the row round-trips without a new line.
 *
 * The symbol is "Hz", the SI symbol Portuguese writes unchanged: the registry
 * folds case before indexing, so it and the derived alias "hz" are one key and
 * it reads back as its own unit.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "tempo",
  units: {
    bpm: { aliases: alias("bpm"), symbol: "bpm" },
    hz: {
      aliases: alias("hz"),
      symbol: "Hz",
      forms: { one: "hertz", other: "hertz" },
    },
  },
});

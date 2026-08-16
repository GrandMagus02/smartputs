import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * French words for the tempo units.
 *
 * The bare `fr` tag, matching the language in `@smartput/core/locale/fr`: CLDR's
 * default content for French, which is metropolitan France's — group U+202F
 * NARROW NO-BREAK SPACE, decimal ",". A regional variant would be a `Language`
 * with an id of its own rather than a flag here.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `tempo` by
 * **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the two ratios or the reciprocal bridge to
 * `duration`, and `composeLocale` is where the two halves meet. `aliases`
 * derives the Latin set from `units.ts` rather than retyping it — a French
 * speaker types "120 bpm" as readily as any translation of it — so the micro
 * path (`parseTempo`) and the engine path agree by construction.
 *
 * **`bpm` keeps no `forms`, for the reason `en.ts` records and one more.** The
 * French expansion is "battements par minute": three words, and the middle one
 * is already this language's `by` keyword (`french.keywords.by` is `["par"]`, so
 * that "multiplié par 5" folds into one operator). A `forms` table here would
 * therefore not merely be prose `parse/lex.ts` cannot reach — its own second
 * token would be swallowed by `foldWordOps` as arithmetic. Absent forms keep the
 * renderer on the symbol, and `french.renderQuantity` spaces it, so a French
 * tempo prints "120 bpm" where English prints "120bpm" tight.
 *
 * The symbol stays the borrowed "bpm" rather than an abbreviation of the French
 * expansion, and that is a claim about usage rather than about mechanics. French
 * has no settled short form of "battements par minute": "btm" and "b/min" both
 * appear in translated manuals, the first in nobody's ear and the second
 * unlexable (a "/" is always an operator). "BPM" is what a French metronome app, a French
 * sheet-music editor and a French DJ forum all write, borrowed whole from
 * English the way this whole register is, so there is nothing to replace it
 * with. `@smartput/power/locale/uk` arrived at the same place for the same
 * reason: sometimes the Latin abbreviation is the only spelling a speaker
 * actually types.
 *
 * **"battement" and "battements" are listed as aliases** even though only the
 * symbol is ever printed, and the elision is deliberate: "cent vingt battements"
 * says a count of beats where the unit is a *rate*, and the per-minute half is
 * dropped exactly as Ukrainian drops it in "уд" and German in "Schläge". A
 * French musician says "à cent vingt", and this is the nearest thing to that a
 * unit token can be. Recognition is many-to-one (I6); generation stays on "bpm".
 *
 * **`hz` is where two rows earn their keep, and French fills them the way
 * English does for a reason English does not have.** English needs two identical
 * rows because "hertz" is its own plural. French needs them because a French
 * noun ending in -s, -x or -z is invariable in the plural — "un hertz", "deux
 * hertz", the same rule that gives "un nez"/"deux nez" — so this is a *French*
 * invariance rather than a borrowed English one, and it is the only unit in this
 * package set whose two rows hold one string. Dropping `other` was the
 * alternative and is wrong for the reason `@smartput/power/locale/en` gives for
 * "horsepower": an absent row falls back to the symbol, so "1 hertz" and "2 Hz"
 * would be the same value formatted two different ways.
 *
 * The symbol is "Hz", the SI symbol French writes unchanged: the registry folds
 * case before indexing, so it and the derived alias "hz" are one key and it
 * reads back as its own unit.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [...alias("bpm"), "battement", "battements"],
      symbol: "bpm",
    },
    hz: {
      // "hertz" is already in `units.ts` and is the same word in French, in both
      // numbers. Nothing to add, and nothing an accent could change.
      aliases: alias("hz"),
      symbol: "Hz",
      forms: { one: "hertz", other: "hertz" },
    },
  },
});

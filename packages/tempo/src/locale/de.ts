import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * German words for the tempo units.
 *
 * The bare `de` tag, matching the language in `@smartput/core/locale/de`: CLDR's
 * default content for German, which is Germany's. Shaped exactly like `en.ts`
 * and `uk.ts` beside it, down to naming `tempo` by **id string** rather than
 * importing the kind: that is what lets this file be imported without linking
 * the ratio table or the reciprocal bridge to `duration`, and it is the seam
 * `composeLocale` closes. `aliases` still derives the Latin set from `units.ts`
 * — a German musician types "120 bpm" and nothing else — and the German
 * spellings are appended.
 *
 * **`bpm` keeps no `forms`, and German has no escape from that either.** `en.ts`
 * refuses them because "beats per minute" is a compound the lexer cannot read
 * back; German's usual answer to an English compound is to close it up, and
 * `@smartput/energy/locale/de` prints `Kilowattstunde` on exactly that strength.
 * It does not work here, because the German phrase is a prepositional one and
 * not a compound at all: "Schläge pro Minute", three words, where `Kilowatt` +
 * `Stunde` was two nouns that could be glued. `parse/lex.ts` builds a unit word
 * out of letters plus trailing digits, so the space ends the token however the
 * phrase is spelled. Absent forms keep the renderer on the symbol.
 *
 * **The symbol is "bpm", and the abbreviation German prints on a metronome is
 * not.** That is "S/min" — Schläge pro Minute — and it carries "/", which lexes
 * as division, so "120 S/min" would reach the resolver as `tempo ÷ duration`, a
 * signature no kind declares and none should. `energy` and `datarate` survive
 * that same shape by making the arithmetic true ("kWh" computes as power ×
 * duration); the escape is closed here because tempo's canonical *is* beats per
 * minute — there is no "beat" kind for `S` to be a quantity of, and `index.ts`
 * declares only the two reciprocal `in` bridges, no `/` at all. So the
 * requirement collapses to one line: the symbol must be a single token that is
 * already an alias. "bpm" is what a German music thread writes, and it is the
 * only spelling that is both. `Schläge` stays alongside it as a second way *in*
 * — the numerator of the abbreviation standing for the whole of it, by the same
 * elision that lets English "bpm" be typed for a tempo — but only "bpm" also
 * comes back out.
 *
 * **`hz` declares all four keys, and all four hold `Hertz`.**
 * `german.selectForm` answers `` `${case}-${category}` `` over {nom, dat} ×
 * {one, other}: case from the slot, because a conversion target is governed by
 * "in"/"nach"/"zu" and German's locative "in" takes the dative, category from
 * `Intl.PluralRules("de")`, which declares exactly two. `das Hertz` is a neuter
 * eponym used as a measure noun, so a numeral holds it in the singular ("50
 * Hertz", exactly as "50 Watt"), its plural is identical to its singular, and
 * German writes the dative plural uninflected too — "die Frequenz in Hertz",
 * never "in Hertzen". Four identical rows are the answer here and not a table
 * that stopped halfway; where the same claim would be vacuous is a file in which
 * *every* unit behaved that way, and `@smartput/duration`'s `Tag` — three
 * different words across these four keys — is the counter-example one package
 * over. This is also where German and English coincide by accident and for
 * different reasons: English needed two rows both spelled "hertz" because the
 * noun is its own plural, German four because the noun is a measure noun.
 *
 * The symbol `Hz` is SI's and is what German writes; it folds onto the derived
 * alias `hz`, which is the mechanism by which a `symbols: true` print parses
 * back.
 */
export default defineVocabulary({
  locale: "de",
  kind: "tempo",
  units: {
    bpm: {
      aliases: [...alias("bpm"), "schlag", "schläge"],
      symbol: "bpm",
    },
    hz: {
      aliases: alias("hz"),
      symbol: "Hz",
      forms: {
        "nom-one": "Hertz",
        "nom-other": "Hertz",
        "dat-one": "Hertz",
        "dat-other": "Hertz",
      },
    },
  },
});

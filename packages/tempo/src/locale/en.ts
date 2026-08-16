import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * English words for the tempo units.
 *
 * The kind next door names no language at all: it is two ratios, two unit ids,
 * the magnitude bands `typical` records, and the reciprocal bridge to
 * `duration` whose operand kinds are named by string. This file is the only
 * place in the package an English word appears.
 *
 * It names `tempo` by **id string** rather than by importing the kind, which is
 * what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/tempo/locale/uk` be imported without linking the ratio table.
 * `composeLocale` is where the two halves meet, at the integrator's own wiring.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseTempo`) and the engine path agree by
 * construction — the cross-path test in `validate.test.ts` depends on exactly
 * that. `symbol` is explicit on both units (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that forgot
 * its symbol would move a byte rather than fail.
 *
 * `bpm` carries no `forms`. "Beats per minute" is a compound the lexer cannot
 * read back, and a written-out name that never parses back is a dead end for
 * completion — the same reason `speed`'s mps and kph carry none. Absent forms
 * keep `formatValue` on the symbol, so a tempo prints as "120bpm". `hz` does
 * declare its two English categories, both spelled "hertz": it is a single word
 * that is also its own plural, and it is already an alias, so it round-trips.
 */
export default defineVocabulary({
  locale: "en",
  kind: "tempo",
  units: {
    bpm: { aliases: alias("bpm"), symbol: "bpm" },
    hz: {
      aliases: alias("hz"),
      symbol: "hz",
      forms: { one: "hertz", other: "hertz" },
    },
  },
});

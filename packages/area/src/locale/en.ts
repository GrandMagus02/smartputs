import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * English words for the area units.
 *
 * The kind next door names no language at all: it is ratios, unit ids, the
 * magnitude bands `typical` records and the `length * length` signature.
 * This file is the only place in the package an English word appears.
 *
 * It names `area` by **id string** rather than by importing the kind, which is
 * what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/area/locale/uk` be imported without linking the ratio table.
 * `composeLocale` is where the two halves meet, at the integrator's own wiring.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseArea`) and the engine path agree by
 * construction — the cross-path test in `validate.test.ts` depends on exactly
 * that. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that
 * forgot its symbol would move a byte rather than fail.
 *
 * The superscript symbols `m²`, `cm²` and `km²` are kept exactly. They are the
 * forms the printer emits and, through `AREA_UNITS.alias`, the forms the lexer
 * reads back — `validate.test.ts` pins the round trip.
 */
export default defineVocabulary({
  locale: "en",
  kind: "area",
  units: {
    // The squared units carry no `forms` for the same reason as the speeds:
    // "square metres" is not a string the parser accepts, so completion would
    // hand back text that fails to evaluate.
    m2: { aliases: alias("m2"), symbol: "m²" },
    cm2: { aliases: alias("cm2"), symbol: "cm²" },
    km2: { aliases: alias("km2"), symbol: "km²" },
    hectare: {
      aliases: alias("hectare"),
      symbol: "ha",
      forms: { one: "hectare", other: "hectares" },
    },
    acre: {
      aliases: alias("acre"),
      symbol: "acre",
      forms: { one: "acre", other: "acres" },
    },
  },
  // Weights are single digits, clamped per kind per mark by `CUE_CEILING`
  // (4) -- see `duration`'s table for the derivation. A cue ranks readings
  // that already exist; none of these can turn a bare number into an area.
  //
  // Nothing here collided with area's own aliases or another kind's, so
  // there is no drop to record. With `BUILTIN_KINDS` alone area has no
  // ambiguous surface, so this table cannot move a ranking today; it is
  // wired into the cue index and goes live once a kind with an overlapping
  // alias ships.
  cues: { floor: 2, plot: 3, garden: 2, surface: 3, covers: 2 },
});

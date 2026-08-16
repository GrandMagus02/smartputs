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
});

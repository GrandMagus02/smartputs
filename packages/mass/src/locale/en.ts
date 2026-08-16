import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * English words for the mass units.
 *
 * The kind next door names no language at all: it is ratios, unit ids and the
 * magnitude bands `typical` records, and nothing a translator would touch.
 * This file is the only place in the package an English word appears.
 *
 * It names `mass` by **id string** rather than by importing the kind, which is
 * what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/mass/locale/uk` be imported without linking the ratio table.
 * `composeLocale` is where the two halves meet, at the integrator's own wiring.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseMass`) and the engine path agree by
 * construction — the cross-path test in `validate.test.ts` depends on exactly
 * that. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that
 * forgot its symbol would move a byte rather than fail.
 *
 * `forms` keys are whatever the composed language's `selectForm` returns. For
 * English that is `Intl.PluralRules`' categories, `one` and `other`; a
 * language with four of them declares four keys here, which is the whole point
 * of a table instead of a `singular`/`plural` pair.
 */
export default defineVocabulary({
  locale: "en",
  kind: "mass",
  units: {
    mg: {
      aliases: alias("mg"),
      symbol: "mg",
      forms: { one: "milligram", other: "milligrams" },
    },
    g: { aliases: alias("g"), symbol: "g", forms: { one: "gram", other: "grams" } },
    kg: {
      aliases: alias("kg"),
      symbol: "kg",
      forms: { one: "kilogram", other: "kilograms" },
    },
    t: { aliases: alias("t"), symbol: "t", forms: { one: "tonne", other: "tonnes" } },
    oz: { aliases: alias("oz"), symbol: "oz", forms: { one: "ounce", other: "ounces" } },
    lb: { aliases: alias("lb"), symbol: "lb", forms: { one: "pound", other: "pounds" } },
  },
});

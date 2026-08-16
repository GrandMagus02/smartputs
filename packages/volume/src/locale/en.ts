import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * English words for the volume units.
 *
 * The kind next door names no language at all: it is ratios, unit ids, the
 * magnitude bands `typical` records and the `area * length` signature. This
 * file is the only place in the package an English word appears.
 *
 * It names `volume` by **id string** rather than by importing the kind, which
 * is what lets a translation ship from someone who is not the kind's author
 * and lets `@smartput/volume/locale/uk` be imported without linking the ratio
 * table. `composeLocale` is where the two halves meet, at the integrator's own
 * wiring.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseVolume`) and the engine path agree by
 * construction — the cross-path test in `validate.test.ts` depends on exactly
 * that. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that
 * forgot its symbol would move a byte rather than fail.
 */
export default defineVocabulary({
  locale: "en",
  kind: "volume",
  units: {
    l: { aliases: alias("l"), symbol: "l", forms: { one: "litre", other: "litres" } },
    ml: {
      aliases: alias("ml"),
      symbol: "ml",
      forms: { one: "millilitre", other: "millilitres" },
    },
    // `m3` carries no `forms`: "cubic metres" is not a string the parser
    // accepts, so a spelled-out form would be text that fails to evaluate.
    // The superscript symbol `m³` is what the printer emits and, through
    // `VOLUME_UNITS.alias`, what the lexer reads back.
    m3: { aliases: alias("m3"), symbol: "m³" },
    gal: {
      aliases: alias("gal"),
      symbol: "gal",
      forms: { one: "gallon", other: "gallons" },
    },
    pint: {
      aliases: alias("pint"),
      symbol: "pint",
      forms: { one: "pint", other: "pints" },
    },
  },
  cues: { pour: 3, bottle: 3, tank: 3, recipe: 2, capacity: 3 },
});

import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * English words for the typographic units.
 *
 * The kind next door names no language at all: it is ratios, unit ids, the one
 * dynamic `px` closure and the magnitude bands `typical` records. `dpiUnit`
 * stays there too — which unit is dpi-relative is a fact about pixels, not
 * about English — so this file is the only place in the package an English
 * word appears.
 *
 * It names `measure` by **id string** rather than by importing the kind, which
 * is what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/measure/locale/uk` be imported without the ratio table.
 * `composeLocale` is where the two halves meet, at the integrator's own wiring.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseMeasure`) and the engine path agree by
 * construction. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that forgot
 * its symbol would move a byte rather than fail.
 *
 * A caller who wants these words in an engine has to ask for them by name.
 * `measure` is outside `BUILTIN_KINDS` — its `mm`/`cm` aliases collide with
 * `length` — so it is absent from `@smartput/kinds/locale/en` for exactly the
 * same reason the kind is absent from the roster.
 */
export default defineVocabulary({
  locale: "en",
  kind: "measure",
  units: {
    inch: {
      aliases: alias("inch"),
      symbol: "inch",
      forms: { one: "inch", other: "inches" },
    },
    mm: {
      aliases: alias("mm"),
      symbol: "mm",
      forms: { one: "millimetre", other: "millimetres" },
    },
    cm: {
      aliases: alias("cm"),
      symbol: "cm",
      forms: { one: "centimetre", other: "centimetres" },
    },
    pt: {
      aliases: alias("pt"),
      symbol: "pt",
      forms: { one: "point", other: "points" },
    },
    pc: {
      aliases: alias("pc"),
      symbol: "pc",
      forms: { one: "pica", other: "picas" },
    },
    px: {
      aliases: alias("px"),
      symbol: "px",
      forms: { one: "pixel", other: "pixels" },
    },
  },
});

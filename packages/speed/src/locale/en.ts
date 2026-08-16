import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { SPEED_UNITS, type SpeedUnit } from "../units";

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/**
 * English words for the speed units.
 *
 * The kind next door names no language at all: it is ratios, unit ids, the
 * magnitude bands `typical` records, and one bridge signature naming its
 * operand kinds by string. This file is the only place in the package an
 * English word appears.
 *
 * It names `speed` by **id string** rather than by importing the kind, which is
 * what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/speed/locale/uk` be imported without linking the ratio table.
 * `composeLocale` is where the two halves meet, at the integrator's own wiring.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseSpeed`) and the engine path agree by
 * construction — the cross-path test in `validate.test.ts` depends on exactly
 * that. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that forgot
 * its symbol would move a byte rather than fail. The symbols are the written
 * ones — `m/s` keeps its slash.
 *
 * `mps`, `kph` and `mph` carry no `forms`: their written-out names ("metres per
 * second", "kilometres per hour") are compounds the lexer cannot read back, and
 * a name that never parses back is a dead end for completion. Absent forms keep
 * `formatValue` on the symbol, so a speed prints as "100kph". `knot` is a
 * single word that does parse back, so it declares its two English categories
 * and prints as "5 knots".
 */
export default defineVocabulary({
  locale: "en",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "kph" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      aliases: alias("knot"),
      symbol: "kt",
      forms: { one: "knot", other: "knots" },
    },
  },
});

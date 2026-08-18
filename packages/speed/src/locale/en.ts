import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
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
 * `formatValue` on the symbol, so a speed prints as "100 km/h". `knot` is a
 * single word that does parse back, so it declares its two English categories
 * and prints as "5 knots".
 *
 * `kph`'s symbol is the written one, `km/h`, which is what every other locale
 * in this directory already wrote and what English readers outside the repo
 * write too; "kph" survives as an alias, so nothing a user types has changed.
 * None of these units declares `tight`: a symbol that is itself a written
 * expression takes a space ("50 km/h", "13.8889 m/s"), exactly as the number
 * before it would if the slash were typed out. `km/h` re-reads as an expression
 * the way `m/s` already does, because the lexer splits on `/`.
 */
export default defineVocabulary({
  locale: "en",
  kind: "speed",
  units: {
    mps: { aliases: alias("mps"), symbol: "m/s" },
    kph: { aliases: alias("kph"), symbol: "km/h" },
    mph: { aliases: alias("mph"), symbol: "mph" },
    knot: {
      aliases: alias("knot"),
      symbol: "kt",
      forms: { one: "knot", other: "knots" },
    },
  },
  // Weights are single digits, clamped per kind per mark by `CUE_CEILING`
  // (4) -- see `duration`'s table for the derivation. A cue ranks readings
  // that already exist; none of these can turn a bare number into a speed.
  //
  // `speed` itself was checked against this kind's own unit aliases (`mps`,
  // `kph`, `kmh`, `mph`, `knot`, `knots`, `kt`) and kept -- the apparent
  // collision a grep turns up is the kind id, `kind: "speed"`, not a unit
  // alias. With `BUILTIN_KINDS` alone speed has no ambiguous surface, so this
  // table cannot move a ranking today; it goes live once a kind with an
  // overlapping alias ships.
  cues: { speed: 4, fast: 3, limit: 2, driving: 2, wind: 2, pace: 2 },
});

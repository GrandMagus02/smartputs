import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * English words for the angle units.
 *
 * The kind next door names no language at all: it is ratios, unit ids and the
 * magnitude bands `typical` records. This file is the only place in the package
 * an English word appears.
 *
 * It names `angle` by **id string** rather than by importing the kind, which is
 * what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/angle/locale/uk` be imported without linking the ratio table.
 *
 * Aliases are derived, never restated: `units.ts` is the one place a new alias
 * is added, and it reaches both the engine and the micro path. `symbol` is
 * explicit on every unit (ruling R8): the renderer's no-symbol branch joins
 * number and unit without a space, so a unit that forgot its symbol would move
 * a byte rather than fail.
 *
 * `forms` keys are whatever the composed language's `selectForm` returns — for
 * English, `Intl.PluralRules`' `one` and `other`.
 */
export default defineVocabulary({
  locale: "en",
  kind: "angle",
  units: {
    rad: {
      aliases: alias("rad"),
      symbol: "rad",
      forms: { one: "radian", other: "radians" },
    },
    deg: {
      aliases: alias("deg"),
      symbol: "deg",
      forms: { one: "degree", other: "degrees" },
    },
    grad: {
      aliases: alias("grad"),
      symbol: "grad",
      forms: { one: "gradian", other: "gradians" },
    },
    turn: {
      aliases: alias("turn"),
      symbol: "turn",
      forms: { one: "turn", other: "turns" },
    },
  },
});

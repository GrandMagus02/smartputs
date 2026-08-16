import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * English words for the duration units.
 *
 * The kind next door names no language at all: it is ratios, unit ids and the
 * magnitude bands `typical` records. This file is the only place in the
 * package an English word appears.
 *
 * It names `duration` by **id string** rather than by importing the kind, so a
 * translation can ship from someone who is not the kind's author and
 * `@smartput/duration/locale/uk` can be imported without linking the ratio
 * table. `composeLocale` is where the two halves meet.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseDuration`) and the engine path agree by
 * construction. That is also where `"m"` means minutes rather than metres:
 * the ambiguity is the solver's to rank, not this file's to remove.
 * `symbol` is explicit on every unit (ruling R8), because the renderer's
 * no-symbol branch joins number and unit without a space and a forgotten
 * symbol would move a byte rather than fail.
 */
export default defineVocabulary({
  locale: "en",
  kind: "duration",
  units: {
    ms: {
      aliases: alias("ms"),
      symbol: "ms",
      forms: { one: "millisecond", other: "milliseconds" },
    },
    s: { aliases: alias("s"), symbol: "s", forms: { one: "second", other: "seconds" } },
    min: {
      aliases: alias("min"),
      symbol: "min",
      forms: { one: "minute", other: "minutes" },
    },
    h: { aliases: alias("h"), symbol: "h", forms: { one: "hour", other: "hours" } },
    d: { aliases: alias("d"), symbol: "d", forms: { one: "day", other: "days" } },
    wk: { aliases: alias("wk"), symbol: "wk", forms: { one: "week", other: "weeks" } },
  },
  cues: {
    in: 3,
    within: 3,
    after: 2,
    ago: 3,
    wait: 3,
    takes: 2,
    lasts: 3,
    late: 2,
    early: 2,
    delay: 3,
    every: 1,
    time: 2,
    spent: 2,
  },
});

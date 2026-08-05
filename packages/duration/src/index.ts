import { aliasesFor, decimalRatios, defineKind } from "@smartput/core";
import { DURATION_UNITS, type DurationUnit } from "./units";

export type { DurationUnit } from "./units";
export { DURATION_UNITS } from "./units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

export const duration = defineKind({
  id: "duration",
  value: {
    mode: "ratio",
    canonical: DURATION_UNITS.canonical,
    units: decimalRatios(DURATION_UNITS),
  },
  lexicon: {
    ms: {
      aliases: alias("ms"),
      symbol: "ms",
      display: { one: "millisecond", other: "milliseconds" },
      typical: [1, 5000],
    },
    s: {
      aliases: alias("s"),
      symbol: "s",
      display: { one: "second", other: "seconds" },
      typical: [1, 300],
    },
    min: {
      aliases: alias("min"),
      symbol: "min",
      display: { one: "minute", other: "minutes" },
      typical: [1, 180],
    },
    h: {
      aliases: alias("h"),
      symbol: "h",
      display: { one: "hour", other: "hours" },
      typical: [1, 72],
    },
    d: {
      aliases: alias("d"),
      symbol: "d",
      display: { one: "day", other: "days" },
      typical: [1, 90],
    },
    wk: {
      aliases: alias("wk"),
      symbol: "wk",
      display: { one: "week", other: "weeks" },
      typical: [1, 52],
    },
  },
});

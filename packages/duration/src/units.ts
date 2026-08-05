import type { UnitTable } from "@smartput/validate";

export type DurationUnit = "ms" | "s" | "min" | "h" | "d" | "wk";

/**
 * The single source of duration's ratios and English aliases. The kind
 * descriptor widens these strings to `Decimal`; the micro path coerces them
 * with `Number()`. Neither owns them.
 *
 * All six ratios are exact in decimal (they are SI-second multiples), so
 * each is just the literal that used to live in `index.ts`, stringified.
 *
 * `"m"` means minutes here and metres in `length`. In the engine that is a
 * genuine ambiguity the solver ranks; in the micro path `parseDuration` and
 * `parseLength` are two functions that were called deliberately, so neither
 * is ambiguous.
 */
export const DURATION_UNITS: UnitTable<DurationUnit> = {
  canonical: "s",
  ratio: {
    ms: "0.001",
    s: "1",
    min: "60",
    h: "3600",
    d: "86400",
    wk: "604800",
  },
  alias: {
    ms: "ms",
    millisecond: "ms",
    milliseconds: "ms",
    s: "s",
    sec: "s",
    secs: "s",
    second: "s",
    seconds: "s",
    min: "min",
    mins: "min",
    m: "min",
    minute: "min",
    minutes: "min",
    h: "h",
    hr: "h",
    hrs: "h",
    hour: "h",
    hours: "h",
    d: "d",
    day: "d",
    days: "d",
    wk: "wk",
    wks: "wk",
    week: "wk",
    weeks: "wk",
  },
};

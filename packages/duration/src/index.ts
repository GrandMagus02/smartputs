import { decimalRatios, defineKind } from "@smartput/kind";
import { DURATION_UNITS } from "./units";

export type { DurationUnit } from "./units";
export { DURATION_UNITS } from "./units";

export const duration = defineKind({
  id: "duration",
  value: {
    mode: "ratio",
    canonical: DURATION_UNITS.canonical,
    units: decimalRatios(DURATION_UNITS),
  },
  // "1 h 30 min", "1h30m", "1 h 30 min 30 s" — a stopwatch reading and a
  // cooking time, written the way everyone writes them. Two adjacent durations
  // in strictly descending units are a sum the writer left the `+` out of, and
  // `parse/pratt.ts` puts it back; the ordinary `+` signature below prices the
  // result, so nothing here changes except that the input now parses.
  compound: true,
  // Physics, not language (spec §4): the magnitude band people type each unit
  // in, read only by completion's `scaleFit`.
  typical: {
    ms: [1, 5000],
    s: [1, 300],
    min: [1, 180],
    h: [1, 72],
    d: [1, 90],
    wk: [1, 52],
  },
});

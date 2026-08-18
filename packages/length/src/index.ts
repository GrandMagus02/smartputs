import { decimalRatios, defineKind } from "@smartput/kind";
import { LENGTH_UNITS } from "./units";

export type { LengthUnit } from "./units";
export { LENGTH_UNITS } from "./units";

export const length = defineKind({
  id: "length",
  value: {
    mode: "ratio",
    canonical: LENGTH_UNITS.canonical,
    units: decimalRatios(LENGTH_UNITS),
  },
  // "5 ft 3 inches", "1 m 50 cm" — a person's height, and the way a tape
  // measure is read out loud. Two adjacent lengths in strictly descending units
  // fold into the sum the writer left the `+` out of.
  //
  // The symbol spelling, "5 ft 3 in", does not reach it yet: `in` is core's
  // conversion keyword and `./locale/en`'s `RESERVED` deliberately withholds it
  // from the alias index, so ruling R-B1's re-lex in `lex.ts` has no unit to
  // re-lex to. Spelled out, it folds today.
  compound: true,
  // Physics, not language (ruling R3): the magnitude band people type each unit
  // in, read only by completion's `scaleFit`.
  typical: {
    mm: [1, 1000],
    cm: [1, 300],
    m: [1, 1000],
    km: [1, 1000],
    in: [1, 120],
    ft: [1, 500],
    yd: [1, 500],
    mi: [0.1, 500],
  },
});

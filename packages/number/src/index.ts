import { decimalRatios, defineKind } from "@smartput/core";
import { NUMBER_UNITS } from "./units";

export type { NumberUnit } from "./units";
export { NUMBER_UNITS } from "./units";
// `NUMBER_WORDS`, `numberFromWords` and `spellNumber` used to be re-exported
// here. They are English grammar rather than anything a number *is*, so they
// ship from `@smartput/locale-en` now — beside the cardinal table they always
// read — and this package names no language at all.

// The whole kind: a ratio of 1 and an id. The words for its one unit — such
// as they are — live in `src/locale/en.ts`, and no unit here has a `typical`
// band because completion has nothing to fit a bare number against.
export const number = defineKind({
  id: "number",
  value: {
    mode: "ratio",
    canonical: NUMBER_UNITS.canonical,
    units: decimalRatios(NUMBER_UNITS),
  },
});

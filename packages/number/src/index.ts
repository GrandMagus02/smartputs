import { decimalRatios, defineKind } from "@smartput/core";
import { NUMBER_UNITS } from "./units";

export type { NumberUnit } from "./units";
export { NUMBER_UNITS } from "./units";
// Numbers as they are said, in both directions. The kind below is what a
// number *is*; these are what it is called — kept together because reading
// "one hundred and five" and spelling 105 are one vocabulary.
export type { NumberWords } from "./words";
export { NUMBER_WORDS, numberFromWords, spellNumber } from "./words";

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

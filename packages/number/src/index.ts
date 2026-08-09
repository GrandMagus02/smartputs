import { decimalRatios, defineKind } from "@smartput/core";
import { NUMBER_UNITS } from "./units";

export type { NumberUnit } from "./units";
export { NUMBER_UNITS } from "./units";
// Numbers as they are said, in both directions. They sit beside the kind whose
// unit is one rather than in a package of their own: `spellNumber` reads the
// English cardinal table, and the one consumer that needs a *language* — the
// `Language.spell` a Printer calls — is served by `cardinalSpeller` in core
// from the same tables, so nothing here is the language's only copy.
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

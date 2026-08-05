import { aliasesFor, decimalRatios, defineKind } from "@smartput/core";
import { NUMBER_UNITS, type NumberUnit } from "./units";

export type { NumberUnit } from "./units";
export { NUMBER_UNITS } from "./units";
// Numbers as they are said, in both directions. The kind below is what a
// number *is*; these are what it is called — kept together because reading
// "one hundred and five" and spelling 105 are one vocabulary.
export type { NumberWords } from "./words";
export { NUMBER_WORDS, numberFromWords, spellNumber } from "./words";

const alias = (unit: NumberUnit) => aliasesFor(NUMBER_UNITS, unit);

export const number = defineKind({
  id: "number",
  value: {
    mode: "ratio",
    canonical: NUMBER_UNITS.canonical,
    units: decimalRatios(NUMBER_UNITS),
  },
  // `alias("one")` derives to `["one"]` — the table's mandatory self-alias,
  // not a spelling anyone types. The engine still needs a lexicon entry (a
  // bare numeral is matched by `cardinalNumerals`, not by this word), so an
  // empty `symbol` and the derived one-element aliases array reproduce the
  // original hand-written `{ aliases: [], symbol: "" }` in every way that
  // matters — nothing in the corpus or the analyzer ever typed "one" as a
  // unit word for this kind, so the added self-alias is inert there.
  lexicon: { one: { aliases: alias("one"), symbol: "" } },
});

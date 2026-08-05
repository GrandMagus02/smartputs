import { defineKind } from "@smartput/core";

// Numbers as they are said, in both directions. The kind below is what a
// number *is*; these are what it is called — kept together because reading
// "one hundred and five" and spelling 105 are one vocabulary.
export type { NumberWords } from "./words";
export { NUMBER_WORDS, numberFromWords, spellNumber } from "./words";

export const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
  lexicon: { one: { aliases: [], symbol: "" } },
});

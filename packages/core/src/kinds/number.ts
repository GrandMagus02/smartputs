import { defineKind } from "../kind/define";

export const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
  lexicon: { one: { aliases: [], symbol: "" } },
});

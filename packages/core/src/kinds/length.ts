import { defineKind } from "../kind/define";

export const length = defineKind({
  id: "length",
  value: {
    mode: "ratio",
    canonical: "m",
    units: {
      mm: 0.001,
      cm: 0.01,
      m: 1,
      km: 1000,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mi: 1609.344,
    },
  },
  lexicon: {
    mm: { aliases: ["mm", "millimetre", "millimeter"], symbol: "mm" },
    cm: { aliases: ["cm", "centimetre", "centimeter"], symbol: "cm" },
    m: { aliases: ["m", "metre", "meter"], symbol: "m" },
    km: { aliases: ["km", "kilometre", "kilometer"], symbol: "km" },
    in: { aliases: ["inch"], symbol: "in" },
    ft: { aliases: ["ft", "foot", "feet"], symbol: "ft" },
    yd: { aliases: ["yd", "yard"], symbol: "yd" },
    mi: { aliases: ["mi", "mile"], symbol: "mi" },
  },
});

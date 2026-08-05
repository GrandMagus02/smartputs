import { defineKind } from "@smartput/core";

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
    mm: {
      aliases: ["mm", "millimetre", "millimeter"],
      symbol: "mm",
      display: { one: "millimetre", other: "millimetres" },
      typical: [1, 1000],
    },
    cm: {
      aliases: ["cm", "centimetre", "centimeter"],
      symbol: "cm",
      display: { one: "centimetre", other: "centimetres" },
      typical: [1, 300],
    },
    m: {
      aliases: ["m", "metre", "meter"],
      symbol: "m",
      display: { one: "metre", other: "metres" },
      typical: [1, 1000],
    },
    km: {
      aliases: ["km", "kilometre", "kilometer"],
      symbol: "km",
      display: { one: "kilometre", other: "kilometres" },
      typical: [1, 1000],
    },
    in: {
      aliases: ["inch"],
      symbol: "in",
      display: { one: "inch", other: "inches" },
      typical: [1, 120],
    },
    ft: {
      aliases: ["ft", "foot", "feet"],
      symbol: "ft",
      display: { one: "foot", other: "feet" },
      typical: [1, 500],
    },
    yd: {
      aliases: ["yd", "yard"],
      symbol: "yd",
      display: { one: "yard", other: "yards" },
      typical: [1, 500],
    },
    mi: {
      aliases: ["mi", "mile"],
      symbol: "mi",
      display: { one: "mile", other: "miles" },
      typical: [0.1, 500],
    },
  },
});

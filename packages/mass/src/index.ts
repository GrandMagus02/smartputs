import { defineKind } from "@smartput/core";

export const mass = defineKind({
  id: "mass",
  value: {
    mode: "ratio",
    canonical: "g",
    units: { mg: 0.001, g: 1, kg: 1000, t: 1e6, oz: 28.349523125, lb: 453.59237 },
  },
  lexicon: {
    mg: {
      aliases: ["mg", "milligram"],
      symbol: "mg",
      display: { one: "milligram", other: "milligrams" },
      typical: [1, 2000],
    },
    g: {
      aliases: ["g", "gram"],
      symbol: "g",
      display: { one: "gram", other: "grams" },
      typical: [1, 1000],
    },
    kg: {
      aliases: ["kg", "kilo", "kilogram"],
      symbol: "kg",
      display: { one: "kilogram", other: "kilograms" },
      typical: [0.1, 500],
    },
    t: {
      aliases: ["t", "tonne"],
      symbol: "t",
      display: { one: "tonne", other: "tonnes" },
      typical: [0.1, 200],
    },
    oz: {
      aliases: ["oz", "ounce"],
      symbol: "oz",
      display: { one: "ounce", other: "ounces" },
      typical: [0.5, 100],
    },
    lb: {
      aliases: ["lb", "lbs", "pound"],
      symbol: "lb",
      display: { one: "pound", other: "pounds" },
      typical: [0.5, 500],
    },
  },
});

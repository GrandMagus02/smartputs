import { defineKind } from "../kind/define";

export const mass = defineKind({
  id: "mass",
  value: {
    mode: "ratio",
    canonical: "g",
    units: { mg: 0.001, g: 1, kg: 1000, t: 1e6, oz: 28.349523125, lb: 453.59237 },
  },
  lexicon: {
    mg: { aliases: ["mg", "milligram"], symbol: "mg" },
    g: { aliases: ["g", "gram"], symbol: "g" },
    kg: {
      aliases: ["kg", "kilo", "kilogram"],
      symbol: "kg",
      display: { one: "kilogram", other: "kilograms" },
    },
    t: { aliases: ["t", "tonne"], symbol: "t" },
    oz: { aliases: ["oz", "ounce"], symbol: "oz" },
    lb: { aliases: ["lb", "lbs", "pound"], symbol: "lb" },
  },
});

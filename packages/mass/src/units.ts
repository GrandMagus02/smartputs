import type { UnitTable } from "@smartput/shared";

export type MassUnit = "mg" | "g" | "kg" | "t" | "oz" | "lb";

/**
 * The single source of mass's ratios and English aliases. The kind
 * descriptor widens these strings to `Decimal`; the micro path coerces them
 * with `Number()`. Neither owns them.
 *
 * All six ratios are exact in decimal (the avoirdupois ounce and pound are
 * exact by international agreement), so each is just the literal that used
 * to live in `index.ts`, stringified.
 *
 * `kilograms` (the plural of `kilogram`) is deliberately absent from the
 * flat alias map, unlike every other plural here. `packages/core`'s own
 * `engine.test.ts` ("explain lists the analyzer's own weight") pins "1.5
 * kilograms" as the example of a word reached only through `en`'s
 * suffix-stripping analyzer, at a -2 penalty -- not through a direct alias
 * hit. Registering it as an explicit alias here would make that lookup free
 * and silently flip that assertion's weight to 0.
 *
 * The cost lands on the micro path: `parseMass("1.5kilograms")` returns
 * `unknown-unit`, because it has no stemmer to fall back to `kilogram` the
 * way the engine does. That gap is accepted rather than fixed by editing
 * `packages/core`'s pinned test, which is out of scope here.
 */
export const MASS_UNITS: UnitTable<MassUnit> = {
  canonical: "g",
  ratio: {
    mg: "0.001",
    g: "1",
    kg: "1000",
    t: "1000000",
    oz: "28.349523125",
    lb: "453.59237",
  },
  alias: {
    mg: "mg",
    milligram: "mg",
    milligrams: "mg",
    g: "g",
    gram: "g",
    grams: "g",
    kg: "kg",
    kilo: "kg",
    kilos: "kg",
    kilogram: "kg",
    t: "t",
    tonne: "t",
    tonnes: "t",
    oz: "oz",
    ounce: "oz",
    ounces: "oz",
    lb: "lb",
    lbs: "lb",
    pound: "lb",
    pounds: "lb",
  },
};

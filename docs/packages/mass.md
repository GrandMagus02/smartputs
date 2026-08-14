---
title: "@smartput/mass"
description: "Milligram to ton, with the imperial pounds and ounces."
---

# @smartput/mass

Metric and avoirdupois in one table, canonical in grams.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="mass" model-value="500 g" :switchable="false" />

<SpUnitCombobox kind="mass" model-value="500 g" />

<SpEvaluate
  model-value="1 kg + 500 g"
  :examples="['1 kg + 500 g', '3 lbs', '2 t in kg', '16 oz']" />

## Installing

```sh
npm add @smartput/mass
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/mass` | The package root. |
| `@smartput/mass/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/mass/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/mass/class` | The immutable value class. |
| `@smartput/mass/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/mass/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### MASS_UNITS

| Unit | Ratio to `g` | Aliases |
| --- | --- | --- |
| `g` | `1` | `g` `gram` `grams` |
| `mg` | `0.001` | `mg` `milligram` `milligrams` |
| `kg` | `1000` | `kg` `kilo` `kilos` `kilogram` |
| `t` | `1000000` | `t` `tonne` `tonnes` |
| `oz` | `28.349523125` | `oz` `ounce` `ounces` |
| `lb` | `453.59237` | `lb` `lbs` `pound` `pounds` |

## Runtime exports

Type-only exports are erased and do not appear here.

`MASS_UNITS` · `mass`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| mass/validate parseMass only | ≤ 1.4 kB | ≤ 750 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


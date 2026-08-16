---
title: "@smartput/energy"
description: "Joule, calorie, watt-hour, electronvolt."
---

# @smartput/energy

Canonical in joules.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="energy" model-value="2 kWh" :switchable="false" />

<SpUnitCombobox kind="energy" model-value="2 kWh" />

<SpEvaluate
  model-value="1 kWh in J"
  :examples="['1 kWh in J', '2000 cal in kcal', '1 kJ + 500 J']" />

## Installing

```sh
npm add @smartput/energy
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/energy` | The package root. |
| `@smartput/energy/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/energy/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/energy/class` | The immutable value class. |
| `@smartput/energy/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/energy/locale/de` | See the source for what this subpath carries. |
| `@smartput/energy/locale/fr` | See the source for what this subpath carries. |
| `@smartput/energy/locale/es` | See the source for what this subpath carries. |
| `@smartput/energy/locale/pt` | See the source for what this subpath carries. |
| `@smartput/energy/locale/it` | See the source for what this subpath carries. |
| `@smartput/energy/locale/nl` | See the source for what this subpath carries. |
| `@smartput/energy/locale/zh` | See the source for what this subpath carries. |
| `@smartput/energy/locale/ja` | See the source for what this subpath carries. |
| `@smartput/energy/locale/ar` | See the source for what this subpath carries. |
| `@smartput/energy/locale/ru` | See the source for what this subpath carries. |
| `@smartput/energy/locale/pl` | See the source for what this subpath carries. |
| `@smartput/energy/locale/tr` | See the source for what this subpath carries. |
| `@smartput/energy/locale/hi` | See the source for what this subpath carries. |
| `@smartput/energy/locale/ko` | See the source for what this subpath carries. |
| `@smartput/energy/locale/id` | See the source for what this subpath carries. |
| `@smartput/energy/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### ENERGY_UNITS

| Unit | Ratio to `j` | Aliases |
| --- | --- | --- |
| `j` | `1` | `j` `joule` `joules` |
| `kj` | `1000` | `kj` `kilojoule` `kilojoules` |
| `mj` | `1000000` | `mj` `megajoule` `megajoules` |
| `wh` | `3600` | `wh` |
| `kwh` | `3600000` | `kwh` |
| `mwh` | `3600000000` | `mwh` |
| `cal` | `4.184` | `cal` `calorie` `calories` |
| `kcal` | `4184` | `kcal` `kilocalorie` `kilocalories` |
| `btu` | `1055.05585262` | `btu` `btus` |

## Runtime exports

Type-only exports are erased and do not appear here.

`ENERGY_UNITS` · `energy`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| energy/validate parseEnergy only | ≤ 1.4 kB | ≤ 750 B |
| energy/class | ≤ 4.8 kB | ≤ 1.9 kB |

## Dependencies

- [`@smartput/kind`](/packages/kind)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


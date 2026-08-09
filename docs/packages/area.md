---
title: "@smartput/area"
description: "Square metres, hectares, acres."
---

# @smartput/area

Canonical in square metres.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="area" model-value="40 m2" :switchable="false" />

<SpUnitCombobox kind="area" model-value="40 m2" />

<SpEvaluate
  model-value="1 ha in m2"
  :examples="['1 ha in m2', '40 m2 + 5 m2', '2 acre in ha']" />

## Installing

```sh
npm add @smartput/area
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/area` | The package root. |
| `@smartput/area/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/area/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/area/class` | The immutable value class. |
| `@smartput/area/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/area/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### AREA_UNITS

| Unit | Ratio to `m2` | Aliases |
| --- | --- | --- |
| `m2` | `1` | `m2` `m²` `sqm` |
| `cm2` | `0.0001` | `cm2` `cm²` `sqcm` |
| `km2` | `1000000` | `km2` `km²` `sqkm` |
| `hectare` | `10000` | `ha` `hectare` `hectares` |
| `acre` | `4046.8564224` | `acre` `acres` |

## Runtime exports

Type-only exports are erased and do not appear here.

`AREA_UNITS` · `area`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| area/validate parseArea only | ≤ 1.4 kB | ≤ 700 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


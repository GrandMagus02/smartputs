---
title: "@smartput/volume"
description: "Litres, millilitres, cubic metres, and the two gallons."
---

# @smartput/volume

Canonical in litres. US and imperial gallons are separate units, never aliases.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="volume" model-value="1.5 l" :switchable="false" />

<SpUnitCombobox kind="volume" model-value="1.5 l" />

<SpEvaluate
  model-value="1 m3 in l"
  :examples="['1 m3 in l', '500 ml + 1 l', '2 gal in l']" />

## Installing

```sh
npm add @smartput/volume
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/volume` | The package root. |
| `@smartput/volume/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/volume/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/volume/class` | The immutable value class. |
| `@smartput/volume/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/volume/locale/de` | See the source for what this subpath carries. |
| `@smartput/volume/locale/fr` | See the source for what this subpath carries. |
| `@smartput/volume/locale/es` | See the source for what this subpath carries. |
| `@smartput/volume/locale/pt` | See the source for what this subpath carries. |
| `@smartput/volume/locale/it` | See the source for what this subpath carries. |
| `@smartput/volume/locale/nl` | See the source for what this subpath carries. |
| `@smartput/volume/locale/zh` | See the source for what this subpath carries. |
| `@smartput/volume/locale/ja` | See the source for what this subpath carries. |
| `@smartput/volume/locale/ar` | See the source for what this subpath carries. |
| `@smartput/volume/locale/ru` | See the source for what this subpath carries. |
| `@smartput/volume/locale/pl` | See the source for what this subpath carries. |
| `@smartput/volume/locale/tr` | See the source for what this subpath carries. |
| `@smartput/volume/locale/hi` | See the source for what this subpath carries. |
| `@smartput/volume/locale/ko` | See the source for what this subpath carries. |
| `@smartput/volume/locale/id` | See the source for what this subpath carries. |
| `@smartput/volume/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### VOLUME_UNITS

| Unit | Ratio to `l` | Aliases |
| --- | --- | --- |
| `l` | `1` | `l` `liter` `litre` `liters` `litres` |
| `ml` | `0.001` | `ml` `milliliter` `millilitre` `milliliters` `millilitres` |
| `m3` | `1000` | `m3` `m³` |
| `gal` | `3.785411784` | `gal` `gallon` `gallons` |
| `pint` | `0.473176473` | `pint` `pints` |

## Runtime exports

Type-only exports are erased and do not appear here.

`VOLUME_UNITS` · `volume`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| volume/validate parseVolume only | ≤ 1.4 kB | ≤ 750 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


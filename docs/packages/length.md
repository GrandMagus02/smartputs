---
title: "@smartput/length"
description: "Millimetre to mile, exact in decimal."
---

# @smartput/length

Eight units and thirty-two aliases. Every ratio is exact in decimal —
the imperial ones by definition of the international yard and pound agreement —
so no conversion in this table rounds.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="length" model-value="12 cm" :switchable="false" />

<SpUnitCombobox kind="length" model-value="12 cm" />

<SpEvaluate
  model-value="2 km in m"
  :examples="['2 km in m', '12 inch', '1 mi + 500 m', '3 ft']" />

## Installing

```sh
npm add @smartput/length
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/length` | The package root. |
| `@smartput/length/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/length/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/length/class` | The immutable value class. |
| `@smartput/length/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/length/locale/de` | See the source for what this subpath carries. |
| `@smartput/length/locale/fr` | See the source for what this subpath carries. |
| `@smartput/length/locale/es` | See the source for what this subpath carries. |
| `@smartput/length/locale/pt` | See the source for what this subpath carries. |
| `@smartput/length/locale/it` | See the source for what this subpath carries. |
| `@smartput/length/locale/nl` | See the source for what this subpath carries. |
| `@smartput/length/locale/zh` | See the source for what this subpath carries. |
| `@smartput/length/locale/ja` | See the source for what this subpath carries. |
| `@smartput/length/locale/ar` | See the source for what this subpath carries. |
| `@smartput/length/locale/ru` | See the source for what this subpath carries. |
| `@smartput/length/locale/pl` | See the source for what this subpath carries. |
| `@smartput/length/locale/tr` | See the source for what this subpath carries. |
| `@smartput/length/locale/hi` | See the source for what this subpath carries. |
| `@smartput/length/locale/ko` | See the source for what this subpath carries. |
| `@smartput/length/locale/id` | See the source for what this subpath carries. |
| `@smartput/length/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### LENGTH_UNITS

| Unit | Ratio to `m` | Aliases |
| --- | --- | --- |
| `m` | `1` | `m` `meter` `metre` `meters` `metres` |
| `mm` | `0.001` | `mm` `millimeter` `millimetre` `millimeters` `millimetres` |
| `cm` | `0.01` | `cm` `centimeter` `centimetre` `centimeters` `centimetres` |
| `km` | `1000` | `km` `kilometer` `kilometre` `kilometers` `kilometres` |
| `in` | `0.0254` | `in` `inch` `inches` |
| `ft` | `0.3048` | `ft` `feet` `foot` |
| `yd` | `0.9144` | `yd` `yard` `yards` |
| `mi` | `1609.344` | `mi` `mile` `miles` |

## Runtime exports

Type-only exports are erased and do not appear here.

`LENGTH_UNITS` · `length`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| length/validate parseLength only | ≤ 1.6 kB | ≤ 800 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


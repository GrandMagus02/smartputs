---
title: "@smartput/measure"
description: "Typographic units: point, pica, em, pixel."
---

# @smartput/measure

Not in `BUILTIN_KINDS`: its `mm` and `cm` mean the same lengths but
belong to a different kind, and registering both makes every `12 cm`
ambiguous. `px` is the one ratio in the repo that is a function rather than a
constant — it reads `dpi` off the parse context.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="measure" model-value="12 pt" :switchable="false" />

<SpUnitCombobox kind="measure" model-value="12 pt" />

<SpEvaluate
  model-value="12 pt in mm"
  :examples="['12 pt in mm', '1 pc in pt', '72 pt in inch']" />

## Installing

```sh
npm add @smartput/measure
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/measure` | The package root. |
| `@smartput/measure/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/measure/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/measure/class` | The immutable value class. |
| `@smartput/measure/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/measure/locale/de` | See the source for what this subpath carries. |
| `@smartput/measure/locale/fr` | See the source for what this subpath carries. |
| `@smartput/measure/locale/es` | See the source for what this subpath carries. |
| `@smartput/measure/locale/pt` | See the source for what this subpath carries. |
| `@smartput/measure/locale/it` | See the source for what this subpath carries. |
| `@smartput/measure/locale/nl` | See the source for what this subpath carries. |
| `@smartput/measure/locale/zh` | See the source for what this subpath carries. |
| `@smartput/measure/locale/ja` | See the source for what this subpath carries. |
| `@smartput/measure/locale/ar` | See the source for what this subpath carries. |
| `@smartput/measure/locale/ru` | See the source for what this subpath carries. |
| `@smartput/measure/locale/pl` | See the source for what this subpath carries. |
| `@smartput/measure/locale/tr` | See the source for what this subpath carries. |
| `@smartput/measure/locale/hi` | See the source for what this subpath carries. |
| `@smartput/measure/locale/ko` | See the source for what this subpath carries. |
| `@smartput/measure/locale/id` | See the source for what this subpath carries. |
| `@smartput/measure/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### MEASURE_UNITS

| Unit | Ratio to `inch` | Aliases |
| --- | --- | --- |
| `inch` | `1` | `inch` `inches` |
| `mm` | `0.0393700787401574803149606299213` | `mm` `millimeter` `millimetre` `millimeters` `millimetres` |
| `cm` | `0.393700787401574803149606299213` | `cm` `centimeter` `centimetre` `centimeters` `centimetres` |
| `pt` | `0.0138888888888888888888888888889` | `pt` `point` `points` |
| `pc` | `0.166666666666666666666666666667` | `pc` `pica` `picas` |
| `px` | *f(ctx)* | `px` `pixel` `pixels` |

## Runtime exports

Type-only exports are erased and do not appear here.

`DEFAULT_DPI` · `MEASURE_UNITS` · `measure`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| measure/validate parseMeasure only | ≤ 1.6 kB | ≤ 800 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


---
title: "@smartput/temperature"
description: "Celsius, Fahrenheit, Kelvin — plus the delta kind beside them."
---

# @smartput/temperature

Two kinds in one package. `temperature` is affine — `canonical = (value +
offset) * ratio` — and `tempdelta` is the same ratios with the offsets
dropped, because "a difference of 5 °C" and "5 °C" are not the same quantity and
adding them as if they were is the classic bug this split exists to make
impossible.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="temperature" model-value="21 °C" :switchable="false" />

<SpUnitCombobox kind="temperature" model-value="21 °C" />

<SpEvaluate
  model-value="212 F in C"
  :examples="['212 F in C', '0 C in K', '21 C in F']" />

## Installing

```sh
npm add @smartput/temperature
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/temperature` | The package root. |
| `@smartput/temperature/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/temperature/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/temperature/class` | The immutable value class. |
| `@smartput/temperature/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/temperature/locale/de` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/fr` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/es` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/pt` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/it` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/nl` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/zh` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/ja` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/ar` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/ru` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/pl` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/tr` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/hi` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/ko` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/id` | See the source for what this subpath carries. |
| `@smartput/temperature/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### TEMPDELTA_UNITS

| Unit | Ratio to `c` | Aliases |
| --- | --- | --- |
| `c` | `1` | `c` `°c` `celsius` `centigrade` |
| `f` | `0.5555555555555555555555555556` | `f` `°f` `fahrenheit` |
| `k` | `1` | `k` `°k` `kelvin` `kelvins` |

### TEMPERATURE_UNITS

| Unit | Ratio to `c` | Offset | Aliases |
| --- | --- | --- | --- |
| `c` | `1` | — | `c` `°c` `celsius` `centigrade` |
| `f` | `0.5555555555555555555555555556` | `-32` | `f` `°f` `fahrenheit` |
| `k` | `1` | `-273.15` | `k` `°k` `kelvin` `kelvins` |

## Runtime exports

Type-only exports are erased and do not appear here.

`TEMPDELTA_UNITS` · `TEMPERATURE_UNITS` · `tempdelta` · `temperature`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| temperature/validate parseTemperature only | ≤ 1.3 kB | ≤ 700 B |
| temperature/validate parseTempDelta only | ≤ 1.3 kB | ≤ 700 B |

## Dependencies

- [`@smartput/kind`](/packages/kind)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


---
title: "@smartput/speed"
description: "m/s, km/h, mph, knots."
---

# @smartput/speed

Canonical in metres per second. The knot ratio is the full 28-digit value:
`0.514444` was the true number truncated, and a wrong constant is not a
smaller one.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="speed" model-value="80 kph" :switchable="false" />

<SpUnitCombobox kind="speed" model-value="80 kph" />

<SpEvaluate
  model-value="100 kph in mph"
  :examples="['100 kph in mph', '10 knot in kph', '60 mph']" />

## Installing

```sh
npm add @smartput/speed
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/speed` | The package root. |
| `@smartput/speed/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/speed/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/speed/class` | The immutable value class. |
| `@smartput/speed/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/speed/locale/de` | See the source for what this subpath carries. |
| `@smartput/speed/locale/fr` | See the source for what this subpath carries. |
| `@smartput/speed/locale/es` | See the source for what this subpath carries. |
| `@smartput/speed/locale/pt` | See the source for what this subpath carries. |
| `@smartput/speed/locale/it` | See the source for what this subpath carries. |
| `@smartput/speed/locale/nl` | See the source for what this subpath carries. |
| `@smartput/speed/locale/zh` | See the source for what this subpath carries. |
| `@smartput/speed/locale/ja` | See the source for what this subpath carries. |
| `@smartput/speed/locale/ar` | See the source for what this subpath carries. |
| `@smartput/speed/locale/ru` | See the source for what this subpath carries. |
| `@smartput/speed/locale/pl` | See the source for what this subpath carries. |
| `@smartput/speed/locale/tr` | See the source for what this subpath carries. |
| `@smartput/speed/locale/hi` | See the source for what this subpath carries. |
| `@smartput/speed/locale/ko` | See the source for what this subpath carries. |
| `@smartput/speed/locale/id` | See the source for what this subpath carries. |
| `@smartput/speed/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### SPEED_UNITS

| Unit | Ratio to `mps` | Aliases |
| --- | --- | --- |
| `mps` | `1` | `mps` |
| `kph` | `0.2777777777777777777777777778` | `kmh` `kph` |
| `mph` | `0.44704` | `mph` |
| `knot` | `0.5144444444444444444444444444` | `kt` `knot` `knots` |

## Runtime exports

Type-only exports are erased and do not appear here.

`SPEED_UNITS` · `speed`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| speed/validate parseSpeed only | ≤ 1.3 kB | ≤ 700 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


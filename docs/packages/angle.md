---
title: "@smartput/angle"
description: "Degree, radian, gradian, turn — with a 30-digit π."
---

# @smartput/angle

The ratios are decimal **strings**, not floats, which is what lets radians
carry a thirty-digit π through the engine without drift. The micro path does
`Number(r)` and accepts the float; the engine does `new Decimal(r)` and does
not.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="angle" model-value="30 deg" :switchable="false" />

<SpUnitCombobox kind="angle" model-value="30 deg" />

<SpEvaluate
  model-value="30 deg in rad"
  :examples="['30 deg in rad', '1 turn in deg', '90deg + 45deg']" />

## Installing

```sh
npm add @smartput/angle
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/angle` | The package root. |
| `@smartput/angle/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/angle/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/angle/class` | The immutable value class. |
| `@smartput/angle/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/angle/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### ANGLE_UNITS

| Unit | Ratio to `rad` | Aliases |
| --- | --- | --- |
| `rad` | `1` | `rad` `radian` `radians` |
| `deg` | `0.0174532925199432957692369076849` | `deg` `degree` `degrees` |
| `grad` | `0.0157079632679489661923132169164` | `gon` `grad` `gradian` `gradians` |
| `turn` | `6.28318530717958647692528676656` | `rev` `turn` `turns` `revolution` `revolutions` |

## Runtime exports

Type-only exports are erased and do not appear here.

`ANGLE_UNITS` · `angle`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| angle/validate parseAngle only | ≤ 1.4 kB | ≤ 800 B |
| angle/validate parse + add + to | ≤ 2.4 kB | ≤ 1.1 kB |
| angle/class | ≤ 4.8 kB | ≤ 1.9 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


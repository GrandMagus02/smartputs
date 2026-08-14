---
title: "@smartput/duration"
description: "Nanosecond to week, canonical in seconds."
---

# @smartput/duration

Calendar-free: a week is exactly 604800 seconds here. Months and years are
not units of duration, because they are not constant lengths — those live in
[`@smartput/datetime`](/packages/datetime), which has a calendar.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="duration" model-value="90 min" :switchable="false" />

<SpUnitCombobox kind="duration" model-value="90 min" />

<SpEvaluate
  model-value="30 h - 30 min"
  :examples="['30 h - 30 min', '1 wk + 2 d', '90 min in h', '2 h * 3']" />

## Installing

```sh
npm add @smartput/duration
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/duration` | The package root. |
| `@smartput/duration/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/duration/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/duration/class` | The immutable value class. |
| `@smartput/duration/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/duration/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### DURATION_UNITS

| Unit | Ratio to `s` | Aliases |
| --- | --- | --- |
| `s` | `1` | `s` `sec` `secs` `second` `seconds` |
| `ms` | `0.001` | `ms` `millisecond` `milliseconds` |
| `min` | `60` | `m` `min` `mins` `minute` `minutes` |
| `h` | `3600` | `h` `hr` `hrs` `hour` `hours` |
| `d` | `86400` | `d` `day` `days` |
| `wk` | `604800` | `wk` `wks` `week` `weeks` |

## Runtime exports

Type-only exports are erased and do not appear here.

`DURATION_UNITS` · `duration`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| duration/validate parseDuration only | ≤ 1.4 kB | ≤ 750 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


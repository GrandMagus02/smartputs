---
title: "@smartput/percent"
description: "One unit, ratio 0.01."
---

# @smartput/percent

`"20%"` is `0.2` canonically, which is what lets it behave like a number
in arithmetic with no special case anywhere. The smallest table in the repo, so
its size row is the earliest warning of growth in the shared parser.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="percent" model-value="20%" :switchable="false" />

<SpUnitCombobox kind="percent" model-value="20%" />

<SpEvaluate
  model-value="20% of 250"
  :examples="['20% of 250', '15% + 5%', '0.2 in %']" />

## Installing

```sh
npm add @smartput/percent
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/percent` | The package root. |
| `@smartput/percent/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/percent/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/percent/class` | The immutable value class. |
| `@smartput/percent/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/percent/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### PERCENT_UNITS

| Unit | Ratio to `%` | Aliases |
| --- | --- | --- |
| `%` | `0.01` | `%` `pct` `pcts` `percent` `percents` |

## Runtime exports

Type-only exports are erased and do not appear here.

`PERCENT_UNITS` · `percent`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| percent/validate parsePercent only | ≤ 1.1 kB | ≤ 650 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


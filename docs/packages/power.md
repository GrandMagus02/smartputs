---
title: "@smartput/power"
description: "Watt to horsepower, bridging energy and duration."
---

# @smartput/power

Canonical in watts.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="power" model-value="750 W" :switchable="false" />

<SpUnitCombobox kind="power" model-value="750 W" />

<SpEvaluate
  model-value="1 hp in W"
  :examples="['1 hp in W', '2 kW in W', '750 W + 250 W']" />

## Installing

```sh
npm add @smartput/power
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/power` | The package root. |
| `@smartput/power/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/power/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/power/class` | The immutable value class. |
| `@smartput/power/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/power/locale/de` | See the source for what this subpath carries. |
| `@smartput/power/locale/fr` | See the source for what this subpath carries. |
| `@smartput/power/locale/es` | See the source for what this subpath carries. |
| `@smartput/power/locale/pt` | See the source for what this subpath carries. |
| `@smartput/power/locale/it` | See the source for what this subpath carries. |
| `@smartput/power/locale/nl` | See the source for what this subpath carries. |
| `@smartput/power/locale/zh` | See the source for what this subpath carries. |
| `@smartput/power/locale/ja` | See the source for what this subpath carries. |
| `@smartput/power/locale/ar` | See the source for what this subpath carries. |
| `@smartput/power/locale/ru` | See the source for what this subpath carries. |
| `@smartput/power/locale/pl` | See the source for what this subpath carries. |
| `@smartput/power/locale/tr` | See the source for what this subpath carries. |
| `@smartput/power/locale/hi` | See the source for what this subpath carries. |
| `@smartput/power/locale/ko` | See the source for what this subpath carries. |
| `@smartput/power/locale/id` | See the source for what this subpath carries. |
| `@smartput/power/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### POWER_UNITS

| Unit | Ratio to `w` | Aliases |
| --- | --- | --- |
| `w` | `1` | `w` `watt` `watts` |
| `kw` | `1000` | `kw` `kilowatt` `kilowatts` |
| `mw` | `1000000` | `mw` `megawatt` `megawatts` |
| `gw` | `1000000000` | `gw` `gigawatt` `gigawatts` |
| `hp` | `745.69987158227022` | `hp` `horsepower` |

## Runtime exports

Type-only exports are erased and do not appear here.

`POWER_UNITS` · `power`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| power/validate parsePower only | ≤ 1.3 kB | ≤ 700 B |
| power/class | ≤ 4.7 kB | ≤ 1.9 kB |

## Dependencies

- [`@smartput/kind`](/packages/kind)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


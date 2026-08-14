---
title: "@smartput/tempo"
description: "Beats per minute, and its bridge to duration."
---

# @smartput/tempo

Canonical in beats per minute — two units, the second-smallest table in the repo.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="tempo" model-value="120 bpm" :switchable="false" />

<SpUnitCombobox kind="tempo" model-value="120 bpm" />

<SpEvaluate
  model-value="120 bpm in hz"
  :examples="['120 bpm in hz', '2 hz in bpm']" />

## Installing

```sh
npm add @smartput/tempo
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/tempo` | The package root. |
| `@smartput/tempo/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/tempo/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/tempo/class` | The immutable value class. |
| `@smartput/tempo/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/tempo/locale/de` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/fr` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/es` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/pt` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/it` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/nl` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/zh` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/ja` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/ar` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/ru` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/pl` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/tr` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/hi` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/ko` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/id` | See the source for what this subpath carries. |
| `@smartput/tempo/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### TEMPO_UNITS

| Unit | Ratio to `bpm` | Aliases |
| --- | --- | --- |
| `bpm` | `1` | `bpm` |
| `hz` | `60` | `hz` `hertz` |

## Runtime exports

Type-only exports are erased and do not appear here.

`TEMPO_UNITS` · `tempo`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| tempo/validate parseTempo only | ≤ 1.1 kB | ≤ 650 B |
| tempo/class | ≤ 4.5 kB | ≤ 1.8 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


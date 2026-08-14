---
title: "@smartput/number"
description: "The unitless kind, and the one that accepts a bare number."
---

# @smartput/number

One unit, `one`, and the only kind whose `/validate` carries a mode of
its own: `native` lets `parseNumber("30")` succeed where every other kind
returns `missing-unit`. That branch lives here rather than in the shared parser
precisely so that only this package's size row pays for it.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="number" model-value="42" :switchable="false" />

<SpUnitCombobox kind="number" model-value="42" />

<SpEvaluate
  model-value="(1 + 2) * 3"
  :examples="['(1 + 2) * 3', '1,500', '2^10']" />

## Installing

```sh
npm add @smartput/number
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/number` | The package root. |
| `@smartput/number/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/number/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/number/class` | The immutable value class. |
| `@smartput/number/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/number/locale/de` | See the source for what this subpath carries. |
| `@smartput/number/locale/fr` | See the source for what this subpath carries. |
| `@smartput/number/locale/es` | See the source for what this subpath carries. |
| `@smartput/number/locale/pt` | See the source for what this subpath carries. |
| `@smartput/number/locale/it` | See the source for what this subpath carries. |
| `@smartput/number/locale/nl` | See the source for what this subpath carries. |
| `@smartput/number/locale/zh` | See the source for what this subpath carries. |
| `@smartput/number/locale/ja` | See the source for what this subpath carries. |
| `@smartput/number/locale/ar` | See the source for what this subpath carries. |
| `@smartput/number/locale/ru` | See the source for what this subpath carries. |
| `@smartput/number/locale/pl` | See the source for what this subpath carries. |
| `@smartput/number/locale/tr` | See the source for what this subpath carries. |
| `@smartput/number/locale/hi` | See the source for what this subpath carries. |
| `@smartput/number/locale/ko` | See the source for what this subpath carries. |
| `@smartput/number/locale/id` | See the source for what this subpath carries. |
| `@smartput/number/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### NUMBER_UNITS

| Unit | Ratio to `one` | Aliases |
| --- | --- | --- |
| `one` | `1` | `one` |

## Runtime exports

Type-only exports are erased and do not appear here.

`NUMBER_UNITS` · `NUMBER_WORDS` · `number` · `numberFromWords` · `spellNumber`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| number/validate parseNumber only | ≤ 1.4 kB | ≤ 750 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


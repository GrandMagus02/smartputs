---
title: "@smartput/datarate"
description: "bit/s to Gbit/s, bridging data size and duration."
---

# @smartput/datarate

Canonical in bits per second. `datasize`'s canonical is the byte and this
one's is the bit, so every bridge between them carries the factor of eight
explicitly rather than hiding it in a ratio.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="datarate" model-value="100 mbps" :switchable="false" />

<SpUnitCombobox kind="datarate" model-value="100 mbps" />

<SpEvaluate
  model-value="1 gbps in mbps"
  :examples="['1 gbps in mbps', '100 mbps + 50 mbps']" />

## Installing

```sh
npm add @smartput/datarate
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/datarate` | The package root. |
| `@smartput/datarate/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/datarate/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/datarate/class` | The immutable value class. |
| `@smartput/datarate/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/datarate/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### DATARATE_UNITS

| Unit | Ratio to `bps` | Aliases |
| --- | --- | --- |
| `bps` | `1` | `bps` |
| `kbps` | `1000` | `kbps` |
| `mbps` | `1000000` | `mbps` |
| `gbps` | `1000000000` | `gbps` |
| `tbps` | `1000000000000` | `tbps` |

## Runtime exports

Type-only exports are erased and do not appear here.

`DATARATE_UNITS` · `datarate`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| datarate/validate parseDatarate only | ≤ 1.2 kB | ≤ 650 B |
| datarate/class | ≤ 4.7 kB | ≤ 1.9 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


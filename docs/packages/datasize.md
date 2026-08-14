---
title: "@smartput/datasize"
description: "Bytes and bits, decimal and binary prefixes."
---

# @smartput/datasize

Canonical in bits. `kB` and `KiB` are different units, not spellings of
one — see [Comparison](/packages/boolean) for what that does to `1000 mb = 1
gb`.

Three doors, one table. The kind descriptor is for the
engine, `/validate` is free functions over JS numbers, `/class` is an
immutable value class — and all three read the same `UnitTable`, so a unit
added once is added everywhere. See [Validating without the
engine](/packages/shared).

## Try it

<SpValidatedInput kind="datasize" model-value="256 MB" :switchable="false" />

<SpUnitCombobox kind="datasize" model-value="256 MB" />

<SpEvaluate
  model-value="1 GB in MB"
  :examples="['1 GB in MB', '1 GiB in MiB', '700 MB + 300 MB']" />

## Installing

```sh
npm add @smartput/datasize
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/datasize` | The package root. |
| `@smartput/datasize/units` | The `UnitTable`: ratios and aliases, with no engine and no `Decimal`. |
| `@smartput/datasize/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/datasize/class` | The immutable value class. |
| `@smartput/datasize/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/datasize/locale/de` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/fr` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/es` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/pt` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/it` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/nl` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/zh` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/ja` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/ar` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/ru` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/pl` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/tr` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/hi` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/ko` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/id` | See the source for what this subpath carries. |
| `@smartput/datasize/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Units

Read from the table itself, not typed out — a unit added to
the source appears here on the next `bun run docs:packages`. Ratios are decimal
strings, which is what lets the engine widen them to `Decimal` without a float
in between.

### DATASIZE_UNITS

| Unit | Ratio to `b` | Aliases |
| --- | --- | --- |
| `b` | `1` | `b` `byte` `bytes` |
| `kb` | `1000` | `kb` `kilobyte` `kilobytes` |
| `mb` | `1000000` | `mb` `megabyte` `megabytes` |
| `gb` | `1000000000` | `gb` `gigabyte` `gigabytes` |
| `tb` | `1000000000000` | `tb` `terabyte` `terabytes` |
| `kib` | `1024` | `kib` `kibibyte` `kibibytes` |
| `mib` | `1048576` | `mib` `mebibyte` `mebibytes` |
| `gib` | `1073741824` | `gib` `gibibyte` `gibibytes` |
| `tib` | `1099511627776` | `tib` `tebibyte` `tebibytes` |

## Runtime exports

Type-only exports are erased and do not appear here.

`DATASIZE_UNITS` · `datasize`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| datasize/validate parseDatasize only | ≤ 1.6 kB | ≤ 800 B |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/shared`](/packages/shared)

## See also

- [Kinds and units](/guide/kinds)
- [The micro path](/packages/shared)
- [Inputs and error messages](/guide/inputs)


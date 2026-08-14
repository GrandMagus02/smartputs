---
title: "@smartput/kinds"
description: "Every built-in kind, its vocabulary, and the two barrels over them."
---

# @smartput/kinds

`BUILTIN_KINDS` is the list `createEngine()` is normally handed;
the individual descriptors are exported by name beside it. `measure` is
exported but **not** in `BUILTIN_KINDS` — its `mm` and `cm` collide with
`length`, so registering it is a decision, not a default.

The `/validate` and `/class` barrels re-export every kind's subpath. They are
a convenience, not the byte-safe door: they shake to one kind under esbuild,
Rollup and modern webpack, and to all seventeen under a bundler that does not
follow re-exports. Two rows in `check-size.ts` exist to catch the day that
stops being true.

## Try it

<SpConvert />

## Installing

```sh
npm add @smartput/kinds
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/kinds` | The package root. |
| `@smartput/kinds/validate` | Every kind's free functions in one import — see the shake note above. |
| `@smartput/kinds/class` | Every kind's value class in one import. |
| `@smartput/kinds/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/kinds/locale/de` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/fr` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/es` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/pt` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/it` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/nl` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/zh` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/ja` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/ar` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/ru` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/pl` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/tr` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/hi` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/ko` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/id` | See the source for what this subpath carries. |
| `@smartput/kinds/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Runtime exports

Type-only exports are erased and do not appear here.

`BUILTIN_KINDS` · `angle` · `area` · `boolean` · `datarate` · `datasize` · `duration` · `energy` · `length` · `mass` · `measure` · `number` · `percent` · `power` · `speed` · `tempdelta` · `temperature` · `tempo` · `volume`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| kinds/validate barrel, one kind (shake check) | ≤ 1.4 kB | ≤ 800 B |
| kinds/class barrel, one kind (shake check) | ≤ 4.8 kB | ≤ 1.9 kB |

## Dependencies

- [`@smartput/angle`](/packages/angle)
- [`@smartput/area`](/packages/area)
- [`@smartput/boolean`](/packages/boolean)
- [`@smartput/core`](/packages/core)
- [`@smartput/datarate`](/packages/datarate)
- [`@smartput/datasize`](/packages/datasize)
- [`@smartput/duration`](/packages/duration)
- [`@smartput/energy`](/packages/energy)
- [`@smartput/length`](/packages/length)
- [`@smartput/mass`](/packages/mass)
- [`@smartput/measure`](/packages/measure)
- [`@smartput/number`](/packages/number)
- [`@smartput/percent`](/packages/percent)
- [`@smartput/power`](/packages/power)
- [`@smartput/speed`](/packages/speed)
- [`@smartput/temperature`](/packages/temperature)
- [`@smartput/tempo`](/packages/tempo)
- [`@smartput/volume`](/packages/volume)

## See also

- [Kinds and units](/guide/kinds)


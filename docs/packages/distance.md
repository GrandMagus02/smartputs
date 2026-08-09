---
title: "@smartput/distance"
description: "Great-circle distance between two places."
---

# @smartput/distance

The op, not the gazetteer: `PlaceDistance` reads coordinates off two
place values and returns a length. It knows nothing about where those values
came from, which is why it survived the fold below unchanged.

## Try it

<SpGeoScore />

## Installing

```sh
npm add @smartput/distance
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/distance` | The package root. |

## Runtime exports

Type-only exports are erased and do not appear here.

`EARTH_RADIUS_M` · `PlaceDistance` · `UnpositionedPlaceError` · `metresBetween`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| distance root (the op, no gazetteer) | ≤ 40.5 kB | ≤ 16.5 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- `decimal.js`

## See also

- [@smartput/geo](/packages/geo)


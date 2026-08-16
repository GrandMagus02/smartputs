---
title: "@smartput/datetime-range"
description: "Full instants at both ends, holidays optional."
---

# @smartput/datetime-range

The widest of the four. Its `./holiday` subpath carries the same
opt-in cost as `datetime`'s, for the same reason and behind the same size
row.

## Try it

<SpRange
  model-value="yesterday morning"
  :examples="['yesterday morning', 'tomorrow afternoon', 'today 9am to 5pm']" />

## Installing

```sh
npm add @smartput/datetime-range
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/datetime-range` | The package root. |
| `@smartput/datetime-range/holiday` | See the source for what this subpath carries. |

## Runtime exports

Type-only exports are erased and do not appear here.

`DATETIME_RANGE_KIND` · `DATETIME_RANGE_UNIT` · `DEFAULT_DATETIME_RANGE_WEIGHT` · `createDatetimeRange` · `datetimeEndpoint` · `datetimeRange` · `dayWindowAt` · `fromToAt`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| datetime-range root (no holiday data) | ≤ 148 kB | ≤ 51.9 kB |
| datetime-range holiday | ≤ 1587 kB | ≤ 292 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/date`](/packages/date)
- [`@smartput/datetime`](/packages/datetime)
- [`@smartput/holiday`](/packages/holiday)
- [`@smartput/range-core`](/packages/range-core)
- [`@smartput/time`](/packages/time)

## See also

- [Ranges](/packages/range-core)


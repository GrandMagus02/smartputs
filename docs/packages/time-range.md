---
title: "@smartput/time-range"
description: "`9am–5pm`, with no date on either end."
---

# @smartput/time-range

The clock-time range, over `@smartput/time`'s endpoints.

## Try it

<SpRange
  model-value="10:00 - 20:00"
  :examples="['10:00 - 20:00', '9am to 5pm', 'morning', 'evening']" />

## Installing

```sh
npm add @smartput/time-range
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/time-range` | The package root. |

## Runtime exports

Type-only exports are erased and do not appear here.

`TIME_RANGE_KIND` · `TIME_RANGE_UNIT` · `createTimeRange` · `timeRange`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| time-range | ≤ 147 kB | ≤ 51.5 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/range-core`](/packages/range-core)
- [`@smartput/time`](/packages/time)

## See also

- [Ranges](/packages/range-core)


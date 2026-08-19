---
title: "@smartput/time"
description: "A clock time, with no date attached."
---

# @smartput/time

Nanoseconds since midnight, wrapped as a kind. The counterpart to
[`@smartput/date`](/packages/date): together they are what
[`@smartput/datetime`](/packages/datetime) splits into.

## Try it

<SpRange
  title="time, read through the range engine"
  model-value="3pm"
  :examples="['3pm', '09:30', 'noon', 'midnight']" />

## Installing

```sh
npm add @smartput/time
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/time` | The package root. |

## Runtime exports

Type-only exports are erased and do not appear here.

`DEFAULT_TIME_WEIGHT` · `NS_PER_DAY` · `TIME_KIND` · `TIME_UNIT` · `createTime` · `formatClock` · `time` · `unwrap` · `wrap`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| time | ≤ 150 kB | ≤ 52.2 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/datetime`](/packages/datetime)

## See also

- [Dates and time zones](/packages/datetime)


---
title: "@smartput/date"
description: "A calendar day, with no time inside it."
---

# @smartput/date

`datetime` truncated to a day and given its own kind id, so
`tomorrow` is a date and `tomorrow at 3pm` is a datetime, and the two do not
silently unify.

Every grammar `@smartput/datetime` reads arrives here: `first friday next
month`, `second monday in Aug 2027`, and the calendar intervals, which land
on their first day — `next week` is the coming Monday, `next year` is
1 January.

## Try it

<SpRange
  title="date, read through the range engine"
  model-value="today"
  :examples="['today', 'tomorrow', 'next friday', 'first friday next month', '3 days ago']" />

## Installing

```sh
npm add @smartput/date
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/date` | The package root. |

## Runtime exports

Type-only exports are erased and do not appear here.

`DATE_KIND` · `DATE_UNIT` · `DEFAULT_DATE_WEIGHT` · `createDate` · `date` · `startOfDay` · `unwrap` · `wrap`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| date | ≤ 150 kB | ≤ 52.1 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/datetime`](/packages/datetime)

## See also

- [Dates and time zones](/packages/datetime)


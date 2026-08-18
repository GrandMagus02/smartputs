---
title: "@smartput/date-range"
description: "`last week`, `March 3–7`, `between May and June`."
---

# @smartput/date-range

Date endpoints plus the phrase table that resolves a named span to two of them.

## Try it

<SpRange
  model-value="last week"
  :examples="['last week', 'whole week', 'March 3 - 7', 'from today until friday']" />

## Installing

```sh
npm add @smartput/date-range
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/date-range` | The package root. |

## Runtime exports

Type-only exports are erased and do not appear here.

`DATE_RANGE_KIND` · `DATE_RANGE_UNIT` · `DEFAULT_PHRASE_WEIGHT` · `PHRASES` · `createDateRange` · `dateRange` · `phraseAt` · `spanFor`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| date-range | ≤ 150 kB | ≤ 52.0 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/date`](/packages/date)
- [`@smartput/datetime`](/packages/datetime)
- [`@smartput/range-core`](/packages/range-core)

## See also

- [Ranges](/packages/range-core)


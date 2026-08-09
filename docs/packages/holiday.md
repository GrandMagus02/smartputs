---
title: "@smartput/holiday"
description: "Which holiday a phrase names, and when it falls."
---

# @smartput/holiday

A tokenising scorer over the `date-holidays` rule table, and nothing
else — no kinds, no values, no `Decimal`, no engine. That isolation is what
lets `@smartput/datetime` reach it from a subpath instead of its root.

It is a package rather than a file because of its weight: ~1.5 MB bundled, six
times the T0 gazetteer. As a plain dependency of `datetime` it would charge
every consumer of `today + 3 d` a megabyte for a feature they did not ask
for.

## Try it

<SpHoliday />

## Installing

```sh
npm add @smartput/holiday
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/holiday` | The package root. |
| `@smartput/holiday/types` | Type declarations only — erased at runtime. |

## Runtime exports

Type-only exports are erased and do not appear here.

`DEFAULT_COUNTRY` · `findHoliday` · `holidayCountries` · `holidaysFor`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| holiday root (the rule table, alone) | ≤ 1430 kB | ≤ 236 kB |

## Dependencies

- `date-holidays`

## See also

- [Dates and time zones](/packages/datetime)


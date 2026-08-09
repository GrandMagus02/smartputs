---
title: "@smartput/timezone"
description: "Zone tables and the written-offset parser. No dependencies."
---

# @smartput/timezone

Eighteen named zones, every quarter hour from −12:00 to +14:00, and a
parser for `GMT+3` / `utc-05:30`. Zero runtime dependencies, deliberately: a
form field offering a zone picker should not install chrono and Temporal to get
a list of zone names.

## Try it

<SpDatetime />

## Installing

```sh
npm add @smartput/timezone
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/timezone` | The package root. |

## Runtime exports

Type-only exports are erased and do not appear here.

`OFFSET_ZONES` · `ZONES` · `offsetZoneId` · `parseOffsetZone` · `zoneSymbol`

## Dependencies

None. Not "none for now" — this package is depended on by others precisely
because it has none.

## See also

- [Dates and time zones](/packages/datetime)


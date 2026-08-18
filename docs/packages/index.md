---
title: Packages
description: Every published package, what it is, what it costs, and what it depends on.
---

# Packages

38 packages, one card each — the line under a package is what you
would type into it. Every table on the page a card opens is read from the source
it describes — the manifest's `exports`, the kind's `UnitTable`, the rows of
`check-size.ts` — so none of them can drift from the code without the build
noticing.

The shape is always the same: **core** is the engine and knows nothing about
metres; **shared** is the engine-free parser; each kind is a table plus three
doors onto it; and anything that costs real bytes — a gazetteer, a holiday rule
table — is its own package so that not importing it is possible.

Looking for what to *build* with them instead? The [examples](/guide/examples/)
are seven fields, each wired end to end.

## Engine

<SpCatalog group="Engine" />

## Kinds

<SpCatalog group="Kinds" />

## Money

<SpCatalog group="Money" />

## Dates and time

<SpCatalog group="Dates and time" />

## Ranges

<SpCatalog group="Ranges" />

## Places

<SpCatalog group="Places" />

## Math and queries

<SpCatalog group="Math and queries" />

<details class="sp-details">
<summary>Every package as one table</summary>

| Package | What it is | Reads |
| --- | --- | --- |
| [`@smartput/angle`](/packages/angle) | Degree, radian, gradian, turn — with a 30-digit π. | `90 deg in rad` |
| [`@smartput/area`](/packages/area) | Square metres, hectares, acres. | `1 ha in m2` |
| [`@smartput/boolean`](/packages/boolean) | The kind comparisons land in. | `1 kg > 900 g` |
| [`@smartput/core`](/packages/core) | The engine: normalize, tokenize, parse, solve, eval, print. | `1 kg + 500 g` |
| [`@smartput/currency`](/packages/currency) | Currency recognition and formatting, with no rate table. | `30 usd` |
| [`@smartput/datarate`](/packages/datarate) | bit/s to Gbit/s, bridging data size and duration. | `1 gbps in mbps` |
| [`@smartput/datasize`](/packages/datasize) | Bytes and bits, decimal and binary prefixes. | `1 GiB in MiB` |
| [`@smartput/date`](/packages/date) | A calendar day, with no time inside it. | `next friday` |
| [`@smartput/date-range`](/packages/date-range) | `last week`, `March 3–7`, `between May and June`. | `last week` |
| [`@smartput/datetime`](/packages/datetime) | The datetime kind: chrono in front, Temporal underneath. | `3pm in tokyo` |
| [`@smartput/datetime-range`](/packages/datetime-range) | Full instants at both ends, holidays optional. | `yesterday morning` |
| [`@smartput/distance`](/packages/distance) | Great-circle distance between two places. | `haversine(kyiv, warsaw)` |
| [`@smartput/duration`](/packages/duration) | Nanosecond to week, canonical in seconds. | `30 h - 30 min` |
| [`@smartput/energy`](/packages/energy) | Joule, calorie, watt-hour, electronvolt. | `1 kWh in J` |
| [`@smartput/geo`](/packages/geo) | Places, whole: the kind, postal codes, and the GeoNames providers. | `muenchen` |
| [`@smartput/holiday`](/packages/holiday) | Which holiday a phrase names, and when it falls. | `christmas` |
| [`@smartput/kind`](/packages/kind) | The layer a kind and a language are written in, with no engine in it. | `defineKind({ id: "css" })` |
| [`@smartput/kinds`](/packages/kinds) | Every built-in kind, its vocabulary, and the two barrels over them. | `BUILTIN_KINDS` |
| [`@smartput/length`](/packages/length) | Millimetre to mile, exact in decimal. | `2 km in m` |
| [`@smartput/mass`](/packages/mass) | Milligram to ton, with the imperial pounds and ounces. | `1 kg + 500 g` |
| [`@smartput/math`](/packages/math) | LaTeX in, steps out: evaluate, simplify, solve, analyse. | `x^2 - 5x + 6 = 0` |
| [`@smartput/measure`](/packages/measure) | Typographic units: point, pica, em, pixel. | `12 pt in mm` |
| [`@smartput/number`](/packages/number) | The unitless kind, and the one that accepts a bare number. | `(1 + 2) * 3` |
| [`@smartput/percent`](/packages/percent) | One unit, ratio 0.01. | `20% of 250` |
| [`@smartput/power`](/packages/power) | Watt to horsepower, bridging energy and duration. | `1 hp in W` |
| [`@smartput/query`](/packages/query) | A sentence to a database query, in SQL or Mongo. | `orders over 500 usd` |
| [`@smartput/range`](/packages/range) | Numeric and measured ranges: `10–20 km`. | `last three` |
| [`@smartput/range-core`](/packages/range-core) | Endpoints, ordering, windows — the machinery every range kind shares. | `whole week` |
| [`@smartput/rate`](/packages/rate) | The money kind, rate snapshots, and the live-rate facade. | `30 usd in gbp` |
| [`@smartput/shared`](/packages/shared) | The micro path: one parser, one algebra, one value-class factory. | `parseLength("30 cm")` |
| [`smartputs`](/packages/smartputs) | The unscoped install name. Everything `@smartput/core` is, under one word. | `bun i smartputs` |
| [`@smartput/speed`](/packages/speed) | m/s, km/h, mph, knots. | `100 kph in mph` |
| [`@smartput/temperature`](/packages/temperature) | Celsius, Fahrenheit, Kelvin — plus the delta kind beside them. | `212 F in C` |
| [`@smartput/tempo`](/packages/tempo) | Beats per minute, and its bridge to duration. | `120 bpm in hz` |
| [`@smartput/time`](/packages/time) | A clock time, with no date attached. | `3pm` |
| [`@smartput/time-range`](/packages/time-range) | `9am–5pm`, with no date on either end. | `9am to 5pm` |
| [`@smartput/timezone`](/packages/timezone) | Zone tables and the written-offset parser. No dependencies. | `gmt+3` |
| [`@smartput/volume`](/packages/volume) | Litres, millilitres, cubic metres, and the two gallons. | `500 ml + 1 l` |

</details>

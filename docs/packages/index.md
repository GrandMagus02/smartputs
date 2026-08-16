---
title: Packages
description: Every published package, what it is, what it costs, and what it depends on.
---

# Packages

38 packages, one page each. Every table on those pages is read from
the source it describes — the manifest's `exports`, the kind's `UnitTable`,
the rows of `check-size.ts` — so none of them can drift from the code without
the build noticing.

The shape is always the same: **core** is the engine and knows nothing about
metres; **shared** is the engine-free parser; each kind is a table plus three
doors onto it; and anything that costs real bytes — a gazetteer, a holiday rule
table — is its own package so that not importing it is possible.

## Engine

| Package | What it is |
| --- | --- |
| [`@smartput/core`](/packages/core) | The engine: normalize, tokenize, parse, solve, eval, print. |
| [`@smartput/kind`](/packages/kind) | The layer a kind and a language are written in, with no engine in it. |
| [`@smartput/kinds`](/packages/kinds) | Every built-in kind, its vocabulary, and the two barrels over them. |
| [`@smartput/shared`](/packages/shared) | The micro path: one parser, one algebra, one value-class factory. |
| [`@smartput/smartputs`](/packages/smartputs) | The unscoped install name. Everything `@smartput/core` is, under one word. |

## Kinds

| Package | What it is |
| --- | --- |
| [`@smartput/angle`](/packages/angle) | Degree, radian, gradian, turn — with a 30-digit π. |
| [`@smartput/area`](/packages/area) | Square metres, hectares, acres. |
| [`@smartput/boolean`](/packages/boolean) | The kind comparisons land in. |
| [`@smartput/datarate`](/packages/datarate) | bit/s to Gbit/s, bridging data size and duration. |
| [`@smartput/datasize`](/packages/datasize) | Bytes and bits, decimal and binary prefixes. |
| [`@smartput/duration`](/packages/duration) | Nanosecond to week, canonical in seconds. |
| [`@smartput/energy`](/packages/energy) | Joule, calorie, watt-hour, electronvolt. |
| [`@smartput/length`](/packages/length) | Millimetre to mile, exact in decimal. |
| [`@smartput/mass`](/packages/mass) | Milligram to ton, with the imperial pounds and ounces. |
| [`@smartput/measure`](/packages/measure) | Typographic units: point, pica, em, pixel. |
| [`@smartput/number`](/packages/number) | The unitless kind, and the one that accepts a bare number. |
| [`@smartput/percent`](/packages/percent) | One unit, ratio 0.01. |
| [`@smartput/power`](/packages/power) | Watt to horsepower, bridging energy and duration. |
| [`@smartput/speed`](/packages/speed) | m/s, km/h, mph, knots. |
| [`@smartput/temperature`](/packages/temperature) | Celsius, Fahrenheit, Kelvin — plus the delta kind beside them. |
| [`@smartput/tempo`](/packages/tempo) | Beats per minute, and its bridge to duration. |
| [`@smartput/volume`](/packages/volume) | Litres, millilitres, cubic metres, and the two gallons. |

## Money

| Package | What it is |
| --- | --- |
| [`@smartput/currency`](/packages/currency) | Currency recognition and formatting, with no rate table. |
| [`@smartput/rate`](/packages/rate) | The money kind, rate snapshots, and the live-rate facade. |

## Dates and time

| Package | What it is |
| --- | --- |
| [`@smartput/date`](/packages/date) | A calendar day, with no time inside it. |
| [`@smartput/datetime`](/packages/datetime) | The datetime kind: chrono in front, Temporal underneath. |
| [`@smartput/holiday`](/packages/holiday) | Which holiday a phrase names, and when it falls. |
| [`@smartput/time`](/packages/time) | A clock time, with no date attached. |
| [`@smartput/timezone`](/packages/timezone) | Zone tables and the written-offset parser. No dependencies. |

## Ranges

| Package | What it is |
| --- | --- |
| [`@smartput/date-range`](/packages/date-range) | `last week`, `March 3–7`, `between May and June`. |
| [`@smartput/datetime-range`](/packages/datetime-range) | Full instants at both ends, holidays optional. |
| [`@smartput/range`](/packages/range) | Numeric and measured ranges: `10–20 km`. |
| [`@smartput/range-core`](/packages/range-core) | Endpoints, ordering, windows — the machinery every range kind shares. |
| [`@smartput/time-range`](/packages/time-range) | `9am–5pm`, with no date on either end. |

## Places

| Package | What it is |
| --- | --- |
| [`@smartput/distance`](/packages/distance) | Great-circle distance between two places. |
| [`@smartput/geo`](/packages/geo) | Places, whole: the kind, postal codes, and the GeoNames providers. |

## Math and queries

| Package | What it is |
| --- | --- |
| [`@smartput/math`](/packages/math) | LaTeX in, steps out: evaluate, simplify, solve, analyse. |
| [`@smartput/query`](/packages/query) | A sentence to a database query, in SQL or Mongo. |


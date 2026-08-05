# @smartput/geo

Places as first-class values. `japan` is a value the way `5 kg` is a value —
it has a unit (its ISO 3166-1 country code), it formats to its facts, and it
takes part in one operation.

```ts
import { place } from "@smartput/geo";

// `place` registers like any other kind. Register `length` beside it — the
// distance op returns one.
const engine = createEngine({ kinds: [place, length], locales: [en] });

engine.evaluate("japan");           // Japan — JPY, +81, Asia/Tokyo, 127M
engine.evaluate("japan to france"); // a length, capital to capital
```

The distance is great-circle and says so: results carry the assumption, because
driving distance is what a person often means and no free dataset provides it.

A country is reached by name in any case — `japan`, `Japan`, `united kingdom` —
and by ISO code only when the code is written as one: `japan to UA`, not
`japan to ua`. Lowercase `and`, `ago`, `is` and `it` are Andorra, Angola,
Iceland and Italy, and reading a two-letter word as a country would cost the
expression around it its own reading.

Two runtime dependencies, `@smartput/core` and `decimal.js`. The GeoNames data
is vendored as generated TypeScript, so the package takes on no npm data
dependency and no upstream maintenance risk.

## Nothing imports anything

`3pm in japan` and `100 usd in japan` work without `@smartput/datetime` or
`@smartput/rates` knowing what a place is. Core declares `PlaceMeta`, geo
produces it, and the other two read a string out of `meta` — `meta.zone` and
`meta.currency`. The dependency graph is unchanged in both directions.

## Milestones

| M | Scope |
| --- | --- |
| **M6.1** | Package, `place` kind, T0 countries, `placeLiteral`, `in \| place \| place` distance, `format`. Datetime and rates bridge signatures. |
| **M6.2** | T1 cities, admin1 scope matching, weights, `suggest()` ranking. |
| **M6.3** | `PlaceProvider`, generic cache facade lifted into core, `geonames()` and `postalCodes()` providers, `postalLiteral`. |
| **M6.4** | Completion surface: country and city prefix completion, postal format validation and normalization. |

The full design is in `docs/superpowers/specs/2026-08-05-smartputs-geo-design.md`.

## Attribution

Place data is derived from [GeoNames](https://www.geonames.org/), licensed
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The same
string is exported as `GEONAMES_ATTRIBUTION`, so a consumer embedding the data
in a UI has it to hand rather than having to copy it out of this file.

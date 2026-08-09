# @smartput/country

Places as first-class values. `japan` is a value the way `5 kg` is a value —
it has a unit (its ISO 3166-1 country code), it formats to its facts, and it
takes part in one operation.

```ts
import { place } from "@smartput/country";

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

The GeoNames data is vendored as generated TypeScript, so no package here takes
on an npm data dependency or the upstream maintenance risk that comes with one.

## Four packages, one direction

| Package | What it is |
| --- | --- |
| `@smartput/zip` | The postal literal matcher and the format validator, over rows you hand it. No data. |
| `@smartput/city` | The T1 gazetteer: 6,247 cities, 1,664 divisions, two row types. No code. |
| `@smartput/distance` | `PlaceDistance` — the great-circle op, over the table its kind registered. No data. |
| `@smartput/country` | T0 and the `place` kind assembled out of the other three. |

This package names `createPostalLiteral` and `PlaceDistance`, so neither of those
packages can name it back: both take their table as an argument and ship none.
That is why a form field validating postcodes can install `@smartput/zip` and get
no gazetteer, and why `POSTAL_FORMATS` — the same validator with the shipped 252
rows behind it — lives here rather than there.

The edge to `@smartput/city` is `import type` from its `/types` subpath and
compiles away. `place.test.ts` reads the source for a value import of that
package and `check-size` weighs the bundle, because 234 KB of cities arriving in
a build that wanted 27 KB of countries is the one failure this layout exists to
prevent.

## Nothing imports anything

`3pm in japan` and `100 usd in japan` work without `@smartput/datetime` or
`@smartput/rate` knowing what a place is. Core declares `PlaceMeta`, this kind
produces it, and the other two read a string out of `meta` — `meta.zone` and
`meta.currency`. The dependency graph is unchanged in both directions.

## Milestones

| M | Scope |
| --- | --- |
| **M6.1** | Package, `place` kind, T0 countries, `placeLiteral`, `in \| place \| place` distance, `format`. Datetime and rates bridge signatures. |
| **M6.2** | T1 cities, admin1 scope matching, weights, `suggest()` ranking. |
| **M6.3** | `PlaceProvider`, generic cache facade lifted into core, `geonames()` and `postalCodes()` providers, `postalLiteral`. |
| **M6.4** | Completion surface: country and city prefix completion, postal format validation and normalization. |
| **M6.5** | The split: `@smartput/geo` became `@smartput/zip`, `@smartput/city`, `@smartput/distance` and this package. |

The full design is in `docs/superpowers/specs/2026-08-05-smartputs-geo-design.md`.

## Attribution

Place data is derived from [GeoNames](https://www.geonames.org/), licensed
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The same
string is exported as `GEONAMES_ATTRIBUTION`, so a consumer embedding the data
in a UI has it to hand rather than having to copy it out of this file.

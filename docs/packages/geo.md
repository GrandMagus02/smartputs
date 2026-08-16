---
title: "@smartput/geo"
description: "Places, whole: the kind, postal codes, and the GeoNames providers."
---

# @smartput/geo

`@smartput/country`, `@smartput/city` and `@smartput/zip` were
three packages and are now this one. What they had in common was a committed
table — 252 countries, 6 247 cities, 178 postal masks — and the argument against
it is that a library release is the wrong unit for a data release: populations
move, names change, borders are redrawn, and a translation of the table is
needed per language. GeoNames already holds every toponym's names in some 250
languages, so the table is a provider now and `lang` is the whole of the
internationalization story.

`Geo` fronts one or more providers with `QueryCache`, `RateLimiter` and a
strategy for what to do when one fails. The network is reachable only through
`@smartput/geo/providers`; the root is types, ranking and the `Geo` that
orchestrates them, so a bundle that imports a `GeoKind` links no fetch.

## Try it

<SpGeoScore />

## Installing

```sh
npm add @smartput/geo
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/geo` | The package root. |
| `@smartput/geo/providers` | `geonames()`, `postalCodes()`, `custom()` — the only door that reaches the network. |

## Runtime exports

Type-only exports are erased and do not appear here.

`GEONAMES_ATTRIBUTION` · `GEO_KINDS` · `Geo` · `GeoError` · `MAX_CODE_LENGTH` · `MIN_ALIAS_LENGTH` · `MIN_NAME_LENGTH` · `NO_GEONAME_ID` · `PlaceCompleter` · `PlaceProviderError` · `PostalFormat` · `PostalFormats` · `QueryCache` · `RANK_STEP` · `RESERVED_WORDS` · `RateLimiter` · `WEIGHTS` · `cacheKey` · `completePlaces` · `countryTable` · `createLivePlace` · `createPlaceFormatter` · `createPlaceIndex` · `createPlaceLiteral` · `createPostalLiteral` · `dedupe` · `definePlace` · `featureClasses` · `haversine` · `identity` · `inBbox` · `isBacktrackRisk` · `joinCountries` · `kindOf` · `normalizeName` · `normalizePostal` · `placeSnapshot` · `placeVocabulary` · `postalAccepts` · `postalShape` · `rank` · `regexFromMask` · `score` · `similarity` · `wantsPostal` · `wantsToponyms`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| geo root (search and ranking, no data at all) | ≤ 40.8 kB | ≤ 16.3 kB |
| geo providers (every adapter) | ≤ 43.3 kB | ≤ 16.6 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- [`@smartput/distance`](/packages/distance)
- `decimal.js`

## See also

- [@smartput/distance](/packages/distance)


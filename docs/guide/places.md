---
title: Places and distances
description: The place kind, countries as values, great-circle distance, and the datetime and rates bridges.
---

# Places and distances

`@smartput/geo` adds one kind. Once it is registered, `japan` is a value the way
`5 kg` is a value: it has a unit — its ISO 3166-1 alpha-2 code — it formats to
its facts, and it takes part in one operation.

```sh
bun add @smartput/geo
```

```ts
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { place } from "@smartput/geo";
import { BUILTIN_KINDS } from "@smartput/kinds";

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, place],
});

engine.evaluate("japan").formatted;           // "Japan — JPY, +81, Asia/Tokyo, 127M"
engine.evaluate("japan to france").formatted; // "9,712.518 kilometres"
```

`length` has to be registered beside it, because the distance op resolves to a
length — `BUILTIN_KINDS` covers that. There is no locale pack and no engine
option: the country names are the data, and the data ships in the package.

**This page describes M6.1, which is countries only.** Cities, postal codes and
completion are named milestones that have not shipped; the [Not yet](#not-yet)
section says which is which.

## What it recognises

252 countries and territories, by name, in any case, in as many as four words.

| Input | Result |
| --- | --- |
| `japan` | `Japan — JPY, +81, Asia/Tokyo, 127M` |
| `Japan` | `Japan — JPY, +81, Asia/Tokyo, 127M` |
| `united kingdom` | `United Kingdom — GBP, +44, Europe/London, 66M` |
| `great britain` | `United Kingdom — GBP, +44, Europe/London, 66M` |
| `the netherlands` | `The Netherlands — EUR, +31, Europe/Amsterdam, 17M` |
| `czech republic` | `Czechia — CZK, +420, Europe/Prague, 11M` |
| `south korea` | `South Korea — KRW, +82, Asia/Seoul, 52M` |
| `nippon` | `Japan — JPY, +81, Asia/Tokyo, 127M` |
| `antarctica` | `Antarctica — Antarctica/Casey` |

A multi-word name works here and a multi-word time-zone alias
[does not](/guide/datetime#time-zones), because the two are indexed by different
things. Core's alias index is keyed on one segmented word — that is why `nyc`
can be a zone alias and `new york` cannot. The place kind carries its own trie
instead, walked a word at a time, longest match wins, and a match is always a
whole number of words. `newark` can therefore never be read as `new`.

The alternate names come from GeoNames, so the coverage is theirs: `nippon` and
`great britain` resolve, `uk` does not, because the row for `gb` lists
`united kingdom`, `britain` and `great britain` and no `uk`.

## A country is its own answer

`japan` returns a value whose *formatting* is the lookup. Name, currency,
calling code, capital's zone, population — there is no `population of japan`
grammar, because `of` needs a value on its left and `population` is not one,
and a prefix-attribute grammar for four attributes is a parser change nobody
should pay for. Rendering the facts costs a format function.

```ts
const { value } = engine.evaluate("japan");

value.kind;                 // "place"
value.unit;                 // "jp" — ISO 3166-1 alpha-2, lowercased
value.canonical.toString(); // "1861060" — the GeoNames feature id
value.meta;
// { geonameId: 1861060, zone: "Asia/Tokyo", currency: "JPY",
//   lat: 35.6895, lon: 139.69171, population: 126529100, country: "jp" }
```

Two places are the same place exactly when their canonicals match, which is
already what `Value` equality means — the GeoNames id is stable across data
refreshes in a way a name is not.

A fact the data does not carry is left out rather than printed empty, which is
why Antarctica renders as `Antarctica — Antarctica/Casey` and nothing else.
GeoNames writes `0` for the uninhabited territories, and that means "no figure"
rather than "nobody lives here", so a zero population prints nothing at all.

## Distance

```ts
engine.evaluate("ukraine to poland").formatted; // "688.971 kilometres"
engine.evaluate("france in germany").formatted; // "878.399 kilometres"
engine.evaluate("japan to japan").formatted;    // "0 kilometres"
```

`to` is one of `in`'s surface words in English, alongside `in` and `as`, so
`ukraine to poland` needs no new keyword and no new operator — it is the same
`in` that converts kilometres to miles, with a signature declared for
`in | place | place` that returns a `length`.

Two approximations, and the engine states one of them on the `Result`:

```ts
engine.evaluate("ukraine to poland").meta.assumptions;
// [ { code: "great-circle",
//     message: "Measured along the great circle between the two places.",
//     detail: { model: "sphere", radius: "6371008.8 m" } } ]
```

- **Great circle, on a sphere.** Not driving distance, which is what a person
  often means and which no free dataset provides. The sphere rather than the
  WGS84 ellipsoid disagrees by under 0.5%.
- **A country is its capital.** `ukraine to poland` is Kyiv to Warsaw, not
  border to border. That is the coarser of the two approximations by a long way,
  and it is the one the assumption does *not* name, because it is what the M6.1
  data is: one coordinate pair per country.

The result is in kilometres rather than the canonical metre, since nothing
rescales a formatted value and metres would print seven digits for most pairs of
countries.

## Codes are read as codes

An ISO code resolves only when it is written the way an ISO code is written —
with a capital in it.

| Input | Result |
| --- | --- |
| `japan to UA` | `8,198.981 kilometres` |
| `japan to ua` | `NoCandidateError` |
| `USA`, `Usa` | `United States — USD, +1, America/New_York, 327M` |
| `usa` | `UnitParseError` |
| `united states` | `United States — USD, +1, America/New_York, 327M` |

The rule is one line: a single word of four or more letters is claimed in any
case; anything shorter is claimed only if it carries a capital. It applies to
one-word matches alone — two words in a row are nobody's unit and nobody's
keyword.

It exists because the literal fold is **destructive**. Once `km` has been
claimed as Comoros, the kilometre reading is gone before the solver runs, and no
weight can bring it back. The two-letter codes are a minefield: `km` Comoros,
`kg` Kyrgyzstan, `lb` Lebanon, `in` India, `pm` Saint Pierre and Miquelon, `is`
Iceland, `it` Italy — and three-letter ones no better, with `and` Andorra and
`ago` Angola. Registering those as ordinary aliases turned `10 km` ambiguous,
`3pm` into a country, and `3 days ago` into nothing.

`MatchCtx.isUnitAlias` catches only the codes some other kind claims as a unit,
and `and`, `ago`, `is` and `it` are nobody's unit — so the guard is the case of
the word instead. The rejected alternative was a list of the short codes that
are also English words, which fails destructively on the first word the list
forgets. This fails by not recognising a lowercase code, and the country's full
name always covers that.

`packages/geo/corpus/en.tsv` carries `10 km` and `two hundred and five km` as
rows for exactly this reason, and the datetime and rates corpora are replayed in
full through an engine with `place` registered. A kind that adds words to a
global index can only be shown harmless input by input.

## The bridges

A place is a conversion target for two kinds that have never heard of it.

```ts
// with @smartput/datetime registered, at datetime's fixed test clock —
// 2026-01-15T12:00:00Z, in UTC
engine.evaluate("3pm in japan").formatted;      // "2026-01-16 00:00 JST"
engine.evaluate("noon in ukraine").formatted;   // "2026-01-15 14:00 Kyiv"
engine.evaluate("15:00 in argentina").formatted;
// "2026-01-15 12:00 America/Argentina/Buenos_Aires"

// with @smartput/rates registered, against the 2026-08-04 snapshot
engine.evaluate("100 usd in japan").formatted;  // "¥15,455"
engine.evaluate("100 eur in france").formatted; // "€100.00"
```

**Neither package depends on geo, in either direction.** Core declares one
interface, `PlaceMeta`, beside `RateLookup` and for the same reason. Geo
produces it. `datetime` declares `in | datetime | place` and reads a string off
`meta.zone`; `rates` declares `in | money | place` and reads a string off
`meta.currency`. Nobody imports anybody.

A signature naming a kind that is not registered is inert rather than an error:
the op table is keyed without checking that `left` and `right` exist, and with
geo absent the solver can never produce a `place` operand, so the entry is
simply never reached. That is what lets each bridge live in the package that
owns the *other* side of it.

The zone bridge reaches further than datetime's own table does.
`America/Argentina/Buenos_Aires` is not one of datetime's eighteen zones, so
`15:00 in argentina` is a conversion that is unreachable through datetime's
units and falls out of the bridge for free — the formatter prints the IANA id
because it has no symbol registered for it.

The money bridge discloses what it derived, exactly as a code-to-code conversion
does — `100 usd in japan` carries the `cross-rate` assumption for USD → JPY via
EUR. A country whose currency the snapshot cannot quote raises
`MissingRateError` naming the *currency*: `100 usd in vietnam` reports `VND`,
not `vn`, because a reader sent looking for `vn` in a currency table will not
find it.

## The data

252 rows, generated by `scripts/geo/build.ts` from the GeoNames
`countryInfo.txt`, `cities15000.txt`, `timeZones.txt` and `alternateNamesV2.txt`
dumps, and vendored as TypeScript. That is a deliberate trade: the package takes
on no npm data dependency and no upstream maintenance risk, and its runtime
dependencies stay at two — `@smartput/core` and `decimal.js`. The generated file
carries a hash of its own body and of each source dump, and a test recomputes
them, so a hand edit fails the suite.

The table is exported, because a consumer rendering a country picker wants the
rows and cannot re-derive them from the registry — the alias index carries names
only.

```ts
import { COUNTRIES } from "@smartput/geo";

COUNTRIES.find((c) => c.a2 === "jp");
// { a2: "jp", a3: "jpn", name: "Japan",
//   aliases: ["japan", "jpn", "jp", "giappone", "japon", "nihon", "nippon", "yaponiya"],
//   capital: "Tokyo", currency: "JPY", phone: "81",
//   population: 126529100, area: 377835,
//   lat: 35.6895, lon: 139.69171, zone: "Asia/Tokyo",
//   geonameId: 1861060, postalRegex: "^\\d{3}-\\d{4}$" }
```

Ten of the 252 needed a fallback for their capital's zone or position — no city
over 15,000 people, or no zone on the feature. The generated file lists all ten
by name in its header rather than resolving them silently.

### Attribution

GeoNames is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and the
licence requires the credit to travel with the data. The exact string is an
export, not a line in a README, because the data ships compiled into a
launcher's UI where nobody reads a README:

```ts
import { GEONAMES_ATTRIBUTION } from "@smartput/geo";
// "Country data from GeoNames (https://www.geonames.org/), licensed under
//  CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)."
```

Render it wherever the place data is visible.

## How it works

Two seams, both of them M4's, plus one parser change.

- **A literal matcher** — the same seam `@smartput/datetime` uses. Geo registers
  exactly one, offered `(input, offset, ctx)` at every token boundary; it walks
  its trie and returns a finished `Value` with the characters it claims. See
  [`Kind.literals`](/api/define-kind#literals).
- **An opaque kind's units are indexed like any other kind's**, so a country
  code is a unit, weighted and usable as an `in` target. Every place's `unit` is
  its country, which is what lets the distance op find a position even for an
  operand it did not claim itself.

The parser changed, and the design document said it would not. `15:00 in japan`
needs the *claimed* value on the right of `in` — the zone lives in its `meta` —
and the parser previously discarded it in favour of a stand-in built from the
unit name alone. It now carries a literal-claimed conversion target through to
`apply`. One user-visible side effect: `X in <literal>` used to throw
`UnitParseError` and now resolves a signature, so `today in tomorrow` returns a
datetime where it used to be an error.

## Not yet

M6.1 shipped the package, the kind, the countries and the two bridges. The rest
is planned and not present — reaching for it today gets an error, not a wrong
answer:

- **No cities.** `kyiv`, `new york` and `paris texas` do not parse.
  `kyiv to warsaw` does not parse. A capital is reachable only as its country,
  and `ukraine to poland` is the way to ask that question today. Cities,
  admin1 scoping (`paris texas`), population-scaled weights and `suggest()`
  ranking are M6.2.
- **No postal codes.** `SW1A 1AA` and `90210` are not places. The `postalRegex`
  is already on every row, unused, waiting for the postal literal in M6.3 —
  along with `PlaceProvider` and the GeoNames providers for the long tail the
  vendored data does not carry.
- **No completion.** `complete("jap")` returns nothing. Core's completion
  inserts `<number><unit>` and skips non-ratio kinds outright, so country
  completion needs to go through the matcher's trie rather than the alias index.
  That is M6.4, with postal format validation.
- **No geocoding, no reverse geocoding, no street addresses.** Not a milestone —
  a different product, and no free dataset carries them at quality.

## Next

- [Dates and time zones](/guide/datetime) — the other side of the zone bridge,
  and the literal-matcher seam in detail.
- [Money and rates](/guide/money) — the other side of the currency bridge.
- [Kinds and units](/guide/kinds) — where the value model comes from.

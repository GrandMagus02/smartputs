---
title: Places and distances
description: The place kind, countries and cities as values, postal codes and their formats, admin1 scoping, great-circle distance, prefix completion, the GeoNames providers, and the datetime and rates bridges.
---

# Places and distances

`@smartput/country` adds one kind. Once it is registered, `japan` is a value the way
`5 kg` is a value: it has a unit — its ISO 3166-1 alpha-2 code — it formats to
its facts, and it takes part in one operation.

```sh
bun add @smartput/country
```

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { place } from "@smartput/country";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const en = composeLocale(english, BUILTIN_EN);

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, place],
});

engine.evaluate("japan").formatted;           // "Japan — JPY, +81, Asia/Tokyo, 127M"
engine.evaluate("japan to france").formatted; // "9,712.518 kilometres"
```

`length` has to be registered beside it, because the distance op resolves to a
length — `BUILTIN_KINDS` covers that. There is no engine option and no
vocabulary to install: the place names are the data, and the data ships in the
package. `@smartput/country/locale/en` exists and carries the unit words, but
nothing above needs it, because a place is recognised by a literal matcher
rather than through the alias index.

::: warning It stops being optional next to `datetime`
Register `place` and `datetime` together and the vocabulary starts to matter.
Measured on that pair: without it, `3pm in tokyo` raises
`DimensionMismatchError` and `3pm in japan` comes back as 10,708 kilometres —
the [zone bridge](/guide/datetime) loses to the distance signature. Install
`@smartput/country/locale/en` beside `@smartput/datetime/locale/en` and both
read as zone conversions again.
:::

`place` is countries and [postal codes](#postal-codes). Cities are a second
package and a factory call, and the section on
[turning cities on](#turning-cities-on) is why they are not simply there. The
long tail below the shipped data — a village, the coordinates of one postcode —
is [a provider](#providers-and-t2) and a network call.

## The four packages

What used to be one `@smartput/geo` is four, layered so the graph runs one way.
Three of them are usable on their own; the fourth is where they meet.

| Package | What it is | Depends on |
| --- | --- | --- |
| `@smartput/zip` | The postal literal matcher and the format validator, over rows you hand it | core |
| `@smartput/city` | The T1 gazetteer: 6,247 cities, 1,664 divisions, two row types, no code | nothing |
| `@smartput/distance` | `PlaceDistance` — the great-circle op, over the table its kind registered | core, zip |
| `@smartput/country` | The T0 table and the `place` kind assembled out of the other three | all of them |

The direction is what makes the split worth having. `@smartput/country` names
`createPostalLiteral` and `PlaceDistance`, so neither of those packages can name
it back — which is why both take their data as an argument and ship none. A form
field that validates postcodes installs `@smartput/zip` and gets no gazetteer;
`POSTAL_FORMATS` in `@smartput/country` is that same validator with the shipped
252 rows behind it.

The edge from `@smartput/country` to `@smartput/city` is `import type` from the
`/types` subpath and compiles away, which is what keeps the 234 KB of cities out
of a bundle that only wanted countries. See
[turning cities on](#turning-cities-on).

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

<SpPlace />

A multi-word name works here and a multi-word time-zone alias
[does not](/guide/datetime#time-zones), because the two are indexed by different
things. Core's alias index is keyed on one segmented word — that is why `nyc`
can be a zone alias and `new york` cannot. The place kind carries its own trie
instead, walked a word at a time, longest match wins, and a match is always a
whole number of words. `newark` can therefore never be read as `new`.

The alternate names come from GeoNames, so the coverage is theirs: `nippon` and
`great britain` resolve, `uk` does not, because the row for `gb` lists
`united kingdom`, `britain` and `great britain` and no `uk`.

## Turning cities on

Cities live in a package of their own and arrive as an argument:

```ts
import { createEngine } from "@smartput/core";
import { definePlace } from "@smartput/country";
import { ADMIN1, CITIES } from "@smartput/city";
import { BUILTIN_KINDS } from "@smartput/kinds";

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, definePlace({ cities: CITIES, admin1: ADMIN1 })],
});

engine.evaluate("kyiv").value.canonical.toString();  // "703448"
engine.evaluate("kyiv to warsaw").formatted;         // "688.971 kilometres"
engine.evaluate("houston texas").value.canonical.toString(); // "4699066"
```

`definePlace()` with no options is exactly what the exported `place` is, so the
countries-only build is a call nobody has to make. Both options are independent:
`{ cities: CITIES }` gives a gazetteer with no scoped names, which is a smaller
table and a strictly smaller feature.

Each call returns a fresh `Kind`, and two of them cannot share one registry —
both are `id: "place"`. A build picks its tier once.

<SpCity />

### Why it is a factory and not a flag

The measurement, on a minified browser bundle, gzipped, each row cumulative on
the one above it:

| Bundle | gzip | what that row added |
| --- | --- | --- |
| core + `BUILTIN_KINDS` | 24.4 KB | — the floor |
| `+ place` | 51.5 KB | **+27 KB** for 252 countries |
| `+ definePlace({ cities, admin1 })` | 285.1 KB | **+234 KB** for cities and divisions |

Cities cost nearly nine times what the whole countries tier does. That is the
entire reason `place.ts` does not import `data/cities.ts` — not a style
preference. A static
import links the gazetteer into every bundle that touches `@smartput/country`, and
no bundler can prove `CITIES` unused once a kind has closed over it. Tiering is
only real if the dependency edge runs from the consumer inwards, so the
consumer is the one who names `@smartput/city`. Probing the countries-only
bundle for `chelyabinsk`, `fukuoka`, `texas`, `bavaria` and `springfield` finds
none of them; all five are in the other one.

### What T1 carries

6,247 cities: every one over 100,000 people, plus all 241 seats of government
whatever their size — which is why Nuku'alofa is in and Springfield, Illinois is
in at 114,394 while Paris, Texas at 25,171 is not.

| Input | Result |
| --- | --- |
| `kyiv` | GeoNames `703448` |
| `kiev` | `703448` — the same row |
| `new york` | `5128581` |
| `big apple` | `5128581` |
| `nyc` | `UnitParseError` — GeoNames does not list it for `5128581`, and three letters would be refused anyway |
| `nice`, `mobile`, `reading`, `split` | places, all four over 100,000 people |

City alternate names are filtered to the GeoNames `en` and `abbr` language tags.
The blank tag, which the country builder does use, holds exonyms for a city —
`Genf`, `Njujork` — so filtering it out is what keeps transliterations of other
scripts from entering an English trie. `kiev`, `big apple` and `new york city`
survive because GeoNames tags them English.

1,664 first-level divisions ship beside the cities as `ADMIN1`. A division is
**not a place**: the row carries a name and aliases and nothing else, no id and
no coordinates, so `texas` on its own is not a value and never resolves.
Divisions exist only to be walked into as a scope.

### Scoped names

`houston texas` is claimed as **one** literal, not as an operation. The trie
leaf carries the divisions and countries its cities sit in, so a scope is a
longer walk down the map already being walked. Keeping it there is what leaves
`in | place | place` meaning exactly one thing — the rejected alternative,
`paris in us` as a filter, would have put distance and filtering behind one
signature and forced a runtime branch on feature class inside one `apply`.

| Input | Result |
| --- | --- |
| `springfield illinois` | `4250542` |
| `springfield massachusetts` | `4951788` |
| `san jose california` | `5392171` |
| `cambridge massachusetts` | `4931972` — unscoped `cambridge` is the English one, `2653941` |
| `columbus ohio` | `4509177` |
| `richmond virginia` / `richmond california` | `4781708` / `5387428` |
| `houston tx` | `4699066` — same as `houston texas` |
| `sydney new south wales` | `2147714` — four words, the longest form there is |
| `athens greece` | `264371` — a country scopes by the same walk |

A scope narrows; it does not re-rank. `athens greece` and a bare `athens` agree,
because the scope selects among the rows the trie already ranked rather than
scoring them again.

Three shapes do not work, and each fails for its own reason:

- **`springfield il` throws.** Only 26 of the 1,664 divisions keep a two-letter
  abbreviation. `tx`, `ny`, `oh`, `wa`, `fl` survive; `il` is Israel's alpha-2,
  `in` is a conversion keyword, `ca` is Canada and `or` is a conjunction, so all
  four were struck out of the division aliases before the table shipped. See
  [reserved words](#the-words-a-place-may-not-eat).
- **`paris texas` throws** — the design document's own worked example. Paris,
  Texas is 25,171 people, so this tier has exactly one Paris. The scope finds no
  US row, the claim falls back to the unscoped French city, and `texas` is left
  dangling as a word nothing parses. Nothing is wrong with Texas:
  `houston texas` resolves.
A division whose name is also a country's works like any other:
`athens georgia` is `4180386` and `columbus georgia` is `4188985`, while a bare
`georgia` is still the country. The scope only wins when a candidate city really
is in that division, so there is nothing for the country reading to lose.

### Ranking

Every claim carries a weight, and these four are all of them:

| Case | Weight |
| --- | --- |
| Country | `+3` |
| Capital city | `+2` |
| Any other city | `+min(log10(population) / 3, 2)` |
| Scoped match | `+4` — the user was explicit |

```ts
engine.evaluate("athens").value.canonical.toString();      // "264371"  Greece
engine.evaluate("san jose").value.canonical.toString();    // "3621849" Costa Rica
engine.evaluate("springfield").value.canonical.toString(); // "4409896" Missouri
engine.evaluate("georgia").value.canonical.toString();     // "614540"  the country
```

- **`athens`** is the Greek capital at `+2` over Athens, Georgia at `+1.70`.
- **`san jose`** proves the capital rule is not population wearing a disguise:
  San José, Costa Rica is 335,007 people and San Jose, California is 997,368,
  and the capital still wins — by 0.0004.
- **`springfield`** has no capital among its three, so population is the whole
  ranking and Missouri's 170,188 beats Illinois' 114,394. The design document
  predicted Illinois; the weight is a function of the data, not of the example.
- **`georgia`** is the country at `+3`, and the state is not ranked below it so
  much as absent — a division is not a place, so there is nothing to compare.

`suggest()` returns the runners-up, ranked:

```ts
engine.suggest("springfield").map((r) => r.formatted);
// [ "Springfield, US — USD, +1, America/Chicago, 170K",
//   "Springfield, US — USD, +1, America/New_York, 154K",
//   "Springfield, US — USD, +1, America/Chicago, 114K" ]

engine.suggest("athens").map((r) => r.formatted);
// [ "Athens, GR — EUR, +30, Europe/Athens, 664K",
//   "Athens, US — USD, +1, America/New_York, 127K" ]
```

`evaluate()` still decides — `springfield` is Missouri and `athens` is Greece.
The matcher hands over every reading of the span it claimed; the solver ranks
them and `evaluate()` takes the top one, which is exactly how it has always
treated two readings of an ordinary word.

That is a change in M6.3, and it needed core's matcher contract widened: a
`LiteralMatcher` may now return an array of readings of the same text, and the
literal fold groups them instead of keeping one. See
[`LiteralMatcher`](/api/types#returning-more-than-one-reading).

**The weights above are the winner's.** Once the runners-up are scored rather
than merely sorted, the engine's ambiguity guard sees them, and the table's own
figures are too close together for it: San José, CR beats San Jose, CA by 0.0004
and the three Springfields sit 0.058 apart, where `ambiguityEpsilon`'s default
needs roughly 0.15. Emitted verbatim, 91 city names — `barcelona`, `hyderabad`,
`santiago`, `valencia`, `newcastle` among them — would stop resolving and raise
`AmbiguityError` instead. So the matcher clamps each reading to at least 0.5
below the one above it. Downwards only: the winner keeps the weight the table
gives it, because that is the number a place carries into a comparison with a
time zone or a currency, and a Tokyo that got heavier for having homonyms would
let the size of the gazetteer decide a question between two kinds.

### What a city formats to

A city renders itself, qualified by its country's code:

```ts
engine.evaluate("vancouver").formatted;
// "Vancouver, CA — CAD, +1, America/Vancouver, 662K"
engine.evaluate("canada").formatted;
// "Canada — CAD, +1, America/Toronto, 37M"
```

The name, zone and population are the city's own; currency and calling code are
the country's, because they are the country's. A country is told from a city by
its GeoNames id rather than by a flag — §4.2 already makes the id the canonical,
so nothing extra is stored to answer the question.

This is worth a note because it was wrong at first. The formatter read every
fact off the country row, so `athens` came back "Greece — EUR, +30,
Europe/Athens, 11M" while the same Value's `meta.population` said 664,046, and
every US city rendered the identical "United States" string. The fix was to
carry the place's own `name` in `PlaceMeta`; the alternative — closing
`formatPlace` over the city table — would have linked the whole gazetteer into
the countries-only bundle and undone the entry-point split above.

### Cities datetime also names

Seventeen city names are also aliases of datetime's eighteen hand-written IANA
zones:

```
auckland  beijing  berlin  chicago  delhi  denver  dubai  kiev  kolkata
kyiv  london  moscow  mumbai  paris  shanghai  sydney  tokyo
```

Both readings survive, and the signature decides which one the sentence wanted:

```ts
// engine: BUILTIN_KINDS + datetime + place-with-cities
engine.evaluate("3pm in tokyo").formatted;    // "2026-01-16 00:00 JST"
engine.evaluate("tokyo to kyoto").formatted;  // "364.743 kilometres"
engine.evaluate("kyiv to warsaw").formatted;  // "688.971 kilometres"
engine.evaluate("chicago to denver").formatted; // "1,475.384 kilometres"
```

`in | datetime | place` has no competing signature and neither does
`in | place | place`, so neither input needs a tiebreak. `3pm in tokyo` is
byte-identical with and without the place kind registered.

Until M6.3 this section documented the opposite: all seventeen threw, because a
single-word city claim yielded to any word another kind had registered as a unit.
That guard existed only because the literal fold was destructive — a claim that
was made was the only claim there was, so yielding was the one non-destructive
answer a matcher had. The fold now keeps the token under a single-token claim, so
the city and the zone are both candidates and the guard is gone.

One rough edge left: `suggest("3pm in tokyo")` returns two results with identical
formatted output, the place bridge and the zone alias. Both are genuine readings,
but a launcher list shows a duplicate row.

### The words a place may not eat

A country name is a proper noun no locale uses for anything else. City names are
not: Nice, Mobile, Reading and Split are all cities over 100,000, and a table
reaching further down finds March, Boring and Why. So the generator filters every
city and division alias through `RESERVED_WORDS` — 805 words that some other part
of the engine already owns.

The set is **derived, never transcribed**, from six vocabularies:

| Source | Words contributed |
| --- | --- |
| core's `locale/en` keywords | 11 |
| `@smartput/number`'s `NUMBER_WORDS` | 35 |
| `Intl` months and weekdays, long and short | 38 |
| chrono's `en.casual` parser patterns, read off `parser.pattern().source` | 1,027 |
| `BUILTIN_KINDS` unit ids, aliases, symbols and display forms | 338 |
| the place kind's own country codes below four characters | 508 |

Plus exactly one hand-written entry, `or`, for Oregon — no kind, keyword or
numeral produces the conjunction, so no source can derive it, and it is pruned
automatically if one ever starts. A hand-written list fails on the word it
forgets, and the fold gives that failure no second chance; a derived one fails
only when a package changes its vocabulary without regenerating, which a body
hash catches.

Where it actually earns its keep is divisions. **Zero** city aliases were refused
by it — the four-character minimum removes every name short enough to be a
keyword first — but it takes `in` from Indiana, `or` from Oregon, `ca` from
California and `il` from Illinois. Without that, `paris in ukraine` would claim
`paris in` as a city in Indiana and swallow the conversion keyword.

`COUNTRIES` is deliberately *not* filtered by it. The matcher already refuses
every lowercase short code by surface, and filtering the country table would take
`japan to UA` with it.

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

A city's `meta` has the same shape, its own numbers, and its country's currency
and unit:

```ts
engine.evaluate("kyiv").value.unit; // "ua"
engine.evaluate("kyiv").value.meta;
// { geonameId: 703448, zone: "Europe/Kyiv", currency: "UAH",
//   lat: 50.45466, lon: 30.5238, population: 2952301, country: "ua" }
```

A city is never a unit. Six thousand names in the global alias index is the same
destructive failure the country codes were, at twenty-five times the size, so a
city is reachable only through the matcher's trie — where a claim can be refused
by surface, by neighbour and by reserved word before the fold consumes the token.
It borrows its country's alpha-2 instead, which is why `meta.country` still
equals `Value.unit` for a city.

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

// with cities registered
engine.evaluate("kyiv to warsaw").formatted;    // "688.971 kilometres"
engine.evaluate("paris to berlin").formatted;   // "878.399 kilometres"
engine.evaluate("kyoto to osaka").formatted;    // "43.085 kilometres"
```

`kyiv to warsaw` and `ukraine to poland` agree to the metre, and that is not a
coincidence: a country's position *is* its capital's, so the two inputs reach the
same pair of points by different routes through the trie. Cities are what make
the question askable at any other scale — `kyoto to osaka` has no country-level
form at all.

`to` is one of `in`'s surface words in English, alongside `in` and `as`, so
`ukraine to poland` needs no new keyword and no new operator — it is the same
`in` that converts kilometres to miles, with a signature declared for
`in | place | place` that returns a `length`.

Two approximations, and the engine states one of them on the `Result`:

```ts
engine.evaluate("kyiv to warsaw").meta.assumptions;
// [ { code: "great-circle",
//     message: "Measured along the great circle between the two places.",
//     detail: { model: "sphere", radius: "6371008.8 m" } } ]
```

- **Great circle, on a sphere.** Not driving distance, which is what a person
  often means and which no free dataset provides. The sphere rather than the
  WGS84 ellipsoid disagrees by under 0.5%.
- **A country is its capital.** `ukraine to poland` is Kyiv to Warsaw, not
  border to border. That is the coarser of the two approximations by a long way,
  and it is the one the assumption does *not* name, because it is what a country
  row is: one coordinate pair. A city carries its own, so this approximation
  disappears the moment both operands are cities.

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

A city gets no such exemption. A single-word city name must be four characters or
more *and* absent from `RESERVED_WORDS` *and* unclaimed by any registered unit —
in every case, since the escape hatch that rescues `UA` is a country's alone.
Capitalising a short city name changes nothing. The generator applies the same
four-character minimum before emitting, so no city alias below it exists to be
claimed in the first place; the runtime check is the second of two nets. What
that minimum costs is [65 cities](#the-data) that had no longer name.

The whole rule exists because the literal fold is **destructive**. Once `km` has
been claimed as Comoros, the kilometre reading is gone before the solver runs,
and no weight can bring it back. The two-letter codes are a minefield: `km`
Comoros, `kg` Kyrgyzstan, `lb` Lebanon, `in` India, `pm` Saint Pierre and
Miquelon, `is` Iceland, `it` Italy — and three-letter ones no better, with `and`
Andorra and `ago` Angola. Registering those as ordinary aliases turned `10 km`
ambiguous, `3pm` into a country, and `3 days ago` into nothing.

`MatchCtx.isUnitAlias` catches only the codes some other kind claims as a unit,
and `and`, `ago`, `is` and `it` are nobody's unit — so the guard is the case of
the word instead. The rejected alternative was a list of the short codes that
are also English words, which fails destructively on the first word the list
forgets. This fails by not recognising a lowercase code, and the country's full
name always covers that.

`packages/country/corpus/en.tsv` carries `10 km` and `two hundred and five km` as
rows for exactly this reason, and every corpus in the repo — core's, datetime's,
rates' and the place kind's own — is replayed through an engine with the full 6,247-name
trie registered. A kind that adds words to a global index can only be shown
harmless input by input. What that replay found is that registering the tier only
ever turns nothing into something: no input that had a reading changed it, and
`nice`, `mobile`, `reading` and `split` went from `UnitParseError` to a place.

## Postal codes

A postal code is a place. The matcher ships in both builds — the format is one
column of the country table, so it costs nothing extra and does not wait on the
gazetteer:

```ts
// engine: BUILTIN_KINDS + place  (countries only is enough)
engine.evaluate("SW1A 1AA").formatted;
// "SW1A 1AA, GB — GBP, +44, Europe/London, 66M"
engine.evaluate("M5V 3L9").formatted;
// "M5V 3L9, CA — CAD, +1, America/Toronto, 37M"
engine.evaluate("us 90210").formatted;
// "90210, US — USD, +1, America/New_York, 327M"
engine.evaluate("100-0001 japan").formatted;
// "100-0001, JP — JPY, +81, Asia/Tokyo, 127M"
```

178 of the 252 country rows carry a format. The remaining 74 have no postal
system GeoNames records one for.

### Three shapes, and only one of them is fussy

| Shape | Example | Claimed |
| --- | --- | --- |
| Qualified by a country | `us 90210`, `90210 us`, `100-0001 japan` | anywhere |
| Unqualified, carrying a letter | `SW1A 1AA`, `M5V 3L9`, `AD123` | anywhere |
| Unqualified, no letter | `90210`, `123 45`, `01310-100` | **only as the whole input** |

Sixty countries have a format that fits five bare digits and forty-three fit
four. Without that third rule every 3-to-6-digit number in every expression would
carry a place candidate nobody asked for:

```ts
engine.evaluate("90210 + 1").formatted;    // "90,211"
engine.evaluate("12345 - 6789").formatted; // "5,556"
```

A bare code is a lookup; the moment an operator or a unit sits beside it, the
user is doing arithmetic.

### `90210` is still a number

```ts
engine.evaluate("90210").formatted;              // "90,210"
engine.suggest("90210").map((r) => r.formatted);
// [ "90,210", "90210, US — USD, +1, America/New_York, 327M" ]
```

Nothing is hidden to make that happen — the postal claim is simply outweighed.
A claim over a single token leaves that token readable underneath it, and a
digits-only code deliberately weighs less than the number does. Everything else
weighs what a country weighs, `+3`, because what the matcher produces *is* a
country's value reached through a code rather than through a name.

Bare digits keep exactly one reading, where a lettered code keeps all of them:

```ts
engine.suggest("SW1A 1AA").map((r) => r.formatted);
// [ "SW1A 1AA, GB — GBP, +44, Europe/London, 66M",
//   "SW1A 1AA, JE — GBP, +44-1534, Europe/Jersey, 91K",
//   "SW1A 1AA, IM — GBP, +44-1624, Europe/Isle_of_Man, 84K",
//   "SW1A 1AA, GG — GBP, +44-1481, Europe/Guernsey, 65K" ]

engine.suggest("123 45").map((r) => r.formatted);
// [ "123 45, CZ — CZK, +420, Europe/Prague, 11M",
//   "123 45, SE — SEK, +46, Europe/Stockholm, 10M",
//   "123 45, SK — EUR, +421, Europe/Bratislava, 5.4M" ]
```

Four countries share the British format and three share Sweden's, and those are
alternatives a user could actually pick between. Sixty countries accepting five
digits are not — the shape carries no country in it at all, and sixty rows under
the number would bury the number's own. Naming the country is how the other
fifty-nine are reached.

### What a code's value is

The country, addressed by a code. There are no coordinates for a postal code in
the vendored data, so it borrows the country's:

```ts
const { value } = engine.evaluate("us 90210");
value.kind;                 // "place"
value.unit;                 // "us"
value.canonical.toString(); // "0" — GeoNames issues no feature id for a code
value.meta;
// { geonameId: 0, name: "90210", zone: "America/New_York", currency: "USD",
//   lat: 38.89511, lon: -77.03637, population: 327167434, country: "us" }

engine.evaluate("us 90210 to japan"); // throws UnpositionedPlaceError
```

The borrowed coordinates keep the rest of the Value usable — the zone, the
currency, the country — but they are not a position the code has, so measuring
from them is refused rather than answered.

That is a deliberate reversal. Measuring the borrowed point at first returned an
answer, and the answer was wrong in a way nothing on screen admitted: every pair
of codes in one country came out `0 kilometres`, so `SW1A 1AA to EH1 1YZ` —
London to Edinburgh — measured zero. An engine that throws `AmbiguityError`
rather than pick between two readings should not hand back a confident zero
here. Real coordinates for a code need [a provider](#providers-and-t2), and the
error message says so.

A code is a conversion target like any other place:

```ts
// with @smartput/datetime, at its fixed test clock — 2026-01-15T12:00:00Z
engine.evaluate("3pm in us 90210").formatted;     // "2026-01-15 10:00 ET"
// with @smartput/rate
engine.evaluate("100 usd in us 90210").formatted; // "$100.00"
```

Both read the country's fact, not the code's: the zone is Washington's and the
currency is the country's, exactly as they are for `us`.

### Three edges worth knowing

**`usa 90210` does not resolve; `us 90210` does.** A qualifier shorter than four
characters has to be the alpha-2, because the alpha-3 column is where `and` is
Andorra, `ago` is Angola and `can` is Canada — the same rule that keeps
[lowercase codes](#codes-are-read-as-codes) out of the trie, applied to the
qualifier slot.

**A unit symbol beside a number wins.** The Netherlands' format is `#### @@`,
which is exactly a four-digit quantity next to a two-letter unit:

```ts
engine.evaluate("1234 kg").formatted;    // "1,234 kilograms"
engine.evaluate("nl 1234 kg").formatted;
// "1234 kg, NL — EUR, +31, Europe/Amsterdam, 17M"
```

`1234 kg` is a real Kerkrade postcode, and it is reachable by naming the country
— the same trade `90210` makes against `us 90210`. Without the guard, `1000 ms`,
`5000 mi` and `1234 cm` would all be Dutch postcodes too.

**Two shapes take an answer away.** `12345-6789` is a US ZIP+4 and `01310-100` is
a Brazilian CEP, and both used to be subtractions:

```ts
engine.evaluate("12345-6789").formatted;
// "12345-6789, US — USD, +1, America/New_York, 327M"   (5,556 without places)
engine.evaluate("01310-100").formatted;
// "01310-100, BR — BRL, +55, America/Sao_Paulo, 209M"  (1,210 without places)
```

These are the only two answers registering the place kind takes from an engine
that already had one. The whole-input rule contains them — `12345 - 6789` spaced
out is still 5,556, and nothing embedded in a larger expression is touched — but
`suggest()` cannot offer the number underneath, because the claim spans three
tokens and only a single-token claim leaves its token readable. If you evaluate
untrusted arithmetic, this is the case to know about.

## The bridges

A place is a conversion target for two kinds that have never heard of it.

```ts
// with @smartput/datetime registered, at datetime's fixed test clock —
// 2026-01-15T12:00:00Z, in UTC
engine.evaluate("3pm in japan").formatted;      // "2026-01-16 00:00 JST"
engine.evaluate("noon in ukraine").formatted;   // "2026-01-15 14:00 Kyiv"
engine.evaluate("15:00 in argentina").formatted;
// "2026-01-15 12:00 America/Argentina/Buenos_Aires"

// with cities, the zone is the city's own
engine.evaluate("noon in vancouver").formatted;
// "2026-01-15 04:00 America/Vancouver"
engine.evaluate("3pm in houston texas").formatted; // "2026-01-15 09:00 CT"

// with @smartput/rate registered, against the 2026-08-04 snapshot.
// A city has no currency of its own, so it borrows its country's.
engine.evaluate("100 usd in japan").formatted;  // "¥15,455"
engine.evaluate("100 usd in kyoto").formatted;  // "¥15,455"
engine.evaluate("100 usd in kyiv").formatted;   // "₴4,136.36"
```

**Neither package depends on the place kind, in either direction.** Core declares one
interface, `PlaceMeta`, beside `RateLookup` and for the same reason. Geo
produces it. `datetime` declares `in | datetime | place` and reads a string off
`meta.zone`; `rates` declares `in | money | place` and reads a string off
`meta.currency`. Nobody imports anybody.

A signature naming a kind that is not registered is inert rather than an error:
the op table is keyed without checking that `left` and `right` exist, and with
the place kind absent, the solver can never produce a `place` operand, so the entry is
simply never reached. That is what lets each bridge live in the package that
owns the *other* side of it.

The zone bridge reaches further than datetime's own table does.
`America/Vancouver` and `America/Argentina/Buenos_Aires` are not among datetime's
eighteen zones, so those conversions are unreachable through datetime's units and
fall out of the bridge for free — the formatter prints the IANA id because it has
no symbol registered for it. Where datetime *does* have a symbol, as for
`America/Chicago`, the city inherits it: `3pm in houston texas` prints `CT`.

The money bridge discloses what it derived, exactly as a code-to-code conversion
does — `100 usd in japan` carries the `cross-rate` assumption for USD → JPY via
EUR. A country whose currency the snapshot cannot quote raises
`MissingRateError` naming the *currency*: `100 usd in vietnam` reports `VND`,
not `vn`, because a reader sent looking for `vn` in a currency table will not
find it.

## The data

252 country rows, 6,247 city rows and 1,664 division rows, generated by
`scripts/geo/build.ts` from the GeoNames `countryInfo.txt`, `cities15000.txt`,
`admin1CodesASCII.txt`, `timeZones.txt` and `alternateNamesV2.txt` dumps, and
vendored as TypeScript. That is a deliberate trade: no package here takes on an
npm data dependency or the upstream maintenance risk that comes with one, and
the runtime dependencies outside the four stay at two — `@smartput/core` and
`decimal.js`. Each generated file carries a
hash of its own body and of each source dump, and a test recomputes them, so a
hand edit fails the suite. Two consecutive builds produce byte-identical output.

The tables are exported, because a consumer rendering a country or city picker
wants the rows and cannot re-derive them from the registry — the alias index
carries names only, and cities are not in it at all.

```ts
import { COUNTRIES } from "@smartput/country";
import { ADMIN1, CITIES } from "@smartput/city";

COUNTRIES.find((c) => c.a2 === "jp");
// { a2: "jp", a3: "jpn", name: "Japan",
//   aliases: ["japan", "jpn", "jp", "giappone", "japon", "nihon", "nippon", "yaponiya"],
//   capital: "Tokyo", currency: "JPY", phone: "81",
//   population: 126529100, area: 377835,
//   lat: 35.6895, lon: 139.69171, zone: "Asia/Tokyo",
//   geonameId: 1861060, postalRegex: "^\\d{3}-\\d{4}$" }
```

Ten of the 252 countries needed a fallback for their capital's zone or position —
no city over 15,000 people, or no zone on the feature. The generated file lists
all ten by name in its header rather than resolving them silently.

**65 cities over 100,000 people are missing entirely**, because every one of
their aliases was refused: too short (`Ufa` 1.1M, `Fes` 1.19M, `Jos` 1.04M, `Qom`
900k, `Huế` 1.38M), over four words (`São José do Rio Preto` 480k), or a shape
the alias rule will not take — a dot, a comma, a leading digit, a leading
apostrophe. Each is named with its reason in `data/cities.ts`'s header. Short
names are the real cost of this tier and the obvious candidate for a curated
alias allowance later.

### Attribution

GeoNames is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and the
licence requires the credit to travel with the data. The exact string is an
export, not a line in a README, because the data ships compiled into a
launcher's UI where nobody reads a README:

```ts
import { GEONAMES_ATTRIBUTION } from "@smartput/country";
// "Country data from GeoNames (https://www.geonames.org/), licensed under
//  CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)."
```

Render it wherever the place data is visible. The string still says "Country
data" and the cities come from the same dump under the same licence, so it
covers them; the wording is worth widening the next time that file is touched.

## Providers and T2

The vendored tiers stop at 6,247 cities and 252 country-level postal formats.
Everything below that — the villages, the hamlets, and the coordinates of an
individual postal code — is a network call, and it lives behind a subpath:

```sh
@smartput/country/providers
```

It carries no data of its own, and no consumer who only wants the vendored tiers
links a fetch they never make.

### The shape

```ts
interface Place extends PlaceMeta {
  readonly admin1: string;  // "TX", "11", or "" where upstream has none
  readonly postal: string;  // the code this row was found under, "" otherwise
}

interface PlaceLookup   { find(name: string, hint?: PlaceHint): Place | null }
interface PlaceSnapshot extends PlaceLookup { readonly asOf: string }
interface PlaceProvider { readonly id: string; lookup(q: string): Promise<Place[]> }
interface PlaceHint     { readonly country?: string; readonly admin1?: string }
```

`Place` extends core's `PlaceMeta`, the same interface the datetime and rates
bridges read, so a provider row drops into a Value's `meta` with no adapter in
between — and no second field list to drift away from the one the bridges use.

**What a provider cannot know, it leaves empty rather than inventing.** `zone` is
`""` on every postal row: neither upstream carries one, and defaulting to the
capital's zone would put a confident wrong answer behind the zone bridge, since
Beverly Hills is not on New York time. `currency` is `""` everywhere, because it
is a country-level fact that `COUNTRIES` already holds — join on `country`.
`geonameId` is `0` on a postal row, which means two postal rows compare equal
under place equality; that is the known cost of not inventing a synthetic id
that would look stable and one day collide with a real one.

### GeoNames

```ts
import { geonames } from "@smartput/country/providers";

const gn = geonames({ username: "your-account" });

await gn.lookup("dar es salaam");
// [ { geonameId: 160263, name: "Dar es Salaam", zone: "Africa/Dar_es_Salaam",
//     currency: "", lat: -6.82349, lon: 39.26951, population: 5383728,
//     country: "tz", admin1: "23", postal: "" }, … ]

await gn.postal("44657", "us");
// [ { geonameId: 0, name: "Minerva", zone: "", currency: "",
//     lat: 40.742049, lon: -81.103076, population: 0,
//     country: "us", admin1: "OH", postal: "44657" } ]
```

Two methods, because GeoNames has two indexes and a code is not a toponym —
`searchJSON` with `q=44657` finds nothing at all. Guessing which index a query
wants from its shape decides wrongly, and silently, for every country whose codes
contain letters.

Three things to expect from the service itself:

- **The account needs enabling by hand** for the free web service after signup.
  Until it is, every call returns HTTP 200 with an error envelope in the body.
  So does an exhausted quota and a malformed query. The provider checks the
  envelope before the payload and raises `PlaceProviderError`, because a caller
  retrying on "no results" would spin on that forever.
- **The default host is `secure.geonames.org`**, not the `api.geonames.org` the
  docs print — `api` resolves but its certificate names only `secure`, so every
  https request to it fails the hostname check. Same service, same account.
- **Nothing is cached and nothing is rate-limited here.** The credits are yours
  to spend; the cache is the next section.

### Postal codes from a mirror

```ts
import { postalCodes } from "@smartput/country/providers";

const zip = postalCodes({ url: "https://your-mirror.example/{country}.json" });

await zip.lookup("us 90210");
// [ { geonameId: 0, name: "Beverly Hills", zone: "", currency: "",
//     lat: 34.0901, lon: -118.4065, population: 0,
//     country: "us", admin1: "CA", postal: "90210" } ]
```

It reads the [zauberware collection](https://github.com/zauberware/postal-codes-json-xml-csv)
(CC BY 4.0), which is GeoNames' postal export republished per country as JSON.
There is **no default URL**: the collection is a few hundred megabytes published
as zips rather than as an API, and defaulting to any host would hardcode a third
party's bandwidth as this package's transport. `{country}` in the URL takes the
alpha-2 lowercased and `{COUNTRY}` uppercased, since a mirror may have kept
either.

A country file is fetched whole and kept — `us` is 12 MB and 41,490 codes — so
the internal cache is what makes this usable rather than an optimisation. A
lookup naming no country throws instead of guessing: `1000` is Brussels, Sofia,
Manila and Ljubljana.

Both the query forms the matcher claims are accepted, so the string a matcher
claimed is the string a provider is handed: `lookup("us 90210")` and
`lookup("90210 us")` return the same row, and `SW1A 1AA` survives intact because
neither of its tokens is two letters.

### A snapshot

```ts
import { placeSnapshot } from "@smartput/country/providers";

const snap = placeSnapshot("2026-08-05", await zip.lookup("us 90210"));

snap.asOf;                            // "2026-08-05"
snap.find("Beverly Hills")?.postal;   // "90210"
snap.find("90210")?.name;             // "Beverly Hills"
snap.find("90210", { admin1: "CA" })?.name; // "Beverly Hills"
snap.find("90210", { admin1: "NY" }); // null
snap.find("atlantis");                // null
```

A code is indexed as one more name the row answers to, in the same map as its
place name, so `find` is one call and one miss path — it is handed a string, not
a claim about what kind of string it is. Names are matched case- and
whitespace-insensitively; diacritics are **not** stripped, because the matcher's
trie does not strip them either and a lookup that disagreed with the matcher
about what one name is would be the worse bug.

A hint that selects nothing returns `null` rather than the unhinted winner. You
asked a narrower question, and answering it with Paris, France would be a wrong
answer in place of a true one.

### Keeping it fresh

Core ships the caching half, lifted out of `@smartput/rate` so more than one
package can use it:

```ts
import { createSnapshotCache } from "@smartput/core";
import { placeSnapshot, type PlaceSnapshot } from "@smartput/country/providers";

const cache = createSnapshotCache<PlaceSnapshot>({
  ttlMs: 60 * 60 * 1000,
  load: async () => placeSnapshot(today(), await zip.lookup("90210")),
});

const [a, b, c] = await Promise.all([cache.get(), cache.get(), cache.get()]);
// one request, not three — a === b === c
cache.current?.find("90210")?.name;  // "Beverly Hills"
```

A burst of keystrokes on a cold cache shares one in-flight load. A rejection
clears the slot, so the failure reaches every waiting caller and the next call
retries rather than awaiting a settled rejection forever. `current` is
`undefined` until the first load succeeds.

`createCachedEngine` is the same cache with an engine built from each snapshot —
`evaluate`, `suggest` and `refresh` all `async`, the snapshot and the engine it
built cached as one pair so they cannot come apart.

**Geo ships no live engine of its own**, and that is the honest gap in this
section: `@smartput/rate` has `createLiveEngine`, `@smartput/country` does not. A provider row
is a `Place` and a kind is built from `CityRow`s, so anyone wiring a live place
engine today writes that mapping themselves, deciding for their own data what a
row with no zone and no population should become. Whether `@smartput/country` ships the mapping,
or a whole `createLivePlaceEngine` around it, was M6.4's to decide and M6.4 did
not decide it — the milestone ended with this still open.

## How it works

Two seams that were already there, both of them M4's, plus three core changes
this milestone made.

- **Literal matchers** — the same seam `@smartput/datetime` uses. Geo registers
  two, each offered `(input, offset, ctx)` at every token boundary: one walks the
  name trie, one tries the postal formats. See
  [`Kind.literals`](/api/define-kind#literals). Countries, cities and scopes are
  all one walk down one trie, which is why a scope needed no new structure —
  only a third payload on a node. The order is not a precedence: both are asked,
  and the readings they return are ranked together.
- **An opaque kind's units are indexed like any other kind's**, so a country
  code is a unit, weighted and usable as an `in` target. Every place's `unit` is
  its country, which is what lets the distance op find a position even for an
  operand it did not claim itself.

The parser changed, and the design document said it would not. `15:00 in japan`
needs the *claimed* value on the right of `in` — the zone lives in its `meta` —
and the parser previously discarded it in favour of a stand-in built from the
unit name alone. It now carries literal-claimed conversion targets through to
`apply`. The signature is still opt-in per claim: a kind marks a claim
`targetable` or it cannot stand on the right of `in`, which is why
`today in tomorrow` is still a `UnitParseError` even though datetime claims
`tomorrow` as a literal.

The matcher contract changed too, and that is M6.3's larger change. A
`LiteralMatcher` may return **several readings of the same text**, and the
literal fold groups every match reaching the furthest end — from every kind, not
just the first to register — instead of keeping one and discarding the rest. A
claim over a single token also keeps that token beside the readings. Three
things in this guide are that one change: `suggest()`
[returns runners-up](#ranking), `tokyo` is
[a city and a zone at once](#cities-datetime-also-names), and `90210`
[is a number with a postcode underneath](#90210-is-still-a-number). The full
contract is in [Types](/api/types#returning-more-than-one-reading).

The third is M6.4's and it is a new seam rather than a widened one: a kind may
declare [`completions`](/api/define-kind#completions), a function core calls once
per keystroke for a vocabulary the global alias index was never allowed to hold.
Geo is its first consumer and the reason it exists — a city is in no index and a
country name below four characters is in none either — but nothing about it is
the place kind's. It is the door datetime needs to complete a time zone, and that kind does
not declare one yet.

One other observable change comes with cities, and no corpus can show it: `5 nice`
and `10 mobile` used to throw `NoCandidateError` and now throw `UnitParseError`,
because a claimed place where a unit was expected is a parse failure rather than
a missing candidate. Both still mean "no reading". A caller that switches on the
error class should know.

## Completing a name

`complete()` offers places, and the kind wires it up for you — there is nothing
to register:

```ts
engine.complete("kyi").map((c) => c.text);
// [ "Kyiv", "Kyivskyi", "Kyivskyi" ]
engine.complete("ukrai").map((c) => c.text);
// [ "Ukraine" ]
engine.complete("united").map((c) => c.text);
// [ "United States", "United Kingdom", "United Arab Emirates" ]
engine.complete("3pm in kyi")[0].text;
// "3pm in Kyiv"
```

The row replaces the word being typed with the place's **display name**, not with
the alias that matched, so a historical or local name reaches the modern one:

```ts
engine.complete("kiev").map((c) => c.text);      // [ "Kyiv" ]
engine.complete("leningrad").map((c) => c.text); // [ "Saint Petersburg" ]
engine.complete("nipp").map((c) => c.text);      // [ "Japan", "Nippes" ]
engine.complete("america").map((c) => c.text);
// [ "United States", "Americana", "American Samoa" ]
```

The two rows named `Kyivskyi` above are two different places — GeoNames
`13680589` and `13561145`, 182,900 and 139,177 people, and a third at 110,600
that the row cap below cuts. They are two rows rather than one because the
completer de-duplicates on the GeoNames id, which is what identifies a place
everywhere else in this package. The list is not showing you one answer twice;
it is showing you a name three settlements share.

Completion is tiered exactly like matching. A countries-only build completes
countries and not one city:

```ts
// engine: BUILTIN_KINDS + place  (countries only)
engine.complete("ukrai").map((c) => c.text); // [ "Ukraine" ]
engine.complete("kyi");                      // []
```

A multi-word name completes from its **first** word and only from there: the
trie holds `united states` and `south korea` whole, so `unit` and `sout` reach
them, while `united s` does not. See [Not yet](#not-yet) — that one is core's
fragment rule, not missing data.

```ts
engine.complete("sout").map((c) => c.text);
// [ "South Korea", "South Sudan", "South Bend" ]
```

### A place is not a quantity

Two rules keep the list a calculator's. A count in front of the fragment means
the word is a unit — there is no such thing as ten Kyivs — so places sit out
entirely:

```ts
engine.complete("10 k").map((c) => c.text);
// [ "10 k", "10 kilobytes", "10 kilometres", "10 kilograms", "10 knots",
//   "10 km2", "10 kibibytes", "10 kmh", "10 k" ]
```

And the list is shared. Core merges every kind into one ranking of ten, so a
place is ranked against `kilometre` and not only against other places. A country
carries **no weight advantage at all** there: it meets a unit at zero and is
separated from it by one thing, how much of each name is still to be typed. A
city sits 1 to 3 points below that, which is [the matcher's ranking](#ranking) —
country, then capital, then population — kept intact under a ceiling of zero.

The ceiling is a deliberate reversal. In the matcher, `+3` for a country ranks
one place against another place; in this list the other rows are every unit in
the engine, so the same `+3` reads as "a country outranks the kilogram". It
measurably did: at the matcher's figures, 56 of the 294 prefixes of a builtin unit
alias handed their first row to a place, `me` completed Mesa rather than metre,
and `2 km in mil` completed Milan rather than mile. Rebased, twelve do — see
[below](#when-a-place-answers-first).

```ts
engine.complete("mi").map((c) => `${c.kind}:${c.text}`);
// [ "length:mile", "datasize:mebibyte", "duration:minute", "place:Myanmar", … ]
engine.complete("ki").map((c) => `${c.kind}:${c.text}`);
// [ "datasize:kibibyte", "mass:kilogram", "place:Kyiv", "place:Kira",
//   "place:Kita", "datasize:kilobyte", "length:kilometre" ]
```

At most **three** places compete for the ten. That cap is what leaves
`kilobyte` and `kilometre` in the list behind `ki`, where eight cities — Kira,
Kita and Kisi among them — would otherwise have pushed them off the end. Across
every prefix of every builtin alias, registering the kind now costs the units
one row in total.

A place picker wants the opposite trade, so it asks for it:

```ts
import { COUNTRIES, PlaceCompleter } from "@smartput/country";
import { CITIES } from "@smartput/city";

const wide = new PlaceCompleter(COUNTRIES, CITIES).withLimit(10);
wide.completions({ locale: "en", fragment: "par" }).map((r) => r.text);
// [ "Pare", "Paris", "Parma", "Parla", "Paraná", "Parung", "Pardīs",
//   "Hidalgo del Parral", "Paraguay", "Parakou" ]
```

`PlaceCompleter` is frozen and `withLimit` returns a new one over the same index,
so widening the list costs a walk and not a rebuild. Underneath it,
`createPlaceIndex(countries, cities)` and `completePlaces(index, ctx, limit)` are
the same thing as functions, for a picker that has no engine at all. The seam
they plug into is core's, and it is [`Kind.completions`](/api/define-kind#completions)
— any kind with a vocabulary too large or too collision-prone for the global
alias index can do what the place kind does here.

### When one prefix names two countries

The ranked list is the answer to an ambiguous name, and for a country it is
usually the whole answer:

```ts
engine.complete("congo").map((c) => c.text);
// [ "Democratic Republic of the Congo", "Republic of the Congo" ]
engine.complete("guine").map((c) => c.text);
// [ "Guinea", "Guinea-Bissau", "Equatorial Guinea" ]
engine.complete("niger").map((c) => c.text);
// [ "Niger", "Nigeria" ]
engine.complete("domin").map((c) => c.text);
// [ "Dominica", "Dominican Republic", "Sri Lanka" ]
```

Sri Lanka is there on `dominion of ceylon`, one of its GeoNames alternate names,
and Equatorial Guinea on `guinee espagnol`. That is the shape of nearly every
surprise in this list: **the alias that matched is not the name that is shown**.
`Completion` carries both — `alias` and `text` — so a launcher can tell the user
which of a place's names it answered on.

An exact match takes the top row outright — `EXACT_BONUS` is 10, against a
one-per-character prefix penalty — which is what keeps a typed-out name from
being ranked below a longer one that merely starts the same way:

```ts
engine.complete("paris").map((c) => c.text);
// [ "Paris", "Paris 16 Passy", "Paris 12 Reuilly" ]
```

Short of an exact match, a country still leads a city of a similar name, and this
is the one place the matcher's ranking shows through:

```ts
engine.complete("geor").map((c) => c.text);
// [ "Georgia", "George", "Georgetown" ]
```

`georgia` is a character longer than `george`, so on prefix quality alone the
South African city would lead. The country's zero against the city's −1.24 is
what decides it. Against a *unit* six characters long, `georgia` would have lost
that character and the unit would lead.

### When a place answers first

Twelve prefixes of a builtin unit alias lead with a place rather than the unit
once the kind is registered. All twelve, verbatim, because a list is checkable
where a count is not:

| Typed | Offered first | Instead of |
| --- | --- | --- |
| `ce` | Sri Lanka — on `ceylon` | `celsius` |
| `fa` | Fatih | `fahrenheit` |
| `he`, `hec` | Heze, Hechi | `hectare` |
| `ke` | Kenya — on `kenia` | `kelvin` |
| `li` | Libya — on `libia` | `liter` |
| `meg` | Meguro | `megabyte` |
| `pe`, `per` | Peru | `percent` |
| `te`, `ter` | Teni, Terni | `terabyte` |
| `to` | Togo | `tonne` |

Eleven of them are a **shorter name winning on how much is left to type**, which
is the alias index's own rule applied to a place: `kenia` is five letters where
`kelvin` is six, `togo` four where `tonne` is five. The twelfth, `li`, is a real
tie at −3.00 between `libia` and `liter`, broken by core's last resort of kind id
ascending; it is in the list rather than fixed, because the thumb on the scale
that would fix it is exactly what was taken off above.

The list is pinned by a test that sweeps all 294 prefixes and asserts the top row
is byte-identical to the place-free engine everywhere else, so any movement in it
is a deliberate change rather than a drift. If `pe` offering Peru over `percent`
is wrong for your launcher, `complete("...", { kinds: [...] })` drops the kind
before its completer is ever called.

## Checking a postal code

The format is one column of the country table, so the same 178 formats that
parse `SW1A 1AA` will also answer for a form field. The machinery is
`@smartput/zip`, which ships no data of its own; `POSTAL_FORMATS` is that
package's lookup bound to the shipped countries:

```ts
import { POSTAL_FORMATS } from "@smartput/country";

const gb = POSTAL_FORMATS.for("GB");
gb.validate("sw1a1aa");  // true
gb.normalize("sw1a1aa"); // "SW1A 1AA"
gb.shape("sw1a1aa");     // "@@#@ #@@"

POSTAL_FORMATS.for("AQ");  // null — Antarctica has no postal system
```

`for` takes alpha-2 or alpha-3 in any case and returns `null` twice over: for a
code that names no country, and for one of the 74 countries with no format to
check against. Check once at the door rather than a hundred codes later. There is
no public constructor, and the instance is frozen — `PostalFormat.of(row)` is the
only way in and it may refuse. That is also the door for a row you brought
yourself: a `definePlace()` table, a row off a provider, a table of your own
wrapped in `new PostalFormats(rows)`. The same instance comes back for the same
row, which is what makes the matcher behind it worth caching.

<SpPostal />

Ireland is the near miss worth knowing about: the Eircode has been in GeoNames'
column since 2015, so `for("IE")` is a format and `d02af30` normalizes to
`D02 AF30`.

Normalization is a search, not a table. Every country's separator goes somewhere
different, so `normalize` strips the separators and offers the country's own
format each single reinsertion until one is accepted:

```ts
POSTAL_FORMATS.for("CA").normalize("m5v3l9");    // "M5V 3L9"
POSTAL_FORMATS.for("NL").normalize("1234ab");    // "1234 AB"
POSTAL_FORMATS.for("JP").normalize("1000001");   // "100-0001"
POSTAL_FORMATS.for("US").normalize("902101234"); // "90210-1234"
POSTAL_FORMATS.for("GB").normalize("nope");      // null
```

`validate` is defined as `normalize(code) !== null`, so the two can never
disagree in a form — a field that accepted a code and then failed to
canonicalize it would be the worse of the two answers. The strict question,
without the case and separator repair, is `postalAccepts(row, code)` in the layer
underneath, beside `normalizePostal` and `postalShape`:

```ts
import { COUNTRIES } from "@smartput/country";
import { PostalFormat, postalAccepts } from "@smartput/zip";

const us = COUNTRIES.find((c) => c.a2 === "us");
postalAccepts(us, "902101234");                 // false — not as written
PostalFormat.of(us).validate("902101234");      // true  — after repair
```

Each `PostalFormat` also carries the raw pattern as `source` and the country as
`country`. `source` is GeoNames' column verbatim, uncompiled and still anchored,
for a caller wiring an HTML `pattern=` attribute or a check in another language —
this class is not reachable from a form's server side.

Two limits, both of them on the way in. A code longer than `MAX_CODE_LENGTH`
(40) is refused before any pattern sees it: the longest code any shipped format
can match is Portugal's, at 34, and backtracking cost is a function of input
length. And a pattern shaped the way catastrophic backtracking needs is refused
outright, which makes its country's format accept nothing rather than everything.
No shipped format is in either state, which the tests assert against the raw
column — `isBacktrackRisk` is exported for screening patterns of your own.

One shape the search cannot rebuild: a code with **two** separators, which only
Portugal has. `1234-567 LISBOA` survives as written because a code that is
already separated and valid is kept, but `1234567LISBOA` normalizes to
`1234-567LISBOA`.

## Not yet

Postal codes, the providers and the ranked `suggest()` shipped in M6.3;
completion and postal format checking shipped in M6.4, which is the last of them.
Five things remain.

Multi-word completion is not one of them, though it nearly shipped as one.
`complete("san fran")` first offered `san France`: core took the fragment to be
the trailing *word*, so `fran` was the whole question the kind was asked, `France` was
a truthful answer to it, and core spliced that back over `fran` alone to make a
place that does not exist. `CompleteCtx` now carries the whole input and the
fragment's span, and a `KindCompletion` may name the offset it replaces from:

```ts
engine.complete("san fran").map((c) => c.text); // [ "San Francisco", … ]
engine.complete("new yor").map((c) => c.text);  // [ "New York City", "Jakarta" ]
```

That second line is the part worth keeping: Jakarta's GeoNames aliases really do
include `new york van java`, and it is a capital, so on weight alone it ties New
York City. What separates them is how much of the alias is still untyped — and
that has to be measured against everything typed, `new yor`, not against the
fragment `yor` that neither alias begins with.
- **No live place engine.** The cache facade is core's and the providers are
  the place path's, and nothing joins them: `@smartput/rate` has
  `createLiveEngine` and `@smartput/country` has no equivalent. M6.4 was where that was to be ruled on and it was not —
  [wiring one](#keeping-it-fresh) still means writing the `Place` → `CityRow`
  mapping yourself, deciding for your own data what a row with no zone and no
  population should become.
- **One Paris.** `paris texas` still throws and `suggest("paris")` still returns
  one result, and neither is a matcher limit any more — `suggest()` genuinely
  ranks runners-up, there is simply one Paris in the data. Paris, Texas is 25,171
  people against T1's 100,000 floor, so this needs T2 rather than more code.
- **A postal code has no position of its own.** It borrows its country's
  coordinates so the zone, currency and country stay usable, and measuring from
  them is [refused rather than answered](#postal-codes) — `us 90210 to japan`
  throws `UnpositionedPlaceError`. Real coordinates for a
  code need [a provider](#providers-and-t2), and nothing wires a provider into
  the kind.
- **`PostalFormat.shape()` is a code's shape, not a country's format.**
  `shape("sw1a1aa")` is `"@@#@ #@@"` because that code validated; there is no way
  to ask GB for its mask without a code in hand. GeoNames publishes one — the
  `@# #@@` column — and the generator takes the regex column instead, so carrying
  it means a generator change and a new `CountryRow` field.
- **No geocoding, no reverse geocoding, no street addresses.** Not a milestone —
  a different product, and no free dataset carries them at quality.

Two behaviours are described above rather than here, because they are answers
rather than absences, and both are the kind of thing worth knowing before you
ship: `12345-6789` and `01310-100`
[stop being arithmetic](#three-edges-worth-knowing), and
`suggest("3pm in tokyo")` returns
[two identical-looking rows](#cities-datetime-also-names).

## Next

- [Dates and time zones](/guide/datetime) — the other side of the zone bridge,
  and the literal-matcher seam in detail.
- [Money and rates](/guide/money) — the other side of the currency bridge.
- [Kinds and units](/guide/kinds) — where the value model comes from.

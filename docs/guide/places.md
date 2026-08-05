---
title: Places and distances
description: The place kind, countries and cities as values, admin1 scoping, great-circle distance, and the datetime and rates bridges.
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
option: the place names are the data, and the data ships in the package.

`place` is countries only. Cities are a second import and a factory call, and
the section on [turning cities on](#turning-cities-on) is why they are not simply
there.

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

## Turning cities on

Cities live behind a second entry point and arrive as an argument:

```ts
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { definePlace } from "@smartput/geo";
import { ADMIN1, CITIES } from "@smartput/geo/cities";
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
import links the gazetteer into every bundle that touches `@smartput/geo`, and
no bundler can prove `CITIES` unused once a kind has closed over it. Tiering is
only real if the dependency edge runs from the consumer inwards, so the
consumer is the one who names `@smartput/geo/cities`. Probing the countries-only
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

**`suggest()` cannot return the runner-up.** `suggest("springfield")` returns one
result where the table holds three Springfields. This is structural rather than a
missing weight: core's `LiteralMatcher` returns `LiteralMatch | null`, so the
literal fold receives one claim per offset and the alternatives never become
candidates the solver could rank. The weights above are therefore applied *inside
the matcher*, choosing which row escapes; the weight that reaches the solver then
competes with other kinds, not with other places. Returning the alternatives
needs the matcher contract widened to an array, which is a change to core.

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

### Cities datetime already owns

Registering `@smartput/datetime` costs 17 city names their place reading:

```
auckland  beijing  berlin  chicago  delhi  denver  dubai  kiev  kolkata
kyiv  london  moscow  mumbai  paris  shanghai  sydney  tokyo
```

Each one is an alias of one of datetime's eighteen hand-written IANA zones. A
single-word city claim yields to any word another kind has registered as a unit,
so in an engine with datetime the trie never claims them at all:

```ts
// engine: BUILTIN_KINDS + datetime + place-with-cities
engine.evaluate("3pm in tokyo").formatted;  // "2026-01-16 00:00 JST"
engine.evaluate("tokyo to kyoto");          // UnitParseError
engine.evaluate("kyoto to osaka").formatted; // "43.085 kilometres"
```

`kyiv to warsaw`, `paris to berlin`, `london to paris` and `chicago to denver`
all throw in that engine and all resolve in one without datetime. The design
document expected both readings to reach the solver and be ranked; they cannot,
because the literal fold is destructive — a claim that is made is the only claim
there is, so yielding is the only non-destructive answer a matcher has. Making
both survive means letting a literal claim and a unit reading coexist as
candidates, which is a core change and not a geo tweak.

The cost is exactly those 17 words. Every other name in the tier claims
identically whether datetime is registered or not, which is what the corpus
replay checks.

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
| geo's own country codes below four characters | 508 |

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

`packages/geo/corpus/en.tsv` carries `10 km` and `two hundred and five km` as
rows for exactly this reason, and every corpus in the repo — core's, datetime's,
rates' and geo's own — is replayed through an engine with the full 6,247-name
trie registered. A kind that adds words to a global index can only be shown
harmless input by input. What that replay found is that registering the tier only
ever turns nothing into something: no input that had a reading changed it, and
`nice`, `mobile`, `reading` and `split` went from `UnitParseError` to a place.

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

// with @smartput/rates registered, against the 2026-08-04 snapshot.
// A city has no currency of its own, so it borrows its country's.
engine.evaluate("100 usd in japan").formatted;  // "¥15,455"
engine.evaluate("100 usd in kyoto").formatted;  // "¥15,455"
engine.evaluate("100 usd in kyiv").formatted;   // "₴4,136.36"
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
vendored as TypeScript. That is a deliberate trade: the package takes on no npm
data dependency and no upstream maintenance risk, and its runtime dependencies
stay at two — `@smartput/core` and `decimal.js`. Each generated file carries a
hash of its own body and of each source dump, and a test recomputes them, so a
hand edit fails the suite. Two consecutive builds produce byte-identical output.

The tables are exported, because a consumer rendering a country or city picker
wants the rows and cannot re-derive them from the registry — the alias index
carries names only, and cities are not in it at all.

```ts
import { COUNTRIES } from "@smartput/geo";
import { ADMIN1, CITIES } from "@smartput/geo/cities";

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
import { GEONAMES_ATTRIBUTION } from "@smartput/geo";
// "Country data from GeoNames (https://www.geonames.org/), licensed under
//  CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)."
```

Render it wherever the place data is visible. The string still says "Country
data" and the cities come from the same dump under the same licence, so it
covers them; the wording is worth widening the next time that file is touched.

## How it works

Two seams, both of them M4's, plus one parser change.

- **A literal matcher** — the same seam `@smartput/datetime` uses. Geo registers
  exactly one, offered `(input, offset, ctx)` at every token boundary; it walks
  its trie and returns a finished `Value` with the characters it claims. See
  [`Kind.literals`](/api/define-kind#literals). Countries, cities and scopes are
  all one walk down one trie, which is why a scope needed no new structure —
  only a third payload on a node.
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

One other observable change comes with cities, and no corpus can show it: `5 nice`
and `10 mobile` used to throw `NoCandidateError` and now throw `UnitParseError`,
because a claimed place where a unit was expected is a parse failure rather than
a missing candidate. Both still mean "no reading". A caller that switches on the
error class should know.

## Not yet

Cities, scoping and weights shipped in M6.2. What remains is planned and not
present — reaching for it today gets an error, not a wrong answer:

- **No postal codes.** `SW1A 1AA` and `90210` are not places; `90210` is the
  number 90,210 in every engine, and the corpus pins it that way so the postal
  matcher cannot take it silently. The `postalRegex` is already on every country
  row, unused, waiting for the postal literal in M6.3 — along with
  `PlaceProvider`, the lifted cache facade and the GeoNames providers for the
  long tail the vendored data does not carry.
- **No completion.** `complete("kyi")` returns nothing. Core's completion inserts
  `<number><unit>` and skips non-ratio kinds outright, so place completion needs
  to go through the matcher's trie rather than the alias index. That is M6.4,
  with postal format validation.
- **No geocoding, no reverse geocoding, no street addresses.** Not a milestone —
  a different product, and no free dataset carries them at quality.

Two limits of the shipped tier are described above rather than here, because
they are behaviour and not absence:
[17 city names yield to datetime](#cities-datetime-already-owns) and
[`suggest()` returns one place](#ranking). Both are the same root cause — one
claim per offset, and a fold that consumes the token — so both wait on the same
core change.

## Next

- [Dates and time zones](/guide/datetime) — the other side of the zone bridge,
  and the literal-matcher seam in detail.
- [Money and rates](/guide/money) — the other side of the currency bridge.
- [Kinds and units](/guide/kinds) — where the value model comes from.

# smartputs Geo Design

Countries, cities and postal codes as first-class values. `japan` returns a
place, `kyiv to warsaw` returns a distance, `3pm in new york` converts a zone
without datetime knowing what a city is, and `100 usd in japan` converts a
currency without rates knowing what a country is.

The engine this extends is specified in `2026-08-04-smartputs-design.md`. The
datetime plugin it borrows two seams from is specified by the M4 plan. This
document adds one package, one kind, one generator script and three op
signatures. The lexer, the resolver and the solver are untouched.

**Amended during M6.1.** The Pratt parser was *not* untouched, and the original
claim that it would be was wrong. See §4.5: a conversion target that a kind
claimed as a literal had no path through the parser at all, and the bridges in
§3.1 are unreachable without one. The change is twenty lines behind an opt-in
flag, and it is the only core change this milestone makes.

## 1. Why this exists

`packages/datetime/src/zones.ts` is a hand-written table of eighteen IANA zones
with single-word aliases, and its own header admits the limit: *"the alias index
is keyed by one segmented word, so 'new york' cannot be one — 'nyc' can."*
A launcher user types `new york`, not `nyc`.

That table is the visible edge of a larger gap. A calculator that already knows
`100 usd in eur` and `3pm in tokyo` is one lookup away from knowing what country
a currency belongs to, what zone a city sits in, and how far apart two cities
are. The data is free, the seams already exist, and the only real engineering
question is how much of it to ship.

## 2. Scope

Recognised:

| Form | Example | Result |
| --- | --- | --- |
| Country | `japan` | Place — JPY, +81, Asia/Tokyo, 124M |
| City | `kyiv` | Place — UA, Europe/Kyiv, 2.9M |
| Multi-word name | `new york`, `united kingdom` | Place |
| Scoped city | `paris texas`, `springfield il` | Place, admin1-disambiguated |
| Distance | `kyiv to warsaw` | `690 km` — great-circle |
| Zone conversion | `3pm in new york` | datetime |
| Currency by country | `100 usd in japan` | money |
| Postal, unambiguous shape | `SW1A 1AA`, `M5V 3L9`, `01310-100` | Place |
| Postal, country-qualified | `us 90210`, `90210 us` | Place — one literal, see §6.2 |
| Postal, digits only | `90210` | number; the place reading is reachable only via `suggest()` |

Not recognised, deliberately:

| Excluded | Why |
| --- | --- |
| `population of japan` | `of` takes a value on the left. `population` is not one, and inventing a prefix-attribute grammar for four attributes is not worth a parser change. Facts render from the Place value instead — see §5.3. |
| `distance from kyiv to warsaw` | `from` is not a keyword and `distance` is not a value. `kyiv to warsaw` already reads as English and costs nothing. |
| Bare `90210` under `evaluate()` | Every five-digit number would become ambiguous. See §6.2. |
| Street addresses, geocoding | A different product. GeoNames does not carry them and no free dataset does at quality. |
| Reverse geocoding from coordinates | Needs polygon data — `geo-tz` alone is 40 MB. Provider territory if ever. |
| Timezone *offsets* as places | `utc+3` is a datetime concern and datetime already owns `ZONES`. |
| Population and area as ratio kinds | Population is a `number`, area is the existing `area` kind. No new kinds. |

`springfield` alone resolves to Illinois by population weight, not by any claim
about which Springfield the user meant. `suggest()` returns the ranking.

## 3. Package boundaries

New package `@smartput/geo`. Runtime dependencies: `@smartput/core`,
`decimal.js`. Nothing else — GeoNames data is vendored as generated TypeScript,
so the package takes on no npm data dependency and no upstream maintenance risk.

`scripts/check-deps.ts` gains one row:

```
geo   decimal.js, @smartput/core
```

Three entry points, so a consumer who wants countries does not pay for cities:

```
@smartput/geo           place kind, ops, T0 countries        ~25 KB gz
@smartput/geo/cities    T1 cities, registered on demand      ~180 KB gz
@smartput/geo/providers GeoNames + postal-code providers     no data
```

### 3.1 Nothing imports anything

The bridges to datetime and rates carry **zero dependency in either
direction**. Core declares the meta contract; geo produces it; datetime and
rates read it.

```ts
// @smartput/core — declared beside RateLookup, for the same reason
export interface PlaceMeta {
  /** GeoNames feature id. Stable, and the Value's canonical. */
  readonly geonameId: number;
  /** IANA zone. Always present: a country carries its capital's zone. */
  readonly zone: string;
  /** ISO 4217. Present on countries; on a city, its country's. */
  readonly currency: string;
  readonly lat: number;
  readonly lon: number;
  readonly population: number;
  /** ISO 3166-1 alpha-2, lowercased. Equals the Value's `unit`. */
  readonly country: string;
}
```

`datetime` declares `in | datetime | place` and reads `r.meta.zone` — a string.
`rates` declares `in | money | place` and reads `r.meta.currency` — a string.
Neither imports geo, neither knows what a city is, and neither gains a
dependency.

This works because the registry's pass 4 (`kind/registry.ts:102`) builds the op
table without validating that `left` and `right` name registered kinds. A
signature mentioning `place` when geo is absent is inert: the solver can never
produce a `place` operand, so the entry is never keyed. Registry pass 4 *does*
refuse two claimants of the same signature, so ownership is exactly one kind per
bridge — datetime owns the datetime bridge, rates owns the money bridge, geo
owns `in | place | place`.

**Ruling:** the earlier option of injecting a `PlaceLookup` into datetime is
rejected. It would have made datetime's construction depend on geo's presence
to serve a case that a plain string in `meta` already covers. `PlaceLookup`
survives only in §7, where the provider path genuinely needs a lookup interface.

## 4. The `place` kind

```ts
export const place: Kind = defineKind({
  id: "place",
  value: { mode: "opaque", units: COUNTRY_UNITS },
  literals: [placeLiteral, postalLiteral],
  ops: [distance],
  format: formatPlace,
});
```

### 4.1 Units are countries

`units` is the ISO 3166-1 alpha-2 set — `us`, `ua`, `jp` — with country names as
aliases. This mirrors datetime exactly, where a unit is an IANA zone rather than
a ratio: an opaque unit is a label that is indexed, weighted, formatted and
usable as an `in` target.

**Amended during M6.1: the codes themselves are not aliases.** The original text
put alpha-2 and alpha-3 in the alias index too. That index is global, so doing it
cost twelve existing corpus rows their reading: `km` is Comoros, `kg` is
Kyrgyzstan, `lb` is Lebanon, `ml`/`mm`/`ms`/`gb`/`cm` likewise, and — worst —
`pm` is Saint Pierre and `am` is Armenia, which made datetime's accept-gate
refuse `3pm` and `10am` outright. Only aliases of four characters or more reach
the index. The codes live in the matcher's trie instead, which is strictly
better anyway: a code reached through the alias index produces a place Value
with no `meta` and therefore throws in any bridge, while a trie claim produces a
real one.

Consequences that fall out rather than being designed:

- Every place Value's `unit` is its country. `kyiv` has unit `ua`.
- `LiteralMatch.unit` must name a registered unit, and a country code always
  does, so the matcher never needs a free-form string.
- A country is both a unit and a value, as a zone is in datetime.

### 4.2 `canonical` is the GeoNames id

An opaque kind still needs a `canonical: Decimal`. Geo uses the GeoNames feature
id, an integer that is stable across dataset releases. Identity is then free:
two Values are the same place exactly when their canonicals are equal, which is
the default `equals`, so `OpaqueSpec.equals` is not declared.

### 4.3 The one op

```ts
{
  op: "in", left: "place", right: "place", result: "length",
  assumption: "great-circle distance",
  apply: haversine,
}
```

`in`'s surface words in English are `in`, `to` and `as`, so `kyiv to warsaw`
parses with no new keyword. The result is a `length` Value built through
`kind/ratio-ops.ts`'s sanctioned constructor; canonical is metres, and the
formatter's existing `typical` bands pick km.

The assumption is recorded because great-circle is defensible but not the only
reading — driving distance is what a person often means, and no free dataset
provides it.

### 4.5 A claimed conversion target — the one core change

**Added during M6.1.** `3pm in japan` could not parse. The `in` branch of the
Pratt parser required its target to be a `word` token, and geo's matcher has
already folded `japan` into a `literal` token by then, so the input threw
`UnitParseError` before any signature was consulted.

Nor is accepting the token enough. For an ordinary unit target the evaluator
synthesizes a stand-in Value — canonical `0`, the target's unit, and *the left
operand's* `meta` — because `in` signatures have only ever read `r.unit`. A
bridge that reads `r.meta.zone` off that stand-in gets the datetime's meta and
no zone. So the claimed Value has to travel on the node.

Three files, about twenty lines: `ConvertNode` gains an optional `targetValue`,
`pratt.ts` gains a branch that fills it, and `evaluate.ts` prefers it over the
stand-in.

The branch is gated on a new opt-in, `LiteralMatch.targetable`, rather than on
`token.type === "literal"`. Gating on the token type alone was tried first and
was wrong: datetime claims `tomorrow` as a literal, so `today in tomorrow`
became a legal zone conversion that returned today's date, where it had always
thrown `UnitParseError` — and it did so with geo absent, making it a regression
in core for every existing consumer. Every literal is a value; only some values
are conversion targets, and only the kind knows which. Geo's places opt in;
datetime's dates do not.

`engine.test.ts` covers both halves: a literal that does not opt in still throws
on the right of `in`, and one that does reaches `apply` carrying its own meta.

## 5. Matching

### 5.1 Multi-word names need a matcher, not an alias

The alias index is keyed on one segmented word. `new york` therefore cannot be
an alias, and this is the same wall datetime hit. The answer is the same seam:
a `LiteralMatcher`, which is offered the whole normalized input at a token
boundary and returns how many characters it claimed.

`placeLiteral` walks a trie of names, longest match wins, bounded at four words.
`united kingdom of great britain` is in the trie because it is a GeoNames alias;
`the` is not a node, so a stray article ends the walk rather than being skipped.

Two guards, both borrowed from datetime's ruling R4:

- `ctx.isUnitAlias(text)` is consulted before claiming a single word. `in` is a
  keyword, `m` is a unit, and a place named `M` must not eat either. A
  single-word claim is refused when the word is a registered unit alias of any
  kind, unless the trie hit is a country — country names are never one-letter
  and never collide.
- A match that does not end on a token boundary is discarded by the fold, so
  `newark` is never read as `new` + `ark`.

**Amended during M6.1: the guard is wider than `isUnitAlias`.** That predicate
only sees words some kind registered as a unit, and the codes that do the most
damage are not units of anything. `and` is Andorra, `ago` is Angola, `is` is
Iceland, `it` is Italy — and because the literal fold is destructive, a claim has
no second chance, so `two hundred and five g` and `3 days ago` were being eaten
outright. A lowercase two- or three-letter code is therefore not claimed at all.
A code written as a code still is: `japan to UA` resolves, `japan to ua` does
not, and a lowercase query is expected to carry the country's name.

The rejected alternative was a denylist of the ~60 short codes that are also
English words. It fails destructively on the first word the list forgets, and
the list would need re-deriving in every locale.

### 5.2 Scoping happens in the matcher

`paris texas` is claimed as **one** literal. The trie's leaves carry admin1 and
country children, so `paris` → `texas` is a walk, not an operation.

This is a deliberate rejection of the alternative, which was to make
`paris in us` a scope filter. That alternative would have overloaded
`in | place | place` with two intents — distance and filtering — and forced a
runtime branch on feature class inside one `apply`. Keeping scope in the matcher
leaves the signature meaning exactly one thing.

### 5.3 Facts render, they do not compute

A bare place formats to its facts:

```
japan       →  Japan — JPY, +81, Asia/Tokyo, 124M
kyiv        →  Kyiv, UA — Europe/Kyiv, 2.9M
SW1A 1AA    →  London SW1A 1AA, GB — Europe/London
```

`format` reads `meta`. No op, no grammar, no parser change, and the launcher
gets its lookup answer from the same path that renders every other Value.

## 6. Weights and ambiguity

Ambiguity is the risk surface of this package, so the weights are stated rather
than tuned later.

### 6.1 Place against place

`LiteralMatch.weight` is summed into the candidate score exactly like an
analyzer's. Geo emits:

| Case | Weight |
| --- | --- |
| Country | `+3` |
| Capital city | `+2` |
| City, scaled by population | `+log10(pop) / 3`, capped at `+2` |
| Scoped match (`paris texas`) | `+4` — the user was explicit |

So `paris` ranks France's Paris over Texas's, `springfield` ranks Illinois, and
`georgia` ranks the country over the state. Each is a ranking, not a decision:
`suggest()` returns the alternatives.

### 6.2 Place against number

`90210` is a valid US ZIP and a valid number. A postal matcher that claimed it
would make every five-digit integer ambiguous, and `AmbiguityError` on `90210`
is a worse answer than a number.

`postalLiteral` therefore claims a bare numeric code only when a country
qualifier sits beside it, and claims the pair as **one** literal: `us 90210` and
`90210 us` are single matches, by the same rule that makes `paris texas` one
match in §5.2. A code carrying a letter (`SW1A 1AA`, `M5V 3L9`) or a separator
(`01310-100`, `123 45`) cannot be a number and is claimed unqualified.

Qualification is deliberately *not* `90210 as us`. That form would parse as
`in | place | place` and return the distance from the ZIP to the country's
centroid — a real answer to a question nobody asked. Keeping qualification in
the matcher leaves that signature meaning one thing, which is the same ruling
as §5.2.

Bare `90210` stays a number under `evaluate()`. `suggest()` returns the place
reading beneath it.

### 6.3 Place against zone

`3pm in tokyo` and `tokyo to kyoto` both contain `tokyo`. Both readings survive
to the solver, which is the engine's whole thesis. The first has a
`in | datetime | place` signature and no competing one; the second has
`in | place | place`. Neither needs a tiebreak.

`datetime`'s `ZONES` keeps its eighteen entries. Those are datetime's *units* —
an IANA zone genuinely is one — and its display symbols live there. What geo
removes is the pressure to grow that table into a city gazetteer.

## 7. Data

### 7.1 Tiers

| Tier | Contents | Rows | Shipped | gzip |
| --- | --- | --- | --- | --- |
| **T0** | Countries: name, aliases, alpha-2/3, currency, calling code, capital, capital's zone, population, area, lat/lon | ~250 | always | ~25 KB |
| **T1** | Cities with population > 100k: name, aliases, country, admin1, lat/lon, zone, population | ~5.1k | `@smartput/geo/cities` | ~180 KB |
| **T2** | Full `cities1000`, postal codes, admin divisions | ~150k / ~1.5M | provider only | — |

T0 alone is a working package. T1 is where `kyiv to warsaw` starts working, and
it is a separate import so the cost is opted into.

### 7.2 The generator

`scripts/geo/build.ts` downloads `countryInfo.txt`, `cities15000.txt`,
`admin1CodesASCII.txt` and `alternateNamesV2.txt` from the GeoNames dump,
filters to tier, and emits `packages/geo/src/data/countries.ts` and
`cities.ts` as committed TypeScript.

Committed rather than fetched-at-build for three reasons: the data is reviewable
in a git diff, the package gains no runtime dependency, and a build never
depends on a third party being up.

GeoNames is CC BY 4.0. Attribution ships in the package README and as an
exported `GEONAMES_ATTRIBUTION` constant, so a consumer embedding the data in a
UI has the string to hand.

### 7.3 Regeneration is a commit, never a CI surprise

Each generated file carries a header with the SHA-256 of its inputs and of its
own body. `data.test.ts` recomputes the body hash and fails on mismatch, so
hand-editing generated data is caught. Refreshing from upstream is a deliberate
`bun run scripts/geo/build.ts` and a reviewed commit.

A fixture test parses a checked-in five-line sample of each GeoNames file. If
the upstream column layout moves, it fails there — the same reason ECB is parsed
with two regexes plus a fixture rather than an XML parser.

## 8. The provider path

Mirrors `@smartput/rates` line for line.

```ts
interface PlaceLookup  { find(name: string, hint?: PlaceHint): Place | null }
interface PlaceSnapshot extends PlaceLookup { readonly asOf: string }
interface PlaceProvider { readonly id: string; lookup(q: string): Promise<Place[]> }
```

Two providers ship, neither required:

- `geonames({ username })` — the free GeoNames web service. Rate-limited,
  needs a free account, resolves anything in T2.
- `postalCodes({ url })` — reads per-country JSON from a mirror of the
  [zauberware collection](https://github.com/zauberware/postal-codes-json-xml-csv)
  (CC BY 4.0). Points at whatever host the consumer chooses.

### 8.1 The cache facade gets lifted

`createLiveEngine` in `packages/rates/src/live.ts` is hardcoded to
`RateProvider`: single in-flight promise shared across concurrent callers, TTL,
`finally` that clears on rejection so the next call retries. Geo needs exactly
that, for exactly the same reason.

**Ruling:** lift it into `@smartput/core` as a generic over the snapshot type,
and have rates and geo both construct from it. A TTL-plus-in-flight-promise
cache written twice is where two copies start to drift, and a second consumer is
the point at which the shape is proven rather than guessed. Rates' public
`createLiveEngine` signature does not change.

## 9. Testing

Follows the existing shape.

| Test | Asserts |
| --- | --- |
| `corpus.test.ts` | Formatted output verbatim, as datetime's does |
| `ambiguity.test.ts` | `90210` stays a number and `us 90210` does not; `90210 as us` returns a distance, not a place; `paris` ranks France; `georgia` ranks the country; `tokyo` resolves as a zone under `3pm in tokyo` and as a place under `tokyo to kyoto` |
| `matcher.test.ts` | `newark` is never `new` + `ark`; a single-word claim yields to a unit alias; the trie is bounded at four words |
| `properties.test.ts` | Distance is symmetric, non-negative, and zero for a place against itself; every T1 city's country is a registered unit; every place's `meta.country` equals its `unit` |
| `data.test.ts` | Body hashes match; every `meta.zone` is a valid IANA id; every `meta.currency` is ISO 4217 |
| `fixtures/geonames.test.ts` | The five-line samples still parse |
| `bridge.test.ts` | `3pm in new york` and `100 usd in japan` work with geo registered, and the signatures are inert without it |

The last row is the one that proves §3.1: an engine built with datetime and
rates but no geo must not throw, and must behave exactly as it does today.

## 10. Milestones

Each independently shippable, each with its own plan.

| M | Scope |
| --- | --- |
| **M6.1** | Package, `place` kind, T0 countries, `placeLiteral`, `in \| place \| place` distance, `format`. Datetime and rates bridge signatures. |
| **M6.2** | T1 cities, admin1 scope matching, weights, `suggest()` ranking. |
| **M6.3** | `PlaceProvider`, generic cache facade lifted into core, `geonames()` and `postalCodes()` providers, `postalLiteral`. |
| **M6.4** | Completion surface: country and city prefix completion, postal format validation and normalization. |

### 10.1 Roadmap renumbering

The existing M5 is `@smartput/color` plus the Ukrainian locale; the existing M6
is `@smartput/http` plus the npm release. Geo is larger than color and shares
nothing with it, so it takes M6 and http moves to M7. `guide/roadmap.md` is
updated in M6.1 rather than left to drift.

## 11. Standing targets, restated

- `@smartput/core` still ships one runtime dependency. The generic cache facade
  lifted in §8.1 is code, not a dependency.
- `@smartput/geo` ships two: `@smartput/core` and `decimal.js`. No data package,
  no HTTP client, no polyfill.
- A new ratio kind is still five lines. Geo adds no solver knowledge, no lexer
  or parser *stage*, and no new `OpSymbol`. It does add one gated branch to the
  existing `in` parse — see §4.5, and note that the original claim of "no parser
  change at all" did not survive contact with `3pm in japan`.

## 12. What M6.1 actually shipped

Recorded so the later sub-milestones start from the truth rather than from §2.

| Shipped | Deferred |
| --- | --- |
| T0: 250 countries, generated and committed, body-hash checked | T1 cities (M6.2) — so `kyiv to warsaw` is `ukraine to poland` today |
| `place` kind, trie matcher, multi-word names | admin1 scoping, `paris texas` (M6.2) |
| `in \| place \| place` great-circle distance | postal literals, `90210` (M6.3) |
| datetime and rates bridges, both dependency-free | providers, live engine, lifted cache facade (M6.3) |
| Fact formatting: `japan` → `Japan — JPY, +81, Asia/Tokyo, 127M` | completion (M6.4) |

Two things found during implementation that the later milestones inherit:

- **Opaque kinds cannot complete.** `complete.ts:63` skips non-ratio kinds
  outright, so M6.4's country completion has to go through the matcher's trie
  rather than the alias index. This is not geo-specific — datetime has the same
  hole and nobody had hit it.
- **`§9`'s `ambiguity.test.ts` does not exist yet.** Every row of that table
  needs T1 cities or the postal literal. The M6.1-reachable half lives in
  `matcher.test.ts` and in two corpus-replay guards that run the whole datetime
  and rates corpora through an engine with geo registered.

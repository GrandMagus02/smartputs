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

**Amended during M6.3: that is now two core changes, and the second is not
twenty lines.** `LiteralMatcher` returns `LiteralMatch | readonly LiteralMatch[]
| null`, the literal fold groups where it used to choose, and the literal token,
the AST, the Pratt parser and the evaluator all changed with it. §4.6 is the
whole of it. The lexer is touched too — the literal token it declares now
carries `readings` and a `fallback` — so of the three things this document
opened by calling untouched, only the resolver and the solver still are.

Both core changes were forced by the same shape. The seam a plugin claims text
through was built to produce one answer per offset, destructively, and a
gazetteer is a package whose answers arrive in groups: three Springfields, two
Congos, four countries sharing one postal format. Geo was the first consumer
big enough to make that visible, but nothing about either change is geo's — the
17 city names datetime was taking (§6.3) were datetime's side of the same
defect.

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

**Amended during M6.2, three corrections to this section.** `springfield`
resolves to **Missouri**, 170,188 against Illinois' 114,394 — the weight is a
function of the data, not of the example (§6.1). `suggest()` does **not** return
the ranking; it returns one result, for the structural reason in §6.1. And
`paris texas` does not resolve — Paris, Texas is 25,171 people and T1's floor is
100,000, so there is no second Paris for `texas` to select. `athens georgia`,
`springfield illinois` and `houston texas` are the same shape with data behind
them; see §5.2.

The `kyiv` row renders as promised: `Kyiv, UA — UAH, +380, Europe/Kyiv, 3M`. It
did not at first — a city rendered its *country's* facts, so `athens` came back
"Greece — … 11M" while the same Value's meta said Athens, 664,046, and all three
Springfields rendered one string. Fixed by carrying the name in `PlaceMeta`;
see §5.3.

**Amended during M6.3: the three postal rows hold, and the sentence under the
table is true again.** `SW1A 1AA`, `M5V 3L9` and `01310-100` are places,
`us 90210` and `90210 us` are one literal each, and bare `90210` is the number
with the place reachable through `suggest()` — see §6.2, which also records the
one rule this table does not show and the one line of §6.2's reasoning that is
false. `suggest()` does return the ranking now: `suggest("springfield")` is three
Springfields, best first, while `evaluate("springfield")` still decides for
Missouri. `paris texas` is still the exception, and still on data (§5.2).

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

**Amended during M6.2: the split is real, and the second figure is wrong.**
Measured with a bundler rather than by reading imports — `bun build --minify
--target=browser`, gzipped, each row cumulative on the one above it:

| Bundle | gzip | what that row added |
| --- | --- | --- |
| core + `BUILTIN_KINDS` | 24.4 KB | — the floor |
| `+ place` | 51.5 KB | **+27 KB** — §3's ~25 KB is accurate |
| `+ definePlace({ cities, admin1 })` | 285.1 KB | **+234 KB** — §3 says ~180 KB |

The miss is row count, not waste; see §7.1. The tiering claim the figure
supports does hold: the countries-only bundle was probed for `chelyabinsk`,
`fukuoka`, `texas`, `bavaria` and `springfield` and contains none of them, while
all five are in the other one. `@smartput/geo/providers` does not exist yet and
is M6.3's.

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

**Amended during M6.2: there are two of these, and one of them is a function.**
See §4.4.

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

### 4.4 Two ways to get the kind

**Added during M6.2.** §4 above shows one `const`, which is what M6.1 shipped.
T1 makes that impossible on its own: a `const` built at module scope has to
decide at import time whether it carries six thousand city names, and no bundler
can prove `CITIES` unused once a kind has closed over it. §3's tiering is only
real if the dependency edge runs from the consumer inwards.

```ts
export interface PlaceOptions {
  readonly cities?: readonly CityRow[];
  readonly admin1?: readonly Admin1Row[];
}
export function definePlace(opts?: PlaceOptions): Kind;
export const place: Kind = definePlace();
```

- `place` stays a `const` and stays exported, unchanged. Existing consumers and
  every M6.1 test import it and must keep working; a factory-only API would have
  made the countries-only case a call nobody needed to make, and would have
  broken every import in the repo to buy nothing.
- `place.ts` does not import `data/cities.ts` — asserted at source level in
  `place.test.ts`, not merely by convention, because that single import is the
  whole mechanism. `@smartput/geo/cities` is the only module in the package that
  names it.
- The two options are independent. `{ cities }` without `{ admin1 }` is a
  gazetteer with no scoped names, which is a smaller table and a strictly
  smaller feature — hence two fields rather than one bundle of "T1".
- Each call returns an independent `Kind`, and two of them cannot share a
  registry: both are `id: "place"`. That is intended. A build is a choice made
  once.
- `@smartput/geo/cities` deliberately exports data and no code. A ready-made
  `cityPlace` Kind would have been the shorter usage, but it decides `admin1`
  for the caller and gives the package two same-id kinds a bundler has to keep
  apart. `RESERVED_WORDS` is not re-exported either — see §5.4.

The one cost, recorded because §3's tiering table does not show it:
`matcher.ts` imports `data/reserved.ts` unconditionally, so the countries-only
build pays ~1.9 KB gz for a table it never reads. Deliberate — a guard passed in
as a parameter is one forgotten argument away from a table that eats `march`,
and the fold gives that mistake no second chance.

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

**Amended during M6.3: `targetValue` is now `targetValues`, and the gate is
per-reading.** A claimed span may carry several readings, and the word beneath a
single-token claim may resolve to ordinary units beside them, so one value on
the node no longer describes the target: `ConvertNode.targetValues` is a
`ReadonlyMap<Candidate, Value>` and a candidate absent from it still gets the
synthesized stand-in. Keyed by candidate identity for §4.6's reason. `targetable`
itself is unchanged and still opt-in — it is read off each reading, so a
non-targetable reading contributes nothing to the target slot. `today in
tomorrow` and `mark in mark` still throw `UnitParseError`, with and without geo.

One defect this path grew and lost again, recorded because it is the same
failure `targetValue` was added to prevent. Once the word under a claim started
reaching the target slot, every country name — which is a registered place alias
— arrived a second time as an ordinary unit reading, with no entry in
`targetValues`, took the stand-in carrying the *left* operand's meta, and the
bridge threw on it. `suggest()` swallows `SmartputError`s per assignment, so
`3pm in ukraine` and `100 usd in japan` still evaluated correctly while
returning an empty suggestion list. The fix is one filter: the word's ordinary
readings are dropped for the `(kind, unit)` pairs the claim already named.
Cross-kind pairs survive, which is what keeps `3pm in tokyo`'s two readings.

### 4.6 A claim is a reading, not a verdict — the second core change

**Added during M6.3.** `LiteralMatcher` returned `LiteralMatch | null` and the
fold kept the single longest match, discarding the token underneath it. Three
things fell out of that, and they were one defect:

- `suggest("springfield")` returned one result where `CITIES` holds three (§6.1).
- Seventeen city names yielded to datetime's zone aliases, because yielding was
  the only non-destructive answer a matcher had (§6.3).
- `90210` could not be a number and a postal code at once (§6.2).

Shipped:

```ts
type LiteralMatcher = (
  input: string,
  offset: number,
  ctx: MatchCtx,
) => LiteralMatch | readonly LiteralMatch[] | null;
```

An array is several readings of the **same text**, never several spans. The fold
keeps every match that reaches the furthest end, from every matcher rather than
from the first one to register, and emits one `literal` token carrying
`readings: readonly LiteralReading[]` — `LiteralMatch` minus `length`, since by
then the span belongs to the group, and with `weight` defaulted to `0`. Readings
of a shorter span are dropped rather than ranked below the longer one: they
describe different text. Returning the bare object stays legal and means exactly
what it did; geo returns it for every unambiguous name, which is why only 20 of
`matcher.test.ts`'s ~50 claim assertions moved.

A claim covering exactly one `number` or `word` token keeps that token beside
the readings as `fallback`. The parser offers a number fallback as an ordinary
number candidate — that is the whole `90210` mechanism — at
`NUMBER_FALLBACK_WEIGHT = -0.5`, exported from core so a matcher can name the
number it must weigh itself against. Not `0`, deliberately: a number is in
nobody's alias index and has no weight of its own, so if it scored `0` then any
matcher claiming bare digits without naming a weight would turn a decided input
into an `AmbiguityError`. A claim that says nothing still wins; a matcher that
means to lose says so. A word fallback takes no penalty — it already carries the
analyzer's weight and all four weight layers — and is offered only where a unit
label is legal: the `in` target, and immediately after a number. It is never an
atom, because a bare unit label never was one.

`LiteralNode` carries `candidates` plus `values: ReadonlyMap<Candidate, Value>`
keyed by candidate **identity**, not by `(kind, unit)`. Forced by the data: the
three Springfields are all `place:us` and differ only in which city they are, so
a `(kind, unit)` key collapses them.

Two consequences that are not obvious from the type:

- **The readings are now scored, so `ambiguityEpsilon` sees them.** Weights a
  matcher used only to sort its own hits become weights the engine compares. On
  the shipped gazetteer, emitting §6.1's figures verbatim turned 91 city names —
  `barcelona`, `hyderabad`, `santiago`, `valencia`, `newcastle` — from a decided
  answer into `AmbiguityError`. That is not a defect in the mechanism; it is the
  same rule that already makes `10 m` throw, applied to rankings that were
  previously settled by force. The fix is geo's and is at §6.1.
- **A match naming an unregistered unit is dropped per match**, not per claim,
  so one bad reading no longer costs the whole group.

The rejected alternative was letting a matcher mark a group as "already ranked,
do not compare" — a second axis on the contract that every matcher would then
have to reason about, to save the one matcher with a ranking from spacing its
own weights. If a third kind ever needs it, that is the shape to revisit.

Ruling on the leftover: when a claimed token's word fallback resolves to no
unit, the claim stands and the expression fails on the leftover with
`UnitParseError`, rather than reporting `NoCandidateError` for a token nothing
ever read as a unit. `5 nice` therefore keeps the error class M6.2 recorded.

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

**Amended during M6.2: a city answers a stricter question, and there is a third
guard the spec never named.**

The exemption above is a country's alone. A single-word *city* claim must be four
characters or more, absent from `RESERVED_WORDS` (§5.4), and unclaimed by any
registered unit — in every case, with no capital-letter escape hatch. `new york`
and `big apple` resolve; `nyc` does not, and capitalising it changes nothing.
Multi-word claims keep the M6.1 exemption unchanged, because two words in a row
are nobody's unit and nobody's keyword.

The third guard is a hardcoded `KEYWORDS` set in `matcher.ts`, holding the
locale's eleven keyword surface forms. `MatchCtx` exposes `isUnitAlias` and
nothing for keywords, and a keyword is not a unit — so without it `in` is India,
`to` is Tonga, `as` is American Samoa and `by` is Belarus, and `japan to france`
loses its conversion keyword to a country and never parses. Hardcoded rather than
adding `isKeyword` to `MatchCtx`, which is a change to core's matcher contract
for one plugin's two-letter codes; it is the same trade datetime makes when it
hardcodes English plural suffixes in `chrono-bridge.ts`.

`MAX_WORDS = 4` bounds the *whole* claim, scope included — see §5.2.

### 5.2 Scoping happens in the matcher

`paris texas` is claimed as **one** literal. The trie's leaves carry admin1 and
country children, so `paris` → `texas` is a walk, not an operation.

This is a deliberate rejection of the alternative, which was to make
`paris in us` a scope filter. That alternative would have overloaded
`in | place | place` with two intents — distance and filtering — and forced a
runtime branch on feature class inside one `apply`. Keeping scope in the matcher
leaves the signature meaning exactly one thing.

**Amended during M6.2: what a scope actually matches.** The mechanism is the
walk this section describes. The details it leaves open were all decided by the
data.

- **A scope is a division or a country**, tried longest-first from the trie root
  at the word after the city. `springfield illinois` and `athens greece` are the
  same operation. A scope *narrows*, it does not re-rank: `athens greece` and a
  bare `athens` return the same row, because the scope selects among the rows the
  node already carries in weight order.
- **A division is not a place.** `Admin1Row` carries a key, a name and aliases —
  no GeoNames id, no coordinates, no population. `texas` alone never resolves,
  and there is nothing for §6.1 to rank it as. Divisions exist only to be walked
  into.
- **The abbreviation form works for 26 of the 1,664 divisions.** `houston tx`
  resolves; `springfield il` does not. A division alias below `MIN_NAME_LENGTH`
  is safe only in the scoped position — as the second word of a two-word claim,
  which is nobody's unit and nobody's keyword — so the two-letter codes are
  allowed there and nowhere else. What removes the rest is §5.4:
  `in` is a conversion keyword, `il` is Israel, `ca` is Canada, `or` is a
  conjunction. `tx`, `ny`, `oh`, `wa`, `fl` and 21 others survive.
- **The whole claim is bounded at four words, scope included.**
  `sydney new south wales` is the longest scoped form there is. Giving the scope
  a budget of its own buys nothing — no division name is four words — and one
  bound is one thing to reason about.
- **A scope that selects nothing is not applied.** `paris texas` finds no US
  Paris in the node, so the claim falls back to the unscoped French city and
  `texas` is left dangling, which throws. There is no partial claim and no
  backtracking into a shorter one.

Two failures, both recorded in `ambiguity.test.ts` as passing assertions of the
current behaviour so that fixing either one fails loudly:

- **`paris texas` does not resolve** — the spec's own worked example, and it
  fails on data rather than on matching. Paris, Texas is 25,171 people, below
  T1's floor, so `CITIES` holds exactly one `paris`. `houston texas` proves
  nothing is wrong with Texas. A T2 tier flips this.
- **A division whose name is also a country name cannot scope.** `athens
  georgia` and `columbus georgia` throw. `scopeFrom` guards the division branch
  with `ctx.isUnitAlias(first)`, and every country name is a registered unit
  alias. The guard is correct on the *country* branch and wrong on this one: a
  scope is by construction the second word of a multi-word claim, and two words
  in a row are nobody's unit — which is the exemption the matcher already grants
  the city word beside it. Dropping `isUnitAlias` from the division branch alone
  is the fix; it was left for M6.3 because touching `scopeFrom` sits in front of
  the destructive fold and M6.2 had already spent its risk budget there.

### 5.3 Facts render, they do not compute

A bare place formats to its facts:

```
japan       →  Japan — JPY, +81, Asia/Tokyo, 124M
kyiv        →  Kyiv, UA — Europe/Kyiv, 2.9M
SW1A 1AA    →  London SW1A 1AA, GB — Europe/London
```

`format` reads `meta`. No op, no grammar, no parser change, and the launcher
gets its lookup answer from the same path that renders every other Value.

**Amended during M6.2: a city renders its country's row, and the `kyiv` line
above is not what ships.** `formatPlace` does `BY_A2.get(value.unit)`, and a
city's unit is its country, so:

```
kyiv            →  Ukraine — UAH, +380, Europe/Kyiv, 40M
vancouver       →  Canada — CAD, +1, America/Toronto, 37M
houston texas   →  United States — USD, +1, America/New_York, 327M
```

Two consequences, and the second is the one that matters. Every city of a country
renders the same string, so `houston texas` and `springfield illinois` are
indistinguishable. And the rendered zone actively contradicts the zone the same
Value hands the datetime bridge: Vancouver prints `America/Toronto` while its
`meta.zone` is `America/Vancouver`, which is what `noon in vancouver` uses.

Everything a program reads is right — the canonical is the city's own GeoNames
id, and `meta.zone`, `meta.lat`, `meta.lon` and `meta.population` are the city's.
Only the formatted string is wrong.

This is unfixable without a decision this section does not contain, which is why
M6.2 shipped it rather than guessing. `format` reads `meta` because §3.1 keeps
`PlaceMeta` display-name-free — it is the bridge contract, and widening it makes
datetime and rates pay for a field only the formatter wants. The alternatives are
to widen it anyway, or to close `formatPlace` over `opts.cities` so the kind
carries its own display table. Either way every city row of
`packages/geo/corpus/en.tsv` changes its expected text, which is a deliberate
commit and not an integrator's edit. **M6.3 owns this.**

### 5.4 `RESERVED_WORDS` — the words a place may not eat

**Added during M6.2, and the most important thing this milestone discovered.**
The spec as written has no answer to it, because §5.1's two guards were designed
against *countries* and countries are the easy case.

A country name is a proper noun no locale uses for anything else. That is what
earns §5.1's exemption, and it does not transfer. City names are ordinary words:
Nice, Mobile, Reading and Split are all over 100,000 people, and a T2 tier
reaching down to the towns finds March, Boring and Why. `isUnitAlias` does not
help — the words that do the most damage are nobody's unit — and §5.1's
lowercase-code rule does not either, because these are full-length names.

The literal fold is destructive. A claim has no second chance: no weight and no
solver ranking can give a word back once the matcher has eaten it. So the answer
cannot be a ranking, and it cannot be a guard that fires "usually". It has to be
a set, applied before the data ships.

```ts
// packages/geo/src/data/reserved.ts — generated, committed, body-hash checked
export const RESERVED_WORDS: ReadonlySet<string>   // 805 words
```

**Derived, never transcribed.** `buildReserved()` reads six vocabularies out of
the packages that own them:

| Source | Contributed |
| --- | --- |
| core `locale/en` keyword surface forms | 11 |
| `@smartput/number`'s `NUMBER_WORDS` | 35 |
| `Intl` months and weekdays for `en`, long and short | 38 |
| chrono's `en.casual` patterns, off `parser.pattern(ctx).source` | 1,027 |
| `BUILTIN_KINDS` unit ids, aliases, symbols and display forms | 338 |
| geo's own `COUNTRIES` aliases below `MIN_NAME_LENGTH` | 508 |

Plus exactly one hand-written entry — `or`, for Oregon's admin1 code. No kind,
keyword or numeral produces the conjunction, so no source can derive it; it
carries its justification in the generated header and is pruned automatically if
any source ever starts producing it. That is the whole of the hand-written part,
which is what stops this being a hand list wearing a generator's clothes. A hand
list fails on the word it forgets; a derived one fails only when a package
changes its vocabulary without regenerating, and the body hash catches that.

Three rulings about where it applies:

- **The generator applies it, not the matcher.** `CITIES` and `ADMIN1` ship
  containing none of it. `cityClaimable` consults it again at match time anyway —
  two nets, because the set is a property of the matcher and not of the tables a
  caller supplies.
- **`COUNTRIES` is deliberately not filtered by it.** §5.1's `claimable` already
  refuses every lowercase short code by surface, and filtering the country table
  would take `japan to UA` with it. `reserved.test.ts` asserts no country alias
  of four characters or more is in the set, so the separation costs nothing
  today.
- **It is not re-exported from `@smartput/geo/cities`.** It is the generator's
  refusal list, already applied; a consumer who could see it would have no
  operation to perform with it, and publishing it invites a second filter that
  drifts.

Where it actually earns its keep is divisions, not cities. **Zero city aliases
were refused by it** — `MIN_NAME_LENGTH` removes every name short enough to be a
keyword first, and no city of 100,000 people is called March. On `ADMIN1` it
takes `in` from Indiana, `or` from Oregon, `ca` from California and `il` from
Illinois, leaving 26 of 1,664 divisions with a two-letter alias. Without it
`paris in ukraine` claims `paris in` as a city in Indiana and swallows the
conversion keyword.

**The hole it leaves**, named here because it is the cause of §6.3's failure:
`@smartput/datetime` is not among the sources. Its zone aliases are therefore
still in the tables, and the collision has to be fought at match time by
`isUnitAlias` instead of being absent from the data. Adding datetime as a seventh
source is not obviously right — it would delete `paris` and `london` from the
gazetteer for every consumer, including those who never register datetime.

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

**Amended during M6.2: the four numbers are exactly as tabled. The sentence
under the table is wrong in three places.**

The weights shipped unchanged — `+3`, `+2`, `min(log10(pop) / 3, 2)`, `+4` — with
two details the table does not state. A capital is flat rather than scaled,
because the reason it is weighted at all is that it is a seat of government:
Nuku'alofa is 22,400 people and is still what `nuku'alofa` means. And a row with
population `0` scores `0` rather than `-Infinity`.

What is wrong is where the ranking happens and what it decides.

- **The ranking is inside the matcher, not in the solver.** A `LiteralMatcher`
  returns `LiteralMatch | null`, so exactly one claim per offset escapes to the
  fold. The weights above sort the rows at a trie node and choose which one that
  is; the winner's weight then reaches the solver, where it competes with other
  *kinds* and never with another place. "`suggest()` returns the alternatives"
  therefore cannot be true — `suggest("springfield")` returns one result where
  `CITIES` holds three Springfields. Fixing it needs the matcher contract widened
  to return an array, which is a change to core, not to geo. Asserted with the
  count in `ambiguity.test.ts`.
- **Country beats city as control flow, not as a comparison.** The matcher tries
  the country payload of a node first and returns on a hit. `+3` against a `+2`
  cap means the two can never tie, so scoring both and taking the maximum would
  be a longer way to write the same line.
- **A guard outranks every weight.** `claimable`, `cityClaimable` and
  `RESERVED_WORDS` run before any weight is computed, and a refused claim does
  not fall back to a lighter one. This is what §6.3 turns on.

The rows the shipped data actually decides, with the ids, since `paris texas`
is not among them (§5.2):

| Input | Winner | Over | Why |
| --- | --- | --- | --- |
| `athens` | Athens, GR `264371` `+2` | Athens, GA `+1.70` | capital |
| `san jose` | San José, CR `3621849` `+2` | San Jose, CA `+1.9996` | capital, and by 0.0004 — 335,007 people beating 997,368 is what proves the rule is not population in disguise |
| `springfield` | Springfield, MO `4409896` | IL, MA | no capital among them, so `log10(pop)/3` is the whole ranking; the spec's own text predicted Illinois and the data says Missouri, 170,188 to 114,394 |
| `georgia` | the country `614540` `+3` | — | US.GA is a division, and a division is not a place, so there is nothing to outrank |

**Amended during M6.3: the table is what the *winner* scores. The runners-up are
spaced.** M6.2's first bullet is now closed — the matcher returns its ranked
readings (§4.6) and `suggest("springfield")` returns three — and closing it
exposed what the table never had to say, because until M6.3 only one number ever
left the package.

Emitted verbatim, the ranking is not a ranking the engine can read. §6.1
separates San José CR from San Jose CA by `0.0004` and the three Springfields by
`0.058`, and `ambiguityEpsilon`'s 0.05 default on softmax confidences needs
roughly a `0.15` gap. Measured across all 6,973 distinct city aliases: **91
regress from a decided answer to `AmbiguityError`, and zero change their decided
answer** — `barcelona`, `hyderabad`, `santiago`, `valencia`, `hamilton`,
`newcastle`, `richmond`, `alexandria`, `victoria` among them, plus the committed
corpus rows `san jose` and `springfield`.

So `matcher.ts` exports `RANK_STEP = 0.5` and clamps each reading to at least
that far below its predecessor. **A clamp, never a lift**: the winner keeps the
exact figure the table gives it, because the winner's weight is the one that
leaves this package — it is what a place scores against a datetime zone in
`3pm in tokyo` — and a Tokyo that got heavier for having homonyms would let the
size of the gazetteer decide a question between two kinds.

Three alternatives, all measured and all rejected: comparing only assignments
distinguishable by `(kind, unit)` does not fix `san jose` (cr/us/ph) or
`barcelona` (es/ve); re-recording the corpus fixes 2 of 91;
`tiebreak: "first"` fixes 91 of 91 and disables the guard that makes `10 m`
throw. Lowering the epsilon to 0.02 still leaves 59 ambiguous.

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

**Amended during M6.3: shipped, with one rule this section does not have and one
sentence of its reasoning that is false.**

The headline holds and is now real rather than asserted:
`evaluate("90210")` is `90,210` and `suggest("90210")` is
`[number 90,210, place 90210, US]`, in the countries-only build as much as the
city one. `createPostalLiteral(COUNTRIES)` is registered by both `place` and
`definePlace()` unconditionally — a postal format is T0 data, one column of
`COUNTRIES`, so gating it on `opts.cities` would tie a country's own format to a
gazetteer it has nothing to do with. 178 of the 252 rows carry a format.

The weight is what makes `90210` a number, not the fold hiding anything: a
digits-only span weighs `NUMBER_FALLBACK_WEIGHT - RANK_STEP`, derived from
core's constant rather than written as `-1` so that a bump to core's number
cannot silently make a postal claim win. Everything else weighs `+3`, a
country's weight, because what this matcher produces is a country's Value
reached through a code instead of a name — not the scoped `+4`, which is paid
for being explicit about *which* place, and a code is explicit about nothing.

**The rule this section is missing.** §6.2 gives two categories, lettered and
qualified. There are three, and the third is the load-bearing one:

| Shape | Example | Claimed |
| --- | --- | --- |
| Qualified | `us 90210`, `100-0001 japan` | anywhere |
| Unqualified, carrying a letter | `SW1A 1AA`, `M5V 3L9`, `AD123` | anywhere |
| Unqualified, no letter | `90210`, `01310-100`, `123 45` | **only as the entire input** |

Sixty countries have a format that fits five bare digits and forty-three fit
four. Without the whole-input rule every 3-to-6-digit number in every expression
would carry a dead place candidate, and `12345-6789` would stop being a
subtraction wherever it appeared. `90210 + 1` is 90,211 and `12345 - 6789` is
5,556.

**The false sentence** is "a code carrying a letter … or a separator … cannot be
a number". The separator half is wrong for both of its own examples:
`01310-100` is 1,210 and `12345-6789` is 5,556 as ordinary arithmetic, and both
are answers geo takes from an engine that already had one. They are the only two
such answers across 1,381 probed inputs, they are scoped by the whole-input
rule, and `suggest()` cannot offer the number underneath because the claim spans
three tokens and the fold's fallback only survives under a single-token claim
(§4.6). Implemented as the section rules; the reasoning that justified the rule
does not hold, and a later milestone may want to weigh a separator-carrying
digits-only code the way a bare one is weighed instead.

Two further rulings the shipped matcher makes:

- **`usa 90210` is not claimed; `us 90210` is.** A qualifier shorter than
  `MIN_NAME_LENGTH` must be the alpha-2, because the alpha-3 column is where
  `and` is Andorra, `ago` is Angola and `can` is Canada — §5.1's rule, applied
  to the qualifier slot.
- **A trailing qualifier yields to a registered unit symbol, and so does a
  trailing word inside the code.** The Netherlands' format is `#### @@`, which
  is exactly a four-digit quantity beside a two-letter unit symbol, so without
  a guard `1234 kg` is a Dutch postcode rather than a mass — and so are
  `1000 ms`, `5000 mi`, `1234 cm`. The claim spans both tokens and therefore has
  no fallback, so the guard refuses it. `1234 kg` is a real Kerkrade postcode;
  it is reachable as `nl 1234 kg`, which is the same trade `90210` against
  `us 90210` already makes. Found by sweeping all 169 registered unit aliases
  against numbers of seven widths.

A code's Value is the **country**, addressed by a code: `geonameId` is `0`
(GeoNames issues no feature id for a postal code, and `0` is not one it hands
out), `name` is the code itself so the line reads `90210, US — USD, +1,
America/New_York, 327M`, and the coordinates are the country's. The claim is
`targetable`, so `3pm in us 90210` is `2026-01-15 10:00 ET` and
`100 usd in us 90210` is `$100.00`.

**A code refuses to be measured.** `us 90210 to japan` throws
`UnpositionedPlaceError` rather than returning a country-to-country distance.
The borrowed coordinates keep the zone, the currency and the country usable, but
they are not a position the code has, and measuring from them shipped an answer
that was wrong without saying so: every pair of codes within one country
returned `0 kilometres`, so `SW1A 1AA to EH1 1YZ` — London to Edinburgh —
measured zero.

The rule that produced it was `positionOf`'s, and it was right where it was
written: a canonical of zero means core's stand-in operand, whose `meta` belongs
to the *left* side, so the lookup falls back to the unit. A postal claim reuses
canonical `0` for an unrelated reason — GeoNames issues no id for a code — and
inherited a fallback meant for something else. The op now refuses when either
operand's `meta.geonameId` is `NO_GEONAME_ID`, which the stand-in never is.

Refusing rather than approximating is the same choice `evaluate` makes when it
throws `AmbiguityError` instead of picking a reading. Coordinates of the code's
own need the provider path (§8), and the error names it.

Where several countries share a format, the readings travel together and are
spaced by `RANK_STEP` for §6.1's reason — `suggest("SW1A 1AA")` is GB, then
Jersey, Isle of Man and Guernsey; `suggest("123 45")` is CZ, SE, SK. The one
exception is a bare digits-only code, which keeps **one** reading: sixty
countries accepting five digits are not alternatives a user could pick between,
the shape carries no country in it at all, and sixty rows under the number in a
launcher list would bury the number's own. Naming a country is how the other
fifty-nine are reached.

### 6.3 Place against zone

`3pm in tokyo` and `tokyo to kyoto` both contain `tokyo`. Both readings survive
to the solver, which is the engine's whole thesis. The first has a
`in | datetime | place` signature and no competing one; the second has
`in | place | place`. Neither needs a tiebreak.

`datetime`'s `ZONES` keeps its eighteen entries. Those are datetime's *units* —
an IANA zone genuinely is one — and its display symbols live there. What geo
removes is the pressure to grow that table into a city gazetteer.

**Amended during M6.2: both readings do not survive. Only one ever does, and
which one depends on what else is registered.**

`cityClaimable` refuses any single word `ctx.isUnitAlias` reports, so in an
engine with datetime the trie never claims `tokyo` at all. Seventeen single-word
city aliases are lost this way, each one an alias of one of datetime's eighteen
zones:

```
auckland  beijing  berlin  chicago  delhi  denver  dubai  kiev  kolkata
kyiv  london  moscow  mumbai  paris  shanghai  sydney  tokyo
```

Measured by diffing matcher claims between a geo-only registry and a
`BUILTIN_KINDS + datetime + money + geo` one, over every single-word alias in
`CITIES`: 17 lost, 0 changed. So in the engine a real consumer builds,
`tokyo to kyoto`, `kyiv to warsaw`, `paris to berlin`, `london to paris` and
`chicago to denver` all throw, and `3pm in tokyo` works and is byte-identical to
the same engine without geo. Without datetime, every one of them is a distance.
`kyoto to osaka` works in both, because datetime has never heard of Kyoto.

This is not a tuning failure. The paragraph above assumes a claim and a unit
reading can both reach the solver to be ranked; the fold makes that impossible,
because a claim that is made is the only claim there is. Yielding is the only
non-destructive answer a matcher has. The real fix is at core level — letting a
literal claim and a unit reading coexist as candidates — and it is the same core
change §6.1's `suggest()` gap needs. Recorded honestly in `ambiguity.test.ts`,
which asserts both halves.

Note the consequence for the package's own corpus: `packages/geo/corpus/en.tsv`
asserts `kyiv`, `paris`, `kyiv to warsaw`, `tokyo to kyoto` and `paris to berlin`
and passes because `corpus.test.ts` builds an engine of `[number, length, place]`
that never registers datetime. Those rows are true of that engine and not of
every engine.

**Amended during M6.3: the M6.2 amendment above is spent. §6.3 as originally
written is what shipped.** The core change it named as the real fix landed in
§4.6, and `cityClaimable` no longer consults `ctx.isUnitAlias` at all — that
guard only ever existed because the fold was destructive, and yielding was the
only non-destructive answer a matcher had. All seventeen names are back:
`tokyo to kyoto` is 364.743 km, `kyiv to warsaw` 688.971 km, `paris to berlin`
878.399 km, `london to paris` 343.771 km, `chicago to denver` 1,475.384 km — in
the full `BUILTIN_KINDS + datetime + geo` engine, where every one of them threw
at M6.2. `3pm in tokyo` is byte-identical with and without geo, and the corpus
rows above are now true of every engine rather than of one.

`RESERVED_WORDS` stays. The words it holds — `march`, `may`, `one`, `km` — are
not readings to be ranked: a claim over one of them competes with a numeral or a
keyword, and neither of those ever reaches the solver as a candidate.

One cosmetic consequence, not a defect and not fixed: `suggest("3pm in tokyo")`
returns two results with identical formatted output, the place bridge and the
zone alias. Both are genuine readings — that is what this section asked for —
but they render as a duplicate row in a launcher list.

## 7. Data

### 7.1 Tiers

| Tier | Contents | Rows | Shipped | gzip |
| --- | --- | --- | --- | --- |
| **T0** | Countries: name, aliases, alpha-2/3, currency, calling code, capital, capital's zone, population, area, lat/lon | ~250 | always | ~25 KB |
| **T1** | Cities with population > 100k: name, aliases, country, admin1, lat/lon, zone, population | ~5.1k | `@smartput/geo/cities` | ~180 KB |
| **T2** | Full `cities1000`, postal codes, admin divisions | ~150k / ~1.5M | provider only | — |

T0 alone is a working package. T1 is where `kyiv to warsaw` starts working, and
it is a separate import so the cost is opted into.

**Amended during M6.2: T1's row and size are both understated.** Shipped is
**6,247 cities** at **+234 KB gz**, not ~5.1k at ~180 KB. The rule is "over
100,000 people **plus every seat of government, whatever its size**" — the
second clause covers all 241 capitals, 78 of which are below the floor and would
otherwise be missing, and Nuku'alofa at 22,400 is why it exists. The size miss is
the row count, not waste. Each table
bundled and gzipped on its own: `CITIES` 210.6 KB, `ADMIN1` 22.7 KB, `COUNTRIES`
22.9 KB, `RESERVED_WORDS` 1.9 KB.

T1 also ships **1,664 `Admin1Row` divisions**, which this table does not list at
all. They are what §5.2's scope walks into, and they are deliberately not places.

Sixty-five cities over 100,000 people are **absent**, because every alias they
had was refused: under four characters (`Ufa` 1.1M, `Fes` 1.19M, `Jos` 1.04M,
`Qom` 900k, `Huế` 1.38M), over four words (`São José do Rio Preto` 480k), or a
shape the alias rule will not take — a dot, a comma, a leading digit, a leading
apostrophe. Each is named with its reason in `data/cities.ts`'s header. Short
names are the real cost of this tier and the obvious candidate for a curated
alias allowance in T2.

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

**Amended during M6.3: shipped, with four additions this section does not
name.** The three interfaces are as written, behind `@smartput/geo/providers`.

`Place` **extends** `PlaceMeta` rather than paralleling it, for the reason
`RateSnapshot extends RateLookup`: a provider row drops straight into a Value's
meta with no adapter, and an adapter is where the field list the bridges read
would drift. It adds two fields the vendored tiers do not need — `admin1`,
because T2 is where `paris texas` finally has a second Paris (§5.2), and
`postal`, because a postal row is a place whose name is a code (§6.2). Both are
`""` rather than optional.

What a provider cannot fill it leaves empty rather than faking. `zone` is `""`
on every postal row — neither upstream carries one, and defaulting to the
capital's zone would put a confident wrong answer behind the
`in | datetime | place` bridge, since Beverly Hills is not on New York time.
`currency` is `""` everywhere: it is a country-level fact, `COUNTRIES` already
holds it, and shipping a currency table inside this entry point would give it
the data §3 promises it does not have. `geonameId` is `0` on a postal row. Two
such rows therefore compare equal under §4.2's canonical identity, which is the
known cost; the rejected alternative was hashing the code into a synthetic id,
which would look stable and collide with a real one.

Three exports beyond the interfaces:

- **`placeSnapshot(asOf, places)`** — a dated, immutable `PlaceLookup`, the geo
  mirror of rates' `snapshot()`. A postal code is indexed as one more name the
  row answers to, in the same map as its place name, so `find("90210")` and
  `find("beverly hills")` are one call and one miss path. Rows are sorted
  heaviest-first once at build, by population and not by §6.1's weights — those
  are the matcher's, computed from a trie node, and a provider row carries
  neither a capital flag nor the country/city distinction they turn on. A hint
  that selects nothing returns `null`, the opposite of §5.2's ruling for the
  matcher: there a refused claim throws the whole input away, here the caller
  asked a narrower question and can read `null`.
- **`PlaceProviderError`** — extends `SmartputError`, because
  `instanceof SmartputError` is the discriminator this codebase branches on.
  Not added to `core/errors.ts` beside `RateProviderError`: core hosts the
  errors its own evaluate path can throw, and no provider error ever crosses it.
- **`normalizeName`** — lowercased, trimmed, inner whitespace collapsed.
  Diacritics deliberately left alone, because the trie does not strip them
  either and a lookup that disagrees with the matcher about what one name is
  would be the worse bug.

`geonames()` has **two** methods, not one, because GeoNames has two indexes:
`lookup` searches toponyms and `postal` looks a code up, and a code is not a
toponym — `searchJSON` with `q=44657` finds nothing at all. Routing both through
`lookup` on a guess about the query's shape decides wrongly and silently for
every country whose codes contain letters. Three details worth recording: the
default host is `secure.geonames.org` and not the `api.geonames.org` the docs
print, whose certificate names only the former; an exhausted quota, an unenabled
username and a malformed query all arrive as **HTTP 200** with an error envelope,
so the envelope is checked before the payload; and `style=FULL` is not a knob,
because `MEDIUM` omits `timezone` and a place with no zone cannot serve the
bridge that is half the reason this package exists.

`postalCodes()` fetches a country file **whole** and keeps it — `us` is 12 MB
and 41,490 codes, so a per-lookup request would re-download all of it to answer
one code. The cache holds the in-flight promise, so a burst of lookups on a cold
country makes one request. It has no default URL: the collection is a few
hundred megabytes published as zips rather than an API, and naming any third
party here would hardcode their bandwidth as this package's transport. A query
naming no country throws rather than guessing — `1000` is Brussels, Sofia,
Manila and Ljubljana.

Neither provider caches or rate-limits. The credits are the consumer's to spend,
and the TTL that spends them belongs to §8.1, not to a provider that cannot know
how often it is called.

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

**Amended during M6.3: lifted as ruled, and the second consumer does not exist.**

`packages/core/src/live.ts` exports `createSnapshotCache<S>` and
`createCachedEngine<S>`, generic over the snapshot type, with the TTL, the
shared in-flight promise and the `finally` that clears on rejection. Core takes
on no I/O and no dependency: `load` is injected. `createLiveEngine` in
`@smartput/rates` is now built on it and its public signature is unchanged.
`createCachedEngine` caches the snapshot and the engine built from it as one
pair, so a rebuild happens inside the shared load and the two cannot come apart.

Geo does **not** construct from it. Nothing in `packages/geo` references either
function: the package ships `PlaceLookup`/`PlaceSnapshot`/`PlaceProvider`,
`placeSnapshot()`, `geonames()` and `postalCodes()`, and no cached or live
engine over them. So the lift is correct and rates is unaffected, but the
justification this section gives it — "a second consumer is the point at which
the shape is proven rather than guessed" — is **not yet earned**. What is
missing is the decision the guide has to make for a consumer today: a provider
row is a `Place`, and a kind is built from `CityRow`s, so anyone assembling a
live place engine writes that mapping themselves. Either geo ships a
`createLivePlaceEngine` that owns the mapping, or it ships the mapping alone and
the facade stays core's. That is M6.4's to rule on; the guide documents the
hand-assembled form in the meantime.

One behaviour change in the rates lift, uncovered by any test and noted rather
than treated as a defect: if `createEngine` threw during a load, the old code
left `rates` set — so `ratesAsOf` reported a snapshot with no engine — while
core's cache assigns `current` only after the build succeeds.

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

**Amended during M6.2: the file names differ, two of the six ambiguity rows fail
outright, and a third only half holds.**

Shipped is `data/cities.test.ts`, `data/reserved.test.ts`,
`data/countries.test.ts` and `scripts/geo/build.test.ts` where the table says
`data.test.ts` and `fixtures/geonames.test.ts`. Naming only — every assertion
this table asks for is present.

`ambiguity.test.ts` now exists. Row by row, as asserted:

| Row | Holds? |
| --- | --- |
| `90210` stays a number, `us 90210` does not | Holds for the half that exists; the postal half is M6.3's and is asserted in its pre-M6.3 form so that milestone cannot move it silently |
| `paris` ranks France | Holds — `2988507`, the French *city*, unit `fr` |
| `georgia` ranks the country | Holds — `614540`, and the state is not a place at all |
| `suggest()` returns both Parises | **Fails**, structurally. See §6.1 |
| `paris texas` resolves to the Texan one | **Fails** on data. See §5.2 |
| `tokyo` is a zone in one sentence and a place in the other | **Half.** The zone half holds in every engine; the place half only in an engine without datetime. See §6.3 |

`ambiguity.test.ts` is also the regression net for the whole tier, which matters
more than any single row above: every corpus in the repo — core's `en.tsv` and
`en-complete.tsv`, datetime's, rates' and geo's own — is replayed through its
owning package's engine plus the 6,247-name kind. Discovery is a filesystem glob
asserted equal to the replayed set, so a corpus added later fails the net rather
than escaping it. Result: no row in the repo changed kind, canonical or formatted
output, and no completion row changed.

Two behaviour deltas that no corpus can show, recorded because a caller would
care:

- Registering the tier only ever turns nothing into something. `nice`, `mobile`,
  `reading` and `split` threw `UnitParseError` before and are places now; no
  input that had a reading changed it.
- `5 nice` and `10 mobile` moved from `NoCandidateError` to `UnitParseError` — a
  claimed place where a unit was expected is a parse failure rather than a
  missing candidate. Both still mean "no reading".

Getting the `3pm in tokyo` half of the table into `packages/geo/src/` needed
`@smartput/datetime`, `@smartput/kinds` and `@smartput/rates` in geo's
`devDependencies`. Runtime dependencies are unchanged and `check-deps` still
passes; relative cross-package imports fail `typecheck` with TS6059 under geo's
`rootDir`, which is why it is a dependency rather than a path.

**Amended during M6.3: four of the six ambiguity rows now hold, and five test
files are new.** Replacing the M6.2 table:

| Row | Holds? |
| --- | --- |
| `90210` stays a number, `us 90210` does not | **Holds in full.** `evaluate("90210")` is 90,210 and `suggest("90210")` carries the place behind it, in both builds |
| `paris` ranks France | Holds — unchanged |
| `georgia` ranks the country | Holds — unchanged |
| `suggest()` returns both Parises | **Still fails, now on data alone.** `suggest()` genuinely returns runners-up — three Springfields, two Athenses — but T1 carries one Paris, so this row needs T2 rather than more matcher work |
| `paris texas` resolves to the Texan one | **Fails** on the same data limit. See §5.2 |
| `tokyo` is a zone in one sentence and a place in the other | **Holds**, in every engine. See §6.3 |

New files: `postal.test.ts` and `provider.test.ts` in geo, `providers/geonames.test.ts`
and `providers/postal-codes.test.ts` beside them, and `live.test.ts` in core —
105 tests. Both providers are driven through an injected `fetch` against
committed fixtures of a real response, which is the same rule §7.3 sets for the
GeoNames dumps: the fixture is what pins the field names, and
`postalcodes`/`postalcode` against `postalCodes`/`postalCode` is a difference
between two endpoints of the same service that no amount of care remembers.

Three tests §12.3 wrote to fail when the defects were fixed fired exactly as
designed and were rewritten: `suggest("springfield")` is 3 where it asserted 1,
`tokyo to kyoto` no longer throws under datetime, and `suggest("90210")` is
`[number, place]` where it asserted `[number]`.

One control this section should record, because getting it wrong makes a whole
file pass tautologically: `postal.test.ts`'s "registering this costs nothing"
comparisons are built from `createPlaceLiteral` alone, not from the shipped
`place` — which now registers the postal literal too, so using it as the control
would have compared the subject against itself.

## 10. Milestones

Each independently shippable, each with its own plan.

| M | Scope |
| --- | --- |
| **M6.1** | Package, `place` kind, T0 countries, `placeLiteral`, `in \| place \| place` distance, `format`. Datetime and rates bridge signatures. |
| **M6.2** | T1 cities, admin1 scope matching, weights, `suggest()` ranking. |
| **M6.3** | `PlaceProvider`, generic cache facade lifted into core, `geonames()` and `postalCodes()` providers, `postalLiteral`. |
| **M6.4** | Completion surface: country and city prefix completion, postal format validation and normalization. |

**Amended during M6.2: `suggest()` ranking was not delivered and is not
deliverable here.** It needs `LiteralMatcher` widened to return an array — a
change to core's matcher contract, which is the same change §6.3's collision
needs. M6.3 inherits it along with the four items in §12.

**Amended during M6.3: M6.3's row is complete, and it carried M6.2's debt.** The
widened contract (§4.6) landed here, so the `suggest()` ranking M6.2 deferred
shipped in M6.3 rather than in the milestone that promised it. M6.4's row is
unchanged in scope, and §12.4 lists what it now starts from.

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

## 12. What has actually shipped

Recorded so the later sub-milestones start from the truth rather than from §2.
Updated at the end of every sub-milestone.

### 12.1 M6.1 — countries

| Shipped | Deferred to |
| --- | --- |
| T0: 252 countries, generated and committed, body-hash checked | T1 cities — M6.2 |
| `place` kind, trie matcher, multi-word names | admin1 scoping — M6.2 |
| `in \| place \| place` great-circle distance | postal literals, `90210` — M6.3 |
| datetime and rates bridges, both dependency-free | providers, live engine, lifted cache facade — M6.3 |
| Fact formatting: `japan` → `Japan — JPY, +81, Asia/Tokyo, 127M` | completion — M6.4 |

Deviations, all amended into their own sections above: the Pratt parser did
change (§4.5), country codes are not alias-index entries (§4.1), and a lowercase
two- or three-letter code is never claimed (§5.1).

### 12.2 M6.2 — cities

| Shipped | Deferred to |
| --- | --- |
| T1: 6,247 cities and 1,664 divisions, behind `@smartput/geo/cities` (§7.1) | `paris texas` — needs a T2 tier, no milestone |
| `definePlace()` factory; `place` unchanged (§4.4) | — |
| Entry-point split verified with a bundler, not by reading imports (§3) | — |
| admin1 and country scoping, abbreviation form for 26 divisions (§5.2) | `athens georgia` — M6.3 |
| §6.1's four weights, exactly as tabled (§6.1) | `suggest()` ranking — needs a core change, M6.3 |
| `RESERVED_WORDS`, derived from six vocabularies (§5.4) | — |
| `ambiguity.test.ts`, and every corpus in the repo replayed against the tier (§9) | — |
| City zone and currency reach the bridges: `noon in vancouver`, `100 usd in kyoto` | — |
| — | A city's *formatted* output — M6.3 (§5.3) |

### 12.3 What M6.3 inherits

Two defects. Both are asserted in `ambiguity.test.ts` as the behaviour they
currently have, so that fixing either fails a test rather than passing silently.

Two more were found by this section and fixed before M6.2 was committed, and are
recorded here because the reasoning outlived them:

- **A city formatted as its country** (§5.3). `athens` rendered "Greece — EUR,
  +30, Europe/Athens, 11M" while the same Value's meta said Athens, 664,046, and
  every US city rendered the identical "United States" string. The rendered zone
  contradicted the zone that Value hands the datetime bridge. Fixed by widening
  `PlaceMeta` with the place's own `name` — the alternative, closing
  `formatPlace` over `opts.cities`, would have put a static edge from the
  formatter to the gazetteer and undone §3's entry-point split. Ten corpus rows
  changed with it.
- **`athens georgia` threw** (§5.2), which is §9's headline row. `scopeFrom`
  refused a division whose first word is a registered unit alias, and every
  country name is one. The guard is right on the country branch and redundant on
  the admin1 branch, where the division only wins if a candidate city is really
  in it — a stronger check than the guard. The `KEYWORDS` test beside it is what
  actually keeps `paris in ukraine` intact, and it stays.

Still open:

1. **`suggest()` cannot return a runner-up** (§6.1) and **17 city names yield to
   datetime** (§6.3). One root cause: `LiteralMatcher` returns at most one claim
   and the fold is destructive. Both need the matcher contract widened to an
   array, which is a core change, and it should be made once for both.
2. **Opaque kinds cannot complete.** `complete.ts:63` skips non-ratio kinds
   outright, so M6.4's place completion has to go through the matcher's trie
   rather than the alias index. Not geo-specific — datetime has the same hole and
   nobody had hit it. Carried from M6.1, still true.

And one standing risk that is nobody's defect: `packages/geo/src/data/cities.ts`
is 1.4 MiB. Biome's default `files.maxSize` is 1 MiB and an oversized file is
**skipped with a warning, not failed**, so `bun run check` was exiting 0 while
the largest file the milestone added was the one file nothing linted. `biome.json`
now sets `files.maxSize` to 4 MiB. The reason cannot live beside it — Biome 2.5.6
rejects comments in `biome.json`, and adding one makes `biome check .` process
zero files — so it is recorded here.

**Amended during M6.3: item 1 is closed and item 2 is not.** The widened contract
and the non-destructive fold shipped (§4.6): `suggest()` returns ranked
runners-up and all seventeen names are back. Item 2 is untouched and carries
forward to M6.4 — see §12.4.

### 12.4 M6.3 — postal codes, providers, and the matcher contract

| Shipped | Deferred to |
| --- | --- |
| `LiteralMatcher` widened to a group of readings; the fold is no longer destructive (§4.6) | Letting a matcher mark a group "already ranked" — no milestone, §4.6 records the shape |
| `createSnapshotCache` / `createCachedEngine` lifted into core; rates rebuilt on them (§8.1) | Geo constructing from them — M6.4 (§8.1) |
| `createPostalLiteral`, registered by `place` and `definePlace` alike (§6.2) | Postal format validation and normalization — M6.4 |
| `RANK_STEP` spacing, so a ranking survives being scored (§6.1) | — |
| `Place`, `PlaceHint`, `PlaceLookup`, `PlaceSnapshot`, `PlaceProvider`, `placeSnapshot()`, `PlaceProviderError` (§8) | — |
| `geonames()` with `lookup` and `postal`; `postalCodes()` over a consumer-named mirror (§8) | T2 in the vendored tiers — no milestone |
| `suggest()` ranking, the debt M6.2 deferred (§6.1) | Completion for opaque kinds — M6.4 |
| The 17 datetime-shadowed city names, and `3pm in tokyo` unchanged beside them (§6.3) | — |

Deviations, all amended into their own sections: §6.1's table describes the
winner and not the runners-up (§6.1); §6.2's "a code carrying a separator cannot
be a number" is false for both of its own examples (§6.2); §8.1's justification
for the lift is not yet earned, because geo does not construct from it (§8.1);
and §6.3's M6.2 amendment is spent (§6.3).

Two defects found while building this and fixed rather than documented, recorded
because the reasoning outlives them. `suggest()` returned an **empty list** for
every conversion whose target is a claimed place whose name is also a registered
unit alias of the same kind — `3pm in ukraine`, `100 usd in japan` — because the
word under the claim arrived a second time with no `targetValues` entry; §4.5
has it. And the Netherlands' `#### @@` format made `1234 kg` a postcode instead
of a mass; §6.2 has it. Both were found by sweeping rather than by spot check,
which is the only way either would have surfaced.

Still open, for M6.4:

1. **Opaque kinds cannot complete.** Unchanged from §12.3's item 2 and from
   M6.1's before it. `complete.ts:63` skips non-ratio kinds outright.
2. **`12345-6789` and `01310-100` stop being arithmetic.** The only two answers
   geo takes from an engine that already had one, across 1,381 probed inputs,
   and `suggest()` cannot offer the number underneath because the claim spans
   three tokens (§6.2). Implemented as §6.2 rules; the reasoning behind the rule
   is what does not hold.
3. **`paris texas` still does not resolve**, and §9's "both Parises" row still
   fails. Both are the same T1 floor — Paris, Texas is 25,171 people — and
   neither is a code limit. `suggest()` returning runners-up is proven with
   three Springfields; there is simply one Paris to return.
4. **Geo has no live engine.** The facade is core's and the providers are geo's,
   and the mapping between them — a provider `Place` against a `CityRow` — is
   currently the consumer's to write. §8.1 states the choice.
5. **`3pm in tokyo` suggests two identical-looking rows** (§6.3). Cosmetic, both
   readings genuine. Relatedly, `explain()`'s `candidates` field dedupes by
   `(kind, unit)` in pre-existing code, so a three-reading literal reports one
   candidate while its assignments correctly report three.

# smartputs Geocode Design

Free-text place search over sources the library does not own. `paris tx` returns
a ranked list rather than one guess, `48.85, 2.35` returns the place it falls in,
and the gazetteer that answers either is a provider the consumer chose — a
self-hosted Photon, a GeoNames account, a fetched index, or the 6,247 cities this
repo happens to ship.

The geo design this extends is `2026-08-05-smartputs-geo-design.md`. That
document built a kind, a matcher and a provider interface; this one builds the
search path over it. It adds one package, moves seven exports into it, and
settles the ruling §8.1 of that document opened and its M6.4 amendment closed
without answering.

The `place` kind, the matcher, the trie, the weights and the three core changes
are untouched. Nothing in `@smartput/country` becomes async.

## 1. Why this exists

Two complaints, one shape.

**The library stores data that changes.** `packages/city/src/data/cities.ts` is
1.4 MB of committed TypeScript whose contents have a shelf life: populations
move, names change, cities are founded and renamed. A library release is the
wrong unit for a data release. Every refresh is a diff no human reads and a
version bump that says "features" when it means "GeoNames ran their monthly
export".

**`PlaceProvider.lookup(q: string)` is not a search.** It takes a bare string and
returns rows. No proximity, no bounding box, no language, no abort, no score, no
result type. It is an exact-ish resolver that happens to return an array, and
every real geocoding source — Photon, Nominatim, Pelias, the commercial ones —
takes at least four of those parameters and returns ranked candidates. Wiring any
of them behind `lookup` throws away most of what they answer.

The second is why the first is fixable. Once search is a real interface with
providers behind it, the vendored gazetteer stops being a tier the engine assumes
and becomes one source among several — the offline floor, not the truth.

## 2. Scope

**In:** a `@smartput/geocode` package; forward and reverse geocoding; a
`Geocoder` class over N providers with three merge strategies; cross-provider
ranking; per-query caching, in-flight dedup and abort; per-provider rate
limiting; seven shipped providers; the mapping from provider rows back into the
`place` kind.

**Out:** address parsing (that is libpostal, 2 GB of models); routing; map tiles;
any change to the matcher, the trie, the weights or the fold; any new core seam.
This milestone touches `@smartput/core` not at all — §5 uses `createSnapshotCache`
exactly as it already is.

**Explicitly out, and stated so it is not mistaken for an oversight:** street and
house-number geocoding without a network. See §7.

## 3. Package boundaries

New package `@smartput/geocode`, one dependency: `@smartput/core`, for
`createSnapshotCache` and `SmartputError`. It ships no data and takes no edge on
`@smartput/city` — `bundled()` receives rows as an argument, the way
`definePlace()` already receives them, so the tiering rule from geo §3 holds
unchanged: the dependency edge runs from the consumer inwards.

Seven exports **move** out of `@smartput/country`:

| Export | From | To |
| --- | --- | --- |
| `Place`, `PlaceHint`, `PlaceLookup`, `PlaceSnapshot`, `PlaceProvider` | `country/src/provider.ts` | `geocode/src/place.ts` |
| `PlaceProviderError`, `placeSnapshot`, `normalizeName` | `country/src/provider.ts` | `geocode/src/place.ts` |
| `geonames()` | `country/src/providers/geonames.ts` | `geocode/src/providers/geonames.ts` |
| `postalCodes()` | `country/src/providers/postal-codes.ts` | `geocode/src/providers/postal-codes.ts` |

`@smartput/country/providers` becomes a re-export of `@smartput/geocode`, so no
consumer import breaks. It is marked deprecated in its own header and removed at
the next major.

Why move rather than depend upwards: `@smartput/country` is the biggest package
in the repo and already owns a kind, a matcher, a completer, a formatter, a
postal-format table and T0. Geocoding is network, cache, rate limits and ranking
— a second responsibility with a different failure model, and the one part of the
geo surface that must never be linked by a consumer who only wanted `place`.
Keeping it in `country` would mean a bundle that imports a country name also
imports a fetch path it never calls.

The rejected alternative was `@smartput/geocode` plus `@smartput/geocode-osm`, so
a GeoNames-only consumer never links the Photon and Nominatim adapters. Refused
for now: each adapter is under 150 lines with no dependency, subpath exports
already give the same tree-shaking (`@smartput/geocode/providers/photon`), and
two packages is two release cadences to keep in step for maybe 4 KB.

## 4. The search interface

### 4.1 A query is a record, not a string

```ts
type GeocodeKind = "country" | "admin" | "city" | "postal" | "address" | "poi";

interface GeocodeQuery {
  readonly text: string;
  /** Proximity bias. Not a filter — a near miss still ranks, lower. */
  readonly near?: { readonly lat: number; readonly lon: number };
  /** [west, south, east, north]. A filter: outside is dropped. */
  readonly bbox?: readonly [number, number, number, number];
  /** ISO 3166-1 alpha-2, any case. A filter. */
  readonly countries?: readonly string[];
  /** A filter. Absent means every kind the provider can answer. */
  readonly kinds?: readonly GeocodeKind[];
  /** BCP 47. Providers that carry one name per language use it. */
  readonly lang?: string;
  readonly limit?: number;
  readonly signal?: AbortSignal;
  /** The Enter-key query rather than the typing. See §5.3. */
  readonly committed?: boolean;
}
```

`limit` overrides the `Geocoder`'s own default per query; absent, the
constructor's value stands.

`near` biases and `bbox` filters, and the asymmetry is deliberate. Proximity is
how a launcher says "I am in Berlin, prefer things near me" — turning it into a
filter would make a user in Berlin unable to find Tokyo. A bounding box is how a
caller says "this widget covers Bavaria", which is a claim about what results are
*admissible*, not about what is likely.

Every field but `text` is optional, and `geocoder.search("berlin")` is accepted
as sugar for `{ text: "berlin" }`.

### 4.2 A hit carries its score and its source

```ts
interface GeocodeHit {
  readonly place: Place;      // unchanged: still extends core's PlaceMeta
  readonly kind: GeocodeKind;
  readonly score: number;     // 0..1, comparable across providers (§6)
  readonly matched: string;   // the name or alias that hit
  readonly source: string;    // provider id
}
```

`place` stays exactly the `Place` geo §8 shipped — extending `PlaceMeta` so a row
drops into a Value's meta with no adapter, `admin1` and `postal` as `""` rather
than optional, nothing faked. A hit *wraps* a place rather than widening it,
because `score`, `matched` and `source` are facts about a search and not about a
place, and putting them on `Place` would carry them into every Value's meta where
they mean nothing.

`matched` exists for the UI: a search for "muenchen" that returns München should
be able to show the user which of its names it hit. `source` exists for
attribution (§8) and for debugging a merge.

### 4.3 A provider declares whether it may be typed at

```ts
interface GeocodeProvider {
  readonly id: string;
  readonly attribution: string;
  /** May this provider be called on every keystroke? */
  readonly interactive: boolean;
  search(q: GeocodeQuery): Promise<GeocodeHit[]>;
  reverse?(lat: number, lon: number, q?: GeocodeQuery): Promise<GeocodeHit[]>;
}
```

`interactive` is the non-obvious field and it is not a performance hint. The
OSMF Nominatim usage policy states that autocomplete is not supported and *must
not* be implemented client-side against the public instance, alongside a hard
ceiling of one request per second. That is a licence condition, and a library
that ships a Nominatim adapter with no way to express it is a library that helps
its consumers get banned.

So the constraint is typed. `nominatim()` returns `interactive: false`, and
`Geocoder.search` skips non-interactive providers unless the query is committed
(§5.3). The rejected alternative was a README paragraph, which is what every
other geocoding wrapper does and what every consumer skips.

`reverse` is optional because two shipped providers genuinely cannot do it:
`postalCodes()` indexes codes and `geonames()`'s free tier charges separately for
`findNearby`. A `Geocoder` with no reversing provider throws `GeocodeError` on
`reverse()` rather than returning `[]` — an empty array would read as "nowhere is
there", which is never true of a coordinate on land.

## 5. The `Geocoder` class

```ts
const geo = new Geocoder({
  providers: [bundled(CITIES, ADMIN1), photon({ url: MY_PHOTON })],
  strategy: "fallback",
  ttlMs: 86_400_000,
  limit: 10,
});

await geo.search("paris tx");     // GeocodeHit[]
await geo.reverse(48.85, 2.35);   // GeocodeHit[]
await geo.resolve("berlin");      // Place | null — the one-answer form
geo.sync.find("berlin");          // PlaceLookup over what is already loaded
await geo.refresh();
geo.attribution;                  // readonly string[]
```

A class and not a factory function, matching how the rest of this codebase hands
back stateful things (`PostalFormats`, `PlaceCompleter`, `PlaceDistance`): the
object owns a cache, a limiter and a load, and those want a `this`. The
functions underneath — `rank`, `dedupe`, `mergeHits`, `normalizeQuery` — are
plain, exported, and tested without constructing anything.

### 5.1 Three strategies

- **`fallback`** (default) — providers in declared order, first non-empty result
  wins. Cheapest source first, network last. This is the launcher's strategy: a
  hit in the bundled table costs nothing and ends the query.
- **`merge`** — every eligible provider in parallel, results deduped and ranked
  together (§6). For "best answer" over "cheapest answer".
- **`race`** — first non-empty response wins, others aborted. For a consumer with
  two equivalent mirrors and a latency budget.

Under `fallback` and `race`, a provider that *rejects* does not end the query: the
error is recorded on the result and the next provider is tried. A provider that
resolves empty is an answer under `merge` and a miss under the other two. This
mirrors the split geo §8 already made between GeoNames (empty is an answer) and
ECB (empty means the format moved) — a search that finds nothing must be able to
say so, but one dead mirror must not take the query with it.

If every provider rejects, `search` rejects with a `GeocodeError` naming each
failure. Silence would be indistinguishable from "no such place".

### 5.2 `sync` and `resolve`

`geo.sync` is a `PlaceLookup` over whatever a local provider has already loaded —
`bundled()` always, `dataset()` after its first load. It returns `null` rather
than throwing when nothing is loaded, unlike rates' `sync` getter, which throws
`RatesNotReadyError`. The difference is what the caller can do about it: a rate
engine with no rates cannot evaluate anything, while a place lookup with no
snapshot has simply not got that place, which is a `null` the caller already
handles.

`resolve(text)` is `search` narrowed to one answer: the top hit's `Place`, or
`null`. It exists because the kind bridge (§9) wants one place and would otherwise
write `(await geo.search(t))[0]?.place ?? null` at every call site.

### 5.3 The keystroke path

A launcher calls `search` on every keystroke. Four mechanisms make that safe, and
none of them is new invention — three are already in this repo:

1. **Per-query cache.** An LRU keyed on the normalized text plus the filter
   fields (`countries`, `kinds`, rounded `near`, `bbox`, `lang`). Default 200
   entries, `ttlMs` for freshness.
2. **In-flight dedup.** A second call on a key already loading joins the first
   promise, and the slot is cleared in a `finally` so a rejection reaches every
   waiter and the next call retries. Verbatim the rule in
   `createSnapshotCache` — because for whole-index providers it *is*
   `createSnapshotCache`, which finally gives geo §8.1's lift the second consumer
   it has been waiting two milestones for.
3. **Abort.** The query's `signal` is threaded to `fetch`. Superseded queries are
   also dropped by sequence number, so a slow response for "ber" cannot land after
   a fast one for "berlin".
4. **Rate limiting.** A token bucket per provider. `nominatim()` is constructed
   with one request per second and it is **not** an option — the policy is not the
   consumer's to relax on a shared donated server. Other providers default to
   unlimited, because their budget genuinely is the consumer's to spend, exactly
   as geo §8 rules for `geonames()`.

A query is **committed** when the caller passes `{ committed: true }` — the
Enter-key query, not the typing. Non-interactive providers run only then. A
`Geocoder` whose providers are all non-interactive answers uncommitted queries
from cache and the local snapshot, and returns what it has.

## 6. Ranking

Provider scores are not comparable. Photon returns an OpenSearch relevance
number, GeoNames returns rows in its own order with no score at all, and
`bundled()` has population and nothing else. Under `merge` these have to be one
list, so `Geocoder` recomputes rather than trusting:

```
score = w_name · similarity(text, matched)
      + w_pop  · normalize(log10(population + 1))
      + w_prox · proximity(near, place)
      + w_source · sourceWeight
```

with `w_name` dominant. `similarity` is prefix-and-token overlap over
`normalizeName`'d strings — deliberately the same normalization the matcher's trie
assumes, so a name means one thing in both places, and deliberately **not**
diacritic-stripping, for the reason geo §8 gives for `normalizeName`.

`sourceWeight` is the provider's index in the declared list, decaying. It is what
lets a consumer say "prefer my self-hosted Photon, fall back to the bundled
table" under `merge` without writing a comparator.

**Dedupe** by `geonameId` when it is non-zero, else by `name + country` plus
coordinates rounded to three decimals (~110 m). The zero case is inherited: geo
§8 rules that a postal row has no feature id and that hashing the code into a
synthetic one would look stable and collide with a real id. That ruling stands,
and the coordinate fallback is what this design adds to live with it.

**Tie-break** on `(score, population, geonameId)`, in that order, all descending.
Deterministic by construction: the same query against the same snapshot returns
the same order on every run and on every platform. A property test asserts it,
because an unstable order is the kind of bug that only appears in someone else's
UI.

## 7. What "local" actually costs

The question this design started from was whether OpenStreetMap can be geocoded
locally. It can, and not inside a JavaScript library.

| Option | Storage | Runs where | Granularity |
| --- | --- | --- | --- |
| Photon, self-hosted | ~95 GB planet index, 64 GB RAM recommended, weekly rebuild | a server | full, built for type-ahead |
| Nominatim, self-hosted | Postgres + osm2pgsql planet import, ~1 TB | a server | full, no autocomplete |
| Photon / Nominatim, public host | none | someone else's server | full, throttled or forbidden |
| `dataset()` — GeoNames-derived index | a few MB gzipped | the consumer's process | city, admin, postal |
| `bundled()` — this repo's T1 | 234 KB gz | the consumer's bundle | city, admin |

So the honest statement, which this document makes rather than eliding: **city,
admin and postal granularity is available locally; street and house-number
granularity is network-only.** A launcher computing `kyiv to warsaw` or
`3pm in new york` needs the former and never the latter. A consumer who needs to
geocode `221B Baker Street` points a provider at a host, and this library's job
is to make that one constructor argument.

`photon()` and `nominatim()` therefore ship with **no default URL**. Naming a
public host as the default would hardcode a third party's donated bandwidth as
this library's transport — verbatim the rule geo §8 already applies to
`postalCodes()`, and the reason it has no default either. The guide names the
public hosts and quotes their policies; the consumer types the URL and thereby
accepts them.

## 8. Providers

| Constructor | Source | Offline | Interactive | Kinds |
| --- | --- | --- | --- | --- |
| `bundled(cities, admin1, asOf)` | this repo's T1 | yes | yes | city, admin |
| `dataset({ url, ttlMs })` | GeoNames-derived index | after first load | yes | city, admin, postal |
| `photon({ url })` | OSM via Photon | self-host | yes | all |
| `nominatim({ url, userAgent })` | OSM via Nominatim | self-host | **no** | all |
| `geonames({ username })` | GeoNames web service | no | yes | all |
| `postalCodes({ url })` | zauberware mirror | no | yes | postal |
| `custom(fn)` | anything | — | caller declares | — |

`geonames()` and `postalCodes()` move across unchanged in behaviour and gain a
`search(GeocodeQuery)` alongside their existing methods. `geonames()` keeps its
two indexes and the three findings geo §8 recorded — the `secure.geonames.org`
certificate, the HTTP 200 error envelope, `style=FULL` for the timezone — because
all three are still true and none of them is this milestone's to relitigate.

`nominatim()` requires `userAgent` as a constructor argument with no default. The
policy requires a valid identifying User-Agent or Referer, and a library that
defaults it would put every consumer behind one string and get them all blocked
together.

`bundled()` takes an `asOf` and reports it on `PlaceSnapshot`, which is what
demotes T1 from truth to floor: a consumer can read how old their offline data is
and decide whether to add a live provider ahead of it.

### 8.1 The `dataset()` index

`scripts/geo/build.ts` gains a second output: a compact, gzipped index derived
from the same GeoNames dump it already downloads, emitted to `dist/` rather than
committed to `src/`. Format is NDJSON — one row per line, fields positional —
because it streams, diffs, and needs no parser beyond `JSON.parse` per line.

The library does not host it. `dataset({ url })` fetches from wherever the
consumer published it, and the repo publishes one to its own docs site as a
convenience the guide marks explicitly as not an SLA.

The index carries its own `asOf` and a body hash, checked on load — the same
guarantee geo §7.3 gives committed data, moved to a file that travels.

## 9. The bridge back to the kind

Geo §8.1 opened a ruling, M6.3 deferred it, M6.4's amendment records that the
milestone ended without making it: either geo ships a `createLivePlaceEngine` that
owns the mapping from provider rows to kind rows, or it ships the mapping alone.

**Ruling: `@smartput/geocode` owns both, and `@smartput/country` stays sync.**

```ts
import { definePlace } from "@smartput/country";
import { toCityRows } from "@smartput/geocode";

const kind = definePlace({ cities: toCityRows(await geo.search("...")), admin1: ADMIN1 });
```

`toCityRows(hits)` maps `Place` to `CityRow`, dropping the fields a kind has no
column for and refusing rows with no `geonameId` — a postal row is not a city and
must not enter a gazetteer as one.

Three things this rules out, each on purpose. `definePlace()` does not become
async: the kind is built once, and a build that awaits is a build that can fail
at import. `@smartput/core` gains nothing: it keeps the generic cache and takes
on no I/O, as geo §8.1 requires. And `@smartput/country` gains no edge on
`@smartput/geocode`: the arrow runs the other way, so a consumer of `place` links
no fetch.

## 10. Errors

One new class, `GeocodeError extends SmartputError`, for failures that belong to
the *search* rather than to a provider: every provider rejected, `reverse` with no
reversing provider, a malformed `bbox`. `PlaceProviderError` is unchanged and
still what a provider throws; a `GeocodeError` from an all-rejected search carries
each of them in a `causes` array.

Both extend `SmartputError` for the reason geo §8 gives: `instanceof
SmartputError` is what this codebase branches on, and an error outside it is
invisible to every consumer following the convention. Neither is added to
`core/errors.ts` — core hosts the errors its own evaluate path can throw, and no
search error ever crosses it.

An aborted search **rejects with the signal's reason**, unwrapped, rather than
resolving empty or wrapping in `GeocodeError`. `AbortError` is what every caller's
`catch` already tests for, and dressing it up breaks that.

## 11. Testing

Follows the conventions already in the repo — fixtures, no network, injected
clocks:

- **Per-provider fixture tests.** A checked-in response per provider, parsed by
  the adapter. If an upstream shape moves it fails here, which is the same
  guarantee `geonames.test.ts` and the ECB regex fixture give today.
- **Ranking properties.** Determinism (same input, same order, run twice);
  dedupe idempotence (`dedupe(dedupe(x)) === dedupe(x)`); `limit` respected;
  a `bbox` never admits a point outside it; `near` never *removes* a result.
- **Strategy tests** with stub providers: `fallback` stops at the first
  non-empty; a rejecting provider does not end the query; all-rejecting produces
  one `GeocodeError` carrying every cause.
- **Cache and limiter** with an injected `now`: a burst of ten keystrokes on a
  cold key makes one request; a rejection clears the slot and the next call
  retries; the Nominatim bucket admits exactly one request per second.
- **Abort:** a superseded query's response never reaches the caller and leaves no
  cache entry.
- **Agreement test** between `bundled()` and `definePlace()` — the same city name
  must resolve to the same `geonameId` through both paths, or the offline floor
  and the kind disagree about what a place is.

## 12. Milestones

**M7.1 — the shape, no network.** Package, `GeocodeQuery`/`GeocodeHit`/
`GeocodeProvider`, `Geocoder` with all three strategies, `bundled()`,
`custom()`, ranking, dedupe, cache, abort. Every test runs against stubs.

**M7.2 — the network providers.** Move `geonames()` and `postalCodes()` in with
the compat re-export from `@smartput/country/providers`; add `photon()`,
`nominatim()` and the token bucket; fixtures for each.

**M7.3 — `dataset()`.** Index format, generator output, load-and-index, body-hash
check, `sync` over a loaded dataset.

**M7.4 — the bridge and the docs.** `toCityRows`, the guide page, the `asOf`
demotion of T1 recorded in the geo spec, `GEONAMES_ATTRIBUTION` joined by the
per-provider `attribution` strings.

## 13. Standing targets

Unchanged from the geo design and restated because this package is the one most
able to break them:

- **Keystroke-fast.** The sync path — `geo.sync.find` and a cache hit — does no
  I/O and no allocation beyond the result. Network is opt-in, per provider, and
  never on the path a launcher types through unless the consumer put it there.
- **No data the library owns.** After M7.3 the only committed place data is T0
  (countries: ~250 rows, decade-scale churn, and the floor that makes the package
  work with no network at all) and T1 behind `bundled()` with an `asOf` that says
  how stale it is.
- **No third party is a default.** Every network provider takes its URL or its
  credential from the consumer.
- **Attribution travels.** Every provider carries its `attribution` string and
  `Geocoder.attribution` is the union of those that contributed to the current
  results. OSM is ODbL and GeoNames is CC BY 4.0; both require it, and a consumer
  cannot comply with a string they cannot reach.

## Sources

- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) —
  1 req/s, identifying User-Agent required, client-side autocomplete forbidden.
- [Photon README](https://github.com/komoot/photon/blob/master/README.md) and
  [Photon API](https://photon.komoot.io/) — public instance is reasonable-use
  only and throttles or bans extensive use; self-hosted planet index ~95 GB,
  64 GB RAM recommended, rebuilt weekly.

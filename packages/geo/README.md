# @smartput/geo

Free-text place search over the GeoNames web service, and over anything else you
plug in beside it.

Countries, states, regions, cities, postal codes, rivers, mountains, parks — every
feature class GeoNames holds, answered by a network gazetteer rather than by a
table committed into this repository.

```ts
import { Geo } from "@smartput/geo";
import { geonames } from "@smartput/geo/providers";

const geo = new Geo({ providers: [geonames({ username: "your-account" })] });

await geo.search("paris tx");                           // ranked hits
await geo.search({ text: "dnipro", kinds: ["water"] }); // the river, not the city
await geo.search({ text: "київ", lang: "uk" });         // names in any language
await geo.reverse({ lat: 48.85, lon: 2.35 });           // what is here
await geo.resolve("berlin");                            // one Place, or null
geo.sync.find("berlin");                                // no I/O; what is loaded
geo.attribution;                                        // the credit lines to show
```

## Why it is not a table

A library release is the wrong unit for a data release. Populations move, names
change, cities are founded and renamed, and borders are redrawn — so a committed
gazetteer is a megabyte of generated TypeScript whose refresh is a diff no human
reads and a version bump that says "features" when it means "GeoNames ran their
monthly export". Add a translation of it per language and the maintenance is the
whole job.

GeoNames already holds every toponym's names in some 250 languages. `lang` is
therefore the whole of the internationalization story here: nothing is vendored,
nothing is reviewed, and nothing has to be kept in step.

## The kinds

`GeoKind` is the vocabulary; GeoNames' nine feature classes and ~660 feature
codes stay inside the package.

| Kind | What it is | GeoNames |
| --- | --- | --- |
| `country` | A sovereign state or dependent territory | class `A`, codes `PCL*`, `TERR` |
| `admin` | A state, oblast, prefecture, county | class `A`, codes `ADM*` |
| `city` | A city, town, village, hamlet | class `P` |
| `postal` | A postal code | a separate index |
| `water` | Rivers, streams, lakes, seas, glaciers | class `H` |
| `terrain` | Mountains, hills, capes, islands, valleys | class `T` |
| `area` | Parks, reserves, regions, zones | class `L` |
| `road` | Roads, railroads, tunnels, bridges | class `R` |
| `spot` | Buildings, farms, airports, mines | class `S` |
| `undersea` | Seamounts, trenches, ridges | class `U` |
| `vegetation` | Forests, heaths, groves, vineyards | class `V` |

## The GeoNames client, whole

`geonames()` is a `GeoProvider`, and also the full web service. Fourteen methods
over eleven endpoints, because GeoNames is not one index and pretending otherwise
decides wrongly and silently — a postal code is not a toponym, and the states of a
country are not a phrase anybody named a place.

```ts
const gn = geonames({ username: "your-account" });

await gn.search({ text: "dnipro", kinds: ["water"], countries: ["ua"] });
await gn.reverse({ lat: 50.45, lon: 30.52 });
await gn.get(703448);                       // one feature by id
await gn.children(690791);                  // the oblasts of Ukraine
await gn.hierarchy(703448);                 // Earth → Europe → Ukraine → Kyiv
await gn.siblings(689558);
await gn.neighbours(690791);                // the countries sharing a border
await gn.countries({ lang: "uk" });         // every country, in one request
await gn.countryAt({ lat: 50.45, lon: 30.52 });
await gn.subdivision({ lat: 50.45, lon: 30.52 });
await gn.postal("44657", "us");
await gn.postalNear({ lat: 50.45, lon: 30.52 }, 10);
await gn.timezone({ lat: 50.45, lon: 30.52 });
await gn.ocean({ lat: 0, lon: -30 });
```

A free GeoNames account is a username, not a key — and a fresh account must be
enabled for the free web service by hand before it answers anything. Until then
every call returns HTTP 200 carrying an error envelope, which this client reads
as an error rather than as no results.

## Adding a provider

Four fields. `bundled()`, `custom()`, `postalCodes()` and `geonames()` are all
just this.

```ts
import { custom } from "@smartput/geo/providers";

const mine = custom(
  async (q) => myIndex.search(q.text).map((row) => ({
    place: row,            // anything satisfying `Place`
    kind: "city",
    score: 0,              // `rank` recomputes it — see below
    matched: row.name,
    source: "mine",
  })),
  { id: "mine", attribution: "© my data" },
);

const geo = new Geo({ providers: [mine, geonames({ username })], strategy: "merge" });
```

Provider scores are never trusted. Photon returns an OpenSearch relevance number,
GeoNames returns a Lucene score on some endpoints and none on others, and a local
table has population and nothing else — so under a merge these cannot be one list
until they are recomputed:

```
score = 0.60 · similarity(text, matched)
      + 0.20 · log-compressed population
      + 0.15 · proximity to `near`
      + 0.05 · the provider's place in your declared order
```

That last term is how you say "prefer my self-hosted index, fall back to
GeoNames" without writing a comparator.

## Strategies

- **`fallback`** (default) — declared order, first non-empty result wins. Cheapest
  source first, network last.
- **`merge`** — everyone in parallel, deduped and ranked together.
- **`race`** — first non-empty response wins.

Under every strategy, a provider that *rejects* does not end the query; only an
all-rejected query throws, and the `GeoError` it throws names each failure. A
provider that resolves empty is a miss under `fallback` and `race`, and an answer
under `merge`.

## Typing at it

`search` is safe to call on every keystroke:

- a per-query LRU keyed on the text and the filters, with an optional TTL;
- in-flight dedup — ten identical keystrokes on a cold key make one request;
- `signal` threaded through to `fetch`, and rethrown unwrapped so your existing
  `AbortError` handling still works;
- a token bucket per provider, unlimited by default.

`interactive: false` marks a provider that may **not** be typed at — the OSMF
Nominatim policy forbids client-side autocomplete outright, and that is a licence
condition rather than a performance hint. Such providers run only when you pass
`{ committed: true }`, the Enter-key query.

## Attribution

GeoNames is CC BY 4.0 and the credit has to travel with the data. Every provider
carries an `attribution` string and `geo.attribution` is the union of them, so a
consumer embedding results in a UI has the exact text to hand.

## Licence

The code is this repository's. The data is each provider's, under each provider's
licence.

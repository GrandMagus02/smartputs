# @smartput/distance

The place kind's one operation: `kyiv to warsaw` is a length, measured along the
great circle between the two.

```ts
import { PlaceDistance } from "@smartput/distance";

defineKind({ /* … */ ops: [new PlaceDistance(COUNTRIES).op] });
```

A class over a bare `OpSignature` because the fallback table is the part that
varies: a build handed a different gazetteer measures from different capitals,
and the op has to close over the one its kind registered. `.op` is what
`defineKind` takes; `between(l, r)` is the same measurement asked of two Values
directly, and `metresBetween(a, b)` is the arithmetic with no Value involved.

**No data.** `@smartput/country` names this package, so it cannot name that one
back — which is also the honest shape of the dependency, since the op wants a
position per unit and nothing else a country row carries.

## What it refuses

A sphere of radius 6,371,008.8 m, not the WGS84 ellipsoid: the two disagree by
under 0.5%, and each endpoint is a capital standing in for a whole country. That
reading is recorded on the signature as a `great-circle` assumption, because
driving distance is what a person often means and no free dataset carries it.

A postal code borrows its country's coordinates until a provider positions it,
and measuring from that borrowed point answered "0 kilometres" for every pair of
codes in one country — `SW1A 1AA to EH1 1YZ`, London to Edinburgh, measured
zero. So it throws `UnpositionedPlaceError` instead, naming the provider path.
A wrong answer delivered confidently is worse than an error that names the
remedy.

Full documentation: [Places and distances](https://smartputs.dev/guide/places).

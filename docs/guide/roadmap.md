---
title: Roadmap
description: What ships today, what is planned, and what is deliberately out of scope.
---

# Roadmap

Each milestone is independently shippable and gets its own implementation plan.

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1** | Contracts, registry, lexer, Pratt parser, solver, layered weights, softmax confidence, `explain()`. Kinds: `number`, `length`, `mass`, `duration`. Locale: `en`. | **Shipped** |
| **M2** | Temperature (affine), measure (dpi via `Value.meta`), angle, datasize, percent, speed/area/volume as explicit op signatures. Facade class generator. | **Shipped** |
| **M2.5** | `Engine.complete()`, prefix completion, `typical` bands, `display` on every unit, consistent word-form output. | **Shipped** |
| **M3** | Money kind, `@smartput/rates`, ECB provider, `createLiveEngine`. | **Shipped** |
| **Word math** | `NumeralParser`, `cardinalNumerals`, numeral folding, word operators — `"twenty two kg"`, `"ten km plus five km"`. | **Shipped** |
| **M4** | `@smartput/datetime`: datetime kind, chrono bridge, Temporal ops, timezones. Core's literal-matcher seam and opaque-kind units. | **Shipped** |
| **M5** | `@smartput/color`, the Ukrainian locale across every package, `defineLocalePack`, analyzer helpers, `assertLocaleContract`. | Planned |
| **M6** | `@smartput/geo`: place kind, countries and cities, `kyiv to warsaw` as a distance, postal codes, the datetime and rates bridges, GeoNames providers, place completion. | **Shipped** |
| **M7** | `@smartput/http`, meta-package, npm release. | Planned |

M1 carried the only real invention risk. Most of what came after it is
descriptor tables — M3 added a kind whose unit ratios come from an injected
table without touching the solver at all, which is the point of the design. The
exception is recognition: every plugin that had to claim text the lexer does not
shape (`3pm`, `kyiv to warsaw`, `SW1A 1AA`) has taken a change out of core, and
M6 took three. The solver has never moved.

Word math has shipped in full: `NumeralParser`, `cardinalNumerals`, and
`Locale.numerals` are [documented](/api/define-locale#numerals), and the two
token passes that fold spelled numerals and word operators into ordinary
number/op tokens run on every `evaluate()` call — see
[Stage 2b — Fold](/guide/pipeline). `"twenty two kg"` and `"ten km plus five
km"` evaluate the same as their digit-and-symbol equivalents.

M4 shipped `@smartput/datetime` — see [Dates and time zones](/guide/datetime).
It cost core one new capability and no date-specific code: a kind may now supply
[literal matchers](/api/define-kind#literals), which claim a run of the source
string and return a finished `Value`, and an opaque kind's `units` are indexed,
weighted and usable as `in` targets like any other kind's. `today + 3 d` and
`3pm in tokyo` fall out of those two additions plus four op signatures declared
in the plugin.

M6 shipped `@smartput/geo` in four parts — see
[Places and distances](/guide/places). Core knows no geography: a place is an
opaque kind whose units are country codes, the distance is one
`in | place | place` signature, and the datetime and rates bridges are one op
signature each in *those* packages, reading a string off core's `PlaceMeta`.
Nobody imports anybody, and `check-deps` enforces it.

**Geo was not free for core, though, and the design document that said it would
be was wrong three times over.** Core took three changes across the milestone,
each forced by the same shape — a seam built to produce one answer per offset,
meeting a package whose answers arrive in groups:

- **M6.1: a claimed conversion target reaches `apply`.** `15:00 in japan` needs
  the claimed *value* on the right of `in`, because the zone lives in its `meta`,
  and the parser had been discarding it for a stand-in built from the unit name.
  Gated on an opt-in `LiteralMatch.targetable`, because accepting every literal
  made `today in tomorrow` a zone conversion where it had always thrown.
- **M6.3: the literal fold stopped being destructive.** A
  [`LiteralMatcher`](/api/types#returning-more-than-one-reading) may return
  several readings of one span, and the fold keeps every match reaching the
  furthest end instead of choosing one. The lexer, the AST, the Pratt parser and
  the evaluator changed with it. `suggest("springfield")` returning all three is
  that change; so is `tokyo` being a city and a time zone in one engine, which
  was datetime's half of the same defect.
- **M6.4: a kind may complete itself.**
  [`Kind.completions`](/api/define-kind#completions) is called once per keystroke
  for a vocabulary the global alias index cannot hold — six thousand city names,
  or any name short enough that `km` becomes Comoros. Opaque kinds could not be
  completed at all before it.

Two of the three are seams any plugin can use; the third is a gate on the parser.
The lifted [snapshot cache](/api/types#snapshot-cache) came with them — rates'
`createLiveEngine` was generalized into `createSnapshotCache` /
`createCachedEngine` so that geo's providers could share it, which geo then did
not do, so that generalization is still waiting for its second consumer.

What fell out for free: `nice`, `mobile` and `split` became places without
costing any input its reading, `90210` stayed 90,210 with a postcode ranked
underneath it, and the eighteen hand-written zones in `@smartput/datetime`
stopped being the only places the engine knows.

## Packages

Shipped:

```
@smartput/core        registry, lexer, parser, solver, evaluator, ratio kinds
@smartput/rates       money kind, RateSnapshot, ECB provider, async facade
@smartput/datetime    datetime kind, chrono bridge, Temporal ops, time zones
@smartput/geo         place kind: countries, cities, postal codes, distance,
                      zone and currency lookup, GeoNames providers
```

Planned:

```
@smartput/color       @urcolor adapter → color kind
@smartput/http        Hono on Bun, REST + OpenAPI
smartputs             meta: core + datetime + rates, en preloaded
```

Every package that defines a kind ships that kind's translations beside it under
`./locale/<id>`, so vocabulary cannot drift from the kind it describes.

| Package | Runtime dependencies |
| --- | --- |
| `core` | `decimal.js` — and nothing else |
| `*/locale/*` | none — descriptors only |
| `datetime` | `temporal-polyfill`, `chrono-node`, `@smartput/core`, `decimal.js` |
| `rates` | `decimal.js`, `@smartput/core`; provider adapters use `fetch` only |
| `color` | `@urcolor/core`, `@urcolor/i18n` (peer) |
| `geo` | `decimal.js`, `@smartput/core` — GeoNames data is vendored as generated TypeScript, not an npm package |
| `http` | `hono` (peer), `@smartput/core` |

`bun run check-deps` enforces this table rather than trusting it: a package
whose `dependencies` gain an entry the map does not list fails CI, and so does a
new package the map does not mention at all.

`temporal-polyfill` and `chrono-node` together are several times the size of the
engine, so datetime moved out rather than taxing every consumer. That split was
only possible because datetime is an ordinary plugin — which is the strongest
available evidence that the extension seam is real, and M4 is where it was
tested.

## Deliberately rejected

Stated so they do not creep back in.

| Rejected | Instead | Why |
| --- | --- | --- |
| Dimensional-vector algebra | Explicit `OpSignature` per derived quantity | Would be the second-largest subsystem, for quantities nobody types into a launcher. |
| Per-kind `context` declarations | `Value.meta` | A generic framework built for one consumer (dpi). |
| Weight transform callbacks and selector precedence | Plain numbers that add | Predictable under four-layer composition. |
| Custom `tiebreak` callback | `"error" \| "first"` | Weights already express every preference a callback could. |
| `Kind.facade` class override | Generated facade only | The generated surface *is* the contract. |
| `engine.with(patch)` | Call `createEngine` again | Composing frozen descriptors is already cheap. |
| A bundled FST morphology engine | `suffixStripper` / `tableAnalyzer`, and `Analyzer` being a plain function | Full morphology is a research project per language. Anything harder calls a real analyzer through the same one-line interface. |
| Hand-written plural rules | `Intl.PluralRules` | Native, complete for every CLDR locale, zero shipped data. |
| Yahoo Finance as the FX source | ECB daily reference rates, CoinGecko for crypto | No official public API; the endpoints are undocumented, cookie-gated, and redistribution breaches their terms. |

## Out of scope for v1

Variables and assignment (`x = 5kg`), multi-line notepad mode, spreadsheet
references, natural-language sentences (`"how many km in a marathon"`), LLM
fallback, historical FX by date, plural or gender agreement in output
formatting beyond what `Intl` provides, spelled decimals (`three point five`),
fractions (`half a kg`), and ordinals.

## Two standing targets

- **`@smartput/core` ships one runtime dependency.** CI fails on a second. Still
  true after M6: the lifted snapshot cache is code, not a dependency, and geo's
  GeoNames data is vendored as generated TypeScript inside geo.
- **A new ratio kind is five lines**, and needs no knowledge of the solver. Still
  true after M6, and worth stating precisely, because M6 was not free for core
  (above): geo added no solver knowledge, no new `OpSymbol` and no lexer or
  parser *stage*. What it added was one gated branch inside the existing `in`
  parse, a widened `LiteralMatcher` return type, and one optional field on
  `Kind`. A kind that wants none of the three is unaffected by all three — every
  one of them is opt-in, and `datasize` is still five lines.

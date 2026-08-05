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
| **M4.5** | `@smartput/validate`: an engine-free parser, operation algebra and value-class factory. Every ratio kind gains `./units`, `./validate`, `./class` subpaths, plus `@smartput/kinds/validate` and `/class` barrels. Per-entry byte budgets enforced in CI. | **Shipped** |
| **M5** | `@smartput/color`, the Ukrainian locale across every package, `defineLocalePack`, analyzer helpers, `assertLocaleContract`. | Planned |
| **M6** | `@smartput/http`, meta-package, npm release. | Planned |

M1 carried the only real invention risk. Everything after it is largely
descriptor tables — M3 added a kind whose unit ratios come from an injected
table without touching the solver at all, which is the point of the design.

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

M4.5 shipped a second entry point into every ratio kind — see
[Validating without the engine](/guide/validating). It cost every kind package
a build step and three subpath exports, and cost `@smartput/core` nothing:
`@smartput/validate` never imports it, the dependency runs the other way. The
byte figures that justify the split are measured, not estimated —
`scripts/check-size.ts` builds each entry with `bun build --minify` and fails
`bun run check` on regression, the same enforcement `check-deps.ts` already
applied to the dependency table below.

## Packages

Shipped:

```
@smartput/core         registry, lexer, parser, solver, evaluator, ratio kinds
@smartput/validate     engine-free parser, operation algebra, value-class factory
@smartput/rates        money kind, RateSnapshot, ECB provider, async facade
@smartput/datetime     datetime kind, chrono bridge, Temporal ops, time zones
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
| `validate` | none — the standing target for this package, same as `core`'s one dependency |
| any ratio kind (`angle`, `length`, …) | `@smartput/core`, `@smartput/validate` |
| `*/locale/*` | none — descriptors only |
| `datetime` | `temporal-polyfill`, `chrono-node`, `@smartput/core`, `decimal.js` |
| `rates` | `decimal.js`, `@smartput/core`; provider adapters use `fetch` only |
| `color` | `@urcolor/core`, `@urcolor/i18n` (peer) |
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

## Three standing targets

- **`@smartput/core` ships one runtime dependency.** CI fails on a second.
- **`@smartput/validate` ships zero.** Not even `@smartput/core` — the
  dependency, and `decimal.js`'s ~30 KB, run the other way.
- **A new ratio kind is five lines**, and needs no knowledge of the solver.

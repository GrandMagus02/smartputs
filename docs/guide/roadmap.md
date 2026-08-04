---
title: Roadmap
description: What ships today, what is planned, and what is deliberately out of scope.
---

# Roadmap

Each milestone is independently shippable and gets its own implementation plan.

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1** | Contracts, registry, lexer, Pratt parser, solver, layered weights, softmax confidence, `explain()`. Kinds: `number`, `length`, `mass`, `duration`. Locale: `en`. | **Shipped** |
| **M2** | Temperature (affine), Measure (dpi via `Value.meta`), angle, datasize, speed/area/volume as explicit op signatures. Facade class generator. | Planned |
| **M3** | Money kind, `@smartput/rates`, ECB provider, `createLiveEngine`. | Planned |
| **M4** | `@smartput/datetime`: datetime kind, chrono bridge, Temporal ops, timezones. | Planned |
| **M5** | `@smartput/color`, the Ukrainian locale across every package, `defineLocalePack`, analyzer helpers, `assertLocaleContract`. | Planned |
| **M6** | `@smartput/http`, meta-package, npm release. | Planned |

M1 carries the only real invention risk. M2–M5 are largely descriptor tables
once M1 holds, which is the point of the design.

## Planned packages

```
@smartput/core        registry, lexer, parser, solver, evaluator, ratio kinds
@smartput/datetime    datetime kind, chrono bridge
@smartput/rates       money kind, RateSnapshot, providers, async facade
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
| `datetime` | `temporal-polyfill`, `chrono-node` |
| `rates` | none in the interface; provider adapters use `fetch` only |
| `color` | `@urcolor/core`, `@urcolor/i18n` (peer) |
| `http` | `hono` (peer), `@smartput/core` |

`temporal-polyfill` and `chrono-node` together are several times the size of the
engine, so datetime moves out rather than taxing every consumer. That split is
only possible because datetime is an ordinary plugin — which is the strongest
available evidence that the extension seam is real.

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
fallback, historical FX by date, and plural or gender agreement in output
formatting beyond what `Intl` provides.

## Two standing targets

- **`@smartput/core` ships one runtime dependency.** CI fails on a second.
- **A new ratio kind is five lines**, and needs no knowledge of the solver.

---
title: createEngine
description: Compose locales, kinds and packs into an immutable Engine.
---

# createEngine

```ts
function createEngine(opts: EngineOptions): Engine
```

Composes frozen descriptors into an engine. There is no mutable global
registry: engines with different locales, kinds or weights coexist in one
process, and every registration error is raised here rather than lazily at parse
time.

```ts
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
```

## EngineOptions

```ts
interface EngineOptions {
  locales: Locale[];         // required; first is primary, rest are fallbacks
  kinds?: Kind[];
  packs?: LocalePack[];
  weights?: Weights;
  tiebreak?: "error" | "first";
  ambiguityEpsilon?: number;
  maxCandidates?: number;
  kindMeta?: Readonly<Record<KindId, Readonly<Record<string, unknown>>>>;
  formatPrecision?: number;
  rates?: RateLookup;
  rounding?: Decimal.Rounding;
  now?: () => number;
  timeZone?: string;
}
```

### locales

Required, and must be non-empty — an empty array throws. The first entry is the
primary locale; the rest are fallbacks. When two locales disagree about number
grammar (`1,500` is 1500 in `en` and 1.5 in `de`) both candidates are emitted and
the primary locale scores higher.

### kinds

Appended to the engine's vocabulary. **Nothing is registered implicitly** — pass
`BUILTIN_KINDS` from [`@smartput/kinds`](/guide/kinds), or the subset you want,
or the engine has no units at all and every word raises `NoCandidateError`.

```ts
createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, measure, myTicker] });
```

Two shipped kinds are not in `BUILTIN_KINDS` and must be named: `measure`, also
from `@smartput/kinds`, whose `mm`/`cm` aliases collide with `length`, and
`money` from [`@smartput/rates`](/api/rates), which needs a `rates` table to
convert at all.

Two kinds claiming the same id, or the same op signature, raise
`KindConflictError` naming both sources. Registration order is irrelevant.

### packs

Vocabulary contributions from `defineLocalePack`. A pack naming an unregistered
kind raises `UnknownKindError` here — never a silent no-op.

### weights

Layer 3 of the [weight stack](/guide/weights). Selectors are `token:<form>`,
`<kind>:<unit>` or `<kind>`, and every matching selector adds.

```ts
createEngine({
  locales: [uk, en],
  kinds: [...BUILTIN_KINDS, myTicker],
  weights: {
    "mycompany-ticker": 40, // custom kind outranks built-ins
    "duration:min": -15, // "m" never means minutes here
    "token:т": 100, // in this domain "т" is always tonnes
  },
});
```

### tiebreak

Default `"error"`.

| Value | Behaviour on an exact score tie |
| --- | --- |
| `"error"` | `AmbiguityError`, listing the candidates |
| `"first"` | registration order, then kind id lexicographic |

Never random and never map iteration order — identical input and options always
produce identical ranking.

### ambiguityEpsilon

Default `0.05`. `evaluate()` throws when the top two **confidences** are within
this margin. Because confidence is a softmax over raw scores, the epsilon keeps
its meaning no matter how large the weights get.

### maxCandidates

Default `10_000`. Guards the exhaustive search over consistent assignments.
Exceeding it raises `TooAmbiguousError` with the count.

### kindMeta

Default `Value.meta` per kind, attached to every quantity of that kind. One
consumer today: `measure` reads `{ dpi }` from it.

```ts
createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, measure],
  kindMeta: { measure: { dpi: 96 } },
});
```

### formatPrecision

Default `26` (`DISPLAY_PRECISION`) — two guard digits below the 28 `Decimal`
computes at, which is what stops a round trip through a non-terminating ratio
from surfacing as trailing noise.

### rates

An FX table for kinds whose unit ratios are not constants.
`@smartput/rates`'s `RateSnapshot` satisfies the shape structurally; core never
imports that package.

```ts
interface RateLookup {
  readonly base: string;
  readonly asOf: string;
  get(from: string, to: string): Decimal | null;
}
```

```ts
import { money, snapshot } from "@smartput/rates";

createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 }),
});
```

Every `Result` from an engine with `rates` carries `meta.ratesAsOf`. See
[Money and rates](/guide/money).

### rounding

Rounding mode for money formatting. Default `Decimal.ROUND_HALF_EVEN`. It
applies at the currency's minor unit and nowhere else — the AST keeps full
precision, so `(1 usd / 3) * 3` is a dollar.

### now

Injectable clock, epoch **milliseconds**. Default `Date.now`. Handed to every
[literal matcher](/api/define-kind#literals) as `MatchCtx.now`, which is what
makes `"today"` and `"next week monday"` testable at all.

Milliseconds rather than a `Temporal.Instant` so core keeps its single runtime
dependency — [`@smartput/datetime`](/guide/datetime) does the conversion.

```ts
createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, datetime],
  now: () => 1_768_478_400_000, // 2026-01-15T12:00:00Z
  timeZone: "UTC",
});
```

### timeZone

IANA time zone every literal matcher resolves against, as `MatchCtx.timeZone`.
Defaults to the host zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`).

It is not only a display setting: it decides what a bare `3pm` *is*.
`EvalOptions.timeZone` overrides it per call, which is what a server handling
requests from many places needs.

## Immutability

Engines are immutable. To vary options, call `createEngine` again — it is a
cheap pure composition of frozen descriptors, which is why there is no
`engine.with(patch)`.

<SpWeights />

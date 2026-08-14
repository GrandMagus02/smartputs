---
title: createEngine
description: Compose locales and kinds into an immutable Engine.
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
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const en = composeLocale(english, BUILTIN_EN);
const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
```

## EngineOptions

```ts
interface EngineOptions {
  locales: Locale[];         // required; every language the engine reads
  format?: string;           // the one language it writes; default locales[0].id
  kinds?: Kind[];
  weights?: Weights;
  tiebreak?: "error" | "first";
  ambiguityEpsilon?: number;
  maxCandidates?: number;
  kindMeta?: Readonly<Record<KindId, Readonly<Record<string, unknown>>>>;
  formatPrecision?: number;
  comparePrecision?: number | "exact";
  rates?: RateLookup;
  rounding?: Decimal.Rounding;
  now?: () => number;
  timeZone?: string;
}
```

### locales

Required, and must be non-empty — an empty array throws. Every entry is a
`Locale`, which is a `Language` and its `Vocabulary` list joined by
[`composeLocale`](/guide/locales) and by nothing else; a bare `Language` is not
one and does not work.

Every entry is a language the engine **reads**: a surface gets a reading if any
of them can reach it, so a `[en, uk]` engine answers `5 kg`, `5 кг` and
`5 кг in pounds` alike.

There is no separate `packs` option. Vocabulary that is not a built-in — money's
`quid`, datetime's `tokyo`, a private ticker's words — is named in the same
`composeLocale` call as everything else, one vocabulary per kind per language:

```ts
locales: [composeLocale(english, [...BUILTIN_EN, moneyEn, datetimeEn])];
```

### format

The one language the engine **writes**, by id. Defaults to `locales[0].id`, and
must name an installed locale — `createEngine` throws naming the id if it does
not, so a misspelling fails on boot rather than at a keystroke.

```ts
const engine = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, format: "uk" });
engine.evaluate("5 kg").formatted; // "5 кілограмів"
```

Generation is single-locale on purpose: a `Result` is one string in one
language, not a table. `format` also fixes the two input-side concerns that are
not recognition — number grammar and segmentation — because both belong to the
language the engine speaks rather than to any it merely reads. `EvalOptions.format`
overrides the output for one call but deliberately does not move those; see
[`EvalOptions`](/api/engine#evaloptions).

### kinds

Appended to the engine's vocabulary. **Nothing is registered implicitly** — pass
`BUILTIN_KINDS` from [`@smartput/kinds`](/guide/kinds), or the subset you want,
or the engine has no units at all and every word raises `NoCandidateError`.

```ts
createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, measure, myTicker] });
```

Two shipped kinds are not in `BUILTIN_KINDS` and must be named: `measure`, also
from `@smartput/kinds`, whose `mm`/`cm` aliases collide with `length`, and
`money` from [`@smartput/rate`](/api/rate), which needs a `rates` table to
convert at all.

Two kinds claiming the same id, or the same op signature, raise
`KindConflictError` naming both sources. Registration order is irrelevant.

A vocabulary naming a kind no `kinds` entry registers raises `UnknownKindError`
here — never a silent no-op.

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

### comparePrecision

Significant digits both operands of a [comparison](/packages/boolean) are
rounded to before it decides. Defaults to the same `26` `formatPrecision` does,
so two values that print identically compare identically. `"exact"` compares the
canonicals as computed, for a caller checking the arithmetic rather than the
intent.

### rates

An FX table for kinds whose unit ratios are not constants.
`@smartput/rate`'s `RateSnapshot` satisfies the shape structurally; core never
imports that package.

```ts
interface RateLookup {
  readonly base: string;
  readonly asOf: string;
  get(from: string, to: string): Decimal | null;
}
```

```ts
import { money, snapshot } from "@smartput/rate";

createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 }),
});
```

Every `Result` from an engine with `rates` carries `meta.ratesAsOf`. See
[Money and rates](/packages/rate).

### rounding

Rounding mode for money formatting. Default `Decimal.ROUND_HALF_EVEN`. It
applies at the currency's minor unit and nowhere else — the AST keeps full
precision, so `(1 usd / 3) * 3` is a dollar.

### now

Injectable clock, epoch **milliseconds**. Default `Date.now`. Handed to every
[literal matcher](/api/define-kind#literals) as `MatchCtx.now`, which is what
makes `"today"` and `"next week monday"` testable at all.

Milliseconds rather than a `Temporal.Instant` so core keeps its single runtime
dependency — [`@smartput/datetime`](/packages/datetime) does the conversion.

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

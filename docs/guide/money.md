---
title: Money and rates
description: The money kind, rate snapshots, providers, and the async facade.
---

# Money and rates

Money is an ordinary kind. It parses through the same lexer, ranks through the
same solver, and converts through the same `in`. The one thing it does not have
is constant unit ratios — a euro is not a fixed number of dollars — so
`@smartput/rate` supplies the kind and you supply the table.

What a currency *is* — its symbol, its minor units, the words that name it — is
[`@smartput/currency`](/api/currency), a dependency of this one. None of that
changes when a rate does, and a form field validating `"30 usd"` should not have
to link a provider to do it.

```sh
bun add @smartput/rate
```

```ts
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, money],
  packs: [moneyEn],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 }),
});

engine.evaluate("30 usd in gbp").formatted; // "£22.94"
```

<SpMoney />

## Why it is a separate package

`@smartput/core` ships one runtime dependency and knows nothing about the
network. Money needs a rate table that arrives from somewhere, on a schedule,
and might fail — so the kind, the currency table, the providers and the async
facade all live next door, and core exposes exactly one seam for them:

```ts
interface RateLookup {
  readonly base: string;
  readonly asOf: string;
  get(from: string, to: string): Decimal | null;
}
```

`EngineOptions.rates` takes that shape. `RateSnapshot` satisfies it
structurally, so neither package imports the other's implementation, and any
table you already have works without adapting it.

## Snapshots

A snapshot is a dated, immutable table of quotes per unit of a base currency —
which is the shape every FX source publishes.

```ts
const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });

rates.get("USD", "EUR"); // Decimal(0.909090…)
rates.get("USD", "UAH"); // Decimal(41.363…) — both quoted against EUR, so it cancels
rates.get("USD", "XXX"); // null
```

`get` returns `null` rather than throwing, so the kind that asked decides what a
missing rate means. `money` raises `MissingRateError`; a different kind might
fall back.

## Cross rates are never silent

The snapshot quotes everything against one base. A USD → GBP conversion is
therefore *derived* — divided through the euro — and the engine says so on the
`Result` rather than implying a precision it does not have:

```ts
const result = engine.evaluate("30 usd in gbp");

result.formatted;        // "£22.94"
result.meta.ratesAsOf;   // "2026-08-04"
result.meta.assumptions;
// [ { code: "cross-rate",
//     message: "USD to GBP was derived via EUR",
//     detail: { from: "USD", to: "GBP", via: "EUR" } } ]
```

Every operation that can see two currencies at once discloses it — `in`, `+`
and `-` alike, because `30 usd - 10 gbp` derives exactly the rate that
`30 usd in gbp` does. `code` is stable and machine-readable; `message` is
human-facing and may be reworded.

<SpEvaluate
  with-money
  title="engine.evaluate(input) — money registered"
  model-value="30 usd in gbp"
  :examples="[
    '30 usd in gbp',
    '10 usd + 5 eur',
    '100 usd in uah',
    '30 quid in usd',
    '(1 usd / 3) * 3',
    '1000 jpy in eur',
    '5 bucks',
  ]"
  hint="Rates are the checked-in 2026-08-04 snapshot. A pair not quoted against the euro carries a cross-rate assumption." />

## Rounding is a formatting step

Money rounds at the minor unit — cents, and none at all for the yen — but only
in `format()`. The AST carries full `Decimal` precision throughout, which is why
`(1 usd / 3) * 3` is a dollar rather than 99 cents. Set the mode engine-wide
with `EngineOptions.rounding`; the default is `Decimal.ROUND_HALF_EVEN`.

The sign sits outside the symbol — `-$10.00`, never `$-10.00` — because that is
what every locale convention does.

## Currencies

Twelve of them: the euro, and eleven currencies from the ECB's daily reference
file — `usd` `gbp` `jpy` `chf` `pln` `uah` `cad` `aud` `sek` `nok` `czk`.
Deliberately not the full ISO 4217 list: a code with no rate behind it can only
ever raise `MissingRateError`, so listing it would promise nothing.

```ts
import { CURRENCIES } from "@smartput/rate"; // re-exported from @smartput/currency

CURRENCIES.jpy;
// { minorUnits: 0, symbol: "¥", aliases: ["jpy", "yen"],
//   display: { one: "yen", other: "yen" }, typical: [100, 1000000] }
```

`@smartput/rate/locale/en` is a separate opt-in pack carrying what only English
speakers say — `quid`, `sterling`, `bucks`. Vocabulary ships beside the kind it
describes, so it cannot drift from it.

## Live rates

`createLiveEngine` is the async facade over the sync core. All I/O, caching and
TTL live in it; the engine underneath stays pure and keystroke-fast.

```ts
import { createLiveEngine, ecb, money } from "@smartput/rate";

const live = createLiveEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, money],
  provider: ecb(),
  ttlMs: 60 * 60 * 1000, // default: one hour
});

await live.evaluate("30 usd in gbp"); // fetches on first call, then caches
live.ratesAsOf;                       // "2026-08-04"
live.sync;                            // the plain Engine, once rates have arrived
```

A burst of keystrokes on a cold cache produces **one** request, not one per
keystroke: concurrent callers share a single in-flight promise. A rejected fetch
clears it, so the rejection reaches every waiting caller and the next call
retries rather than awaiting a settled rejection forever.

`live.sync` throws `RatesNotReadyError` until the first refresh — reach for it
when you need the synchronous surface (`explain`, `complete`, `coerce`) after
rates have landed.

### Providers

```ts
interface RateProvider {
  readonly id: string;
  fetch(): Promise<RateSnapshot>;
}
```

| Provider | Source |
| --- | --- |
| `ecb(opts?)` | ECB daily reference rates — official, free, no key, ~30 fiat currencies, published once each working day |
| `custom(fn)` | wraps any `() => Promise<RateSnapshot>` in the provider shape |

`ecb()` accepts `{ fetch, url }` so a test can inject a fixture and a
deployment can point at a mirror. A non-OK response, a document with no date, or
one with no quotes each raise `RateProviderError` naming the provider — the
failure is never an empty table that silently makes every conversion wrong.

## Known limitation

`evaluate("$30.00")` returns the **number** 30, not money. Core's lexer
allowlist contains `%` and nothing else, so a leading `$` is skipped and the
rest parses as a bare number. Symbols render correctly; they do not parse.
Currency *words* and ISO codes do:

```ts
engine.evaluate("30 dollars in euros"); // money
engine.evaluate("$30");                 // number 30 — not an error, a different kind
```

Fixing it means teaching the lexer prefix symbols, which carries its own
ambiguity questions, so it is pinned as a known failure in
`packages/rate/src/properties.test.ts` rather than left to be discovered.

## Next

- [`@smartput/rate` API reference](/api/rate) — every export.
- [Kinds and units](/guide/kinds) — where the value model comes from.

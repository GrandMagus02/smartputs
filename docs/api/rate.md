---
title: "@smartput/rate"
description: The money kind, rate snapshots, providers and the async facade.
---

# @smartput/rate

The money kind and everything it needs that core deliberately does not have: a
rate table, providers that fetch one, and an async facade that caches the
result. The currency table itself is [`@smartput/currency`](/api/currency), a
dependency of this package — a symbol and a minor unit do not change when a rate
does, and a form field that only validates `"30 usd"` should not have to link a
provider to do it.

```sh
bun add @smartput/rate
```

| Subpath | Contents |
| --- | --- |
| `@smartput/rate` | `money`, `snapshot`, `ecb`, `custom`, `createLiveEngine`, `CURRENCIES` |
| `@smartput/rate/locale/en` | colloquial English currency words (default export) |

Runtime dependencies: `@smartput/core` and `decimal.js`. Provider adapters use
`fetch` and nothing else.

<SpMoney />

## money

```ts
const money: Kind
```

A ratio kind canonicalised on the euro, because that is what the ECB's daily
reference file quotes against. Register it like any other kind, and give the
engine a `rates` table — without one, every non-euro unit raises
`MissingRateError` on conversion.

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn])],
  kinds: [...BUILTIN_KINDS, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 }),
});
```

It declares three op signatures of its own — `in`, `+` and `-` over two money
operands — replacing the generated ones. The arithmetic is identical; these are
the only places that can see both currencies at once, and therefore the only
places that can tell a quoted rate from a derived one.

Its `format` hook rounds at the currency's minor unit (`minorUnits: 0` for the
yen), pads back up to that scale through the locale's own decimal symbol, and
puts the sign outside the symbol: `-$10.00`.

## snapshot()

```ts
function snapshot(
  base: string,
  asOf: string,
  table: Record<string, number | string>,
): RateSnapshot
```

Builds a frozen, dated rate table from quotes per unit of `base`.

```ts
const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });

rates.base;               // "EUR"
rates.asOf;               // "2026-08-04"
rates.get("USD", "EUR");  // Decimal(0.909090…)
rates.get("USD", "UAH");  // Decimal(41.3636…) — the base cancels
rates.get("USD", "XXX");  // null
```

Codes are upper-cased on the way in and on lookup, so case never matters.
Quotes may be strings, which is how you keep a rate that does not survive a
float — `"1.10"` and `1.1` both arrive as exact `Decimal`s.

```ts
interface RateSnapshot extends RateLookup {}

interface RateLookup {
  readonly base: string;
  readonly asOf: string;
  get(from: string, to: string): Decimal | null;
}
```

`RateLookup` is declared in `@smartput/core`, and `RateSnapshot` satisfies it
structurally. Core never imports this package; any table of your own with those
three members works as `EngineOptions.rates`.

## createLiveEngine()

```ts
function createLiveEngine(opts: LiveEngineOptions): LiveEngine
```

The async facade over a sync core. All I/O, caching and TTL live here; the
engine underneath stays pure.

```ts
interface LiveEngineOptions extends Omit<EngineOptions, "rates"> {
  provider: RateProvider;
  /** How long a snapshot stays fresh. Default one hour. */
  ttlMs?: number;
  /** Injectable clock, in epoch milliseconds. Default Date.now. */
  now?: () => number;
}

interface LiveEngine {
  evaluate(input: string, opts?: EvalOptions): Promise<Result>;
  suggest(input: string, opts?: EvalOptions): Promise<Result[]>;
  /** Force a fetch regardless of TTL. */
  refresh(): Promise<void>;
  /** The underlying sync engine. Throws until the first refresh. */
  readonly sync: Engine;
  readonly ratesAsOf: string | undefined;
}
```

```ts
import { createLiveEngine, ecb, money } from "@smartput/rate";

const live = createLiveEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, money],
  provider: ecb(),
});

await live.evaluate("30 usd in gbp"); // fetches, then caches for ttlMs
live.ratesAsOf;                       // "2026-08-04"
live.sync.complete("30 u");           // the sync surface, once rates have landed
```

Concurrent callers share **one** in-flight request, so a burst of keystrokes on
a cold cache is a single fetch. A rejected fetch clears the shared promise, so
the rejection reaches every waiting caller and the next call retries rather than
awaiting a settled rejection forever.

`sync` throws `RatesNotReadyError` before the first successful refresh. It is
the route to `explain()`, `coerce()` and `complete()`, which the async facade
does not re-expose because none of them need to await anything once rates exist.

## Providers

```ts
interface RateProvider {
  readonly id: string;
  fetch(): Promise<RateSnapshot>;
}
```

### ecb()

```ts
function ecb(opts?: EcbOptions): RateProvider

interface EcbOptions {
  fetch?: typeof globalThis.fetch;  // injected for tests
  url?: string;                     // override the endpoint, e.g. a mirror
}
```

ECB daily reference rates: official, free, no key, quoted against the euro,
published once each working day.

The document is parsed with two regexes rather than an XML parser — it has had
the same three-level `Cube` structure for two decades, and a parser would be the
heaviest thing in the package. A fixture test is what makes that safe: if the
format moves, it fails in CI rather than in production.

Raises `RateProviderError` on a non-OK response, a document with no
`<Cube time='…'>` date, or one with no quotes. The failure is never an empty
table that silently makes every conversion wrong.

### custom()

```ts
function custom(fn: () => Promise<RateSnapshot>): RateProvider
```

Wraps any async source in the provider shape — your own cache, a paid API, a
fixture in a test.

```ts
const provider = custom(async () => snapshot("EUR", today, await myApi.rates()));
```

## CURRENCIES

Re-exported from [`@smartput/currency`](/api/currency), which is where the table
and its type now live — along with the parser, the formatter and the vocabulary
the kind registers. It stays reachable from here because a consumer registering
`money` almost always wants to render a currency picker too, and a second import
for the table `money`'s own units are keyed by would be a split the user pays
for and nobody asked for.

```ts
const CURRENCIES: Record<string, CurrencyDef>

interface CurrencyDef {
  minorUnits: number;     // decimal places at display. JPY has none.
  symbol: string;
  aliases: string[];
  display?: Partial<Record<Intl.LDMLPluralRule, string>>;
  typical: [number, number];
}
```

Twelve entries: `eur` `usd` `gbp` `jpy` `chf` `pln` `uah` `cad` `aud` `sek`
`nok` `czk` — the euro plus the currencies the ECB file covers. Not the full ISO
4217 list, because a code with no rate behind it can only ever raise
`MissingRateError`.

`display` is what [completion](/api/complete) inserts, so every word in it must
be a single token that parses back to the same currency. That is why `cad` and
`aud` declare none — "Canadian dollar" is two words, and completion falls back
to the ISO code, which does parse. Omission is the honest answer; a word the
engine then rejects is not.

`typical` is the magnitude band completion's `scaleFit` scores against. Bands
are per currency because the unit of account is: 30 of something is an ordinary
dollar amount and an implausibly small yen one.

## Errors

Raised from this package, defined in core so `instanceof` works across the
boundary:

| Error | Raised when |
| --- | --- |
| `MissingRateError` | a currency pair is absent from the snapshot, or no `rates` were supplied at all |
| `RateProviderError` | a provider's fetch failed or returned something unusable |
| `RatesNotReadyError` | `LiveEngine.sync` was read before the first successful refresh |

## See also

- [Money and rates](/guide/money) — the guide, including the `$30` parsing limitation.
- [defineKind](/api/define-kind) — the `ratio: (ctx) => Decimal` form money is built on.

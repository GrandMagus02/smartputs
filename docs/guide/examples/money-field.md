---
title: An amount field that converts
description: A money input where the currency is part of the value — "30 usd in gbp" — with a rate table you own and an asOf you show.
---

# An amount field that converts

An expense form, an invoice line, a price in a product sheet. The number is
easy; the currency is where these go wrong, because the currency is usually a
`<select>` next to the input and the two are not read together by anybody.

Here the currency is part of the value:

<SpMoney />

```ts
engine.evaluate("30 usd in gbp").formatted;   // "£22.94"
```

## The rate table is yours

Money is an ordinary kind with one difference: its unit ratios are not
constants, so [`@smartput/rate`](/packages/rate) supplies the kind and you
supply the table.

```ts
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn])],
  kinds: [...BUILTIN_KINDS, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412, JPY: 170 }),
});
```

A snapshot is dated because a rate without a date is a number pretending to be
a fact. **Show the date.** The demo above prints it, this site's rates are a
checked-in table rather than live quotes, and it says so — an amount converted
at an unknown time is not auditable and, on an invoice, not defensible.

## Cross rates are disclosed, not implied

The table above is quoted against EUR. `30 usd in gbp` is therefore two
divisions through a currency nobody mentioned, and the `Result` says so:

```ts
const result = engine.evaluate("30 usd in gbp");

result.formatted;              // "£22.94"
result.meta.assumptions;       // [{ code: "cross-rate", message: "…via EUR", … }]
```

Render assumptions. A derived rate is a defensible reading, not a fact, and the
gap between a bank's direct USD/GBP quote and one triangulated through EUR is
exactly the kind of small discrepancy that turns into an accounting question
three weeks later.

```vue
<p v-if="result.meta.assumptions.length" class="note">
  {{ result.meta.assumptions.map((a) => a.message).join('; ') }}
</p>
```

## Symbols print; codes parse

```ts
engine.evaluate("30 usd").formatted;   // "$30.00"
engine.evaluate("$30").kind;           // "number" — the $ is not read
```

`$` is the *output* form of USD, and it is not an input alias, because it is
not one currency: `$` is US, Canadian, Australian, Hong Kong and a dozen more,
and a parser that resolved it silently would resolve it wrongly for most of the
world. Codes and names parse — `usd`, `dollar`, `dollars`, and in English
`bucks` and `quid` too.

If your field must accept `$30` — a checkout in one market, where there is
exactly one dollar — that is a product decision your component makes, visibly:

```ts
// This app sells in USD only, so here $ means USD. Say so in the UI.
const withCode = input.replace(/^\$\s*/, "").concat(" usd");
```

## Rounding is money-specific

```ts
engine.evaluate("30 usd + 10 eur").formatted;   // "$41.00"
```

Two decimals, and a trailing zero that a `Decimal` has no notion of on its own
— the money kind's formatter asks for a minimum fraction digit count because
minor units are a property of the currency (JPY has none, KWD has three). The
default rounding is `ROUND_HALF_EVEN`; set `rounding` on the engine if your
jurisdiction says otherwise.

What you **store** is `canonical` in the base currency plus the authored
currency, never the formatted string:

```ts
line.amount   = result.value.canonical.toString();   // in the table's base
line.currency = result.value.unit;                   // "usd"
line.asOf     = rates.asOf;                          // "2026-08-04"
```

Three columns, because a total recomputed later at today's rate is a different
total, and the invoice was sent with the old one.

## Live rates

`snapshot` is a table you already have. If the table arrives over the network,
`@smartput/rate`'s facade fetches and caches it, and the shape it hands the
engine is the same `RateLookup` — so nothing in the field changes when the
source does. See [`@smartput/rate`](/packages/rate#live-rates) for the provider
interface and the failure modes worth handling (stale table, missing pair,
provider down).

## Checklist

- the rate table is injected, dated, and its date is visible in the UI
- `meta.assumptions` is rendered, so a cross rate is never silent
- store canonical + authored currency + `asOf`, not the formatted string
- currency codes and names parse; symbols do not — decide, in the app, whether
  `$` means anything here
- validating "is this an amount at all" needs no rates:
  [`@smartput/currency`](/packages/currency) is the recognition half

## See also

- [`@smartput/rate`](/packages/rate) — snapshots, providers, the live facade
- [`@smartput/currency`](/packages/currency) — codes, symbols, minor units
- [Filter bar](/guide/examples/filter-bar) — `orders over 500 usd`, same kind

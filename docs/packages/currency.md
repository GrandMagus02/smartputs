---
title: "@smartput/currency"
description: "Currency recognition and formatting, with no rate table."
---

# @smartput/currency

The half of money that a rate cannot change: which word names which
ISO code, how many minor units it has, what symbol it prints with.
`parseAmount("30 usd")` needs no engine and no rates.

The `/validate` subpath keeps `Decimal` out of its graph on purpose — one
re-export of `formatAmount` from it took that entry from 2.6 KB to 35 KB,
because core configures `Decimal`'s precision in a module-load side effect a
bundler may not drop.

## Try it

<SpMoney />

## Installing

```sh
npm add @smartput/currency
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/currency` | The package root. |
| `@smartput/currency/validate` | Free functions over JS numbers. `Ok \| Err`, never a throw. |
| `@smartput/currency/class` | The immutable value class. |

## Runtime exports

Type-only exports are erased and do not appear here.

`CURRENCIES` · `Currency` · `currencyVocabulary` · `formatAmount` · `isCurrency` · `minorUnitsOf` · `parseAmount` · `parseCurrency` · `symbolOf`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| currency/validate parseAmount only | ≤ 2.6 kB | ≤ 1.1 kB |

## Dependencies

- [`@smartput/core`](/packages/core)
- `decimal.js`

## See also

- [Money and rates](/packages/rate)
- [@smartput/currency API](/api/currency)


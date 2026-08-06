# @smartput/currency

What a currency is, with nothing about what it is worth.

```ts
import { Currency } from "@smartput/currency/class";

const usd = Currency.for("dollars");
usd?.code;                        // "usd"
usd?.parse("1,250.50 usd");       // { ok: true, amount: 1250.5, raw: "1250.50", currency: "usd" }
usd?.format(new Decimal("30"));   // "$30.00"
```

The table, the vocabulary, the parser and the formatter. `@smartput/rate` holds
the `money` kind, the snapshots and the providers, and depends on this package
for the half of money that a date cannot change.

## Why it is a package

Every ratio kind ships a micro path — `parseLength`, `parseMass` — and `money`
could not, because `UnitTable` needs a ratio per unit and money's ratios are a
live rate table. That exemption is right about **conversion** and wrong about
everything else. Which currency a word names, how much `"30 usd"` is, and how to
write it back are all answerable without a rate, a date or a registry, and a
form field validating an amount should not have to link a provider to do it.

So this package parses and formats, and it cannot convert. The moment you want
`30 usd in gbp` you want a snapshot, and that is `@smartput/rate`.

## Three doors

| Import | What you get |
| --- | --- |
| `@smartput/currency` | `CURRENCIES`, `currencyLexicon()` — what a `money` kind is built out of |
| `@smartput/currency/validate` | `parseCurrency`, `parseAmount`, `symbolOf`, `minorUnitsOf` — 2.6 KB, no `Decimal` |
| `@smartput/currency/class` | `Currency`, the two above with a code already in hand |

`formatAmount` is deliberately not on the `/validate` path. It needs a `Decimal`,
core configures decimal.js's precision in a module-load side effect, and a side
effect is the one thing a bundler may not drop — one re-export of it takes that
entry from 2.6 KB to 35 KB. `symbolOf` and `minorUnitsOf` are the facts you need
to render an amount yourself; `check-size` holds the line.

## It agrees with the engine

`parseAmount` reads what `evaluate` reads and refuses what it refuses:
`"usd 30"` fails on both, because a unit is written after its quantity.
`parseCurrency` knows the aliases the kind registers and *not* `quid`, which
arrives with `@smartput/rate/locale/en` — a pack is something a consumer chose,
and a parser that knew a word the engine had not been given would be the more
confusing of the two disagreements.

The one deliberate divergence is opt-in. `evaluate("$30")` is the number 30, so
symbols are off by default here too; `parseAmount("$30", { symbols: true })`
reads them, because a form field has no number kind to lose the token to.

`packages/rate/src/currency-agreement.test.ts` asserts all of that from the side
of the boundary that can see both.

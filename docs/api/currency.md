---
title: "@smartput/currency"
description: The currency table, the vocabulary a money kind registers, and an engine-free parser and formatter.
---

# @smartput/currency

What a currency is, with nothing about what it is worth. The table, the
vocabulary, the parser and the formatter. [`@smartput/rate`](/api/rate) holds the
`money` kind, the snapshots and the providers, and depends on this package for
the half of money that a date cannot change.

```sh
bun add @smartput/currency
```

```ts
import { Currency } from "@smartput/currency/class";

const usd = Currency.for("dollars");
usd?.code;                   // "usd"
usd?.parse("1,250.50 usd");  // { ok: true, amount: 1250.5, raw: "1250.50", currency: "usd" }
```

## Why it is a package

Every ratio kind ships a [micro path](/guide/validating) — `parseLength`,
`parseMass` — and `money` could not, because `UnitTable` needs a ratio per unit
and money's ratios are a live rate table. That exemption is right about
**conversion** and wrong about everything else. Which currency a word names, how
much `"30 usd"` is, and how to write it back need no rate, no date and no
registry.

So this package parses and formats, and it cannot convert. The moment you want
`30 usd in gbp` you want a snapshot, and that is `@smartput/rate`.

## Three doors

| Import | What you get | Cost |
| --- | --- | --- |
| `@smartput/currency` | `CURRENCIES`, `currencyLexicon()` | the table |
| `@smartput/currency/validate` | `parseCurrency`, `parseAmount`, `symbolOf`, `minorUnitsOf` | 2.6 KB min, 1.0 KB gzip |
| `@smartput/currency/class` | `Currency` | the two above |

`formatAmount` is deliberately **not** on the `/validate` path. It needs a
`Decimal`, core configures decimal.js's precision in a module-load side effect,
and a side effect is the one thing a bundler may not drop — one re-export of it
takes that entry from 2.6 KB to 35 KB. `symbolOf` and `minorUnitsOf` are the
facts you need to render an amount yourself, and `check-size` holds the line.

## parseCurrency

```ts
function parseCurrency(word: string): string | null
function isCurrency(word: string): boolean
```

The lowercase ISO code a word names, or `null`. Case-insensitive and trimmed, so
`"USD"`, `"usd"`, `"Dollars"` and `" dollar "` are one answer.

It knows the aliases and display forms the kind registers and **not** `quid`,
which arrives with `@smartput/rate/locale/en`. A pack is something a consumer
chose, and a parser that knew a word the engine had not been given would be the
more confusing of the two disagreements.

## parseAmount

```ts
function parseAmount(input: string, opts?: { symbols?: boolean }): ParsedInput

type ParsedInput =
  | { ok: true; amount: number; currency: string; raw: string }
  | { ok: false; code: AmountError; input: string }

type AmountError =
  | "empty" | "nan" | "missing-currency" | "unknown-currency" | "trailing";
```

An amount and the currency it is in, in the order the engine reads them.

| Input | Result |
| --- | --- |
| `30 usd` | `{ amount: 30, currency: "usd", raw: "30" }` |
| `1,250.50 dollars` | `{ amount: 1250.5, currency: "usd", raw: "1250.50" }` |
| `-4 eur` | `{ amount: -4, currency: "eur" }` |
| `1200jpy` | `{ amount: 1200, currency: "jpy" }` |
| `usd 30` | `nan` — a unit is written **after** its quantity |
| `30` | `missing-currency` |
| `30 dollarz` | `unknown-currency` |
| `30 usd each` | `trailing` |

`amount` is a plain `number` and `raw` is the digits as authored, which is the
shape the shared validate path carries and for the same reason: a `Decimal` in
the return type would put core's 28-digit constructor in the graph of every
field that only wanted to know whether the input was valid. Hand `raw` to a
`Decimal` when the arithmetic has to be exact.

Amount-first is not a style choice. `evaluate("usd 30")` throws, so accepting
the reverse here would make this parser take strings the engine refuses.

### Symbols are opt-in

```ts
parseAmount("$30");                     // { ok: false, code: "nan" }
parseAmount("$30", { symbols: true });  // { ok: true, amount: 30, currency: "usd" }
```

`evaluate("$30")` is the number 30 — a symbol is not a registered alias, and
reading it as one would make every `$` in an expression a unit claim. This is
the one place the parser can be *wider* than the engine, so it has to be asked
for, or the two would disagree about the same string by default.

A longer symbol wins over the shorter one it ends with, so `CA$30` is Canadian
and `$30` is not. Two symbols are shared with currencies this table does not
carry — `kr` is Swedish, Norwegian and Danish, `$` is a dozen dollars — and they
resolve to the row that exists, which is a choice and not a fact.

## formatAmount

```ts
function formatAmount(
  amount: Decimal,
  code: string,
  opts?: { rounding?: Decimal.Rounding; formatNumber?: NumberFormatter },
): string
```

`-$10.00`, `¥1200`, `€0.05`. Rounded to the currency's minor unit first, so the
mode decides the cent rather than a digit nobody will see, then padded back up —
a `Decimal` has no notion of a trailing zero, and `new Decimal("30.00")` is 30
again.

The sign sits outside the symbol, because every locale convention writes
`-$10.00` and none writes `$-10.00`. A small negative that rounds to zero loses
its sign, since `-$0.00` would be worse than the zero it is.

`formatNumber` is injectable because grouping and the decimal symbol are the
locale's: `@smartput/rate`'s `money` hook passes the engine's own formatter, and
the default here is plain digits with a `.`.

## Currency

```ts
class Currency {
  static for(word: string): Currency | null;
  static all(): readonly Currency[];
  readonly code: string;
  readonly symbol: string;
  readonly minorUnits: number;
  readonly aliases: readonly string[];
  parse(input: string, opts?: AmountOptions): ParsedInput;
  format(amount: Decimal, opts?: FormatAmountOptions): string;
}
```

The two above with a code already in hand. Frozen, with no public constructor
and one instance per code, so `Currency.for("usd") === Currency.for("dollars")`.

`for` refuses rather than inventing: a `Currency` for a code with no row is a
currency with no symbol and no scale, which is a worse thing to hand a caller
than `null`. `parse` refuses another currency read through this one — a field
bound to JPY that quietly accepted `"30 usd"` would be the bug.

There is no `convert` and there will not be one here.

## currencyLexicon

```ts
function currencyLexicon(): Lexicon
```

The vocabulary half of a `money` kind: aliases, symbol, plural display forms and
the magnitude band [completion](/api/complete) scores against, keyed by
lowercase ISO code. `@smartput/rate` builds `money` out of this plus the one
thing a date can change — the ratios.

Exported because anyone registering a money kind of their own would otherwise
write the same loop.

## CURRENCIES

Twelve entries: `eur` `usd` `gbp` `jpy` `chf` `pln` `uah` `cad` `aud` `sek`
`nok` `czk` — the euro plus the currencies the ECB file covers. Not the full ISO
4217 list, because a code with no rate behind it can only ever raise
`MissingRateError`. See [`@smartput/rate`](/api/rate#currencies) for the field
notes.

## It agrees with the engine

`packages/rate/src/currency-agreement.test.ts` asserts, from the side of the
boundary that can see both, that every alias the engine reads this parser reads
to the same currency, that the kind formats an unconverted amount exactly as
`formatAmount` does, and that a word one refuses the other refuses too.

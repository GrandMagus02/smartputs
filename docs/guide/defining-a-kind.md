---
title: Defining a kind
description: The five-line extension contract, built live in the browser.
---

# Defining a kind

`defineKind` is the only registration primitive. Built-in kinds go through it
too, which is what makes the extension seam real rather than aspirational.

## A minimal kind is five lines

```ts
import { createEngine, defineKind } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";

const dataSize = defineKind({
  id: "datasize",
  value: {
    mode: "ratio",
    canonical: "b",
    units: { b: 1, kb: 1e3, kib: 1024, mb: 1e6, mib: 1024 ** 2 },
  },
});

const engine = createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, dataSize] });
engine.evaluate("2 mib + 500 kb in kb"); // 2597.152 kb
```

Everything else has a working default:

- **Aliases** fall back to the unit keys, so `mib` is recognised without a lexicon.
- **`+ - * /` and `in`** are generated for any ratio kind.
- **Formatting** defaults to `${value}${unit}`.

You reach for `lexicon`, `ops` or `format` only when a default is actually
wrong. This is the acceptance test for the whole design: if adding a kind ever
needs more than `id`, `canonical` and `units`, a default is missing.

## Build one

Edit the descriptor below and the engine is rebuilt on every keystroke — kind
registration is a cheap pure composition of frozen descriptors, so there is
nothing to tear down.

<SpCustomKind />

## The full descriptor

```ts
interface Kind {
  id: KindId;                  // required
  value: RatioSpec | OpaqueSpec;   // required

  // everything below is optional and has a working default
  extendsKind?: KindId;        // patch a built-in; merges lexicon/units/ops
  prior?: number;              // base solver weight, default 0
  lexicon?: Lexicon;           // default (en) aliases; defaults to the unit keys
  ops?: OpSignature[];         // ratio kinds get + - * / and `in` for free
  format?: (v: Value, ctx: FormatCtx) => string;
}
```

### Ratio units

```ts
interface UnitDef {
  ratio: Decimal | number | ((ctx: EvalCtx) => Decimal);
  offset?: Decimal | number;   // affine only: °F = °C·9/5 + 32
  aliases?: string[];
}
```

A bare number is shorthand for `{ ratio }`. Plain numbers are widened to
`Decimal` at registration, so authoring tables as numbers stays readable and
nothing downstream sees a float.

The **function form** is what lets money and dpi-relative measurement fall out
of the general mechanism instead of needing bespoke engines:

```ts
// money — unit ratios come from the injected snapshot
usd: { ratio: (ctx) => ctx.rates.get("USD", "EUR") ?? throwMissingRate("USD", "EUR") }

// measure — px depends on the value's own dpi, carried in Value.meta
px: { ratio: (ctx) => new Decimal(1).div(ctx.self.meta?.dpi ?? 96) }
```

There is no per-kind "context" mechanism. `Value.meta` already exists on every
value; dpi rides along in it. One generic escape hatch, used by the one kind
that needs it.

### Vocabulary

`lexicon` is the kind's own default (`en`) layer. Other languages arrive as
[locale packs](/guide/locales#translation-packs), so the vocabulary can never
drift from the kind it describes.

```ts
lexicon: {
  kib: { aliases: ["kib", "kibibyte"], symbol: "KiB",
         display: { one: "kibibyte", other: "kibibytes" } },
}
```

### Cross-kind operations

Only for signatures the ratio generator does not produce:

```ts
ops: [
  { op: "/", left: "length", right: "duration", result: "speed",
    apply: (l, r) => ({ kind: "speed", canonical: l.canonical.div(r.canonical), unit: "m/s" }) },
]
```

Registering a signature immediately makes that expression form parseable — the
solver reads the same table it uses to score candidates.

## Patching instead of replacing

A patch is itself a kind, with its own id, registered through the same channel.
There is no mutable global registry to reach into.

```ts
const imperialMass = defineKind({
  id: "mass-imperial-extra",
  extendsKind: "mass",
  value: { mode: "ratio", canonical: "g", units: { st: 6350.29318 } },
  lexicon: { st: { aliases: ["st", "stone"], symbol: "st" } },
});
```

Conflicts surface as `KindConflictError` naming both sources, at
`createEngine()` time. Registration order is irrelevant.

## Contract tests

`@smartput/core/testing` exports the same suites the built-ins run against, so a
third-party kind can prove it satisfies the contract:

```ts
import { assertKindContract } from "@smartput/core/testing";

assertKindContract(dataSize);
```

It asserts that the kind registers, that its canonical unit is in its own unit
table, that every unit has at least one typeable alias, and that no ratio is
zero — a zero ratio makes a unit unconvertible in both directions.

::: info Status
`assertLocaleContract` — every lexeme's inflected forms reach their lemma, every
plural category named by `Intl.PluralRules` has a `display` entry or a `symbol`
fallback, and the analyzer chain is idempotent on already-lemmatized input —
lands with the Ukrainian locale in M5.
:::

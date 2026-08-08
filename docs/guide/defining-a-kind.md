---
title: Defining a kind
description: The five-line extension contract, built live in the browser.
---

# Defining a kind

`defineKind` is the only registration primitive. Built-in kinds go through it
too, which is what makes the extension seam real rather than aspirational.

## A minimal kind is five lines

```ts
import { composeLocale, createEngine, defineKind } from "@smartput/core";
import { english } from "@smartput/core/locale/en";

const dataSize = defineKind({
  id: "data-size",
  value: {
    mode: "ratio",
    canonical: "b",
    units: { b: 1, kb: 1e3, kib: 1024, mb: 1e6, mib: 1024 ** 2 },
  },
});

// A language with no vocabulary at all — the second bullet below, run.
const engine = createEngine({ locales: [composeLocale(english, [])], kinds: [dataSize] });
engine.evaluate("2 mib + 500 kb in kb"); // 2,597.152 kb
```

`data-size` and not `datasize`: [`datasize` is a built-in](/guide/kinds), and two
kinds claiming one id is a `KindConflictError` at `createEngine()` whichever of
them is the plugin.

Everything else has a working default:

- **Aliases** fall back to the unit keys, so `mib` is recognised with no
  vocabulary installed at all.
- **`+ - * /` and `in`** are generated for any ratio kind.
- **Formatting** defaults to `${value}${unit}`.

You reach for a vocabulary, `ops` or `format` only when a default is actually
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
  extendsKind?: KindId;        // patch a built-in; merges units/literals/ops
  prior?: number;              // base solver weight, default 0
  typical?: Record<string, [number, number]>;  // magnitude bands, for completion
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

### Words are not on the kind

A descriptor carries **no natural-language string** — not an alias, not a
symbol, not a plural form. Words live in a [`Vocabulary`](/guide/locales), one
per (kind, language), shipped from the kind's own package as a `./locale/<id>`
subpath and composed into a locale by the caller:

```ts
// packages/data-size/src/locale/en.ts
export default defineVocabulary({
  locale: "en",
  kind: "data-size",   // by id string; a vocabulary never imports its kind
  units: {
    kib: { aliases: ["kib", "kibibyte"], symbol: "KiB",
           forms: { one: "kibibyte", other: "kibibytes" } },
  },
});
```

That is what lets someone who is not the kind's author publish
`@acme/data-size-uk`, and it is why the kind and its translations cannot drift:
there is no second copy to keep in step.

### `typical` — the one thing that stayed

A magnitude band is physics, not language, so it is kind-level and language-free.
Completion's `scaleFit` reads it to prefer the unit people actually type a number
that size in; a unit with no entry scores 0, so declaring a band is never a
penalty.

```ts
typical: { b: [1, 1024], kb: [1, 1000], mib: [1, 1024] },
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
});
```

Its words go where every kind's words go — into a vocabulary naming the **base**
kind, because `mass` is the id the registry ends up holding:

```ts
const stoneEn = defineVocabulary({
  locale: "en",
  kind: "mass",
  units: { st: { aliases: ["st", "stone", "stones"], symbol: "st" } },
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

`@smartput/core/testing` also exports `assertLocaleContract`, which shipped with
the Ukrainian locale in M5. It is the other half of the pair — `assertKindContract`
asks whether a *kind* is well formed, this asks whether a *(locale, kinds)* pair
is:

```ts
import { assertLocaleContract } from "@smartput/core/testing";

assertLocaleContract(composeLocale(english, BUILTIN_EN), BUILTIN_KINDS);
```

Every unit has words, every word reads back to its own unit through the analyzer
chain, every grammatical key `selectForm` can ask for exists in the table it
will index, and — the check four Ukrainian kinds shipped broken without —
**every string the printer can emit reads back as what it printed**. All the
checks run before any of them throws, so a half-translated vocabulary reports
its gaps in one go. See
[What `assertLocaleContract` demands](/guide/locales#what-assertlocalecontract-demands).

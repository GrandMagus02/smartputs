---
title: defineKind
description: The only registration primitive.
---

# defineKind

```ts
function defineKind(kind: Kind): Kind
```

A pure function that validates and freezes a kind descriptor. It is the only
registration primitive in the library — built-in kinds go through it too.

```ts
const dataSize = defineKind({
  id: "datasize",
  value: {
    mode: "ratio",
    canonical: "b",
    units: { b: 1, kb: 1e3, kib: 1024, mb: 1e6, mib: 1024 ** 2 },
  },
});
```

<SpCustomKind />

## Kind

```ts
interface Kind {
  id: KindId;                        // required
  value: RatioSpec | OpaqueSpec;     // required
  extendsKind?: KindId;
  prior?: number;
  lexicon?: Lexicon;
  ops?: OpSignature[];
  format?: (v: Value, ctx: FormatCtx) => string;
}
```

### id

Unique across the engine. A collision raises `KindConflictError` at
`createEngine()` naming both sources.

### value — RatioSpec

```ts
interface RatioSpec {
  mode: "ratio";
  canonical: string;
  units: Record<string, UnitDef | number>;
  affine?: { deltaKind: KindId };
}

interface UnitDef {
  ratio: Decimal | number | ((ctx: EvalCtx) => Decimal);
  offset?: Decimal | number;
  aliases?: string[];
}
```

A bare number is shorthand for `{ ratio }`. Plain numbers are widened to
`Decimal` at registration, so nothing downstream sees a float.

The canonical unit must appear in `units`, and no ratio may be zero — a zero
ratio makes a unit unconvertible in both directions.

The **function form** `ratio: (ctx) => Decimal` is what lets money (rates from an
injected snapshot) and dpi-relative measurement (`ctx.self.meta.dpi`) fall out of
the general mechanism instead of needing bespoke engines.

`affine` pairs an absolute kind with its delta kind — `Temperature` ↔
`TempDelta`, so `20°C + 5°C` can parse as absolute-plus-delta rather than
nonsense. Lands in M2.

### value — OpaqueSpec

For color, datetime, and anything that is not a scalar on a ratio line.

```ts
interface OpaqueSpec {
  mode: "opaque";
  parse: (token: string, ctx: EvalCtx) => unknown | null;   // null = not mine
  equals: (a: unknown, b: unknown) => boolean;
}
```

### extendsKind

Patches an existing kind instead of replacing it. A patch is itself a kind with
its own id, registered through the same `createEngine({ kinds })` channel.

| Field | Merge rule |
| --- | --- |
| `lexicon`, `units`, `literals`, `ops` | merged; the patch wins on key collision |
| `prior`, `format`, `canonical` | replaced when present |
| `value.mode` mismatch | throws at registration, never at parse time |

### prior

Layer 1 of the [weight stack](/guide/weights). Default `0`. The author's
default preference for this kind's candidates, which any later layer can
override.

### lexicon

The kind's own default (`en`) aliases. Omit it and the unit keys are used, which
is why the five-line `datasize` above already recognises `mib`.

```ts
type Lexicon = Record<string, UnitLexeme | string[]>;

interface UnitLexeme {
  aliases: string[];                                      // recognition
  symbol?: string;                                        // default formatter
  display?: Partial<Record<Intl.LDMLPluralRule, string>>; // generation
}
```

An array is shorthand for `{ aliases }`. Other languages arrive as
[locale packs](/api/define-locale#definelocalepack), never in this field.

### ops

Only for signatures the ratio generator does not produce. Ratio kinds get
`+ - * /` and `in` against their own kind for free.

```ts
interface OpSignature {
  op: "+" | "-" | "*" | "/" | "in";
  left: KindId;
  right: KindId;
  result: KindId;
  apply: (l: Value, r: Value, ctx: EvalCtx) => Value;
}
```

The solver reads this table directly — it *is* the type system. Registering a
signature immediately makes that expression form parseable.

### format

```ts
format?: (v: Value, ctx: FormatCtx) => string
```

Defaults to `${value}${unit}` with `Intl.NumberFormat` grammar and
`Intl.PluralRules` selection over the lexeme's `display` map, falling back to
`symbol`. Override only when that is wrong for the domain.

## Frozen descriptors

`defineKind` returns a frozen object. Mutating a kind after definition is not
possible, which is what lets `createEngine` treat composition as cheap and pure.

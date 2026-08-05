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
  literals?: LiteralMatcher[];
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
  units?: Record<string, UnitLexeme | string[]>;            // labels, not ratios
  parse?: (token: string, ctx: EvalCtx) => unknown | null;  // null = not mine
  equals?: (a: unknown, b: unknown) => boolean;
}
```

An opaque unit is a **label**, not a position on a ratio line —
[`datetime`](/guide/datetime)'s units are IANA time zones — but it is indexed by
alias, weighted, chosen by the solver, named as an `in` target and read by the
formatter exactly like a ratio kind's unit. Its ratio is the identity and its
offset is zero, so generic code never has to branch on `mode` before touching a
unit.

```ts
const zone = defineKind({
  id: "zone",
  value: {
    mode: "opaque",
    units: {
      UTC: ["utc", "gmt", "z"],
      "Asia/Tokyo": { aliases: ["tokyo", "jst"], symbol: "JST" },
    },
  },
});
```

An opaque kind generates **no** ops — there are no ratios to generate them from
— so every operation it supports is an explicit [`ops`](#ops) signature.
`createFacade` refuses an opaque kind for the same reason, and `complete()`
skips it, since a completion inserts `<number><unit>` and a time zone is not
that.

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

### literals

Recognition for anything that is not shaped like `<number><unit-word>`. A
literal matcher is offered the whole normalized input and an offset that is
always a token boundary, and it either claims a run of **characters** or returns
`null`.

```ts
type LiteralMatcher = (
  input: string,
  offset: number,
  ctx: MatchCtx,
) => LiteralMatch | null;

interface LiteralMatch {
  readonly kind: KindId;
  readonly unit: string;                                // registered by the kind
  readonly canonical: Decimal;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly length: number;                              // characters consumed, > 0
  readonly weight?: number;                             // summed into the score
}

interface MatchCtx {
  readonly locale: string;
  readonly now: number;        // epoch ms, from EngineOptions.now
  readonly timeZone: string;   // IANA, from EvalOptions.timeZone ?? EngineOptions.timeZone
  isUnitAlias(text: string): boolean;
}
```

The matcher returns a finished value rather than a payload the engine would have
to interpret — the engine has no idea what a date or a colour is, and giving it
one would be a second value model beside `Value`. `canonical` is whatever scalar
the kind orders and subtracts by; everything else rides on `meta`.

The shortest matcher that works, and the kind that registers it:

```ts
import {
  BUILTIN_KINDS,
  createEngine,
  Decimal,
  defineKind,
  type LiteralMatcher,
} from "@smartput/core";
import en from "@smartput/core/locale/en";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

const isoDate: LiteralMatcher = (input, offset) => {
  const m = ISO_DATE.exec(input.slice(offset));
  if (m === null) return null;
  return {
    kind: "day",
    unit: "UTC",
    canonical: new Decimal(Date.parse(`${m[0]}T00:00:00Z`)),
    meta: { iso: m[0] },
    length: m[0].length,
  };
};

const day = defineKind({
  id: "day",
  value: { mode: "opaque", units: { UTC: ["utc", "z"] } },
  literals: [isoDate],
  format: (v) => String(v.meta?.iso),
});

createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, day] })
  .evaluate("2026-03-01").formatted; // "2026-03-01"
```

`2026-03-01` lexes as number-op-number-op-number, which is why offsets exist:
the matcher slices the source, and `foldLiterals` collapses every token the run
covers into a single `literal` token. From there it is an ordinary operand —
scored through all four [weight layers](/guide/weights), dropped by
`EvalOptions.kinds`, and listed by `explain()`.

Rules the fold applies, so a matcher does not have to:

| Rule | Behaviour |
| --- | --- |
| Boundary | A match that does not end exactly where some token ends is discarded, never split |
| Longest wins | Across all matchers at one offset, the longest claim wins |
| Ties | Broken by kind id, then declaration order — never map iteration order |
| Bad unit | A `unit` the kind does not register drops the match |
| `length <= 0` | Ignored, rather than looping |
| Resume | Matching continues at the token after the claimed run |

**The fold is destructive.** Once `10 m` has been claimed, the `10 metres`
reading is gone before the solver ever runs — there is no lattice and no
backtracking. So a matcher must be conservative, and `ctx.isUnitAlias` exists
for exactly that: `@smartput/datetime` refuses any match whose letter runs are
*all* registered unit aliases, which is what keeps `5 min` a duration. See
[how it works](/guide/datetime#how-it-works).

`foldLiterals` is exported from the package root so a matcher can be tested in
isolation, without an engine.

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

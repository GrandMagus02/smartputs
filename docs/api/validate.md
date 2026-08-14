---
title: "@smartput/shared"
description: The shared engine-free parser, operations, pattern generator and value-class factory behind every kind's micro path.
---

# @smartput/shared

The package every kind's `/validate` and `/class` subpath is built from: one
parser, one operation algebra, one class factory, keyed by a plain data table.
No registry, no locale, no lexer.

```sh
bun add @smartput/shared
```

You will rarely install this directly — a kind package like
`@smartput/angle` already depends on it and re-exports thin, named wrappers
(`parseAngle`, `addAngle`, …). Reach for it yourself when you are building a
kind of your own, or when a table-generic helper is genuinely useful.

**Zero runtime dependencies**, enforced by `check-deps.ts` the same way
`@smartput/core`'s single-dependency rule is: this package must never import
`@smartput/core`, `decimal.js`, or any DOM type. `decimal.js` alone is about
30 KB — fifty times the entire byte budget a `parseAngle` call is supposed to
cost — so the micro path uses a JS `number` throughout and carries `raw: string`
for a caller who needs exactness to reach for `Decimal` themselves, at zero
cost to everyone else. See [the precision boundary](/api/value-classes#the-precision-boundary).

## Exports

| Export | Purpose |
| --- | --- |
| [`parse(table, input, opts?)`](#parse-is) | The parser. Returns `Ok \| Err`, never throws. |
| [`is(table, input, opts?)`](#parse-is) | `parse(...).ok` |
| [`add` / `sub` / `scale` / `negate`](#operations) | Ratio arithmetic |
| [`convert` / `as`](#operations) | Unit conversion |
| [`equals` / `compare`](#operations) | Comparison |
| [`format(table, ok)`](#operations) | Compact `toString`, e.g. `"30deg"` |
| [`patternFor(table, opts?)`](#patternfor) | An HTML `pattern` attribute value |
| [`createValueClass(table, kind, opts?)`](#createvalueclass) | The class factory — see [Value classes](/api/value-classes) |
| [`ValidationError`](#validationerror) | Thrown by class methods |
| `canonicalOf` / `toCanonical` / `fromCanonical` / `ratioOf` / `offsetOf` / `rebase` / `coerce` | Conversion internals — public because a kind with an affine or dynamic ratio (`temperature`, `measure`) needs them to build a wrapper the factory does not generate on its own |
| `Ok` / `Err` / `Parsed` / `ErrCode` / `Input` / `Ctx` / `UnitTable` / `ParseOptions` | Types — [below](#types) |

## Coverage

`@smartput/shared` itself is table-generic — it knows nothing about angles
or metres. Every ratio kind wires it to a table of its own, on three
subpaths:

```
@smartput/angle              defineKind descriptor           (the engine path)
@smartput/angle/units        UnitTable<AngleUnit> + the unit type
@smartput/angle/validate     parseAngle, isAngle, addAngle, toAngle, …
@smartput/angle/class        Angle
```

Twelve of the thirteen kinds in `@smartput/kinds` ship all three, plus
`@smartput/measure`, which is excluded from `BUILTIN_KINDS` in the engine (its
`mm`/`cm` collide with `length` there) but has no such conflict here — two
functions called deliberately are never ambiguous, so `measure` is a
first-class citizen on this path. Two kinds ship no micro path at all:

| Excluded | Why |
| --- | --- |
| `money` | Its unit ratios are functions reading an injected, live rate table. A path with no engine has nowhere to inject one, and a hard-coded FX table would be worse than no feature. |
| `datetime` | An opaque kind — its "units" are IANA zones, recognised by `chrono-node`. Nothing here applies. |

Every kind's wrappers follow one naming scheme, so the table below reads the
same regardless of which kind you import:

| Wrapper | Delegates to | Returns |
| --- | --- | --- |
| `parseX(input, opts?)` | `parse` | `Parsed<U>` |
| `isX(input, opts?)` | `is` | `boolean` |
| `addX(a, b, opts?)` · `subX(a, b, opts?)` | `add` · `sub` | `Parsed<U>` |
| `scaleX(a, factor, opts?)` | `scale` | `Parsed<U>` |
| `negateX(a, opts?)` | `negate` | `Parsed<U>` |
| `toX(a, unit, opts?)` | `convert` | `number \| undefined` |
| `asX(a, unit, opts?)` | `as` | `Parsed<U>` |
| `equalsX(a, b, epsilon?, opts?)` | `equals` | `boolean` |
| `compareX(a, b, opts?)` | `compare` | `-1 \| 0 \| 1 \| undefined` |
| `formatX(ok)` | `format` | `string` |
| `patternForX(opts?)` | `patternFor` | `string` |

`temperature`'s package contributes two kinds — the affine reading and its
ratio-only delta — so it exports `diffTemperature` with no `addTemperature`,
and a full ratio surface (`addTempDelta`, `subTempDelta`, …) for the delta.
That asymmetry is the kind model, not an omission: see
[Value classes](/api/value-classes#affine-kinds).

## `parse` / `is`

```ts
function parse<U extends string>(
  table: UnitTable<U>,
  input: string,
  opts?: ParseOptions<U>,
): Parsed<U>;

function is<U extends string>(
  table: UnitTable<U>,
  input: string,
  opts?: ParseOptions<U>,
): boolean;
```

### Grammar

```
value    := ws? sign? digits ("." digits)? exponent? ws? unit? ws?
sign     := "+" | "-"
digits   := [0-9]+
exponent := ("e" | "E") sign? digits
unit     := [\p{L}\p{N}%°]+
```

No thousands separators, no locale decimal comma, no expressions — those need
`Intl` and a solver, which is the engine's job.

### `strict` vs `loose`

`mode` defaults to `"loose"`. The complete difference, transcribed from a
table-driven test so a change to either mode has to argue with the suite:

| Input | `strict` | `loose` | Note |
| --- | --- | --- | --- |
| `30deg` | ok | ok | |
| `30 deg` | ok | ok | inner space always allowed |
| `-30.5deg`, `+30deg`, `1e3deg` | ok | ok | |
| `  30deg  ` | `trailing` | ok | loose trims |
| `30DEG`, `30Deg` | `unknown-unit` | ok | loose lowercases |
| `30` | `missing-unit` | ok iff `defaultUnit` set, else `missing-unit` | |
| `30,5deg` | `nan` | `nan` | locale decimals are engine-only |
| `30smth` | `unknown-unit` | `unknown-unit` | |
| `30 deg extra` | `trailing` | `trailing` | |
| `` / `   ` | `empty` | `empty` | |

`strict` is `loose` minus trimming, minus lowercasing, minus the bare-number
fallback — about thirty bytes of difference, and a meaningful contract:
`strict` accepts exactly what `format()` emits, so
`parse(format(x), { mode: "strict" })` is a real round-trip test.

`opts.unit` is orthogonal to `mode`: it turns any *other* valid unit into
`wrong-unit`, and leaves a word nobody knows `unknown-unit` rather than
loosening into it. `parseAngle(v, { unit: "deg" })` is the "this field is
degrees, full stop" case.

### Errors

```ts
type ErrCode =
  | "empty"          // "" or whitespace only
  | "nan"            // no number could be read
  | "missing-unit"   // a number was read, no unit followed, no defaultUnit
  | "unknown-unit"   // the unit word is not an alias of this table
  | "wrong-unit"     // opts.unit was set and the input named a different unit
  | "trailing";      // input continued past the unit

type Err = { readonly ok: false; readonly code: ErrCode; readonly input: string };
```

`Err.input` is the offending text exactly as given, untrimmed — a caller
quoting it in a message does not have to re-derive what the user typed.

```ts
import { parseAngle } from "@smartput/angle/validate";

parseAngle("");            // { ok: false, code: "empty", input: "" }
parseAngle("deg");         // { ok: false, code: "nan", input: "deg" }
parseAngle("30");          // { ok: false, code: "missing-unit", input: "30" }
parseAngle("30smth");      // { ok: false, code: "unknown-unit", input: "30smth" }
parseAngle("30rad", { unit: "deg" }); // { ok: false, code: "wrong-unit", input: "30rad" }
parseAngle("30 deg extra"); // { ok: false, code: "trailing", input: "30 deg extra" }
```

### A successful parse

```ts
type Ok<U extends string> = {
  readonly ok: true;
  readonly value: number;
  readonly unit: U;
  readonly raw: string; // the number exactly as authored, for Decimal handoff
};
```

```ts
parseAngle("30 DEG"); // { ok: true, value: 30, unit: "deg", raw: "30" }
```

`raw` is not `String(value)` — it is the substring `parse` matched, before
`Number()` rounded it to a double. `new Decimal(ok.raw)` recovers digits
`ok.value` already lost. See
[the precision boundary](/api/value-classes#the-precision-boundary).

### `resolve` — the fuzzy seam

```ts
resolve?: (word: string, table: UnitTable<U>) => U | undefined;
```

Consulted only after the table's own alias lookup misses, so an absent
`resolve` costs the happy path one `undefined` check. Nothing consumes this
today — a generic fuzzy matcher over `Object.keys(table.alias)` is planned,
unscheduled, and will need no change here when it lands.

## Operations

```ts
type Input<U extends string> = string | Ok<U>;

function add<U extends string>(t: UnitTable<U>, a: Input<U>, b: Input<U>, opts?: ParseOptions<U>): Parsed<U>;
function sub<U extends string>(t: UnitTable<U>, a: Input<U>, b: Input<U>, opts?: ParseOptions<U>): Parsed<U>;
function scale<U extends string>(t: UnitTable<U>, a: Input<U>, factor: number, opts?: ParseOptions<U>): Parsed<U>;
function negate<U extends string>(t: UnitTable<U>, a: Input<U>, opts?: ParseOptions<U>): Parsed<U>;
function convert<U extends string>(t: UnitTable<U>, a: Input<U>, to: U, opts?: ParseOptions<U>): number | undefined;
function as<U extends string>(t: UnitTable<U>, a: Input<U>, to: U, opts?: ParseOptions<U>): Parsed<U>;
function equals<U extends string>(t: UnitTable<U>, a: Input<U>, b: Input<U>, epsilon?: number, opts?: ParseOptions<U>): boolean;
function compare<U extends string>(t: UnitTable<U>, a: Input<U>, b: Input<U>, opts?: ParseOptions<U>): -1 | 0 | 1 | undefined;
function format<U extends string>(t: UnitTable<U>, a: Ok<U>): string;
```

```ts
import { addAngle, compareAngle, formatAngle, toAngle } from "@smartput/angle/validate";

addAngle("30deg", "15deg"); // { ok: true, value: 45, unit: "deg" }
addAngle("1turn", "180deg"); // { ok: true, value: 1.5, unit: "turn" } — left operand's unit wins
addAngle("30smth", "15deg"); // { ok: false, code: "unknown-unit", input: "30smth" }
toAngle("30deg", "rad"); // 0.5235987755982988
compareAngle("1turn", "180deg"); // 1
compareAngle("180deg", "30smth"); // undefined — not false, not thrown
```

Behaviour, all deliberate:

- **The left operand's unit wins**, matching the engine's documented rule:
  `add(T, "1kg", "500g")` is `1.5 kg`, not `1500 g`. Arithmetic runs in
  canonical units either way.
- **Strings are accepted and parsed internally.** `addAngle("30deg", "15deg")`
  needs no prior `parseAngle` call. Importing an op therefore pulls `parse`;
  importing only `parse` does not pull the ops.
- **Same-unit arithmetic and same-unit rebasing skip the canonical round
  trip.** `sub(T, "30deg", "15deg")` is exactly `15`, never
  `14.999999999999998` — a ratio that divides out on paper does not divide
  out in binary floating point, so the shared-unit case is special-cased to
  stay exact.
- **Errors short-circuit.** The first failing operand wins and carries its
  own `input`, so a message names the operand that broke rather than the
  whole call.
- **`compare` and `convert` return `undefined`** on bad input, and `equals`
  returns `false`, rather than a sentinel number — none of the three can
  return `Err` without changing the type a caller actually wants back.
- **No cross-kind ops.** `length / duration → speed` needs a registry and an
  `OpSignature` table; that is the engine, not this package.

`format` is compact, not pretty — `"30deg"`, never `"30 degrees"` — because
round-tripping through `parse` in `strict` mode is this path's contract.
Locale-aware formatting is the engine's job.

## `patternFor`

```ts
function patternFor<U extends string>(
  table: UnitTable<U>,
  opts?: { mode?: "strict" | "loose" },
): string;
```

A regex *source* string — an HTML `pattern` attribute value — covering the
same grammar `parse` accepts, so a form gets native, no-JS validation and a
free `inputmode` hint.

```ts
import { patternForPercent } from "@smartput/percent/validate";

patternForPercent({ mode: "strict" });
// "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)? ?(?:percents|percent|pcts|pct|%)"

patternForPercent();
// "\\s*[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)? ?(?:[pP][eE][rR][cC][eE][nN][tT][sS]|…)\\s*"
```

An HTML `pattern` attribute takes no flags, so loose mode widens each cased
letter of an alias to a two-member class (`[dD][eE][gG]`) rather than listing
`deg|DEG` — the latter would reject `30Deg`, which loose `parse` accepts, and
a pattern that disagreed with its own parser would be worse than none.

One deliberate narrowing in both modes: the unit is always required. Loose
`parse` accepts a bare number when `defaultUnit` is set, and a table alone
cannot know whether it was — a pattern that guessed yes would pass `"30"`
through native validation on a field whose parser then rejects it, which is
the worse of the two failures.

This is a separate export from `parse` so a caller who never renders a form
does not ship a regex builder.

## `createValueClass`

```ts
function createValueClass<U extends string>(
  table: UnitTable<U>,
  kind: string,
  opts?: { delta?: () => ValueClass<U> },
): ValueClass<U>;
```

One factory call builds a whole class — `@smartput/angle/class` is
`export const Angle = /*#__PURE__*/ createValueClass(ANGLE_UNITS, "angle");`
and nothing else. Full surface, immutability guarantees, the affine
`delta` option, and the bridge to the engine's `Quantity` classes are all in
[Value classes](/api/value-classes).

## `ValidationError`

```ts
class ValidationError extends Error {
  readonly code: ErrCode;
  readonly input: string;
}
```

Thrown by class methods (`Angle.parse`, never `Angle.tryParse`) — the class
surface throws, the free functions return `Err`, and V4 in the spec states
why: threading `Ok | Err` through `a.add(b).sub(c)` is miserable, and
`try`/`catch` in a keystroke validation loop is worse.

```ts
import { Angle } from "@smartput/angle/class";
import { ValidationError } from "@smartput/shared";

try {
  Angle.parse("30smth");
} catch (e) {
  if (e instanceof ValidationError) {
    e.code; // "unknown-unit"
    e.input; // "30smth"
  }
}
```

Deliberately **not** a subclass of core's `SmartputError` — importing core
here would pull `decimal.js` into a budget measured in hundreds of bytes.
Same `name` / `code` / `input` shape, no dependency.

## Types

```ts
type Parsed<U extends string> = Ok<U> | Err;

/** Anything an operation accepts in place of an already-parsed value. */
type Input<U extends string> = string | Ok<U>;

/** Context a dynamic ratio reads. `dpi` is the only member, for `measure`'s `px`. */
type Ctx = { readonly dpi?: number };

interface UnitTable<U extends string> {
  readonly canonical: U;
  readonly ratio: Readonly<Record<U, string | ((ctx: Ctx) => number)>>;
  /** Affine kinds only. `canonical = (v + offset) * ratio`. */
  readonly offset?: Readonly<Partial<Record<U, string>>>;
  /** Lowercase alias -> unit key. Flat, because that is what the parser reads. */
  readonly alias: Readonly<Record<string, U>>;
}

interface ParseOptions<U extends string> {
  /** Default "loose". See strict vs loose above. */
  mode?: "strict" | "loose";
  /** Require exactly this unit; anything else is "wrong-unit". */
  unit?: U;
  /** Loose mode only: a bare number lands on this unit. */
  defaultUnit?: U;
  ctx?: Ctx;
  /** Consulted only after the table's own alias lookup misses. */
  resolve?: (word: string, table: UnitTable<U>) => U | undefined;
}
```

Ratios and offsets are decimal **strings**, not `number`s: `angle` guards a
30-digit π against float drift, and a table shared between this path and the
engine cannot be floats without breaking that. This path does `Number(r)`;
the engine path does `new Decimal(r)`. A ratio may instead be a function of
`Ctx` — `measure`'s `px` is `1 / (ctx.dpi ?? 96)` — which is how a dynamic,
document-relative unit reaches a table that is otherwise a plain object.

## See also

- [Validating without the engine](/packages/shared) — the guide, the
  three-door table, when to reach for which.
- [Value classes](/api/value-classes) — `createValueClass`'s full output and
  the `Quantity` bridge.
- [Kinds and units](/guide/kinds) — which kinds ship a micro path.

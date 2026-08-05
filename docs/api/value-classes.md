---
title: Value classes
description: The immutable per-kind classes from createValueClass, and how they bridge to the engine's Quantity.
---

# Value classes

App code holding a value rarely wants a `parseX`/`Ok`/`Err` triple at every
call site — it wants an object. `createValueClass` builds one immutable class
per kind, and every `@smartput/<kind>/class` subpath is a single call to it:

```ts
// packages/angle/src/class.ts
import { createValueClass } from "@smartput/validate";
import { ANGLE_UNITS } from "./units";

export const Angle = /*#__PURE__*/ createValueClass(ANGLE_UNITS, "angle");
```

```ts
import { Angle } from "@smartput/angle/class";

const a = Angle.parse("30deg");
const b = a.add(new Angle(30, "deg"));

a.toString(); // "30deg" — a is untouched
b.toString(); // "60deg"
b.to("rad"); // 1.0471975511965976
b.as("rad"); // Angle { value: 1.0471975511965976, unit: "rad" }
a < b; // true — valueOf() returns the canonical magnitude
```

One implementation for all thirteen kinds — the same relationship
[`createFacade`](/api/facade) has to the engine's `Quantity` classes, with a
`number` where `Quantity` holds a `Decimal`. See
[the two class families](#the-quantity-bridge) for how they interoperate.

## `createValueClass`

```ts
function createValueClass<U extends string>(
  table: UnitTable<U>,
  kind: string,
  opts?: { delta?: () => ValueClass<U> },
): ValueClass<U>;
```

Which methods the result has is decided by the table, exactly as
`createFacade` decides it: a ratio table gets `add`/`sub`/`scale`/`negate`; a
table with `offset` (`temperature`) gets `diff` instead, and no product or sum
— see [Affine kinds](#affine-kinds) for the one exception. `opts.delta` is a
thunk rather than a class reference so an affine kind and its delta kind can
refer to each other from the same module without a circular import: by the
time the thunk is *called*, both classes exist.

## Surface

```ts
interface ValueClass<U extends string> {
  new (value: number | string, unit: U): ValueInstance<U>;
  parse(input: string, opts?: ParseOptions<U>): ValueInstance<U>;   // throws ValidationError
  tryParse(input: string, opts?: ParseOptions<U>): ValueInstance<U> | Err;
  from(input: Input<U> | ValueInstance<U>): ValueInstance<U>;       // throws ValidationError
  readonly kind: string;
  readonly canonical: U;
  readonly units: readonly U[];
}

interface ValueInstance<U extends string> {
  readonly value: number;
  readonly unit: U;

  to(unit: U): number;
  as(unit: U): ValueInstance<U>;

  /** Ratio kinds only; absent on an affine kind. */
  add?(other: Input<U> | ValueInstance<U>): ValueInstance<U>;
  sub?(other: Input<U> | ValueInstance<U>): ValueInstance<U>;
  scale?(factor: number): ValueInstance<U>;
  negate?(): ValueInstance<U>;

  /** Affine kinds only. Returns an instance of the paired delta class. */
  diff?(other: Input<U> | ValueInstance<U>): ValueInstance<U>;

  equals(other: Input<U> | ValueInstance<U>, epsilon?: number): boolean;
  compare(other: Input<U> | ValueInstance<U>): -1 | 0 | 1;

  toString(): string;                       // "30deg"
  toJSON(): { value: number; unit: U };
  valueOf(): number;                        // the canonical magnitude
}
```

The optional members are the point of the shape: an `Angle` has no `.diff()`
and a `Temperature` has no `.scale()`, so the wrong call is a type error, not
a runtime surprise.

```ts
const a = Angle.parse("180deg");

a.to("rad"); // 3.141592653589793
a.as("rad").unit; // "rad"
a.equals("0.5turn"); // true
a.compare("0.25turn"); // 1
a.equals(new Angle(0.5, "turn")); // true — an instance works as an operand too
```

`equals`/`compare`/`add`/`sub` all accept a raw string, an already-parsed
`Ok<U>`, or another instance of the class — anything `Input<U> |
ValueInstance<U>` — so `a.add("15deg")` and `a.add(new Angle(15, "deg"))` are
both fine.

## Immutability

- `Object.freeze(this)` at the end of the constructor. `value` and `unit` are
  own, frozen properties — `readonly` in TypeScript **and** frozen at
  runtime, because a `readonly` that exists only at compile time is a
  comment.
- Every method returns a new instance; none returns `this`.
- Methods live on the prototype, which the constructor does not touch, so
  they stay callable on a frozen instance.

```ts
const a = Angle.parse("30deg");

Object.isFrozen(a); // true
(a as { value: number }).value = 99; // throws TypeError in strict mode
Object.isSealed(a); // true — a new property throws too

const b = a.add("15deg");
a.value; // 30 — untouched
b !== a; // true — every operation returns a fresh instance
```

## Errors

Class methods **throw** [`ValidationError`](/api/validate#validationerror);
the free functions in `@smartput/validate` return `Err` instead — two
algebras, each idiomatic for its caller. `tryParse` is the escape hatch for a
caller that wants the class surface without a `try`/`catch` in a hot loop:

```ts
Angle.parse("30smth"); // throws ValidationError { code: "unknown-unit", input: "30smth" }
Angle.tryParse("30smth"); // { ok: false, code: "unknown-unit", input: "30smth" }
Angle.tryParse("30deg"); // an Angle instance
```

## Affine kinds

`temperature` declares `offset`, so its class has `diff` and no
`add`/`sub`/`scale`/`negate` — `20°C × 2` has no meaning, and an *absent*
method is a type error rather than a throwing one pretending it might work.
`tempdelta` is an ordinary ratio class over the same units, with the full
arithmetic surface and no `diff`.

```ts
import { TempDelta, Temperature } from "@smartput/temperature/class";

Temperature.parse("30c").diff(Temperature.parse("20c")); // TempDelta { value: 10, unit: "c" }
TempDelta.parse("10c").add(TempDelta.parse("5c")); // TempDelta { value: 15, unit: "c" }
Temperature.parse("212f").diff("32f").value; // 100 — a hundred-degree difference, never the offset read back
```

`temperature.add(TempDelta)` is the one exception to "no sum" — a reading
plus a *difference* is the one affine addition that means something, so
`@smartput/temperature/class` patches it onto the prototype after
`createValueClass` runs, rather than the factory generating it itself (the
factory's own `opts.delta` only wires up `diff`). Both classes live in the
same package, so there is no circular import:

```ts
Temperature.parse("30c").add(TempDelta.parse("5c")); // Temperature { value: 35, unit: "c" }

// The reading keeps its own unit: 86°F + 5°C of warming is 95°F, not 35 of anything.
Temperature.parse("86f").add("5c").value; // ≈ 95

// And a delta keeps its own scale: 9°F of warming is 5°C of warming.
Temperature.parse("20c").add(TempDelta.parse("9f")).value; // ≈ 25
```

`diff` on an affine class with no delta bound (`createValueClass(table,
"temperature")`, no `opts.delta`) throws `ValidationError` rather than
returning something half-meaningful.

## `@smartput/kinds/class` — the barrel

Every built-in kind's class, re-exported from one module:

```ts
import { Angle, Length, Number as Num } from "@smartput/kinds/class";
```

Not the byte-safe default — the same warning as
[the `/validate` barrel](/api/validate#coverage) applies, for the same
reason: it shakes to one kind's cost only as well as your bundler follows
re-exports and honours `/*#__PURE__*/`. Reach for the per-kind subpath in
anything shipped to a browser.

`Number` shadows the JS global when imported bare — the class is named for
its kind, not defensively renamed — so prefer `import { Number as Num }` or
the `@smartput/number/class` subpath if the shadowing bothers you.

`measure` is exported here even though it is absent from the engine's
`BUILTIN_KINDS`: the exclusion there exists because its `mm`/`cm` aliases
collide with `length` inside one shared registry, and these classes share no
registry — holding a `Measure` and a `Length` at once is not ambiguous.

## The `Quantity` bridge

Two class families exist and are deliberately not merged — merging would put
`Decimal` in a bundle that exists to not have it:

| | `@smartput/angle/class` → `Angle` | `createFacades()` → `Quantity` |
| --- | --- | --- |
| numbers | JS `number` | `Decimal` |
| `toString()` | `"30deg"` | `"30 degrees"`, locale-aware |
| cross-kind ops | none | via a registry + `OpSignature` |
| locale | none | full |
| errors | throws `ValidationError` | throws `SmartputError` subclasses |
| measured cost (`angle`) | 4218 B / 1759 B gzip, minified | engine-weight |

They interoperate, but the two directions are not symmetric.

**Micro → engine works directly**, because `Quantity.from` already accepts
anything shaped like `{ value, unit }`, and `QuantitySnapshot.value` widened
from `string` to `string | number` to let a `number` through without a
`String()` at the call site:

```ts
import { Angle } from "@smartput/angle/class";
import { createFacades } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";

const { angle: Quantity } = createFacades({ kinds: BUILTIN_KINDS, locale: en });

const q = Quantity.from(Angle.parse("30deg"));
q.unit; // "deg"
q.value.toString(); // "30" — a Decimal now
```

**Engine → micro goes through the compact string, not a snapshot.**
`ValueClass.from` takes `Input<U> = string | Ok<U>`, never a `{ value, unit }`
object, so `Angle.from(quantity)` does not type-check as written — the class
factory's `from` was not widened, only `QuantitySnapshot`'s. The round trip is
one call to `toString`-shaped input instead:

```ts
const back = Angle.from(`${q.value.toFixed()}${q.unit}`);
back.value; // 30
back.unit; // "deg"
```

A `ValueInstance` also satisfies `QuantitySnapshot` structurally without any
conversion — the assignment alone is the proof:

```ts
import type { QuantitySnapshot } from "@smartput/core";

const snapshot: QuantitySnapshot = Angle.parse("1.5rad"); // compiles
snapshot.value; // 1.5 — still a number; toJSON() is what narrows to a string
```

### The precision boundary

Crossing from `Quantity` to a value class narrows `Decimal` to a JS `number`
and can lose digits — a double holds about 15–17 significant figures,
`Decimal` holds as many as the engine is configured for. `Ok.raw` — and
`ValueInstance`'s own construction from a parsed string — is what makes the
*reverse* crossing lossless, because it is the original text, not a rounding
of it:

```ts
import { Decimal } from "@smartput/core";
import { parseAngle } from "@smartput/angle/validate";

const r = parseAngle("0.12345678901234567890deg");
if (r.ok) {
  r.value; // 0.12345678901234568   — truncated to a double already
  new Decimal(r.value).toString(); // "0.12345678901234568" — the loss is baked in
  new Decimal(r.raw).toString(); // "0.1234567890123456789" — raw kept every digit
}
```

`toJSON()` on a value class narrows back to a string for the same reason
`Quantity.toJSON()` does — a round-trip through `JSON.stringify` should not
be where precision quietly disappears:

```ts
const json = Quantity.from(Angle.parse("30deg")).toJSON();
typeof json.value; // "string"
```

## Per-kind classes

Every ratio kind's class lives at `@smartput/<kind>/class`, named for the
kind (`Angle`, `Length`, `Temperature`, …). See the validate column in
[Kinds and units](/guide/kinds#the-built-in-kinds) for the full list and which
two kinds do not ship one.

## See also

- [`@smartput/validate`](/api/validate) — `createValueClass`'s dependencies:
  `parse`, the operation algebra, `ValidationError`.
- [Validating without the engine](/guide/validating) — the three-door table
  and when to reach for a class instead of the free functions.
- [`createFacade`](/api/facade) — the engine-side `Quantity` this bridges to.

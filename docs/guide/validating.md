---
title: Validating without the engine
description: The micro path for one value — parse, convert, compare and hold it, at a fraction of the engine's weight.
---

# Validating without the engine

`createEngine()` is the right door for an expression: locales, ambiguity,
`Decimal`, a solver. It is the wrong door for an HTML input that just needs to
know whether `"30deg"` is a valid angle. Building a registry and a Pratt parser
to answer a yes/no question a regex could answer is why people write the regex
— and then write a second one for the unit they forgot, and a conversion that
is off by 180/π.

Every ratio kind ships a second, engine-free door for exactly that question.
No registry, no locale, no `decimal.js` — a parser, a set of operation
functions, and an immutable class, each on its own subpath, each paying only
for what it imports.

```ts
import { isAngle, parseAngle } from "@smartput/angle/validate";

isAngle("30deg"); // true
isAngle("30smth"); // false
parseAngle("30smth"); // { ok: false, code: "unknown-unit", input: "30smth" }
```

## Three doors, not one

| Door | Entry | Numbers | Measured (angle) | For |
| --- | --- | --- | --- | --- |
| **Micro — functions** | `@smartput/angle/validate` | JS `number` | 1270 B / 722 B gzip | HTML inputs, guards, coercion |
| **Micro — class** | `@smartput/angle/class` | JS `number` | 4218 B / 1759 B gzip | app code holding a value |
| **Engine** | `createEngine()` | `Decimal` | engine-weight | expressions, locales, ambiguity |

They interoperate — see [the `Quantity` bridge](/api/value-classes#the-quantity-bridge)
— but they are not merged. Merging would put `Decimal` in the 1.3 KB bundle,
which defeats the point of having it.

::: tip These are measured bytes, not budgets
`scripts/check-size.ts` builds each entry with `bun build --minify`, measures
raw and gzip, and fails `bun run check` if either grows. The figures above are
`angle`'s row today, not an aspiration.
:::

## The micro-path functions

Every kind's `/validate` subpath exports a `parseX`, an `isX`, and the full
free-function algebra — no factory closures, so a bundler that follows
re-exports drops everything you did not import.

```ts
import { addAngle, parseAngle, toAngle } from "@smartput/angle/validate";

parseAngle("30 DEG"); // { ok: true, value: 30, unit: "deg", raw: "30" } — loose lowercases
addAngle("30deg", "15deg"); // { ok: true, value: 45, unit: "deg" }
toAngle("30deg", "rad"); // 0.5235987755982988
```

`parse` returns `Ok | Err` rather than throwing, so the whole algebra
short-circuits on the first bad operand:

```ts
addAngle("30smth", "15deg");
// { ok: false, code: "unknown-unit", input: "30smth" } — names the operand that broke
```

Strings are accepted directly — `addAngle` parses both operands internally —
so importing an op pulls `parse`, and importing only `parse` does not pull the
ops. See [`@smartput/shared`](/api/validate) for the complete surface,
including the six `ErrCode`s and the full `strict`/`loose` table.

## The micro-path class

```ts
import { Angle } from "@smartput/angle/class";

const a = Angle.parse("30deg");
const b = a.add(new Angle(30, "deg"));

a.toString(); // "30deg" — a is untouched
b.toString(); // "60deg"
b.to("rad"); // 1.0471975511965976
a < b; // true — valueOf() returns the canonical magnitude
```

Instances are frozen; every method returns a new one. `Angle.parse` throws
`ValidationError` on bad input; `Angle.tryParse` returns the `Err` instead, for
a keystroke loop that would rather not use `try`/`catch`. See
[Value classes](/api/value-classes) for the full surface, the affine
`temperature`/`tempdelta` pairing, and the precision boundary crossing into a
`Quantity`.

## Every kind at a glance

Every ratio kind — the twelve in
[the built-in kinds table](/guide/kinds#the-built-in-kinds), plus `measure` —
ships all three subpaths. `money` and `datetime` do not: see
[Kinds and units](/guide/kinds#the-built-in-kinds) for why.

The parser is shared, so the per-kind cost is that kind's table — from
`percent`'s single unit to `length`'s eight units and thirty-two aliases:

| Kind (`parse` only) | Minified | Gzip |
| --- | --- | --- |
| `percent` | 1000 B | 585 B |
| `number` | 1029 B | 595 B |
| `speed` | 1091 B | 626 B |
| `tempdelta` | 1115 B | 637 B |
| `temperature` | 1140 B | 658 B |
| `area` | 1181 B | 663 B |
| `volume` | 1206 B | 675 B |
| `mass` | 1216 B | 687 B |
| `duration` | 1242 B | 682 B |
| `angle` | 1270 B | 722 B |
| `measure` | 1396 B | 733 B |
| `datasize` | 1402 B | 720 B |
| `length` | 1408 B | 732 B |

The shared parser (883 B / 521 B) dominates every row above, which is why a
**second** kind is cheap: importing two kinds through the
`@smartput/kinds/validate` barrel measures 1270 B for one and 1389 B for two
— `percent`'s entire table costs 119 B once the parser is already paid for.
All twelve through the same barrel measure 4898 B, still less than four kinds'
worth of engine.

::: warning The barrel is not the byte-safe default
`@smartput/kinds/validate` shakes to one kind's cost under Bun's bundler — the
measurement above is proof, not a claim — but only as well as your bundler
follows re-exports. A per-kind subpath, `@smartput/angle/validate`, shakes to
that kind's table under any bundler because there is nothing else in the
module. Reach for the barrel in a Node script or when you genuinely want most
of the kinds; reach for the subpath in anything shipped to a browser.
:::

## `strict` vs `loose`

`loose`, the default, trims whitespace, lowercases the unit word, and lets a
bare number through when `defaultUnit` is set. `strict` does none of that — it
accepts exactly what `format()` emits, so `parse(format(x), { mode: "strict"
})` is a real round-trip test, not an approximation:

```ts
import { formatAngle, parseAngle } from "@smartput/angle/validate";

const ok = parseAngle("30.5deg");
if (ok.ok) {
  formatAngle(ok); // "30.5deg"
  parseAngle(formatAngle(ok), { mode: "strict" }); // equals ok
}
```

The complete strict/loose difference — every accepted and rejected form — is
one table in [the API reference](/api/validate#strict-vs-loose).

## Native validation, before any JavaScript runs

`patternFor` emits an HTML `pattern` attribute value covering the same
grammar `parse` accepts:

```ts
import { patternForPercent } from "@smartput/percent/validate";

patternForPercent({ mode: "strict" });
// "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)? ?(?:percents|percent|pcts|pct|%)"
```

Drop that into `<input pattern="…">` for native, no-JS validation and a free
`inputmode` hint, while `parseX` does the real check on submit. Binding an
`<input>` end to end — `bindInput`, React and Vue adapters — is a deferred
spec; `patternFor`, the typed `ErrCode`, and `Err.input` are what it will be
built on, and all three are available today.

## When to reach for which

- **A form field, a query-string coercion, a guard clause** — the functions.
  You want a yes/no and a typed reason, nothing else.
- **App code that holds a value and passes it around** — the class.
  Immutable, `Object.freeze`d, arithmetic and comparison built in, no parser
  import required at every call site.
- **An expression the user typed** — `createEngine()`. `"30deg + 15deg"` as a
  *string* needs a lexer and a solver; `addAngle("30deg", "15deg")` needs
  neither.

## Next

- [`@smartput/shared`](/api/validate) — the full parser, ops and `patternFor` surface.
- [Value classes](/api/value-classes) — the class surface and the `Quantity` bridge.
- [Kinds and units](/guide/kinds) — which kinds ship a micro path and why two do not.

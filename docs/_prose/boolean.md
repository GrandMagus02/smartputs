---
title: Comparison
description: `1000 mb = 1 gb` is true. Six operators, one boolean kind, and a tolerance you can predict.
---

# Comparison

```
1000 mb = 1 gb        → true
1 kg > 500 g          → true
5 > 3                 → true
1 kg + 500 g = 1.5 kg → true
tomorrow > today      → true
```

Six operators — `<` `<=` `>` `>=` `=` `!=` — plus the spellings people actually
type: `==` folds into `=`, and `<>`, `!=`, `≠` all fold into `!=`. `≥` and `≤`
work too. The folding happens in the lexer, so nothing downstream ever sees two
names for one operation.

## There is no unit-comparison rule

That is the part worth understanding. `1000 mb = 1 gb` does not work because
something knows how to compare megabytes to gigabytes. It works because both
operands resolve to `datasize` — the same unification that makes `1 kg + 500 g`
a kilogram and a half — and the comparison runs over canonical bytes.

Which means it works for every kind, including ones this repo has never seen:

```ts
engine.evaluate("2.54 cm = 25.4 mm").formatted;  // "true"
engine.evaluate("90 deg = 0.25 turn").formatted; // "true"
engine.evaluate("10 usd > 5 eur").formatted;     // "true", through the rate table
```

A kind gets its six signatures generated for it, beside the `+`/`-` pair it
already gets, the moment it is registered.

## Refusal is the same refusal

An operation is legal exactly when an `OpSignature` exists for `(op, leftKind,
rightKind)` — that rule has not moved, and comparison lives inside it:

```ts
engine.evaluate("10 kg > 5 h");  // DimensionMismatchError
engine.evaluate("10 kg + 5 h");  // DimensionMismatchError — same reason
engine.evaluate("1 kg = 500");   // DimensionMismatchError — 500 is a number
```

If two operands cannot be added they cannot be ordered either. And because
comparison is left-associative like everything else, a chain refuses itself:

```ts
engine.evaluate("1 < 2 < 3");  // (1 < 2) < 3 — no `< | boolean | number`
```

No chain rule had to be written. The op table already said it.

Ambiguity still resolves from context, exactly as it does in arithmetic — `m` is
metres and minutes until the other operand decides:

```ts
engine.evaluate("10 m > 5 h").formatted;   // "false" — ten minutes, five hours
engine.evaluate("10 m > 5 km").formatted;  // "false" — ten metres
```

## Precedence

Comparison binds looser than everything, conversion included:

```
1 kg in g > 500 g      →  (1 kg in g) > 500 g
1 kg + 500 g = 1.5 kg  →  (1 kg + 500 g) = 1.5 kg
```

## Tolerance

Core computes at 28 significant digits and displays at 26 — two guard digits.
Comparison uses the same 26, so the rule is one you can state without knowing
the implementation: **two values that print the same are the same.**

```ts
engine.evaluate("1 km / 3 * 3 = 1 km").formatted;  // "true"
```

A third of a kilometre does not terminate, so at full precision that is false —
true of the arithmetic and useless to whoever typed it. Turn the guard off when
you want the arithmetic:

```ts
const exact = createEngine({ locales: [en], kinds: BUILTIN_KINDS, comparePrecision: "exact" });
exact.evaluate("1 km / 3 * 3 = 1 km").formatted;   // "false"

// Or per call:
engine.evaluate("1 km / 3 * 3 = 1 km", { comparePrecision: "exact" });
```

The tolerance governs `<` and `>` as well as `=`. Otherwise two values a digit
apart could be neither equal, nor greater, nor less — a fourth outcome to a
three-way question.

## Reading the result

The result is a `Value` of kind `boolean`, whose canonical is `1` or `0` — a
`Value.canonical` is a `Decimal` and no kind opts out of that. `@smartput/boolean`
is where you get it back as a JavaScript boolean:

```ts
import { Bool, truthOf } from "@smartput/boolean";

const r = engine.evaluate("1000 mb = 1 gb");
r.formatted;            // "true"
truthOf(r.value);       // true
Bool.of(r.value).value; // true
```

`truthOf` answers `null` for a value that is not a comparison result, because
"this was false" and "this was not a comparison" are different answers and
`if (truthOf(x))` must not read the second as the first. `Bool.of` throws
instead, for a caller who already knows.

## Which kinds order

Every ratio kind, automatically — a magnitude on a line always orders.

Opaque kinds opt in with `ordered: true`, because an opaque kind's canonical is
whatever it chose. `datetime`, `date` and `time` opt in: theirs is an instant,
and ordering is the whole reason the scalar exists. `place` deliberately does
not — its canonical is a GeoNames feature id, so `kyiv > warsaw` would compare
database row numbers and answer with complete confidence about nothing.

```ts
defineKind({
  id: "version",
  value: { mode: "opaque", ordered: true, units: { semver: { aliases: [] } } },
});
```

`boolean` itself does not order, which is what makes the chained comparison
above fail rather than quietly compare truth values.

## Registering it

`boolean` is in `BUILTIN_KINDS`, so a default engine already has it. An engine
assembling kinds by hand needs it, or a comparison will evaluate and then fail
to format:

```ts
import { boolean } from "@smartput/boolean";
createEngine({ locales: [en], kinds: [number, mass, boolean] });
```

It claims no vocabulary. "true" and "false" are ordinary English words and the
alias index is global, so registering the kind cannot change how any existing
input reads.

---
title: Errors
description: Every error type, when it is raised, and what it carries.
---

# Errors

All errors extend `SmartputError` and carry `input` and `spans`, so a caller can
underline the offending token without re-parsing anything. Every span a caller
receives indexes **the string the caller passed in**, never the normalized text:
`Result.spans` and the spans on all four input errors are mapped back through
the analyzer chain before they leave.

`spans` is `[]` when the throw site had no place to point at, and that is a real
answer rather than a gap: `TooAmbiguousError` is about the size of the search
rather than about a token, `DivideByZeroError` and `CountQueryError` are about
what the whole expression means, and the registration errors describe your
wiring and have no user input at all. An empty `spans` is never a guess.

```ts
import { AmbiguityError, SmartputError } from "@smartput/core";

try {
  engine.evaluate(userInput);
} catch (error) {
  if (error instanceof AmbiguityError) showPicker(error.candidates);
  else if (error instanceof SmartputError) underline(error.spans);
  else throw error;
}
```

## The table

| Error | Raised when | Carries |
| --- | --- | --- |
| `UnitParseError` | a bare number where a unit is required; input that is not an expression | `input`, `kind` |
| `AmbiguityError` | `evaluate()`'s top two confidences are within `ambiguityEpsilon` and `tiebreak` is `"error"` | `candidates` |
| `NoCandidateError` | nothing in the registry matches a token | `token`, `nearest` |
| `DimensionMismatchError` | `5 kg + 3 km` — no matching op signature | `left`, `right`, `op`, `tried` |
| `TooAmbiguousError` | the assignment search exceeds `maxCandidates` | `count` |
| `KindConflictError` | registration: two kinds claim the same id or signature | both source ids |
| `UnknownKindError` | registration: a vocabulary names a kind, or a unit, the engine does not register | `pack` (the locale id), `kind`, `unit` |
| `LocaleMismatchError` | `composeLocale`: a vocabulary whose `locale` is not the language's `id` | `locale`, `vocabularyLocale`, `kind` |
| `VocabularyConflictError` | `composeLocale`: two vocabularies for one kind in one language | `locale`, `kind` |
| `KeywordConflictError` | registration: two installed languages read one spelling as two *different* connectives | `surface`, `keywords`, `locales` |
| `CountQueryError` | `hours in minute` — a count query whose answer would be less than one | `kind`, `unit`, `per`, `unitWord`, `perWord` |
| `DivideByZeroError` | explicit; wraps the `Decimal` throw | — |
| `MissingRateError` | an FX pair is absent from the snapshot, or no `rates` were supplied | `from`, `to`, `asOf` |
| `RateProviderError` | a rate provider's fetch failed or returned something unusable | `provider` |
| `RatesNotReadyError` | `LiveEngine.sync` was read before the first successful refresh | — |

The last three are defined in `@smartput/core` and raised from
[`@smartput/rate`](/api/rate), so one `catch (e) { if (e instanceof
SmartputError) … }` covers both packages.

### `DimensionMismatchError` names the operator, and every pair it tried

`op` is an `OpSymbol` or `"in"`, and never the string `"operation"` — a message
that will not say which operator failed is a message nobody can act on. `tried`
is every `(left, right)` pair the solver enumerated and found no signature for,
deduplicated, in enumeration order:

```
Cannot apply / to `10 kg` and `2 m`: no signature for mass / length or mass / duration
```

The old message named one pair — whichever the first failing assignment happened
to hold — so `10 kg / 2 m` reported *mass and duration* and read as a bug in the
message rather than as a fact about `m`. Both readings of `m` were tried; now
both are listed, and the quoted operands come from the spans, so the message
shows what the person typed rather than the kind ids it resolved to.

## Try them

<SpEvaluate
  model-value="10 zz"
  :examples="['10 zz', '10 m', '5 kg + 3 km', '1 kg +', 'nonsense', '1 km / 0', 'hours in minute']"
  hint="NoCandidateError suggests the nearest registered units rather than failing blankly." />

## Three rules worth relying on

**`explain()` never throws.** It used to let a `SmartputError` out, which made
the one API whose job is to say why an input failed unusable on exactly the
inputs that failed: a caller had to catch the error to discover that the
explanation it wanted did not exist. Every `SmartputError` is an outcome now.

```ts
const ex = engine.explain(userInput);
if (ex.outcome.status === "error") underline(ex.outcome.error.spans);
else show(ex.assignments);
```

```ts
outcome: { status: "ok" } | { status: "error"; error: SmartputError };
```

Anything that is *not* a `SmartputError` — a `TypeError` from a bug in a stage —
still propagates, because that is a defect in this library rather than a fact
about the input, and swallowing it would hide the one class of failure a caller
cannot act on.

The explanation is filled as far as the pipeline got, which is the point — an
explanation of a parse failure that lists no tokens explains nothing. `tokens`
holds everything that lexed, `rejections` holds every pair the solver refused,
and `assignments` is empty, because a failed input has no winning reading to
break down. Naming a locale the engine does not have is still thrown rather than
reported: that is your wiring, not the user's input.

**`Explanation.rejections`** lists every `(op, leftKind, rightKind)` the solver
enumerated and found no signature for, each with node ids and spans indexing
your string. It is *not* empty on success, and that is deliberate: `10 m + 5 h`
resolves as a duration **because** `+ | length | duration` was tried and
rejected, so hiding the rejected pairs would hide the reason the winner won.

**`suggest()` never throws on parse problems.** It returns `[]`, and the failure
is visible through `explain()`. That is what makes it the right entry point for
a live input.

Three errors are deliberately *not* swallowed, because none of them means "this
input has no interpretation": `MissingRateError` (a data problem — answering
`[]` would report "no results" where the truth is "no rate for JPY"), and the
registration errors — `KindConflictError`, `UnknownKindError`,
`LocaleMismatchError`, `VocabularyConflictError` and `KeywordConflictError` —
which describe your wiring rather than your user's input. Anything that is not a
`SmartputError` — a `TypeError` from a bug in the pipeline — keeps its stack
instead of masquerading as an empty result.

**Registration errors always throw at `createEngine()`** — or at
`composeLocale()`, one call earlier, for the two that are about wiring a
language to its vocabularies. Never lazily at parse time. A bad plugin fails on
boot, where the stack trace still points at the plugin, rather than on some
user's first keystroke.

## Ambiguity is not a parse failure

`AmbiguityError` means the engine understood the input and found more than one
equally good reading. The candidates are attached, so the usual handling is to
show them rather than to report a syntax problem:

<SpSuggest
  model-value="10 m"
  :examples="['10 m', '10 s', '10 d', '10 zz']"
  hint="Only `m` collides today — it is both length:m and duration:min. suggest() ranks the two instead of choosing; the unambiguous ones return a single result and the unknown one returns nothing." />

See [Ambiguity and weights](/guide/weights) for how to make one of them win
permanently.

---
title: Errors
description: Every error type, when it is raised, and what it carries.
---

# Errors

All errors extend `SmartputError` and carry `input` and `spans`, so a caller can
underline the offending token without re-parsing anything. `Result.spans`,
`AmbiguityError.spans` and `NoCandidateError.spans` all index the string the
caller passed in; spans on the remaining error types are relative to the
normalized text.

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
| `DimensionMismatchError` | `5 kg + 3 km` — no matching op signature | `left`, `right`, `op` |
| `TooAmbiguousError` | the assignment search exceeds `maxCandidates` | `count` |
| `KindConflictError` | registration: two kinds claim the same id or signature | both source ids |
| `UnknownKindError` | registration: a `LocalePack` contributes vocabulary for an unregistered kind | `pack`, `kind` |
| `DivideByZeroError` | explicit; wraps the `Decimal` throw | — |
| `MissingRateError` | an FX pair is absent from the snapshot, or no `rates` were supplied | `from`, `to`, `asOf` |
| `RateProviderError` | a rate provider's fetch failed or returned something unusable | `provider` |
| `RatesNotReadyError` | `LiveEngine.sync` was read before the first successful refresh | — |

The last three are defined in `@smartput/core` and raised from
[`@smartput/rate`](/api/rate), so one `catch (e) { if (e instanceof
SmartputError) … }` covers both packages.

## Try them

<SpEvaluate
  model-value="10 zz"
  :examples="['10 zz', '10 m', '5 kg + 3 km', '1 kg +', 'nonsense', '1 km / 0']"
  hint="NoCandidateError suggests the nearest registered units rather than failing blankly." />

## Two rules worth relying on

**`suggest()` never throws on parse problems.** It returns `[]`, and the failure
is visible through `explain()`. That is what makes it the right entry point for
a live input.

Three errors are deliberately *not* swallowed, because none of them means "this
input has no interpretation": `MissingRateError` (a data problem — answering
`[]` would report "no results" where the truth is "no rate for JPY"), and the
two registration errors `KindConflictError` and `UnknownKindError`, which
describe your wiring rather than your user's input. Anything that is not a
`SmartputError` — a `TypeError` from a bug in the pipeline — keeps its stack
instead of masquerading as an empty result.

**Registration errors always throw at `createEngine()`.** Never lazily at parse
time. A bad plugin fails on boot, where the stack trace still points at the
plugin, rather than on some user's first keystroke.

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

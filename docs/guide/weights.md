---
title: Ambiguity and weights
description: Four layers of additive weights, softmax confidence, and deterministic ties.
---

# Ambiguity and weights

`10 m` is genuinely ambiguous. `m` is a metre and `m` is a minute, and no amount
of parser cleverness settles it from the string alone. smartputs treats that as
a ranking problem rather than an error, and gives four independent parties a way
to influence the ranking.

## Selectors

A selector names a set of candidates. Three shapes, from narrow to broad:

```ts
type Selector =
  | `token:${string}`     // one surface form, any kind   "token:m"
  | `${KindId}:${string}` // one unit of one kind          "duration:min"
  | KindId;               // every unit of a kind          "length"

type Weights = Record<Selector, number>;
```

`token:` selectors match the **case-folded** surface form as typed, before the
analyzer chain runs.

## Weights are plain numbers and they add

Every selector that matches a candidate contributes. There is no precedence
table, no override semantics, no transform callbacks.

```ts
{ duration: 5, "duration:min": -20 }
// → min gets a net -15; every other duration unit gets +5
```

Positive favours, negative disfavours. This is the whole model, and it is chosen
precisely because it stays predictable when four layers compose:

| # | Layer | Set via | Purpose |
| --- | --- | --- | --- |
| 1 | `kind.prior` | `defineKind` | the author's default |
| 2 | `locale.weights` | `defineLocale` | locale conventions, e.g. `lb` in `en-GB` |
| 3 | `engine.weights` | `createEngine` | the integrator's override |
| 4 | `opts.weights` | `evaluate` / `suggest` | per-call adjustment |

A plugin author must be able to outrank a built-in, and the integrator must be
able to override the plugin. A single `0..1` prior allows neither.

<SpWeights />

## Scoring

```
raw(candidate)    = Σ matching selectors      // all four layers
                  + contextBonus              // a matching OpSignature exists for the sibling
                  + hintBonus                 // opts.kinds, or the coerce() target

score(assignment) = Σ raw over its candidates
confidence        = softmax(score over all consistent assignments)
```

`contextBonus` is why `10 m + 5 min` needs no configuration at all: the
`duration` reading of `m` has a sibling it can legally combine with, and the
`length` reading does not.

<SpExplain model-value="10 m + 5 min" :examples="['10 m', '10 m + 5 min', '10 m + 5 km']" />

Because raw scores are unbounded and confidence is their softmax,
`ambiguityEpsilon` always compares normalized values. Adding a weight changes
the ranking without changing what the epsilon means.

## When evaluate() refuses

`evaluate()` throws `AmbiguityError` when the top two confidences are within
`ambiguityEpsilon` (default `0.05`) and `tiebreak` is `"error"`.

```ts
engine.evaluate("10 m");
// AmbiguityError: "10 m" is ambiguous between duration:min, length:m
//   candidates: [
//     { kind: "duration", unit: "min", confidence: 0.5 },
//     { kind: "length",   unit: "m",   confidence: 0.5 } ]
```

This is deliberate. A strict call that silently picks one of two equally-scored
readings is worse than one that says it cannot tell.

## Ties

After all four layers, exactly equal scores must still resolve the same way on
every run — otherwise output varies between processes.

```ts
tiebreak?: "error" | "first";
// "error" (default) → AmbiguityError, listing candidates
// "first"           → registration order, then kind id lexicographic
```

Never random, never map iteration order, never a registration accident.
Identical input, engine options and clock always produce identical ranking.

## Introspection

Because weights are a sum, `explain()` only has to list the contributions — no
provenance tracking through the solver.

```
token "m" → duration:min
  duration          +5    (locale)
  duration:min     -15    (engine)
  contextBonus     +30    (sibling operand is duration)
  ─────────────────────
  raw               20    confidence 0.71
```

`explain()` is required, not a nicety: a scored solver is unusable without a way
to inspect why it chose, and it is the debugging surface plugin authors get.

## Hard filters vs. weights

`opts.kinds` is not a weight — it is a hard filter. Candidates outside the set
are dropped before scoring, which is a different operation from being ranked
last.

```ts
engine.evaluate("10 m", { kinds: ["length"] });     // hard: duration cannot win
engine.evaluate("10 m", { weights: { length: 99 } }); // soft: duration could still win
```

`coerce(kind, input)` injects the same hard constraint at solve time rather than
running a second code path, so type-directed parsing shares every solver
behaviour above.

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

A selector names a set of candidates. Five shapes:

```ts
type Selector =
  | `token:${string}`     // one surface form, any kind    "token:m"
  | `${KindId}:${string}` // one unit of one kind          "duration:min"
  | KindId                // every unit of a kind          "length"
  | `locale:${string}`    // every spelling one language owns   "locale:uk"
  | `grammar:${string}`;  // every number one language's digits produce "grammar:de"

type Weights = Record<Selector, number>;
```

`token:` selectors match the **case-folded** surface form as typed, before the
analyzer chain runs.

`locale:` matches on the language that **listed the spelling**, which is
narrower than "the language you are reading in". An alias is tagged with the
first installed language that lists it, so on a `[en, uk]` engine `kg` is an
`en` reading even though Ukrainian lists it too, and `кг` is the `uk` one:
`{ "locale:uk": 5 }` moves `5 кг` and never `5 kg`. Use it to prefer, or
disfavour, the spellings a language uniquely owns — not to break a tie between
two languages over one word.

### The grammar selector, for digits rather than words

`locale:` weights a *word*. `grammar:` weights a *number*, and it exists because
`1,000` is two different numbers depending on who typed it: a thousand in
English, one point nought in German. On an engine with more than one language
installed, the digits are a choice the solver has to make, exactly like `m`
being a metre or a minute — so they are scored the same way, over the same four
layers.

```ts
// An engine with both German and English installed. "1,000" is a thousand to
// one of them and one to the other; the weight says which.
engine.evaluate("1,000 kg", { weights: { "grammar:de": 5 } });  // 1 kilogram
```

One selector per **locale**, not per grammar, because a grammar is shared: `en`,
`ja` and `hi` all group with `,` and point with `.`, and `{ "grammar:ja": 5 }`
is meant to lift a language's digits rather than a punctuation convention. Every
locale that reads a run of digits that way gets a row, and the rows sum.

Two things do the ranking before any weight you write:

- **The engine's own layer carries `grammar:<format>` at 1** ([ruling
  R-A1](/guide/roadmap#the-second-pass-and-the-four-rulings-it-cost)). A bare
  `1,000` with no unit beside it keeps reading the way the engine's own language
  reads it, instead of becoming a coin flip that throws `AmbiguityError` on
  every thousand a user types.
- **A unit word beside the digits is worth +2**, charged once per number slot
  whose grammar agrees with the language that listed the unit. That is what
  makes `"1.000,5 kg"` read as German on an `[en, de]` engine without anybody
  configuring anything: `kg` is a word both languages list, but `1.000,5` is
  only a German number, and the two agree. A weight of 5 overturns both.

`explain()` lists the `grammar:` rows and the agreement bonus beside the unit
rows, so a surprising reading of a number is inspectable the same way a
surprising reading of a word is.

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
| 2 | `language.weights` | `defineLanguage` | language conventions, e.g. `lb` in `en-GB` |
| 3 | `engine.weights` | `createEngine` | the integrator's override |
| 4 | `opts.weights` | `evaluate` / `suggest` | per-call adjustment |

A plugin author must be able to outrank a built-in, and the integrator must be
able to override the plugin. A single `0..1` prior allows neither.

Layer 2 is **every installed language's** `weights`, merged, not just the one
the engine prints in. A language pack declaring weights is describing its own
vocabulary, and the engine reads that vocabulary whichever language it writes.

<SpWeights />

## Scoring

```
raw(candidate)    = Σ matching selectors      // all four layers
                  + contextBonus              // a matching OpSignature exists for the sibling
                  + hintBonus                 // opts.kinds, or the coerce() target
                  − 15 × editDistance         // only if the surface had to be corrected

raw(number)       = Σ matching `grammar:` selectors   // all four layers
                  + 2 per slot whose grammar agrees with a unit beside it

score(assignment) = Σ raw over its candidates and its number readings
confidence        = softmax(score over all consistent assignments)
```

An assignment chooses a unit for every word *and* a grammar for every run of
digits the installed languages disagree about, which is why the number line is
there. On a single-language engine there is nothing to disagree about, the
number term is always zero, and the sum is what it always was.

`contextBonus` is why `10 m + 5 min` needs no configuration at all: the
`duration` reading of `m` has a sibling it can legally combine with, and the
`length` reading does not.

<SpExplain model-value="10 m + 5 min" :examples="['10 m', '10 m + 5 min', '10 m + 5 km']" />

Because raw scores are unbounded and confidence is their softmax,
`ambiguityEpsilon` always compares normalized values. Adding a weight changes
the ranking without changing what the epsilon means.

## Reading through a typo

A misspelled unit used to be an error with a hint attached. It is now a reading
with a penalty attached, which is the same decision the rest of this page makes
about everything else: rank it, do not refuse it.

```ts
engine.evaluate("1 klogram").formatted; // "1 kilogram"
```

Three constraints hold it in place, and each of them is the feature rather than
a guard on it.

**The fuzzy pass runs only when the exact pass found nothing.** If any analyzed
form named a real alias, that is what was written, and a near miss on some other
word is not evidence against it — so a correction can never outrank a reading,
and no well-spelled input pays for the scan of the alias index that a correction
costs.

**The contribution is a term, not a multiplier.** `−15` per edit, carried under
the selector `fuzzy:<alias>`, summed with the prior and all four layers like
everything else. A corrected candidate has exactly one row more than its exact
twin and no other difference, so `weights: { "mass:kg": 10 }` applies to a
mistyped `kilogram` the way it applies to a well-typed one.

```
token "klogram" → mass:kg
  prior              0
  fuzzy:kilogram   -15    (one edit)
  analyzer           0
  contextBonus       0
  ─────────────────────
  raw              -15    confidence 1
```

Fifteen is half of `contextBonus`, and that is the trade it prices: a reading
corrected by one edit can still be believed when its sibling operand agrees on
kind — 30 for the agreement against 15 for the slip — while two edits plus an
agreeing sibling cancel exactly, which is where the engine has stopped reading
and started guessing.

**Confidence is not where the penalty shows.** The softmax normalizes whatever
it is given, so a corrected reading with no rival comes back at 1 exactly as an
exact one does. The charge is legible in `score` and in the `fuzzy:` row, and
`explain()` is how you see it. That is not a defect in either number: admission
is what a lone reading gets, and 15 decides contests.

Two limits are deliberately tighter than the suggestion machinery's:

| Limit | Value | Why |
| --- | --- | --- |
| shortest surface worth correcting | 5 characters | Below that the alias index is a symbol table. `kg`, `km`, `mg`, `kt` and `kb` all sit within an edit of `kgg`; naming the nearest is not reading it, and the answer that comes back would be a number in another dimension. |
| edits a *reading* may cross | 1 | Two is where `10 mobile` quietly becomes 16,093.44 metres. The `nearest` hint in `NoCandidateError` keeps its two, because a suggestion is read by a person who can see both words and say no. A reading is read by nobody. |

And a tie still refuses. Two words equally near are a coin toss, so `1 litrr` —
one substitution from both `litre` and `liter` — throws `NoCandidateError` with
both named, which is the honest answer and the one the writer can act on.

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

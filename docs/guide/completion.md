---
title: Completion
description: complete() ranks the units a half-typed fragment could still become.
---

# Completion

`suggest()` answers *what does this mean?*. `complete()` answers the question a
user is actually asking while still typing: *what could this word still become?*

```ts
engine.complete("30 ho");
// [ { alias: "hour", span: { start: 3, end: 5 }, text: "30 hours",
//     kind: "duration", unit: "h", score: 13 } ]
```

`text` is the **whole input rewritten**, not the unit word on its own, so the
value goes straight back into the input box. `span` is where the replacement
happened, for a caller that would rather splice the string itself.

<SpComplete
  model-value="30 ho"
  :examples="['30 ho', '5 kilog', '45 sec', '12 inc', '2 km in mil', '10 kg + 5 gram']"
  hint="Only the trailing fragment completes. Everything before it is copied through untouched, which is why the rewritten text stays evaluable." />

## Only the trailing fragment

An expression completes its last token and nothing else. `10 kg + 5 gram`
becomes `10 kg + 5 grams`; the `kg` is left exactly as typed. A fragment that is
not a word — a digit, a closing paren, an empty string — has nothing to complete
and returns `[]`.

`complete()` never throws. There is no input for which it is the wrong call.

## How rows are ranked

`score` is a sum of three terms, and the first of them is the same weight stack
that ranks readings:

| Term | What it expresses |
| --- | --- |
| `resolveWeight(...)` | the [four weight layers](/guide/weights) and the kind's `prior` — everything that already decides `m` means metres here |
| `prefixQuality(alias, typed)` | how much of the alias the user has already committed to. An exact alias beats a long word barely begun. |
| `scaleFit(count, typical)` | whether the number in front of the fragment falls in the band people actually type that unit in |

Bands are declared per unit as `typical: [min, max]` in the lexicon:

```ts
// packages/length/src/index.ts
mi: {
  aliases: ["mi", "mile"],
  symbol: "mi",
  display: { one: "mile", other: "miles" },
  typical: [0.1, 500],
}
```

The same row scores differently depending on the number in front of it:

```ts
engine.complete("2 mi")[0];   // → "2 miles",   score 13
engine.complete("600 mi")[0]; // → "600 miles", score 10
```

Three points, because 600 falls outside miles' band. Omitting a band scores
zero — the same as being out of one — so declaring a band is never a penalty,
which is what stops the honest kinds from being punished for supplying data.

## One row per unit

`mi` and `mile` are the same unit, and offering both would fill a six-row
dropdown with three answers. Rows are deduplicated per `(kind, unit)`, keeping
the highest-scoring alias — and on an exact tie, the alphabetically first, so
`millimetre` and `millimeter` resolve identically on every run.

## The insert text has to parse

Completion inserts the unit's `display` form for the plural category of the
number in front of it — `1 hour`, `2 hours`, `0.5 hours` — chosen through
`Intl.PluralRules` for the engine's locale.

That constrains what a kind may declare. A `display` form the parser would
reject is a dead end: the user accepts the row and the expression stops
evaluating. So several kinds declare none and let completion fall back to the
alias, which is already the form people type:

| Kind | Falls back because |
| --- | --- |
| `temperature` | "20 celsius degrees" is not what anyone writes; `20 c` is |
| `area`, `speed` | "square metres", "kilometres per hour" are multi-word — the lexer cannot take a two-word unit token |
| `percent` | the written form of the unit *is* the symbol |
| `money` (CAD, AUD) | "Canadian dollar" is two words, so those two insert the ISO code |

The corpus in `packages/core/corpus/en-complete.tsv` pins one row per unit and
asserts the inserted text, which is what keeps that rule from rotting.

## Options

```ts
interface CompleteOptions {
  kinds?: KindId[];   // hard filter, same meaning as EvalOptions.kinds
  weights?: Weights;  // per-call weight layer 4
  limit?: number;     // applied after ranking. Default 10
}
```

```ts
engine.complete("30 d", { kinds: ["duration"] }); // never offers degrees
```

## With money registered

Currencies compete for the same fragment as everything else, ranked by the same
sum. `30 d` offers days, then degrees, then dollars; `100 p` puts zlotys above
pounds; `1000 y` puts yen above yards.

<SpComplete
  with-money
  title="engine.complete(input) — money registered"
  model-value="30 d"
  :examples="['30 d', '5 e', '100 p', '20 u', '1000 y']"
  hint="Same call, one more kind registered. Completion has no currency-specific code path." />

## Next

- [`complete()` API reference](/api/complete) — the full return shape.
- [Ambiguity and weights](/guide/weights) — the ranking terms it inherits.

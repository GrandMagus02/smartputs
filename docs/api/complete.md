---
title: complete
description: Prefix completion over every registered unit, ranked by the weight stack.
---

# complete

```ts
complete(input: string, opts?: CompleteOptions): Completion[]
```

Ranks the units the input's trailing fragment could still become. It is a method
on the `Engine`, sharing its registry, locale and weights — there is no separate
completion index to keep in sync.

```ts
engine.complete("30 ho");
// [ { alias: "hour", span: { start: 3, end: 5 }, text: "30 hours",
//     kind: "duration", unit: "h", score: 13 } ]
```

<SpComplete
  model-value="30 ho"
  :examples="['30 ho', '5 kilog', '45 sec', '2 km in mil', '10 kg + 5 gram']" />

## Completion

```ts
interface Completion {
  /** The alias that matched, e.g. "hour". */
  alias: string;
  /** The fragment this replaces, as offsets into the original input. */
  span: Span;
  /** The whole input rewritten, ready to put back in the box. */
  text: string;
  kind: KindId;
  /** Registry unit key, e.g. "h". */
  unit: string;
  score: number;
}
```

`text` is the **whole input**, not the unit word: `complete("10 kg + 5 gram")`
returns `"10 kg + 5 grams"`, with everything before the fragment copied through
untouched. Accepting a row therefore never produces an input the engine cannot
then evaluate.

`span` is the replaced range, for a caller that would rather splice the string
itself — an editor holding a cursor position, say.

`alias` is what matched in the registry; `text` contains the *display* form for
the plural category of the count in front of the fragment, which is why `1 ho`
completes to `1 hour` and `30 ho` to `30 hours`.

## CompleteOptions

```ts
interface CompleteOptions {
  kinds?: KindId[];   // hard filter, identical in meaning to EvalOptions.kinds
  weights?: Weights;  // per-call weight layer 4
  limit?: number;     // applied after ranking. Default 10
}
```

```ts
engine.complete("30 d", { kinds: ["duration"] });     // "30 days" only
engine.complete("30 d", { weights: { angle: 100 } }); // degrees first
```

## Scoring

```
score = resolveWeight(kind, unit, surface, prior, layers)  // the four weight layers
      + prefixQuality(alias, fragment)
      + scaleFit(count, unit.typical)
```

| Constant | Value | Charged |
| --- | --- | --- |
| `EXACT_BONUS` | `10` | the fragment equals the alias |
| `LENGTH_PENALTY` | `1` | per character not yet typed |
| `SCALE_BONUS` | `3` | the count falls inside the unit's `typical` band |

All three are exported, so a caller reproducing the ranking elsewhere does not
have to guess them.

`scaleFit` never returns a negative number. A unit that declares a band is not
punished for being out of it relative to a unit that declares nothing —
otherwise supplying data would be a liability.

## Guarantees

**One row per `(kind, unit)`.** `mi` and `mile` are the same unit; the
higher-scoring alias wins, and an exact tie is broken by alias ascending, so the
ranking is identical on every run.

**Only the trailing fragment completes.** A fragment that is not a word — a
digit, a paren, whitespace, the empty string — yields `[]`.

**It never throws.** `complete()` is safe to call on every keystroke, including
on input `evaluate()` would reject.

## See also

- [Completion](/guide/completion) — the guide, including why some kinds declare no `display` forms.
- [Ambiguity and weights](/guide/weights) — the four layers `resolveWeight` sums.

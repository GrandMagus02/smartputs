---
title: Engine
description: evaluate, suggest, coerce, explain and complete.
---

# Engine

```ts
interface Engine {
  evaluate(input: string, opts?: EvalOptions): Result;
  suggest(input: string, opts?: EvalOptions): Result[];
  coerce(kind: KindId, input: string, opts?: EvalOptions): Value;
  explain(input: string, opts?: EvalOptions): Explanation;
  complete(input: string, opts?: CompleteOptions): Completion[];
}
```

Five entry points over one pipeline. The first four differ in what they do with
ambiguity, not in how they parse — `coerce()` injects a hard constraint into the
solver rather than running a second code path, so every solver behaviour is
shared. `complete()` answers a different question entirely, but ranks its
answers with the same weights.

## evaluate()

```ts
evaluate(input: string, opts?: EvalOptions): Result
```

Strict. Returns exactly one `Result`, or throws.

```ts
const result = engine.evaluate("1 kg + 500 g");

result.formatted; // "1.5 kilograms"
result.kind; // "mass"
result.value.canonical.toString(); // "1500"
result.value.unit; // "kg"
result.confidence; // 1
result.spans; // [{ start, end }, …] token → source offsets
result.meta.assumptions; // Assumption[]
```

Throws `AmbiguityError` when the top two confidences are within
`ambiguityEpsilon` — a strict call that silently picks one of two equally-scored
readings is worse than one that says it cannot tell.

<SpEvaluate />

## suggest()

```ts
suggest(input: string, opts?: EvalOptions): Result[]
```

Ranked by confidence, highest first. **Never throws on parse problems** — an
unparseable input is an empty array, and the failure is visible through
`explain()`. This is the entry point for a keystroke-rate input.

```ts
engine.suggest("10 m");
// [ { kind: "duration", formatted: "10 minutes", confidence: 0.5 },
//   { kind: "length",   formatted: "10 metres",  confidence: 0.5 } ]

engine.suggest("nonsense"); // []
```

<SpSuggest />

## coerce()

```ts
coerce(kind: KindId, input: string, opts?: EvalOptions): Value
```

Type-directed. The kind is a hard constraint at solve time, so a token that
could belong to two kinds resolves without any weight tuning.

```ts
engine.coerce("mass", "1 kg");
// { kind: "mass", canonical: Decimal(1000), unit: "kg" }

engine.coerce("mass", "10 km");
// NoCandidateError
```

Returns a `Value`, not a `Result` — there is no ranking left to report.

## explain()

```ts
explain(input: string, opts?: EvalOptions): Explanation
```

Tokens, candidates, and every scored assignment with its individual
contributions. Required, not a nicety: a scored solver is unusable without a way
to inspect why it chose, and this is the debugging surface plugin authors get.

```ts
interface Explanation {
  input: string;
  tokens: Token[];
  candidates: Candidate[];
  assignments: Array<{
    kind: KindId;
    score: number;
    confidence: number;
    units: string[];
    contributions: Array<{ selector: string; value: number; layer: number }>;
  }>;
}
```

`explain()` shares the strict pipeline, so it throws where `evaluate()` would on
a lexing or parsing failure.

<SpExplain />

## complete()

```ts
complete(input: string, opts?: CompleteOptions): Completion[]
```

Ranks the units the input's **trailing fragment** could still become, rewriting
the whole input for each. Total: no input makes it throw, and a fragment that
cannot be completed is an empty array.

```ts
engine.complete("30 ho");
// [ { alias: "hour", span: { start: 3, end: 5 }, text: "30 hours",
//     kind: "duration", unit: "h", score: 13 } ]
```

Full reference, ranking terms and the rule that keeps the inserted text
parseable: [`complete()`](/api/complete).

<SpComplete />

## EvalOptions

```ts
interface EvalOptions {
  kinds?: KindId[];   // hard filter — candidates outside this set are dropped
  weights?: Weights;  // per-call layer 4
}
```

`kinds` is a filter, not a weight. Candidates outside the set are dropped before
scoring, which is a different operation from being ranked last:

```ts
engine.evaluate("10 m", { kinds: ["length"] });        // duration cannot win
engine.evaluate("10 m", { weights: { length: 99 } });  // duration could still win
```

## Result

```ts
interface Result {
  value: Value;
  formatted: string;
  kind: KindId;
  confidence: number;   // 0..1, softmax over raw solver scores
  spans: Span[];        // token → source offsets
  meta: {
    ratesAsOf?: string;         // present when the engine was given a rate table
    assumptions: Assumption[];
  };
}

interface Assumption {
  readonly code: string;        // stable, machine-readable — branch on this
  readonly message: string;     // human-facing, may be reworded
  readonly detail?: Readonly<Record<string, string>>;
}
```

`spans` exist so a caller can underline the tokens a result came from without
re-parsing.

`meta.assumptions` records anything the engine inferred rather than read. Two
kinds populate it today:

| `code` | Raised by | Means |
| --- | --- | --- |
| `cross-rate` | `money` | the FX rate was derived through the snapshot's base currency, not quoted directly |
| `temperature-delta` | `temperature` | `20 C + 5 C` read the right operand as a difference, because the alternative is meaningless |

`meta.ratesAsOf` is the date of the rate table the result was computed against —
absent on an engine with no `rates`. A converted amount without one is a number
pretending to be a fact.

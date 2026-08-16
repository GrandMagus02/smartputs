---
title: Engine
description: evaluate, suggest, coerce, explain, complete and scan.
---

# Engine

```ts
interface Engine {
  evaluate(input: string, opts?: EvalOptions): Result;
  suggest(input: string, opts?: EvalOptions): Result[];
  coerce(kind: KindId, input: string, opts?: EvalOptions): Value;
  explain(input: string, opts?: EvalOptions): Explanation;
  complete(input: string, opts?: CompleteOptions): Completion[];
  scan(input: string, opts?: ScanOptions): Mark[];
}
```

Six entry points over one pipeline. The first four differ in what they do with
ambiguity, not in how they parse — `coerce()` injects a hard constraint into the
solver rather than running a second code path, so every solver behaviour is
shared. `complete()` answers a different question entirely, but ranks its
answers with the same weights. `scan()` answers a third question again: not
"what does this string mean" but "which spans in this text are quantities" —
it segments free-form prose into marks first, then hands each one to the same
solver, so a mark's `formatted`, `value` and `confidence` cannot drift from
what the other entry points would report for the same span.

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

Ranks what the input's **trailing fragment** could still become, rewriting the
whole input for each. Total: no input makes it throw, and a fragment that cannot
be completed is an empty array.

```ts
engine.complete("30 ho");
// [ { alias: "hour", span: { start: 3, end: 5 }, text: "30 hours",
//     kind: "duration", unit: "h", score: 13 } ]
```

Rows come from **two sources**, ranked into one list:

- the **global alias index**, which holds every ratio kind's unit aliases and
  splices `<count> <plural display form>` — this is where `30 hours` comes from;
- every kind that declares a [`completions`](/api/define-kind#completions)
  hook, which answers for itself and supplies the replacement text whole. This
  is how an opaque kind completes at all, and how `@smartput/country` offers a city
  that is in nobody's alias index.

```ts
// with @smartput/country registered
engine.complete("kyi").map((c) => c.text); // [ "Kyiv", "Kyivskyi", "Kyivskyi" ]
```

`opts.limit` cuts the merged list, not each source, so a kind with a large
vocabulary is competing for the same ten rows as `kilometre`.

Full reference, ranking terms and the rule that keeps the inserted text
parseable: [`complete()`](/api/complete). Writing a completer:
[`completions`](/api/define-kind#completions).

<SpComplete />

## scan()

```ts
scan(input: string, opts?: ScanOptions): Mark[]
```

`evaluate` and friends read the whole string as one expression. `scan` does
not: it finds the quantities inside a sentence and marks each one, letting the
words around a mark argue for a kind. **Never throws on prose** — an input
with nothing in it answers `[]`, the same totality `suggest()` and
`complete()` promise.

```ts
engine.scan("My house is 5km from work");
// [ { start: 12, end: 15, text: "5km", readings: [ { kind: "length", … } ] } ]

engine.scan("Will be in time in 5m")[0].readings.map((r) => r.kind);
// [ "duration", "length" ]   — "in" and "time" argue for minutes, and the
//                              metres reading survives at 0.018 rather than
//                              being deleted
```

Marks never overlap and are emitted in source order. Each carries a ranked,
never-empty `readings` list — see [Mark](#mark) below — plus `cues`, the words
that biased it and by how much.

```ts
interface ScanOptions extends EvalOptions {
  cueWindow?: number;   // tokens either side of a mark offered as context. Default 4.
  maxReadings?: number; // readings kept per mark. Default 3.
  maxSpan?: number;     // token backoff cap, the adversarial-input guard. Default 12.
}
```

## EvalOptions

```ts
interface EvalOptions {
  kinds?: KindId[];      // hard filter — candidates outside this set are dropped
  locales?: string[];    // hard filter — by the language that listed the spelling
  weights?: Weights;     // per-call layer 4
  format?: string;       // per-call output language; must be installed
  timeZone?: string;     // per-call override of EngineOptions.timeZone
  comparePrecision?: number | "exact";  // per-call override
}
```

`kinds` is a filter, not a weight. Candidates outside the set are dropped before
scoring, which is a different operation from being ranked last:

```ts
engine.evaluate("10 m", { kinds: ["length"] });        // duration cannot win
engine.evaluate("10 m", { weights: { length: 99 } });  // duration could still win
```

`locales` is the same kind of filter, applied to the language that listed the
spelling — see [`locale:` selectors](/guide/weights#selectors) for why that is
narrower than "the languages I read". Filtering every reading of a slot away
raises `DimensionMismatchError`, the same as `kinds` does; `NoCandidateError`
means no reading existed in the first place.

```ts
engine.evaluate("5 кг", { locales: ["uk"] }); // 5 kilograms
engine.evaluate("5 кг", { locales: ["en"] }); // throws DimensionMismatchError
```

`format` overrides the output language for one call. It is **output only**: it
rebuilds the printer and evaluator, not the tokenizer, so number grammar and
segmentation stay the engine's own. Move the whole engine with
`EngineOptions.format` when the input grammar has to move too.

```ts
engine.evaluate("5 kg", { format: "uk" }).formatted; // "5 кілограмів"
engine.evaluate("5 kg").formatted;                   // "5 kilograms"
```

`timeZone` reaches every [literal matcher](/api/define-kind#literals) as
`MatchCtx.timeZone`, so one engine can answer `"3pm"` for callers in different
places without being rebuilt:

```ts
engine.evaluate("3pm", { timeZone: "Asia/Tokyo" }).formatted;
// "2026-01-15 15:00 JST"
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
re-parsing. `Result.spans`, `AmbiguityError.spans` and `NoCandidateError.spans`
index the string the caller passed in; spans on the remaining
`SmartputError` subtypes are relative to the normalized text.

`meta.assumptions` records anything the engine inferred rather than read. Two
kinds populate it today:

| `code` | Raised by | Means |
| --- | --- | --- |
| `cross-rate` | `money` | the FX rate was derived through the snapshot's base currency, not quoted directly |
| `temperature-delta` | `temperature` | `20 C + 5 C` read the right operand as a difference, because the alternative is meaningless |

Each entry is frozen — mutating a returned `Assumption` throws — though the
`assumptions` array itself, and `meta`, and `Result`, are plain, unfrozen
objects; only the values a caller is likely to hold onto and pass around
individually carry the freeze. (`Result.value` is frozen too, but that
predates this restructuring — every `Completion` `complete()` returns is the
other value newly frozen alongside `Assumption`.)

`meta.ratesAsOf` is the date of the rate table the result was computed against —
absent on an engine with no `rates`. A converted amount without one is a number
pretending to be a fact.

## Mark

```ts
interface Mark {
  start: number;         // caller-relative, like Result.spans — never the normalized string
  end: number;
  text: string;           // input.slice(start, end), carried so a caller never re-slices
  readings: MarkReading[]; // ranked, best first. Never empty — a mark with no reading is not emitted
  cues: CueHit[];          // which words biased this mark, and by how much. Empty when none did
}

interface MarkReading {
  kind: KindId;
  value: Value;
  formatted: string;
  confidence: number;
}

interface CueHit {
  readonly word: string;  // as written, not folded
  readonly start: number; // also caller-relative — a UI that underlines the cue needs this
  readonly end: number;
  readonly kind: KindId;
  readonly weight: number;
}
```

A `Mark` is `scan()`'s unit of output: one stretch of the caller's string that
reads as a quantity, with every reading it earned. `readings` is a list rather
than a bare `reading` with an optional `alternatives` beside it even when there
is exactly one — a caller that renders a mark renders a list either way, and a
shape that changes with the arity forces every consumer to branch on a case
that carries no information. This is the same call `suggest()` already made
with `Result[]`.

`cues` is empty on a mark nothing nearby argued for — most marks in ordinary
prose have no cue words within `cueWindow` tokens, and an empty array says so
without a caller needing to check `readings.length` first.

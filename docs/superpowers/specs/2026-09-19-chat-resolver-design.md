# `@smartput/chat`: freeform chat to a resolved value

**Status:** design approved, not implemented
**Date:** 2026-09-19
**Depends on:** `@smartput/core` (types + injected `Engine`), `@smartput/kind` (errors)

## 1. What this adds

A new workspace package, `@smartput/chat`, that reads a chat message written for
a human and decides three things: whether it is a request at all, which resolver
should answer it, and which stretch of it is the payload.

```ts
chat.handle("What is 2 + 2");
// { resolver: "evaluate", payload: "2 + 2", confidence: 0.94, result: … }

chat.handle("lol ok");
// null — abstain
```

It is not a new parser. `engine.scan()` already finds the quantities inside
prose, ranks their readings and reports which surrounding words argued for
which kind. What it does not do is strip the carrier phrase a person wraps a
request in, decide which of the installed resolvers wants the result, or stay
silent on the nine messages in ten that are not requests. That is this package.

### 1.1 The model is linear, and that is the design

The routing model is multinomial logistic regression over hand-named features,
shipped as a per-locale weight table. It is trained, and it is not a neural
network. Four reasons, and the last one is structural rather than budgetary:

1. `scripts/check-deps.ts` fails CI on any dependency not listed in its
   `ALLOWED` map, with a written reason. A runtime inference library is not a
   line anyone wants to write there.
2. `scripts/check-size.ts` budgets every entry point in minified and gzipped
   bytes, with a floor guard underneath. Model weights are measured, not waved
   through.
3. Recognition reads seventeen languages. Supervised data in seventeen
   languages does not exist here and will not be produced for v1.
4. **Kinds are registered at runtime.** `createEngine` ships no vocabulary until
   it is handed some, and a consumer can `defineKind` their own. A monolithic
   trained classifier cannot route a resolver that did not exist when it was
   trained. A feature-based scorer can: a new resolver contributes its own
   features and its own rows.

The same reasoning the engine already runs one level up. Readings are ranked
rather than chosen; weights are data rather than code; ambiguity is an outcome
rather than a failure.

## 2. Package layout

```
packages/chat/
  package.json         # deps: @smartput/core, @smartput/kind
  tsconfig.json        # extends ../../tsconfig.base.json, per convention
  src/
    types.ts           # Resolver, Candidate, ChatResult, Hole
    errors.ts          # ChatError
    vocabulary.ts      # ChatVocabulary, chatEn, chatUk
    carve.ts           # carrier stripping -> candidate spans
    features.ts        # tier 0 named features + tier 1 hashed n-grams
    model.ts           # LinearModel: load, score
    state.ts           # Conversation — referent memory
    chat.ts            # ChatResolver
    index.ts           # root barrel — no network, no engine runtime
    weights/
      en.json          # trained, generated, committed
      uk.json
    resolvers/
      evaluate.ts      # engine.evaluate / suggest
      convert.ts       # "X in Y", including the hole form
      index.ts
    embed/
      index.ts         # tier 2: Embedder, prototypes, cosine feature
    train/
      index.ts         # the trainer, for retraining on your own logs
```

**Resolvers are injected, not bundled.** The package ships only the two
resolvers that need nothing but the engine (`evaluate`, `convert`). Resolvers
over `@smartput/math`, `@smartput/distance`, `@smartput/translate` and
`@smartput/query` are five lines each in consumer code, or a subpath those
packages add later. Bundling them would make `@smartput/chat` depend on six
packages to serve a consumer who wanted one, which is the opposite of what the
rest of the repo does — `createEngine` registers nothing on its own, and neither
does this.

**Engine is injected and imported as a type.** `carve`, `features`, `model` and
`state` reach `@smartput/core` through `import type` only. The root barrel
therefore links no engine runtime and no `decimal.js`. `@smartput/core` stays a
declared dependency because the injected `Engine` is called through it, but the
byte cost of importing `ChatResolver` is this package alone.

**Registration requirement:** implementation must add to `check-deps.ts`:

```ts
"packages/chat/package.json": ["@smartput/core", "@smartput/kind"],
```

## 3. Entry points

| Subpath | Holds |
| --- | --- |
| `.` | `ChatResolver`, `Conversation`, `carve`, `featurize`, `LinearModel`, types |
| `./locale/en`, `./locale/uk`, … | `ChatVocabulary` per language |
| `./weights/en`, … | the trained table, JSON-as-module |
| `./resolvers` | `evaluateResolver`, `convertResolver` |
| `./embed` | tier 2 — `Embedder`, `EmbeddingFeature` |
| `./train` | the trainer, unimported in production |

Weights ship on their own subpath rather than inside the barrel so a consumer
who supplies their own table links neither. A subpath nobody imports costs
nothing, which is what makes `./train` affordable to publish at all.

## 4. Pipeline

```
scan → carve → featurize → score → fill → resolve | abstain
```

Named to sit beside the engine's own `normalize → tokenize → parse → solve →
eval → print`, and it stops where that one starts: every value in a
`ChatResult` was produced by the engine, never by this package.

### 4.1 scan

`engine.scan(text)` returns `Mark[]`: caller-relative `start`/`end`, ranked
`readings` with `kind`, `value`, `formatted` and `confidence`, plus the `cues`
that biased them. All of it is feature input, and none of it is recomputed here.

### 4.2 carve

Carrier stripping. Generalizes what `@smartput/query`'s vocabulary already does
in one package: `leading` strips `"show me the"` and `"which"` from the front,
`trailing` strips `"please"` from the tail, each restricted to one end for a
reason written out in that file — dropped anywhere else, `please` is free to
swallow the operand in front of it. Chat lifts that from one resolver to all of
them and adds the two forms query never had to read:

- a greeting at the head — `"hi"`, `"hey"`, `"morning"`
- an intent frame that names a target — `"convert X to Y"`, `"how far is X from Y"`

`carve` emits **several** candidates per message, never one. Committing to a
single span before any evidence is scored is how a carver acquires a rule
nobody can state.

```ts
interface Candidate {
  readonly span: Span;           // caller-relative, like Mark
  readonly text: string;         // input.slice(span.start, span.end)
  readonly frame?: string;       // which intent frame matched, if any
  readonly holes: readonly Hole[];
  readonly stripped: { head: string; tail: string };
}
```

### 4.3 featurize

**Tier 0 — named features.** Every one is cheap and already computed:

| Feature | Source |
| --- | --- |
| mark count, per kind | `Mark[]` |
| top reading confidence, and margin over second | `MarkReading` |
| cue hits, per kind | `CueHit[]` |
| intent frame identity | `carve` |
| greeting / politeness stripped | `carve` |
| leading interrogative | vocabulary |
| operator token present | vocabulary |
| payload length ÷ message length | `carve` |
| **does the payload alone resolve, and at what confidence** | `engine.suggest(candidate.text)` |
| unfilled hole present | `carve` |
| state holds a compatible value of the required kind | `Conversation` |

The self-verification row is the one that carries the model. A candidate span of
`"2 + 2"` returns a confident reading from `suggest`; `"is 2 + 2"` returns
nothing. Carving checks itself against the engine, so the classifier learns
which frame introduced a payload rather than what a payload looks like — a much
smaller problem, and one that transfers across kinds the training set never saw.

`suggest` is the right door and `evaluate` is the wrong one: it never throws,
and ambiguity is exactly the signal wanted here rather than an error to catch.

**Tier 1 — hashed character n-grams.** Character 3-grams through 5-grams over
the *stripped carrier region only*, never the payload. The payload is the
engine's business and putting its characters in a bag would teach the router to
recognise units it should be asking the engine about.

Hashed into a fixed 2048 buckets, so the weight table has the same shape in
every language and a locale with a longer phrase list does not have a larger
model. This is the tier that absorbs paraphrase — `"could you maybe make that
into kilos"` shares n-grams with `"can you convert that to kg"` without either
being listed — and inflection, which is what the Slavic and Turkic locales need
and what a phrase list serves worst.

Storage: int8-quantised with a per-row scale, 2048 buckets × one row per
resolver. Eight resolvers is ~16 KB raw and far less gzipped. A
`check-size.ts` `BUDGETS` row per shipped locale makes that a number CI holds,
not an estimate in a design document.

### 4.4 score

`LinearModel.score(features) → Map<resolverId, number>`, softmax over resolvers
plus an explicit `abstain` row. Abstain is a class the model is trained on, not
a threshold bolted to the side of one: most chat messages are not requests, and
a router that can only express "least bad resolver" will answer all of them.

A `threshold` option still gates the winner, defaulting to a value the eval
harness records rather than one chosen by hand.

### 4.5 fill

Holes are filled from `Conversation`, and the kind constraint does the work:

```ts
class Conversation {
  push(entry: { kind: KindId; value: Value; text: string }): void;
  last(kind?: KindId): Value | undefined;
  candidates(kind?: KindId): readonly Value[];  // recent first
  clear(): void;
  // bounded ring, default 8 entries
}
```

A hole carries the kind it needs. `"convert this to kg"` needs a mass-compatible
value, so the lookup is `candidates("mass")`, and a state holding one length and
one mass has no contest to resolve. **The kind system is the coreference
resolver.** This is the property that makes the referent case cheap here and
expensive everywhere else, and it is worth stating plainly because it is the
reason a bigger model is not the answer to it.

When two compatible values are in reach, `handleAll` returns both readings
ranked rather than picking one — the same answer `suggest()` gives to `"10 m"`,
for the same reason.

### 4.6 The worked case

```
"Hi, convert this to kg please"
 ^^^  ^^^^^^^ ^^^^ ^^^^^ ^^^^^^
greet  frame  hole target politeness
```

1. `scan` marks `kg` — one mass reading, high confidence.
2. `carve` strips `"Hi,"` at the head and `"please"` at the tail, matches the
   `convert … to …` frame, and emits a candidate with `target = kg` and one
   unfilled `Hole { kind: "mass" }`.
3. `featurize` records: frame matched, greeting and politeness stripped, one
   mass mark, payload does not resolve alone, hole present, **state holds a
   compatible mass**.
4. `score` puts `convert` on top.
5. `fill` takes `Conversation.last("mass")` — `5 lb`, pushed by the previous
   turn.
6. `convertResolver` calls `engine.coerce` and the engine converts.

```ts
chat.handle("5 pounds of flour");           // pushes mass 5 lb
chat.handle("Hi, convert this to kg please");
// { resolver: "convert", payload: "this to kg", confidence: 0.91,
//   filled: [{ slot: "source", from: "state", value: <5 lb> }],
//   result: { formatted: "2.27 kilograms", … } }
```

No step of that needs more model capacity. The information `"this"` refers to is
not in the message, and no classifier recovers it; carrying the last result
forward does.

## 5. Resolvers

```ts
interface Resolver<T = Result> {
  readonly id: string;
  /** Intent frames this resolver answers, per locale id. */
  readonly frames: Readonly<Record<string, readonly string[]>>;
  /** Kinds whose presence argues for this resolver. */
  readonly kinds?: readonly KindId[];
  /** Tier 2 only: example phrasings, embedded once at warm-up. */
  readonly prototypes?: Readonly<Record<string, readonly string[]>>;
  /** True when `resolve` returns a promise — a provider-backed resolver. */
  readonly async?: boolean;
  resolve(candidate: Candidate, ctx: ResolveCtx): T | Promise<T>;
}
```

A resolver that reaches a network — translation, a geo provider — declares
`async: true`, and `handle` **excludes it from scoring entirely** rather than
routing to it and returning a promise it cannot await. This is the same rule
tier 2 lives under, stated once and applied twice: the synchronous path is a
strict subset of the asynchronous one, and it answers a smaller set of messages
rather than answering the same set worse. `handleAsync` scores every resolver.

A resolver declares vocabulary and reads the engine; it never scores. Routing
lives in one place so that adding a resolver cannot introduce a second, private
notion of confidence. `frames` and `prototypes` are keyed by locale id for the
same reason every other word in this repo is.

`ResolveCtx` carries the engine, the conversation and the call options.

## 6. `ChatResolver`

```ts
class ChatResolver {
  constructor(opts: {
    engine: Engine;
    resolvers: readonly Resolver[];
    locales: readonly ChatVocabulary[];
    weights: LinearModel;         // from ./weights/<locale>, or your own
    embedder?: Embedder;          // tier 2
    threshold?: number;
    conversation?: Conversation;  // default: a fresh bounded ring
  });

  handle(text: string): ChatResult | null;
  handleAll(text: string): ChatResult[];
  handleAsync(text: string): Promise<ChatResult | null>;
  handleAllAsync(text: string): Promise<ChatResult[]>;
  readonly conversation: Conversation;
}
```

`weights` is required and has no default. A default would mean the root barrel
importing a shipped table, which is the one thing §3 puts on its own subpath;
and it is the same answer `createEngine` gives, which registers no kinds until
it is handed some. A consumer imports the table for the language they read and
passes it, or trains their own through `./train`.

Every successful `handle` pushes its result onto `conversation` before
returning, which is what makes the next turn's referent resolvable. A caller who
wants routing without memory passes their own `Conversation` and clears it, or
reads `ChatResult` and ignores the state.

`handle` is synchronous: tiers 0 and 1, synchronous resolvers only.
`handleAsync` adds tier 2 when an `embedder` was supplied and scores
`async: true` resolvers as well. Both additions strictly upgrade and neither
breaks — a consumer who configures an embedder and keeps calling `handle` gets
the tier 0+1 answer rather than an exception, because a chat at message rate
wanting a synchronous answer is a legitimate choice, not a misuse.

`handleAll` and `handleAllAsync` split on the same line.

`handleAll` matters more than it looks. One message routinely carries two
requests, and a router that returns the best one silently drops the other.

```ts
interface ChatResult<T = Result> {
  readonly resolver: string;
  readonly payload: string;
  readonly span: Span;
  readonly result: T;
  readonly confidence: number;
  readonly filled: readonly { slot: string; from: "state"; value: Value }[];
}
```

## 7. Tier 2: embeddings, injected

```ts
interface Embedder {
  readonly id: string;
  embed(texts: readonly string[]): Promise<Float32Array[]>;
}
```

Bring your own, exactly as `TranslateProvider`, `RateProvider` and geo's
providers already work in this repo. The package ships no model and no
inference dependency; a consumer wires transformers.js, a hosted embedding API,
or anything else behind this interface.

**Tier 2 is a feature, not a second router.** `EmbeddingFeature.warm()` embeds
each resolver's `prototypes` once, batched, cached by `embedder.id`, and holds a
centroid per resolver. At score time it embeds the carrier region and
contributes two rows per resolver — cosine to centroid, and max cosine to any
single prototype — into the *same* linear model as every tier 0 and tier 1
feature. One decision path, one weight table, one threshold.

A second router scoring in parallel would need a rule for which one wins when
they disagree, and there is no honest place to put that rule. As a feature, the
training data decides how much the embedding is worth, per resolver, like
everything else.

Prototype vectors are never shipped: they are model-specific, and a table
embedded under one encoder is noise under another. The cache is keyed by
`embedder.id` and warmed at init, the same in-flight-promise shape
`Translator`'s cache and `PostalCodes#files` use.

## 8. Training and evaluation

`scripts/chat-train.ts`, following `scripts/parity-record.ts`'s pattern of a
committed, regenerable artifact.

**Positives.** Carrier frames crossed with payloads harvested from the corpus
tests already in the repo — `packages/core/src/corpus.test.ts`,
`packages/core/src/scan/corpus.test.ts`, and each kind's own. Those payloads are
gold data with known readings, which is what makes synthesis honest here rather
than circular: the label being learned is the frame, and the payload's own
reading comes from the engine either way.

**Negatives.** Plain chatter, plus near-misses — a real payload under a frame
that does not introduce one, and a frame with no payload behind it. Near-misses
are what teach the abstain row anything; chatter alone makes it lazy.

**Output.** `packages/chat/src/weights/<locale>.json`, committed and listed with
the repo's other generated files.

**`scripts/chat-eval.ts`** reports precision, recall and abstain rate per
resolver on a held-out split, and fails against a recorded baseline the way
`parity:record` does. Precision on short messages is where this design dies if
it dies, so it is the number CI watches.

Scripts: `chat:train`, `chat:eval`.

## 9. Vocabulary

```ts
interface ChatVocabulary {
  readonly id: string;
  /** Head-only, like query's `leading`. */
  readonly greetings: readonly string[];
  readonly leading: readonly string[];
  /** Tail-only, like query's `trailing`. */
  readonly trailing: readonly string[];
  /** Words standing in for a prior value — "this", "that", "it", "ans". */
  readonly referents: readonly string[];
  /** Frame id -> spellings. "convert" -> ["convert", "turn", "make"]. */
  readonly frames: Readonly<Record<string, readonly string[]>>;
  readonly interrogatives: readonly string[];
}
```

`chatEn` first. Other locales ship incrementally — the locale architecture
already supports a partial set, and tier 1's n-grams degrade a missing phrase
list into a weaker signal rather than a failure.

## 10. Errors

`src/errors.ts`:

```ts
class ChatError extends SmartputError { // from @smartput/kind/errors
  constructor(stage: string, detail: string);
}
```

Imported from `@smartput/kind/errors` and **not** through `@smartput/core`'s
root barrel. `check-size.ts` records four entries that blew their budgets for
weeks over exactly that import, because naming one export from a barrel links
what the barrel had to load to offer it — `decimal.js`, 33 KB minified, unused.
Local errors, local door.

Routing failures are not errors. A message that routes nowhere returns `null`.

## 11. Testing

Colocated `*.test.ts`, run with `bun test`.

- `carve.test.ts` — head-only and tail-only stripping, multi-candidate output,
  frames, the `"Hi, convert this to kg please"` trace in §4.6, and the negative
  that a stripped word never eats an operand beside it.
- `features.test.ts` — each named feature in isolation; n-gram hashing is stable
  across runs and confined to the carrier region.
- `model.test.ts` — score against a fixture table, softmax sums to one, abstain
  competes as a class.
- `state.test.ts` — kind-filtered lookup, ring bound, `candidates` ordering, the
  two-compatible-values case returning both.
- `chat.test.ts` — `handle` / `handleAll` / `handleAsync`, abstain on chatter,
  two requests in one message, embedder configured but `handle` called.
- `embed/index.test.ts` — a stub `Embedder`, warm-up batching and caching,
  cosine arithmetic, and that scores move monotonically with prototype
  similarity.
- `corpus.test.ts` — held-out routing accuracy, matching the corpus-test pattern
  the engine already uses.

## 12. Risks

- **Carrier phrases across seventeen languages is real authoring work.** Ship
  `en` and `uk` (the two `query` already has) and let tier 1 carry the rest
  until the phrase lists arrive.
- **The abstain threshold is the whole user experience.** Too low and the bot
  answers greetings. It needs a held-out negative set before any default is
  published, which §8 makes a CI number rather than a judgement call.
- **Short messages are the weak case.** `"5kg"` alone is a request in one chat
  and a fragment in another, and no feature here separates them. Measured, not
  solved.
- **Synthetic training data can teach frames that nobody types.** The eval split
  must include real messages, not only generated ones.

## 13. Out of scope (v1)

- **Tier 3, an LLM router.** A later package behind its own subpath, for
  low-confidence rows only. Nothing here forecloses it; the `abstain` row is
  where it would attach.
- **A dialogue manager.** State is a bounded ring of values, not a conversation
  model. No clarification turns, no slot-filling across several messages —
  ambiguity is returned ranked and the caller decides.
- **Per-user or online learning.** Weights are a shipped artifact, retrainable
  offline through `./train`.
- **A neural model in the core barrel.** Deliberate, not deferred — §1.1.
- **Resolvers over `math`, `distance`, `translate`, `query` shipped from this
  package** — injected, §2.
- **Prototype vectors as a shipped artifact** — §7.

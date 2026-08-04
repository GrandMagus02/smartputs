---
title: createEngine
description: Compose locales, kinds and packs into an immutable Engine.
---

# createEngine

```ts
function createEngine(opts: EngineOptions): Engine
```

Composes frozen descriptors into an engine. There is no mutable global
registry: engines with different locales, kinds or weights coexist in one
process, and every registration error is raised here rather than lazily at parse
time.

```ts
import { BUILTIN_KINDS, createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
```

## EngineOptions

```ts
interface EngineOptions {
  locales: Locale[];         // required; first is primary, rest are fallbacks
  kinds?: Kind[];
  packs?: LocalePack[];
  weights?: Weights;
  tiebreak?: "error" | "first";
  ambiguityEpsilon?: number;
  maxCandidates?: number;
}
```

### locales

Required, and must be non-empty — an empty array throws. The first entry is the
primary locale; the rest are fallbacks. When two locales disagree about number
grammar (`1,500` is 1500 in `en` and 1.5 in `de`) both candidates are emitted and
the primary locale scores higher.

### kinds

Appended to the engine's vocabulary. **Nothing is registered implicitly** — pass
`BUILTIN_KINDS`, or a subset of `number` / `length` / `mass` / `duration`, or the
engine has no units at all and every word raises `NoCandidateError`.

```ts
createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, dataSize, myTicker] });
```

Two kinds claiming the same id, or the same op signature, raise
`KindConflictError` naming both sources. Registration order is irrelevant.

### packs

Vocabulary contributions from `defineLocalePack`. A pack naming an unregistered
kind raises `UnknownKindError` here — never a silent no-op.

### weights

Layer 3 of the [weight stack](/guide/weights). Selectors are `token:<form>`,
`<kind>:<unit>` or `<kind>`, and every matching selector adds.

```ts
createEngine({
  locales: [uk, en],
  kinds: [...BUILTIN_KINDS, myTicker],
  weights: {
    "mycompany-ticker": 40, // custom kind outranks built-ins
    "duration:min": -15, // "m" never means minutes here
    "token:т": 100, // in this domain "т" is always tonnes
  },
});
```

### tiebreak

Default `"error"`.

| Value | Behaviour on an exact score tie |
| --- | --- |
| `"error"` | `AmbiguityError`, listing the candidates |
| `"first"` | registration order, then kind id lexicographic |

Never random and never map iteration order — identical input and options always
produce identical ranking.

### ambiguityEpsilon

Default `0.05`. `evaluate()` throws when the top two **confidences** are within
this margin. Because confidence is a softmax over raw scores, the epsilon keeps
its meaning no matter how large the weights get.

### maxCandidates

Default `10_000`. Guards the exhaustive search over consistent assignments.
Exceeding it raises `TooAmbiguousError` with the count.

## Immutability

Engines are immutable. To vary options, call `createEngine` again — it is a
cheap pure composition of frozen descriptors, which is why there is no
`engine.with(patch)`.

<SpWeights />

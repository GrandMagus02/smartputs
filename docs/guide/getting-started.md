---
title: Getting started
description: Install @smartput/core, build an engine, and evaluate an expression.
---

# Getting started

## Install

::: code-group

```sh [bun]
bun add @smartput/core
```

```sh [pnpm]
pnpm add @smartput/core
```

```sh [npm]
npm install @smartput/core
```

:::

`@smartput/core` is ESM only and ships one runtime dependency, `decimal.js`.

## Build an engine

An engine is a pure composition of frozen descriptors: locales, kinds, and
optional weight overrides. Nothing is global, and engines with different options
coexist in one process.

```ts
import { BUILTIN_KINDS, createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";

const engine = createEngine({
  locales: [en], // first is primary, rest are fallbacks
  kinds: BUILTIN_KINDS, // number, length, mass, duration
});
```

::: tip Kinds are not implicit
`createEngine` registers nothing on your behalf. Pass `BUILTIN_KINDS` (or a
subset of `number`, `length`, `mass`, `duration`) or the engine will have no
vocabulary and every unit raises `NoCandidateError`.
:::

## Evaluate

```ts
const result = engine.evaluate("1 kg + 500 g");

result.formatted; // "1.5 kilograms"
result.kind; // "mass"
result.value.canonical.toString(); // "1500"   — grams, the canonical unit
result.value.unit; // "kg"     — the left operand's unit
result.confidence; // 1
```

<SpEvaluate
  model-value="1 kg + 500 g"
  :examples="['1 kg + 500 g', '2 wk', '3 lbs', '1,500 g', '90 min in h', '(1 + 2) * 3']"
  hint="The canonical value is always in the kind's base unit; the displayed unit follows the left operand." />

## Three entry points

`evaluate()` is strict and throws. It is the wrong choice for a keystroke-rate
input, where ambiguity is normal — use `suggest()` there, and reach for
`coerce()` when you already know which kind you want.

| Method | On ambiguity | Returns |
| --- | --- | --- |
| `evaluate(input)` | throws `AmbiguityError` | one `Result` |
| `suggest(input)` | ranks | `Result[]`, possibly empty; never throws |
| `coerce(kind, input)` | resolved by the hard kind constraint | a `Value` |
| `explain(input)` | shows the scoring | an `Explanation` |

```ts
engine.evaluate("10 m");
// AmbiguityError: "10 m" is ambiguous between duration:min, length:m

engine.suggest("10 m");
// [ { kind: "duration", formatted: "10 minutes", confidence: 0.5 },
//   { kind: "length",   formatted: "10 metres",  confidence: 0.5 } ]

engine.coerce("mass", "1 kg");
// { kind: "mass", canonical: Decimal(1000), unit: "kg" }
```

<SpSuggest hint="suggest() never throws. Unparseable input is an empty ranking, not an exception." />

## Resolve the ambiguity yourself

If your domain knows that `m` always means metres, say so once at engine
construction:

```ts
const engine = createEngine({
  locales: [en],
  kinds: BUILTIN_KINDS,
  weights: { "duration:min": -20 }, // "m" never means minutes here
});

engine.evaluate("10 m").formatted; // "10 metres"
```

<SpWeights />

## Where to go next

- [The pipeline](/guide/pipeline) — what happens between the string and the result.
- [Ambiguity and weights](/guide/weights) — the full four-layer model.
- [API reference](/api/) — every exported symbol.

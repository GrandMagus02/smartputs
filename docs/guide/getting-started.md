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
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

// A language and the words for a kind are two descriptors; `composeLocale`
// joins them, and is the only thing that may. See [Locales](/guide/locales).
const en = composeLocale(english, BUILTIN_EN);

const engine = createEngine({
  locales: [en], // every language the engine READS
  kinds: BUILTIN_KINDS, // number, percent, length, mass, duration, temperature,
  //                       tempdelta, angle, datasize, speed, area, volume
});
```

`locales` is plural because recognition is many-locale: a surface gets a reading
if any installed language can reach it. Generation is single — the engine writes
in the one language `format` names, defaulting to `locales[0].id`.

::: tip Kinds are not implicit
`createEngine` registers nothing on your behalf. Pass `BUILTIN_KINDS`, or the
subset you want, or the engine will have no vocabulary and every unit raises
`NoCandidateError`. Two kinds are deliberately left out of `BUILTIN_KINDS` and
must be named: `measure` (its `mm`/`cm` collide with `length`) and `money`,
which lives in [`@smartput/rate`](/packages/rate) because it needs a rate table
you supply.
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

## Six entry points

`evaluate()` is strict and throws. It is the wrong choice for a keystroke-rate
input, where ambiguity is normal — use `suggest()` there, and reach for
`coerce()` when you already know which kind you want.

| Method | On ambiguity | Returns |
| --- | --- | --- |
| `evaluate(input)` | throws `AmbiguityError` | one `Result` |
| `suggest(input)` | ranks | `Result[]`, possibly empty; never throws |
| `coerce(kind, input)` | resolved by the hard kind constraint | a `Value` |
| `explain(input)` | shows the scoring | an `Explanation` |
| `complete(input)` | ranks the units the fragment could become | `Completion[]` |
| `scan(text)` | ranks, per mark | `Mark[]`, possibly empty; never throws |

```ts
engine.evaluate("10 m");
// AmbiguityError: "10 m" is ambiguous between duration:min, length:m

engine.suggest("10 m");
// [ { kind: "duration", formatted: "10 minutes", confidence: 0.5 },
//   { kind: "length",   formatted: "10 metres",  confidence: 0.5 } ]

engine.coerce("mass", "1 kg");
// { kind: "mass", canonical: Decimal(1000), unit: "kg" }

engine.complete("30 ho");
// [ { alias: "hour", text: "30 hours", kind: "duration", unit: "h", … } ]
```

`evaluate` and friends read the whole string as one expression. `scan` does not:
it finds the quantities inside a sentence and marks each one, letting the words
around a mark argue for a kind.

```ts
engine.scan("My house is 5km from work");
// [ { start: 12, end: 15, text: "5km", readings: [ { kind: "length", … } ] } ]

engine.scan("Will be in time in 5m")[0].readings.map((r) => r.kind);
// [ "duration", "length" ]   — "in" and "time" argue for minutes, and the
//                              metres reading survives at 0.018 rather than
//                              being deleted
```

<SpSuggest hint="suggest() never throws. Unparseable input is an empty ranking, not an exception." />

## Complete as they type

`complete()` answers the other half of a live input: not "what does this mean?"
but "what could this half-typed word still become?". It rewrites the whole
input, so the returned `text` goes straight back into the box.

<SpComplete
  model-value="30 ho"
  :examples="['30 ho', '5 kilog', '2 km in mil', '10 kg + 5 gram', '90 minu']"
  hint="Ranked by the same weights that rank readings, plus a prefix-quality term and a magnitude fit — 30 of something is far likelier to be hours than hectares." />

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

## Add money

Currencies are a kind like any other, except that their unit ratios are not
constants. They live in `@smartput/rate`, which you register alongside the
built-ins and hand a rate table:

```sh
bun add @smartput/rate
```

```ts
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";

const engine = createEngine({
  // moneyEn is "quid", "bucks" — colloquial English currency words. It joins
  // the same list the built-ins' words are in: one vocabulary per kind, per
  // language, so a kind's words travel with the language rather than beside it.
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn])],
  kinds: [...BUILTIN_KINDS, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 }),
});

engine.evaluate("30 usd in gbp").formatted; // "£22.94"
```

See [Money and rates](/packages/rate) for live rates, providers, and how a
derived cross-rate is disclosed.

## Where to go next

- [The pipeline](/guide/pipeline) — what happens between the string and the result.
- [Ambiguity and weights](/guide/weights) — the full four-layer model.
- [Completion](/guide/completion) — `complete()` in full.
- [Money and rates](/packages/rate) — `@smartput/rate`, providers, `createLiveEngine`.
- [API reference](/api/) — every exported symbol.

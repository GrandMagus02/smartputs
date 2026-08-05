---
title: API overview
description: Every symbol exported by @smartput/core, @smartput/rates and @smartput/math.
---

# API overview

All three packages are ESM only. Everything below is exported from the package
root unless stated otherwise.

## Entry points

| Subpath | Contents |
| --- | --- |
| `@smartput/core` | The engine, the define functions, kinds, facades, errors, types |
| `@smartput/core/locale/en` | The English locale descriptor (default export) |
| `@smartput/core/testing` | `assertKindContract` |
| `@smartput/rates` | The `money` kind, snapshots, providers, `createLiveEngine` |
| `@smartput/rates/locale/en` | Colloquial English currency words (default export) |
| `@smartput/math` | `createMathEngine`, the LaTeX surface, the operator words |

## Functions

| Export | Purpose |
| --- | --- |
| [`createEngine(opts)`](/api/create-engine) | Compose locales, kinds and packs into an `Engine`. |
| [`defineKind(kind)`](/api/define-kind) | Declare a kind. Returns a frozen descriptor. |
| [`defineLocale(locale)`](/api/define-locale) | Declare language mechanics. Returns a frozen descriptor. |
| [`defineLocalePack(pack)`](/api/define-locale#definelocalepack) | Contribute vocabulary to an existing locale. |
| [`createFacades(args)`](/api/facade) | One generated `Quantity` class per registered kind. |
| [`createFacade(args)`](/api/facade#createfacade) | The single-kind form. |
| `createAnalyzerChain(analyzers)` | Compose analyzers into a memoized chain. |
| `identity()` | Analyzer: retain the exact surface form at weight 0. |
| `suffixStripper(opts)` | Analyzer: strip inflectional suffixes at a penalty. |
| `tableAnalyzer(map, weight?)` | Analyzer: map irregular forms to lemmas. |
| [`cardinalNumerals(opts)`](/api/define-locale#numerals) | Build a `NumeralParser` from unit / tens / scale tables. |
| `formatValue(value, registry, locale, opts?)` | The formatter the engine uses, exposed. |
| `formatNumber(value, locale, opts?)` | Locale number grammar alone, no unit. |

## Values

| Export | Type |
| --- | --- |
| `BUILTIN_KINDS` | `Kind[]` — `number`, `percent`, `length`, `mass`, `duration`, `temperature`, `tempdelta`, `angle`, `datasize`, `speed`, `area`, `volume` |
| each of those by name | the individual `Kind` descriptors |
| `measure` | typographic units. Exported by name only — **not** in `BUILTIN_KINDS`, because its `mm`/`cm` collide with `length`. |
| `DISPLAY_PRECISION` | `26` — significant digits in formatted output, two guard digits below the 28 `Decimal` computes at |
| `EXACT_BONUS`, `LENGTH_PENALTY`, `SCALE_BONUS` | the [completion](/api/complete#scoring) scoring constants |
| `Decimal` | re-exported from `decimal.js`, so callers need not add the dependency |

## @smartput/rates

| Export | Purpose |
| --- | --- |
| [`money`](/api/rates#money) | The money `Kind`. Register it and supply `rates`. |
| [`snapshot(base, asOf, table)`](/api/rates#snapshot) | Build a dated, immutable `RateSnapshot`. |
| [`createLiveEngine(opts)`](/api/rates#createliveengine) | Async facade: fetch, cache, TTL, one shared in-flight request. |
| [`ecb(opts?)`](/api/rates#ecb) | ECB daily reference rates provider. |
| [`custom(fn)`](/api/rates#custom) | Wrap any async source in the provider shape. |
| [`CURRENCIES`](/api/rates#currencies) | The twelve currency descriptors, keyed by lowercase ISO code. |

## @smartput/math

| Export | Purpose |
| --- | --- |
| [`createMathEngine()`](/api/math#createmathengine) | The LaTeX engine: evaluate, simplify, solve, systems, analysis, matrices, calculus, descriptions. |
| [`describeOperator(symbol)`](/api/math#describe-and-operator-words) | The English word for an operator, or `null`. |
| [`OPERATOR_WORDS`](/api/math#describe-and-operator-words) | The symbol-to-word table itself. |
| [`ruleForOperator(op)`](/api/math#step) · [`titleForRule(rule)`](/api/math#step) | Step rule ids and their English titles. |

## Errors

Every error extends `SmartputError`. See [Errors](/guide/errors).

`UnitParseError` · `AmbiguityError` · `NoCandidateError` ·
`DimensionMismatchError` · `TooAmbiguousError` · `KindConflictError` ·
`UnknownKindError` · `DivideByZeroError` · `MissingRateError` ·
`RateProviderError` · `RatesNotReadyError`

The last three are defined in core and raised from `@smartput/rates`, so
`instanceof` works across the package boundary. `@smartput/math` defines its own
— `MathError` and its four subclasses — which extend `SmartputError` for the
same reason.

## Types

`Engine` · `EngineOptions` · `EvalOptions` · `Result` · `Explanation` ·
`Completion` · `CompleteOptions` · `Value` · `Candidate` · `ResultCandidate` ·
`Assumption` · `Kind` · `RatioSpec` · `OpaqueSpec` · `UnitDef` · `OpSignature` ·
`Lexicon` · `UnitLexeme` · `Locale` · `LocalePack` · `Analyzer` ·
`AnalyzedForm` · `NumeralParser` · `NumeralMatch` · `RateLookup` · `EvalCtx` ·
`FormatCtx` · `FormatOptions` · `Weights` · `Selector` · `Span` · `Token` ·
`KindId` · `OpSymbol` · `Keyword` · `Quantity` · `QuantityClass` ·
`QuantityInput` · `QuantitySnapshot`

Full definitions: [Types](/api/types).

## Shape of a call

```ts
import { BUILTIN_KINDS, createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

engine.evaluate("1 kg + 500 g"); // Result       — strict, throws
engine.suggest("10 m"); // Result[]     — ranked, never throws
engine.coerce("mass", "1 kg"); // Value        — type-directed
engine.explain("10 m + 5 min"); // Explanation  — tokens, candidates, scores
engine.complete("30 ho"); // Completion[] — units the fragment could become
```

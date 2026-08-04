---
title: API overview
description: Every symbol exported by @smartput/core.
---

# API overview

`@smartput/core` is ESM only. Everything below is exported from the package
root unless stated otherwise.

## Entry points

| Subpath | Contents |
| --- | --- |
| `@smartput/core` | The engine, the define functions, kinds, errors, types |
| `@smartput/core/locale/en` | The English locale descriptor (default export) |
| `@smartput/core/testing` | `assertKindContract` |

## Functions

| Export | Purpose |
| --- | --- |
| [`createEngine(opts)`](/api/create-engine) | Compose locales, kinds and packs into an `Engine`. |
| [`defineKind(kind)`](/api/define-kind) | Declare a kind. Returns a frozen descriptor. |
| [`defineLocale(locale)`](/api/define-locale) | Declare language mechanics. Returns a frozen descriptor. |
| [`defineLocalePack(pack)`](/api/define-locale#definelocalepack) | Contribute vocabulary to an existing locale. |
| `createAnalyzerChain(analyzers)` | Compose analyzers into a memoized chain. |
| `identity()` | Analyzer: retain the exact surface form at weight 0. |
| `suffixStripper(opts)` | Analyzer: strip inflectional suffixes at a penalty. |
| `tableAnalyzer(map, weight?)` | Analyzer: map irregular forms to lemmas. |

## Values

| Export | Type |
| --- | --- |
| `BUILTIN_KINDS` | `Kind[]` — `[number, length, mass, duration]` |
| `number`, `length`, `mass`, `duration` | the individual `Kind` descriptors |
| `Decimal` | re-exported from `decimal.js`, so callers need not add the dependency |

## Errors

Every error extends `SmartputError`. See [Errors](/guide/errors).

`UnitParseError` · `AmbiguityError` · `NoCandidateError` ·
`DimensionMismatchError` · `TooAmbiguousError` · `KindConflictError` ·
`UnknownKindError` · `DivideByZeroError`

## Types

`Engine` · `EngineOptions` · `EvalOptions` · `Result` · `Explanation` ·
`Value` · `Candidate` · `Kind` · `RatioSpec` · `OpaqueSpec` · `UnitDef` ·
`OpSignature` · `Lexicon` · `UnitLexeme` · `Locale` · `LocalePack` ·
`Analyzer` · `AnalyzedForm` · `Weights` · `Selector` · `Span` · `Token` ·
`KindId` · `OpSymbol` · `Keyword`

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
```

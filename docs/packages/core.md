---
title: "@smartput/core"
description: "The engine: normalize, tokenize, parse, solve, eval, print."
---

# @smartput/core

Everything that turns text into a `Result`, and nothing that knows
what a metre is. `createEngine()` composes locales and kinds into the six-stage
pipeline; `defineKind()` and `defineLocale()` are how anything gets into it.

One runtime dependency, `decimal.js`, and that is a deliberate ceiling —
`check-deps.ts` fails the build if a second one appears. Every stage is also
its own subpath, so a consumer that wants only the tokenizer pays for only the
tokenizer.

## Try it

<SpEvaluate model-value="1 kg + 500 g" />

<SpExplain model-value="10 m + 5 min" />

## Installing

```sh
npm add @smartput/core
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/core` | The package root. |
| `@smartput/core/testing` | `assertKindContract` — the contract every kind must satisfy. |
| `@smartput/core/normalize` | Stage 1: case, spacing, digits, punctuation. |
| `@smartput/core/tokenize` | Stage 2: text to `Token[]`. |
| `@smartput/core/parse` | Stage 3: tokens to candidate readings. |
| `@smartput/core/solve` | Stage 4: ranking, ambiguity, weights. |
| `@smartput/core/eval` | Stage 5: the arithmetic, in `Decimal`. |
| `@smartput/core/print` | Stage 6: `formatValue` and the locale number grammar. |
| `@smartput/core/registry` | The kind/locale registry the stages read. |
| `@smartput/core/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/core/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Runtime exports

Type-only exports are erased and do not appear here.

`AmbiguityError` · `Autocompleter` · `BOOLEAN_KIND` · `BOOLEAN_UNIT` · `COMPARE_PRECISION` · `COMPARISON_OPS` · `DISPLAY_PRECISION` · `Decimal` · `DimensionMismatchError` · `DivideByZeroError` · `EDIT_HEADROOM` · `EXACT_BONUS` · `Evaluator` · `KeywordConflictError` · `KindConflictError` · `LENGTH_PENALTY` · `LocaleMismatchError` · `MissingRateError` · `NUMBER_FALLBACK_WEIGHT` · `NUMBER_KIND` · `NoCandidateError` · `Normalizer` · `PERCENT_KIND` · `Parser` · `Printer` · `RateProviderError` · `RatesNotReadyError` · `SCALE_BONUS` · `SmartputError` · `Solver` · `Tokenizer` · `TooAmbiguousError` · `UnitParseError` · `UnknownKindError` · `VocabularyConflictError` · `aliasesFor` · `buildKeywords` · `buildProgram` · `buildRegistry` · `cardinalNumerals` · `cardinalSpeller` · `complete` · `composeLocale` · `compoundSplitter` · `createAnalyzerChain` · `createCachedEngine` · `createEngine` · `createFacade` · `createFacades` · `createSnapshotCache` · `decimalRatios` · `defineKind` · `defineLanguage` · `defineVocabulary` · `deriveValue` · `editDistance` · `evaluateNode` · `foldLiterals` · `formatNumber` · `formatValue` · `generateComparisonOps` · `identity` · `nearestWord` · `normalize` · `phraseAnalyzer` · `prefixStripper` · `scriptSegmenter` · `solve` · `suffixStripper` · `tableAnalyzer` · `walk` · `wordsFor`

## Dependencies

- `decimal.js`

## See also

- [The pipeline](/guide/pipeline)
- [createEngine](/api/create-engine)
- [Engine](/api/engine)


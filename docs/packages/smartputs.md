---
title: "@smartput/smartputs"
description: "The unscoped install name. Everything `@smartput/core` is, under one word."
---

# @smartput/smartputs

```sh
bun i smartputs
```

Every subpath, every export and every object identity of
[`@smartput/core`](/packages/core), re-exported under the name someone types
when they have heard of this project and not of its package layout.
`smartputs/locale/en` is `@smartput/core/locale/en`; `smartputs/solve` is
`@smartput/core/solve`. There is nothing else in it, and `parity.test.ts`
asserts that subpath by subpath rather than trusting the generator that wrote
the re-exports.

**Read this part before installing.** This is the engine, and an engine with no
kinds registered cannot read anything — it fails loudly rather than quietly:

```ts
import { composeLocale, createEngine } from "smartputs";
import { english } from "smartputs/locale/en";

createEngine({ locales: [], kinds: [] });
// Error: createEngine requires at least one locale

createEngine({ locales: [composeLocale(english, [])], kinds: [] })
  .evaluate("2 km in m");
// NoCandidateError: Unknown unit "km"
```

Which kinds to register is the one decision nobody can make for you, so this
package does not make it. Add the kinds you want beside it —
[`@smartput/length`](/packages/length) alone, or
[`@smartput/kinds`](/packages/kinds) for all seventeen — and compose a locale:

```sh
bun i smartputs @smartput/kinds
```

If you only want to read one kind out of a form field, you want none of this:
[`@smartput/length/validate`](/packages/length) is 1.5 KB and has no engine in
it at all.

## Try it

<SpEvaluate model-value="1 kg + 500 g" />

<SpExplain model-value="10 m + 5 min" />

## Installing

```sh
npm add @smartput/smartputs
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/smartputs` | The package root. |
| `@smartput/smartputs/testing` | Test helpers, not shipped to consumers. |
| `@smartput/smartputs/normalize` | See the source for what this subpath carries. |
| `@smartput/smartputs/tokenize` | See the source for what this subpath carries. |
| `@smartput/smartputs/parse` | See the source for what this subpath carries. |
| `@smartput/smartputs/solve` | See the source for what this subpath carries. |
| `@smartput/smartputs/eval` | See the source for what this subpath carries. |
| `@smartput/smartputs/print` | See the source for what this subpath carries. |
| `@smartput/smartputs/registry` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/smartputs/locale/de` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/fr` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/es` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/pt` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/it` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/nl` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/zh` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/ja` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/ar` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/ru` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/pl` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/tr` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/hi` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/ko` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/id` | See the source for what this subpath carries. |
| `@smartput/smartputs/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |

## Runtime exports

Type-only exports are erased and do not appear here.

`AmbiguityError` · `Autocompleter` · `BOOLEAN_KIND` · `BOOLEAN_UNIT` · `COMPARE_PRECISION` · `COMPARISON_OPS` · `DISPLAY_PRECISION` · `Decimal` · `DimensionMismatchError` · `DivideByZeroError` · `EDIT_HEADROOM` · `EXACT_BONUS` · `Evaluator` · `KeywordConflictError` · `KindConflictError` · `LENGTH_PENALTY` · `LocaleMismatchError` · `MissingRateError` · `NUMBER_FALLBACK_WEIGHT` · `NUMBER_KIND` · `NoCandidateError` · `Normalizer` · `PERCENT_KIND` · `Parser` · `Printer` · `RateProviderError` · `RatesNotReadyError` · `SCALE_BONUS` · `SmartputError` · `Solver` · `Tokenizer` · `TooAmbiguousError` · `UnitParseError` · `UnknownKindError` · `VocabularyConflictError` · `aliasesFor` · `buildKeywords` · `buildProgram` · `buildRegistry` · `cardinalNumerals` · `cardinalSpeller` · `complete` · `composeLocale` · `compoundSplitter` · `createAnalyzerChain` · `createCachedEngine` · `createEngine` · `createFacade` · `createFacades` · `createSnapshotCache` · `decimalRatios` · `defineKind` · `defineLanguage` · `defineVocabulary` · `deriveValue` · `editDistance` · `evaluateNode` · `foldLiterals` · `formatNumber` · `formatValue` · `generateComparisonOps` · `identity` · `nearestWord` · `normalize` · `phraseAnalyzer` · `prefixStripper` · `scriptSegmenter` · `solve` · `suffixStripper` · `tableAnalyzer` · `walk` · `wordsFor`

## Dependencies

- [`@smartput/core`](/packages/core)

## See also

- [@smartput/core](/packages/core)
- [The pipeline](/guide/pipeline)
- [createEngine](/api/create-engine)


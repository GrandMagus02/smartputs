---
title: "@smartput/kind"
description: "The layer a kind and a language are written in, with no engine in it."
---

# @smartput/kind

`defineKind`, `defineVocabulary`, `decimalRatios`,
`aliasesFor`, `deriveValue`, the `Decimal` every ratio is carried in, the
`SmartputError` hierarchy, and the types all of it is spelled with.

It was `@smartput/core`'s until the edge was found running the wrong way:
seventeen leaf packages named the engine in order to say what a kilometre is,
which is a fact about metres and has nothing to do with parsing a sentence —
and core named four of them back as devDependencies, closing the loop. The
split is by **layer**: core is the pipeline (normalize, tokenize, parse, solve,
eval, print), and this is what the pipeline agrees with a kind about before it
runs.

Core re-exports every name here unchanged, so nothing that imported them from
`@smartput/core` had to stop. Writing a new kind, though, should name this
package and not the engine — that is the whole point of it existing.

It did **not** make anything smaller. A kind package's bundle barely moved,
because what it was carrying was `decimal.js` and never the pipeline; the
change bought layering, and `scripts/check-size.ts` records the 240 B per
core-consuming bundle that it cost.

## Try it

<SpCustomKind />

## Installing

```sh
npm add @smartput/kind
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/kind` | The package root. |
| `@smartput/kind/types` | Type declarations only — erased at runtime. |
| `@smartput/kind/decimal` | See the source for what this subpath carries. |
| `@smartput/kind/freeze` | See the source for what this subpath carries. |
| `@smartput/kind/errors` | See the source for what this subpath carries. |
| `@smartput/kind/define` | See the source for what this subpath carries. |
| `@smartput/kind/from-table` | See the source for what this subpath carries. |
| `@smartput/kind/ratio-ops` | See the source for what this subpath carries. |
| `@smartput/kind/vocabulary` | See the source for what this subpath carries. |

## Runtime exports

Type-only exports are erased and do not appear here.

`AmbiguityError` · `BOOLEAN_KIND` · `BOOLEAN_UNIT` · `COMPARE_PRECISION` · `COMPARISON_OPS` · `Decimal` · `DimensionMismatchError` · `DivideByZeroError` · `KeywordConflictError` · `KindConflictError` · `LocaleMismatchError` · `MissingRateError` · `NUMBER_KIND` · `NoCandidateError` · `PERCENT_KIND` · `RateProviderError` · `RatesNotReadyError` · `SmartputError` · `TooAmbiguousError` · `UnitParseError` · `UnknownKindError` · `VocabularyConflictError` · `aliasesFor` · `decimalRatios` · `deepFreeze` · `defineKind` · `defineVocabulary` · `deriveValue` · `generateComparisonOps` · `generateRatioOps` · `normalizeKind`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| kind root (defineKind, with Decimal behind it) | ≤ 33.5 kB | ≤ 13.3 kB |
| kind/vocabulary defineVocabulary only | ≤ 33.5 kB | ≤ 13.3 kB |

## Dependencies

- `decimal.js`

## See also

- [Defining a kind](/guide/kinds)
- [Vocabularies and languages](/guide/languages)


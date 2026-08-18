# smartputs

> The unscoped install name. Everything `@smartput/core` is, under one word.

```sh
bun i smartputs
```

Every subpath, every export and every object identity of
[`@smartput/core`](../core/README.md), re-exported under the name someone types
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
[`@smartput/length`](../length/README.md) alone, or
[`@smartput/kinds`](../kinds/README.md) for all seventeen — and compose a locale:

```sh
bun i smartputs @smartput/kinds
```

If you only want to read one kind out of a form field, you want none of this:
[`@smartput/length/validate`](../length/README.md) is 1.5 KB and has no engine in
it at all.

## Setup

```sh
npm add smartputs
```

## Example

```ts
import { composeLocale, createEngine } from "smartputs";
import { english } from "smartputs/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const engine = createEngine({
  locales: [composeLocale(english, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

engine.evaluate("1 kg + 500 g").formatted  // "1.5 kilograms"
engine.evaluate("2 km in m").formatted     // "2,000 metres"
engine.evaluate("20% of 250").formatted    // "50"
```

Note what is imported and what is not. `smartputs` is the engine and
nothing else: it depends on `@smartput/core` and on nothing further, so the
`@smartput/kinds` line above is not decoration. Installing this package alone
gets you an engine that cannot read anything — `createEngine({ locales: [],
kinds: [] })` throws `createEngine requires at least one locale`, and giving it
a locale but no kinds gets you `NoCandidateError: Unknown unit "km"` on the
first thing you evaluate.

That is deliberate. Which kinds to register is the one decision nobody can make
for you, and a convenience package that answered it by pulling all seventeen
would make the shortest install name the heaviest thing in the repo. So:
`bun i smartputs @smartput/kinds` for everything, or a single kind package if
that is all you need.

If you only want to validate one kind out of a form field, you want none of
this: `@smartput/length/validate` is 1.5 KB and has no engine in it.

## Entry points

| Import | Contents |
| --- | --- |
| `smartputs` | The package root. |
| `smartputs/testing` | Test helpers, not shipped to consumers. |
| `smartputs/normalize` | See the source for what this subpath carries. |
| `smartputs/tokenize` | See the source for what this subpath carries. |
| `smartputs/parse` | See the source for what this subpath carries. |
| `smartputs/solve` | See the source for what this subpath carries. |
| `smartputs/scan` | See the source for what this subpath carries. |
| `smartputs/eval` | See the source for what this subpath carries. |
| `smartputs/print` | See the source for what this subpath carries. |
| `smartputs/registry` | See the source for what this subpath carries. |
| `smartputs/locale/en` | English vocabulary for this package's kinds (default export). |
| `smartputs/locale/de` | See the source for what this subpath carries. |
| `smartputs/locale/fr` | See the source for what this subpath carries. |
| `smartputs/locale/es` | See the source for what this subpath carries. |
| `smartputs/locale/pt` | See the source for what this subpath carries. |
| `smartputs/locale/it` | See the source for what this subpath carries. |
| `smartputs/locale/nl` | See the source for what this subpath carries. |
| `smartputs/locale/zh` | See the source for what this subpath carries. |
| `smartputs/locale/ja` | See the source for what this subpath carries. |
| `smartputs/locale/ar` | See the source for what this subpath carries. |
| `smartputs/locale/ru` | See the source for what this subpath carries. |
| `smartputs/locale/pl` | See the source for what this subpath carries. |
| `smartputs/locale/tr` | See the source for what this subpath carries. |
| `smartputs/locale/hi` | See the source for what this subpath carries. |
| `smartputs/locale/ko` | See the source for what this subpath carries. |
| `smartputs/locale/id` | See the source for what this subpath carries. |
| `smartputs/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |
| `smartputs/locale/<id>` | One language's words for this kind. 17 ship: `en`, `de`, `fr`, `es`, `pt`, `it`, `nl`, `zh`, `ja`, `ar`, `ru`, `pl`, `tr`, `hi`, `ko`, `id`, `uk`. |

## Runtime exports

Type-only exports are erased and do not appear here.

`AmbiguityError` · `Autocompleter` · `BOOLEAN_KIND` · `BOOLEAN_UNIT` · `COMPARE_PRECISION` · `COMPARISON_OPS` · `CUE_CEILING` · `CountQueryError` · `DEFAULT_CUE_WINDOW` · `DEFAULT_MAX_SPAN` · `DISPLAY_PRECISION` · `Decimal` · `DimensionMismatchError` · `DivideByZeroError` · `EDIT_HEADROOM` · `EXACT_BONUS` · `Evaluator` · `KeywordConflictError` · `KindConflictError` · `LENGTH_PENALTY` · `LocaleMismatchError` · `MissingRateError` · `NUMBER_FALLBACK_WEIGHT` · `NUMBER_KIND` · `NoCandidateError` · `Normalizer` · `PERCENT_KIND` · `Parser` · `Printer` · `RateProviderError` · `RatesNotReadyError` · `SCALE_BONUS` · `Scanner` · `SmartputError` · `Solver` · `Tokenizer` · `TooAmbiguousError` · `UnitParseError` · `UnknownKindError` · `VocabularyConflictError` · `aliasesFor` · `buildKeywords` · `buildProgram` · `buildRegistry` · `cardinalNumerals` · `cardinalSpeller` · `collectCues` · `complete` · `composeLocale` · `compoundSplitter` · `createAnalyzerChain` · `createCachedEngine` · `createEngine` · `createFacade` · `createFacades` · `createSnapshotCache` · `decimalRatios` · `defineKind` · `defineLanguage` · `defineVocabulary` · `deriveValue` · `editDistance` · `evaluateNode` · `foldLiterals` · `formatNumber` · `formatValue` · `generateComparisonOps` · `identity` · `nearestWord` · `normalize` · `phraseAnalyzer` · `prefixStripper` · `scriptSegmenter` · `solve` · `suffixStripper` · `tableAnalyzer` · `walk` · `wordsFor`

## Dependencies

- [`@smartput/core`](../core/README.md)

## What it costs

Ceilings, not measurements. `bun run check-size` bundles each entry with
`bun build --minify` and fails if a row crosses its ceiling **or drops more
than 30 % below it** — a budget that is only an upper bound reports a vanished
graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| smartputs root (the facade over core) | ≤ 87.1 kB | ≤ 31.4 kB |

---

Generated by `scripts/gen-readmes.ts` — run `bun run docs:readmes`. Every
output above was produced by running the line beside it. The full page, with
live demos, is [`docs/packages/smartputs.md`](../../docs/packages/smartputs.md).

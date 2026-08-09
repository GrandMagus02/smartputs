---
title: API overview
description: Every symbol exported by @smartput/core, @smartput/kinds, @smartput/rate, @smartput/datetime and @smartput/math.
---

# API overview

Every package is ESM only. Everything below is exported from the package root
unless stated otherwise.

## Entry points

| Subpath | Contents |
| --- | --- |
| `@smartput/core` | The engine, the define functions, facades, errors, types |
| `@smartput/core/locale/en` | The English locale descriptor (default export) |
| `@smartput/core/testing` | `assertKindContract` |
| `@smartput/kinds` | The built-in kinds, by name and as `BUILTIN_KINDS` |
| `@smartput/rate` | The `money` kind, snapshots, providers, `createLiveEngine` |
| `@smartput/rate/locale/en` | Colloquial English currency words (default export) |
| `@smartput/datetime` | The `datetime` kind, the chrono bridge, `Temporal` |
| `@smartput/timezone` | Zone tables and the written-offset parser, with no dependencies |
| `@smartput/datetime/locale/en` | English zone words (default export) |
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
| [`foldLiterals(tokens, input, registry, ctx)`](/api/define-kind#literals) | The literal token pass, exposed so a matcher can be tested without an engine. |

## Values

| Export | Type |
| --- | --- |
| `BUILTIN_KINDS` | `Kind[]` — `number`, `percent`, `length`, `mass`, `duration`, `temperature`, `tempdelta`, `angle`, `datasize`, `speed`, `area`, `volume`. From `@smartput/kinds`. |
| each of those by name | the individual `Kind` descriptors, also from `@smartput/kinds` |
| `measure` | typographic units, from `@smartput/kinds`. Exported by name only — **not** in `BUILTIN_KINDS`, because its `mm`/`cm` collide with `length`. |
| `DISPLAY_PRECISION` | `26` — significant digits in formatted output, two guard digits below the 28 `Decimal` computes at |
| `EXACT_BONUS`, `LENGTH_PENALTY`, `SCALE_BONUS` | the [completion](/api/complete#scoring) scoring constants |
| `Decimal` | re-exported from `decimal.js`, so callers need not add the dependency |

## @smartput/rate

| Export | Purpose |
| --- | --- |
| [`money`](/api/rate#money) | The money `Kind`. Register it and supply `rates`. |
| [`snapshot(base, asOf, table)`](/api/rate#snapshot) | Build a dated, immutable `RateSnapshot`. |
| [`createLiveEngine(opts)`](/api/rate#createliveengine) | Async facade: fetch, cache, TTL, one shared in-flight request. |
| [`ecb(opts?)`](/api/rate#ecb) | ECB daily reference rates provider. |
| [`custom(fn)`](/api/rate#custom) | Wrap any async source in the provider shape. |
| [`CURRENCIES`](/api/rate#currencies) | Re-exported from `@smartput/currency`. The twelve currency descriptors, keyed by lowercase ISO code. |

## @smartput/currency

| Export | Purpose |
| --- | --- |
| [`CURRENCIES`](/api/currency#currencies) | The twelve currency descriptors, keyed by lowercase ISO code. |
| [`currencyLexicon()`](/api/currency#currencylexicon) | The vocabulary a money kind registers: aliases, symbol, plurals, typical band. |
| [`parseCurrency(word)`](/api/currency#parsecurrency) | The ISO code a word names, or `null`. |
| [`parseAmount(input, opts?)`](/api/currency#parseamount) | `"30 usd"` to an amount and a currency, with no engine. |
| [`formatAmount(amount, code, opts?)`](/api/currency#formatamount) | `-$10.00`: minor units, symbol, sign. |
| [`Currency`](/api/currency#currency) | The class door — `Currency.for("dollars")`. |

## @smartput/datetime

| Export | Purpose |
| --- | --- |
| [`datetime`](/guide/datetime) | The `datetime` `Kind`. Register it and set `now` / `timeZone`. |
| `parseDateTime(input, offset, ctx)` | The chrono bridge, exposed for testing a match in isolation. |
| `wrap(zdt)` / `unwrap(value)` | The `Value` ⇄ `Temporal.ZonedDateTime` boundary. |
| `Temporal` | Re-exported from `temporal-polyfill` — the package's single import site. |
| `DATETIME_KIND` | `"datetime"`, so a patch or op signature need not spell it. |

## @smartput/timezone

| Export | Purpose |
| --- | --- |
| `ZONES` | The eighteen named time zones, keyed by IANA id. |
| [`OFFSET_ZONES`](/guide/datetime#offset-zones) | Every quarter hour from `-12:00` to `+14:00`, keyed by Temporal zone id. |
| `parseOffsetZone(text)` | Reads `GMT+3` / `utc-05:30` at the start of `text` into a zone id and a length. |
| `offsetZoneId(minutes)` | Minutes east of UTC as a zone id: `180` → `"+03:00"`. |
| `zoneSymbol(zone)` | What a formatter prints for a zone id, falling back to the id. |
| `ZoneDef` · `OffsetMatch` | The two row types. |

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

The last three are defined in core and raised from `@smartput/rate`, so
`instanceof` works across the package boundary. `@smartput/math` defines its own
— `MathError` and its four subclasses — which extend `SmartputError` for the
same reason.

## Types

`Engine` · `EngineOptions` · `EvalOptions` · `Result` · `Explanation` ·
`Completion` · `CompleteOptions` · `Value` · `Candidate` · `ResultCandidate` ·
`Assumption` · `Kind` · `RatioSpec` · `OpaqueSpec` · `UnitDef` · `OpSignature` ·
`LiteralMatcher` · `LiteralMatch` · `MatchCtx` ·
`Lexicon` · `UnitLexeme` · `Locale` · `LocalePack` · `Analyzer` ·
`AnalyzedForm` · `NumeralParser` · `NumeralMatch` · `RateLookup` · `EvalCtx` ·
`FormatCtx` · `FormatOptions` · `Weights` · `Selector` · `Span` · `Token` ·
`KindId` · `OpSymbol` · `Keyword` · `Quantity` · `QuantityClass` ·
`QuantityInput` · `QuantitySnapshot`

Full definitions: [Types](/api/types).

## Shape of a call

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const en = composeLocale(english, BUILTIN_EN);
const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

engine.evaluate("1 kg + 500 g"); // Result       — strict, throws
engine.suggest("10 m"); // Result[]     — ranked, never throws
engine.coerce("mass", "1 kg"); // Value        — type-directed
engine.explain("10 m + 5 min"); // Explanation  — tokens, candidates, scores
engine.complete("30 ho"); // Completion[] — units the fragment could become
```

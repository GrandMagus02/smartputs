---
title: Playground
description: Every entry point of the engine, running live in your browser.
---

# Playground

Everything on this page runs `@smartput/core` in your browser, built from the
same source the test suite imports. Nothing is precomputed, and nothing is
proxied through a server.

The engine backing these demos is:

```ts
createEngine({ locales: [en], kinds: BUILTIN_KINDS })
```

## evaluate()

Strict. Returns one `Result` or throws.

<SpEvaluate
  model-value="1 kg + 500 g"
  :examples="[
    '1 kg + 500 g',
    '30 h - 30 min',
    '2 km in m',
    '10 m + 5 h',
    '10 km * 3',
    '(1 + 2) * 3',
    '-5 km',
    '1,500 g',
    '12 inch',
    '3 lbs',
    '1234567890123456789.0625 km',
  ]" />

## suggest()

Ranked, never throws. This is the entry point for a live input.

<SpSuggest
  model-value="10 m"
  :examples="['10 m', '10 s', '10 d', '10 m + 5 min', '5 kg + 3 km', 'nonsense']" />

## explain()

Tokens, candidates, and every term in the score. The debugging surface for
plugin authors, and the reason a scored solver is usable at all.

<SpExplain
  model-value="10 m + 5 min"
  :examples="['10 m', '10 m + 5 min', '1.5 kilograms', '2 feet in cm', '1 kg + 500 g']" />

## Weights

Four layers of additive selectors. This demo drives layer 3,
`createEngine({ weights })`.

<SpWeights />

## Conversion

<SpConvert />

## defineKind()

A kind is a table of units. Everything else has a default.

<SpCustomKind />

## Known corpus

These rows are asserted verbatim by the test suite in
`packages/core/corpus/en.tsv` — the regression suite grows with every bug
report.

| input | kind | canonical | formatted |
| --- | --- | --- | --- |
| `10 km` | length | 10000 | `10km` |
| `1 kg + 500 g` | mass | 1500 | `1.5 kilograms` |
| `30 h - 30 min` | duration | 106200 | `29.5h` |
| `10 m + 5 h` | duration | 18600 | `310min` |
| `10 m + 5 km` | length | 5010 | `5,010m` |
| `2 km in m` | length | 2000 | `2,000m` |
| `10 km * 3` | length | 30000 | `30km` |
| `(1 + 2) * 3` | number | 9 | `9` |
| `-5 km` | length | -5000 | `-5km` |
| `1,500 g` | mass | 1500 | `1,500g` |
| `12 inch` | length | 0.3048 | `12in` |
| `3 lbs` | mass | 1360.77711 | `3lb` |
| `2 wk` | duration | 1209600 | `2wk` |
| `1.5 kilograms` | mass | 1500 | `1.5 kilograms` |
| `1234567890123456789.0625 km` | length | 1234567890123456789062.5 | `1,234,567,890,123,456,789.0625km` |

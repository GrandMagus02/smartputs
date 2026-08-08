---
title: Playground
description: Every entry point of the engine, running live in your browser.
---

# Playground

Everything on this page runs `@smartput/core` in your browser, built from the
same source the test suite imports. Nothing is precomputed, and nothing is
proxied through a server.

The engine backing most of these demos is:

```ts
const en = composeLocale(english, BUILTIN_EN);
createEngine({ locales: [en], kinds: BUILTIN_KINDS })
```

The money demos add one kind, its words, and a rate table:

```ts
createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn])],
  kinds: [...BUILTIN_KINDS, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412, /* … */ }),
})
```

Those rates are a checked-in snapshot, not live quotes — a static site cannot
reach the ECB endpoint.

Results are displayed at **four decimal places**. That trim lives in this
site's theme, not in the library: the engine computes at 28 significant digits
and `formatted` carries 26, which is what the corpus tables at the bottom of
this page assert.

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

## complete()

Prefix completion over every registered unit. `↓` `↑` to move, Enter or Tab to
accept. The rewritten text is the whole input, so it goes straight back in the
box.

<SpComplete
  model-value="30 ho"
  :examples="[
    '30 ho',
    '5 kilog',
    '45 sec',
    '12 inc',
    '2 wee',
    '250 millim',
    '2 km in mil',
    '10 kg + 5 gram',
    '600 mi',
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

## Money

A kind whose unit ratios are not constants — they come from the injected rate
table. Pick a pair that is not quoted against the euro and the result says the
rate was derived.

<SpMoney />

<SpEvaluate
  with-money
  title="engine.evaluate(input) — money registered"
  model-value="30 usd in gbp"
  :examples="[
    '30 usd in gbp',
    '30 usd - 10 eur',
    '10 usd + 5 eur',
    '100 usd in uah',
    '30 quid in usd',
    '5 bucks',
    '(1 usd / 3) * 3',
    '1000 jpy in eur',
    '100 eur / 4',
  ]" />

## Completion with money registered

Currencies compete for the fragment on the same terms as every other unit —
there is no currency-specific code path in `complete()`.

<SpComplete
  with-money
  title="engine.complete(input) — money registered"
  model-value="30 d"
  :examples="['30 d', '5 e', '100 p', '20 u', '1000 y', '30 dol']" />

## defineKind()

A kind is a table of units. Everything else has a default.

<SpCustomKind />

## Known corpus

These rows are asserted verbatim by the test suite — the regression suite grows
with every bug report.

### packages/core/corpus/en.tsv

| input | kind | canonical | formatted |
| --- | --- | --- | --- |
| `10 km` | length | 10000 | `10 kilometres` |
| `1 kg + 500 g` | mass | 1500 | `1.5 kilograms` |
| `30 h - 30 min` | duration | 106200 | `29.5 hours` |
| `10 m + 5 h` | duration | 18600 | `310 minutes` |
| `10 m + 5 km` | length | 5010 | `5,010 metres` |
| `2 km in m` | length | 2000 | `2,000 metres` |
| `10 km * 3` | length | 30000 | `30 kilometres` |
| `(1 + 2) * 3` | number | 9 | `9` |
| `-5 km` | length | -5000 | `-5 kilometres` |
| `1,500 g` | mass | 1500 | `1,500 grams` |
| `12 inch` | length | 0.3048 | `12 inches` |
| `3 lbs` | mass | 1360.77711 | `3 pounds` |
| `2 wk` | duration | 1209600 | `2 weeks` |
| `1.5 kilograms` | mass | 1500 | `1.5 kilograms` |
| `1234567890123456789.0625 km` | length | 1234567890123456789062.5 | `1,234,567,890,123,456,789.0625 kilometres` |
| `212 F in C` | temperature | 100 | `100°C` |
| `30 C - 20 C` | tempdelta | 10 | `10°C` |
| `20% of 50` | number | 10 | `10` |
| `50 + 20%` | number | 60 | `60` |
| `90 deg in rad` | angle | 1.570796326794896619231321691 | `1.5707963267948966192313217 radians` |
| `1 kib in b` | datasize | 1024 | `1,024 bytes` |
| `3 m * 4 m` | area | 12 | `12m²` |
| `100 km / 2 h` | speed | 13.88888888888888888888888889 | `13.888888888888888888888889m/s` |

### packages/rate/corpus/en.tsv

Against `snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 })`. Canonical is
in euros, the kind's canonical unit.

| input | canonical | formatted |
| --- | --- | --- |
| `30 usd` | 27.27272727272727272727272727 | `$30.00` |
| `30 usd - 10 eur` | 17.27272727272727272727272727 | `$19.00` |
| `100 usd in uah` | 90.90909090909090909090909091 | `₴4,136.36` |
| `10 usd in eur` | 9.090909090909090909090909091 | `€9.09` |
| `-10 usd` | -9.090909090909090909090909091 | `-$10.00` |
| `(1 usd / 3) * 3` | 0.909090909090909090909090909 | `$1.00` |
| `100 eur / 4` | 25 | `€25.00` |

### packages/core/corpus/en-complete.tsv

The top completion for a fragment, and the text it inserts.

| input | kind | unit | text |
| --- | --- | --- | --- |
| `30 ho` | duration | h | `30 hours` |
| `1 ho` | duration | h | `1 hour` |
| `0.5 ho` | duration | h | `0.5 hours` |
| `6 fo` | length | ft | `6 feet` |
| `1 fo` | length | ft | `1 foot` |
| `1,500 gram` | mass | g | `1,500 grams` |
| `2 kib` | datasize | kib | `2 kibibytes` |
| `20 cel` | temperature | c | `20 celsius` |
| `10 kg + 5 gram` | mass | g | `10 kg + 5 grams` |
| `2 km in mil` | length | mi | `2 km in mile` |

The last two are the load-bearing ones: only the trailing fragment completes,
and the count that drives pluralization is the one next to that fragment — not
the one at the front. `2 km in mil` has no count at all in front of the
fragment, so `select(1)` renders the singular, and `2 km in mile` evaluates.

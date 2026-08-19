<p align="center">
  <img src="docs/public/banner.svg" alt="smartputs" width="900"/>
</p>

<p align="center"><b>Human input, evaluated.</b></p>

<p align="center">
A TypeScript engine that reads what people actually type: units, durations and<br/>
arithmetic mixed together, in 17 languages. It gives you a decimal, a canonical unit,<br/>
and a confidence score.
</p>

---

```ts
engine.evaluate("1 kg + 500 g").formatted;      // 🧱 "1.5 kilograms"
engine.evaluate("30 h - 30 min").formatted;     // ⏱️ "29.5 hours"
engine.evaluate("212 F in C").formatted;        // 🌡️ "100°C"
engine.evaluate("3 ft in cm").formatted;        // 📏 "91.44 centimetres"
engine.evaluate("2 GB + 500 MB").formatted;     // 💾 "2.5 gigabytes"
engine.evaluate("twenty km").formatted;         // 🔤 "20 kilometres"
engine.evaluate("20% of 150").formatted;        // 🧮 "30"
engine.evaluate("100 km / 2 h").kind;           // 🚗 "speed"

engine.evaluate("10 m");
// ❓ AmbiguityError: "10 m" is ambiguous between duration:min, length:m
engine.suggest("10 m");
// 🤷 [ { kind: "duration", formatted: "10 minutes", confidence: 0.5 },
//      { kind: "length",   formatted: "10 metres",  confidence: 0.5 } ]
```

Smartputs keeps every reading an input could have, ranks them, and hands back the
winner with the confidence it earned. Ambiguity is data, not a failure. `"10 m"`
really is both minutes and metres, and the engine says so instead of guessing.

## Languages

Recognition reads every locale you install. Generation writes in the one you name.

| | | | |
| --- | --- | --- | --- |
| 🇬🇧 English `en` | 🇩🇪 German `de` | 🇫🇷 French `fr` | 🇪🇸 Spanish `es` |
| 🇮🇹 Italian `it` | 🇵🇹 Portuguese `pt` | 🇳🇱 Dutch `nl` | 🇵🇱 Polish `pl` |
| 🇺🇦 Ukrainian `uk` | 🇷🇺 Russian `ru` | 🇹🇷 Turkish `tr` | 🇸🇦 Arabic `ar` |
| 🇮🇳 Hindi `hi` | 🇮🇩 Indonesian `id` | 🇯🇵 Japanese `ja` | 🇰🇷 Korean `ko` |
| 🇨🇳 Chinese `zh` | | | |

```ts
// 🇩🇪 read German, print German
de.evaluate("zwei Kilometer plus 500 Meter").formatted; // "2,5 Kilometer"

// 🇺🇦 read Ukrainian, print Ukrainian (with the right case ending)
uk.evaluate("5 кілограмів + 500 грамів").formatted;    // "5,5 кілограма"

// 🌍 one engine, several locales: read anything, print in English
en.evaluate("5 кілограмів + 500 грамів").formatted;    // "5.5 kilograms"
```

Each locale is its own entry point under `@smartput/core/locale/*`, and each kind ships
its words per language beside it (`@smartput/mass/locale/uk`). Recognition runs an
analyzer chain rather than an alias list, so `"kilograms"` reaches `"kilogram"` without
listing every form. Plurals come from `Intl.PluralRules`.

## Install

```sh
bun i smartputs @smartput/kinds     # 📦 the engine, plus every built-in kind
```

`smartputs` is `@smartput/core` under a name you can remember. Same subpaths, same
exports, same object identities, checked subpath by subpath in its own
`parity.test.ts`. Install `@smartput/core` directly if you prefer the scope; the byte
counts agree exactly.

The second half is required. The engine registers no kinds until you give it some, so
`smartputs` alone throws on the first thing you evaluate. Take
[`@smartput/kinds`](docs/packages/kinds.md) for all seventeen, or a single package like
`@smartput/length` if that is all you need.

**Only validating one field?** Skip the engine. Every kind ships a 1.5 KB
engine-free parser, and that is what most people actually want:

```sh
bun i @smartput/length              # 🪶 @smartput/length/validate, no engine inside
```

ESM only, types included. `@smartput/core` has two runtime dependencies,
`decimal.js` and [`@smartput/kind`](docs/packages/kind.md), and `bun run check-deps`
fails the repo on a third.

## Build an engine

An engine is a composition of frozen descriptors: locales, kinds, and optional weight
overrides. Nothing is global, so engines with different options coexist in one process.

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const engine = createEngine({
  locales: [composeLocale(english, BUILTIN_EN)], // 🗣️ every language the engine reads
  kinds: BUILTIN_KINDS,                          // 📐 number, percent, length, mass, …
});
```

`createEngine` registers nothing on its own. Without kinds the engine has no
vocabulary and every unit raises `NoCandidateError`.

## Evaluate

```ts
const result = engine.evaluate("1 kg + 500 g");

result.formatted;                  // "1.5 kilograms"
result.kind;                       // "mass"
result.value.canonical.toString(); // "1500"  ⚖️ grams, the canonical unit
result.value.unit;                 // "kg"    👈 the left operand's unit
result.confidence;                 // 1
```

### Six entry points

`evaluate()` is strict and throws, which makes it wrong for a keystroke-rate input where
ambiguity is normal. Use `suggest()` there.

| Method | On ambiguity | Returns |
| --- | --- | --- |
| `evaluate(input)` | throws `AmbiguityError` | one `Result` |
| `suggest(input)` | ranks | `Result[]`, possibly empty; never throws |
| `coerce(kind, input)` | resolved by the hard kind constraint | a `Value` |
| `explain(input)` | shows the scoring | an `Explanation` |
| `complete(input)` | ranks the units the fragment could become | `Completion[]` |
| `scan(text)` | ranks, per mark | `Mark[]`, possibly empty; never throws |

```ts
engine.complete("30 ho");
// ⌨️ [ { alias: "hour", text: "30 hours", kind: "duration", unit: "h", … } ]
```

`evaluate` and friends read the whole string as one expression. `scan` finds the
quantities inside a sentence and marks each one. The words around a mark argue for a
kind:

```ts
engine.scan("My house is 5km from work");
// 🏠 [ { start: 12, end: 15, text: "5km", readings: [ { kind: "length", … } ] } ]

engine.scan("Will be in time in 5m")[0].readings.map((r) => r.kind);
// ⏰ [ "duration", "length" ]
//    "in" and "time" argue for minutes; the metres reading
//    survives at 0.018 instead of being deleted
```

If your domain knows that `m` always means metres, say so once:

```ts
const engine = createEngine({
  locales: [en],
  kinds: BUILTIN_KINDS,
  weights: { "duration:min": -20 }, // 🚫 "m" never means minutes here
});

engine.evaluate("10 m").formatted; // "10 metres"
```

### Money, with your own rates

Ratios come from a dated table you inject. A rate derived through the base currency is
disclosed, never implied.

```ts
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn])],
  kinds: [...BUILTIN_KINDS, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 }), // 📅 dated
});

engine.evaluate("30 usd in gbp").formatted; // 💷 "£22.94"
```

## What you get

- **One expression, many kinds.** Cross-kind operations are declared as signatures, so
  the evaluator never hardcodes a domain.
- **Completion, not just evaluation.** `complete()` rewrites the whole input, so what it
  hands back always evaluates. Ranked by the same weights, plus a magnitude fit.
- **Decimal all the way down.** Every value is a `decimal.js` `Decimal` in a canonical
  unit; a 23-significant-digit input survives the pipeline intact.
- **Built for inflected languages.** Analyzer chains for recognition,
  `Intl.PluralRules` for generation. See [Languages](#languages).
- **A 1.5 KB door for one field.** Asking whether `"30deg"` is valid does not need a
  registry and a Pratt parser. Every kind ships an engine-free `parseX`, and its size is
  a budget `bun run check-size` enforces.
- **A new kind is five lines.** `defineKind` takes an id and a unit table; aliases,
  arithmetic and `in` conversion are generated. Built-ins use the same public API.

## Packages

Heavy kinds live in their own package, so you pay for what you import. Each one has a
page under [`docs/packages/`](docs/packages/).

**Engine**

| Package | |
| --- | --- |
| [`smartputs`](docs/packages/smartputs.md) | The unscoped install name. Everything `@smartput/core` is, under one word. |
| [`@smartput/core`](docs/packages/core.md) | The engine: normalize, tokenize, parse, solve, eval, print. |
| [`@smartput/kind`](docs/packages/kind.md) | The layer a kind and a language are written in, with no engine in it. |
| [`@smartput/kinds`](docs/packages/kinds.md) | Every built-in kind, its vocabulary, and the two barrels over them. |
| [`@smartput/shared`](docs/packages/shared.md) | The micro path: one parser, one algebra, one value-class factory. |
| [`@smartput/number`](docs/packages/number.md) | The unitless kind, and the one that accepts a bare number. |
| [`@smartput/measure`](docs/packages/measure.md) | Typographic units: point, pica, em, pixel. |

**Measures**

| Package | |
| --- | --- |
| [`@smartput/length`](docs/packages/length.md) | Millimetre to mile, exact in decimal. |
| [`@smartput/mass`](docs/packages/mass.md) | Milligram to ton, with the imperial pounds and ounces. |
| [`@smartput/area`](docs/packages/area.md) | Square metres, hectares, acres. |
| [`@smartput/volume`](docs/packages/volume.md) | Litres, millilitres, cubic metres, and the two gallons. |
| [`@smartput/angle`](docs/packages/angle.md) | Degree, radian, gradian, turn, with a 30-digit π. |
| [`@smartput/speed`](docs/packages/speed.md) | m/s, km/h, mph, knots. |
| [`@smartput/temperature`](docs/packages/temperature.md) | Celsius, Fahrenheit, Kelvin, plus the delta kind beside them. |
| [`@smartput/energy`](docs/packages/energy.md) | Joule, calorie, watt-hour, electronvolt. |
| [`@smartput/power`](docs/packages/power.md) | Watt to horsepower, bridging energy and duration. |
| [`@smartput/datasize`](docs/packages/datasize.md) | Bytes and bits, decimal and binary prefixes. |
| [`@smartput/datarate`](docs/packages/datarate.md) | bit/s to Gbit/s, bridging data size and duration. |
| [`@smartput/percent`](docs/packages/percent.md) | One unit, ratio 0.01. |
| [`@smartput/boolean`](docs/packages/boolean.md) | The kind comparisons land in. |
| [`@smartput/color`](docs/packages/color.md) | Colours as values, notations as units, channels as a kind. |

**Time**

| Package | |
| --- | --- |
| [`@smartput/duration`](docs/packages/duration.md) | Nanosecond to week, canonical in seconds. |
| [`@smartput/date`](docs/packages/date.md) | A calendar day, with no time inside it. |
| [`@smartput/time`](docs/packages/time.md) | A clock time, with no date attached. |
| [`@smartput/datetime`](docs/packages/datetime.md) | The datetime kind: chrono in front, Temporal underneath. |
| [`@smartput/timezone`](docs/packages/timezone.md) | Zone tables and the written-offset parser. No dependencies. |
| [`@smartput/holiday`](docs/packages/holiday.md) | Which holiday a phrase names, and when it falls. |
| [`@smartput/tempo`](docs/packages/tempo.md) | Beats per minute, and its bridge to duration. |

**Ranges**

| Package | |
| --- | --- |
| [`@smartput/range-core`](docs/packages/range-core.md) | Endpoints, ordering, windows: the machinery every range kind shares. |
| [`@smartput/range`](docs/packages/range.md) | Numeric and measured ranges: `10–20 km`. |
| [`@smartput/date-range`](docs/packages/date-range.md) | `last week`, `March 3–7`, `between May and June`. |
| [`@smartput/time-range`](docs/packages/time-range.md) | `9am–5pm`, with no date on either end. |
| [`@smartput/datetime-range`](docs/packages/datetime-range.md) | Full instants at both ends, holidays optional. |

**Money, maths, places, queries**

| Package | |
| --- | --- |
| [`@smartput/currency`](docs/packages/currency.md) | Currency recognition and formatting, with no rate table. |
| [`@smartput/rate`](docs/packages/rate.md) | The money kind, rate snapshots, and the live-rate facade. |
| [`@smartput/math`](docs/packages/math.md) | LaTeX in, steps out: evaluate, simplify, solve, analyse. |
| [`@smartput/geo`](docs/packages/geo.md) | Places, whole: the kind, postal codes, and the GeoNames providers. |
| [`@smartput/distance`](docs/packages/distance.md) | Great-circle distance between two places. |
| [`@smartput/query`](docs/packages/query.md) | A sentence to a database query, in SQL or Mongo. |

## Documentation

| | |
| --- | --- |
| [Getting started](docs/guide/getting-started.md) | Install, build an engine, evaluate. |
| [Kinds](docs/guide/kinds.md) · [Defining a kind](docs/guide/defining-a-kind.md) | The vocabulary, and how to add to it. |
| [Pipeline](docs/guide/pipeline.md) | normalize → tokenize → parse → solve → eval → print. |
| [Weights](docs/guide/weights.md) · [Errors](docs/guide/errors.md) | How readings are ranked, and what throws. |
| [Locales](docs/guide/locales.md) · [Inputs](docs/guide/inputs.md) · [Completion](docs/guide/completion.md) | Languages, accepted surfaces, and typeahead. |
| [API reference](docs/api/) | Every exported symbol: `createEngine`, the `Engine` methods, `defineKind`, printers, types. |
| [Playground](docs/playground.md) | Every entry point of the engine, running live in your browser. |
| [Roadmap](docs/guide/roadmap.md) | What is in scope, and what is deliberately not. |

Run the site locally with `bun run docs:dev`.

## Development

Requires [Bun](https://bun.sh) 1.3 or newer.

```sh
bun install
bun run check   # lint, typecheck, check-deps, test, build, check-size
```

See [CONTRIBUTION.md](CONTRIBUTION.md) for the layout, the guards CI enforces, and which
files are generated.

## License

[MIT](LICENSE)

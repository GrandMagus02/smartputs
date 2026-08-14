<p align="center">
  <img src="docs/public/banner.svg" alt="smartputs" width="900"/>
</p>

<p align="center"><b>Human input, evaluated.</b></p>

<p align="center">
A TypeScript engine that parses and evaluates what people actually type —<br/>
units, durations, and arithmetic mixed together — and tells you how confident it is.
</p>

---

`"1 kg + 500 g"`, `"30 h - 30 min"`, `"212 F in C"`, `"100 km / 2 h"`. Smartputs reads
the sentence, keeps every reading it could be, ranks them, and hands back a decimal in a
canonical unit along with the confidence it earned. Ambiguity is data here, not a
failure: `"10 m"` really is both minutes and metres, and the engine will say so rather
than guess silently.

## Install

```sh
bun add @smartput/core     # or: pnpm add @smartput/core / npm install @smartput/core
```

ESM only, types included. `@smartput/core` ships exactly one runtime dependency,
`decimal.js` — `bun run check-deps` fails the repo on a second.

## Build an engine

An engine is a pure composition of frozen descriptors: locales, kinds, and optional
weight overrides. Nothing is global, and engines with different options coexist in one
process.

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const en = composeLocale(english, BUILTIN_EN);

const engine = createEngine({
  locales: [en],        // every language the engine READS
  kinds: BUILTIN_KINDS, // number, percent, length, mass, duration, temperature, …
});
```

`createEngine` registers nothing on your behalf — pass the kinds you want, or the engine
has no vocabulary and every unit raises `NoCandidateError`.

## Evaluate

```ts
const result = engine.evaluate("1 kg + 500 g");

result.formatted; // "1.5 kilograms"
result.kind; // "mass"
result.value.canonical.toString(); // "1500"   — grams, the canonical unit
result.value.unit; // "kg"     — the left operand's unit
result.confidence; // 1
```

### Five entry points

`evaluate()` is strict and throws, which makes it the wrong choice for a keystroke-rate
input where ambiguity is normal. Reach for `suggest()` there.

| Method | On ambiguity | Returns |
| --- | --- | --- |
| `evaluate(input)` | throws `AmbiguityError` | one `Result` |
| `suggest(input)` | ranks | `Result[]`, possibly empty; never throws |
| `coerce(kind, input)` | resolved by the hard kind constraint | a `Value` |
| `explain(input)` | shows the scoring | an `Explanation` |
| `complete(input)` | ranks the units the fragment could become | `Completion[]` |

```ts
engine.evaluate("10 m");
// AmbiguityError: "10 m" is ambiguous between duration:min, length:m

engine.suggest("10 m");
// [ { kind: "duration", formatted: "10 minutes", confidence: 0.5 },
//   { kind: "length",   formatted: "10 metres",  confidence: 0.5 } ]

engine.complete("30 ho");
// [ { alias: "hour", text: "30 hours", kind: "duration", unit: "h", … } ]
```

If your domain knows that `m` always means metres, say so once at construction:

```ts
const engine = createEngine({
  locales: [en],
  kinds: BUILTIN_KINDS,
  weights: { "duration:min": -20 }, // "m" never means minutes here
});
```

### Money, with the rates you supply

Ratios come from a dated table you inject — a rate derived through the base currency is
disclosed, never implied.

```ts
import { money, snapshot } from "@smartput/rate";
import moneyEn from "@smartput/rate/locale/en";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, moneyEn])],
  kinds: [...BUILTIN_KINDS, money],
  rates: snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 }),
});

engine.evaluate("30 usd in gbp").formatted; // "£22.94"
```

## What you get

- **One expression, many kinds.** Cross-kind operations are declared as signatures, so
  the evaluator never hardcodes a domain.
- **Completion, not just evaluation.** `complete()` rewrites the whole input, so what it
  hands back always evaluates — ranked by the same weights, plus a magnitude fit.
- **Decimal all the way down.** Every value is a `decimal.js` `Decimal` in a canonical
  unit; a 23-significant-digit input survives the pipeline intact.
- **Built for inflected languages.** Recognition runs an analyzer chain rather than an
  alias list, so `"kilograms"` reaches `"kilogram"` without enumerating every form.
  Generation uses `Intl.PluralRules`.
- **A 1.5 KB door for one field.** An input asking whether `"30deg"` is valid does not
  need a registry and a Pratt parser: every kind ships an engine-free `parseX`, and its
  size is a budget `bun run check-size` enforces.
- **Seventeen languages.** Locales are separate entry points under
  `@smartput/core/locale/*`; recognition reads every locale you install, generation
  writes in the one you name.
- **A new kind is five lines.** `defineKind` takes an id and a unit table; aliases,
  arithmetic and `in` conversion are generated. Built-ins use the same public API.

## Packages

Heavy kinds live in their own package, so you pay for what you import. Each one has a
page under [`docs/packages/`](docs/packages/).

**Engine**

| Package | |
| --- | --- |
| [`@smartput/core`](docs/packages/core.md) | The engine: normalize, tokenize, parse, solve, eval, print. |
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
| [`@smartput/angle`](docs/packages/angle.md) | Degree, radian, gradian, turn — with a 30-digit π. |
| [`@smartput/speed`](docs/packages/speed.md) | m/s, km/h, mph, knots. |
| [`@smartput/temperature`](docs/packages/temperature.md) | Celsius, Fahrenheit, Kelvin — plus the delta kind beside them. |
| [`@smartput/energy`](docs/packages/energy.md) | Joule, calorie, watt-hour, electronvolt. |
| [`@smartput/power`](docs/packages/power.md) | Watt to horsepower, bridging energy and duration. |
| [`@smartput/datasize`](docs/packages/datasize.md) | Bytes and bits, decimal and binary prefixes. |
| [`@smartput/datarate`](docs/packages/datarate.md) | bit/s to Gbit/s, bridging data size and duration. |
| [`@smartput/percent`](docs/packages/percent.md) | One unit, ratio 0.01. |
| [`@smartput/boolean`](docs/packages/boolean.md) | The kind comparisons land in. |

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
| [`@smartput/range-core`](docs/packages/range-core.md) | Endpoints, ordering, windows — the machinery every range kind shares. |
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

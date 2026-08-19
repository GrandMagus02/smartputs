# @smartput/color

> Colours as values, notations as units, channels as a kind.

A colour is a value and a notation is a unit, so `#3b82f6 in oklch` is
the same conversion `1 kg in g` is. The colour science is not here:
[`@urcolor/core`](https://urcolor.vercel.app/) parses, converts, serialises,
lightens and mixes, [`@urcolor/i18n`](https://urcolor.vercel.app/) names a
colour in 298 languages, and this package is the seam — a kind descriptor, the
literal matchers, five op signatures and the words for the notations.

Two seams, because core has two. `red of #eeff66` puts a second kind
(`color-channel`) on the left of the `of` operator that already exists;
`#eeff66 darken 20%` is a whole phrase claimed by a literal matcher. Neither
needed a line of core, which is the point.

## Setup

```sh
npm add @smartput/color
```

## Example

```ts
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { COLOR_KINDS } from "@smartput/color";
import colorEn from "@smartput/color/locale/en";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, colorEn])],
  kinds: [...BUILTIN_KINDS, ...COLOR_KINDS],
});

engine.evaluate("#3b82f6 in oklch").formatted                      // "oklch(0.62308 0.18801 259.8145)"
engine.evaluate("rgb 255 60 128 in hex").formatted                 // "#ff3c80"
engine.evaluate("100 hue 100 sat 50 brightness in hex").formatted  // "#2a8000"
engine.evaluate("red of #eeff66").formatted                        // "238"
engine.evaluate("#eeff66 darken 20% in hex").formatted             // "#aebc00"
engine.evaluate("#eeff66 with 150 hue in hex").formatted           // "#66ffb3"
engine.evaluate("#440000 + #004400 in hex").formatted              // "#444400"
```

A notation is a unit, so `in oklch` is the conversion `in g` is.
The colour science is `@urcolor/core`'s throughout; `red of #eeff66` is core's
own `of` operator with a second kind on its left, and `darken 20%` is a phrase
claimed by a literal matcher — neither needed a change to core.

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/color` | The package root. |
| `@smartput/color/class` | `Color` from `@urcolor/core`, and the two bridges between it and a `Value`. |
| `@smartput/color/i18n` | The colour-naming datasets, and the channel-word tables. 2.5 MB minified — which is why it is a subpath. |
| `@smartput/color/locale/<id>` | One language's words for this kind. 17 ship: `en`, `de`, `fr`, `es`, `pt`, `it`, `nl`, `pl`, `uk`, `ru`, `tr`, `ar`, `hi`, `id`, `ja`, `ko`, `zh`. |

## Runtime exports

Type-only exports are erased and do not appear here.

`ALPHA_KEY` · `CHANNELS` · `CHANNEL_KIND` · `COLOR_FORMATS` · `COLOR_KIND` · `COLOR_KINDS` · `DEFAULT_CHANNEL_WEIGHT` · `DEFAULT_EXPRESSION_WEIGHT` · `DEFAULT_KEYWORD_WEIGHT` · `DEFAULT_PHRASE_WEIGHT` · `DEFAULT_SYNTAX_WEIGHT` · `DEFAULT_TERM_WEIGHT` · `MAX_CHANNEL_WORDS` · `MAX_TERM_WORDS` · `NAME_UNIT` · `NOTATIONS` · `addChannels` · `channelById` · `channelByLabel` · `channelFor` · `channelValue` · `color` · `colorChannel` · `colorClaim` · `colorFromChannels` · `colorMeta` · `combineChannels` · `createChannelLiteral` · `createCssBaseReader` · `createCssLiteral` · `createExpressionLiteral` · `createNameLiteral` · `cssFor` · `defineColor` · `defineColorChannel` · `defineColorKinds` · `isColorFormat` · `lookupFor` · `matchChannelWord` · `notationFor` · `packSrgb` · `readChannel` · `readTerm` · `resolveChannel` · `scaleChannels` · `subtractChannels` · `tryUnwrap` · `unitForSpace` · `unwrap` · `wrap` · `writeChannel`

## Dependencies

- [`@smartput/kind`](../kind/README.md)
- `@urcolor/core`
- `@urcolor/i18n`

## What it costs

Ceilings, not measurements. `bun run check-size` bundles each entry with
`bun build --minify` and fails if a row crosses its ceiling **or drops more
than 30 % below it** — a budget that is only an upper bound reports a vanished
graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| color root (the kinds, the parser, no datasets) | ≤ 71.5 kB | ≤ 27.1 kB |
| color/class (upstream's Color, no engine) | ≤ 59.0 kB | ≤ 23.2 kB |
| color/i18n (298 languages of colour names — the opt-in cost) | ≤ 2551 kB | ≤ 667 kB |
| color/locale/en (notation words, no arithmetic and no colour library) | ≤ 2.0 kB | ≤ 900 B |

## Reading a colour

Four ways in, all of them things people actually type:

| Written | Example |
| --- | --- |
| CSS syntax | `#3b82f6`, `rgb(59 130 246)`, `oklch(0.6 0.2 250)` |
| Bracketless | `rgb 255 60 128`, `oklch 0.6 0.2 250`, `p3 1 0 0` |
| Named channels | `100 hue 100 sat 50 brightness` |
| Words | `rebeccapurple`, and any term a loaded dataset knows |

And four ways to work on one: the operators `+`, `-`, `*` and `of`, the verb
phrases `darken` / `lighten` / `saturate` / `desaturate` / `rotate` /
`negate` / `mix` / `add`, the `with` setter, and `in` for the notation.

---

Generated by `scripts/gen-readmes.ts` — run `bun run docs:readmes`. Every
output above was produced by running the line beside it. The full page, with
live demos, is [`docs/packages/color.md`](../../docs/packages/color.md).

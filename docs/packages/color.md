---
title: "@smartput/color"
description: "Colours as values, notations as units, channels as a kind."
---

# @smartput/color

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

## Try it

<SpEvaluate
  with-color
  model-value="#3b82f6 in oklch"
  :examples="['#3b82f6 in oklch', 'rgb 255 60 128 in hex', 'red of #eeff66', '#eeff66 darken 20%', '100 hue 100 sat 50 brightness in hex']" />

## Installing

```sh
npm add @smartput/color
```

## Entry points

| Import | Contents |
| --- | --- |
| `@smartput/color` | The package root. |
| `@smartput/color/class` | `Color` from `@urcolor/core`, and the two bridges between it and a `Value`. |
| `@smartput/color/i18n` | The colour-naming datasets, and the channel-word tables. 2.5 MB minified — which is why it is a subpath. |
| `@smartput/color/locale/en` | English vocabulary for this package's kinds (default export). |
| `@smartput/color/locale/de` | See the source for what this subpath carries. |
| `@smartput/color/locale/fr` | See the source for what this subpath carries. |
| `@smartput/color/locale/es` | See the source for what this subpath carries. |
| `@smartput/color/locale/pt` | See the source for what this subpath carries. |
| `@smartput/color/locale/it` | See the source for what this subpath carries. |
| `@smartput/color/locale/nl` | See the source for what this subpath carries. |
| `@smartput/color/locale/pl` | See the source for what this subpath carries. |
| `@smartput/color/locale/uk` | Ukrainian vocabulary for this package's kinds (default export). |
| `@smartput/color/locale/ru` | See the source for what this subpath carries. |
| `@smartput/color/locale/tr` | See the source for what this subpath carries. |
| `@smartput/color/locale/ar` | See the source for what this subpath carries. |
| `@smartput/color/locale/hi` | See the source for what this subpath carries. |
| `@smartput/color/locale/id` | See the source for what this subpath carries. |
| `@smartput/color/locale/ja` | See the source for what this subpath carries. |
| `@smartput/color/locale/ko` | See the source for what this subpath carries. |
| `@smartput/color/locale/zh` | See the source for what this subpath carries. |

## Runtime exports

Type-only exports are erased and do not appear here.

`ALPHA_KEY` · `CHANNELS` · `CHANNEL_KIND` · `COLOR_FORMATS` · `COLOR_KIND` · `COLOR_KINDS` · `DEFAULT_CHANNEL_WEIGHT` · `DEFAULT_EXPRESSION_WEIGHT` · `DEFAULT_KEYWORD_WEIGHT` · `DEFAULT_PHRASE_WEIGHT` · `DEFAULT_SYNTAX_WEIGHT` · `DEFAULT_TERM_WEIGHT` · `MAX_CHANNEL_WORDS` · `MAX_TERM_WORDS` · `NAME_UNIT` · `NOTATIONS` · `addChannels` · `channelById` · `channelByLabel` · `channelFor` · `channelValue` · `color` · `colorChannel` · `colorClaim` · `colorFromChannels` · `colorMeta` · `combineChannels` · `createChannelLiteral` · `createCssBaseReader` · `createCssLiteral` · `createExpressionLiteral` · `createNameLiteral` · `cssFor` · `defineColor` · `defineColorChannel` · `defineColorKinds` · `isColorFormat` · `lookupFor` · `matchChannelWord` · `notationFor` · `packSrgb` · `readChannel` · `readTerm` · `resolveChannel` · `scaleChannels` · `subtractChannels` · `tryUnwrap` · `unitForSpace` · `unwrap` · `wrap` · `writeChannel`

## What it costs

Ceilings, not measurements — `scripts/check-size.ts` bundles each
entry with `bun build --minify`, measures it, and fails `bun run check` if a
row crosses its ceiling **or drops more than 30 % below it**. A budget that is
only an upper bound reports a vanished graph as a triumph.

| Import | Minified | Gzipped |
| --- | --- | --- |
| color root (the kinds, the parser, no datasets) | ≤ 71.5 kB | ≤ 27.1 kB |
| color/class (upstream's Color, no engine) | ≤ 59.0 kB | ≤ 23.2 kB |
| color/i18n (298 languages of colour names — the opt-in cost) | ≤ 2551 kB | ≤ 667 kB |
| color/locale/en (notation words, no arithmetic and no colour library) | ≤ 2.0 kB | ≤ 900 B |

## Dependencies

- [`@smartput/kind`](/packages/kind)
- `@urcolor/core`
- `@urcolor/i18n`

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

## See also

- [Kinds and units](/guide/kinds)
- [Defining a kind](/guide/defining-a-kind)


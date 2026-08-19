/**
 * `@smartput/color` — a colour is a value, a notation is a unit, and a channel
 * is a kind of its own.
 *
 * ```ts
 * import { composeLocale, createEngine } from "@smartput/core";
 * import { english } from "@smartput/core/locale/en";
 * import { COLOR_KINDS } from "@smartput/color";
 * import colorEn from "@smartput/color/locale/en";
 *
 * const engine = createEngine({
 *   locales: [composeLocale(english, [colorEn])],
 *   kinds: [...COLOR_KINDS],
 * });
 *
 * engine.evaluate("#3b82f6 in oklch");                  // oklch(0.62308 0.18801 259.8145)
 * engine.evaluate("red of #eeff66");                    // 238
 * engine.evaluate("#eeff66 darken 20%");                // = darken 0.2
 * engine.evaluate("#eeff66 with 150 hue");
 * engine.evaluate("100 hue 100 sat 50 brightness to oklab");
 * engine.evaluate("#440000 + #004400");                 // #444400
 * ```
 *
 * **A thin integration, and thin is the design.** `@urcolor/core` parses,
 * converts, serialises, lightens and mixes; `@urcolor/i18n` names. This package
 * contributes kind descriptors, literal matchers, op signatures and an English
 * vocabulary for the notations — and nothing that duplicates a colour-space
 * computation. The parts that would have been tempting to write here are the
 * ones upstream already got right, and two implementations of Oklab is one too
 * many.
 *
 * **Two ways to say a thing, because core has two seams.** `OpSymbol` and
 * `Keyword` are closed unions, so a kind cannot invent an operator. What it can
 * do is put a kind on one side of an operator that already exists —
 * `of | color-channel | color` is how "red of #eeff66" works — or claim a whole
 * phrase as a literal, which is how "#eeff66 darken 20%" works. Neither needed a
 * line of core.
 *
 * **What it does not do.** No completions: the naming datasets expose a term
 * *lookup* (`colorOf`) and not a term *list*, so there is nothing to offer for
 * a fragment, and a completer that guessed would be inventing colour names. No
 * comparison — `red > blue` has no answer, and ruling C5 is what lets a kind
 * say so.
 *
 * `@smartput/color/i18n` is the door to the naming datasets, and
 * `@smartput/color/class` is the door to `Color` itself.
 */
export {
  ALPHA_KEY,
  CHANNEL_KIND,
  CHANNELS,
  type ChannelAmount,
  type ChannelDef,
  type ChannelKindOptions,
  type ChannelWords,
  channelById,
  channelByLabel,
  channelFor,
  channelValue,
  colorChannel,
  colorFromChannels,
  createChannelLiteral,
  DEFAULT_CHANNEL_WEIGHT,
  defineColorChannel,
  MAX_CHANNEL_WORDS,
  matchChannelWord,
  readChannel,
  resolveChannel,
  writeChannel,
} from "./channels";
export {
  COLOR_KINDS,
  type ColorOptions,
  color,
  defineColor,
  defineColorKinds,
} from "./color";
export {
  createExpressionLiteral,
  DEFAULT_EXPRESSION_WEIGHT,
  type ExpressionOptions,
} from "./expression";
export {
  type BaseMatch,
  type BaseReader,
  type CssLiteralOptions,
  colorClaim,
  createCssBaseReader,
  createCssLiteral,
  DEFAULT_KEYWORD_WEIGHT,
  DEFAULT_SYNTAX_WEIGHT,
} from "./matcher";
export {
  type ColorNameLookup,
  createNameLiteral,
  DEFAULT_PHRASE_WEIGHT,
  DEFAULT_TERM_WEIGHT,
  lookupFor,
  MAX_TERM_WORDS,
  type NameLiteralOptions,
  readTerm,
} from "./names";
export {
  cssFor,
  NOTATIONS,
  type NotationDef,
  notationFor,
} from "./notations";
export {
  addChannels,
  COLOR_FORMATS,
  COLOR_KIND,
  type ColorUnit,
  colorMeta,
  combineChannels,
  isColorFormat,
  NAME_UNIT,
  packSrgb,
  scaleChannels,
  subtractChannels,
  tryUnwrap,
  unitForSpace,
  unwrap,
  wrap,
} from "./value";

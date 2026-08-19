import { Decimal, defineKind, deriveValue, type Kind, type Value } from "@smartput/kind";
import type { Color } from "@urcolor/core";
import { serialize } from "@urcolor/core";
import {
  CHANNEL_KIND,
  channelById,
  colorChannel,
  defineColorChannel,
  readChannel,
} from "./channels";
import { createExpressionLiteral, type ExpressionOptions } from "./expression";
import {
  type BaseReader,
  type CssLiteralOptions,
  createCssBaseReader,
  createCssLiteral,
} from "./matcher";
import {
  type ColorNameLookup,
  createNameLiteral,
  lookupFor,
  type NameLiteralOptions,
  readTerm,
} from "./names";
import {
  addChannels,
  COLOR_FORMATS,
  COLOR_KIND,
  type ColorUnit,
  isColorFormat,
  NAME_UNIT,
  scaleChannels,
  subtractChannels,
  unwrap,
  wrap,
} from "./value";

export interface ColorOptions
  extends CssLiteralOptions,
    NameLiteralOptions,
    ExpressionOptions {
  /**
   * Colour-naming datasets, already loaded.
   *
   * A kind is a frozen descriptor composed at boot and `ColorNames.load` is a
   * promise, so the data cannot arrive from inside `defineColor` — the same
   * shape `@smartput/geo`'s `definePlace({ countries })` has, and for the same
   * reason. `@smartput/color/i18n` exports `loadColorNames`, which is the
   * await a caller does once.
   *
   * With none supplied the `name` unit is still registered and still resolves;
   * it renders the colour instead. See the `format` hook below for why that is
   * the honest answer rather than a boot-time refusal.
   */
  names?: readonly ColorNameLookup[];
  /** Summed into a channel-word claim. See `DEFAULT_CHANNEL_WEIGHT`. */
  channelWeight?: number;
}

/** The `number` kind's canonical unit, named here so the `of` result is not a guess. */
const NUMBER_UNIT = "one";

const numberValue = (n: number): Value =>
  Object.freeze({ kind: "number", canonical: new Decimal(n), unit: NUMBER_UNIT });

/**
 * A colour, and the notation it is written in.
 *
 * **Opaque, not ratio.** A colour has no magnitude, so none of the trio
 * `generateRatioOps` produces — percent-of, percent-off, division by a number
 * — should exist. The four signatures it does want are declared below, and
 * each is a decision rather than a default.
 *
 * **Not `ordered`.** Ruling C5 leaves the decision to the kind, and colour is
 * the case it was left for: `red > blue` has no answer. The canonical scalar
 * is an 8-bit sRGB pixel (see `packSrgb`) and would happily produce one, which
 * is exactly why the comparison must not be generated.
 *
 * **The units are notations.** `hex`, `oklch`, `display-p3` — every one a
 * `ColorFormat` from `@urcolor/core`, so `in oklch` is the ordinary
 * unit-target path and the formatter is one `serialize` call. `name` joins
 * them and is the one notation `serialize` cannot render.
 *
 * The colour science is upstream's throughout: upstream parses, converts,
 * serialises, lightens, mixes and names. This file is the seam.
 */
export function defineColor(opts: ColorOptions = {}): Kind {
  const names = opts.names ?? [];
  // `name` is registered whether or not a dataset was loaded. Registering it
  // conditionally was the first shape and it does not work: a `Vocabulary`
  // naming a unit its kind did not register is an `UnknownKindError` at
  // `createEngine()`, so the words would have had to be conditional too — two
  // vocabularies differing by one entry, and drift between them the first time
  // either was edited.
  const units: ColorUnit[] = [...COLOR_FORMATS, NAME_UNIT];

  const readCss = createCssBaseReader(opts);
  const nameLiteral = names.length > 0 ? createNameLiteral(names, opts) : undefined;

  // The expression matcher reads a *base* colour and then keeps going, so it
  // needs whatever can start one. With datasets loaded that includes a term,
  // which is what makes "sky blue darken 20%" a phrase rather than a parse
  // error two words in.
  const readBase = nameLiteral === undefined ? readCss : withTerms(readCss, names);

  const literals = [createCssLiteral(opts), createExpressionLiteral(readBase, opts)];
  if (nameLiteral !== undefined) literals.push(nameLiteral);

  return defineKind({
    id: COLOR_KIND,
    value: { mode: "opaque", units },
    literals,
    ops: [
      {
        // `deriveValue(l, …, { unit: r.unit })` is the whole conversion: the
        // target contributes a notation and nothing else, and the colour —
        // coordinates, space, alpha — travels untouched on the left operand's
        // `meta`. Converting the coordinates here instead would be a second
        // conversion beside `serialize`'s, and the two would drift.
        op: "in",
        left: COLOR_KIND,
        right: COLOR_KIND,
        result: COLOR_KIND,
        apply: (l, r) => deriveValue(l, l.canonical, { unit: r.unit }),
      },
      {
        // Additive light. The result keeps the LEFT operand's notation, which
        // is the same rule every other kind's `+` follows: "1 kg + 500 g" is
        // kilograms.
        op: "+",
        left: COLOR_KIND,
        right: COLOR_KIND,
        result: COLOR_KIND,
        apply: (l, r) => retint(l, addChannels(unwrap(l), unwrap(r))),
      },
      {
        op: "-",
        left: COLOR_KIND,
        right: COLOR_KIND,
        result: COLOR_KIND,
        apply: (l, r) => retint(l, subtractChannels(unwrap(l), unwrap(r))),
      },
      {
        op: "*",
        left: COLOR_KIND,
        right: "number",
        result: COLOR_KIND,
        apply: (l, r) => retint(l, scaleChannels(unwrap(l), r.canonical.toNumber())),
      },
      {
        op: "*",
        left: "number",
        right: COLOR_KIND,
        result: COLOR_KIND,
        apply: (l, r) => retint(r, scaleChannels(unwrap(r), l.canonical.toNumber())),
      },
      {
        // "red of #eeff66" — 238. The operator is core's own `of`, the one
        // "20% of 50" uses; what is new is the kind on its left, which is the
        // whole reason `color-channel` exists. The answer is in CSS units, so
        // it is the number that would appear inside `rgb()` or `hsl()` rather
        // than a normalised 0–1 that nobody types.
        op: "of",
        left: CHANNEL_KIND,
        right: COLOR_KIND,
        result: "number",
        apply: (l, r) => {
          const def = channelById(l.unit);
          if (def === undefined)
            throw new TypeError(`Unknown colour channel "${l.unit}"`);
          return numberValue(readChannel(unwrap(r), def));
        },
      },
    ],
    format: (value, ctx) => {
      const color = unwrap(value);
      if (isColorFormat(value.unit)) return serialize(color.toObject(), value.unit);
      const named = lookupFor(names, ctx.locale)?.of(color);
      // No dataset loaded, or a dataset with no name for this colour: neither
      // is an error and neither may print an empty string. `resolve()` reports
      // coverage precisely so that "no name here" is an answerable question,
      // and the honest fallback for a colour nobody has a word for is the
      // colour.
      return named ?? serialize(color.toObject(), "hex");
    },
  });
}

/** The result of an operation, in the source operand's notation. */
const retint = (source: Value, color: Color): Value =>
  wrap(color, source.unit as ColorUnit);

/**
 * A base reader that tries CSS first and then the loaded datasets.
 *
 * Terms come second because CSS syntax is decidable and a term lookup is not:
 * `red` is a keyword before it is anybody's translation of one, and asking the
 * datasets first would make the answer depend on which locales were loaded.
 */
function withTerms(readCss: BaseReader, lookups: readonly ColorNameLookup[]): BaseReader {
  return (input, offset, isUnitAlias) => {
    const css = readCss(input, offset, isUnitAlias);
    if (css !== null) return css;
    return readTerm(lookups, input, offset, isUnitAlias);
  };
}

export { colorChannel } from "./channels";

/**
 * Both kinds, built from one options object.
 *
 * `red of #eeff66` needs both registered, and forgetting the second is a silent
 * loss rather than an error: `of | color-channel | color` is simply never
 * reachable, and the expression reports that it cannot read "of". So the pair
 * is what the package hands out, and `defineColor` on its own stays available
 * for a consumer who genuinely wants colours without channels.
 */
export function defineColorKinds(opts: ColorOptions = {}): Kind[] {
  return [
    defineColor(opts),
    defineColorChannel({
      ...(opts.channelWords === undefined ? {} : { words: opts.channelWords }),
      ...(opts.channelWeight === undefined ? {} : { weight: opts.channelWeight }),
    }),
  ];
}

/**
 * The kind as a consumer with no datasets gets it: CSS syntax, the 148 CSS
 * keywords, the verb phrases and the channel-list form, at the default
 * weights.
 *
 * A module-level constant is possible here and is not in `@smartput/geo`
 * because CSS colour syntax is a specification, not a data release — nothing
 * about it arrives over a network. The moment names are wanted, `defineColor`
 * is the door.
 */
export const color: Kind = defineColor();

/** The pair as a consumer with no options gets it. */
export const COLOR_KINDS: readonly Kind[] = Object.freeze([color, colorChannel]);

import { Decimal, type Value } from "@smartput/kind";
import { Color, type ColorFormat, type ColorObject, type SpaceId } from "@urcolor/core";

export const COLOR_KIND = "color";

/**
 * The kind's units are **notations**, not ratios — the way a colour is written
 * rather than how much of something it is. Every id is a `ColorFormat` from
 * `@urcolor/core` verbatim, so `serialize(object, unit)` needs no mapping table
 * and a notation added upstream is a notation added here.
 *
 * `hsv` is upstream's one space with no CSS form, so it is not a notation and
 * cannot be a unit; a colour that somehow arrives in it falls back to `srgb`
 * in {@link unitForSpace}.
 */
export const COLOR_FORMATS = [
  "hex",
  "srgb",
  "srgb-linear",
  "hsl",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "display-p3",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
  "xyz-d65",
  "xyz-d50",
] as const satisfies readonly ColorFormat[];

/**
 * The notation whose renderer is a colour-naming dataset rather than
 * `serialize`, and the only unit here that is not a `ColorFormat`.
 *
 * Always registered, even by a `defineColor` with no datasets — see the note
 * beside `units` there. With nothing loaded it renders the colour, which is
 * the same thing it does for a colour the loaded dataset has no word for.
 */
export const NAME_UNIT = "name";

export type ColorUnit = (typeof COLOR_FORMATS)[number] | typeof NAME_UNIT;

const FORMATS = new Set<string>(COLOR_FORMATS);

/** Is this unit one `serialize` understands? False for `name` alone. */
export const isColorFormat = (unit: string): unit is ColorFormat => FORMATS.has(unit);

/**
 * The notation a colour parsed into `space` was written in.
 *
 * A literal keeps the notation it was typed in — `oklch(...)` stays `oklch`,
 * `#3b82f6` stays `hex` — because `in` is how a caller asks for another one,
 * and a matcher that normalised everything to hex would have thrown away the
 * only thing the user actually said about presentation.
 */
export const unitForSpace = (space: SpaceId): ColorUnit =>
  space === "hsv" ? "srgb" : (space as ColorUnit);

const BYTE = 256;

const q = (channel: number): number =>
  Math.max(0, Math.min(255, Math.round(channel * 255)));

/**
 * `0xRRGGBBAA` of the colour clamped into sRGB, as the `Decimal` every
 * `Value` is obliged to carry.
 *
 * The same trick `@smartput/boolean` plays with 1/0 and `@smartput/time` with
 * nanoseconds-of-day: the scalar exists so the machinery around the kind keeps
 * working, and what it *means* is the kind's own business. Here it means "the
 * 8-bit sRGB pixel this colour would be painted as", which is lossy twice over
 * — quantised to a byte per channel, and clamped, so two distinct Display-P3
 * reds can share one. That is exactly why the kind is not `ordered` and
 * declares no comparison: this number ranks nothing and must never be asked
 * to. The exact coordinates ride on `meta`, which is what {@link unwrap}
 * reads.
 *
 * **Clamped, not gamut-mapped**, and the difference is not cosmetic. An
 * earlier version called `toGamut("srgb")` first, which reduces chroma to fit
 * and answers *white* for anything whose Oklch lightness has gone past 1 —
 * while `serialize(…, "hex")` clamps each channel independently. So
 * "#eeff66 lighten 0.2" recorded a canonical of `0xffffffff` and printed
 * `#fcff75`: one value, two disagreeing readings of it. Per-channel clamping
 * is what the hex serialiser does, so it is what this does.
 */
export function packSrgb(color: Color): Decimal {
  const [r, g, b] = color.to("srgb").coords;
  const rgb = (q(r) * BYTE + q(g)) * BYTE + q(b);
  return new Decimal(rgb * BYTE + q(color.alpha));
}

/**
 * The `meta` a colour value carries: upstream's own `ColorObject`, spread
 * rather than nested under a key, so a consumer reading `value.meta` reads the
 * very structure `Color.from` accepts.
 *
 * Nobody imports anybody. A package that wants to recognise a colour value
 * matches this shape off `meta`, exactly as the range packages match a place.
 */
export function colorMeta(color: Color): Readonly<ColorObject> {
  return Object.freeze({
    space: color.space,
    coords: Object.freeze(color.coords) as ColorObject["coords"],
    alpha: color.alpha,
  });
}

/** A `Value` for a colour, written in `unit`. */
export function wrap(color: Color, unit: ColorUnit = unitForSpace(color.space)): Value {
  return Object.freeze({
    kind: COLOR_KIND,
    canonical: packSrgb(color),
    unit,
    meta: colorMeta(color),
  });
}

/**
 * The `Color` a value carries, or `null` when it carries none.
 *
 * Structural, not by kind id: a value is a colour when its `meta` holds a
 * space and three coordinates, which is the contract {@link colorMeta}
 * publishes and the only thing a consumer can check without importing this
 * package.
 */
export function tryUnwrap(value: Value): Color | null {
  const meta = value.meta;
  if (meta === undefined) return null;
  const { space, coords, alpha } = meta as Partial<ColorObject>;
  if (typeof space !== "string" || !Array.isArray(coords) || coords.length !== 3) {
    return null;
  }
  return new Color(space, [coords[0], coords[1], coords[2]], alpha ?? 1);
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Channel-wise arithmetic, in sRGB, clamped.
 *
 * **sRGB and not a perceptual space**, deliberately. `#f00 + #0f0` is `#ff0`,
 * which is what "add these two colours" means to everyone who types it — two
 * lights on one wall. Doing it in Oklab would be defensible physics and would
 * answer a question nobody asked; anyone who wants the perceptual blend has
 * `mix`, which interpolates in Oklab and is a different word.
 *
 * The alpha is the LEFT operand's, untouched. Adding two translucent colours
 * has no agreed compositing rule — `over`, `screen` and `plus-lighter` all
 * disagree — and picking one silently would be worse than leaving alpha alone.
 */
export function combineChannels(
  left: Color,
  right: Color,
  op: (a: number, b: number) => number,
): Color {
  const a = left.to("srgb").coords;
  const b = right.to("srgb").coords;
  return new Color(
    "srgb",
    [clamp01(op(a[0], b[0])), clamp01(op(a[1], b[1])), clamp01(op(a[2], b[2]))],
    left.alpha,
  );
}

export const addChannels = (left: Color, right: Color): Color =>
  combineChannels(left, right, (a, b) => a + b);

export const subtractChannels = (left: Color, right: Color): Color =>
  combineChannels(left, right, (a, b) => a - b);

/** Every channel times `factor`, clamped. "#808080 * 2" is white. */
export function scaleChannels(color: Color, factor: number): Color {
  const [r, g, b] = color.to("srgb").coords;
  return new Color(
    "srgb",
    [clamp01(r * factor), clamp01(g * factor), clamp01(b * factor)],
    color.alpha,
  );
}

/** The `Color` a value carries. Throws when the value is not one. */
export function unwrap(value: Value): Color {
  const color = tryUnwrap(value);
  if (color === null) {
    throw new TypeError(
      `Expected a ${COLOR_KIND} value carrying meta.space and meta.coords, got ${value.kind}`,
    );
  }
  return color;
}

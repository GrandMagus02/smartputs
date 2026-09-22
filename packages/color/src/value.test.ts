import { expect, test } from "bun:test";
import { Color, serialize } from "@urcolor/core";
import {
  addChannels,
  colorMeta,
  packSrgb,
  scaleChannels,
  subtractChannels,
  tryUnwrap,
  unitForSpace,
  unwrap,
  wrap,
} from "./value";

const parse = (css: string): Color => Color.from(css);

const hexOf = (color: Color): string => serialize(color.toObject(), "hex");

const packed = (color: Color): string =>
  `#${packSrgb(color).toNumber().toString(16).padStart(8, "0")}`;

/** `#rrggbb` and `#rrggbbaa` written the same way `packSrgb` packs them. */
const asPacked = (hex: string): string => (hex.length === 7 ? `${hex}ff` : hex);

// --- the canonical scalar ---------------------------------------------------

test("canonical is the 8-bit sRGB pixel, in RGBA order", () => {
  expect(packSrgb(parse("#3b82f6")).toNumber()).toBe(0x3b82f6ff);
  expect(packSrgb(parse("#00000000")).toNumber()).toBe(0);
  expect(packSrgb(parse("#ffffffff")).toNumber()).toBe(0xffffffff);
});

/**
 * The cost this protects is the one `packSrgb`'s comment records: a canonical
 * built by gamut-mapping and a hex string built by clamping are two readings
 * of one value, and they disagreed. Every colour outside sRGB is a chance for
 * them to drift apart again, so the assertion is equality, not closeness.
 */
test("the canonical byte-for-byte agrees with the hex serialiser, in gamut and out", () => {
  const cases = [
    "#3b82f6",
    "#eeff66",
    "oklch(1.2 0.1 250)",
    "oklch(0.9 0.3 140)",
    "lab(120 40 -50)",
    "color(display-p3 1 0 0)",
    "color(rec2020 0 1 0)",
    "rgb(0 0 0 / 50%)",
  ];
  for (const css of cases) {
    const color = parse(css);
    expect(packed(color)).toBe(asPacked(hexOf(color)));
  }
});

test("lightening past white clamps per channel rather than answering white", () => {
  // The exact regression in `packSrgb`'s note: `toGamut("srgb")` answered
  // #ffffff here while the serialiser answered #fcff75.
  const lightened = parse("#eeff66").lighten(0.2);
  expect(packed(lightened)).toBe(asPacked(hexOf(lightened)));
  expect(hexOf(lightened)).not.toBe("#ffffff");
});

// --- the meta contract ------------------------------------------------------

test("meta is the ColorObject upstream accepts, frozen", () => {
  const meta = colorMeta(parse("oklch(0.6 0.2 250)"));
  expect(meta).toEqual({ space: "oklch", coords: [0.6, 0.2, 250], alpha: 1 });
  expect(Object.isFrozen(meta)).toBe(true);
  expect(Object.isFrozen(meta.coords)).toBe(true);
});

test("a value round-trips through wrap and unwrap without moving", () => {
  const color = parse("color(display-p3 0.5 0.2 0.9 / 0.25)");
  const back = unwrap(wrap(color));
  expect(back.space).toBe("display-p3");
  expect(back.coords).toEqual(color.coords);
  expect(back.alpha).toBe(color.alpha);
});

test("tryUnwrap answers null for anything that is not that shape", () => {
  const value = (meta: unknown) =>
    ({ kind: "color", unit: "hex", canonical: packSrgb(parse("#000")), meta }) as never;
  expect(tryUnwrap(value(undefined))).toBeNull();
  expect(tryUnwrap(value({ coords: [1, 0, 0] }))).toBeNull();
  expect(tryUnwrap(value({ space: "srgb" }))).toBeNull();
  expect(tryUnwrap(value({ space: "srgb", coords: [1, 0] }))).toBeNull();
  expect(tryUnwrap(value({ space: "srgb", coords: [1, 0, 0, 1] }))).toBeNull();
  expect(() => unwrap(value({ space: "srgb" }))).toThrow(TypeError);
});

test("a colour with no alpha on meta is opaque, not transparent", () => {
  const value = {
    kind: "color",
    unit: "hex",
    canonical: packSrgb(parse("#ff0000")),
    meta: { space: "srgb", coords: [1, 0, 0] },
  } as never;
  expect(tryUnwrap(value)?.alpha).toBe(1);
});

test("hsv has no CSS form, so a colour in it is written as sRGB", () => {
  expect(unitForSpace("hsv")).toBe("srgb");
  expect(unitForSpace("oklch")).toBe("oklch");
  expect(unitForSpace("display-p3")).toBe("display-p3");
});

// --- channel arithmetic, at the edges ---------------------------------------

test("addition clamps at white and subtraction at black", () => {
  expect(hexOf(addChannels(parse("#ff0000"), parse("#ff0000")))).toBe("#ff0000");
  expect(hexOf(addChannels(parse("#808080"), parse("#808080")))).toBe("#ffffff");
  expect(hexOf(subtractChannels(parse("#000000"), parse("#ffffff")))).toBe("#000000");
});

test("the alpha of a sum is the left operand's, untouched", () => {
  // No compositing rule is picked: `over`, `screen` and `plus-lighter` disagree
  // and choosing one silently would be worse than leaving alpha alone.
  const sum = addChannels(parse("#ff000080"), parse("#00ff00ff"));
  expect(sum.alpha).toBe(parse("#ff000080").alpha);
  expect(hexOf(sum)).toBe("#ffff0080");
});

test("scaling clamps at both ends and keeps the colour's alpha", () => {
  expect(hexOf(scaleChannels(parse("#808080"), 2))).toBe("#ffffff");
  expect(hexOf(scaleChannels(parse("#808080"), 0))).toBe("#000000");
  expect(hexOf(scaleChannels(parse("#808080"), -1))).toBe("#000000");
  expect(scaleChannels(parse("#ff000080"), 2).alpha).toBe(parse("#ff000080").alpha);
});

test("arithmetic happens in sRGB whatever space the operands arrived in", () => {
  // `#f00 + #0f0` is `#ff0` — two lights on one wall. A perceptual space would
  // answer a question nobody asked.
  const sum = addChannels(parse("#ff0000").to("oklch"), parse("#00ff00"));
  expect(sum.space).toBe("srgb");
  expect(hexOf(sum)).toBe("#ffff00");
});

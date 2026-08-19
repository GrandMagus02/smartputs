import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { Color } from "@urcolor/core";
import { COLOR_KINDS } from "./color";
import colorEn from "./locale/en";
import { COLOR_KIND } from "./value";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, colorEn])],
  kinds: [...BUILTIN_KINDS, ...COLOR_KINDS],
});

const hex = (input: string) => engine.evaluate(`${input} in hex`).formatted;

// --- `of`, over the channel kind -------------------------------------------

test("a channel of a colour is a number, in CSS units", () => {
  expect(engine.evaluate("red of #eeff66").formatted).toBe("238");
  expect(engine.evaluate("green of #eeff66").formatted).toBe("255");
  expect(engine.evaluate("blue of #eeff66").formatted).toBe("102");
});

test("the answer is the number the notation would print", () => {
  // hsl(66 100% 70%) — saturation as a percentage, hue in degrees.
  expect(engine.evaluate("saturation of #eeff66").formatted).toBe("100");
  expect(Number(engine.evaluate("hue of #eeff66").formatted)).toBeCloseTo(66.667, 2);
  expect(engine.evaluate("alpha of #eeff66").formatted).toBe("100");
});

test("a channel word alone is not a colour reading anyone gets by accident", () => {
  // "red" still resolves as the CSS keyword when nothing asks for a channel.
  expect(hex("red")).toBe("#ff0000");
});

// --- arithmetic -------------------------------------------------------------

test("`+` adds channels, in sRGB", () => {
  expect(hex("#440000 + #004400")).toBe("#444400");
  expect(hex("#ff0000 + #00ff00")).toBe("#ffff00");
});

test("`+` clamps rather than wrapping", () => {
  expect(hex("#ff0000 + #ff0000")).toBe("#ff0000");
});

test("the word form of `+` works, because core already folds it", () => {
  expect(hex("#440000 plus #004400")).toBe("#444400");
});

test("`-` subtracts channels", () => {
  expect(hex("#ffff00 - #00ff00")).toBe("#ff0000");
});

test("`*` scales a colour by a number, in either order", () => {
  expect(hex("#808080 * 2")).toBe("#ffffff");
  expect(hex("2 * #404040")).toBe("#808080");
});

test("the result keeps the left operand's notation", () => {
  const r = engine.evaluate("oklch(0.5 0 0) + #000000");
  expect(r.value.unit).toBe("oklch");
});

// --- verb phrases -----------------------------------------------------------

test("`darken` reads a percentage and a fraction as the same amount", () => {
  expect(hex("#eeff66 darken 20%")).toBe(hex("#eeff66 darken 0.2"));
  expect(hex("#eeff66 darken 20%")).not.toBe("#eeff66");
});

test("lighten, saturate and desaturate all read", () => {
  for (const verb of ["lighten", "saturate", "desaturate"]) {
    const r = engine.evaluate(`#3b82f6 ${verb} 10%`);
    expect(r.kind).toBe(COLOR_KIND);
  }
});

test("`with` sets a channel in CSS units", () => {
  const r = engine.evaluate("#eeff66 with 150 hue");
  expect(r.kind).toBe(COLOR_KIND);
  expect(Number(engine.evaluate("hue of (#eeff66 with 150 hue)").formatted)).toBeCloseTo(
    150,
    4,
  );
});

test("`with` takes as many pairs as follow it", () => {
  // Two pairs, and alpha among them: an eight-digit hex is alpha surviving.
  expect(engine.evaluate("#eeff66 with 150 hue 50 alpha").formatted).toBe("#66ffb380");
});

test("`rotate` moves the hue, in the perceptual space upstream rotates in", () => {
  // `Color.rotateHue` turns the Oklch hue, not the HSL one, so reading the
  // result back in HSL does not give a clean 90. That is upstream's choice and
  // the right one; the assertion is that the verb reached it.
  const rotated = engine.evaluate("#ff0000 rotate 90 in oklch").formatted;
  expect(rotated).toBe(Color.parse("#ff0000")?.rotateHue(90).toString("oklch") ?? "");
});

test("`negate` needs no argument", () => {
  expect(hex("#000000 negate")).toBe("#ffffff");
});

test("`mix` blends toward another colour", () => {
  expect(engine.evaluate("#000000 mix #ffffff").kind).toBe(COLOR_KIND);
  expect(hex("#ff0000 mix #ff0000 30%")).toBe("#ff0000");
});

test("`add` is the verb spelling of `+`", () => {
  expect(hex("#440000 add #004400")).toBe("#444400");
});

test("verbs chain, left to right", () => {
  const byHand = Color.parse("#3b82f6")?.darken(0.1).saturate(0.1).toString("hex");
  expect(hex("#3b82f6 darken 10% saturate 10%")).toBe(byHand ?? "");
});

// --- the channel-list definition -------------------------------------------

test("a full set of named channels is a colour", () => {
  const r = engine.evaluate("100 hue 100 sat 50 brightness");
  expect(r.kind).toBe(COLOR_KIND);
  expect(r.formatted).toBe("rgb(42 128 0)");
});

test("the channel-list form converts like any other colour", () => {
  const r = engine.evaluate("100 hue 100 sat 50 brightness to oklab");
  expect(r.value.unit).toBe("oklab");
  expect(r.formatted.startsWith("oklab(")).toBe(true);
});

test("rgb and hsl sets are recognised too", () => {
  expect(hex("255 red 0 green 0 blue")).toBe("#ff0000");
  expect(hex("0 hue 100 sat 50 lightness")).toBe("#ff0000");
});

test("a partial set is not a colour", () => {
  // "100 hue" is a hue. Answering it with a fully saturated colour would be
  // inventing the two numbers the user did not type.
  expect(() => engine.evaluate("100 hue").formatted).toThrow();
});

test("channels from different spaces do not combine", () => {
  expect(() => engine.evaluate("100 hue 50 whiteness 50 lightness").formatted).toThrow();
});

test("a percentage in a channel list is that fraction of the channel's scale", () => {
  expect(hex("50% red 0 green 0 blue")).toBe(hex("127.5 red 0 green 0 blue"));
});

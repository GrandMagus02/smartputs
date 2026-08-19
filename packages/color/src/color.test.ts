import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { assertKindContract } from "@smartput/core/testing";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { color, defineColor } from "./color";
import colorEn from "./locale/en";
import { COLOR_KIND, tryUnwrap } from "./value";

const engine = createEngine({
  locales: [composeLocale(english, [...BUILTIN_EN, colorEn])],
  kinds: [...BUILTIN_KINDS, color],
});

/** The kind alone, with nobody else's aliases in the index. */
const bare = createEngine({
  locales: [composeLocale(english, [colorEn])],
  kinds: [color],
});

test("the kind satisfies the contract", () => {
  assertKindContract(color, [colorEn]);
});

test("a hex literal reads as a colour and keeps its notation", () => {
  const r = bare.evaluate("#3b82f6");
  expect(r.kind).toBe(COLOR_KIND);
  expect(r.value.unit).toBe("hex");
  expect(r.formatted).toBe("#3b82f6");
});

test("the hash is not a token, so the claim starts after it", () => {
  const r = bare.evaluate("#3b82f6");
  // The value covers the digits; the span the engine reports is what the fold
  // saw, and the point of the assertion is that nothing was left over.
  expect(r.value.meta?.space).toBe("srgb");
});

test("short and alpha hex forms both parse", () => {
  expect(bare.evaluate("#fff").formatted).toBe("#ffffff");
  expect(bare.evaluate("#3b82f680").formatted).toBe("#3b82f680");
});

test("a length that is not a hex form is not a colour", () => {
  expect(() => bare.evaluate("#3b82f").formatted).toThrow();
});

test("a functional notation reads and keeps its own space", () => {
  const r = bare.evaluate("oklch(0.6 0.2 250)");
  expect(r.value.unit).toBe("oklch");
  expect(r.formatted).toBe("oklch(0.6 0.2 250)");
});

test("`in` converts the notation and leaves the colour alone", () => {
  const r = bare.evaluate("#3b82f6 in oklch");
  expect(r.value.unit).toBe("oklch");
  expect(r.formatted).toBe("oklch(0.62308 0.18801 259.8145)");
  // The coordinates did not move: conversion happens in `serialize`, once.
  expect(r.value.meta?.space).toBe("srgb");
});

test("a round trip through another notation comes back to the same hex", () => {
  expect(bare.evaluate("#3b82f6 in oklch in hex").formatted).toBe("#3b82f6");
});

test("every notation the kind registers can be converted into", () => {
  for (const unit of ["hex", "rgb", "hsl", "hwb", "lab", "lch", "oklab", "oklch", "p3"]) {
    const r = bare.evaluate(`#3b82f6 in ${unit}`);
    expect(r.kind).toBe(COLOR_KIND);
    expect(r.formatted.length).toBeGreaterThan(0);
  }
});

test("a CSS keyword reads as a colour", () => {
  expect(bare.evaluate("rebeccapurple in hex").formatted).toBe("#663399");
});

test("a keyword that is also an ordinary word keeps its ordinary reading", () => {
  // "tan" claims a colour and the word survives beside it as the fold's
  // fallback, so an engine with other kinds installed still parses the
  // sentence rather than being forced into a colour reading.
  const r = engine.evaluate("tan in hex");
  expect(r.kind).toBe(COLOR_KIND);
  expect(r.formatted).toBe("#d2b48c");
});

test("a word an installed vocabulary spells as a unit is not claimed", () => {
  // "lab" is this kind's own notation alias, so the keyword branch must not
  // claim it as a colour — ruling R4.
  expect(() => bare.evaluate("lab").formatted).toThrow();
});

test("keywords can be turned off entirely", () => {
  const noKeywords = createEngine({
    locales: [composeLocale(english, [colorEn])],
    kinds: [defineColor({ keywords: false })],
  });
  expect(() => noKeywords.evaluate("rebeccapurple").formatted).toThrow();
  expect(noKeywords.evaluate("#663399").formatted).toBe("#663399");
});

test("the value carries a ColorObject on meta", () => {
  const { value } = bare.evaluate("oklch(0.6 0.2 250)");
  expect(value.meta?.space).toBe("oklch");
  expect(value.meta?.coords).toEqual([0.6, 0.2, 250]);
  expect(value.meta?.alpha).toBe(1);
  expect(tryUnwrap(value)?.toString("hex")).toBe("#0081f1");
});

test("canonical is the 8-bit sRGB pixel, alpha included", () => {
  const { value } = bare.evaluate("#3b82f6");
  expect(value.canonical.toNumber()).toBe(0x3b82f6ff);
});

test("colour is not ordered, so no comparison is generated", () => {
  expect(() => engine.evaluate("#fff > #000").formatted).toThrow();
});

test("a colour has no percent arithmetic and no division", () => {
  // `+`, `-` and number scaling are declared (see `ops.test.ts`); the trio
  // `generateRatioOps` would have produced for a ratio kind is not.
  expect(() => engine.evaluate("#ffffff / 2").formatted).toThrow();
  expect(() => engine.evaluate("20% of #ffffff").formatted).toThrow();
});

test("the name unit renders the colour when no dataset is loaded", () => {
  const r = bare.evaluate("#3b82f6 in name");
  expect(r.value.unit).toBe("name");
  expect(r.formatted).toBe("#3b82f6");
});

test("registering the kind does not disturb the other kinds", () => {
  expect(engine.evaluate("1 kg in g").formatted).toBe("1,000 grams");
  expect(engine.evaluate("1000 mb = 1 gb").formatted).toBe("true");
});

// --- the bracketless notation form -----------------------------------------

test("a notation reads without brackets or commas", () => {
  expect(bare.evaluate("rgb 255 60 128 in hex").formatted).toBe("#ff3c80");
  expect(bare.evaluate("oklch 0.6 0.2 250 in hex").formatted).toBe("#0081f1");
  expect(bare.evaluate("hsl 200 100% 50% in hex").formatted).toBe("#00aaff");
});

test("a digit-bearing notation name survives the scan", () => {
  // `p3`, `a98`, `rec2020` are one word each, letters then digits — the branch
  // that reads a CSS keyword stops at letters and would have read "p".
  expect(bare.evaluate("p3 1 0 0 in hex").formatted).toBe("#ff0000");
  expect(bare.evaluate("a98 1 0 0 in hex").formatted).toBe("#ff0000");
});

test("alpha still comes after a slash, as in CSS", () => {
  expect(bare.evaluate("rgb 255 60 128 / 50% in hex").formatted).toBe("#ff3c8080");
});

test("two arguments is not a colour", () => {
  // Accepting them would invent the third channel.
  expect(() => bare.evaluate("rgb 255 60").formatted).toThrow();
});

test("the bracketless form is a base like any other, so verbs follow it", () => {
  expect(bare.evaluate("rgb 255 60 128 darken 20% in hex").formatted).toBe(
    bare.evaluate("(#ff3c80 darken 20%) in hex").formatted,
  );
});

test("a notation word with no numbers after it is still a conversion target", () => {
  expect(bare.evaluate("#3b82f6 in rgb").formatted).toBe("rgb(59 130 246)");
});

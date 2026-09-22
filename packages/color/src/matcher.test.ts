import { expect, test } from "bun:test";
import { serialize } from "@urcolor/core";
import { createCssBaseReader, DEFAULT_KEYWORD_WEIGHT } from "./matcher";
import { cssFor, notationFor } from "./notations";

const read = createCssBaseReader();
const noUnits = () => false;

/** The reader, at the offset the literal fold would hand it. `#` is not a token. */
function at(input: string, offset = input.startsWith("#") ? 1 : 0) {
  const hit = read(input, offset, noUnits);
  if (hit === null) return null;
  return {
    hex: serialize(hit.color.toObject(), "hex"),
    unit: hit.unit,
    end: hit.end,
    weight: hit.weight,
  };
}

// --- hex, in the four lengths CSS has ---------------------------------------

test("every hex length a person writes reads, and nothing between them", () => {
  expect(at("#abc")?.hex).toBe("#aabbcc");
  expect(at("#abcd")?.hex).toBe("#aabbccdd");
  expect(at("#abcdef")?.hex).toBe("#abcdef");
  expect(at("#abcdef80")?.hex).toBe("#abcdef80");
  expect(at("#ABCDEF")?.hex).toBe("#abcdef");
  expect(at("#ab")).toBeNull();
  expect(at("#abcde")).toBeNull();
  expect(at("#abcdefa")).toBeNull();
});

test("the hash is offered from either side and the span covers it once", () => {
  // `lex` drops the hash, so the fold offers offset 1; `expression.ts` reads raw
  // characters and lands on the hash itself. Both are real positions.
  expect(at("#3b82f6", 1)?.end).toBe(7);
  expect(at("#3b82f6", 0)?.end).toBe(7);
  expect(at("#3b82f6", 0)?.hex).toBe(at("#3b82f6", 1)?.hex);
});

test("a hex colour keeps `hex` as its notation, not the space it landed in", () => {
  expect(at("#3b82f6")?.unit).toBe("hex");
});

// --- the functional forms ---------------------------------------------------

test("the CSS function forms people paste all read", () => {
  expect(at("rgb(0 0 0 / 50%)")?.hex).toBe("#00000080");
  expect(at("rgb(0,0,0)")?.hex).toBe("#000000");
  expect(at("rgba(1,2,3,0.5)")?.hex).toBe("#01020380");
  expect(at("rgb(none 0 0)")?.hex).toBe("#000000");
  expect(at("oklch(0.6 0.2 250)")?.hex).toBe("#0081f1");
  expect(at("hsl(200deg 100% 50%)")?.hex).toBe("#00aaff");
  expect(at("hsl(0.5turn 100% 50%)")?.hex).toBe("#00ffff");
  expect(at("color(display-p3 1 0 0)")?.unit).toBe("display-p3");
});

test("a percentage lightness is not the same colour as the raw number", () => {
  // `oklch(62% …)` is lightness 0.62; reading the 62 literally would be a
  // factor-of-100 error that still parses.
  expect(at("oklch(62% 0.2 250)")?.hex).not.toBe(at("oklch(62 0.2 250)")?.hex);
  expect(at("oklch(62% 0.2 250)")?.hex).toBe(at("oklch(0.62 0.2 250)")?.hex);
});

test("a functional notation names its own space", () => {
  expect(at("oklch(0.6 0.2 250)")?.unit).toBe("oklch");
  expect(at("hsl(200deg 100% 50%)")?.unit).toBe("hsl");
});

test("the span of a functional form ends on the closing bracket", () => {
  expect(at("oklch(0.6 0.2 250)")?.end).toBe("oklch(0.6 0.2 250)".length);
  expect(at("color(display-p3 1 0 0)")?.end).toBe("color(display-p3 1 0 0)".length);
  expect(at("rgb(0 0 0 / 50%) + #111")?.end).toBe("rgb(0 0 0 / 50%)".length);
});

// --- the bracketless form ---------------------------------------------------

test("the bracketless form reads the same colour as the CSS one", () => {
  expect(at("rgb 255 60 128")?.hex).toBe(at("rgb(255 60 128)")?.hex);
  expect(at("rgb 255 60 128 / 50%")?.hex).toBe("#ff3c8080");
  expect(at("hsl 0.5turn 100% 50%")?.hex).toBe(at("hsl(0.5turn 100% 50%)")?.hex);
  expect(at("rgb none 0 0")?.hex).toBe("#000000");
});

test("a notation name with digits in it survives the scan", () => {
  // A letters-only scan read "p" and gave up.
  expect(at("p3 1 0 0")?.unit).toBe("display-p3");
  expect(at("a98 1 0 0")?.unit).toBe("a98-rgb");
  expect(at("rec2020 1 0 0")?.unit).toBe("rec2020");
  expect(at("xyz 0.4 0.2 0.1")?.unit).toBe("xyz-d65");
});

test("hex has no function, so it has no bracketless form either", () => {
  expect(at("hex 255 0 0")).toBeNull();
  expect(cssFor(notationFor("hex") as never, ["255", "0", "0"])).toBe("");
});

test("fewer than three arguments is not a colour", () => {
  // Accepting two would invent the third channel.
  expect(at("rgb 255 60")).toBeNull();
  expect(at("rgb 255")).toBeNull();
});

test("the arguments must be separated, so `rgb255 60 128` is not one", () => {
  expect(at("rgb255 60 128")).toBeNull();
});

test("the span of a bracketless form stops after the last argument it read", () => {
  expect(at("rgb 255 60 128 darken 20%")?.end).toBe("rgb 255 60 128".length);
  expect(at("rgb 255 60 128 / 50% x")?.end).toBe("rgb 255 60 128 / 50%".length);
});

// --- the keyword branch -----------------------------------------------------

test("a CSS keyword reads, and is weighted down because it is also a word", () => {
  expect(at("rebeccapurple")?.hex).toBe("#663399");
  expect(at("tan")?.weight).toBe(DEFAULT_KEYWORD_WEIGHT);
  expect(at("transparent")?.hex).toBe("#00000000");
  expect(at("notacolour")).toBeNull();
});

test("a word an installed vocabulary spells as a unit is not claimed", () => {
  // Ruling R4. The guard is the reader's caller, so it is checked here.
  const yes = () => true;
  expect(read("tan", 0, yes)).toBeNull();
  // Syntax is not a word, so the guard does not reach it.
  expect(read("#3b82f6", 1, yes)).not.toBeNull();
});

test("keywords can be turned off without touching the syntax branches", () => {
  const noKeywords = createCssBaseReader({ keywords: false });
  expect(noKeywords("tan", 0, noUnits)).toBeNull();
  expect(noKeywords("#3b82f6", 1, noUnits)).not.toBeNull();
  expect(noKeywords("rgb 255 60 128", 0, noUnits)).not.toBeNull();
});

test("the weights are the consumer's to move", () => {
  const reweighted = createCssBaseReader({ syntaxWeight: 3, keywordWeight: -1 });
  expect(reweighted("#3b82f6", 1, noUnits)?.weight).toBe(3);
  expect(reweighted("tan", 0, noUnits)?.weight).toBe(-1);
});

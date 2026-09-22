import { expect, test } from "bun:test";
import { Color } from "@urcolor/core";
import {
  ALPHA_KEY,
  CHANNELS,
  type ChannelAmount,
  channelByLabel,
  channelFor,
  colorFromChannels,
  matchChannelWord,
  readChannel,
  resolveChannel,
  writeChannel,
} from "./channels";

const def = (alias: string) => {
  const hit = channelFor(alias);
  if (hit === undefined) throw new Error(`no channel called ${alias}`);
  return hit;
};

const amount = (alias: string, css: number): ChannelAmount => ({
  def: def(alias),
  css,
});

const hex = (color: Color | null) => color?.toString("hex") ?? null;

// --- reading and writing, in CSS units --------------------------------------

test("every channel reads back what was written into it, at the gamut edges", () => {
  // Black and white are where a 0–1 channel and a 0–100 one disagree quietly,
  // and an out-of-gamut colour is where a conversion would round it away.
  for (const css of ["#000000", "#ffffff", "#eeff66", "oklch(0.9 0.3 140)"]) {
    const color = Color.from(css);
    for (const channel of CHANNELS) {
      const value = readChannel(color, channel);
      const back = readChannel(writeChannel(color, channel, value), channel);
      expect(back).toBeCloseTo(value, 6);
    }
  }
});

test("a channel answers in the units its own notation prints", () => {
  const color = Color.from("#eeff66");
  expect(readChannel(color, def("red"))).toBe(238);
  expect(readChannel(color, def("green"))).toBe(255);
  expect(readChannel(color, def("blue"))).toBe(102);
  expect(readChannel(color, def("hue"))).toBeCloseTo(66.667, 2);
  expect(readChannel(color, def("saturation"))).toBeCloseTo(100, 6);
  expect(readChannel(color, def("alpha"))).toBe(100);
});

/**
 * The factor-of-100 hazard, named. `scale` turns a CSS number into the native
 * one and `percentRef` is what `100%` is worth, and they are the same number
 * for every channel but the two angles-and-chroma cases. A channel whose
 * `percentRef` silently became its `scale` would make "50% hue" 0.5° and "50%
 * chroma" half of nothing.
 */
test("100% of a channel is percentRef, which is not always its scale", () => {
  for (const channel of CHANNELS) {
    expect(channel.percentRef).toBeGreaterThan(0);
    const differs = channel.percentRef !== channel.scale;
    expect(differs).toBe(channel.label === "Hue" || channel.label === "Chroma");
  }
  expect(def("hue").percentRef).toBe(360);
  expect(def("chroma").percentRef).toBe(0.4);
});

test("alpha is not a coordinate, and is the only channel that is not", () => {
  expect(def("alpha").key).toBe(ALPHA_KEY);
  expect(CHANNELS.filter((c) => c.key === ALPHA_KEY)).toHaveLength(1);
  expect(writeChannel(Color.from("#eeff66"), def("alpha"), 50).alpha).toBeCloseTo(0.5, 6);
});

test("a channel is read in its own space, never in the colour's", () => {
  // `b` is sRGB blue, HWB blackness and Lab's b axis. A colour that arrived as
  // `hwb(…)` must still answer 102 for blue.
  const asHwb = Color.from("#eeff66").to("hwb");
  expect(readChannel(asHwb, def("blue"))).toBeCloseTo(102, 4);
  expect(readChannel(asHwb, def("blackness"))).toBeCloseTo(0, 4);
});

// --- the channel-list definition --------------------------------------------

test("a full set of named channels picks the space they are all at home in", () => {
  expect(
    hex(
      colorFromChannels([
        amount("hue", 100),
        amount("sat", 100),
        amount("brightness", 50),
      ]),
    ),
  ).toBe("#2a8000");
  expect(
    hex(colorFromChannels([amount("red", 255), amount("green", 0), amount("blue", 0)])),
  ).toBe("#ff0000");
  expect(
    hex(
      colorFromChannels([amount("hue", 0), amount("sat", 100), amount("lightness", 50)]),
    ),
  ).toBe("#ff0000");
  expect(
    hex(
      colorFromChannels([
        amount("hue", 100),
        amount("whiteness", 50),
        amount("blackness", 20),
      ]),
    ),
  ).toBe("#99cc80");
});

test("a channel must be at home in the space, not merely share a letter with it", () => {
  // {hue, whiteness, blue} must not quietly become HWB on the strength of `b`.
  expect(
    colorFromChannels([amount("hue", 100), amount("whiteness", 50), amount("blue", 50)]),
  ).toBeNull();
});

test("a partial set is not a colour", () => {
  // "100 hue" is a hue. Answering it with a fully saturated colour invents the
  // two numbers nobody typed.
  expect(colorFromChannels([amount("hue", 100)])).toBeNull();
  expect(colorFromChannels([amount("red", 1), amount("green", 2)])).toBeNull();
  expect(colorFromChannels([])).toBeNull();
});

test("the same channel twice is not a set of three", () => {
  expect(
    colorFromChannels([amount("red", 1), amount("red", 2), amount("green", 3)]),
  ).toBeNull();
});

test("alpha is optional and does not count toward the three", () => {
  const opaque = colorFromChannels([
    amount("red", 255),
    amount("green", 0),
    amount("blue", 0),
  ]);
  const translucent = colorFromChannels([
    amount("red", 255),
    amount("green", 0),
    amount("blue", 0),
    amount("alpha", 50),
  ]);
  expect(opaque?.alpha).toBe(1);
  expect(translucent?.alpha).toBeCloseTo(0.5, 6);
  expect(colorFromChannels([amount("red", 255), amount("alpha", 50)])).toBeNull();
});

test("chroma is in no list, because its lightness would be on the wrong scale", () => {
  expect(def("chroma").listSpaces).toHaveLength(0);
  expect(
    colorFromChannels([
      amount("lightness", 50),
      amount("chroma", 0.1),
      amount("hue", 100),
    ]),
  ).toBeNull();
});

// --- the words --------------------------------------------------------------

test("a channel word is read in letters, not in ASCII", () => {
  expect(matchChannelWord("brightness of x", 0)?.def.label).toBe("Brightness");
  expect(matchChannelWord("of x", 0)).toBeNull();
  const words = { насиченість: "ch-saturation" };
  expect(matchChannelWord("насиченість of x", 0, words)?.def.label).toBe("Saturation");
});

test("a two-word channel name is read whole", () => {
  // Arabic's hue is `درجة اللون`, and a one-word scan read `درجة` and gave up.
  const words = { "درجة اللون": "ch-hue" };
  const hit = matchChannelWord("درجة اللون", 0, words);
  expect(hit?.def.label).toBe("Hue");
  expect(hit?.end).toBe("درجة اللون".length);
});

test("the longest name wins, so a one-word prefix does not take the phrase", () => {
  const words = { light: "ch-lightness", "light ness": "ch-blackness" };
  expect(matchChannelWord("light ness", 0, words)?.def.label).toBe("Blackness");
  expect(matchChannelWord("light x", 0, words)?.def.label).toBe("Lightness");
});

test("an English alias always wins over a translation of another channel", () => {
  expect(resolveChannel("red", { red: "ch-blue" })?.label).toBe("Red");
  expect(resolveChannel("rouge", { rouge: "ch-red" })?.label).toBe("Red");
  expect(resolveChannel("rouge")).toBeUndefined();
});

test("every channel is reachable by its label, which is the translation key", () => {
  for (const channel of CHANNELS) {
    expect(channelByLabel(channel.label)).toBe(channel);
  }
});

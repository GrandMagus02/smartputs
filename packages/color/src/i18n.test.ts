import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { ukrainian } from "@smartput/core/locale/uk";
import { Color } from "@urcolor/core";
import { defineColorKinds } from "./color";
import { channelWordsFor, loadColorNames } from "./i18n";
import colorEn from "./locale/en";
import colorUk from "./locale/uk";

const names = await loadColorNames(["en"]);

const engine = createEngine({
  locales: [composeLocale(english, [colorEn])],
  kinds: [...defineColorKinds({ names })],
});

test("a loaded dataset satisfies ColorNameLookup structurally", () => {
  // The whole coupling: `ColorNames` is not wrapped, adapted or subclassed.
  const [lookup] = names;
  expect(typeof lookup?.of).toBe("function");
  expect(typeof lookup?.colorOf).toBe("function");
  expect(lookup?.resolvedOptions().locale).toBe("en");
});

test("a colour term reads as a colour", () => {
  const r = engine.evaluate("sky blue in hex");
  expect(r.kind).toBe("color");
  expect(r.formatted).toBe(names[0]?.colorOf("sky blue")?.toString("hex") ?? "");
});

test("the `name` unit renders through the dataset", () => {
  expect(engine.evaluate("#3b82f6 in name").formatted).toBe(
    names[0]?.of(Color.parse("#3b82f6") as Color) ?? "",
  );
});

test("a term is a base, so a verb may follow it", () => {
  const r = engine.evaluate("sky blue darken 20% in hex");
  expect(r.kind).toBe("color");
  expect(r.formatted).not.toBe(engine.evaluate("sky blue in hex").formatted);
});

test("channel words arrive from ChannelNames, not from this repository", () => {
  const uk = channelWordsFor(["uk"]);
  expect(uk.насиченість).toBe("ch-saturation");
  expect(uk.червоний).toBe("ch-red");

  const de = channelWordsFor(["de"]);
  expect(de.sättigung).toBe("ch-saturation");
});

test("a Ukrainian engine reads Ukrainian channel words", () => {
  const ukEngine = createEngine({
    locales: [composeLocale(ukrainian, [colorUk])],
    kinds: [...defineColorKinds({ channelWords: channelWordsFor(["uk"]) })],
  });
  expect(ukEngine.evaluate("0 тон 100 насиченість 50 світлість в hex").formatted).toBe(
    "#ff0000",
  );
});

test("the first locale wins a collision, and Japanese has one", () => {
  // 彩度 is both saturation and chroma upstream. `CHANNELS` order decides, and
  // saturation comes first — stated in `channelWordsFor`'s doc comment.
  const ja = channelWordsFor(["ja"]);
  expect(ja.彩度).toBe("ch-saturation");
});

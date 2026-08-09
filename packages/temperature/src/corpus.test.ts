import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { number } from "@smartput/number";
import numberEn from "@smartput/number/locale/en";
import { tempdelta, temperature } from "./index";
import temperatureEn from "./locale/en";

/**
 * The corpus for `@smartput/temperature`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * Two kinds, because a temperature and a difference between two of them are not the same thing: `30 C - 20 C` is 10 degrees of delta, not the temperature 10°C. The vocabulary is spread, not nested — this package exports one per kind.
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 */
const engine = createEngine({
  locales: [composeLocale(en, [numberEn, ...temperatureEn])],
  kinds: [number, temperature, tempdelta],
});
const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(10);
});

for (const [input, kind, canonical, formatted] of rows) {
  test(`corpus: ${input}`, () => {
    const r = engine.evaluate(input as string);
    expect(r.kind).toBe(kind as string);
    expect(r.value.canonical.toString()).toBe(canonical as string);
    expect(r.formatted).toBe(formatted as string);
  });
}

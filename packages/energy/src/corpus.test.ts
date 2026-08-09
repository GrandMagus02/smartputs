import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { duration } from "@smartput/duration";
import durationEn from "@smartput/duration/locale/en";
import { number } from "@smartput/number";
import numberEn from "@smartput/number/locale/en";
import { power } from "@smartput/power";
import powerEn from "@smartput/power/locale/en";
import { energy } from "./index";
import energyEn from "./locale/en";

/**
 * The corpus for `@smartput/energy`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * `power` and `duration` are registered but not depended on: this kind owns all four signatures of the power x duration bridge and names both operands by id string.
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 */
const engine = createEngine({
  locales: [composeLocale(en, [numberEn, durationEn, powerEn, energyEn])],
  kinds: [number, duration, power, energy],
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

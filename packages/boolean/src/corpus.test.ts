import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

/**
 * The corpus for `@smartput/boolean`: one row per sentence someone might type,
 * asserted end to end through an engine built out of what this package
 * publishes and nothing more.
 *
 * The whole built-in set, and not a hand-picked pair: this kind generates no operation of its own, so every row below is a comparison signature core generated for some *other* kind. A corpus over two kinds would only prove those two.
 *
 * Four columns — input, kind, canonical, formatted — because a kind that reads
 * a sentence and lands on the right number in the wrong kind, or the right
 * number under the wrong words, has failed in a way a single assertion would
 * miss.
 */
const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
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
